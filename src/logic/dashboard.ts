// 学習ダッシュボードの数（改訂設計7章）。表示する数はすべて端末内の記録から数える。

import type { Card, DayLog, LearningState, Mark, MasteryLevel, Registry, Trouble } from '../types';
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

// ---- v1.2：当直で困った科、本番で迷った行 ----

export interface Count {
  id: string;
  label: string;
  n: number;
}

/** 直近 days 日に「困った」と記録した科を多い順に（同数は分野の並び順）。0件の分野は出さない。 */
export function troubleCounts(troubles: Trouble[], registry: Registry, now: number, days = 90): Count[] {
  const since = now - days * 24 * 60 * 60 * 1000;
  return registry.fields
    .map((f) => ({ id: f.id, label: f.label, n: troubles.filter((t) => t.field === f.id && t.at >= since).length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
}

export interface MarkedLine {
  cardId: string;
  line: string;
  text: string;
  n: number;
  lastAt: number;
}

/** 迷った行を、カードと行ごとにまとめる（多い順、同数は新しい順）。カードを直す候補になる。 */
export function markedLines(marks: Mark[]): MarkedLine[] {
  const by = new Map<string, MarkedLine>();
  for (const m of marks) {
    const k = `${m.cardId}|${m.line}`;
    const cur = by.get(k);
    if (cur) {
      cur.n++;
      if (m.at > cur.lastAt) {
        cur.lastAt = m.at;
        cur.text = m.text;
      }
    } else by.set(k, { cardId: m.cardId, line: m.line, text: m.text, n: 1, lastAt: m.at });
  }
  return [...by.values()].sort((a, b) => b.n - a.n || b.lastAt - a.lastAt);
}
