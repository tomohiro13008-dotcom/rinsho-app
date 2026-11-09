import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkAll, makeValidators } from '../../scripts/check-lib.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const schemas = Object.fromEntries(['card', 'drill', 'specialty', 'source', 'review', 'table', 'verification', 'topic', 'drug'].map((n) => [n, read(`schema/${n}.schema.json`)]));
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
      topics: load('content/topics'),
      drugs: load('content/drugs'),
      validators,
    });
    expect(errors(r)).toEqual([]);
  });

  it('参照項目：表の列数のずれ、ない出典番号、見つからない薬は誤り', () => {
    const topic = {
      id: 't', field: 'emergency', title: 'T', tags: [], summary: ['a'], points: ['b'], pitfalls: [],
      sections: [{ id: 's', title: 'S', table: { columns: ['a', 'b'], rows: [['1']] }, sourceIndexes: [3] }],
      drugs: ['nope'], sources: [], verification: { checked: [], unverified: [] }, updatedAt: '2026-11-09', review: { level: 0 },
    };
    const r = checkAll({ registry, cards: [], drills: [], specialties: [], topics: [{ file: 'content/topics/t.json', data: topic }], drugs: [], validators });
    const e = errors(r).join('\n');
    expect(e).toContain('列数');
    expect(e).toContain('出典の番号 3');
    expect(e).toContain('薬が見つからない');
  });
  it('薬：照合済みなのに添付文書の出典や用法用量の出典番号がなければ誤り', () => {
    const drug = {
      id: 'x', generic: 'X', brands: [{ name: 'Xi', strength: '1mg' }], drugClass: 'c', summary: [], preparation: [], cautions: [],
      doses: [{ indication: 'i', population: '成人', dose: '1mg', route: '静注', basis: 'b' }],
      sources: [{ type: 'guideline', title: 'G', edition: '1', public: true }],
      verification: { checked: [], unverified: [] }, updatedAt: '2026-11-09', review: { level: 1 },
    };
    const r = checkAll({ registry, cards: [], drills: [], specialties: [], topics: [], drugs: [{ file: 'content/drugs/x.json', data: drug }], validators });
    const e = errors(r).join('\n');
    expect(e).toContain('添付文書');
    expect(e).toContain('出典の番号がない');
  });
  it('v1.2：第一声に題名が入ると警告。照合済みの科で「朝まで待てない条件」などが空なら誤り', () => {
    const w = run({ ...base(), firstCalls: ['Xです'] }).filter((x) => x.level === 'warn').map((x) => x.msg).join('\n');
    expect(w).toContain('第一声に題名が入っている');
    const spec = {
      id: 's', name: 'S', mustNotMiss: [{ disease: 'D' }], common: [], urgencyQuestions: [], procedurePrep: [], tips: [],
      sources: [{ type: 'guideline', title: 'G', edition: '1', public: true }], updatedAt: '2026-11-09', review: { level: 1 },
    };
    const r = checkAll({ registry, cards: [], drills: [], specialties: [{ file: 'content/specialties/s.json', data: spec }], validators });
    const e = errors(r).join('\n');
    expect(e).toContain('朝まで待てない条件が空');
    expect(e).toContain('朝まで待てる条件が空');
    expect(e).toContain('やってはいけないことが空');
    const ok = { ...spec, cannotWait: ['a'], canWait: ['b'], doNotDo: ['c'] };
    expect(errors(checkAll({ registry, cards: [], drills: [], specialties: [{ file: 'content/specialties/s.json', data: ok }], validators }))).toEqual([]);
  });
});

