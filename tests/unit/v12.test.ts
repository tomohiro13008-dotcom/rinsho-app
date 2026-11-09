import { describe, expect, it } from 'vitest';
import { buildTodayQueue } from '../../src/logic/queue';
import { checkItems, markLines, pickFirstCall, ratingFromChecks } from '../../src/logic/checklist';
import { markedLines, troubleCounts } from '../../src/logic/dashboard';
import { HOUR, DAY } from '../../src/logic/time';
import type { LearningState, Lookup, Mark } from '../../src/types';
import { T0, card, practiced, registry } from './fixtures';

const none = new Map<string, LearningState>();

describe('①看護師の第一声で問う', () => {
  it('第一声があればその中から選び、なければ undefined（題名で問う）', () => {
    const c = card('x', { firstCalls: ['一つ目', '二つ目'] });
    expect(pickFirstCall(c, () => 0)).toBe('一つ目');
    expect(pickFirstCall(c, () => 0.99)).toBe('二つ目');
    expect(pickFirstCall(card('y'))).toBeUndefined();
    expect(pickFirstCall(card('z', { firstCalls: ['  '] }))).toBeUndefined();
  });

  it('第一声で問うときは「どのカードか」を照合の最初の項目にする', () => {
    const c = card('x', { title: '心停止', firstActions: ['A', 'B'], callForHelp: { criteria: ['C'] } });
    expect(checkItems(c, true).map((i) => i.key)).toEqual(['which', 'first:0', 'first:1', 'call:0']);
    expect(checkItems(c, false).map((i) => i.key)).toEqual(['first:0', 'first:1', 'call:0']);
  });
});

describe('②項目ごとの照合から評価を決める', () => {
  it('全部 → good、半分以上 → hard、半分未満 → again', () => {
    expect(ratingFromChecks(4, 4)).toBe('good');
    expect(ratingFromChecks(2, 4)).toBe('hard');
    expect(ratingFromChecks(3, 5)).toBe('hard');
    expect(ratingFromChecks(1, 4)).toBe('again');
    expect(ratingFromChecks(0, 3)).toBe('again');
  });
  it('項目がないカードは good（照合できないので段階を下げない）', () => {
    expect(ratingFromChecks(0, 0)).toBe('good');
  });
});

describe('③迷った行の印', () => {
  const cards = [card('a', { common: true }), card('b'), card('c')];

  it('印を付けて8時間たつと、現場の記録より先に並ぶ', () => {
    const marks: Mark[] = [{ cardId: 'c', line: 'step:0', text: '手順1', at: T0 - 9 * HOUR }];
    const lookups: Lookup[] = [{ cardId: 'b', at: T0 - 10 * HOUR, mode: 'field' }];
    const q = buildTodayQueue({ cards, learning: none, lookups, marks, now: T0 });
    expect(q.slice(0, 2).map((x) => `${x.cardId}:${x.source}`)).toEqual(['c:marked', 'b:field']);
  });

  it('8時間未満の印、練習した後の印は並ばない', () => {
    const marks: Mark[] = [{ cardId: 'c', line: 'first:0', text: 'x', at: T0 - HOUR }];
    expect(buildTodayQueue({ cards, learning: none, lookups: [], marks, now: T0 }).find((x) => x.source === 'marked')).toBeUndefined();
    const old: Mark[] = [{ cardId: 'c', line: 'first:0', text: 'x', at: T0 - 2 * DAY }];
    const learning = new Map([['c', practiced('c', T0 - DAY, 2, T0 + 5 * DAY)]]);
    expect(buildTodayQueue({ cards, learning, lookups: [], marks: old, now: T0 }).find((x) => x.cardId === 'c')).toBeUndefined();
  });

  it('同じカードに印と現場の記録があれば、印として1回だけ並ぶ', () => {
    const marks: Mark[] = [{ cardId: 'b', line: 'call:0', text: 'x', at: T0 - 9 * HOUR }];
    const lookups: Lookup[] = [{ cardId: 'b', at: T0 - 9.5 * HOUR, mode: 'field' }];
    const q = buildTodayQueue({ cards, learning: none, lookups, marks, now: T0 }).filter((x) => x.cardId === 'b');
    expect(q).toEqual([{ cardId: 'b', source: 'marked', lookupAt: T0 - 9 * HOUR }]);
  });

  it('印を付けられる行は、まずやること・呼ぶ基準・分かれ道・手順', () => {
    const c = card('x', { firstActions: ['A'], callForHelp: { criteria: ['B'] }, branches: [{ if: 'P', then: 'Q' }] });
    expect(markLines(c, ['S1']).map((l) => l.key)).toEqual(['first:0', 'call:0', 'branch:0', 'step:0']);
  });

  it('迷った行は、カードと行ごとに多い順にまとめ、文は新しい印のものを使う', () => {
    const marks: Mark[] = [
      { cardId: 'b', line: 'step:1', text: '古い文', at: T0 },
      { cardId: 'c', line: 'first:0', text: 'y', at: T0 + 2 },
      { cardId: 'b', line: 'step:1', text: '新しい文', at: T0 + 1 },
    ];
    const out = markedLines(marks);
    expect(out[0]).toMatchObject({ cardId: 'b', line: 'step:1', n: 2, text: '新しい文' });
    expect(out[1]).toMatchObject({ cardId: 'c', n: 1 });
  });
});

describe('④当直で困った科', () => {
  it('直近90日を多い順に数え、0件の分野は出さない', () => {
    const [f1, f2] = registry.fields;
    const troubles = [
      { field: f2.id, at: T0 },
      { field: f2.id, at: T0 - DAY },
      { field: f1.id, at: T0 },
      { field: f1.id, at: T0 - 100 * DAY },
    ];
    expect(troubleCounts(troubles, registry, T0).map((c) => [c.id, c.n])).toEqual([
      [f2.id, 2],
      [f1.id, 1],
    ]);
  });
});
