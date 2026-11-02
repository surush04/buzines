import { PrismaClient, UserRole, EmployeeStatus, ExperienceLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@buzines.tj';
const ADMIN_PASSWORD = 'Admin123!';
const WORKER_PASSWORD = 'Worker123!';

const businessContext = `
=== БИЗНЕС: Buzines Shop ===
Сфера: Фуруш / Retail
Тип: B2C offline
Команда: 5 чел.
Локация: Душанbe, Тоҷикистон

ОПИСАНИЕ: Мағозаи пушак ва кафш дар маркази шahar. Фуруши offline + Instagram.

ПРОДУКТЫ: Пушак, кafш, аксессуарҳо барои занон ва мardон.

КЛИЕНТЫ: Занoni 20-45 сол, оilaҳои миёna, минтақаи маркази шahar.

КАНАЛЫ ПРОДАЖ: Мағоза, Instagram, телефон.

КОНКУРЕНТЫ: 2-3 мағозаи хurd дар ҳамин минтақа — мо сифати беhtar ва хizmatи шахсӣ дорем.

ТЕКУЩЕЕ СОСТОЯНИЕ: Фуруши миёna 8000 сомонӣ/моҳ, 5 корманд, Instagram 1200 follower.

СТРУКТУРА КОМАНДЫ: Менеджер, 2 фurūshanda, маркетинг, бухгалтер.

ПРОЦЕССЫ: Субҳ нақша → рӯз фуруш → шom гузориш дар барномаи корманд.

ЦЕЛИ: Фуруш +30% дар 3 моҳ, Instagram маркетинг, CRM.

ПРОБЛЕМЫ: Кam реклама, follow-up бо муштарiён сust, беҳтар кардани инвentor.

KPI: Фурӯши моҳona, муштарiёни нав, маржа, бозdid.

ОБЩЕНИЕ С КЛИЕНТАМИ: Дӯстона, зуд, Instagram ва телефон.

ОЖИДАНИЯ ОТ СОТРУДНИКОВ: Сari вақt, гузориши натиҷa, савол пурсида.
`.trim();

const employees = [
  {
    firstName: 'Алишер',
    lastName: 'Раҳимов',
    email: 'alisher@buzines.tj',
    role: 'Менеджер',
    skills: ['management', 'sales'],
  },
  {
    firstName: 'Мадина',
    lastName: 'Каримова',
    email: 'madina@buzines.tj',
    role: 'Фурӯшанда',
    skills: ['sales', 'customer-service'],
  },
  {
    firstName: 'Фарход',
    lastName: 'Назаров',
    email: 'farhod@buzines.tj',
    role: 'Фурӯшанда',
    skills: ['sales', 'retail'],
  },
  {
    firstName: 'Зарина',
    lastName: 'Саидова',
    email: 'zarina@buzines.tj',
    role: 'Маркетинг',
    skills: ['marketing', 'instagram', 'content'],
  },
  {
    firstName: 'Джамшед',
    lastName: 'Холиков',
    email: 'jamshed@buzines.tj',
    role: 'Бухгалтер',
    skills: ['accounting', 'excel'],
  },
];

async function clearDatabase() {
  await prisma.verificationReview.deleteMany();
  await prisma.completionReport.deleteMany();
  await prisma.workflowRun.deleteMany();
  await prisma.workflowDefinition.deleteMany();
  await prisma.businessMemory.deleteMany();
  await prisma.employeeCapacity.deleteMany();
  await prisma.simulationScenario.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.aiOperation.deleteMany();
  await prisma.jobRun.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.verificationRule.deleteMany();
  await prisma.ceoDecision.deleteMany();
  await prisma.ceoIssue.deleteMany();
  await prisma.employeeKpi.deleteMany();
  await prisma.companyGoal.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.dailyPlanTask.deleteMany();
  await prisma.dailyPlan.deleteMany();
  await prisma.taskResponse.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.adminDirective.deleteMany();
  await prisma.project.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.performanceMetric.deleteMany();
  await prisma.employeeSkill.deleteMany();
  await prisma.employeeAiProfile.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.aiRecommendation.deleteMany();
  await prisma.report.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.aiSettings.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.company.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('Clearing database...');
  await clearDatabase();

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const workerHash = await bcrypt.hash(WORKER_PASSWORD, 12);

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'Buzines',
      role: UserRole.COMPANY_OWNER,
      isEmailVerified: true,
    },
  });

  const company = await prisma.company.create({
    data: {
      name: 'Buzines Shop',
      description: 'Мағозаи пушак ва кафш дар Душанбе — offline + Instagram.',
      industry: 'Фуруш / Retail',
      businessType: 'B2C offline',
      teamSize: 5,
      onboardingDone: true,
      ownerId: admin.id,
      settings: {
        create: {
          language: 'tg',
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00',
        },
      },
      aiSettings: {
        create: {
          businessContext,
          autonomyLevel: 'FULL_AUTONOMY',
        },
      },
    },
  });

  for (const emp of employees) {
    const user = await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash: workerHash,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: UserRole.EMPLOYEE,
        isEmailVerified: true,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        userId: user.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        role: emp.role,
        status: EmployeeStatus.ACTIVE,
        experienceLevel: ExperienceLevel.MIDDLE,
        hiredAt: new Date(),
        aiProfile: { create: {} },
      },
    });

    for (const skill of emp.skills) {
      await prisma.employeeSkill.create({
        data: { employeeId: employee.id, name: skill, level: 4 },
      });
    }
  }

  console.log('\nDatabase seeded successfully!\n');
  console.log('── Login (admin / панели идоракунӣ) ──');
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log(`Company:  ${company.name}`);
  console.log('\n── Login (корманд / барномаи кор) ──');
  console.log(`Password for all workers: ${WORKER_PASSWORD}`);
  for (const e of employees) {
    console.log(`  - ${e.email} — ${e.firstName} ${e.lastName} (${e.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
