// 項目ごとの照合（改良案②）と、本番後の「迷った行」（改良案③）で使う、カードの行の一覧。
// 自己評価の4段階の代わりに、言えた項目の割合から評価を決める。

import type { Card, Rating } from '../types';

export interface CheckItem {
  /** first:0 / call:1 / which のようなキー */
  key: string;
  text: string;
  group: 'which' | 'first' | 'call';
}

/** 想起で照合する項目：（第一声で問うたときは）どのカードか、まずやること、呼ぶ基準。 */
export function checkItems(card: Card, askedWhich: boolean): CheckItem[] {
  const out: CheckItem[] = [];
  if (askedWhich) out.push({ key: 'which', text: `どのカードか（${card.title}）`, group: 'which' });
  card.firstActions.forEach((t, i) => out.push({ key: `first:${i}`, text: t, group: 'first' }));
  card.callForHelp.criteria.forEach((t, i) => out.push({ key: `call:${i}`, text: t, group: 'call' }));
  return out;
}

/**
 * 言えた割合から評価を決める（仮。運用して直す）。
 * - 全部言えた → good（段階が上がる。3→4 は目安時間内のときだけ）
 * - 半分以上 → hard（段階は据え置き）
 * - 半分未満 → again（1段下がる）
 */
export function ratingFromChecks(checked: number, total: number): Rating {
  if (total <= 0) return 'good';
  if (checked >= total) return 'good';
  if (checked * 2 >= total) return 'hard';
  return 'again';
}

export interface MarkLine {
  key: string;
  text: string;
  group: string;
}

/** 本番の後に印を付けられる行。手順は施設の設備で置き換えた後の文を使う。 */
export function markLines(card: Card, stepTexts: string[]): MarkLine[] {
  const out: MarkLine[] = [];
  card.firstActions.forEach((t, i) => out.push({ key: `first:${i}`, text: t, group: 'まずやること' }));
  card.callForHelp.criteria.forEach((t, i) => out.push({ key: `call:${i}`, text: t, group: '呼ぶ基準' }));
  card.branches.forEach((b, i) =>
    out.push({ key: `branch:${i}`, text: `もし ${b.if} → ${b.then}${b.else ? `／そうでなければ ${b.else}` : ''}`, group: '分かれ道' }),
  );
  stepTexts.forEach((t, i) => out.push({ key: `step:${i}`, text: t, group: '手順' }));
  return out;
}

/** 第一声をひとつ選ぶ。なければ undefined（題名で問う）。 */
export function pickFirstCall(card: Card, rand: () => number = Math.random): string | undefined {
  const xs = (card.firstCalls ?? []).filter((x) => x.trim());
  if (xs.length === 0) return undefined;
  return xs[Math.floor(rand() * xs.length) % xs.length];
}
