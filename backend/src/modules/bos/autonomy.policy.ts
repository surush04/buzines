import { AiAutonomyLevel } from '@prisma/client';

export type SideEffectKind =
  | 'diagnose'
  | 'recommend'
  | 'notify'
  | 'create_task'
  | 'reassign'
  | 'external'
  | 'delete'
  | 'money';

const CRITICAL: SideEffectKind[] = ['external', 'delete', 'money'];

export function canAiPerform(
  level: AiAutonomyLevel,
  kind: SideEffectKind,
  opts: { paused: boolean; allowExternal: boolean; humanApproved?: boolean },
): { ok: boolean; reason: string } {
  if (opts.paused && kind !== 'diagnose' && kind !== 'recommend') {
    return { ok: false, reason: 'AI side effects are paused' };
  }
  if (CRITICAL.includes(kind)) {
    return { ok: false, reason: 'Critical actions require explicit human authorization' };
  }
  if (kind === 'external' && !opts.allowExternal) {
    return { ok: false, reason: 'External actions are disabled' };
  }
  const readOnly = kind === 'diagnose' || kind === 'recommend';
  if (readOnly) return { ok: true, reason: 'read' };

  switch (level) {
    case AiAutonomyLevel.OBSERVER:
      return { ok: false, reason: 'OBSERVE_ONLY cannot execute actions' };
    case AiAutonomyLevel.ADVISOR:
      return kind === 'notify'
        ? { ok: true, reason: 'advisory_notify' }
        : { ok: false, reason: 'ADVISORY cannot create operational side effects' };
    case AiAutonomyLevel.GUIDED_AUTONOMY:
      if (opts.humanApproved) return { ok: true, reason: 'human_approved' };
      return { ok: false, reason: 'APPROVAL_REQUIRED' };
    case AiAutonomyLevel.FULL_AUTONOMY:
      return kind === 'create_task' || kind === 'notify' || kind === 'reassign'
        ? { ok: true, reason: 'controlled_autonomy_low_risk' }
        : { ok: false, reason: 'Controlled autonomy does not allow this action' };
    default:
      return { ok: false, reason: 'Unknown autonomy level' };
  }
}
