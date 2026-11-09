// 「今日の想起」の並び（改訂設計3章・13章）。
// 燃料は三つをこの順で並べる：
//   1. 現場で引いて（または当直前ブリーフィングで開いて）から8時間以上たち、その後まだ練習していないカード
//   2. 期日の来た復習
//   3. まだ一度も練習していないカードの順送り（1日1枚）
// 今日すでに練習したカードは並べない（1と2は練習すると消える。3は1日1枚まで）。

import type { Card, LearningState, Lookup, QueueSource } from '../types';
import { RECALL_DELAY_MS, startOfDay } from './time';

export interface QueueItem {
  cardId: string;
  source: Exclude<QueueSource, 'manual'>;
  /** field / briefing のとき、元になった記録の時刻 */
  lookupAt?: number;
}

export interface QueueInput {
  /** 並べる順（共通カード→状態の命に関わる順）にそろえたカード */
  cards: Card[];
  learning: Map<string, LearningState>;
  lookups: Lookup[];
  now: number;
  newPerDay?: number;
}

function lastPracticeAt(st: LearningState | undefined): number {
  if (!st || st.history.length === 0) return -Infinity;
  return st.history[st.history.length - 1].at;
}

export function buildTodayQueue({ cards, learning, lookups, now, newPerDay = 1 }: QueueInput): QueueItem[] {
  const known = new Set(cards.map((c) => c.id));
  const today = startOfDay(now);
  const out: QueueItem[] = [];
  const used = new Set<string>();
  const practicedToday = (id: string) => lastPracticeAt(learning.get(id)) >= today;

  // 1. 現場・ブリーフィングの記録（現場を先に、それぞれ古い順）
  const ripe = lookups
    .filter((l) => known.has(l.cardId) && now - l.at >= RECALL_DELAY_MS)
    .filter((l) => lastPracticeAt(learning.get(l.cardId)) < l.at)
    .sort((a, b) => (a.mode === b.mode ? a.at - b.at : a.mode === 'field' ? -1 : 1));
  for (const l of ripe) {
    if (used.has(l.cardId) || practicedToday(l.cardId)) continue;
    used.add(l.cardId);
    out.push({ cardId: l.cardId, source: l.mode, lookupAt: l.at });
  }

  // 2. 期日の来た復習（期日の古い順）
  const due = [...learning.values()]
    .filter((s) => known.has(s.cardId) && s.due !== null && s.due <= now && s.history.length > 0)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  for (const s of due) {
    if (used.has(s.cardId) || practicedToday(s.cardId)) continue;
    used.add(s.cardId);
    out.push({ cardId: s.cardId, source: 'review' });
  }

  // 3. 未練習の順送り。今日すでに順送りで始めた枚数を差し引く。
  let introducedToday = 0;
  for (const s of learning.values()) {
    const first = s.history[0];
    if (first && first.at >= today && first.source === 'new') introducedToday++;
  }
  let slots = Math.max(0, newPerDay - introducedToday);
  for (const c of cards) {
    if (slots <= 0) break;
    const st = learning.get(c.id);
    if (st && st.history.length > 0) continue;
    if (used.has(c.id)) continue;
    used.add(c.id);
    out.push({ cardId: c.id, source: 'new' });
    slots--;
  }
  return out;
}

/** 現場で引いたが、まだ想起していないカードの数（8時間未満も含む）。 */
export function countUnreviewedField(lookups: Lookup[], learning: Map<string, LearningState>): number {
  const ids = new Set<string>();
  for (const l of lookups) {
    if (l.mode !== 'field') continue;
    if (lastPracticeAt(learning.get(l.cardId)) < l.at) ids.add(l.cardId);
  }
  return ids.size;
}
