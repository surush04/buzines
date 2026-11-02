import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { TaskStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../infrastructure/notifications/notification.service';
import { NotificationType } from '@prisma/client';
import { OpsService } from './ops.service';
import { WorkflowService } from './workflow.service';

@Injectable()
export class VerificationService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private ops: OpsService,
    private workflows: WorkflowService,
  ) {}

  idempotencyKey(taskId: string, employeeId: string, summary: string) {
    return createHash('sha256').update(`${taskId}:${employeeId}:${summary.trim().toLowerCase()}`).digest('hex');
  }

  async submit(params: {
    companyId: string;
    taskId: string;
    employeeId: string;
    summary: string;
    evidenceLinks?: string[];
    measurableOutcome?: string;
    claimedValue?: number;
  }) {
    const task = await this.prisma.task.findFirst({
      where: { id: params.taskId, project: { companyId: params.companyId } },
    });
    if (!task) throw new NotFoundException('Task not found');

    const key = this.idempotencyKey(params.taskId, params.employeeId, params.summary);
    const existing = await this.prisma.completionReport.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      return { report: existing, duplicate: true };
    }

    const pending = await this.prisma.completionReport.findFirst({
      where: {
        taskId: params.taskId,
        employeeId: params.employeeId,
        status: { in: [VerificationStatus.PENDING_REVIEW, VerificationStatus.UNVERIFIED] },
      },
    });
    if (pending) {
      throw new BadRequestException('A completion report is already awaiting review');
    }

    const crmHint = this.inspectInternalRecords(params.summary, params.claimedValue);
    let status: VerificationStatus = VerificationStatus.UNVERIFIED;
    if (params.evidenceLinks?.length || params.measurableOutcome) {
      status = VerificationStatus.PENDING_REVIEW;
    }
    if (crmHint.found && crmHint.discrepancy) status = VerificationStatus.DISCREPANCY;
    else if (crmHint.found && !crmHint.discrepancy) status = VerificationStatus.PENDING_REVIEW;

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.completionReport.create({
        data: {
          companyId: params.companyId,
          taskId: params.taskId,
          employeeId: params.employeeId,
          summary: params.summary,
          evidenceLinks: params.evidenceLinks ?? [],
          measurableOutcome: params.measurableOutcome,
          claimedValue: params.claimedValue,
          verifiedValue: crmHint.verifiedValue,
          internalRecordNote: crmHint.note,
          status,
          idempotencyKey: key,
        },
      });
      await tx.task.update({
        where: { id: params.taskId },
        data: {
          status: TaskStatus.COMPLETED_PENDING_VERIFICATION,
          completedAt: null,
        },
      });
      await tx.taskAssignment.updateMany({
        where: { taskId: params.taskId, employeeId: params.employeeId },
        data: { status: TaskStatus.COMPLETED_PENDING_VERIFICATION, completedAt: null },
      });
      return created;
    });

    await this.ops.audit({
      companyId: params.companyId,
      action: 'COMPLETION_SUBMITTED',
      targetType: 'CompletionReport',
      targetId: report.id,
    });
    await this.workflows.emit(params.companyId, 'COMPLETION_SUBMITTED', {
      task: { status: TaskStatus.COMPLETED_PENDING_VERIFICATION, assigneeId: params.employeeId },
      companyId: params.companyId,
    });
    return { report, duplicate: false, recordCheck: crmHint };
  }

  inspectInternalRecords(summary: string, claimedValue?: number) {
    const match = summary.match(/(\d+)/);
    const claimed = claimedValue ?? (match ? Number(match[1]) : undefined);
    return {
      found: false,
      discrepancy: false,
      verifiedValue: undefined as number | undefined,
      note: 'No connected CRM or internal activity log. Result remains UNVERIFIED until a manager reviews evidence. The LLM did not confirm this event.',
      claimed,
    };
  }

  async list(companyId: string, status?: VerificationStatus) {
    return this.prisma.completionReport.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: {
        employee: { select: { firstName: true, lastName: true, role: true } },
        task: { select: { id: true, title: true, status: true, category: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async review(
    companyId: string,
    reportId: string,
    reviewerId: string,
    approve: boolean,
    reason?: string,
  ) {
    const report = await this.prisma.completionReport.findFirst({
      where: { id: reportId, companyId },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (!approve && !reason?.trim()) {
      throw new BadRequestException('Rejection requires a reason');
    }

    const status = approve ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
    const taskStatus = approve ? TaskStatus.COMPLETED : TaskStatus.REJECTED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.completionReport.update({
        where: { id: reportId },
        data: { status },
      });
      await tx.verificationReview.create({
        data: { reportId, reviewerId, status, reason },
      });
      await tx.task.update({
        where: { id: report.taskId },
        data: {
          status: taskStatus,
          completedAt: approve ? new Date() : null,
        },
      });
      await tx.taskAssignment.updateMany({
        where: { taskId: report.taskId, employeeId: report.employeeId },
        data: { status: taskStatus, completedAt: approve ? new Date() : null },
      });
      return next;
    });

    await this.notifications.send(
      report.employeeId,
      NotificationType.VERIFICATION,
      approve ? 'Иҷро тасдиқ шуд' : 'Иҷро рад шуд',
      approve ? 'Гузориши шумо тасдиқ гардид.' : `Сабаб: ${reason}`,
    );
    await this.ops.audit({
      companyId,
      actorUserId: reviewerId,
      action: approve ? 'COMPLETION_VERIFIED' : 'COMPLETION_REJECTED',
      targetType: 'CompletionReport',
      targetId: reportId,
      metadata: { reason },
    });
    if (!approve) {
      await this.workflows.emit(companyId, 'COMPLETION_REJECTED', {
        task: { status: TaskStatus.REJECTED, assigneeId: report.employeeId },
        companyId,
      });
    }
    return updated;
  }
}
