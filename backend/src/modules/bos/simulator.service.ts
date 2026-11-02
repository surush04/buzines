import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SimulatorService {
  constructor(private prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.simulationScenario.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async run(companyId: string, name: string, hypothesis: string, assumptions: Record<string, number>) {
    const [employees, tasks, kpis, goals] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.task.findMany({
        where: { project: { companyId } },
        select: { status: true, estimatedHours: true, deadline: true },
      }),
      this.prisma.employeeKpi.findMany({ where: { companyId } }),
      this.prisma.companyGoal.findMany({ where: { companyId, status: 'ACTIVE' } }),
    ]);

    const missing: string[] = [];
    if (!kpis.length) missing.push('No employee KPI facts — cannot project sales/output numerically');
    if (!goals.length) missing.push('No company goals — comparison to target is unavailable');
    const hours = tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
    if (!hours) missing.push('Tasks lack estimatedHours — workload projection uses a 2h default');

    const extraPeople = assumptions.hireCount ?? 0;
    const extraBudget = assumptions.marketingBudget ?? 0;
    const deadlineFactor = assumptions.deadlineFactor ?? 1;
    const extraContacts = assumptions.dailyContacts ?? 0;

    const open = tasks.filter((t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED).length;
    const currentCapacity = employees * 40;
    const nextCapacity = (employees + extraPeople) * 40;
    const workloadNow = tasks.reduce((s, t) => s + (t.estimatedHours ?? 2), 0);
    const projectedWeeks = nextCapacity ? workloadNow / nextCapacity : null;

    const kpiLift =
      extraPeople || extraContacts || extraBudget
        ? {
            method: 'linear_assumption',
            note: 'Not a forecast. Applies director assumptions only to rows that have plan/fact.',
            rows: kpis.map((k) => {
              const fact = k.factValue;
              if (fact == null) return { name: k.name, projected: null, reason: 'missing fact' };
              const lift = 1 + extraPeople * 0.08 + extraContacts * 0.01 + extraBudget * 0.00001;
              return { name: k.name, current: fact, projected: Number((fact * lift).toFixed(2)), unit: k.unit };
            }),
          }
        : { method: 'none', note: 'No hiring/budget/contact assumptions provided', rows: [] };

    const projected = {
      employeesNow: employees,
      employeesIf: employees + extraPeople,
      openTasks: open,
      weeklyHoursCapacityNow: currentCapacity,
      weeklyHoursCapacityIf: nextCapacity,
      estimatedOpenHours: workloadNow || null,
      projectedWeeksToClearQueue: projectedWeeks,
      deadlineFactor,
      kpiLift,
      uncertainty: missing.length
        ? 'High — missing operational metrics'
        : 'Medium — historical sample is small and effects are assumed linear',
    };

    const saved = await this.prisma.simulationScenario.create({
      data: {
        companyId,
        name,
        hypothesis,
        assumptions: assumptions as object,
        missingInputs: missing,
        projected: projected as object,
      },
    });
    return { scenario: saved, missing, projected, executed: false };
  }

  async attachOutcome(companyId: string, id: string, actual: object) {
    const s = await this.prisma.simulationScenario.findFirst({ where: { id, companyId } });
    if (!s) throw new Error('Scenario not found');
    return this.prisma.simulationScenario.update({
      where: { id },
      data: { actualOutcome: actual as object },
    });
  }
}
