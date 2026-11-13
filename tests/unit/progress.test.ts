import { describe, expect, it } from 'vitest';
import { cardFlagsForQueue, cardStatus, matchesFilter, overview, plainStatus, topicStatus, type ProgressInput } from '../../src/logic/progress';
import { buildTodayQueue } from '../../src/logic/queue';
import { DAY, HOUR } from '../../src/logic/time';
import type { DrillLog, Flag, LearningState, Topic, View } from '../../src/types';
import { T0, card, practiced } from './fixtures';

const input = (over: Partial<ProgressInput> = {}): ProgressInput => ({
  learning: new Map(),
  lookups: [],
  marks: [],
  drillLogs: [],
  flags: new Map(),
  views: new Map(),
  now: T0,
  ...over,
});

const topic = (id: string, questions: string[]): Topic => ({
  id,
  field: 'emergency',
  title: id,
  tags: [],
  summary: [],
  points: [],
  sections: questions.map((q) => ({ id: q, title: q, question: `${q}?`, answer: 'a' })),
  pitfalls: [],
  sources: [],
  verification: { checked: [], unverified: [] },
  updatedAt: '2026-11-11',
  review: { level: 0 },
});
const log = (drillId: string, at: number, result: DrillLog['result']): DrillLog => ({ drillId, at, result });
const flags = (...fs: Flag[]) => new Map(fs.map((f) => [f.key, f]));

describe('目次：カードの進み具合と印', () => {
  it('何もしていないカードは「まだ」。印も付かない', () => {
    const s = cardStatus(card('a'), input());
    expect(s).toMatchObject({ seen: false, done: false, important: false, weak: false, review: false });
    expect(matchesFilter(s, 'unseen')).toBe(true);
  });

  it('直近で言えなかったカードは、記録から「苦手」になる。言えたら消える', () => {
    const again: LearningState = { cardId: 'a', level: 1, intervalDays: 1, due: T0 + DAY, history: [{ at: T0 - HOUR, result: 'again', seconds: 5, levelAfter: 1, source: 'manual' }] };
    expect(cardStatus(card('a'), input({ learning: new Map([['a', again]]) }))).toMatchObject({ weak: true, weakAuto: true, weakManual: false });
    const good = practiced('a', T0 - HOUR, 2, T0 + DAY);
    expect(cardStatus(card('a'), input({ learning: new Map([['a', good]]) })).weak).toBe(false);
  });

  it('期日が来た復習と、現場で引いたあと未練習のカードは、記録から「要復習」になる', () => {
    const due = practiced('a', T0 - 2 * DAY, 2, T0 - HOUR);
    expect(cardStatus(card('a'), input({ learning: new Map([['a', due]]) }))).toMatchObject({ review: true, reviewAuto: true });
    const looked = cardStatus(card('b'), input({ lookups: [{ cardId: 'b', at: T0 - HOUR, mode: 'field' }] }));
    expect(looked).toMatchObject({ seen: true, review: true, reviewAuto: true });
  });

  it('見ずに言える段階（3以上）で「身についた」', () => {
    expect(cardStatus(card('a'), input({ learning: new Map([['a', practiced('a', T0, 3, T0 + DAY)]]) })).done).toBe(true);
  });

  it('手で付けた「要復習」は、付けたあとに練習すると消える', () => {
    const f = flags({ key: 'card:a', reviewAt: T0 - HOUR, at: T0 - HOUR });
    expect(cardStatus(card('a'), input({ flags: f }))).toMatchObject({ review: true, reviewManual: true, reviewAuto: false });
    const after = new Map([['a', practiced('a', T0 - 1, 1, T0 + DAY)]]);
    expect(cardStatus(card('a'), input({ flags: f, learning: after })).review).toBe(false);
  });
});

describe('目次：参照・薬・科', () => {
  const t = topic('t', ['q1', 'q2']);
  it('開いた記録か確認問題の記録があれば「読んだ」', () => {
    expect(topicStatus(t, input()).seen).toBe(false);
    const views = new Map<string, View>([['topic:t', { key: 'topic:t', firstAt: T0, lastAt: T0, count: 1 }]]);
    expect(topicStatus(t, input({ views })).seen).toBe(true);
    expect(topicStatus(t, input({ drillLogs: [log('topic:t:q1', T0, 'good')] })).seen).toBe(true);
  });

  it('確認問題は、いちばん新しい答えで見る。全部言えたら「身についた」', () => {
    const logs = [log('topic:t:q1', T0, 'again'), log('topic:t:q1', T0 + 1, 'good'), log('topic:t:q2', T0, 'hard')];
    const s = topicStatus(t, input({ drillLogs: logs }));
    expect(s).toMatchObject({ weak: false, review: true, reviewAuto: true, done: false });
    const all = topicStatus(t, input({ drillLogs: [...logs, log('topic:t:q2', T0 + 2, 'easy')] }));
    expect(all).toMatchObject({ review: false, done: true });
  });

  it('参照の「要復習」「苦手」の印は、外すまで残る。薬は開いたかどうかと印だけ', () => {
    const f = flags({ key: 'topic:t', reviewAt: T0 - DAY, weak: true, at: T0 - DAY }, { key: 'drug:x', important: true, at: T0 });
    expect(topicStatus(t, input({ flags: f, drillLogs: [log('topic:t:q1', T0, 'good')] }))).toMatchObject({ review: true, weak: true, weakAuto: false });
    expect(plainStatus('drug', 'x', input({ flags: f }))).toMatchObject({ seen: false, important: true, weak: false, review: false });
  });

  it('全体の数を数える', () => {
    const cs = [card('a'), card('b')];
    const ov = overview(
      { cards: cs, topics: [t], drugs: [], specialties: [] },
      input({ learning: new Map([['a', practiced('a', T0, 3, T0 + DAY)]]), drillLogs: [log('topic:t:q1', T0, 'good')], flags: flags({ key: 'card:b', important: true, at: T0 }) }),
    );
    expect(ov.cards).toEqual({ total: 2, seen: 1, mastered: 1 });
    expect(ov.topics).toEqual({ total: 1, seen: 1, questions: 2, questionsGood: 1 });
    expect(ov.counts).toMatchObject({ important: 1, unseen: 1 });
  });
});

describe('印と今日の想起', () => {
  const cards = [card('a'), card('b'), card('c')];
  it('「重要」のカードは順送りで先に出る', () => {
    const { important, review } = cardFlagsForQueue(flags({ key: 'card:c', important: true, at: T0 }), new Map());
    expect(buildTodayQueue({ cards, learning: new Map(), lookups: [], now: T0, important, reviewFlags: review })).toEqual([{ cardId: 'c', source: 'new' }]);
  });

  it('「要復習」を付けたカードは復習として並び、練習したあとは並ばない', () => {
    const f = flags({ key: 'card:b', reviewAt: T0 - HOUR, at: T0 - HOUR });
    const learning = new Map([['b', practiced('b', T0 - DAY, 2, T0 + 5 * DAY)]]);
    const q1 = cardFlagsForQueue(f, learning);
    expect(buildTodayQueue({ cards, learning, lookups: [], now: T0, important: q1.important, reviewFlags: q1.review })[0]).toEqual({ cardId: 'b', source: 'review' });
    const later = new Map([['b', practiced('b', T0 - 1, 2, T0 + 5 * DAY)]]);
    expect(cardFlagsForQueue(f, later).review.size).toBe(0);
  });
});
