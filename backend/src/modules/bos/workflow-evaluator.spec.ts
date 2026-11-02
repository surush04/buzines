import {
  isAllowedTrigger,
  matchAllConditions,
  validateWorkflowShape,
  wouldLoop,
} from './workflow-evaluator';

describe('workflow-evaluator', () => {
  it('rejects unknown triggers and javascript actions', () => {
    expect(isAllowedTrigger('TASK_OVERDUE')).toBe(true);
    expect(isAllowedTrigger('eval()')).toBe(false);
    const errors = validateWorkflowShape({
      triggerType: 'TASK_OVERDUE',
      conditions: [{ field: 'task.status', op: 'eq', value: 'OVERDUE' }],
      actions: [{ type: 'RUN_SQL' }],
    });
    expect(errors.some((e) => e.includes('Invalid action'))).toBe(true);
  });

  it('matches overdue incomplete tasks', () => {
    const ok = matchAllConditions(
      [
        { field: 'task.status', op: 'neq', value: 'COMPLETED' },
        { field: 'task.hoursOverdue', op: 'gte', value: 2 },
      ],
      { task: { status: 'OVERDUE', hoursOverdue: 2 } },
    );
    expect(ok).toBe(true);
  });

  it('prevents loops after 3 repeats', () => {
    expect(wouldLoop(['a', 'a', 'a'], 'a')).toBe(true);
    expect(wouldLoop(['a', 'b'], 'a')).toBe(false);
  });
});
