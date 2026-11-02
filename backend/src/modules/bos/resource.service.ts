import { Injectable } from '@nestjs/common';
import { EmployeeStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const OPEN: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.ASSIGNED,
  TaskStatus.ACCEPTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
  TaskStatus.OVERDUE,
  TaskStatus.COMPLETED_PENDING_VERIFICATION,
  TaskStatus.REJECTED,
];

@Injectable()
export class ResourceService {
  constructor(private prisma: PrismaService) {}

  async overview(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: { not: EmployeeStatus.TERMINATED } },
      include: {
        skills: true,
        capacity: true,
        taskAssignments: {
          where: { status: { in: OPEN } },
          include: { task: { select: { title: true, priority: true, deadline: true, estimatedHours: true, status: true } } },
        },
      },
    });

    const rows = employees.map((e) => {
      const hours = e.taskAssignments.reduce((s, a) => s + (a.task.estimatedHours ?? 2), 0);
      const cap = e.capacity?.hoursPerWeek ?? 40;
      const available =
        (e.capacity?.available ?? true) &&
        e.status === EmployeeStatus.ACTIVE &&
        (!e.capacity?.unavailableUntil || e.capacity.unavailableUntil < new Date());
      const overdue = e.taskAssignments.filter((a) => a.task.status === TaskStatus.OVERDUE).length;
      const blocked = e.taskAssignments.filter((a) => a.task.status === TaskStatus.BLOCKED).length;
      const loadPct = cap ? Math.round((hours / cap) * 100) : 0;
      return {
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`,
        role: e.role,
        skills: e.skills.map((s) => s.name),
        available,
        hoursPerWeek: cap,
        estimatedOpenHours: hours,
        loadPct,
        openTasks: e.taskAssignments.length,
        overdue,
        blocked,
        imbalance: loadPct > 110 || (loadPct < 30 && hours === 0),
        tasks: e.taskAssignments.map((a) => a.task),
      };
    });

    const overloaded = rows.filter((r) => r.loadPct > 100 || r.openTasks >= 8);
    return { employees: rows, overloaded, warnings: overloaded.map((r) => `${r.name} is over capacity (${r.loadPct}%)`) };
  }

  async upsertCapacity(companyId: string, employeeId: string, data: { hoursPerWeek?: number; available?: boolean; unavailableUntil?: string; notes?: string }) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new Error('Employee not found');
    return this.prisma.employeeCapacity.upsert({
      where: { employeeId },
      update: {
        hoursPerWeek: data.hoursPerWeek,
        available: data.available,
        unavailableUntil: data.unavailableUntil ? new Date(data.unavailableUntil) : undefined,
        notes: data.notes,
      },
      create: {
        companyId,
        employeeId,
        hoursPerWeek: data.hoursPerWeek ?? 40,
        available: data.available ?? true,
        unavailableUntil: data.unavailableUntil ? new Date(data.unavailableUntil) : undefined,
        notes: data.notes,
      },
    });
  }

  async suggestAssignee(companyId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { companyId } },
      include: { project: true },
    });
    if (!task) throw new Error('Task not found');
    const overview = await this.overview(companyId);
    const required = (task.category ?? 'OTHER').toLowerCase();
    const scored = overview.employees
      .filter((e) => e.available)
      .map((e) => {
        const skillHit = e.skills.some((s) => s.toLowerCase().includes(required) || required.includes(s.toLowerCase()));
        let score = 50;
        const reasons: string[] = [];
        if (skillHit) {
          score += 25;
          reasons.push('Matching skill/category');
        } else reasons.push('No matching skill (lower score)');
        score -= Math.min(40, e.loadPct / 4);
        reasons.push(`Current load ${e.loadPct}% (~${e.estimatedOpenHours}h of ${e.hoursPerWeek}h)`);
        if (e.overdue) {
          score -= 10;
          reasons.push(`${e.overdue} overdue tasks`);
        }
        if (task.priority === 'CRITICAL' && e.loadPct > 90) {
          score -= 15;
          reasons.push('Critical task not suggested for overloaded person');
        }
        return { ...e, score, reasons };
      })
      .sort((a, b) => b.score - a.score);

    return {
      task: { id: task.id, title: task.title, priority: task.priority, category: task.category },
      suggestions: scored.slice(0, 5),
      note: 'Scores use skills, estimated hours (not task count alone), availability and overdue load.',
    };
  }
}
