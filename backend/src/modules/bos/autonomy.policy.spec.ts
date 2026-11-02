import { AiAutonomyLevel } from '@prisma/client';
import { canAiPerform } from './autonomy.policy';

describe('autonomy policy', () => {
  it('observer cannot create tasks', () => {
    const r = canAiPerform(AiAutonomyLevel.OBSERVER, 'create_task', {
      paused: false,
      allowExternal: false,
    });
    expect(r.ok).toBe(false);
  });

  it('guided requires human approval for tasks', () => {
    const blocked = canAiPerform(AiAutonomyLevel.GUIDED_AUTONOMY, 'create_task', {
      paused: false,
      allowExternal: false,
    });
    const approved = canAiPerform(AiAutonomyLevel.GUIDED_AUTONOMY, 'create_task', {
      paused: false,
      allowExternal: false,
      humanApproved: true,
    });
    expect(blocked.ok).toBe(false);
    expect(approved.ok).toBe(true);
  });

  it('pause blocks side effects but not diagnose', () => {
    const task = canAiPerform(AiAutonomyLevel.FULL_AUTONOMY, 'create_task', {
      paused: true,
      allowExternal: false,
    });
    const diag = canAiPerform(AiAutonomyLevel.FULL_AUTONOMY, 'diagnose', {
      paused: true,
      allowExternal: false,
    });
    expect(task.ok).toBe(false);
    expect(diag.ok).toBe(true);
  });

  it('never allows money or delete', () => {
    const money = canAiPerform(AiAutonomyLevel.FULL_AUTONOMY, 'money', {
      paused: false,
      allowExternal: true,
      humanApproved: true,
    });
    expect(money.ok).toBe(false);
  });
});
