// 施設プロフィールとカード内の分岐（改訂設計5章）。

import type { FacilityProfile, Registry, Step } from '../types';

export function presetSwitches(registry: Registry, tier: string): Record<string, boolean> {
  const on = new Set(registry.tierPresets[tier] ?? []);
  const out: Record<string, boolean> = {};
  for (const eq of registry.equipment) out[eq.id] = on.has(eq.id);
  return out;
}

export function newProfile(registry: Registry, tier: string, name: string): FacilityProfile {
  return {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    tier,
    switches: presetSwitches(registry, tier),
    notes: '',
    contacts: '',
  };
}

export interface ResolvedStep {
  text: string;
  /** この施設に無い設備（registry の id） */
  missing: string[];
  /** ifMissing の行に切り替えたか */
  replaced: boolean;
  step: Step;
}

/** 設備がそろっていれば元の行、欠けていれば ifMissing の行を返す。 */
export function resolveStep(step: Step, switches: Record<string, boolean>): ResolvedStep {
  const missing = (step.requires ?? []).filter((id) => !switches[id]);
  if (missing.length === 0) return { text: step.text, missing, replaced: false, step };
  return { text: step.ifMissing ?? step.text, missing, replaced: step.ifMissing !== undefined, step };
}
