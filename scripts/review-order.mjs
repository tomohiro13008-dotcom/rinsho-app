#!/usr/bin/env node
// 使い方: npm run review-order → REVIEW-ORDER.md を書き出す。
// まとめて照合するための順番表。項目ごとに「数字が入っている行」だけを抜き出し、
// 本（正本）で見るところを絞る。あわせて、カード・参照の中の薬の量が薬のページに
// 出てこないもの（食い違いの候補）を並べる。中身は変えない。

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const loadDir = (d) =>
  readdirSync(join(root, d))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(join(root, d, f)));

const registry = readJson(join(root, 'content', 'registry.json'));
const cards = loadDir('content/cards');
const topics = loadDir('content/topics');
const drugs = loadDir('content/drugs');

// 照合しない欄（出典・記録・つながり・看護師の第一声）
const SKIP = new Set(['$comment', 'sources', 'verification', 'review', 'id', 'updatedAt', 'tags', 'firstCalls', 'cards', 'drugs', 'related', 'states', 'scenes', 'specialties', 'drills', 'field', 'topics', 'common', 'sourceIndexes', 'level', 'keyword', 'kind']);

/** 中身の文字列を（場所つきで）全部集める */
export function strings(obj, path = []) {
  if (typeof obj === 'string') return [{ path: path.join('.'), text: obj }];
  if (Array.isArray(obj)) return obj.flatMap((x, i) => strings(x, [...path, i]));
  if (obj && typeof obj === 'object')
    return Object.entries(obj).flatMap(([k, v]) => (SKIP.has(k) ? [] : strings(v, [...path, k])));
  return [];
}

const hasNumber = (s) => /[0-9０-９]/.test(s);
const numberLines = (obj) => {
  const seen = new Set();
  return strings(obj)
    .map((x) => x.text)
    .filter((t) => hasNumber(t) && !seen.has(t) && seen.add(t));
};

const masters = (item) => {
  const books = (item.sources ?? []).filter((s) => !s.verifiedAt).map((s) => s.title);
  return books.length ? books : (item.sources ?? []).map((s) => s.title);
};

// ---- 並べる順 ----
const stateIndex = new Map(registry.states.map((s, i) => [s.id, i]));
const fieldIndex = new Map(registry.fields.map((f, i) => [f.id, i]));
const cardRank = (c) => (c.common ? -1 : Math.min(...(c.states ?? []).map((s) => stateIndex.get(s) ?? 99), 99));
const orderedCards = [...cards].sort((a, b) => cardRank(a) - cardRank(b) || a.id.localeCompare(b.id));
const cardPos = new Map(orderedCards.map((c, i) => [c.id, i]));

const drugUse = (d) => topics.filter((t) => t.drugs?.includes(d.id)).length;
const orderedDrugs = [...drugs].sort((a, b) => drugUse(b) - drugUse(a) || a.id.localeCompare(b.id));

const topicRank = (t) => {
  const ps = (t.cards ?? []).map((c) => cardPos.get(c)).filter((x) => x !== undefined);
  return ps.length ? Math.min(...ps) : 100 + (fieldIndex.get(t.field) ?? 99);
};
const orderedTopics = [...topics].sort((a, b) => topicRank(a) - topicRank(b) || a.id.localeCompare(b.id));

// ---- 薬の量の食い違いの候補 ----
const STRIP = [/（.*$/, /コハク酸エステルナトリウム$/, /塩化物塩酸塩$/, /硫酸塩水和物$/, /ナトリウム水和物$/, /・ブドウ糖$/, /ナトリウム$/, /塩酸塩$/, /水和物$/];
export const alias = (generic) => STRIP.reduce((s, re) => s.replace(re, ''), generic);
const UNIT = '(?:mg\\/kg|μg\\/kg|mg|μg|mL|g)';
const NUM = '[0-9][0-9,.]*';
export const doseTokens = (s) =>
  [...s.replace(/～/g, '〜').matchAll(new RegExp(`${NUM}(?:〜${NUM})?\\s*${UNIT}`, 'g'))].map((m) => m[0].replace(/[,\s]/g, ''));

export function mismatches(drugList, items) {
  const out = [];
  const names = drugList.map((d) => ({ d, name: alias(d.generic) })).filter((x) => x.name.length >= 3 && x.name !== 'ブドウ糖');
  for (const { d, name } of names) {
    const known = new Set(strings({ s: d.summary, a: d.doses, b: d.preparation, c: d.weightTable }).flatMap((x) => doseTokens(x.text)));
    for (const item of items) {
      for (const { text } of strings(item)) {
        let i = text.indexOf(name);
        while (i >= 0) {
          const before = text.slice(Math.max(0, i - 2), i);
          if (!(name === 'アドレナリン' && before.endsWith('ノル'))) {
            // 名前から、句点・読点・「＋」「→」「または」か次の薬の名前までを、その薬の量として見る
            let seg = text.slice(i + name.length).split(/[。；;、＋+→]|または/)[0];
            for (const other of names) {
              if (other.name === name) continue;
              const j = seg.indexOf(other.name);
              if (j >= 0) seg = seg.slice(0, j);
            }
            seg = seg.slice(0, 40);
            for (const tok of doseTokens(seg)) if (!known.has(tok)) out.push({ drug: d.id, name, item: item.id, token: tok, text });
          }
          i = text.indexOf(name, i + name.length);
        }
      }
    }
  }
  const seen = new Set();
  return out.filter((m) => {
    const k = `${m.drug}|${m.item}|${m.token}`;
    return !seen.has(k) && seen.add(k);
  });
}

// ---- 書き出し ----
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const L = [];
  const today = new Date().toISOString().slice(0, 10);
  L.push('# 照合の順番表', '');
  L.push(`${today} に \`npm run review-order\` で書き出した。中身を直したら書き出し直す。`, '');
  L.push('- 順番：現場カード（共通3枚 → 状態の並び＝命に関わる順）→ 薬（参照で使われる数が多い順）→ 参照項目（カードにつながるものをカードの順に、残りは分野の順）。');
  L.push('- 「見る行」は数字が入っている行だけ。量・時間・しきい値はここに集まる。数字のない行（考え方・順番）は、正本を読む時間があるときに。');
  L.push('- 「正本」は出典のうちまだ照合していない書籍・資料。なければ出典の全部。');
  L.push('- 照合できたら、そのファイルの review.level を 1 に上げる（REVIEW.md の段階の決まりどおり）。', '');

  const mm = mismatches(drugs, [...cards, ...topics]);
  L.push(`## 薬の量の食い違いの候補（${mm.length}件）`, '');
  L.push('カードと参照で薬の名前のあとに出てくる量のうち、その薬のページの量・作り方・早見表に出てこないもの。英国の量や体重あたりの量など、違っていて正しいものも混ざる。照合のときに、どちらに合わせるかを決める。', '');
  if (mm.length) {
    L.push('| 薬 | 出てくる場所 | 量 | 行 |', '|---|---|---|---|');
    for (const m of mm) L.push(`| ${m.drug} | ${m.item} | ${m.token} | ${m.text.replace(/\|/g, '｜')} |`);
  }
  L.push('');

  const block = (title, items, label) => {
    L.push(`## ${title}（${items.length}）`, '');
    items.forEach((it, n) => {
      const lines = numberLines(it);
      L.push(`### ${n + 1}. ${label(it)}（見る行 ${lines.length}）`, '');
      L.push(`- 正本：${masters(it).join('／') || '（出典なし）'}`);
      const un = it.verification?.unverified ?? [];
      if (un.length) L.push(`- 未照合として残したこと：${un.join('／')}`);
      for (const t of lines) L.push(`- [ ] ${t}`);
      L.push('');
    });
  };
  block('現場カード', orderedCards, (c) => `${c.id} ${c.title}`);
  block('薬', orderedDrugs, (d) => `${d.id} ${d.generic}`);
  block('参照項目', orderedTopics, (t) => `${t.id} ${t.title}`);

  writeFileSync(join(root, 'REVIEW-ORDER.md'), L.join('\n'));
  console.log(`REVIEW-ORDER.md：カード${cards.length}・薬${drugs.length}・参照${topics.length}、食い違いの候補${mm.length}件`);
}
