export const WORKFLOW_TRIGGERS = [
  'TASK_CREATED',
  'TASK_STATUS_CHANGED',
  'TASK_DEADLINE_APPROACHING',
  'TASK_OVERDUE',
  'COMPLETION_SUBMITTED',
  'COMPLETION_REJECTED',
  'GOAL_PROGRESS_CHANGED',
  'APPROVAL_REQUESTED',
  'EMPLOYEE_OVERLOADED',
  'SCHEDULED_TIME',
] as const;

export const WORKFLOW_ACTIONS = [
  'CREATE_TASK',
  'ASSIGN_TASK',
  'NOTIFY',
  'REQUEST_APPROVAL',
  'ESCALATE',
  'GENERATE_DIAGNOSIS',
  'FOLLOW_UP_REMINDER',
] as const;

export type WorkflowTrigger = (typeof WORKFLOW_TRIGGERS)[number];
export type WorkflowActionType = (typeof WORKFLOW_ACTIONS)[number];

export type WorkflowCondition = {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: unknown;
};

export type WorkflowAction = {
  type: string;
  config?: Record<string, unknown>;
};

export type WorkflowContext = Record<string, unknown>;

const ALLOWED_FIELDS = new Set([
  'task.priority',
  'task.status',
  'task.projectId',
  'task.assigneeId',
  'task.hoursOverdue',
  'goal.progress',
  'employee.openHours',
  'employee.available',
  'approval.status',
  'companyId',
]);

export function isAllowedTrigger(t: string): t is WorkflowTrigger {
  return (WORKFLOW_TRIGGERS as readonly string[]).includes(t);
}

export function isAllowedAction(t: string): t is WorkflowActionType {
  return (WORKFLOW_ACTIONS as readonly string[]).includes(t);
}

export function validateWorkflowShape(input: {
  triggerType: string;
  conditions: unknown;
  actions: unknown;
}): string[] {
  const errors: string[] = [];
  if (!isAllowedTrigger(input.triggerType)) errors.push('Invalid trigger');
  const conditions = Array.isArray(input.conditions) ? input.conditions : [];
  const actions = Array.isArray(input.actions) ? input.actions : [];
  if (!actions.length) errors.push('At least one action is required');
  for (const c of conditions) {
    const cond = c as WorkflowCondition;
    if (!cond?.field || !ALLOWED_FIELDS.has(cond.field)) errors.push(`Invalid condition field: ${cond?.field}`);
    if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'].includes(cond?.op)) errors.push('Invalid condition operator');
  }
  for (const a of actions) {
    const act = a as WorkflowAction;
    if (!isAllowedAction(act?.type)) errors.push(`Invalid action: ${act?.type}`);
  }
  return errors;
}

function readPath(ctx: WorkflowContext, field: string): unknown {
  return field.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, ctx);
}

export function matchCondition(cond: WorkflowCondition, ctx: WorkflowContext): boolean {
  const left = readPath(ctx, cond.field);
  const right = cond.value;
  switch (cond.op) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    case 'in':
      return Array.isArray(right) && right.includes(left);
    default:
      return false;
  }
}

export function matchAllConditions(conditions: WorkflowCondition[], ctx: WorkflowContext): boolean {
  if (!conditions.length) return true;
  return conditions.every((c) => matchCondition(c, ctx));
}

export function wouldLoop(recentWorkflowIds: string[], workflowId: string, maxRepeats = 3): boolean {
  const count = recentWorkflowIds.filter((id) => id === workflowId).length;
  return count >= maxRepeats;
}
