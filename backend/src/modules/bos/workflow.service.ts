import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, ProjectPriority, TaskCategory, TaskStatus, WorkflowRunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../infrastructure/notifications/notification.service';
import { OpsService } from './ops.service';
import {
  matchAllConditions,
  validateWorkflowShape,
  wouldLoop,
  WorkflowAction,
  WorkflowCondition,
  WorkflowContext,
} from './workflow-evaluator';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private ops: OpsService,
  ) {}

  async list(companyId: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { companyId },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(companyId: string, userId: string, dto: {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig?: object;
    conditions?: WorkflowCondition[];
    actions?: WorkflowAction[];
    requireApproval?: boolean;
    retryLimit?: number;
    enabled?: boolean;
  }) {
    const errors = validateWorkflowShape({
      triggerType: dto.triggerType,
      conditions: dto.conditions ?? [],
      actions: dto.actions ?? [],
    });
    if (errors.length) throw new BadRequestException(errors.join('; '));
    return this.prisma.workflowDefinition.create({
      data: {
        companyId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig as object | undefined,
        conditions: (dto.conditions ?? []) as object[],
        actions: (dto.actions ?? []) as object[],
        requireApproval: dto.requireApproval ?? false,
        retryLimit: dto.retryLimit ?? 2,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(companyId: string, id: string, dto: Partial<{
    name: string;
    description: string;
    enabled: boolean;
    triggerType: string;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
    requireApproval: boolean;
  }>) {
    const wf = await this.prisma.workflowDefinition.findFirst({ where: { id, companyId } });
    if (!wf) throw new NotFoundException('Workflow not found');
    if (dto.triggerType || dto.conditions || dto.actions) {
      const errors = validateWorkflowShape({
        triggerType: dto.triggerType ?? wf.triggerType,
        conditions: dto.conditions ?? (wf.conditions as WorkflowCondition[]),
        actions: dto.actions ?? (wf.actions as WorkflowAction[]),
      });
      if (errors.length) throw new BadRequestException(errors.join('; '));
    }
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
        triggerType: dto.triggerType,
        conditions: dto.conditions as object[] | undefined,
        actions: dto.actions as object[] | undefined,
        requireApproval: dto.requireApproval,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const wf = await this.prisma.workflowDefinition.findFirst({ where: { id, companyId } });
    if (!wf) throw new NotFoundException('Workflow not found');
    await this.prisma.workflowDefinition.delete({ where: { id } });
    return { ok: true };
  }

  async emit(companyId: string, triggerType: string, ctx: WorkflowContext) {
    const workflows = await this.prisma.workflowDefinition.findMany({
      where: { companyId, enabled: true, triggerType },
    });
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const results = [];
    for (const wf of workflows) {
      const conditions = (wf.conditions as WorkflowCondition[]) ?? [];
      if (!matchAllConditions(conditions, ctx)) continue;
      const recent = await this.prisma.workflowRun.findMany({
        where: { workflowId: wf.id, createdAt: { gte: hourAgo } },
        select: { workflowId: true, status: true },
      });
      if (recent.length >= wf.maxRunsPerHour) {
        results.push({ workflowId: wf.id, skipped: 'rate_limit' });
        continue;
      }
      if (wouldLoop(recent.map((r) => r.workflowId), wf.id)) {
        results.push({ workflowId: wf.id, skipped: 'loop_detected' });
        continue;
      }
      const idempotencyKey = `${wf.id}:${triggerType}:${JSON.stringify(ctx.task ?? ctx)}`.slice(0, 180);
      const dup = await this.prisma.workflowRun.findUnique({ where: { idempotencyKey } });
      if (dup) {
        results.push({ workflowId: wf.id, skipped: 'idempotent' });
        continue;
      }
      results.push(await this.execute(wf.id, companyId, ctx, idempotencyKey));
    }
    return results;
  }

  private async execute(workflowId: string, companyId: string, ctx: WorkflowContext, idempotencyKey: string) {
    const wf = await this.prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
    if (!wf) return { skipped: 'missing' };
    const run = await this.prisma.workflowRun.create({
      data: {
        companyId,
        workflowId,
        idempotencyKey,
        status: WorkflowRunStatus.RUNNING,
        triggerPayload: ctx as object,
      },
    });
    try {
      if (wf.requireApproval) {
        await this.ops.audit({
          companyId,
          action: 'WORKFLOW_APPROVAL_REQUIRED',
          targetType: 'WorkflowDefinition',
          targetId: wf.id,
        });
        await this.prisma.workflowRun.update({
          where: { id: run.id },
          data: { status: WorkflowRunStatus.SKIPPED, result: { waitingApproval: true } },
        });
        return { workflowId: wf.id, status: 'approval_required' };
      }
      await this.ops.assertSideEffect(companyId, 'notify', false).catch(() => undefined);
      const actions = (wf.actions as WorkflowAction[]) ?? [];
      const applied: string[] = [];
      for (const action of actions) {
        await this.applyAction(companyId, action, ctx);
        applied.push(action.type);
      }
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: WorkflowRunStatus.SUCCESS, result: { applied } },
      });
      await this.ops.logAiOp({
        companyId,
        type: 'WORKFLOW',
        summary: `${wf.name}: ${applied.join(', ')}`,
        status: 'SUCCESS',
      });
      return { workflowId: wf.id, status: 'SUCCESS', applied };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Workflow ${wf.name} failed: ${message}`);
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: WorkflowRunStatus.FAILED, error: message.slice(0, 400) },
      });
      return { workflowId: wf.id, status: 'FAILED', error: message };
    }
  }

  private async applyAction(companyId: string, action: WorkflowAction, ctx: WorkflowContext) {
    const cfg = action.config ?? {};
    switch (action.type) {
      case 'NOTIFY': {
        const employeeId = String(cfg.employeeId ?? ctx.task && (ctx.task as { assigneeId?: string }).assigneeId ?? '');
        if (!employeeId) return;
        await this.notifications.send(
          employeeId,
          NotificationType.WORKFLOW,
          String(cfg.title ?? 'Workflow'),
          String(cfg.message ?? 'Automated notice'),
        );
        return;
      }
      case 'FOLLOW_UP_REMINDER':
      case 'ESCALATE': {
        const employeeId = String(cfg.employeeId ?? '');
        if (!employeeId) {
          const owner = await this.prisma.company.findUnique({ where: { id: companyId }, select: { ownerId: true } });
          const emp = await this.prisma.employee.findFirst({ where: { companyId, userId: owner?.ownerId } });
          if (emp) {
            await this.notifications.send(
              emp.id,
              NotificationType.ESCALATION,
              'Escalation',
              String(cfg.message ?? 'Unresolved workflow item'),
            );
          }
          return;
        }
        await this.notifications.send(
          employeeId,
          NotificationType.ESCALATION,
          'Escalation',
          String(cfg.message ?? 'Needs attention'),
        );
        return;
      }
      case 'CREATE_TASK': {
        await this.ops.assertSideEffect(companyId, 'create_task');
        const project = await this.prisma.project.findFirst({ where: { companyId } });
        if (!project) return;
        const title = String(cfg.title ?? 'Follow-up task').slice(0, 180);
        const dup = await this.prisma.task.findFirst({
          where: { projectId: project.id, title, createdAt: { gte: new Date(Date.now() - 6 * 3600 * 1000) } },
        });
        if (dup) return;
        await this.prisma.task.create({
          data: {
            projectId: project.id,
            title,
            description: String(cfg.description ?? 'Created by workflow'),
            category: TaskCategory.OTHER,
            status: TaskStatus.PENDING,
            priority: ProjectPriority.MEDIUM,
            aiGenerated: true,
          },
        });
        return;
      }
      case 'ASSIGN_TASK': {
        const taskId = String(cfg.taskId ?? (ctx.task as { id?: string } | undefined)?.id ?? '');
        const employeeId = String(cfg.employeeId ?? '');
        if (!taskId || !employeeId) return;
        await this.ops.assertSideEffect(companyId, 'reassign');
        await this.prisma.taskAssignment.upsert({
          where: { taskId_employeeId: { taskId, employeeId } },
          update: { status: TaskStatus.ASSIGNED },
          create: { taskId, employeeId, assignedBy: 'WORKFLOW', status: TaskStatus.ASSIGNED },
        });
        return;
      }
      case 'REQUEST_APPROVAL':
        await this.ops.audit({
          companyId,
          action: 'APPROVAL_REQUESTED',
          targetType: 'Workflow',
          metadata: cfg,
        });
        return;
      case 'GENERATE_DIAGNOSIS':
        await this.ops.logAiOp({
          companyId,
          type: 'DIAGNOSE',
          summary: 'Workflow requested AI diagnosis',
          status: 'STARTED',
        });
        return;
      default:
        throw new BadRequestException('Unsupported action');
    }
  }

  async tickScheduled(companyId: string) {
    return this.emit(companyId, 'SCHEDULED_TIME', { companyId, now: Date.now() });
  }

  async tickOverdue(companyId: string) {
    const overdue = await this.prisma.task.findMany({
      where: { project: { companyId }, status: TaskStatus.OVERDUE },
      include: { assignments: true },
      take: 30,
    });
    for (const task of overdue) {
      const hours = task.deadline ? (Date.now() - task.deadline.getTime()) / 3600000 : 0;
      await this.emit(companyId, 'TASK_OVERDUE', {
        companyId,
        task: {
          id: task.id,
          status: task.status,
          priority: task.priority,
          hoursOverdue: hours / 24,
          assigneeId: task.assignments[0]?.employeeId,
        },
      });
    }
  }
}
