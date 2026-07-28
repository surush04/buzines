import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskStatus, EmployeeStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getExecutiveDashboard(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      employees,
      tasks,
      projects,
      recommendations,
      weeklyMetrics,
    ] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId },
        include: { aiProfile: true },
      }),
      this.prisma.task.findMany({
        where: { project: { companyId } },
        include: { assignments: true },
      }),
      this.prisma.project.findMany({
        where: { companyId },
        include: { _count: { select: { tasks: true } } },
      }),
      this.prisma.aiRecommendation.findMany({
        where: { companyId, isDismissed: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.performanceMetric.findMany({
        where: {
          employee: { companyId },
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const activeEmployees = employees.filter((e) => e.status === EmployeeStatus.ACTIVE);
    const onlineEmployees = employees.filter((e) => e.isOnline);
    const lateEmployees = employees.filter((e) =>
      tasks.some(
        (t) =>
          t.status === TaskStatus.OVERDUE &&
          t.assignments.some((a) => a.employeeId === e.id),
      ),
    );

    const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED);
    const overdueTasks = tasks.filter((t) => t.status === TaskStatus.OVERDUE);
    const blockedTasks = tasks.filter((t) => t.status === TaskStatus.BLOCKED);

    const avgProductivity =
      employees.reduce((sum, e) => sum + (e.aiProfile?.productivityScore ?? 0), 0) /
      (employees.length || 1);

    const projectProgress = projects.map((p) => ({
      id: p.id,
      name: p.name,
      progress: p.progress,
      healthScore: p.healthScore,
      deadline: p.deadline,
      taskCount: p._count.tasks,
      status: p.status,
    }));

    const weeklyStats = this.aggregateWeeklyStats(weeklyMetrics);

    return {
      summary: {
        activeEmployees: activeEmployees.length,
        employeesOnline: onlineEmployees.length,
        lateEmployees: lateEmployees.length,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        blockedTasks: blockedTasks.length,
        productivityScore: Math.round(avgProductivity),
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === 'ACTIVE').length,
      },
      aiRecommendations: recommendations,
      projectProgress,
      weeklyStats,
      charts: {
        productivity: weeklyStats.dailyProductivity,
        teamPerformance: this.getTeamPerformance(employees),
        taskCompletion: this.getTaskCompletionTrend(tasks),
        employeeActivity: this.getEmployeeActivity(employees),
      },
    };
  }

  async getManagerDashboard(companyId: string) {
    const dashboard = await this.getExecutiveDashboard(companyId);
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        aiProfile: true,
        taskAssignments: {
          where: { status: { not: 'COMPLETED' } },
          include: { task: true },
        },
      },
    });

    const performanceRankings = employees
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        role: e.role,
        productivityScore: e.aiProfile?.productivityScore ?? 0,
        activeTasks: e.taskAssignments.length,
        isOnline: e.isOnline,
      }))
      .sort((a, b) => b.productivityScore - a.productivityScore);

    const blockedTasks = await this.prisma.task.findMany({
      where: { project: { companyId }, status: 'BLOCKED' },
      include: {
        assignments: { include: { employee: { select: { firstName: true, lastName: true } } } },
      },
    });

    return {
      ...dashboard,
      performanceRankings,
      blockedTasks: blockedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        assignee: t.assignments[0]?.employee
          ? `${t.assignments[0].employee.firstName} ${t.assignments[0].employee.lastName}`
          : 'Unassigned',
      })),
      currentTasks: employees.flatMap((e) =>
        e.taskAssignments.map((a) => ({
          employee: `${e.firstName} ${e.lastName}`,
          task: a.task.title,
          status: a.status,
        })),
      ),
    };
  }

  private aggregateWeeklyStats(metrics: Array<{ date: Date; productivityScore: number; tasksCompleted: number }>) {
    const dailyProductivity: { date: string; score: number; completed: number }[] = [];
    const dayMap = new Map<string, { scores: number[]; completed: number }>();

    for (const m of metrics) {
      const key = m.date.toISOString().split('T')[0];
      const existing = dayMap.get(key) ?? { scores: [], completed: 0 };
      existing.scores.push(m.productivityScore);
      existing.completed += m.tasksCompleted;
      dayMap.set(key, existing);
    }

    for (const [date, data] of dayMap) {
      dailyProductivity.push({
        date,
        score: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        completed: data.completed,
      });
    }

    return {
      dailyProductivity: dailyProductivity.sort((a, b) => a.date.localeCompare(b.date)),
      totalCompleted: metrics.reduce((s, m) => s + m.tasksCompleted, 0),
    };
  }

  private getTeamPerformance(
    employees: Array<{ departmentId: string | null; aiProfile: { productivityScore: number } | null }>,
  ) {
    const deptMap = new Map<string, number[]>();
    for (const e of employees) {
      const dept = e.departmentId ?? 'unassigned';
      const scores = deptMap.get(dept) ?? [];
      scores.push(e.aiProfile?.productivityScore ?? 0);
      deptMap.set(dept, scores);
    }
    return Array.from(deptMap.entries()).map(([dept, scores]) => ({
      department: dept,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));
  }

  private getTaskCompletionTrend(tasks: Array<{ status: TaskStatus; completedAt: Date | null }>) {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return last7Days.map((date) => ({
      date,
      completed: tasks.filter(
        (t) =>
          t.status === TaskStatus.COMPLETED &&
          t.completedAt?.toISOString().split('T')[0] === date,
      ).length,
    }));
  }

  private getEmployeeActivity(
    employees: Array<{ isOnline: boolean; lastActiveAt: Date | null; status: EmployeeStatus }>,
  ) {
    return {
      online: employees.filter((e) => e.isOnline).length,
      offline: employees.filter((e) => !e.isOnline && e.status === 'ACTIVE').length,
      onLeave: employees.filter((e) => e.status !== 'ACTIVE').length,
    };
  }
}
