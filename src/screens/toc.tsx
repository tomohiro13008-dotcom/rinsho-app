// 目次（全体像）：何がどこにあるかを一枚で見て、進み具合と印（重要・苦手・要復習）で絞る。
// 「苦手」「要復習」は学習の記録からも自動で付く。手で付けた印だけを端末内に保存する（患者の情報は持たない）。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { cards, drugs, registry, specialties, topicsForField, topics } from '../content';
import { Icon, Section } from '../components';
import { normalize } from '../logic/search';
import { cardStatus, itemKey, matchesFilter, overview, plainStatus, topicStatus, type ItemStatus, type ProgressInput, type TocFilter } from '../logic/progress';
import { saveFlag, touchView } from '../store/db';
import { useApp } from '../state';
import type { ItemKind } from '../types';

export const progressInput = (data: ReturnType<typeof useApp>['data'], now: number): ProgressInput => ({
  learning: data.learning,
  lookups: data.lookups,
  marks: data.marks,
  drillLogs: data.drillLogs,
  flags: data.flags,
  views: data.views,
  now,
});

/** 項目のページを開いた記録を残す（参照・薬・科）。10分以内の開き直しは数えない。 */
export function useRecordView(kind: ItemKind, id: string, exists: boolean) {
  const { refresh } = useApp();
  useEffect(() => {
    if (!exists) return;
    void touchView(itemKey(kind, id), Date.now()).then((changed) => (changed ? refresh() : undefined));
  }, [kind, id]);
}

const MARKS = [
  { field: 'important', label: '重要' },
  { field: 'weak', label: '苦手' },
  { field: 'review', label: '要復習' },
] as const;

/** 印の3つのボタン。押すと手で付けた印が切り替わる。記録から自動で付いた分は「記録から」と文字で示す。 */
export function MarkButtons({ status, compact = false }: { status: ItemStatus; compact?: boolean }) {
  const { data, refresh } = useApp();
  const flag = data.flags.get(status.key);
  const manual = { important: status.important, weak: status.weakManual, review: status.reviewManual };
  const auto = { important: false, weak: status.weakAuto, review: status.reviewAuto };
  const toggle = async (field: (typeof MARKS)[number]['field']) => {
    const now = Date.now();
    const next = { key: status.key, ...flag, at: now };
    if (field === 'important') next.important = !manual.important;
    if (field === 'weak') next.weak = !manual.weak;
    if (field === 'review') next.reviewAt = manual.review ? null : now;
    await saveFlag(next);
    await refresh();
  };
  return (
    <div class={`marks ${compact ? 'marks-compact' : ''}`} role="group" aria-label="印">
      {compact ? null : <span class="muted small">印：</span>}
      {MARKS.map(({ field, label }) => (
        <button
          type="button"
          class={`mark-btn ${auto[field] && !manual[field] ? 'mark-auto' : ''}`}
          aria-pressed={manual[field]}
          data-mark={field}
          onClick={() => void toggle(field)}
        >
          {manual[field] ? <Icon name="check" /> : null}
          {label}
          {auto[field] ? <span class="small">（記録から）</span> : null}
        </button>
      ))}
    </div>
  );
}

interface Row {
  kind: ItemKind;
  id: string;
  title: string;
  href: string;
  text: string;
  status: ItemStatus;
}
interface Group {
  id: string;
  title: string;
  rows: Row[];
}

const FILTERS: { id: TocFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'important', label: '重要' },
  { id: 'weak', label: '苦手' },
  { id: 'review', label: '要復習' },
  { id: 'unseen', label: 'まだ' },
];

function Meter({ label, value, total, unit }: { label: string; value: number; total: number; unit: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div class="meter-row">
      <span>{label}</span>
      <span class="meter" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span class="small">
        {value}/{total}
        {unit}
      </span>
    </div>
  );
}

export function Toc() {
  const { data } = useApp();
  const now = Date.now();
  const input = useMemo(() => progressInput(data, now), [data]);
  const [filter, setFilter] = useState<TocFilter>('all');
  const [q, setQ] = useState('');
  const ov = useMemo(() => overview({ cards, topics, drugs, specialties }, input), [input]);

  const groups: Group[] = useMemo(() => {
    const g: Group[] = [
      {
        id: 'cards',
        title: '現場カード（命に関わる順）',
        rows: cards.map((c) => ({ kind: 'card', id: c.id, title: c.title, href: `#/card/${c.id}?from=study`, text: [c.title, ...(c.firstCalls ?? [])].join(' '), status: cardStatus(c, input) })),
      },
      ...registry.fields
        .map((f) => ({
          id: `field-${f.id}`,
          title: `参照｜${f.label}`,
          rows: topicsForField(f.id).map((t) => ({ kind: 'topic' as const, id: t.id, title: t.title, href: `#/topic/${t.id}`, text: [t.title, ...t.tags].join(' '), status: topicStatus(t, input) })),
        }))
        .filter((x) => x.rows.length > 0),
      {
        id: 'drugs',
        title: '薬（一般名の順）',
        rows: drugs.map((d) => ({ kind: 'drug', id: d.id, title: d.generic, href: `#/drug/${d.id}`, text: [d.generic, d.drugClass, ...d.brands.map((b) => b.name)].join(' '), status: plainStatus('drug', d.id, input) })),
      },
      {
        id: 'specs',
        title: '科の学習',
        rows: specialties.map((s) => ({ kind: 'spec', id: s.id, title: s.name, href: `#/specialty/${s.id}`, text: s.name, status: plainStatus('spec', s.id, input) })),
      },
    ];
    return g;
  }, [input]);

  const terms = q.split(/\s+/).map(normalize).filter(Boolean);
  const shown = groups
    .map((g) => ({
      ...g,
      total: g.rows.length,
      rows: g.rows.filter((r) => matchesFilter(r.status, filter) && terms.every((t) => normalize(r.text).includes(t))),
    }))
    .filter((g) => g.rows.length > 0);
  const shownCount = shown.reduce((n, g) => n + g.rows.length, 0);
  const narrowed = filter !== 'all' || terms.length > 0;
  const jump = (id: string) => document.getElementById(`toc-${id}`)?.scrollIntoView({ block: 'start' });

  return (
    <main class="page" data-testid="toc">
      <h1>目次（全体像）</h1>
      <section class="summary-box" aria-labelledby="toc-ov">
        <h2 id="toc-ov">進み具合</h2>
        <Meter label="現場カード：見ずに言える" value={ov.cards.mastered} total={ov.cards.total} unit="枚" />
        <Meter label="参照：読んだ" value={ov.topics.seen} total={ov.topics.total} unit="項目" />
        <Meter label="参照の確認問題：言えた" value={ov.topics.questionsGood} total={ov.topics.questions} unit="問" />
        <Meter label="薬：開いた" value={ov.drugs.seen} total={ov.drugs.total} unit="剤" />
        <Meter label="科：開いた" value={ov.specs.seen} total={ov.specs.total} unit="科" />
        <p class="small muted">この端末の記録から数えた。時点：いま開いたとき</p>
      </section>

      <div class="filters" role="group" aria-label="絞り込み">
        {FILTERS.map((f) => (
          <button type="button" class="mark-btn" aria-pressed={filter === f.id} data-filter={f.id} onClick={() => setFilter(f.id)}>
            {filter === f.id ? <Icon name="check" /> : null}
            {f.label}
            {f.id === 'all' ? '' : ` ${ov.counts[f.id]}`}
          </button>
        ))}
      </div>
      <label class="field">
        <span class="visually-hidden">目次の中を探す</span>
        <input type="search" placeholder="題名・薬の名前で絞る" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      <p class="small muted">
        「苦手」は直近で言えなかったもの、「要復習」は復習の期日・現場で引いたあと・あやしかった問いに、記録から自動でも付く。カードに付けた「要復習」は今日の想起に並び、練習すると消える。「重要」のカードは順送りで先に出る。
      </p>

      {narrowed ? (
        <p data-testid="toc-count">{shownCount}件</p>
      ) : (
        <nav class="row wrap" aria-label="章へ">
          {[
            { id: 'cards', label: '現場カード' },
            ...registry.fields.filter((f) => topicsForField(f.id).length > 0).map((f) => ({ id: `field-${f.id}`, label: f.label })),
            { id: 'drugs', label: '薬' },
            { id: 'specs', label: '科' },
          ].map((x) => (
            <button type="button" class="btn btn-small" onClick={() => jump(x.id)}>
              {x.label}
            </button>
          ))}
        </nav>
      )}
      {shown.length === 0 ? <p class="empty">当てはまる項目はありません。</p> : null}
      {shown.map((g) => (
        <Section title={`${g.title}（${narrowed ? `${g.rows.length}/` : ''}${g.total}）`} id={`toc-${g.id}`}>
          <ul class="toc-list">
            {g.rows.map((r) => (
              <li class="toc-row" data-item={r.status.key}>
                <a href={r.href}>{r.title}</a>
                <div class="toc-meta">
                  <span class="small muted">{r.status.note}</span>
                  <MarkButtons status={r.status} compact />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </main>
  );
}

