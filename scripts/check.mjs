#!/usr/bin/env node
// 使い方: npm run check（下書きの空欄は警告） / npm run check:strict（警告も誤りにする）

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAll, makeValidators } from './check-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const loadDir = (d) =>
  readdirSync(join(root, d))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: `${d}/${f}`, data: readJson(join(root, d, f)) }));

const schemas = Object.fromEntries(
  ['card', 'drill', 'specialty', 'source', 'review'].map((n) => [n, readJson(join(root, 'schema', `${n}.schema.json`))]),
);
const validators = makeValidators(schemas);
const registry = readJson(join(root, 'content', 'registry.json'));
const cards = loadDir('content/cards');
const drills = loadDir('content/drills');
const specialties = loadDir('content/specialties');

// 雛形も形だけは確かめる（中身の規則は当てない）
const templateErrors = loadDir('content/templates').flatMap(({ file, data }) =>
  validators.card(data) ? [] : validators.card.errors.map((e) => ({ file, level: 'error', msg: `形: ${e.instancePath} ${e.message}` })),
);

const results = [...templateErrors, ...checkAll({ registry, cards, drills, specialties, validators })];
const errors = results.filter((r) => r.level === 'error' || strict);
const warns = results.filter((r) => r.level === 'warn' && !strict);

for (const r of results) console.log(`${r.level === 'error' || strict ? '誤り' : '警告'}  ${r.file}  ${r.msg}`);
console.log(
  `\nカード${cards.length}枚・練習${drills.length}問・科${specialties.length}件を点検：誤り${errors.length}件、警告${warns.length}件${strict ? '（--strict）' : ''}`,
);
process.exit(errors.length > 0 ? 1 : 0);
