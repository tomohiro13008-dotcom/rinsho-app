import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkAll, makeValidators } from '../../scripts/check-lib.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const schemas = Object.fromEntries(['card', 'drill', 'specialty', 'source', 'review'].map((n) => [n, read(`schema/${n}.schema.json`)]));
const validators = makeValidators(schemas);
const registry = read('content/registry.json');

const base = () => ({
  id: 'x',
  title: 'X',
  states: ['arrest'],
  scenes: ['ward'],
  specialties: [],
  summary: ['a'],
  firstActions: ['a'],
  steps: [{ text: 's', kind: 'procedure' }],
  branches: [],
  callForHelp: { criteria: ['c'] },
  pitfalls: [],
  sources: [{ type: 'guideline', title: 'G', edition: '2020', checkedScope: '全体', public: true }],
  updatedAt: '2026-11-09',
  review: { level: 1 },
});
const run = (c, drills = []) =>
  checkAll({ registry, cards: [{ file: 'content/cards/x.json', data: c }], drills, specialties: [], validators });
const errors = (r) => r.filter((x) => x.level === 'error').map((x) => x.msg);

describe('点検スクリプト', () => {
  it('整ったカードは誤りなし', () => {
    expect(errors(run(base()))).toEqual([]);
  });
  it('要点は5行まで、まずやることは3行まで', () => {
    const c = { ...base(), summary: ['1', '2', '3', '4', '5', '6'], firstActions: ['1', '2', '3', '4'] };
    const e = errors(run(c)).join('\n');
    expect(e).toContain('要点は5行まで');
    expect(e).toContain('まずやることは3行まで');
  });
  it('照合済みで出典が空・呼ぶ基準が空なら誤り。下書きなら警告', () => {
    const c = { ...base(), sources: [], callForHelp: { criteria: [] } };
    const e = errors(run(c)).join('\n');
    expect(e).toContain('出典が空');
    expect(e).toContain('呼ぶ基準が空');
    const d = { ...c, review: { level: 0 } };
    expect(errors(run(d))).toEqual([]);
    expect(run(d).filter((x) => x.level === 'warn').length).toBeGreaterThan(0);
  });
  it('設備が要る行に ifMissing がなければ誤り。一覧にない設備も誤り', () => {
    const c = { ...base(), steps: [{ text: 's', kind: 'equipment', requires: ['aed', 'warp'] }] };
    const e = errors(run(c)).join('\n');
    expect(e).toContain('ifMissing');
    expect(e).toContain('warp');
  });
  it('一覧にない状態・場面、見つからない練習は誤り', () => {
    const c = { ...base(), states: ['nope'], scenes: ['moon'], drills: ['missing'] };
    const e = errors(run(c)).join('\n');
    expect(e).toContain('状態が一覧にない');
    expect(e).toContain('場面が一覧にない');
    expect(e).toContain('練習が見つからない');
  });
  it('書籍を public:true にすると警告、照合済みで公開できる出典がなければ誤り', () => {
    const c = { ...base(), sources: [{ type: 'book', title: '本', public: false }] };
    expect(errors(run(c)).join('\n')).toContain('公開できる出典');
  });
  it('形の誤り（必須欄の欠け）を拾う', () => {
    const c = base();
    delete c.callForHelp;
    expect(errors(run(c)).join('\n')).toContain('callForHelp');
  });
  it('リポジトリのいまの content は誤りなし', async () => {
    const { readdirSync } = await import('node:fs');
    const load = (d) =>
      readdirSync(new URL(`../../${d}`, import.meta.url))
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ file: `${d}/${f}`, data: read(`${d}/${f}`) }));
    const r = checkAll({
      registry,
      cards: load('content/cards'),
      drills: load('content/drills'),
      specialties: load('content/specialties'),
      validators,
    });
    expect(errors(r)).toEqual([]);
  });
});
