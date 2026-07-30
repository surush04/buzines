import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessContextService, type AiLang } from './business-context.service';
import { LlmService } from './llm.service';
import {
  TaskCategory,
  TaskStatus,
  ProjectStatus,
  TaskResponseType,
  NotificationType,
  NotificationChannel,
} from '@prisma/client';

interface GeneratedTask {
  title: string;
  description?: string;
  category: TaskCategory;
  estimatedHours?: number;
  subtasks?: GeneratedTask[];
}

interface EmployeeContext {
  id: string;
  firstName: string;
  role: string;
  experienceLevel?: string;
  aiProfile?: {
    avgCompletionTimeMin?: number | null;
    taskCompletionRate?: number | null;
    peakProductivityHours?: unknown;
    productivityScore?: number;
  } | null;
}

interface SmartEvaluation {
  responseType: TaskResponseType;
  isComplete: boolean;
  progressPct: number;
  aiAnalysis: string;
  reply: string;
}

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private businessContext: BusinessContextService,
    private llm: LlmService,
  ) {}

  async breakProjectIntoTasks(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { company: { include: { employees: { include: { skills: true } } } } },
    });
    if (!project) return;

    const tasks = await this.generateTasksFromProject(project);
    await this.persistTasks(projectId, tasks);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ACTIVE },
    });

    await this.assignTasksToEmployees(projectId, project.companyId);
    this.logger.log(`Project ${projectId}: generated ${tasks.length} task groups`);
  }

  async generateDailyPlans(companyId: string): Promise<void> {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        skills: true,
        aiProfile: true,
        taskAssignments: {
          where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
          include: { task: true },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const employee of employees) {
      const pendingTasks = employee.taskAssignments
        .map((a) => a.task)
        .filter((t) => t.status !== TaskStatus.COMPLETED);

      if (!pendingTasks.length) continue;

      const planMessage = await this.generatePlanMessage(companyId, employee, pendingTasks);

      const plan = await this.prisma.dailyPlan.upsert({
        where: {
          employeeId_planDate: { employeeId: employee.id, planDate: today },
        },
        create: {
          employeeId: employee.id,
          planDate: today,
          message: planMessage,
          tasks: {
            create: pendingTasks.slice(0, 5).map((task, i) => ({
              taskId: task.id,
              sortOrder: i,
              deadline: task.deadline,
            })),
          },
        },
        update: { message: planMessage },
      });

      await this.sendDailyPlanNotification(employee.id, planMessage);
      this.logger.log(`Daily plan created for ${employee.firstName} ${employee.lastName}`);
    }
  }

  async processEmployeeResponse(
    employeeId: string,
    taskId: string,
    message?: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { companyId: true, name: true } },
        responses: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { message: true, responseType: true, createdAt: true },
        },
      },
    });
    if (!task) {
      const lang = await this.businessContext.getAiLanguage(
        (await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } }))
          ?.companyId ?? '',
      );
      return {
        aiAnalysis: '',
        newStatus: undefined,
        reply: lang === 'en' ? 'Task not found.' : 'Задача не найдена.',
      };
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true },
    });

    const evaluation = await this.evaluateEmployeeMessage(
      task.project.companyId,
      employee?.firstName ?? 'Коргар',
      task,
      message ?? '',
    );

    await this.prisma.taskResponse.create({
      data: {
        employeeId,
        taskId,
        responseType: evaluation.responseType,
        message,
        progressPct: evaluation.progressPct,
        aiAnalysis: evaluation.aiAnalysis,
      },
    });

    const statusMap: Partial<Record<TaskResponseType, TaskStatus>> = {
      [TaskResponseType.ACCEPTED]: TaskStatus.ACCEPTED,
      [TaskResponseType.STARTED]: TaskStatus.IN_PROGRESS,
      [TaskResponseType.COMPLETED]: TaskStatus.COMPLETED,
      [TaskResponseType.BLOCKED]: TaskStatus.BLOCKED,
      [TaskResponseType.RUNNING_LATE]: TaskStatus.IN_PROGRESS,
    };

    let newStatus: TaskStatus | undefined;
    if (evaluation.isComplete) {
      newStatus = TaskStatus.COMPLETED;
    } else if (evaluation.responseType === TaskResponseType.BLOCKED) {
      newStatus = TaskStatus.BLOCKED;
    } else if (
      evaluation.responseType === TaskResponseType.STARTED ||
      evaluation.responseType === TaskResponseType.RUNNING_LATE
    ) {
      newStatus = TaskStatus.IN_PROGRESS;
    } else if (statusMap[evaluation.responseType]) {
      newStatus = statusMap[evaluation.responseType];
    }

    if (newStatus) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: newStatus,
          completedAt: newStatus === TaskStatus.COMPLETED ? new Date() : undefined,
        },
      });

      await this.prisma.taskAssignment.updateMany({
        where: { taskId, employeeId },
        data: {
          status: newStatus,
          completedAt: newStatus === TaskStatus.COMPLETED ? new Date() : undefined,
        },
      });
    }

    if (evaluation.responseType === TaskResponseType.BLOCKED && message) {
      await this.handleBlocker(employeeId, taskId, message);
    }

    if (evaluation.isComplete) {
      await this.updateEmployeeAiProfile(employeeId);
    }

    await this.refreshDirectiveProgressForTask(taskId);

    const reply = evaluation.reply;

    if (message) {
      await this.prisma.message.create({
        data: {
          employeeId,
          direction: 'INBOUND',
          channel: NotificationChannel.TELEGRAM,
          content: message,
          isFromAi: false,
        },
      });
    }
    await this.prisma.message.create({
      data: {
        employeeId,
        direction: 'OUTBOUND',
        channel: NotificationChannel.TELEGRAM,
        content: reply,
        isFromAi: true,
      },
    });

    return { aiAnalysis: evaluation.aiAnalysis, newStatus, reply };
  }

  private async refreshDirectiveProgressForTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) return;

    const directive = await this.prisma.adminDirective.findFirst({
      where: { projectId: task.projectId },
    });
    if (!directive) return;

    const tasks = await this.prisma.task.findMany({
      where: { projectId: task.projectId, parentTaskId: null },
    });
    const done = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const total = tasks.length || 1;
    const progress = Math.round((done / total) * 100);

    await this.prisma.adminDirective.update({
      where: { id: directive.id },
      data: {
        tasksDone: done,
        tasksTotal: total,
        progress,
        status: progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : directive.status,
      },
    });
  }

  async analyzeEmployeeChat(employeeId: string, message: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        skills: true,
        aiProfile: true,
        taskAssignments: {
          where: { status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
          include: { task: { include: { project: true } } },
          take: 1,
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!employee) {
      return 'Сотрудник не найден.';
    }

    const lang = await this.businessContext.getAiLanguage(employee.companyId);
    const activeTask = employee.taskAssignments[0]?.task;

    if (!activeTask) {
      const reply = this.businessContext.shortReply(lang, 'noTask');
      await this.saveChatMessages(employeeId, message, reply);
      return reply;
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(employee.companyId);
    const context = {
      ...this.buildEmployeeContext(employee),
      activeTask: {
        title: activeTask.title,
        description: activeTask.description,
        status: activeTask.status,
        deadline: activeTask.deadline,
        project: activeTask.project?.name,
      },
    };

    if (!this.llm.isAvailable()) {
      const reply = this.businessContext.shortReply(lang, 'ack');
      await this.saveChatMessages(employeeId, message, reply);
      return reply;
    }

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content:
            systemPrefix +
            this.businessContext.getChatReplyRules(lang) +
            `\nContext: ${JSON.stringify(context)}`,
        },
        { role: 'user', content: message },
      ],
      max_tokens: 350,
    });

    let reply =
      response.choices[0]?.message?.content?.trim() ??
      this.businessContext.shortReply(lang, 'ack');
    reply = await this.enforceLanguage(employee.companyId, lang, reply, context);

    await this.saveChatMessages(employeeId, message, reply);
    return reply;
  }

  private async saveChatMessages(employeeId: string, inbound: string, outbound: string) {
    await this.prisma.message.create({
      data: {
        employeeId,
        direction: 'INBOUND',
        channel: NotificationChannel.TELEGRAM,
        content: inbound,
        isFromAi: false,
      },
    });
    await this.prisma.message.create({
      data: {
        employeeId,
        direction: 'OUTBOUND',
        channel: NotificationChannel.TELEGRAM,
        content: outbound,
        isFromAi: true,
      },
    });
  }

  /** Personalized follow-up for incomplete tasks */
  async generateFollowUpMessage(
    companyId: string,
    employeeName: string,
    task: { title: string; description: string | null; deadline: Date | null; status: TaskStatus },
    projectName: string,
    hoursSinceAssigned: number,
  ): Promise<string> {
    const lang = await this.businessContext.getAiLanguage(companyId);
    const locale = this.businessContext.localeForLang(lang);
    const noDeadline = this.businessContext.deadlineNotSetLabel(lang);
    const deadlineStr = task.deadline
      ? task.deadline.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : noDeadline;

    if (!this.llm.isAvailable()) {
      return this.businessContext.shortReply(lang, 'followUpFallback');
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);
    const res = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: systemPrefix + this.businessContext.getFollowUpRules(lang),
        },
        {
          role: 'user',
          content: JSON.stringify({
            employeeName,
            taskTitle: task.title,
            taskDescription: task.description,
            deadline: deadlineStr,
            projectName,
            status: task.status,
            hoursSinceAssigned: Math.round(hoursSinceAssigned),
          }),
        },
      ],
      max_tokens: 250,
    }, true);

    let reply = res.choices[0]?.message?.content?.trim() ?? '';
    if (!reply) {
      reply = this.businessContext.shortReply(lang, 'followUpFallback');
    }
    return this.enforceLanguageSync(lang, reply);
  }

  async generateRecommendations(companyId: string) {
    const [
      overdueTasks,
      blockedTasks,
      employees,
      projects,
    ] = await Promise.all([
      this.prisma.task.count({
        where: {
          project: { companyId },
          status: TaskStatus.OVERDUE,
        },
      }),
      this.prisma.task.count({
        where: {
          project: { companyId },
          status: TaskStatus.BLOCKED,
        },
      }),
      this.prisma.employee.findMany({
        where: { companyId, status: 'ACTIVE' },
        include: { aiProfile: true, taskAssignments: true },
      }),
      this.prisma.project.findMany({
        where: { companyId, status: ProjectStatus.ACTIVE },
      }),
    ]);

    const recommendations: Array<{ type: string; title: string; description: string; impact: string }> = [];

    if (overdueTasks > 0) {
      recommendations.push({
        type: 'DEADLINE',
        title: `${overdueTasks} overdue tasks detected`,
        description: 'Review task assignments and consider deadline extensions or resource reallocation.',
        impact: 'HIGH',
      });
    }

    if (blockedTasks > 0) {
      recommendations.push({
        type: 'BLOCKER',
        title: `${blockedTasks} tasks are blocked`,
        description: 'Cross-team dependencies may be causing delays. Consider a sync meeting.',
        impact: 'HIGH',
      });
    }

    const overloaded = employees.filter(
      (e) => e.taskAssignments.filter((a) => a.status !== TaskStatus.COMPLETED).length > 5,
    );
    if (overloaded.length) {
      recommendations.push({
        type: 'WORKLOAD',
        title: `${overloaded.length} employees may be overloaded`,
        description: `Consider redistributing tasks from: ${overloaded.map((e) => e.firstName).join(', ')}`,
        impact: 'MEDIUM',
      });
    }

    const atRiskProjects = projects.filter((p) => p.healthScore < 70);
    if (atRiskProjects.length) {
      recommendations.push({
        type: 'PROJECT',
        title: `${atRiskProjects.length} projects at risk`,
        description: `Projects needing attention: ${atRiskProjects.map((p) => p.name).join(', ')}`,
        impact: 'HIGH',
      });
    }

    for (const rec of recommendations) {
      await this.prisma.aiRecommendation.create({
        data: { companyId, ...rec },
      });
    }

    return recommendations;
  }

  /** Full business analysis in company language (ru/tg/en) */
  async analyzeBusiness(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { onboardingDone: true, name: true },
    });
    if (!company?.onboardingDone) {
      return { skipped: true, reason: 'Complete onboarding first' };
    }
    if (!this.llm.isAvailable()) {
      return { skipped: true, reason: 'AI not configured' };
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);
    const lang = await this.businessContext.getAiLanguage(companyId);

    const userPrompts: Record<AiLang, string> = {
      ru: 'Проведите полный анализ бизнеса: текущее состояние, сильные и слабые стороны, риски, возможности и конкретные действия.',
      en: 'Perform a full business analysis: current state, strengths, weaknesses, risks, opportunities, and concrete actions.',
    };

    try {
      const res = await this.llm.chat(
        {
          messages: [
            {
              role: 'system',
              content:
                systemPrefix +
                `Дайте глубокий анализ бизнеса на основе всех данных выше.
JSON: {
  "summary": "краткое резюме (2-3 предложения)",
  "fullAnalysis": "развёрнутый анализ (5-10 предложений)",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "risks": ["..."],
  "opportunities": ["..."],
  "recommendedActions": ["конкретные шаги для команды"]
}`,
            },
            { role: 'user', content: userPrompts[lang] },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1200,
        },
        true,
      );

      const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as {
        summary?: string;
        fullAnalysis?: string;
        strengths?: string[];
        weaknesses?: string[];
        risks?: string[];
        opportunities?: string[];
        recommendedActions?: string[];
      };

      return {
        analyzed: true,
        language: lang,
        summary: parsed.summary ?? '',
        fullAnalysis: parsed.fullAnalysis ?? '',
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        risks: parsed.risks ?? [],
        opportunities: parsed.opportunities ?? [],
        recommendedActions: parsed.recommendedActions ?? [],
      };
    } catch (err) {
      this.logger.warn('Business analysis failed', err);
      return { skipped: true, reason: 'Analysis failed' };
    }
  }

  private async generateTasksFromProject(project: {
    name: string;
    description: string | null;
    deadline: Date;
  }): Promise<GeneratedTask[]> {
    if (!this.llm.isAvailable()) {
      return this.fallbackTaskBreakdown(project.name);
    }

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: `You are a project manager AI. Break projects into tasks.
Return JSON array with objects: { title, description, category, estimatedHours, subtasks? }
Categories: FRONTEND, BACKEND, DESIGN, DATABASE, DEVOPS, TESTING, DOCUMENTATION, OTHER`,
        },
        {
          role: 'user',
          content: `Project: ${project.name}\nDescription: ${project.description ?? 'N/A'}\nDeadline: ${project.deadline.toISOString()}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    try {
      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as { tasks?: GeneratedTask[] };
      return parsed.tasks ?? this.fallbackTaskBreakdown(project.name);
    } catch {
      return this.fallbackTaskBreakdown(project.name);
    }
  }

  private fallbackTaskBreakdown(projectName: string): GeneratedTask[] {
    return [
      {
        title: `${projectName} — Planning & Requirements`,
        category: TaskCategory.DOCUMENTATION,
        estimatedHours: 8,
        subtasks: [
          { title: 'Requirements gathering', category: TaskCategory.DOCUMENTATION, estimatedHours: 4 },
          { title: 'Technical specification', category: TaskCategory.DOCUMENTATION, estimatedHours: 4 },
        ],
      },
      {
        title: `${projectName} — Frontend Development`,
        category: TaskCategory.FRONTEND,
        estimatedHours: 40,
        subtasks: [
          { title: 'Login page', category: TaskCategory.FRONTEND, estimatedHours: 8 },
          { title: 'Dashboard', category: TaskCategory.FRONTEND, estimatedHours: 16 },
          { title: 'Reports UI', category: TaskCategory.FRONTEND, estimatedHours: 8 },
        ],
      },
      {
        title: `${projectName} — Backend Development`,
        category: TaskCategory.BACKEND,
        estimatedHours: 40,
        subtasks: [
          { title: 'Authentication API', category: TaskCategory.BACKEND, estimatedHours: 8 },
          { title: 'JWT implementation', category: TaskCategory.BACKEND, estimatedHours: 4 },
          { title: 'Reports API', category: TaskCategory.BACKEND, estimatedHours: 12 },
        ],
      },
      {
        title: `${projectName} — Design`,
        category: TaskCategory.DESIGN,
        estimatedHours: 24,
        subtasks: [
          { title: 'UI Login design', category: TaskCategory.DESIGN, estimatedHours: 4 },
          { title: 'UI Dashboard design', category: TaskCategory.DESIGN, estimatedHours: 8 },
          { title: 'Icons & responsive design', category: TaskCategory.DESIGN, estimatedHours: 8 },
        ],
      },
    ];
  }

  private async persistTasks(
    projectId: string,
    tasks: GeneratedTask[],
    parentId?: string,
  ): Promise<void> {
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const created = await this.prisma.task.create({
        data: {
          projectId,
          parentTaskId: parentId,
          title: t.title,
          description: t.description,
          category: t.category,
          estimatedHours: t.estimatedHours,
          aiGenerated: true,
          sortOrder: i,
          status: TaskStatus.PENDING,
        },
      });
      if (t.subtasks?.length) {
        await this.persistTasks(projectId, t.subtasks, created.id);
      }
    }
  }

  private async assignTasksToEmployees(projectId: string, companyId: string) {
    const [tasks, employees] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId, parentTaskId: null },
      }),
      this.prisma.employee.findMany({
        where: { companyId, status: 'ACTIVE' },
        include: { skills: true, aiProfile: true },
      }),
    ]);

    for (const task of tasks) {
      const assignee = this.findBestAssignee(task.category, employees);
      if (!assignee) continue;

      await this.prisma.taskAssignment.create({
        data: { taskId: task.id, employeeId: assignee.id, assignedBy: 'AI' },
      });
      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.ASSIGNED },
      });
    }
  }

  private findBestAssignee(
    category: TaskCategory,
    employees: Array<EmployeeContext & { skills: { name: string }[] }>,
  ) {
    const categorySkillMap: Partial<Record<TaskCategory, string[]>> = {
      [TaskCategory.FRONTEND]: ['angular', 'react', 'vue', 'typescript', 'html', 'css'],
      [TaskCategory.BACKEND]: ['node', 'nestjs', 'python', 'java', 'api', 'rest'],
      [TaskCategory.DESIGN]: ['figma', 'ui', 'ux', 'design'],
      [TaskCategory.DATABASE]: ['sql', 'postgresql', 'mongodb', 'database'],
      [TaskCategory.DEVOPS]: ['docker', 'kubernetes', 'aws', 'ci/cd'],
    };

    const relevantSkills = categorySkillMap[category] ?? [];
    let bestMatch: (typeof employees)[0] | null = null;
    let bestScore = -1;

    for (const emp of employees) {
      const skillNames = emp.skills.map((s) => s.name.toLowerCase());
      const matchCount = relevantSkills.filter((s) =>
        skillNames.some((sn) => sn.includes(s)),
      ).length;
      const productivityBonus = (emp.aiProfile?.productivityScore ?? 50) / 100;
      const score = matchCount * 2 + productivityBonus;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = emp;
      }
    }

    return bestMatch ?? employees[0] ?? null;
  }

  private async generatePlanMessage(
    companyId: string,
    employee: { firstName: string; lastName: string },
    tasks: Array<{ title: string; deadline: Date | null }>,
  ): Promise<string> {
    const lang = await this.businessContext.getAiLanguage(companyId);
    const locale = this.businessContext.localeForLang(lang);
    const noDeadline = lang === 'en' ? 'no deadline' : 'без срока';

    const taskList = tasks
      .slice(0, 5)
      .map((t, i) => {
        const dl = t.deadline
          ? t.deadline.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
          : noDeadline;
        return `${i + 1}. ${t.title} (${dl})`;
      })
      .join('\n');

    if (!this.llm.isAvailable()) {
      return lang === 'en'
        ? `${employee.firstName}, hello!\n\nToday's tasks:\n${taskList}`
        : `${employee.firstName}, здравствуйте!\n\nЗадачи на сегодня:\n${taskList}`;
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);
    const res = await this.llm.chat(
      {
        messages: [
          {
            role: 'system',
            content:
              systemPrefix +
              (lang === 'en'
                ? 'Write a daily plan for the employee — natural, short, no bot templates. Plain text only.'
                : 'Напишите план на день для сотрудника — естественно, коротко, без шаблонов бота. Только русский текст.'),
          },
          {
            role: 'user',
            content: JSON.stringify({ employee: employee.firstName, tasks: taskList }),
          },
        ],
        max_tokens: 250,
      },
      true,
    );

    return (
      res.choices[0]?.message?.content?.trim() ??
      (lang === 'en'
        ? `${employee.firstName}, hello!\n\n${taskList}`
        : `${employee.firstName}, здравствуйте!\n\n${taskList}`)
    );
  }

  private async sendDailyPlanNotification(employeeId: string, message: string) {
    await this.prisma.notification.create({
      data: {
        employeeId,
        type: NotificationType.MORNING_BRIEFING,
        channel: NotificationChannel.IN_APP,
        title: 'Your Daily Plan',
        content: message,
        sentAt: new Date(),
      },
    });
  }

  private async evaluateEmployeeMessage(
    companyId: string,
    employeeName: string,
    task: {
      title: string;
      description: string | null;
      deadline: Date | null;
      status: TaskStatus;
      project: { name: string };
      responses: Array<{ message: string | null; responseType: TaskResponseType; createdAt: Date }>;
    },
    message: string,
  ): Promise<SmartEvaluation> {
    const lang = await this.businessContext.getAiLanguage(companyId);
    const locale = this.businessContext.localeForLang(lang);
    const deadlineStr = task.deadline
      ? task.deadline.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    const recentHistory = task.responses
      .map((r) => `${r.responseType}: ${r.message ?? ''}`)
      .join('\n');

    if (!this.llm.isAvailable()) {
      const context = {
        employeeName,
        taskTitle: task.title,
        taskDescription: task.description,
        deadline: deadlineStr,
        projectName: task.project.name,
        currentStatus: task.status,
        recentHistory,
        employeeMessage: message,
      };
      return {
        responseType: TaskResponseType.CUSTOM,
        isComplete: false,
        progressPct: 50,
        aiAnalysis: message.slice(0, 200),
        reply: await this.generateNaturalManagerReply(companyId, context, false),
      };
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);
    const context = {
      employeeName,
      taskTitle: task.title,
      taskDescription: task.description,
      deadline: deadlineStr,
      projectName: task.project.name,
      currentStatus: task.status,
      recentHistory,
      employeeMessage: message,
      businessContext: await this.businessContext.getContext(companyId),
    };

    try {
      const res = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content:
              systemPrefix +
              this.businessContext.getEvaluateMessageRules(lang) +
              this.businessContext.getJsonEvaluateSchema(lang),
            },
            { role: 'user', content: JSON.stringify(context) },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 550,
      }, true);

      const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as Partial<SmartEvaluation>;
      const responseType = this.normalizeResponseType(parsed.responseType);
      const progressPct = Math.min(
        100,
        Math.max(0, parsed.progressPct ?? (parsed.isComplete ? 100 : 50)),
      );
      const isComplete = this.isTaskFullyComplete(parsed.isComplete === true, progressPct, message);

      let reply = parsed.reply?.trim() ?? '';
      if (!reply || this.isBotLikeReply(reply)) {
        reply = await this.generateNaturalManagerReply(companyId, context, true);
      }
      reply = await this.enforceLanguage(companyId, lang, reply, context);

      let aiAnalysis = parsed.aiAnalysis?.trim() ?? message.slice(0, 100);
      aiAnalysis = await this.enforceLanguage(companyId, lang, aiAnalysis, context);

      return {
        responseType: isComplete ? TaskResponseType.COMPLETED : responseType,
        isComplete,
        progressPct: isComplete ? 100 : progressPct,
        aiAnalysis,
        reply: this.sanitizeReply(reply),
      };
    } catch (err) {
      this.logger.warn('Smart evaluation failed, generating natural reply', err);
      const reply = await this.generateNaturalManagerReply(companyId, context, true);
      return {
        responseType: TaskResponseType.CUSTOM,
        isComplete: false,
        progressPct: 50,
        aiAnalysis: message.slice(0, 200),
        reply,
      };
    }
  }

  private isTaskFullyComplete(
    flaggedComplete: boolean,
    progressPct: number,
    message: string,
  ): boolean {
    if (!flaggedComplete || progressPct < 100) return false;
    const text = message.trim().toLowerCase();
    if (text.length < 8) return false;
    const evidence =
      /готов|выполн|заверш|сделал|отправил|done|completed|finished|tamom|анҷом|натижа|result|link|http|файл|отчёт|report/i;
    return evidence.test(text);
  }

  private isBotLikeReply(text: string): boolean {
    const lower = text.toLowerCase();
    const banned = [
      'ин дуруст аст',
      'ташакkur барои навиштан',
      'лутфан тафсилот',
      'please reply',
      'done | started',
      'need help',
    ];
    return banned.some((p) => lower.includes(p));
  }

  private sanitizeReply(text: string): string {
    return text
      .replace(/🤖/g, '')
      .replace(/Таҳлили AI:?/gi, '')
      .trim();
  }

  private async generateNaturalManagerReply(
    companyId: string,
    context: Record<string, unknown>,
    useLlm: boolean,
  ): Promise<string> {
    const lang = await this.businessContext.getAiLanguage(companyId);
    const name = context.employeeName as string;
    const msg = ((context.employeeMessage as string) ?? '').slice(0, 80);

    if (!useLlm || !this.llm.isAvailable()) {
      return this.businessContext.getNaturalReplyFallback(lang, name, msg);
    }

    const systemPrefix = await this.businessContext.getSystemPromptPrefix(companyId);
    const res = await this.llm.chat(
      {
        messages: [
          {
            role: 'system',
            content:
              systemPrefix +
              this.businessContext.getEvaluateMessageRules(lang) +
              ' Reply with plain text only — 1-3 sentences.',
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
        max_tokens: 200,
      },
      true,
    );

    let reply = res.choices[0]?.message?.content?.trim() ?? '';
    reply = this.enforceLanguageSync(lang, reply);
    return (
      this.sanitizeReply(reply) || this.businessContext.getNaturalReplyFallback(lang, name, msg)
    );
  }

  private looksLikeTajik(text: string): boolean {
    return (
      /[ғҷқӯҳЉҒҚӮҲ]/u.test(text) ||
      /\b(лутфан|вазифа|фаҳмидам|коргар|ҷavob|мудир|бизнес|анҷом|натижа|саҳифа|кунед|диҳед|мебошад)\b/i.test(
        text,
      )
    );
  }

  private looksLikeRussian(text: string): boolean {
    return (
      /[ыэёъЁЫЭ]/i.test(text) ||
      /\b(понял|задач|выполн|статус|напомина|сотрудник|бизнес|компани|прогресс|сделано|осталось|давайте|уточним|сообщение|текущ)\b/i.test(
        text,
      )
    );
  }

  private isCorrectLanguage(lang: AiLang, text: string): boolean {
    if (!text.trim()) return false;
    const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
    if (lang === 'ru') {
      return cyrillic >= 6 && !this.looksLikeTajik(text);
    }
    const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
    return latin >= 8 && !this.looksLikeTajik(text) && cyrillic < latin;
  }

  private enforceLanguageSync(lang: AiLang, reply: string): string {
    if (!reply.trim()) return reply;
    if (this.isCorrectLanguage(lang, reply)) return reply;

    if (lang === 'en') {
      return 'Understood. Please share the current status of your task — what is done and what remains?';
    }
    return 'Понял ваше сообщение. Давайте уточним статус по текущей задаче — что уже сделано и что осталось?';
  }

  private async enforceLanguage(
    companyId: string,
    lang: AiLang,
    reply: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    if (this.isCorrectLanguage(lang, reply)) return reply;

    const rewritten = await this.rewriteInCompanyLanguage(companyId, lang, reply, context);
    if (this.isCorrectLanguage(lang, rewritten)) return rewritten;

    return this.enforceLanguageSync(lang, reply);
  }

  private async rewriteInCompanyLanguage(
    companyId: string,
    lang: AiLang,
    text: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    if (!this.llm.isAvailable()) return this.enforceLanguageSync(lang, text);

    const langName = lang === 'ru' ? 'русском' : 'English';
    const res = await this.llm.chat(
      {
        messages: [
          {
            role: 'system',
            content:
              `${await this.businessContext.getSystemPromptPrefix(companyId)}` +
              `Перепишите текст менеджера на ${langName} языке.\n` +
              'Учтите контекст бизнеса и задачи. Только один связный текст, 1-3 предложения. Без таджикского.',
          },
          {
            role: 'user',
            content: JSON.stringify({ originalText: text, context }),
          },
        ],
        max_tokens: 250,
      },
      true,
    );

    return res.choices[0]?.message?.content?.trim() ?? text;
  }

  private normalizeResponseType(type?: string): TaskResponseType {
    const valid = Object.values(TaskResponseType);
    if (type && valid.includes(type as TaskResponseType)) {
      return type as TaskResponseType;
    }
    return TaskResponseType.CUSTOM;
  }

  private async handleBlocker(employeeId: string, taskId: string, message: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true, assignments: { include: { employee: true } } },
    });
    if (!task) return;

    const blockerKeywords = ['backend', 'api', 'design', 'database', 'frontend'];
    const lowerMsg = message.toLowerCase();

    for (const keyword of blockerKeywords) {
      if (!lowerMsg.includes(keyword)) continue;

      const categoryMap: Record<string, TaskCategory> = {
        backend: TaskCategory.BACKEND,
        api: TaskCategory.BACKEND,
        frontend: TaskCategory.FRONTEND,
        design: TaskCategory.DESIGN,
        database: TaskCategory.DATABASE,
      };

      const category = categoryMap[keyword];
      const specialists = await this.prisma.employee.findMany({
        where: {
          companyId: task.project.companyId,
          status: 'ACTIVE',
          id: { not: employeeId },
        },
        include: { skills: true },
      });

      const specialist = this.findBestAssignee(category, specialists);
      if (specialist) {
        await this.prisma.notification.create({
          data: {
            employeeId: specialist.id,
            type: NotificationType.BLOCKER_ALERT,
            channel: NotificationChannel.IN_APP,
            title: 'Blocker Alert',
            content: `A team member is blocked on "${task.title}": ${message}`,
            sentAt: new Date(),
          },
        });
      }
      break;
    }
  }

  private async updateEmployeeAiProfile(employeeId: string) {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: { employeeId },
      include: { task: true },
    });

    const completed = assignments.filter((a) => a.status === TaskStatus.COMPLETED);
    const completionRate = assignments.length
      ? (completed.length / assignments.length) * 100
      : 0;

    await this.prisma.employeeAiProfile.upsert({
      where: { employeeId },
      create: {
        employeeId,
        taskCompletionRate: completionRate,
        productivityScore: Math.min(completionRate * 1.2, 100),
        lastAnalyzedAt: new Date(),
      },
      update: {
        taskCompletionRate: completionRate,
        productivityScore: Math.min(completionRate * 1.2, 100),
        lastAnalyzedAt: new Date(),
      },
    });
  }

  async getRecentActivity(companyId: string) {
    const [responses, messages] = await Promise.all([
      this.prisma.taskResponse.findMany({
        where: { employee: { companyId } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          employee: { select: { firstName: true, telegramUsername: true } },
          task: { select: { title: true } },
        },
      }),
      this.prisma.message.findMany({
        where: { employee: { companyId }, channel: NotificationChannel.TELEGRAM },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { employee: { select: { firstName: true } } },
      }),
    ]);

    const fromResponses = responses.map((r) => ({
      icon: r.responseType === 'COMPLETED' ? '✅' : r.responseType === 'BLOCKED' ? '⚠️' : '💬',
      message: `@${r.employee.telegramUsername ?? r.employee.firstName} — ${r.task.title}: ${r.message ?? r.responseType}`,
      time: r.createdAt.toISOString(),
    }));

    const fromMessages = messages.map((m) => ({
      icon: m.isFromAi ? '📋' : '📩',
      message: `${m.employee?.firstName ?? 'Коргар'}: ${m.content.slice(0, 120)}`,
      time: m.createdAt.toISOString(),
    }));

    return [...fromResponses, ...fromMessages]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20)
      .map((item) => ({
        ...item,
        time: new Date(item.time).toLocaleString(),
      }));
  }

  private buildEmployeeContext(employee: {
    firstName: string;
    role: string;
    skills: { name: string }[];
    aiProfile?: EmployeeContext['aiProfile'];
    taskAssignments: Array<{ task: { title: string; status: TaskStatus } }>;
  }) {
    return {
      name: employee.firstName,
      role: employee.role,
      skills: employee.skills.map((s) => s.name),
      productivity: employee.aiProfile?.productivityScore,
      activeTasks: employee.taskAssignments.map((a) => ({
        title: a.task.title,
        status: a.task.status,
      })),
    };
  }
}
