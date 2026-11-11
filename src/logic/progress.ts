// 目次に出す「進み具合」と印（v1.3）。保存しているのは手で付けた印（flags）と開いた記録（views）だけで、
// 「苦手」「要復習」の自動の分は、いまある学習の記録（learning・lookups・marks・drillLogs）から毎回求める。
// 同じことを二重に持たないため。

import type { Card, DrillLog, Drug, Flag, ItemKind, LearningState, Lookup, Mark, Specialty, Topic, View } from '../types';
import { LEVEL_LABELS, isMastered } from './mastery';

export const itemKey = (kind: ItemKind, id: string) => `${kind}:${id}`;

export interface ProgressInput {
  learning: Map<string, LearningState>;
  lookups: Lookup[];
  marks: Mark[];
  drillLogs: DrillLog[];
  flags: Map<string, Flag>;
  views: Map<string, View>;
  now: number;
}

export interface ItemStatus {
  key: string;
  /** 一度でも開いた・練習した */
  seen: boolean;
  /** 身についた（カード：見ずに言える。参照：確認問題を全部言えた）。薬と科は測らない */
  done: boolean;
  important: boolean;
  /** 苦手：手で付けた印、または記録から（直近で言えなかった） */
  weak: boolean;
  weakAuto: boolean;
  /** 要復習：手で付けた印、または記録から（期日・現場で引いた後・あやしい問い） */
  review: boolean;
  reviewAuto: boolean;
  /** 手で付けた「苦手」「要復習」が生きているか（ボタンの押された状態） */
  weakManual: boolean;
  reviewManual: boolean;
  /** 一行の状況 */
  note: string;
}

const lastPracticeAt = (st: LearningState | undefined) => st?.history.at(-1)?.at ?? -Infinity;

/** カードの要復習の印は、付けたあとに練習すると消える（今日の想起に並び、練習で役目を終える）。 */
export function manualReviewActive(kind: ItemKind, flag: Flag | undefined, st?: LearningState): boolean {
  if (!flag?.reviewAt) return false;
  return kind === 'card' ? lastPracticeAt(st) < flag.reviewAt : true;
}

export function cardStatus(c: Card, d: ProgressInput): ItemStatus {
  const key = itemKey('card', c.id);
  const st = d.learning.get(c.id);
  const flag = d.flags.get(key);
  const last = st?.history.at(-1);
  const lastAt = lastPracticeAt(st);
  const practiced = (st?.history.length ?? 0) > 0;
  const due = practiced && st!.due !== null && st!.due <= d.now;
  const pending = d.lookups.some((l) => l.cardId === c.id && l.at > lastAt) || d.marks.some((m) => m.cardId === c.id && m.at > lastAt);
  const weakAuto = last?.result === 'again';
  const reviewAuto = due || pending;
  const reviewManual = manualReviewActive('card', flag, st);
  const level = st?.level ?? 0;
  const note = [LEVEL_LABELS[level], pending ? '引いたあと未練習' : due ? '復習の期日' : ''].filter(Boolean).join('・');
  return {
    key,
    seen: practiced || d.lookups.some((l) => l.cardId === c.id),
    done: isMastered(level),
    important: !!flag?.important,
    weak: !!flag?.weak || weakAuto,
    weakAuto,
    review: reviewManual || reviewAuto,
    reviewAuto,
    weakManual: !!flag?.weak,
    reviewManual,
    note,
  };
}

/** 確認問題ごとの、いちばん新しい答え */
export function latestQuiz(t: Topic, logs: DrillLog[]): Map<string, DrillLog> {
  const prefix = `topic:${t.id}:`;
  const out = new Map<string, DrillLog>();
  for (const l of logs) {
    if (!l.drillId.startsWith(prefix)) continue;
    const sec = l.drillId.slice(prefix.length);
    const cur = out.get(sec);
    if (!cur || l.at >= cur.at) out.set(sec, l);
  }
  return out;
}

export function topicStatus(t: Topic, d: ProgressInput): ItemStatus {
  const key = itemKey('topic', t.id);
  const flag = d.flags.get(key);
  const qs = t.sections.filter((s) => s.question && s.answer);
  const latest = latestQuiz(t, d.drillLogs);
  const results = qs.map((s) => latest.get(s.id)?.result);
  const answered = results.filter(Boolean).length;
  const good = results.filter((r) => r === 'good' || r === 'easy').length;
  const weakAuto = results.some((r) => r === 'again');
  const reviewAuto = results.some((r) => r === 'again' || r === 'hard');
  const seen = d.views.has(key) || answered > 0;
  const note = [seen ? '読んだ' : 'まだ', qs.length ? `問い ${good}/${qs.length}` : ''].filter(Boolean).join('・');
  return {
    key,
    seen,
    done: qs.length > 0 && good === qs.length,
    important: !!flag?.important,
    weak: !!flag?.weak || weakAuto,
    weakAuto,
    review: manualReviewActive('topic', flag) || reviewAuto,
    reviewAuto,
    weakManual: !!flag?.weak,
    reviewManual: manualReviewActive('topic', flag),
    note,
  };
}

/** 薬と科：開いたかどうかと、手で付けた印だけ */
export function plainStatus(kind: 'drug' | 'spec', id: string, d: ProgressInput): ItemStatus {
  const key = itemKey(kind, id);
  const flag = d.flags.get(key);
  const seen = d.views.has(key);
  return {
    key,
    seen,
    done: false,
    important: !!flag?.important,
    weak: !!flag?.weak,
    weakAuto: false,
    review: manualReviewActive(kind, flag),
    reviewAuto: false,
    weakManual: !!flag?.weak,
    reviewManual: manualReviewActive(kind, flag),
    note: seen ? '開いた' : 'まだ',
  };
}

export type TocFilter = 'all' | 'important' | 'weak' | 'review' | 'unseen';

export const matchesFilter = (s: ItemStatus, f: TocFilter) =>
  f === 'all' || (f === 'important' && s.important) || (f === 'weak' && s.weak) || (f === 'review' && s.review) || (f === 'unseen' && !s.seen);

export interface Overview {
  cards: { total: number; seen: number; mastered: number };
  topics: { total: number; seen: number; questions: number; questionsGood: number };
  drugs: { total: number; seen: number };
  specs: { total: number; seen: number };
  counts: Record<Exclude<TocFilter, 'all'>, number>;
}

export function overview(content: { cards: Card[]; topics: Topic[]; drugs: Drug[]; specialties: Specialty[] }, d: ProgressInput): Overview {
  const cs = content.cards.map((c) => cardStatus(c, d));
  const ts = content.topics.map((t) => topicStatus(t, d));
  const ds = content.drugs.map((x) => plainStatus('drug', x.id, d));
  const ss = content.specialties.map((x) => plainStatus('spec', x.id, d));
  const all = [...cs, ...ts, ...ds, ...ss];
  let questions = 0;
  let questionsGood = 0;
  for (const t of content.topics) {
    const latest = latestQuiz(t, d.drillLogs);
    for (const s of t.sections) {
      if (!s.question || !s.answer) continue;
      questions++;
      const r = latest.get(s.id)?.result;
      if (r === 'good' || r === 'easy') questionsGood++;
    }
  }
  const n = (f: (s: ItemStatus) => boolean) => all.filter(f).length;
  return {
    cards: { total: cs.length, seen: cs.filter((s) => s.seen).length, mastered: cs.filter((s) => s.done).length },
    topics: { total: ts.length, seen: ts.filter((s) => s.seen).length, questions, questionsGood },
    drugs: { total: ds.length, seen: ds.filter((s) => s.seen).length },
    specs: { total: ss.length, seen: ss.filter((s) => s.seen).length },
    counts: { important: n((s) => s.important), weak: n((s) => s.weak), review: n((s) => s.review), unseen: n((s) => !s.seen) },
  };
}

/** 今日の想起に渡す：重要の印が付いたカードと、要復習の印が生きているカード */
export function cardFlagsForQueue(flags: Map<string, Flag>, learning: Map<string, LearningState>): { important: Set<string>; review: Map<string, number> } {
  const important = new Set<string>();
  const review = new Map<string, number>();
  for (const f of flags.values()) {
    if (!f.key.startsWith('card:')) continue;
    const id = f.key.slice(5);
    if (f.important) important.add(id);
    if (manualReviewActive('card', f, learning.get(id))) review.set(id, f.reviewAt!);
  }
  return { important, review };
}
