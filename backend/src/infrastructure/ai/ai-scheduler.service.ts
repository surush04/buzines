import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEngineService } from './ai-engine.service';
import { DirectiveService } from '../../modules/directives/directive.service';
import { OpsService } from '../../modules/bos/ops.service';
import { WorkflowService } from '../../modules/bos/workflow.service';

@Injectable()
export class AiSchedulerService {
  private readonly logger = new Logger(AiSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private aiEngine: AiEngineService,
    private directiveService: DirectiveService,
    private ops: OpsService,
    private workflows: WorkflowService,
  ) {}

  @Cron('30 7 * * *')
  async handleDailyPlans() {
    this.logger.log('Running daily plan generation...');
    const companies = await this.prisma.company.findMany({
      select: { id: true, name: true },
    });

    for (const company of companies) {
      try {
        const settings = await this.ops.getAiSettings(company.id);
        if (settings.aiPaused) {
          await this.ops.recordJob('daily-plans', 'SKIPPED', 'AI paused', company.id);
          continue;
        }
        await this.aiEngine.generateDailyPlans(company.id);
        await this.ops.recordJob('daily-plans', 'SUCCESS', company.name, company.id);
      } catch (err) {
        this.logger.error(`Failed daily plans for ${company.name}`, err);
        await this.ops.recordJob('daily-plans', 'FAILED', String(err).slice(0, 200), company.id);
      }
    }
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleFollowUps() {
    this.logger.log('Running follow-up checks...');
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      try {
        await this.directiveService.followUpIncompleteTasks(company.id);
        await this.workflows.tickOverdue(company.id);
        await this.ops.recordJob('follow-up', 'SUCCESS', undefined, company.id);
      } catch (err) {
        await this.ops.recordJob('follow-up', 'FAILED', String(err).slice(0, 200), company.id);
      }
    }
  }

  @Cron('0 9 * * 1')
  async handleProactiveManagement() {
    const companies = await this.prisma.company.findMany({
      where: { onboardingDone: true },
      include: { aiSettings: true },
    });
    for (const company of companies) {
      if (company.aiSettings?.autonomyLevel !== 'FULL_AUTONOMY') continue;
      try {
        await this.directiveService.runProactiveManagement(company.id);
      } catch (err) {
        this.logger.error(`Proactive failed for ${company.name}`, err);
      }
    }
  }

  @Cron('0 */4 * * *')
  async handleAutoAnalysis() {
    this.logger.log('Running AI auto-analysis...');
    const companies = await this.prisma.company.findMany({
      where: { onboardingDone: true },
      select: { id: true, name: true },
    });
    for (const company of companies) {
      try {
        const result = await this.directiveService.autoAnalyzeAndAct(company.id);
        if (result.analyzed) {
          this.logger.log(`AI analyzed ${company.name}: ${result.summary ?? ''}`);
        }
      } catch (err) {
        this.logger.error(`Auto analysis failed for ${company.name}`, err);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async detectOverdueTasks() {
    const now = new Date();
    const overdue = await this.prisma.task.updateMany({
      where: {
        deadline: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      data: { status: 'OVERDUE' },
    });
    if (overdue.count > 0) {
      this.logger.warn(`Marked ${overdue.count} tasks as overdue`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateRecommendations() {
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      await this.aiEngine.generateRecommendations(company.id);
    }
  }
}
