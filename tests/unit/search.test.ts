import { describe, expect, it } from 'vitest';
import { normalize, search } from '../../src/logic/search';
import type { Drug, Topic } from '../../src/types';
import { card } from './fixtures';

const drug = {
  id: 'amiodarone', generic: 'アミオダロン塩酸塩', brands: [{ name: 'アンカロン注150', strength: '' }], drugClass: '抗不整脈薬',
  summary: [], doses: [{ indication: '心停止', population: '成人', dose: '', route: '', basis: '' }], preparation: [], cautions: [],
  sources: [], verification: { checked: [], unverified: [] }, updatedAt: '', review: { level: 0 },
} as Drug;
const topic = {
  id: 'als', field: 'emergency', title: '成人の心停止（ALS）', tags: ['VF'], summary: ['アドレナリン'], points: [], sections: [],
  pitfalls: [], sources: [], verification: { checked: [], unverified: [] }, updatedAt: '', review: { level: 0 },
} as Topic;
const data = { drugs: [drug], topics: [topic], cards: [card('arrest', { title: '反応がない・心停止' })] };

describe('参照の検索', () => {
  it('カタカナ・ひらがな、全角半角をそろえる', () => {
    expect(normalize('アンカロン　ＶＦ')).toBe('あんかろんvf');
  });
  it('商品名で薬が見つかる', () => {
    expect(search('あんかろん', data).map((h) => h.item.id)).toEqual(['amiodarone']);
  });
  it('複数の語はすべて含むものだけ。題名に当たるものが先', () => {
    const hits = search('心停止', data);
    expect(hits.map((h) => h.kind)).toEqual(['topic', 'card', 'drug']);
    expect(search('心停止 vf', data).map((h) => h.item.id)).toEqual(['als']);
  });
  it('空の検索は何も返さない', () => {
    expect(search('  ', data)).toEqual([]);
  });
});
