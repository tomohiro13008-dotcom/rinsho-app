// 学習ダッシュボードの数（改訂設計7章）。表示する数はすべて端末内の記録から数える。

import type { Card, DayLog, LearningState, MasteryLevel, Registry } from '../types';
import { isMastered } from './mastery';
import { startOfMonth } from './time';

/** ある時刻の時点での段階（その時刻より前の最後の記録の levelAfter）。 */
export function levelAt(st: LearningState | undefined, t: number): MasteryLevel {
  if (!st) return 0;
  let lv: MasteryLevel = 0;
  for (const h of st.history) {
    if (h.at < t) lv = h.levelAfter;
    else break;
  }
  return lv;
}

export function masteredCount(cards: Card[], learning: Map<string, LearningState>, t?: number): number {
  return cards.filter((c) => {
    const st = learning.get(c.id);
    const lv = t === undefined ? st?.level ?? 0 : levelAt(st, t);
    return isMastered(lv);
  }).length;
}

/** 前月末の時点（今月1日0時より前）で見ずに言えたカードの数 */
export function masteredLastMonth(cards: Card[], learning: Map<string, LearningState>, now: number): number {
  return masteredCount(cards, learning, startOfMonth(now));
}

export interface EmptyDays {
  days: number;
  empty: number;
}

export function emptyDayRatio(days: DayLog[]): EmptyDays {
  return { days: days.length, empty: days.filter((d) => d.firstQueueSize === 0).length };
}

export interface Bar {
  id: string;
  label: string;
  total: number;
  mastered: number;
}

/** 状態別の習熟バー（registry の並び＝命に関わる順）。カードのない状態も 0/0 で出す。 */
export function barsByState(cards: Card[], learning: Map<string, LearningState>, registry: Registry): Bar[] {
  return registry.states.map((s) => {
    const cs = cards.filter((c) => c.states.includes(s.id));
    return { id: s.id, label: s.label, total: cs.length, mastered: cs.filter((c) => isMastered(learning.get(c.id)?.level ?? 0)).length };
  });
}

export function barsByScene(cards: Card[], learning: Map<string, LearningState>, registry: Registry): Bar[] {
  return registry.scenes.map((s) => {
    const cs = cards.filter((c) => c.scenes.includes(s.id));
    return { id: s.id, label: s.label, total: cs.length, mastered: cs.filter((c) => isMastered(learning.get(c.id)?.level ?? 0)).length };
  });
}
