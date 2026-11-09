import { describe, expect, it } from 'vitest';
import { simpleScheduler } from '../../src/logic/srs';
import { displayFor, nextLevel } from '../../src/logic/mastery';
import { DAY, startOfDay } from '../../src/logic/time';
import { T0 } from './fixtures';

describe('間隔反復（simple-v0）', () => {
  it('again は翌日、good は伸び、easy はもっと伸びる', () => {
    expect(simpleScheduler.next(0, 'again', T0)).toEqual({ intervalDays: 1, due: startOfDay(T0) + DAY });
    expect(simpleScheduler.next(0, 'good', T0).intervalDays).toBe(1);
    expect(simpleScheduler.next(1, 'good', T0).intervalDays).toBe(3);
    expect(simpleScheduler.next(3, 'good', T0).intervalDays).toBe(6);
    expect(simpleScheduler.next(3, 'easy', T0).intervalDays).toBe(9);
    expect(simpleScheduler.next(5, 'hard', T0).intervalDays).toBe(6);
  });
  it('上限は180日', () => {
    expect(simpleScheduler.next(150, 'easy', T0).intervalDays).toBe(180);
  });
});

describe('習熟の段階', () => {
  it('未学習は読んだら1になる', () => {
    expect(nextLevel(0, 'again', 99)).toBe(1);
    expect(nextLevel(0, 'easy', 1)).toBe(1);
  });
  it('good で1段上がり、again で1段下がる（1未満にならない）', () => {
    expect(nextLevel(1, 'good', 50)).toBe(2);
    expect(nextLevel(2, 'good', 50)).toBe(3);
    expect(nextLevel(2, 'again', 5)).toBe(1);
    expect(nextLevel(1, 'again', 5)).toBe(1);
    expect(nextLevel(2, 'hard', 5)).toBe(2);
  });
  it('3から4は目安時間内のときだけ。4で時間を超えたら3', () => {
    expect(nextLevel(3, 'good', 31)).toBe(3);
    expect(nextLevel(3, 'good', 30)).toBe(4);
    expect(nextLevel(4, 'good', 40)).toBe(3);
    expect(nextLevel(4, 'easy', 10)).toBe(4);
  });
  it('表示は 全文 → キーワード → 空欄 → 空欄＋時間', () => {
    expect([0, 1, 2, 3, 4].map((l) => displayFor(l as 0))).toEqual(['full', 'full', 'keywords', 'blank', 'blankTimed']);
  });
});
