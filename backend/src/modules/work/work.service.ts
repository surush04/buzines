import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEngineService } from '../../infrastructure/ai/ai-engine.service';
import { VerificationService } from '../bos/verification.service';

const OPEN_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.ASSIGNED,
  TaskStatus.ACCEPTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
  TaskStatus.OVERDUE,
  TaskStatus.REJECTED,
  TaskStatus.COMPLETED_PENDING_VERIFICATION,
];

@Injectable()
export class WorkService {
  constructor(
    private prisma: PrismaService,
    private aiEngine: AiEngineService,
    private verification: VerificationService,
  ) {}

  async getEmployeeForUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { company: { select: { id: true, name: true } } },
    });
    if (!employee) throw new ForbiddenException('Employee profile not found');
    return employee;
  }

  async getMe(userId: string) {
    const employee = await this.getEmployeeForUser(userId);
    const [open, done, unread] = await Promise.all([
      this.prisma.taskAssignment.count({
        where: { employeeId: employee.id, status: { in: OPEN_STATUSES } },
      }),
      this.prisma.taskAssignment.count({
        where: { employeeId: employee.id, status: TaskStatus.COMPLETED },
      }),
      this.prisma.notification.count({
        where: { employeeId: employee.id, isRead: false },
      }),
    ]);

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        role: employee.role,
        companyName: employee.company.name,
      },
      stats: { open, done, unread },
    };
  }

  async getTasks(userId: string) {
    const employee = await this.getEmployeeForUser(userId);
    const assignments = await this.prisma.taskAssignment.findMany({
      where: { employeeId: employee.id },
      include: {
        task: {
          include: {
            project: { select: { name: true } },
            responses: {
              where: { employeeId: employee.id },
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: { message: true, responseType: true, progressPct: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const mapItem = (a: (typeof assignments)[number]) => ({
      assignmentId: a.id,
      assignmentStatus: a.status,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
      task: {
        id: a.task.id,
        title: a.task.title,
        description: a.task.description,
        status: a.task.status,
        deadline: a.task.deadline,
        projectName: a.task.project.name,
      },
      lastResponses: a.task.responses,
    });

    const open = assignments.filter((a) => OPEN_STATUSES.includes(a.status)).map(mapItem);
    const done = assignments.filter((a) => a.status === TaskStatus.COMPLETED).map(mapItem);

    return { open, done };
  }

  async getNotifications(userId: string) {
    const employee = await this.getEmployeeForUser(userId);
    return this.prisma.notification.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async markNotificationsRead(userId: string) {
    const employee = await this.getEmployeeForUser(userId);
    await this.prisma.notification.updateMany({
      where: { employeeId: employee.id, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async respond(
    userId: string,
    taskId: string,
    message: string,
    extras?: { evidenceLinks?: string[]; measurableOutcome?: string; claimedValue?: number },
  ) {
    const employee = await this.getEmployeeForUser(userId);
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: { taskId, employeeId: employee.id },
    });
    if (!assignment) throw new NotFoundException('Task not assigned to you');

    const result = await this.aiEngine.processEmployeeResponse(employee.id, taskId, message);
    const claimsComplete =
      result.newStatus === TaskStatus.COMPLETED_PENDING_VERIFICATION ||
      /анҷом|tamom|done|completed|иҷро шуд/i.test(message);
    if (claimsComplete || extras?.evidenceLinks?.length || extras?.measurableOutcome) {
      try {
        const report = await this.verification.submit({
          companyId: employee.companyId,
          taskId,
          employeeId: employee.id,
          summary: message,
          evidenceLinks: extras?.evidenceLinks,
          measurableOutcome: extras?.measurableOutcome,
          claimedValue: extras?.claimedValue,
        });
        return { ...result, verification: report };
      } catch {
        return result;
      }
    }
    return result;
  }
}
