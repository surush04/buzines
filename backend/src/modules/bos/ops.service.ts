import { ForbiddenException, Injectable } from '@nestjs/common';
import { AiAutonomyLevel, AiOperationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { canAiPerform, SideEffectKind } from './autonomy.policy';

@Injectable()
export class OpsService {
  constructor(private prisma: PrismaService) {}

  async audit(params: {
    companyId: string;
    actorUserId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    outcome?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
  }) {
    const { metadata, ...rest } = params;
    return this.prisma.auditEvent.create({
      data: {
        ...rest,
        outcome: rest.outcome ?? 'SUCCESS',
        metadata: metadata as object | undefined,
      },
    });
  }

  async logAiOp(params: {
    companyId: string;
    type: string;
    summary: string;
    status?: AiOperationStatus;
    error?: string;
    tokensUsed?: number;
    correlationId?: string;
  }) {
    return this.prisma.aiOperation.create({
      data: {
        companyId: params.companyId,
        type: params.type,
        summary: params.summary.slice(0, 500),
        status: params.status ?? AiOperationStatus.STARTED,
        error: params.error?.slice(0, 500),
        tokensUsed: params.tokensUsed,
        correlationId: params.correlationId,
      },
    });
  }

  async recordJob(jobName: string, status: string, detail?: string, companyId?: string) {
    return this.prisma.jobRun.create({
      data: { jobName, status, detail: detail?.slice(0, 500), companyId, finishedAt: new Date() },
    });
  }

  async getAiSettings(companyId: string) {
    return (
      (await this.prisma.aiSettings.findUnique({ where: { companyId } })) ?? {
        autonomyLevel: AiAutonomyLevel.ADVISOR,
        aiPaused: false,
        allowExternalActions: false,
        maxLowRiskPerDay: 50,
      }
    );
  }

  async assertSideEffect(companyId: string, kind: SideEffectKind, humanApproved = false) {
    const settings = await this.getAiSettings(companyId);
    const decision = canAiPerform(settings.autonomyLevel, kind, {
      paused: settings.aiPaused,
      allowExternal: settings.allowExternalActions,
      humanApproved,
    });
    if (!decision.ok) throw new ForbiddenException(decision.reason);
    if (kind === 'create_task' || kind === 'reassign') {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const used = await this.prisma.aiOperation.count({
        where: {
          companyId,
          type: { in: ['TASK_GENERATE', 'WORKFLOW'] },
          createdAt: { gte: since },
          status: AiOperationStatus.SUCCESS,
        },
      });
      if (used >= (settings.maxLowRiskPerDay ?? 50)) {
        throw new ForbiddenException('Daily AI action limit reached');
      }
    }
    return decision;
  }

  async pause(companyId: string, userId: string, reason: string, paused: boolean) {
    await this.prisma.aiSettings.upsert({
      where: { companyId },
      update: {
        aiPaused: paused,
        pauseReason: paused ? reason : null,
        pausedAt: paused ? new Date() : null,
        pausedByUserId: paused ? userId : null,
      },
      create: {
        companyId,
        aiPaused: paused,
        pauseReason: paused ? reason : null,
        pausedAt: paused ? new Date() : null,
        pausedByUserId: paused ? userId : null,
      },
    });
    await this.audit({
      companyId,
      actorUserId: userId,
      action: paused ? 'AI_PAUSE' : 'AI_RESUME',
      targetType: 'AiSettings',
      targetId: companyId,
      metadata: { reason },
    });
    return this.getAiSettings(companyId);
  }

  async controlCenter(companyId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const [
      settings,
      operations,
      audits,
      workflows,
      decisions,
      failedOps,
      jobRuns,
      groqFails,
      pendingApprovals,
    ] = await Promise.all([
      this.getAiSettings(companyId),
      this.prisma.aiOperation.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.auditEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.workflowRun.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.ceoDecision.groupBy({
        by: ['status'],
        where: { companyId, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.aiOperation.count({
        where: { companyId, status: AiOperationStatus.FAILED, createdAt: { gte: since } },
      }),
      this.prisma.jobRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
      this.prisma.aiOperation.count({
        where: {
          companyId,
          status: AiOperationStatus.FAILED,
          type: { in: ['COMPLETION_EVAL', 'DIAGNOSE', 'COMMAND'] },
          createdAt: { gte: since },
        },
      }),
      this.prisma.ceoDecision.count({
        where: { companyId, status: { in: ['PROPOSED', 'PENDING_APPROVAL'] } },
      }),
    ]);

    const tokensUsed = operations.reduce((s, o) => s + (o.tokensUsed ?? 0), 0);

    return {
      settings,
      autonomyLabels: {
        OBSERVER: 'OBSERVE_ONLY',
        ADVISOR: 'ADVISORY',
        GUIDED_AUTONOMY: 'APPROVAL_REQUIRED',
        FULL_AUTONOMY: 'CONTROLLED_AUTONOMY',
      },
      operations,
      audits,
      workflowRuns: workflows,
      decisionCounts: decisions,
      failedOps,
      groqFails,
      jobRuns,
      pendingApprovals,
      tokensUsed,
      estimatedCostUsd: tokensUsed ? Number((tokensUsed / 1_000_000) * 0.2).toFixed(4) : null,
    };
  }

  async retryOperation(companyId: string, operationId: string, userId: string) {
    const op = await this.prisma.aiOperation.findFirst({ where: { id: operationId, companyId } });
    if (!op) throw new ForbiddenException('Operation not found');
    if (op.type === 'DELETE' || op.type === 'EXTERNAL') {
      throw new ForbiddenException('This operation cannot be retried automatically');
    }
    await this.prisma.aiOperation.update({
      where: { id: operationId },
      data: { status: AiOperationStatus.RETRYING },
    });
    await this.audit({
      companyId,
      actorUserId: userId,
      action: 'AI_OP_RETRY',
      targetType: 'AiOperation',
      targetId: operationId,
    });
    return { ok: true, note: 'Marked for retry. Safe operations only; no automatic replay of side effects.' };
  }
}
