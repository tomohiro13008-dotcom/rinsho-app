// カード・練習・科の点検（改訂設計8章の4と13章）。
// JSON Schema で形を、独自の規則で中身の約束（行数・出典・設備の分岐・参照のつながり）を確かめる。
// 下書き（review.level 0）は空欄を警告に留め、照合済み（1以上）は誤りにする。--strict は警告も誤りにする。

import Ajv from 'ajv';

export const LIMITS = {
  summaryLines: 5,
  firstActionLines: 3,
  /** 1行の文字数の目安（仮）。超えたら警告。 */
  lineChars: 60,
};

export function makeValidators(schemas) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const s of [schemas.source, schemas.review]) ajv.addSchema(s);
  return {
    card: ajv.compile(schemas.card),
    drill: ajv.compile(schemas.drill),
    specialty: ajv.compile(schemas.specialty),
  };
}

function schemaErrors(validate, obj) {
  if (validate(obj)) return [];
  return validate.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`);
}

/**
 * @param {{registry: any, cards: {file: string, data: any}[], drills: {file: string, data: any}[], specialties: {file: string, data: any}[], validators: any}} input
 * @returns {{file: string, level: 'error'|'warn', msg: string}[]}
 */
export function checkAll({ registry, cards, drills, specialties, validators }) {
  const out = [];
  const err = (file, msg) => out.push({ file, level: 'error', msg });
  const warn = (file, msg) => out.push({ file, level: 'warn', msg });
  const stateIds = new Set(registry.states.map((s) => s.id));
  const sceneIds = new Set(registry.scenes.map((s) => s.id));
  const eqIds = new Set(registry.equipment.map((s) => s.id));
  const specIds = new Set(specialties.map((s) => s.data.id));
  const cardIds = new Set();
  const drillIds = new Set();

  for (const { file, data } of drills) {
    if (drillIds.has(data.id)) err(file, `練習の id が重複: ${data.id}`);
    drillIds.add(data.id);
  }
  for (const { file, data } of cards) {
    if (cardIds.has(data.id)) err(file, `カードの id が重複: ${data.id}`);
    cardIds.add(data.id);
  }

  for (const { file, data: c } of cards) {
    for (const m of schemaErrors(validators.card, c)) err(file, `形: ${m}`);
    if (!file.endsWith(`${c.id}.json`)) warn(file, `ファイル名と id が違う: ${c.id}`);
    const drafted = (c.review?.level ?? 0) === 0;
    const blank = drafted ? warn : err;

    if (!c.common && (!c.states || c.states.length === 0)) err(file, '共通カードでないのに状態がない');
    for (const s of c.states ?? []) if (!stateIds.has(s)) err(file, `状態が一覧にない: ${s}`);
    for (const s of c.scenes ?? []) if (!sceneIds.has(s)) err(file, `場面が一覧にない: ${s}`);
    for (const s of c.specialties ?? []) if (!specIds.has(s)) err(file, `科が一覧にない: ${s}`);

    if ((c.summary ?? []).length > LIMITS.summaryLines) err(file, `要点は${LIMITS.summaryLines}行まで（${c.summary.length}行）`);
    if ((c.firstActions ?? []).length > LIMITS.firstActionLines)
      err(file, `まずやることは${LIMITS.firstActionLines}行まで（${c.firstActions.length}行）`);
    for (const [k, lines] of [['summary', c.summary], ['firstActions', c.firstActions]]) {
      for (const line of lines ?? []) {
        if (line.length > LIMITS.lineChars) warn(file, `${k} の1行が${LIMITS.lineChars}字を超える: 「${line.slice(0, 20)}…」`);
        if (line.trim() === '') err(file, `${k} に空の行がある`);
      }
    }

    if ((c.firstActions ?? []).length === 0) blank(file, 'まずやることが空');
    if ((c.callForHelp?.criteria ?? []).length === 0) blank(file, '呼ぶ基準が空');
    if (!c.common && (c.steps ?? []).length === 0) blank(file, '手順が空');

    (c.steps ?? []).forEach((st, i) => {
      for (const e of st.requires ?? []) if (!eqIds.has(e)) err(file, `手順${i + 1}: 設備が一覧にない: ${e}`);
      if ((st.requires ?? []).length > 0 && !st.ifMissing) err(file, `手順${i + 1}: 設備が要る行に ifMissing（ないときの代わり）がない`);
      if (st.ifMissing && (st.requires ?? []).length === 0) warn(file, `手順${i + 1}: requires がないのに ifMissing がある`);
    });

    // 出典欄
    const sources = c.sources ?? [];
    if (sources.length === 0) blank(file, '出典が空');
    if (!drafted && !sources.some((s) => s.public)) err(file, '照合済みなのに公開できる出典（public:true）がない');
    sources.forEach((s, i) => {
      if (!s.title?.trim()) err(file, `出典${i + 1}: 名前が空`);
      if (s.type === 'guideline' && !s.edition) blank(file, `出典${i + 1}: ガイドラインの版がない`);
      if (s.type === 'book' && s.public) warn(file, `出典${i + 1}: 書籍が public:true（頁は自分用の欄に置く）`);
      if (!drafted && !s.checkedScope) warn(file, `出典${i + 1}: 照合した範囲（checkedScope）がない`);
    });
    if ((c.review?.level ?? 0) >= 2 && !c.review.byRole) err(file, 'レビュー段階2以上なのに誰が見たか（byRole）がない');

    for (const d of c.drills ?? []) if (!drillIds.has(d)) err(file, `練習が見つからない: ${d}`);
  }

  for (const { file, data: d } of drills) {
    for (const m of schemaErrors(validators.drill, d)) err(file, `形: ${m}`);
    if (!d.cardId && !d.specialty) err(file, 'cardId と specialty のどちらもない');
    if (d.cardId && !cardIds.has(d.cardId)) err(file, `カードが見つからない: ${d.cardId}`);
    if (d.specialty && !specIds.has(d.specialty)) err(file, `科が見つからない: ${d.specialty}`);
    if (d.kind === 'sequence' && (d.items ?? []).length < 2) err(file, '並べ替えの練習に items が2つ以上ない');
  }

  for (const { file, data: s } of specialties) {
    for (const m of schemaErrors(validators.specialty, s)) err(file, `形: ${m}`);
    const drafted = (s.review?.level ?? 0) === 0;
    const blank = drafted ? warn : err;
    if ((s.mustNotMiss ?? []).length === 0) blank(file, '見逃してはいけない疾患が空');
    for (const m of s.mustNotMiss ?? []) if (m.cardId && !cardIds.has(m.cardId)) err(file, `カードが見つからない: ${m.cardId}`);
    if ((s.sources ?? []).length === 0) blank(file, '出典が空');
  }

  return out;
}
