import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DirectiveStatus,
  ProjectPriority,
  ProjectStatus,
  TaskCategory,
  TaskStatus,
  NotificationChannel,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../infrastructure/notifications/notification.service';
import { BusinessContextService } from '../../infrastructure/ai/business-context.service';
import { AiEngineService } from '../../infrastructure/ai/ai-engine.service';
import { LlmService } from '../../infrastructure/ai/llm.service';

interface ParsedTask {
  title: string;
  description?: string;
  category: TaskCategory;
  roleHint?: string;
  deadlineDays?: number;
}

@Injectable()
export class DirectiveService {
  private readonly logger = new Logger(DirectiveService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private configService: ConfigService,
    private businessContext: BusinessContextService,
    private aiEngine: AiEngineService,
    private llm: LlmService,
  ) {}

  /** Admin gives one order — AI creates tasks; Telegram optional */
  async createAndExecute(companyId: string, instruction: string, sendTelegram = true) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { onboardingDone: true, name: true },
    });
    if (!company?.onboardingDone) {
      throw new NotFoundException(
        'Аввал бизнесро дар onboarding тавсиф кунед — AI бояд бизнесро бидонад',
      );
    }

    const directive = await this.prisma.adminDirective.create({
      data: {
        companyId,
        instruction,
        status: DirectiveStatus.RECEIVED,
      },
    });

    try {
      await this.prisma.adminDirective.update({
        where: { id: directive.id },
        data: { status: DirectiveStatus.ANALYZING },
      });

      const { analysis, aiDegraded } = await this.analyzeInstruction(companyId, instruction);
      const { tasks, tasksDegraded } = await this.generateTasksFromInstruction(companyId, instruction);
      const aiWarning = aiDegraded || tasksDegraded
        ? 'AI дастрас нест — вазифаҳо бо режими оддӣ сохта шуданд.'
        : undefined;

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 14);

      const project = await this.prisma.project.create({
        data: {
          companyId,
          name: instruction.slice(0, 80),
          description: analysis,
          deadline,
          priority: ProjectPriority.HIGH,
          status: ProjectStatus.ACTIVE,
        },
      });

      const createdTasks = await this.persistAndAssignTasks(
        project.id,
        companyId,
        tasks,
      );

      let telegramSummary = {
        sent: 0,
        failed: 0,
        total: createdTasks.length,
        message: 'Вазифаҳо сохта шуд — барои ирсол «Ирсоли вазифа»-ро пахш кунед',
      };

      if (sendTelegram) {
        telegramSummary = await this.dispatchAllTasks(companyId, instruction, createdTasks);
      }

      await this.prisma.adminDirective.update({
        where: { id: directive.id },
        data: {
          status: sendTelegram ? DirectiveStatus.DISPATCHED : DirectiveStatus.IN_PROGRESS,
          aiAnalysis: analysis,
          projectId: project.id,
          tasksTotal: createdTasks.length,
          progress: 0,
        },
      });

      return { ...(await this.getDirective(directive.id)), telegramSummary, aiWarning };
    } catch (err) {
      this.logger.error('Directive execution failed', err);
      await this.prisma.adminDirective.update({
        where: { id: directive.id },
        data: { status: DirectiveStatus.FAILED },
      });
      if (this.llm.isQuotaError(err) && !this.llm.isAvailable()) {
        throw new ServiceUnavailableException(
          'AI дастрас нест. GROQ_API_KEY (console.groq.com) ё OpenAI billing илова кунед.',
        );
      }
      throw err;
    }
  }

  async listDirectives(companyId: string) {
    return this.prisma.adminDirective.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          include: {
            tasks: {
              include: {
                assignments: {
                  include: {
                    employee: {
                      select: { id: true, firstName: true, lastName: true, role: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getDirective(id: string) {
    const directive = await this.prisma.adminDirective.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            tasks: {
              include: {
                assignments: {
                  include: {
                    employee: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        telegramChatId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!directive) throw new NotFoundException('Directive not found');
    return directive;
  }

  /** Recalculate progress when tasks update */
  async refreshDirectiveProgress(projectId: string) {
    const directive = await this.prisma.adminDirective.findFirst({
      where: { projectId },
    });
    if (!directive) return;

    const tasks = await this.prisma.task.findMany({
      where: { projectId, parentTaskId: null },
    });
    const done = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const total = tasks.length || 1;
    const progress = Math.round((done / total) * 100);

    let status: DirectiveStatus = DirectiveStatus.IN_PROGRESS;
    if (progress >= 100) status = DirectiveStatus.COMPLETED;
    else if (progress > 0) status = DirectiveStatus.IN_PROGRESS;

    await this.prisma.adminDirective.update({
      where: { id: directive.id },
      data: { tasksDone: done, tasksTotal: total, progress, status },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { progress, status: progress >= 100 ? ProjectStatus.COMPLETED : ProjectStatus.ACTIVE },
    });
  }

  /** Follow-up: AI sends personalized messages for incomplete tasks */
  async followUpIncompleteTasks(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    const minHours = (settings?.followUpIntervalMin ?? 120) / 60;

    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        status: { in: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE, TaskStatus.BLOCKED] },
        employee: { companyId, status: 'ACTIVE' },
      },
      include: { employee: true, task: { include: { project: true } } },
    });

    let followedUp = 0;

    for (const a of assignments) {
      const hoursSince = (Date.now() - a.assignedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < minHours) continue;

      const message = await this.aiEngine.generateFollowUpMessage(
        companyId,
        a.employee.firstName,
        a.task,
        a.task.project.name,
        hoursSince,
      );

      await this.notifications.send(
        a.employeeId,
        NotificationType.REMINDER,
        'Task Follow-up',
        message,
        [NotificationChannel.IN_APP, NotificationChannel.TELEGRAM],
      );
      followedUp++;
    }

    return { followedUp, total: assignments.length };
  }

  /** Delete a single task (admin) */
  async deleteTask(taskId: string, companyId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { companyId } },
      select: { id: true, projectId: true, title: true },
    });
    if (!task) throw new NotFoundException('Вазифа ёфт нашуд');

    await this.deleteTasksByIds([taskId]);

    await this.refreshDirectiveProgress(task.projectId);

    return { deleted: true, taskId, title: task.title };
  }

  /** Delete admin directive with its project and tasks */
  async deleteDirective(directiveId: string, companyId: string) {
    const directive = await this.prisma.adminDirective.findFirst({
      where: { id: directiveId, companyId },
      select: { id: true, instruction: true, projectId: true },
    });
    if (!directive) throw new NotFoundException('Фармон ёфт нашуд');

    if (directive.projectId) {
      const projectId = directive.projectId;
      const tasks = await this.prisma.task.findMany({
        where: { projectId },
        select: { id: true },
      });
      await this.deleteTasksByIds(tasks.map((t) => t.id));
      await this.prisma.adminDirective.delete({ where: { id: directiveId } });
      await this.prisma.project.delete({ where: { id: projectId } });
    } else {
      await this.prisma.adminDirective.delete({ where: { id: directiveId } });
    }

    return { deleted: true, directiveId, instruction: directive.instruction };
  }

  private async deleteTasksByIds(taskIds: string[]) {
    if (!taskIds.length) return;

    await this.prisma.taskResponse.deleteMany({ where: { taskId: { in: taskIds } } });
    await this.prisma.taskAssignment.deleteMany({ where: { taskId: { in: taskIds } } });
    await this.prisma.dailyPlanTask.deleteMany({ where: { taskId: { in: taskIds } } });
    await this.prisma.taskDependency.deleteMany({
      where: {
        OR: [
          { taskId: { in: taskIds } },
          { dependsOnTaskId: { in: taskIds } },
        ],
      },
    });
    await this.prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  }

  /** Send existing task assignments via Telegram — does NOT create new tasks */
  async dispatchExistingTasks(companyId: string, directiveId?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { onboardingDone: true },
    });
    if (!company?.onboardingDone) {
      throw new NotFoundException('Аввал onboarding-ро анҷом диҳед');
    }

    let instruction = 'Вазифаи ҷорӣ';
    let projectId: string | undefined;

    if (directiveId) {
      const directive = await this.prisma.adminDirective.findFirst({
        where: { id: directiveId, companyId },
      });
      if (!directive?.projectId) {
        return { sent: 0, failed: 0, total: 0, message: 'Вазифа ёфт нашуд — аввал фармон диҳед' };
      }
      instruction = directive.instruction;
      projectId = directive.projectId;
    }

    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        employee: { companyId, status: 'ACTIVE' },
        ...(projectId ? { task: { projectId } } : { task: { project: { companyId } } }),
      },
      include: {
        employee: { select: { id: true, companyId: true, telegramUsername: true, firstName: true } },
        task: { select: { id: true, title: true } },
      },
    });

    if (!assignments.length) {
      return { sent: 0, failed: 0, total: 0, message: 'Вazifahoi фаъол нест' };
    }

    const taskList = assignments.map((a) => ({
      taskId: a.taskId,
      employeeId: a.employeeId,
      title: a.task.title,
    }));

    const summary = await this.dispatchAllTasks(companyId, instruction, taskList);

    if (directiveId && summary.sent > 0) {
      await this.prisma.adminDirective.update({
        where: { id: directiveId },
        data: { status: DirectiveStatus.DISPATCHED },
      });
    }

    return summary;
  }

  async runProactiveManagement(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { aiSettings: true },
    });
    if (!company?.onboardingDone) return { skipped: true, reason: 'Onboarding not complete' };
    if (company.aiSettings?.autonomyLevel !== 'FULL_AUTONOMY') {
      return { skipped: true, reason: 'Advisor mode' };
    }

    const incomplete = await this.businessContext.countIncompleteTasks(companyId);
    if (incomplete > 0) {
      return {
        skipped: true,
        reason: `${incomplete} incomplete tasks — follow-up only, no new tasks`,
      };
    }
    const [overdue, blocked, activeDirectives, employees] = await Promise.all([
      this.prisma.task.count({ where: { project: { companyId }, status: TaskStatus.OVERDUE } }),
      this.prisma.task.count({ where: { project: { companyId }, status: TaskStatus.BLOCKED } }),
      this.prisma.adminDirective.count({
        where: { companyId, status: { in: ['DISPATCHED', 'IN_PROGRESS'] } },
      }),
      this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
    ]);

    if (employees === 0) return { skipped: true, reason: 'No employees' };

    const instruction = await this.generateProactiveInstruction(companyId, {
      overdue,
      blocked,
      activeDirectives,
    });
    if (!instruction) return { skipped: true, reason: 'Nothing to do now' };

    this.logger.log(`AI proactive: ${instruction}`);
    const result = await this.createAndExecute(companyId, `[AI автоматӣ] ${instruction}`);
    return { proactive: true, instruction, directive: result };
  }

  /** AI watches full app state and decides: new tasks, follow-up, or wait */
  async autoAnalyzeAndAct(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.onboardingDone) return { skipped: true, reason: 'Onboarding not complete' };
    if (!this.llm.isAvailable()) return { skipped: true, reason: 'AI not configured' };

    const incompleteTasks = await this.businessContext.countIncompleteTasks(companyId);
    if (incompleteTasks > 0) {
      const followUp = await this.followUpIncompleteTasks(companyId);
      const lang = await this.businessContext.getCompanyLanguage(companyId);
      const summary =
        lang === 'ru'
          ? `Незавершённых задач: ${incompleteTasks}. Отправлен follow-up по текущим задачам (новые задачи не создаются).`
          : lang === 'en'
            ? `${incompleteTasks} incomplete tasks. Follow-up sent (no new tasks created).`
            : `${incompleteTasks} вazifai нотамом. Follow-up фиристода шуд.`;
      return { analyzed: true, summary, followUp, followUpOnly: true };
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);

    try {
      const res = await this.llm.chat(
        {
          messages: [
            {
              role: 'system',
              content:
                systemPrefix +
                `Analyze the full business state. Create new tasks ONLY when there are zero incomplete tasks.
JSON: { "needsNewTasks": bool, "instruction": string|null, "summary": string, "followUpOnly": bool }`,
            },
            { role: 'user', content: await this.analysisUserPrompt(companyId) },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 350,
        },
        true,
      );

      const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as {
        needsNewTasks?: boolean;
        instruction?: string | null;
        summary?: string;
        followUpOnly?: boolean;
      };

      if (parsed.followUpOnly) {
        const followUp = await this.followUpIncompleteTasks(companyId);
        return { analyzed: true, summary: parsed.summary, followUp };
      }

      if (parsed.needsNewTasks && parsed.instruction?.trim()) {
        const directive = await this.createAndExecute(
          companyId,
          `[AI Manager] ${parsed.instruction.trim()}`,
          false,
        );
        return { analyzed: true, summary: parsed.summary, directive };
      }

      return { analyzed: true, summary: parsed.summary ?? 'Ҳама чиз назар under control' };
    } catch (err) {
      this.logger.warn('Auto analyze failed', err);
      return { skipped: true, reason: 'Analysis failed' };
    }
  }

  private async analysisUserPrompt(companyId: string): Promise<string> {
    const lang = await this.businessContext.getCompanyLanguage(companyId);
    const prompts: Record<'tg' | 'ru' | 'en', string> = {
      ru: 'Проанализируйте текущее состояние бизнеса и решите, нужны ли новые задачи или follow-up.',
      en: 'Analyze the current business state and decide if new tasks or follow-up are needed.',
      tg: 'Ҳолати ҷoriroи бизнесро таҳлил кунед ва qaror гиред.',
    };
    return prompts[lang];
  }

  private async generateProactiveInstruction(
    companyId: string,
    stats: { overdue: number; blocked: number; activeDirectives: number },
  ): Promise<string | null> {
    const lang = await this.businessContext.getCompanyLanguage(companyId);
    if (stats.blocked > 0) {
      return lang === 'ru'
        ? `Устраните блокировки — ${stats.blocked} задач заблокировано.`
        : lang === 'en'
          ? `Resolve blockers — ${stats.blocked} tasks blocked.`
          : `Монеаҳо ҳал кунед — ${stats.blocked} вазифа блок шудааст.`;
    }
    if (stats.overdue > 0) {
      return lang === 'ru'
        ? `Follow-up по ${stats.overdue} просроченным задачам.`
        : lang === 'en'
          ? `Follow up on ${stats.overdue} overdue tasks.`
          : `Follow-up барои ${stats.overdue} вазифаи дершуда.`;
    }
    if (stats.activeDirectives > 0) return null;

    if (!this.llm.isAvailable()) {
      return lang === 'ru'
        ? 'Составьте недельный план улучшения бизнеса.'
        : lang === 'en'
          ? 'Create a weekly plan to improve the business.'
          : 'Нaqшаи ҳафтаина барои беhtar кардани бизнес созед.';
    }

    try {
      const res = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content:
              `${await this.businessContext.getSystemPromptPrefix(companyId)}` +
              'Suggest ONE short weekly order for this business in the company language. JSON: { "instruction": "..." | null }',
          },
          {
            role: 'user',
            content: `overdue=${stats.overdue}, blocked=${stats.blocked}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 150,
      }, true);

      const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as {
        instruction?: string | null;
      };
      return parsed.instruction ?? null;
    } catch {
      return null;
    }
  }

  private async analyzeInstruction(
    companyId: string,
    instruction: string,
  ): Promise<{ analysis: string; aiDegraded: boolean }> {
    const fallback = `AI фармонро таҳлил кард: «${instruction}». Мувофиқи бизнеси шумо вазифаҳо тақсим мешаванд.`;

    if (!this.llm.isAvailable()) {
      return { analysis: fallback, aiDegraded: true };
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);

    try {
      const res = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content:
              systemPrefix +
              'Analyze the owner order briefly (2-3 sentences) in Tajik. Goal and which team should act?',
          },
          { role: 'user', content: instruction },
        ],
        max_tokens: 200,
      }, true);

      return {
        analysis: res.choices[0]?.message?.content ?? `Фармон: ${instruction}`,
        aiDegraded: false,
      };
    } catch (err) {
      this.logger.warn('LLM analysis failed — using fallback', err);
      return { analysis: fallback, aiDegraded: true };
    }
  }

  private async generateTasksFromInstruction(
    companyId: string,
    instruction: string,
  ): Promise<{ tasks: ParsedTask[]; tasksDegraded: boolean }> {
    if (!this.llm.isAvailable()) {
      return { tasks: await this.fallbackBusinessTasks(companyId, instruction), tasksDegraded: true };
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);

    try {
      const res = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content:
              systemPrefix +
              `Break order into 3-6 tasks for THIS business. Each task needs a realistic deadline in days.
JSON: { "tasks": [{ "title", "description", "category": "FRONTEND|BACKEND|DESIGN|DATABASE|DEVOPS|TESTING|DOCUMENTATION|OTHER", "roleHint", "deadlineDays": 1-14 }] }`,
          },
          { role: 'user', content: instruction },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as {
        tasks?: ParsedTask[];
      };
      const rawTasks = parsed.tasks?.length
        ? parsed.tasks
        : await this.fallbackBusinessTasks(companyId, instruction);
      const tasks = rawTasks.map((t) => ({
        ...t,
        category: this.normalizeCategory(t.category as string),
      }));
      return { tasks, tasksDegraded: !parsed.tasks?.length };
    } catch (err) {
      this.logger.warn('LLM task generation failed — using fallback', err);
      return { tasks: await this.fallbackBusinessTasks(companyId, instruction), tasksDegraded: true };
    }
  }

  private async fallbackBusinessTasks(
    companyId: string,
    instruction: string,
  ): Promise<ParsedTask[]> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { industry: true, businessType: true },
    });
    const lower = instruction.toLowerCase();
    const isSales =
      lower.includes('фуруш') ||
      lower.includes('sales') ||
      company?.industry?.toLowerCase().includes('фуруш') ||
      company?.businessType === 'retail';

    if (isSales) {
      return [
        { title: 'Тahlili фуруши ҷорӣ', description: '30 рӯз', category: TaskCategory.OTHER, roleHint: 'Sales' },
        { title: '10 муштариро занг занед', description: 'Занги фурӯш', category: TaskCategory.OTHER, roleHint: 'Sales' },
        { title: 'Пешниҳоди нав', description: 'Тabлиғот', category: TaskCategory.OTHER, roleHint: 'Marketing' },
      ];
    }

    return [
      { title: `Нaqша: ${instruction}`, description: 'Нaqшаи амал', category: TaskCategory.OTHER, roleHint: 'Manager' },
      { title: 'Иҷро — марҳилаи 1', description: 'Қadamҳои аввал', category: TaskCategory.OTHER, roleHint: 'Team' },
      { title: 'Guzorish', description: 'Пешрафт', category: TaskCategory.OTHER, roleHint: 'Manager' },
    ];
  }

  private normalizeCategory(value?: string | TaskCategory): TaskCategory {
    if (!value) return TaskCategory.OTHER;

    const upper = String(value).toUpperCase().trim();
    const valid = Object.values(TaskCategory) as string[];
    if (valid.includes(upper)) return upper as TaskCategory;

    const lower = String(value).toLowerCase();
    const hints: Array<[string, TaskCategory]> = [
      ['frontend', TaskCategory.FRONTEND],
      ['front', TaskCategory.FRONTEND],
      ['backend', TaskCategory.BACKEND],
      ['back', TaskCategory.BACKEND],
      ['design', TaskCategory.DESIGN],
      ['ui', TaskCategory.DESIGN],
      ['ux', TaskCategory.DESIGN],
      ['database', TaskCategory.DATABASE],
      ['devops', TaskCategory.DEVOPS],
      ['testing', TaskCategory.TESTING],
      ['test', TaskCategory.TESTING],
      ['documentation', TaskCategory.DOCUMENTATION],
      ['marketing', TaskCategory.OTHER],
      ['маркетинг', TaskCategory.OTHER],
      ['sales', TaskCategory.OTHER],
      ['фуруш', TaskCategory.OTHER],
      ['manager', TaskCategory.OTHER],
      ['менеджер', TaskCategory.OTHER],
    ];

    for (const [hint, category] of hints) {
      if (lower.includes(hint)) return category;
    }

    return TaskCategory.OTHER;
  }

  private async persistAndAssignTasks(
    projectId: string,
    companyId: string,
    tasks: ParsedTask[],
  ) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { skills: true, aiProfile: true },
    });

    const created: Array<{ taskId: string; employeeId: string; title: string; deadline?: Date }> = [];
    const assignCount = new Map<string, number>();

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const deadlineDays = Math.min(14, Math.max(1, t.deadlineDays ?? 3 + i));
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + deadlineDays);
      deadline.setHours(18, 0, 0, 0);

      const task = await this.prisma.task.create({
        data: {
          projectId,
          title: t.title,
          description: t.description,
          category: this.normalizeCategory(t.category as string),
          status: TaskStatus.PENDING,
          aiGenerated: true,
          sortOrder: i,
          priority: ProjectPriority.HIGH,
          deadline,
          estimatedHours: deadlineDays * 4,
        },
      });

      const employee = this.pickEmployee(t.roleHint ?? '', employees, i, assignCount);
      if (employee) {
        assignCount.set(employee.id, (assignCount.get(employee.id) ?? 0) + 1);
        await this.prisma.taskAssignment.create({
          data: { taskId: task.id, employeeId: employee.id, assignedBy: 'AI' },
        });
        await this.prisma.task.update({
          where: { id: task.id },
          data: { status: TaskStatus.ASSIGNED },
        });
        created.push({ taskId: task.id, employeeId: employee.id, title: t.title, deadline });
      }
    }

    return created;
  }

  private pickEmployee(
    roleHint: string,
    employees: Array<{ id: string; role: string; firstName: string; skills: { name: string }[] }>,
    index: number,
    assignCount = new Map<string, number>(),
  ) {
    if (!employees.length) return null;
    if (employees.length === 1) return employees[0];

    const hint = roleHint.toLowerCase();
    const synonyms = this.roleSynonyms(hint);

    const roleMatches = employees.filter((e) => {
      const role = e.role.toLowerCase();
      const skills = e.skills.map((s) => s.name.toLowerCase()).join(' ');
      return synonyms.some((s) => role.includes(s) || skills.includes(s));
    });

    const pool = roleMatches.length ? roleMatches : employees;
    return [...pool].sort(
      (a, b) => (assignCount.get(a.id) ?? 0) - (assignCount.get(b.id) ?? 0),
    )[0] ?? employees[index % employees.length];
  }

  private roleSynonyms(hint: string): string[] {
    const map: Record<string, string[]> = {
      sales: ['sales', 'фуруш', 'furush', 'сavdo', 'savdo', 'фurūsh'],
      marketing: ['marketing', 'маркетинг', 'market', 'таbligh', 'tabligh', 'reklama'],
      manager: ['manager', 'менеджер', 'мененчер', 'menejer', 'rahbar', 'роҳbar'],
      team: ['team', 'dasta', 'даsta', 'коргар', 'employee'],
    };

    for (const [key, words] of Object.entries(map)) {
      if (words.some((w) => hint.includes(w)) || hint.includes(key)) {
        return words;
      }
    }

    return [hint, ...hint.split(' ').filter((w) => w.length > 2)];
  }

  private async dispatchAllTasks(
    companyId: string,
    instruction: string,
    tasks: Array<{ taskId: string; employeeId: string; title: string; deadline?: Date }>,
  ) {
    const taskIds = tasks.map((t) => t.taskId);
    const taskDetails = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, deadline: true, description: true },
    });
    const detailMap = new Map(taskDetails.map((t) => [t.id, t]));

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: tasks.map((t) => t.employeeId) } },
      select: { id: true, companyId: true, telegramUsername: true, firstName: true },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    let sent = 0;
    let failed = 0;
    let reason: string | undefined;
    const recipients: Array<{
      username: string;
      name: string;
      sent: boolean;
      reason?: string;
    }> = [];

    for (const t of tasks) {
      const info = detailMap.get(t.taskId);
      const deadline = t.deadline ?? info?.deadline;
      const deadlineStr = deadline
        ? deadline.toLocaleDateString('tg-TJ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
        : 'муайян мешавад';
      const employee = employeeMap.get(t.employeeId);
      const name = employee?.firstName ?? 'Коргар';

      const message =
        `${name}, салом!\n\n` +
        `Фармони админ: ${instruction}\n\n` +
        `Вазифаи шумо: ${t.title}\n` +
        (info?.description ? `Тавсиф: ${info.description}\n` : '') +
        `Мӯҳлати иҷро: ${deadlineStr}\n\n` +
        `Лутфан ҷavоб диҳед — чӣ кардаед, натиҷа чӣ шуд.`;

      await this.notifications.send(
        t.employeeId,
        NotificationType.TASK_ASSIGNMENT,
        'New Task Assignment',
        message,
        [NotificationChannel.IN_APP],
      );

      if (employee) {
        const result = await this.notifications.sendTelegramToEmployee(employee, message);
        recipients.push({
          username: employee.telegramUsername ?? '?',
          name: employee.firstName,
          sent: result.sent,
          reason: result.reason,
        });
        if (result.sent) sent++;
        else {
          failed++;
          reason = reason ?? result.reason;
        }
      }
    }

    const uniqueFailed = [...new Map(
      recipients.filter((r) => !r.sent).map((r) => [r.username, r]),
    ).values()];

    let detailMessage = sent > 0 ? `${sent} паём фиристода шуд` : this.notifications.telegramReasonMessage(reason);
    if (uniqueFailed.length) {
      detailMessage +=
        '. Нафиристода: ' +
        uniqueFailed
          .map((r) => `@${r.username} (${this.notifications.telegramReasonMessage(r.reason)})`)
          .join('; ');
    }

    return {
      sent,
      failed,
      total: tasks.length,
      recipients,
      message: detailMessage,
    };
  }
}
