import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskStatus, DirectiveStatus } from '@prisma/client';

/** UI language (frontend) */
export type AppLang = 'tg' | 'ru' | 'en';
/** AI output language — Tajik is never used */
export type AiLang = 'ru' | 'en';

@Injectable()
export class BusinessContextService {
  constructor(private prisma: PrismaService) {}

  async getCompanyLanguage(companyId: string): Promise<AppLang> {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
      select: { language: true },
    });
    const lang = settings?.language?.toLowerCase();
    if (lang === 'ru' || lang === 'en' || lang === 'tg') return lang;
    return 'ru';
  }

  /** Maps UI language to AI language. Tajik UI → Russian AI. */
  resolveAiLang(lang: AppLang): AiLang {
    return lang === 'en' ? 'en' : 'ru';
  }

  async getAiLanguage(companyId: string): Promise<AiLang> {
    return this.resolveAiLang(await this.getCompanyLanguage(companyId));
  }

  getLanguageDirective(lang: AiLang): string {
    const directives: Record<AiLang, string> = {
      ru:
        'ЯЗЫК (КРИТИЧНО): Отвечайте СТРОГО ТОЛЬКО на русском языке.\n' +
        'КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО: таджикский язык, таджикские слова (вазифа, лутфан, фаҳмидам, салом, коргар и т.д.), английский, латиница, смешанный текст.\n' +
        'Поля reply и aiAnalysis — только кириллица, только русский.',
      en:
        'LANGUAGE (CRITICAL): Respond STRICTLY ONLY in English.\n' +
        'FORBIDDEN: Tajik language, Russian, Cyrillic, or mixed languages.',
    };
    return directives[lang];
  }

  getLanguageReminder(lang: AiLang): string {
    const reminders: Record<AiLang, string> = {
      ru: '\n\nНАПОМИНАНИЕ: reply и aiAnalysis — ТОЛЬКО на русском языке. Никакого таджикского.',
      en: '\n\nREMINDER: reply and aiAnalysis — English ONLY. No Tajik or Russian.',
    };
    return reminders[lang];
  }

  getTaskManagementRules(lang: AiLang): string {
    const rules: Record<AiLang, string> = {
      ru:
        'ПРАВИЛА ЗАДАЧ (ОБЯЗАТЕЛЬНО):\n' +
        '- НЕ создавайте новые задачи, пока текущие не выполнены на 100%.\n' +
        '- Если сотрудник не ответил — только follow-up по ТОЙ ЖЕ задаче.\n' +
        '- Отвечайте ТОЛЬКО по теме текущей задачи. Без посторонних тем.\n' +
        '- isComplete=true только при progressPct=100 и конкретном результате.\n' +
        '- Сначала проанализируйте сообщение, потом отвечайте по делу.',
      en:
        'TASK RULES (MANDATORY):\n' +
        '- Do NOT create new tasks until current ones are 100% complete.\n' +
        '- No response → follow-up on the SAME task only.\n' +
        '- Reply ONLY about the current task.\n' +
        '- isComplete=true only at progressPct=100 with clear evidence.',
    };
    return rules[lang];
  }

  localeForLang(lang: AiLang): string {
    return lang === 'ru' ? 'ru-RU' : 'en-US';
  }

  shortReply(lang: AiLang, key: 'ack' | 'noTask' | 'followUpFallback'): string {
    const map: Record<string, Record<AiLang, string>> = {
      ack: {
        ru: 'Понял. Отвечу по текущей задаче.',
        en: 'Understood. I will reply about the current task.',
      },
      noTask: {
        ru: 'Активной задачи нет. Дождитесь назначения от администратора.',
        en: 'No active task. Wait for admin assignment.',
      },
      followUpFallback: {
        ru: 'Напоминаю о текущей задаче. Сообщите статус выполнения.',
        en: 'Reminder: please share progress on your current task.',
      },
    };
    return map[key][lang];
  }

  getEvaluateMessageRules(lang: AiLang): string {
    const rules: Record<AiLang, string> = {
      ru:
        'Вы — операционный менеджер (не бот).\n' +
        'ПОРЯДОК:\n' +
        '1) Изучите контекст бизнеса (цели, продукты, проблемы).\n' +
        '2) Прочитайте задачу и сообщение сотрудника.\n' +
        '3) aiAnalysis — для админа на русском: что сотрудник сообщил, прогресс, связь с задачей и целями бизнеса.\n' +
        '4) reply — живой ответ сотруднику на русском (1-3 предложения), по задаче и с учётом бизнеса.\n' +
        'ЗАПРЕЩЕНО: шаблоны бота, «это правильно?», посторонние темы, таджикский язык.\n' +
        'isComplete=true ТОЛЬКО при progressPct=100 и конкретном результате в сообщении.',
      en:
        'You are an operations manager (not a bot). Analyze employee message in business + task context.\n' +
        'aiAnalysis — for admin. reply — natural 1-3 sentences for employee in English.\n' +
        'FORBIDDEN: Tajik language.\n' +
        'isComplete=true ONLY when progressPct=100 AND clear evidence.',
    };
    return rules[lang];
  }

  getJsonEvaluateSchema(lang: AiLang): string {
    const note =
      lang === 'ru'
        ? 'reply и aiAnalysis — ТОЛЬКО на русском, без таджикского'
        : 'reply and aiAnalysis — English ONLY';
    return `\nJSON: { "responseType": "STARTED|COMPLETED|BLOCKED|NEED_HELP|RUNNING_LATE|CUSTOM", "isComplete": bool, "progressPct": 0-100, "aiAnalysis": "анализ для админа (${note})", "reply": "ответ сотруднику (${note})" }`;
  }

  getChatReplyRules(lang: AiLang): string {
    const rules: Record<AiLang, string> = {
      ru:
        'Ответьте как живой менеджер на русском языке.\n' +
        'Сначала проанализируйте сообщение сотрудника в контексте бизнеса и активной задачи.\n' +
        'Ответ — короткий, по делу, с учётом целей компании. Только русский язык. Без таджикского.\n' +
        'Обсуждайте ТОЛЬКО текущую задачу. Без шаблонов и посторонних тем.',
      en:
        'Reply like a real manager — short, on-topic, in English only.\n' +
        'Analyze the message in business + task context first. No Tajik.',
    };
    return rules[lang];
  }

  getFollowUpRules(lang: AiLang): string {
    const rules: Record<AiLang, string> = {
      ru:
        'Напишите follow-up по ТЕКУЩЕЙ задаче — естественно, коротко, без эмодзи и HTML.\n' +
        'Напомните о задаче и попросите статус или результат. Не создавайте новую задачу.\n' +
        'Только русский язык. Таджикский запрещён.',
      en:
        'Write a follow-up about the SAME task — natural, short, no HTML. Ask for status or result. English only.',
    };
    return rules[lang];
  }

  getNaturalReplyFallback(lang: AiLang, name: string, msg: string): string {
    const snippet = msg.slice(0, 80);
    const map: Record<AiLang, string> = {
      ru: `${name}, понял: «${snippet}». Отвечу по текущей задаче.`,
      en: `${name}, got it: «${snippet}». I'll reply about the current task.`,
    };
    return map[lang];
  }

  buildTaskAssignmentMessage(
    lang: AiLang,
    params: {
      name: string;
      instruction: string;
      title: string;
      description?: string | null;
      deadlineStr: string;
    },
  ): string {
    const { name, instruction, title, description, deadlineStr } = params;
    if (lang === 'en') {
      return (
        `${name}, hello!\n\n` +
        `Admin order: ${instruction}\n\n` +
        `Your task: ${title}\n` +
        (description ? `Description: ${description}\n` : '') +
        `Deadline: ${deadlineStr}\n\n` +
        `Please reply with what you did and the result.`
      );
    }
    return (
      `${name}, здравствуйте!\n\n` +
      `Приказ администратора: ${instruction}\n\n` +
      `Ваша задача: ${title}\n` +
      (description ? `Описание: ${description}\n` : '') +
      `Срок выполнения: ${deadlineStr}\n\n` +
      `Пожалуйста, ответьте — что сделано и какой результат.`
    );
  }

  deadlineNotSetLabel(lang: AiLang): string {
    return lang === 'en' ? 'not set' : 'не указан';
  }

  async countIncompleteTasks(companyId: string): Promise<number> {
    return this.prisma.task.count({
      where: {
        project: { companyId },
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      },
    });
  }

  async getContext(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        aiSettings: true,
        settings: true,
        employees: {
          where: { status: 'ACTIVE' },
          select: { firstName: true, role: true, skills: { select: { name: true } } },
        },
      },
    });

    if (!company) return '';

    const team = company.employees
      .map(
        (e) =>
          `- ${e.firstName}: ${e.role}${e.skills.length ? ` (${e.skills.map((s) => s.name).join(', ')})` : ''}`,
      )
      .join('\n');

    const parts = [
      `Компания: ${company.name}`,
      company.industry ? `Сфера: ${company.industry}` : null,
      company.businessType ? `Тип: ${company.businessType}` : null,
      company.teamSize ? `Команда: ${company.teamSize} чел.` : null,
      company.description ? `Описание: ${company.description}` : null,
      company.aiSettings?.businessContext
        ? `Контекст:\n${company.aiSettings.businessContext}`
        : null,
      company.settings?.language ? `Язык UI: ${company.settings.language}` : null,
      'Язык ответов AI: русский (таджикский запрещён)',
      team ? `Сотрудники:\n${team}` : 'Сотрудники: не добавлены',
    ];

    return parts.filter(Boolean).join('\n');
  }

  async getOperationalSnapshot(companyId: string): Promise<string> {
    const lang = await this.getAiLanguage(companyId);
    const locale = this.localeForLang(lang);

    const [taskCounts, activeTasks, directives, employeeLoads] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { project: { companyId } },
        _count: true,
      }),
      this.prisma.task.findMany({
        where: {
          project: { companyId },
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
        take: 20,
        select: {
          title: true,
          status: true,
          deadline: true,
          assignments: {
            select: {
              employee: { select: { firstName: true, telegramUsername: true } },
              status: true,
            },
          },
        },
      }),
      this.prisma.adminDirective.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          instruction: true,
          status: true,
          progress: true,
          tasksDone: true,
          tasksTotal: true,
        },
      }),
      this.prisma.employee.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          firstName: true,
          role: true,
          taskAssignments: {
            where: { status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
            select: { task: { select: { title: true, status: true } } },
          },
        },
      }),
    ]);

    const statusLine = taskCounts.map((s) => `${s.status}: ${s._count}`).join(', ');

    const taskLines = activeTasks.map((t) => {
      const who = t.assignments[0]?.employee;
      const assignee = who ? `${who.firstName}` : '-';
      const dl = t.deadline
        ? t.deadline.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
        : '-';
      return `- [${t.status}] ${t.title} -> ${assignee}, deadline: ${dl}`;
    });

    const directiveLines = directives.map(
      (d) => `- "${d.instruction.slice(0, 80)}" — ${d.status}, ${d.tasksDone}/${d.tasksTotal}`,
    );

    const loadLines = employeeLoads.map((e) => {
      const tasks = e.taskAssignments.map((a) => a.task.title).join('; ') || '-';
      return `- ${e.firstName} (${e.role}): ${tasks}`;
    });

    return [
      '=== CURRENT STATE ===',
      `Tasks: ${statusLine || 'none'}`,
      '',
      'Active tasks:',
      taskLines.length ? taskLines.join('\n') : '- none',
      '',
      'Recent orders:',
      directiveLines.length ? directiveLines.join('\n') : '- none',
      '',
      'Employee load:',
      loadLines.join('\n'),
      '=== END ===',
    ].join('\n');
  }

  async getSystemPromptPrefix(companyId: string): Promise<string> {
    const [ctx, ops, lang] = await Promise.all([
      this.getContext(companyId),
      this.getOperationalSnapshot(companyId),
      this.getAiLanguage(companyId),
    ]);
    return (
      `${this.getLanguageDirective(lang)}\n\n${this.getTaskManagementRules(lang)}\n\n` +
      `You are AI Business Manager.\n` +
      `NEVER use Tajik language in any response.\n` +
      `Follow up on the SAME task until 100% complete. Do NOT create new tasks while incomplete tasks exist.\n` +
      `Speak naturally — not like a bot.\n\n` +
      `=== BUSINESS ===\n${ctx}\n\n${ops}\n` +
      this.getLanguageReminder(lang)
    );
  }
}
