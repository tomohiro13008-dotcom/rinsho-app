import { describe, expect, it } from 'vitest';
import { presetSwitches, resolveStep } from '../../src/logic/facility';
import { barsByState, emptyDayRatio, levelAt, masteredCount, masteredLastMonth } from '../../src/logic/dashboard';
import { sortCards } from '../../src/logic/order';
import type { LearningState, Step } from '../../src/types';
import { T0, card, registry } from './fixtures';

describe('施設とカード内の分岐', () => {
  it('段階プリセットで全設備のスイッチが決まる', () => {
    const sw = presetSwitches(registry, 'clinic');
    expect(Object.keys(sw)).toHaveLength(registry.equipment.length);
    expect(sw.aed).toBe(true);
    expect(sw.ventilator).toBe(false);
  });
  it('設備がなければ ifMissing の行に切り替わる', () => {
    const step: Step = { text: '使う', kind: 'equipment', requires: ['aed'], ifMissing: '呼ぶ' };
    expect(resolveStep(step, { aed: true })).toMatchObject({ text: '使う', replaced: false });
    expect(resolveStep(step, { aed: false })).toMatchObject({ text: '呼ぶ', replaced: true, missing: ['aed'] });
  });
});

describe('ダッシュボードの数', () => {
  const cards = [card('a'), card('b', { states: ['dyspnea'] })];
  const st: LearningState = {
    cardId: 'a',
    level: 3,
    intervalDays: 3,
    due: null,
    history: [
      { at: new Date(2026, 9, 20).getTime(), result: 'good', seconds: 20, levelAfter: 2, source: 'new' },
      { at: new Date(2026, 10, 5).getTime(), result: 'good', seconds: 20, levelAfter: 3, source: 'review' },
    ],
  };
  const learning = new Map([['a', st]]);
  it('いまと前月末の「見ずに言える」数', () => {
    expect(masteredCount(cards, learning)).toBe(1);
    expect(masteredLastMonth(cards, learning, T0)).toBe(0);
    expect(levelAt(st, new Date(2026, 10, 1).getTime())).toBe(2);
  });
  it('状態別のバーは registry の並び（命に関わる順）で全状態を出す', () => {
    const bars = barsByState(cards, learning, registry);
    expect(bars.map((b) => b.id)).toEqual(registry.states.map((s) => s.id));
    expect(bars[0]).toMatchObject({ id: 'arrest', total: 1, mastered: 1 });
    expect(bars[2]).toMatchObject({ total: 0 });
  });
  it('想起が空だった日の割合', () => {
    expect(emptyDayRatio([{ date: 'x', firstQueueSize: 0 }, { date: 'y', firstQueueSize: 2 }])).toEqual({ days: 2, empty: 1 });
  });
  it('並びは共通カードが先、次に状態の順', () => {
    const sorted = sortCards([card('z', { states: ['agitation'] }), card('y', { states: ['arrest'] }), card('x', { common: true, states: [] })], registry);
    expect(sorted.map((c) => c.id)).toEqual(['x', 'y', 'z']);
  });
});
