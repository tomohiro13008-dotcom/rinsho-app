import { describe, expect, it } from 'vitest';
import { buildTodayQueue, countUnreviewedField } from '../../src/logic/queue';
import { HOUR, DAY } from '../../src/logic/time';
import type { LearningState, Lookup } from '../../src/types';
import { T0, card, practiced } from './fixtures';

const cards = [card('a', { common: true }), card('b'), card('c'), card('d')];
const none = new Map<string, LearningState>();

describe('今日の想起', () => {
  it('現場で引いて8時間未満のカードは並ばず、8時間以上で並ぶ', () => {
    const lookups: Lookup[] = [{ cardId: 'c', at: T0, mode: 'field' }];
    const before = buildTodayQueue({ cards, learning: none, lookups, now: T0 + 8 * HOUR - 1 });
    expect(before.find((q) => q.cardId === 'c')).toBeUndefined();
    const after = buildTodayQueue({ cards, learning: none, lookups, now: T0 + 8 * HOUR });
    expect(after[0]).toMatchObject({ cardId: 'c', source: 'field', lookupAt: T0 });
  });

  it('引いた記録がない日でも、未練習の順送りで1枚並ぶ（空にならない）', () => {
    const q = buildTodayQueue({ cards, learning: none, lookups: [], now: T0 });
    expect(q).toEqual([{ cardId: 'a', source: 'new' }]);
  });

  it('順送りは1日1枚。今日1枚始めたら、その日はもう出さない', () => {
    const learning = new Map([['a', practiced('a', T0 + HOUR, 1, T0 + DAY, 'new')]]);
    expect(buildTodayQueue({ cards, learning, lookups: [], now: T0 + 2 * HOUR })).toEqual([]);
    // 翌日は次の未練習カード（a は期日の来た復習として出る）
    const next = buildTodayQueue({ cards, learning, lookups: [], now: T0 + DAY + HOUR });
    expect(next).toEqual([
      { cardId: 'a', source: 'review' },
      { cardId: 'b', source: 'new' },
    ]);
  });

  it('並び順は 現場 → ブリーフィング → 復習 → 順送り', () => {
    const learning = new Map([['d', practiced('d', T0 - 3 * DAY, 2, T0 - DAY)]]);
    const lookups: Lookup[] = [
      { cardId: 'b', at: T0 - 10 * HOUR, mode: 'briefing' },
      { cardId: 'c', at: T0 - 9 * HOUR, mode: 'field' },
    ];
    const q = buildTodayQueue({ cards, learning, lookups, now: T0 });
    expect(q.map((x) => `${x.cardId}:${x.source}`)).toEqual(['c:field', 'b:briefing', 'd:review', 'a:new']);
  });

  it('引いたあとに練習したカードは並ばない。同じカードは1回だけ', () => {
    const lookups: Lookup[] = [
      { cardId: 'c', at: T0 - 20 * HOUR, mode: 'field' },
      { cardId: 'c', at: T0 - 12 * HOUR, mode: 'field' },
    ];
    const q1 = buildTodayQueue({ cards, learning: none, lookups, now: T0 });
    expect(q1.filter((x) => x.cardId === 'c')).toHaveLength(1);
    const learning = new Map([['c', practiced('c', T0 - 11 * HOUR, 1, T0 + 5 * DAY)]]);
    const q2 = buildTodayQueue({ cards, learning, lookups, now: T0 });
    expect(q2.find((x) => x.cardId === 'c')).toBeUndefined();
  });

  it('未復習の数は8時間未満も含めて数える', () => {
    const lookups: Lookup[] = [
      { cardId: 'b', at: T0, mode: 'field' },
      { cardId: 'c', at: T0, mode: 'briefing' },
    ];
    expect(countUnreviewedField(lookups, none)).toBe(1);
  });

  it('知らないカード id の記録は無視する', () => {
    const q = buildTodayQueue({ cards, learning: none, lookups: [{ cardId: 'zzz', at: 0, mode: 'field' }], now: T0 });
    expect(q.map((x) => x.cardId)).toEqual(['a']);
  });
});
