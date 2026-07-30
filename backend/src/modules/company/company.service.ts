import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCompanyDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateProjectDto,
  UpdateAiSettingsDto,
  UpdateCompanySettingsDto,
  OnboardingDto,
  UpdateBusinessProfileDto,
} from './dto/company.dto';
import { ProjectStatus } from '@prisma/client';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async createCompany(ownerId: string, dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        ...dto,
        ownerId,
        settings: { create: {} },
        aiSettings: { create: {} },
      },
      include: { settings: true, aiSettings: true },
    });
  }

  async getCompanies(ownerId: string) {
    return this.prisma.company.findMany({
      where: { ownerId },
      include: {
        _count: { select: { employees: true, projects: true, departments: true } },
      },
    });
  }

  async getCompany(companyId: string, userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, ownerId: userId },
      include: {
        departments: { include: { _count: { select: { employees: true } } } },
        settings: true,
        aiSettings: true,
        integrations: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async createDepartment(companyId: string, userId: string, dto: CreateDepartmentDto) {
    await this.verifyOwnership(companyId, userId);
    return this.prisma.department.create({
      data: { ...dto, companyId },
    });
  }

  async createEmployee(companyId: string, userId: string, dto: CreateEmployeeDto) {
    await this.verifyOwnership(companyId, userId);
    const { skills, ...employeeData } = dto;

    if (employeeData.telegramUsername) {
      employeeData.telegramUsername = employeeData.telegramUsername.replace(/^@/, '').trim();
    }

    const existing = await this.prisma.employee.findFirst({
      where: { companyId, email: employeeData.email },
    });
    if (existing) {
      throw new ConflictException(
        `Коргар бо email «${employeeData.email}» аллакай вуҷуд дорад. Email-и дигар истифода баред.`,
      );
    }

    try {
      return await this.prisma.employee.create({
        data: {
          ...employeeData,
          companyId,
          skills: skills?.length
            ? { create: skills.map((name) => ({ name })) }
            : undefined,
          aiProfile: { create: {} },
        },
        include: { skills: true, aiProfile: true, department: true },
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Коргар бо email «${employeeData.email}» аллакай вуҷуд дорад. Email-и дигар истифода баред.`,
        );
      }
      throw err;
    }
  }

  async getEmployees(companyId: string, userId: string) {
    await this.verifyOwnership(companyId, userId);
    return this.prisma.employee.findMany({
      where: { companyId },
      include: {
        skills: true,
        aiProfile: true,
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { firstName: 'asc' },
    });
  }

  async getEmployee(companyId: string, employeeId: string, userId: string) {
    await this.verifyOwnership(companyId, userId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        skills: true,
        aiProfile: true,
        department: true,
        taskAssignments: {
          include: { task: { include: { project: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 20,
        },
        performanceMetrics: { orderBy: { date: 'desc' }, take: 30 },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async createProject(companyId: string, userId: string, dto: CreateProjectDto) {
    await this.verifyOwnership(companyId, userId);
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        deadline: new Date(dto.deadline),
        priority: dto.priority,
        departmentId: dto.departmentId,
        companyId,
        status: ProjectStatus.PLANNING,
      },
    });
  }

  async getProjects(companyId: string, userId: string) {
    await this.verifyOwnership(companyId, userId);
    return this.prisma.project.findMany({
      where: { companyId },
      include: {
        _count: { select: { tasks: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { deadline: 'asc' },
    });
  }

  async updateSettings(
    companyId: string,
    userId: string,
    dto: UpdateCompanySettingsDto,
  ) {
    await this.verifyOwnership(companyId, userId);
    return this.prisma.companySettings.update({
      where: { companyId },
      data: dto,
    });
  }

  async updateAiSettings(
    companyId: string,
    userId: string,
    dto: UpdateAiSettingsDto,
  ) {
    await this.verifyOwnership(companyId, userId);
    return this.prisma.aiSettings.update({
      where: { companyId },
      data: dto as Record<string, unknown>,
    });
  }

  async completeOnboarding(companyId: string, userId: string, dto: OnboardingDto) {
    await this.verifyOwnership(companyId, userId);

    const businessContext = this.buildBusinessContext(dto);

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.companyName,
        industry: dto.industry,
        businessType: dto.businessModel ?? dto.businessType,
        description: dto.description,
        teamSize: dto.teamSize ?? undefined,
        onboardingDone: true,
      },
    });

    await this.prisma.aiSettings.update({
      where: { companyId },
      data: {
        businessContext,
        autonomyLevel: (dto.autonomyLevel as 'FULL_AUTONOMY' | 'ADVISOR') ?? 'FULL_AUTONOMY',
      },
    });

    await this.prisma.companySettings.update({
      where: { companyId },
      data: { language: dto.language ?? 'ru' },
    });

    return this.getCompany(companyId, userId);
  }

  private onboardingSection(
    lang: string | undefined,
    ru: string,
    tg: string,
    en: string,
  ): string {
    if (lang === 'en') return en;
    if (lang === 'tg') return tg;
    return ru;
  }

  private buildBusinessContext(dto: OnboardingDto): string {
    const lang = dto.language ?? 'ru';
    const section = (title: string, value?: string) => {
      const text = value?.trim();
      if (!text) return null;
      return `=== ${title} ===\n${text}`;
    };

    const sections = [
      section(
        this.onboardingSection(lang, 'ОПИСАНИЕ БИЗНЕСА', 'ТАВСИФИ БИЗНЕС', 'BUSINESS DESCRIPTION'),
        dto.description,
      ),
      section(
        this.onboardingSection(lang, 'ЛОКАЦИЯ И РЫНОК', 'ҶОЙГАҲ ВА БОЗОР', 'LOCATION & MARKET'),
        `${dto.location.trim()}\n${this.onboardingSection(lang, 'Модель', 'Модел', 'Model')}: ${dto.businessModel}`,
      ),
      section(
        this.onboardingSection(lang, 'ПРОДУКТЫ И УСЛУГИ', 'МАҲСУЛОТ ВА ХИЗМАТРАСОНИҲО', 'PRODUCTS & SERVICES'),
        dto.products,
      ),
      section(
        this.onboardingSection(lang, 'КЛИЕНТЫ И АУДИТОРИЯ', 'МУШТАРИЁН', 'CUSTOMERS'),
        dto.customers,
      ),
      section(
        this.onboardingSection(lang, 'КАНАЛЫ ПРОДАЖ', 'КАНАЛҲОИ ФУРӮӢШ', 'SALES CHANNELS'),
        dto.salesChannels,
      ),
      section(
        this.onboardingSection(lang, 'КОНКУРЕНТЫ', 'РАҚИБОН', 'COMPETITORS'),
        dto.competitors,
      ),
      section(
        this.onboardingSection(lang, 'ТЕКУЩЕЕ СОСТОЯНИЕ', 'ҲОЛАТИ ҲОЗИРА', 'CURRENT STATE'),
        dto.currentState,
      ),
      section(
        this.onboardingSection(lang, 'СТРУКТУРА КОМАНДЫ И РОЛИ', 'САХТАМОНИ ДАСТА', 'TEAM STRUCTURE'),
        dto.teamStructure,
      ),
      section(
        this.onboardingSection(lang, 'ПРОЦЕССЫ И РАБОЧИЙ ДЕНЬ', 'РАВАНДИ КОР', 'WORK PROCESSES'),
        dto.workProcesses,
      ),
      dto.toolsAndSystems?.trim()
        ? section(
            this.onboardingSection(lang, 'ИНСТРУМЕНТЫ И СИСТЕМЫ', 'АБЗОРҲО ВА СИСТЕМАҲО', 'TOOLS & SYSTEMS'),
            dto.toolsAndSystems,
          )
        : null,
      section(
        this.onboardingSection(lang, 'ЦЕЛИ', 'МАҚСАДҲО', 'GOALS'),
        dto.goals,
      ),
      section(
        this.onboardingSection(lang, 'ПРОБЛЕМЫ И ПРЕПЯТСТВИЯ', 'МУШКИЛИҲО', 'CHALLENGES'),
        dto.challenges,
      ),
      section(
        this.onboardingSection(lang, 'KPI И МЕТРИКИ', 'KPI ВА МЕТРИКАҲО', 'KPI & METRICS'),
        dto.kpis,
      ),
      dto.seasonality?.trim()
        ? section(
            this.onboardingSection(lang, 'СЕЗОННОСТЬ', 'МУВОФИҚИЯТ', 'SEASONALITY'),
            dto.seasonality,
          )
        : null,
      section(
        this.onboardingSection(lang, 'ОБЩЕНИЕ С КЛИЕНТАМИ', 'АЛОҚА БО МУШТАРИЁН', 'CUSTOMER COMMUNICATION'),
        dto.customerCommunication,
      ),
      section(
        this.onboardingSection(lang, 'ОЖИДАНИЯ ОТ СОТРУДНИКОВ', 'ИНТИЗОРИЯТ АЗ КОРМАНДО', 'EMPLOYEE EXPECTATIONS'),
        dto.employeeExpectations,
      ),
      dto.businessContext?.trim()
        ? section(
            this.onboardingSection(lang, 'ДОПОЛНИТЕЛЬНО', 'ИЛОВАГӢ', 'ADDITIONAL NOTES'),
            dto.businessContext,
          )
        : null,
    ];

    return sections.filter(Boolean).join('\n\n');
  }

  async updateBusinessProfile(
    companyId: string,
    userId: string,
    dto: UpdateBusinessProfileDto,
  ) {
    await this.verifyOwnership(companyId, userId);

    if (dto.description !== undefined) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { description: dto.description },
      });
    }

    const aiData: Record<string, unknown> = {};
    if (dto.businessContext !== undefined) aiData.businessContext = dto.businessContext;
    if (dto.autonomyLevel !== undefined) aiData.autonomyLevel = dto.autonomyLevel;

    if (Object.keys(aiData).length) {
      await this.prisma.aiSettings.update({ where: { companyId }, data: aiData });
    }

    return this.getCompany(companyId, userId);
  }

  async resetOperationalData(companyId: string, userId: string) {
    await this.verifyOwnership(companyId, userId);

    await this.prisma.$transaction([
      this.prisma.taskResponse.deleteMany({ where: { employee: { companyId } } }),
      this.prisma.notification.deleteMany({ where: { employee: { companyId } } }),
      this.prisma.message.deleteMany({ where: { employee: { companyId } } }),
      this.prisma.taskAssignment.deleteMany({ where: { employee: { companyId } } }),
      this.prisma.task.deleteMany({ where: { project: { companyId } } }),
      this.prisma.adminDirective.deleteMany({ where: { companyId } }),
      this.prisma.project.deleteMany({ where: { companyId } }),
      this.prisma.dailyPlan.deleteMany({ where: { employee: { companyId } } }),
      this.prisma.aiRecommendation.deleteMany({ where: { companyId } }),
    ]);

    return { reset: true, message: 'Маълумоти операативӣ тоза шуд. Бизнес профил ва коргарон боқӣ монданд.' };
  }

  private async verifyOwnership(companyId: string, userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, ownerId: userId },
    });
    if (!company) throw new ForbiddenException('Access denied');
  }
}
