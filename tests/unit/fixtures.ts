import type { Card, HistoryEntry, LearningState, MasteryLevel, Registry } from '../../src/types';
import registryJson from '../../content/registry.json';

export const registry = registryJson as unknown as Registry;

export function card(id: string, extra: Partial<Card> = {}): Card {
  return {
    id,
    title: id,
    states: ['arrest'],
    scenes: ['ward'],
    specialties: [],
    summary: [],
    firstActions: [],
    steps: [],
    branches: [],
    callForHelp: { criteria: [] },
    pitfalls: [],
    sources: [],
    updatedAt: '2026-11-09',
    review: { level: 0 },
    ...extra,
  };
}

export function practiced(cardId: string, at: number, level: MasteryLevel, due: number | null, source: HistoryEntry['source'] = 'manual'): LearningState {
  return { cardId, level, intervalDays: 1, due, history: [{ at, result: 'good', seconds: 10, levelAfter: level, source }] };
}

/** 2026-11-10 09:00（現地時刻） */
export const T0 = new Date(2026, 10, 10, 9, 0, 0).getTime();
