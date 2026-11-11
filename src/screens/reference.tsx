// 参照セクション：時間がないときに分野・項目ごとに引く教科書。冒頭に要約とポイント、次に表と詳細。
// 数値はすべて書き手が載せたもので、アプリは計算しない。
import { useMemo, useState } from 'preact/hooks';
import { cardById, cards, drugById, drugs, fieldLabel, registry, topicById, topics, topicsForField } from '../content';
import { Disclaimer, Icon, Lines, ReviewBadge, Section, Sources } from '../components';
import { search } from '../logic/search';
import { addDrillLog } from '../store/db';
import { useApp } from '../state';
import type { Rating, Table, Topic, Verification } from '../types';
import { RatingButtons } from './learn';
import { plainStatus, topicStatus } from '../logic/progress';
import { MarkButtons, progressInput, useRecordView } from './toc';

export function TableView({ t }: { t: Table }) {
  return (
    <div class="table-wrap">
      <table class={`ref-table ${t.columns.length > 3 ? 'stack' : ''}`}>
        {t.caption ? <caption>{t.caption}</caption> : null}
        <thead>
          <tr>
            {t.columns.map((c) => (
              <th scope="col">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr>
              {r.map((c, i) =>
                i === 0 ? (
                  <th scope="row">{c}</th>
                ) : (
                  <td data-label={t.columns[i]}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {t.note ? <p class="small muted">{t.note}</p> : null}
    </div>
  );
}

function VerificationView({ v }: { v: Verification }) {
  return (
    <Section title="照合の状況">
      <p class="small">
        <Icon name="check" /> 照合済み
      </p>
      <Lines items={v.checked} empty="（なし）" />
      <p class="small">
        <Icon name="alert" /> 未照合
      </p>
      <Lines items={v.unverified} empty="（なし）" />
      {v.editorialNote ? <p class="small muted">{v.editorialNote}</p> : null}
    </Section>
  );
}

const quizCount = (t: Topic) => t.sections.filter((s) => s.question && s.answer).length;

export function RefHome() {
  const [q, setQ] = useState('');
  const hits = useMemo(() => search(q, { topics, drugs, cards }), [q]);
  return (
    <main class="page">
      <h1>参照</h1>
      <label class="field">
        <span class="visually-hidden">検索</span>
        <input type="search" placeholder="病名・薬（一般名・商品名）・症状で探す" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      {q.trim() ? (
        <Section title={`検索結果（${hits.length}件）`} id="search-results">
          {hits.length === 0 ? (
            <p class="empty">見つかりませんでした。</p>
          ) : (
            <ul class="list">
              {hits.map((h) => (
                <li>
                  {h.kind === 'drug' ? (
                    <a class="btn btn-list" href={`#/drug/${h.item.id}`}>
                      <span>{h.item.generic}</span>
                      <span class="muted small">薬・{h.item.brands.map((b) => b.name).join('、')}</span>
                    </a>
                  ) : h.kind === 'topic' ? (
                    <a class="btn btn-list" href={`#/topic/${h.item.id}`}>
                      <span>{h.item.title}</span>
                      <span class="muted small">参照・{fieldLabel(h.item.field)}</span>
                    </a>
                  ) : (
                    <a class="btn btn-list" href={`#/card/${h.item.id}?from=study`}>
                      <span>{h.item.title}</span>
                      <span class="muted small">現場カード</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
      <h2 class="label-heading">分野</h2>
      <nav class="list" aria-label="分野">
        {registry.fields.map((f) => {
          const n = topicsForField(f.id).length;
          return (
            <a class="btn btn-list" href={`#/ref/field/${f.id}`} data-field={f.id}>
              <span>{f.label}</span>
              <span class="muted small">{n === 0 ? '項目なし' : `${n}項目`}</span>
            </a>
          );
        })}
      </nav>
      <h2 class="label-heading">薬（一般名の順）</h2>
      <nav class="list" aria-label="薬">
        {drugs.map((d) => (
          <a class="btn btn-list" href={`#/drug/${d.id}`}>
            <span>{d.generic}</span>
            <span class="muted small">{d.brands.map((b) => b.name).join('、')}</span>
          </a>
        ))}
      </nav>
    </main>
  );
}

export function FieldView({ id }: { id: string }) {
  const ts = topicsForField(id);
  return (
    <main class="page">
      <p class="muted small">参照｜分野</p>
      <h1>{fieldLabel(id)}</h1>
      {ts.length === 0 ? <p class="empty">この分野の項目はまだありません。</p> : null}
      <nav class="list">
        {ts.map((t) => (
          <a class="btn btn-list" href={`#/topic/${t.id}`}>
            <span>{t.title}</span>
            <span class="muted small">{t.summary[0] ?? ''}</span>
          </a>
        ))}
      </nav>
      <p>
        <a href="#/ref">参照の入口へ</a>
      </p>
    </main>
  );
}

export function TopicView({ id }: { id: string }) {
  const { data } = useApp();
  const t = topicById.get(id);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState('');
  useRecordView('topic', id, !!t);
  if (!t) return <main class="page"><p>項目が見つかりません。</p></main>;
  return (
    <main class="page" data-topic={t.id}>
      <header class="card-head">
        <p class="muted small">
          参照｜{fieldLabel(t.field)} <ReviewBadge review={t.review} />
        </p>
        <h1>{t.title}</h1>
        <Disclaimer />
        <MarkButtons status={topicStatus(t, progressInput(data, Date.now()))} />
      </header>
      <section class="summary-box" aria-labelledby="sum-h" data-testid="topic-summary">
        <h2 id="sum-h">要約</h2>
        <Lines items={t.summary} />
      </section>
      <Section title="ポイント">
        <Lines items={t.points} ordered />
      </Section>
      {(t.cards?.length ?? 0) + (t.drugs?.length ?? 0) > 0 ? (
        <nav class="row wrap" aria-label="関連">
          {(t.cards ?? []).map((c) =>
            cardById.get(c) ? (
              <a class="btn btn-small" href={`#/card/${c}?from=study`}>
                現場カード：{cardById.get(c)!.title}
              </a>
            ) : null,
          )}
          {(t.drugs ?? []).map((d) =>
            drugById.get(d) ? (
              <a class="btn btn-small" href={`#/drug/${d}`}>
                薬：{drugById.get(d)!.generic}
              </a>
            ) : null,
          )}
        </nav>
      ) : null}
      {t.sections.map((s) => (
        <section class="section" id={`sec-${s.id}`}>
          <h2>{s.title}</h2>
          {(s.paragraphs ?? []).map((p) => (
            <p>{p}</p>
          ))}
          {s.bullets ? <Lines items={s.bullets} /> : null}
          {s.table ? <TableView t={s.table} /> : null}
          {s.template ? (
            <div data-testid="note-template">
              {s.template.label ? <p class="small muted">{s.template.label}</p> : null}
              <pre class="note-template">{s.template.lines.join('\n')}</pre>
              <button
                type="button"
                class="btn btn-small"
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(s.template!.lines.join('\n'))
                    .then(() => setCopied(s.id))
                    .catch(() => setCopied(''))
                }
              >
                {copied === s.id ? <Icon name="check" /> : null}
                {copied === s.id ? '型を写しました' : '空欄の型を写す（コピー）'}
              </button>
            </div>
          ) : null}
          {s.question ? (
            <div class="qa">
              <p class="small">
                <strong>確認：</strong>
                {s.question}
              </p>
              {open[s.id] ? (
                <p class="small">答え：{s.answer}</p>
              ) : (
                <button type="button" class="btn btn-small" onClick={() => setOpen({ ...open, [s.id]: true })}>
                  答えを見る
                </button>
              )}
            </div>
          ) : null}
          {s.sourceIndexes?.length ? <p class="small muted">根拠：{s.sourceIndexes.map((i) => t.sources[i]?.title ?? `#${i}`).join('／')}</p> : null}
        </section>
      ))}
      <Section title="落とし穴">
        <Lines items={t.pitfalls} />
      </Section>
      {t.related?.length ? (
        <Section title="関連する項目">
          <ul class="lines">
            {t.related.map((r) =>
              topicById.get(r) ? (
                <li>
                  <a href={`#/topic/${r}`}>{topicById.get(r)!.title}</a>
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      ) : null}
      {quizCount(t) > 0 ? (
        <p>
          <a class="btn" href={`#/topic/${t.id}/quiz`}>
            確認問題を通して解く（{quizCount(t)}問）
          </a>
        </p>
      ) : null}
      <VerificationView v={t.verification} />
      <Sources sources={t.sources} updatedAt={t.updatedAt} review={t.review} />
    </main>
  );
}

export function DrugView({ id }: { id: string }) {
  const { data } = useApp();
  const d = drugById.get(id);
  useRecordView('drug', id, !!d);
  if (!d) return <main class="page"><p>薬が見つかりません。</p></main>;
  return (
    <main class="page" data-drug={d.id}>
      <header class="card-head">
        <p class="muted small">
          参照｜薬｜{d.drugClass} <ReviewBadge review={d.review} />
        </p>
        <h1>{d.generic}</h1>
        <Disclaimer />
        <MarkButtons status={plainStatus('drug', d.id, progressInput(data, Date.now()))} />
      </header>
      <section class="summary-box" aria-labelledby="dsum-h">
        <h2 id="dsum-h">要約</h2>
        <Lines items={d.summary} />
      </section>
      <Section title="商品名・規格">
        <TableView t={{ columns: ['商品名', '規格・含量（製造販売）'], rows: d.brands.map((b) => [b.name, b.maker ? `${b.strength}（${b.maker}）` : b.strength]) }} />
      </Section>
      <Section title="用法用量">
        <div class="doses">
          {d.doses.map((r) => (
            <div class="dose">
              <p>
                <strong>{r.indication}</strong>（{r.population}）
              </p>
              <p class="dose-main">
                {r.dose}・{r.route}
              </p>
              {r.repeat ? <p class="small">{r.repeat}</p> : null}
              {r.note ? <p class="small">注：{r.note}</p> : null}
              <p class="small muted">出どころ：{r.basis}</p>
            </div>
          ))}
        </div>
      </Section>
      {d.preparation.length > 0 ? (
        <Section title="作り方・製剤の量">
          <TableView t={{ columns: ['用途', '作り方'], rows: d.preparation.map((p) => [p.label, p.recipe]) }} />
        </Section>
      ) : null}
      {d.weightTable ? (
        <Section title="体重別の早見表">
          <TableView t={d.weightTable} />
        </Section>
      ) : null}
      <Section title="注意">
        <Lines items={d.cautions} />
      </Section>
      {d.topics?.length ? (
        <p class="row wrap">
          {d.topics.map((t) =>
            topicById.get(t) ? (
              <a class="btn btn-small" href={`#/topic/${t}`}>
                参照：{topicById.get(t)!.title}
              </a>
            ) : null,
          )}
        </p>
      ) : null}
      <VerificationView v={d.verification} />
      <Sources sources={d.sources} updatedAt={d.updatedAt} review={d.review} />
      <p class="small muted">採用薬・規格は施設ごとに違う。使う前に施設の採用薬と添付文書を確かめる。</p>
    </main>
  );
}

/** 参照項目の確認問題を通して解く。結果は練習の記録（drillLogs）に `topic:<id>:<節>` で残す。 */
export function TopicQuiz({ id }: { id: string }) {
  const { refresh } = useApp();
  const t = topicById.get(id);
  const qs = t ? t.sections.filter((s) => s.question && s.answer) : [];
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  if (!t) return <main class="page"><p>項目が見つかりません。</p></main>;
  if (i >= qs.length)
    return (
      <main class="page" data-testid="topic-quiz-done">
        <p>
          <Icon name="check" /> {qs.length}問を記録しました。
        </p>
        <a class="btn btn-primary" href={`#/topic/${t.id}`}>
          項目に戻る
        </a>
      </main>
    );
  const s = qs[i];
  const rate = async (r: Rating) => {
    await addDrillLog({ drillId: `topic:${t.id}:${s.id}`, at: Date.now(), result: r });
    await refresh();
    setRevealed(false);
    setI(i + 1);
  };
  return (
    <main class="page" data-topic-quiz={t.id}>
      <p class="muted small">
        確認問題｜{t.title}（{i + 1}/{qs.length}）
      </p>
      <h1>{s.question}</h1>
      {!revealed ? (
        <button type="button" class="btn btn-primary" onClick={() => setRevealed(true)}>
          答えを見る
        </button>
      ) : (
        <>
          <Section title="答え">
            <p>{s.answer}</p>
          </Section>
          <RatingButtons onRate={rate} />
        </>
      )}
    </main>
  );
}

export const topicQuizTopics = () => topics.filter((t) => quizCount(t) > 0);
