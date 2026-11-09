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
  for (const s of [schemas.source, schemas.review, schemas.table, schemas.verification]) ajv.addSchema(s);
  return {
    card: ajv.compile(schemas.card),
    drill: ajv.compile(schemas.drill),
    specialty: ajv.compile(schemas.specialty),
    topic: ajv.compile(schemas.topic),
    drug: ajv.compile(schemas.drug),
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
export function checkAll({ registry, cards, drills, specialties, topics = [], drugs = [], validators }) {
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

    // 看護師の第一声（想起で題名の代わりに出す）。題名をそのまま書くと当てる練習にならない。
    if (!c.common && (c.firstCalls ?? []).length === 0) warn(file, '看護師の第一声（firstCalls）がない（想起は題名で問う）');
    for (const f of c.firstCalls ?? []) {
      if (f.includes(c.title)) warn(file, `第一声に題名が入っている: 「${f.slice(0, 20)}」`);
      if (f.length > LIMITS.lineChars) warn(file, `第一声が${LIMITS.lineChars}字を超える: 「${f.slice(0, 20)}…」`);
    }
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
    if ((s.cannotWait ?? []).length === 0) blank(file, '朝まで待てない条件が空');
    if ((s.canWait ?? []).length === 0) blank(file, '朝まで待てる条件が空');
    if ((s.doNotDo ?? []).length === 0) blank(file, 'やってはいけないことが空');
    if ((s.sources ?? []).length === 0) blank(file, '出典が空');
  }

  checkReference({ registry, cards, topics, drugs, validators, err, warn });
  return out;
}

function checkTable(file, where, t, err, warn) {
  if (!t) return;
  t.rows.forEach((r, i) => {
    if (r.length !== t.columns.length) err(file, `${where}: 表の${i + 1}行目の列数（${r.length}）が見出し（${t.columns.length}）と違う`);
    if (r.some((c) => c.trim() === '')) warn(file, `${where}: 表の${i + 1}行目に空のセルがある`);
  });
}

function checkIndexes(file, where, idx, sources, err) {
  for (const i of idx ?? []) if (i >= sources.length) err(file, `${where}: 出典の番号 ${i} がない（出典は${sources.length}件）`);
}

/** 参照セクション（参照項目と薬）の点検 */
function checkReference({ registry, cards, topics, drugs, validators, err, warn }) {
  const fieldIds = new Set((registry.fields ?? []).map((f) => f.id));
  const cardIds = new Set(cards.map((c) => c.data.id));
  const topicIds = new Set();
  const drugIds = new Set();
  for (const { file, data } of topics) {
    if (topicIds.has(data.id)) err(file, `参照項目の id が重複: ${data.id}`);
    topicIds.add(data.id);
  }
  for (const { file, data } of drugs) {
    if (drugIds.has(data.id)) err(file, `薬の id が重複: ${data.id}`);
    drugIds.add(data.id);
  }

  for (const { file, data: t } of topics) {
    for (const m of schemaErrors(validators.topic, t)) err(file, `形: ${m}`);
    if (!file.endsWith(`${t.id}.json`)) warn(file, `ファイル名と id が違う: ${t.id}`);
    const blank = (t.review?.level ?? 0) === 0 ? warn : err;
    if (!fieldIds.has(t.field)) err(file, `分野が一覧にない: ${t.field}`);
    if ((t.summary ?? []).length === 0) blank(file, '要約が空');
    if ((t.points ?? []).length === 0) blank(file, 'ポイントが空');
    if ((t.sources ?? []).length === 0) blank(file, '出典が空');
    for (const line of [...(t.summary ?? []), ...(t.points ?? [])])
      if (line.length > LIMITS.lineChars) warn(file, `要約・ポイントの1行が${LIMITS.lineChars}字を超える: 「${line.slice(0, 20)}…」`);
    for (const sec of t.sections ?? []) {
      checkTable(file, `節「${sec.title}」`, sec.table, err, warn);
      checkIndexes(file, `節「${sec.title}」`, sec.sourceIndexes, t.sources ?? [], err);
      if (!!sec.question !== !!sec.answer) err(file, `節「${sec.title}」: 確認問題の問いと答えの片方しかない`);
    }
    for (const id of t.cards ?? []) if (!cardIds.has(id)) err(file, `カードが見つからない: ${id}`);
    for (const id of t.drugs ?? []) if (!drugIds.has(id)) err(file, `薬が見つからない: ${id}`);
    for (const id of t.related ?? []) if (!topicIds.has(id)) err(file, `参照項目が見つからない: ${id}`);
  }

  for (const { file, data: d } of drugs) {
    for (const m of schemaErrors(validators.drug, d)) err(file, `形: ${m}`);
    if (!file.endsWith(`${d.id}.json`)) warn(file, `ファイル名と id が違う: ${d.id}`);
    const blank = (d.review?.level ?? 0) === 0 ? warn : err;
    if ((d.brands ?? []).length === 0) blank(file, '商品名が空');
    if ((d.doses ?? []).length === 0) blank(file, '用法用量が空');
    if ((d.sources ?? []).length === 0) blank(file, '出典が空');
    if (!(d.sources ?? []).some((s) => s.type === 'label')) blank(file, '添付文書（type: label）の出典がない');
    (d.doses ?? []).forEach((r, i) => {
      checkIndexes(file, `用法用量${i + 1}`, r.sourceIndexes, d.sources ?? [], err);
      if ((r.sourceIndexes ?? []).length === 0) blank(file, `用法用量${i + 1}（${r.indication}）に出典の番号がない`);
    });
    checkTable(file, '体重別の表', d.weightTable, err, warn);
    if (d.weightTable && !d.weightTable.note) warn(file, '体重別の表に注記（誰がどう作ったか）がない');
    for (const id of d.topics ?? []) if (!topicIds.has(id)) err(file, `参照項目が見つからない: ${id}`);
  }
}
