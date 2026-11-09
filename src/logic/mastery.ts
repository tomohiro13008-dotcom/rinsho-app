// 習熟の5段階（改訂設計3章）。
// 0 未学習 / 1 見て分かる / 2 ヒントで言える / 3 見ずに言える / 4 時間内に言える

import type { MasteryLevel, Rating } from '../types';

/** 時間内に言えたとみなす目安（仮）。カードや練習ごとの targetSeconds があればそちらを使う。 */
export const DEFAULT_TARGET_SECONDS = 30;

export const LEVEL_LABELS: Record<MasteryLevel, string> = {
  0: '未学習',
  1: '見て分かる',
  2: 'ヒントで言える',
  3: '見ずに言える',
  4: '時間内に言える',
};

/** 学習モードでの見せ方。現場モードは習熟に関係なく常に全文。 */
export type Display = 'full' | 'keywords' | 'blank' | 'blankTimed';

export function displayFor(level: MasteryLevel): Display {
  if (level <= 1) return 'full';
  if (level === 2) return 'keywords';
  if (level === 3) return 'blank';
  return 'blankTimed';
}

/**
 * 自己評価から次の段階を決める。
 * - 0（未学習）は全文を読んだだけなので、評価に関わらず 1 にする。
 * - again は1段下げる（1未満にはしない）。hard は据え置き。
 * - good / easy は1段上げる。3から4へは、目安時間内に言えたときだけ。4で時間を超えたら3に戻す。
 */
export function nextLevel(
  level: MasteryLevel,
  rating: Rating,
  seconds: number,
  targetSeconds: number = DEFAULT_TARGET_SECONDS,
): MasteryLevel {
  if (level === 0) return 1;
  if (rating === 'again') return Math.max(1, level - 1) as MasteryLevel;
  if (rating === 'hard') return level;
  if (level < 3) return (level + 1) as MasteryLevel;
  return seconds <= targetSeconds ? 4 : 3;
}

/** 「見ずに言える」とみなす段階 */
export function isMastered(level: MasteryLevel): boolean {
  return level >= 3;
}
