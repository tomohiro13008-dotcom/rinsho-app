// 学習モード：開いたら最初に「今日の想起」。次に当直前ブリーフィング。練習は種類ごとに形を変える。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { cardById, cards, drillById, drills, drillsForCard, specialties, specialtyById } from '../content';
import { Icon, Lines, ReviewBadge, Section, Sources } from '../components';
import { buildTodayQueue, type QueueItem } from '../logic/queue';
import { DEFAULT_TARGET_SECONDS, LEVEL_LABELS, displayFor, nextLevel } from '../logic/mastery';
import { cardFlagsForQueue, plainStatus } from '../logic/progress';
import { MarkButtons, progressInput, useRecordView } from './toc';
import { getScheduler } from '../logic/srs';
import { dayKey, formatDateTime } from '../logic/time';
import { addDrillLog, recordDayIfFirst, saveLearning } from '../store/db';
import { checkItems, pickFirstCall, ratingFromChecks } from '../logic/checklist';
import { useApp, type AppData } from '../state';
import type { Card, Drill, HistoryEntry, LearningState, MasteryLevel, QueueSource, Rating } from '../types';
import { CardBody, ExportReminder } from './field';
import { topicQuizTopics } from './reference';

export function todayQueue(d: AppData, now: number): QueueItem[] {
  const { important, review } = cardFlagsForQueue(d.flags, d.learning);
  return buildTodayQueue({ cards, learning: d.learning, lookups: d.lookups, marks: d.marks, now, important, reviewFlags: review });
}

const SOURCE_LABEL: Record<QueueSource, string> = {
  marked: '迷った行に印',
  field: '現場で引いた',
  briefing: 'ブリーフィングで開いた',
  review: '復習の期日',
  new: 'はじめての1枚',
  manual: '自分で選んだ',
};

const levelOf = (d: AppData, id: string): MasteryLevel => d.learning.get(id)?.level ?? 0;

/** 当直前ブリーフィングの1枚：いまの施設の場面で、習熟がいちばん低く、最後の練習が古いもの。 */
export function briefingPick(d: AppData, skip: number): Card | undefined {
  const scene = cards.filter((c) => !c.common && c.scenes.includes(d.active.tier));
  const pool = scene.length > 0 ? scene : cards.filter((c) => !c.common);
  const last = (id: string) => d.learning.get(id)?.history.at(-1)?.at ?? 0;
  const sorted = [...pool].sort((a, b) => levelOf(d, a.id) - levelOf(d, b.id) || last(a.id) - last(b.id));
  return sorted.length ? sorted[skip % sorted.length] : undefined;
}

export function Learn() {
  const { data, refresh } = useApp();
  const now = Date.now();
  const queue = useMemo(() => todayQueue(data, now), [data]);
  const [skip, setSkip] = useState(0);
  useEffect(() => {
    void recordDayIfFirst({ date: dayKey(now), firstQueueSize: queue.length }).then(refresh);
    // 1日の最初に開いたときの件数だけ残す
  }, []);
  const brief = briefingPick(data, skip);
  return (
    <main class="page">
      <ExportReminder />
      <h1>学習</h1>
      <Section title={`今日の想起（${queue.length}件）`} id="today">
        {queue.length === 0 ? (
          <p class="empty">今日の想起はありません。下から選んで練習できます。</p>
        ) : (
          <ul class="queue">
            {queue.map((q) => {
              const c = cardById.get(q.cardId)!;
              // 第一声で問うカードは、題名を出すと答えが分かるので伏せる
              const hidden = asksByFirstCall(c, levelOf(data, q.cardId));
              return (
                <li data-card={q.cardId} data-source={q.source}>
                  <a class="btn btn-list" href={`#/practice/${q.cardId}/${q.source}`}>
                    <span>{hidden ? '看護師の第一声から当てる' : c.title}</span>
                    <span class="muted small">
                      {SOURCE_LABEL[q.source]}
                      {q.lookupAt ? `（${formatDateTime(q.lookupAt)}）` : ''}・{LEVEL_LABELS[levelOf(data, q.cardId)]}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title="当直前ブリーフィング" id="briefing">
        {brief ? (
          <div class="brief">
            <p>
              <strong>{brief.title}</strong>
            </p>
            <p>頭の中で「最初の5分」を言ってから開く。</p>
            <div class="row">
              <a class="btn btn-primary" href={`#/card/${brief.id}?from=briefing`}>
                言ったので開く
              </a>
              <button class="btn" type="button" onClick={() => setSkip(skip + 1)}>
                別のカード
              </button>
            </div>
          </div>
        ) : (
          <p class="empty">カードがありません。</p>
        )}
      </Section>
      <Section title="自分で選んで練習">
        <ul class="list">
          {cards.map((c) => (
            <li>
              <a class="btn btn-list" href={`#/practice/${c.id}/manual`}>
                <span>{c.title}</span>
                <span class="muted small">{LEVEL_LABELS[levelOf(data, c.id)]}</span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="参照の確認問題">
        <ul class="list">
          {topicQuizTopics().map((t) => {
            const done = t.sections.filter((s) => s.question && data.drillLogs.some((l) => l.drillId === `topic:${t.id}:${s.id}`)).length;
            const total = t.sections.filter((s) => s.question).length;
            return (
              <li>
                <a class="btn btn-list" href={`#/topic/${t.id}/quiz`}>
                  <span>{t.title}</span>
                  <span class="muted small">
                    {done}/{total}問を1回以上
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="科の学習（柱B）">
        <ul class="list">
          {specialties.map((s) => (
            <li>
              <a class="btn btn-list" href={`#/specialty/${s.id}`}>
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

/** 段階2以上（見ずに問う段階）で第一声があれば、題名でなく第一声で問う（改良案①）。段階0〜1は全文を見せる。 */
export function asksByFirstCall(card: Card, level: MasteryLevel): boolean {
  return level >= 2 && (card.firstCalls ?? []).some((x) => x.trim());
}

function hint(s: string, keyword?: string): string {
  if (keyword) return keyword;
  return s.length <= 4 ? s : `${s.slice(0, 4)}…`;
}

function useStopwatch(running: boolean) {
  const [start] = useState(() => Date.now());
  const [stopAt, setStopAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running || stopAt) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running, stopAt]);
  const seconds = Math.round(((stopAt ?? Date.now()) - start) / 1000);
  return { seconds, stop: () => setStopAt(Date.now()) };
}

const RATINGS: { r: Rating; label: string }[] = [
  { r: 'again', label: 'もう一度' },
  { r: 'hard', label: '難しかった' },
  { r: 'good', label: '言えた' },
  { r: 'easy', label: '楽に言えた' },
];

export function RatingButtons({ onRate }: { onRate: (r: Rating) => void }) {
  return (
    <div class="ratings" role="group" aria-label="自己評価">
      {RATINGS.map(({ r, label }) => (
        <button type="button" class={`btn ${r === 'good' || r === 'easy' ? 'btn-success' : ''}`} data-rating={r} onClick={() => onRate(r)}>
          {r === 'good' || r === 'easy' ? <Icon name="check" /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

export async function recordPractice(
  prev: LearningState | undefined,
  cardId: string,
  rating: Rating,
  seconds: number,
  source: QueueSource,
  now: number,
  target = DEFAULT_TARGET_SECONDS,
  extra: Pick<HistoryEntry, 'prompt' | 'checked' | 'total' | 'missed'> = {},
): Promise<LearningState> {
  const level = prev?.level ?? 0;
  const levelAfter = nextLevel(level, rating, seconds, target);
  const sched = getScheduler().next(prev?.intervalDays ?? 0, rating, now);
  const st: LearningState = {
    cardId,
    level: levelAfter,
    intervalDays: sched.intervalDays,
    due: sched.due,
    history: [...(prev?.history ?? []), { at: now, result: rating, seconds, levelAfter, source, ...extra }],
  };
  await saveLearning(st);
  return st;
}

export function Practice({ cardId, source }: { cardId: string; source: QueueSource }) {
  const { data, refresh } = useApp();
  const card = cardById.get(cardId);
  const prev = data.learning.get(cardId);
  const [level] = useState<MasteryLevel>(prev?.level ?? 0);
  const display = displayFor(level);
  const [revealed, setRevealed] = useState(display === 'full');
  const [done, setDone] = useState<LearningState | null>(null);
  const [allTiers, setAllTiers] = useState(false);
  const [firstCall] = useState(() => (card && asksByFirstCall(card, level) ? pickFirstCall(card) : undefined));
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const sw = useStopwatch(!revealed);
  if (!card) return <main class="page"><p>カードが見つかりません。</p></main>;

  const items = checkItems(card, !!firstCall);
  const lastAt = prev?.history.at(-1)?.at ?? -Infinity;
  const marked = data.marks.filter((m) => m.cardId === card.id && m.at > lastAt);

  const save = async (r: Rating, extra: Pick<HistoryEntry, 'checked' | 'total' | 'missed'> = {}) => {
    if (!revealed) sw.stop();
    const st = await recordPractice(prev, card.id, r, sw.seconds, source, Date.now(), DEFAULT_TARGET_SECONDS, {
      ...(firstCall ? { prompt: firstCall } : {}),
      ...extra,
    });
    setDone(st);
    await refresh();
  };
  const saveChecks = () => {
    const missed = items.filter((i) => !checked.has(i.key)).map((i) => i.key);
    void save(ratingFromChecks(items.length - missed.length, items.length), {
      checked: items.length - missed.length,
      total: items.length,
      missed,
    });
  };
  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
  };

  if (done) {
    const ds = drillsForCard(card);
    const last = done.history.at(-1);
    return (
      <main class="page" data-testid="practice-done">
        <h1>{card.title}</h1>
        <p>
          <Icon name="check" /> 記録しました。
          {last?.total ? `言えた項目：${last.checked}/${last.total}。` : ''}
          段階：{LEVEL_LABELS[done.level]}。次の出題：{done.due ? formatDateTime(done.due).slice(0, 10) : '—'}
        </p>
        {ds.length > 0 ? (
          <Section title="このカードの練習">
            <ul class="list">
              {ds.map((d) => (
                <li>
                  <a class="btn btn-list" href={`#/drill/${d.id}`}>
                    {DRILL_KIND_LABEL[d.kind]}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        <p>
          <a class="btn btn-primary" href="#/learn">
            学習に戻る
          </a>
        </p>
      </main>
    );
  }

  const titleHidden = !!firstCall && !revealed;
  return (
    <main class="page" data-card={card.id} data-display={display} data-asked={firstCall ? 'first-call' : 'title'}>
      <p class="muted small">
        {SOURCE_LABEL[source]}・いまの段階：{LEVEL_LABELS[level]} <ReviewBadge review={card.review} />
      </p>
      {titleHidden ? (
        <>
          <p class="muted small">看護師の第一声</p>
          <h1 data-testid="first-call">「{firstCall}」</h1>
        </>
      ) : (
        <h1>{card.title}</h1>
      )}
      {firstCall && revealed ? <p class="muted small" data-testid="first-call">問い：「{firstCall}」</p> : null}
      {!revealed ? (
        <>
          <p class="prompt">
            {firstCall ? '見ずに、どのカードか・「まずやること」・「呼ぶ基準」を言う。' : '見ずに「まずやること」と「呼ぶ基準」を言う。'}
          </p>
          {display === 'keywords' ? (
            <div class="hints">
              <h2>ヒント</h2>
              <Lines items={card.firstActions.map((s) => hint(s))} ordered empty="（まずやることが未記入）" />
              <Lines items={card.callForHelp.criteria.map((s) => hint(s))} empty="（呼ぶ基準が未記入）" />
            </div>
          ) : null}
          {display === 'blankTimed' ? (
            <p class="timer">
              {sw.seconds}秒／目安 {DEFAULT_TARGET_SECONDS}秒（仮）
            </p>
          ) : (
            <p class="muted small">{sw.seconds}秒</p>
          )}
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              sw.stop();
              setRevealed(true);
            }}
          >
            言ったので答えを見る
          </button>
        </>
      ) : level === 0 ? (
        <>
          <p class="prompt">まず全文を読む。次からは見ずに問う。</p>
          <div class="reveal">
            <CardBody card={card} profile={data.active} />
          </div>
          <button type="button" class="btn btn-primary" data-rating="good" onClick={() => save('good')}>
            読んだ
          </button>
        </>
      ) : (
        <>
          {marked.length > 0 ? (
            <section class="marked-lines" aria-labelledby="ml-h" data-testid="marked-lines">
              <h2 id="ml-h">
                <Icon name="alert" /> 本番で迷った行
              </h2>
              <ul class="lines">
                {[...new Set(marked.map((m) => m.text))].map((t) => (
                  <li>{t}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {items.length > 0 ? (
            <section class="checklist" aria-labelledby="cl-h" data-testid="checklist">
              <h2 id="cl-h">言えた項目に印を付ける</h2>
              <ul class="check-items">
                {items.map((it) => (
                  <li>
                    <label class="check-item" data-key={it.key}>
                      <input type="checkbox" checked={checked.has(it.key)} onChange={() => toggle(it.key)} />
                      <span>
                        <span class="muted small">{it.group === 'which' ? 'カード' : it.group === 'first' ? 'まずやること' : '呼ぶ基準'}</span>
                        <br />
                        {it.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" class="btn btn-primary" data-testid="save-checks" onClick={saveChecks}>
                記録する（{checked.size}/{items.length}）
              </button>
            </section>
          ) : (
            <RatingButtons onRate={(r) => void save(r)} />
          )}
          <label class="toggle">
            <input type="checkbox" checked={allTiers} onChange={(e) => setAllTiers((e.target as HTMLInputElement).checked)} />
            ほかの段階の施設だとどう変わるかも見る
          </label>
          <div class="reveal">
            <CardBody card={card} profile={data.active} showAllTiers={allTiers} />
          </div>
        </>
      )}
    </main>
  );
}


export const DRILL_KIND_LABEL: Record<Drill['kind'], string> = {
  sequence: '並べ替え（手順の順番）',
  branch: '分かれ道を選ぶ（理由を一言）',
  recall: '思い出す（数値・基準）',
  sayAloud: '声に出して伝える',
  scenario: 'シナリオを通す',
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.length > 1 && a.every((x, i) => x === xs[i])) a.push(a.shift()!);
  return a;
}

function Sequence({ drill, onResult }: { drill: Drill; onResult: (ok: boolean) => void }) {
  const items = drill.items ?? [];
  const [pool, setPool] = useState(() => shuffle(items));
  const [picked, setPicked] = useState<string[]>([]);
  const finished = picked.length === items.length;
  const ok = finished && picked.every((x, i) => x === items[i]);
  return (
    <div class="sequence">
      <p class="muted small">正しい順にタップする。</p>
      <ol class="lines">
        {picked.map((x) => (
          <li>{x}</li>
        ))}
      </ol>
      <div class="row wrap">
        {pool.map((x, i) => (
          <button
            type="button"
            class="btn"
            onClick={() => {
              setPicked([...picked, x]);
              setPool(pool.filter((_, j) => j !== i));
            }}
          >
            {x}
          </button>
        ))}
      </div>
      {finished ? (
        <div>
          <p class={ok ? 'ok' : 'ng'}>
            <Icon name={ok ? 'check' : 'alert'} /> {ok ? '正しい順番' : '順番が違う'}
          </p>
          {!ok ? <Lines items={items} ordered /> : null}
          <button type="button" class="btn btn-primary" onClick={() => onResult(ok)}>
            記録する
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DrillView({ drillId }: { drillId: string }) {
  const { refresh } = useApp();
  const drill = drillById.get(drillId);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const sw = useStopwatch(!revealed);
  if (!drill) return <main class="page"><p>練習が見つかりません。</p></main>;
  const back = drill.cardId ? '#/learn' : `#/specialty/${drill.specialty}`;
  const save = async (r: Rating) => {
    await addDrillLog({ drillId: drill.id, at: Date.now(), result: r });
    setSaved(true);
    await refresh();
  };
  if (saved)
    return (
      <main class="page" data-testid="drill-done">
        <p>
          <Icon name="check" /> 記録しました。
        </p>
        <a class="btn btn-primary" href={back}>
          戻る
        </a>
      </main>
    );
  return (
    <main class="page" data-drill={drill.id}>
      <p class="muted small">{DRILL_KIND_LABEL[drill.kind]}</p>
      <h1>{drill.prompt}</h1>
      {drill.kind === 'sequence' ? (
        <Sequence drill={drill} onResult={(ok) => save(ok ? 'good' : 'again')} />
      ) : !revealed ? (
        <>
          {drill.kind === 'sayAloud' ? <p class="prompt">声に出して言う。</p> : null}
          {drill.kind === 'branch' ? <p class="prompt">どちらに進むかと、理由を一言で言う。</p> : null}
          <p class="muted small">
            {sw.seconds}秒{drill.targetSeconds ? `／目安 ${drill.targetSeconds}秒` : ''}
          </p>
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              sw.stop();
              setRevealed(true);
            }}
          >
            答えを見る
          </button>
        </>
      ) : (
        <>
          <Section title="答え">
            <p>{drill.answer}</p>
            {drill.why ? <p class="muted">理由：{drill.why}</p> : null}
          </Section>
          <RatingButtons onRate={save} />
        </>
      )}
    </main>
  );
}

/** 相談の伝え方は、声に出して言ってから見る（改良案④：電話相談は声に出す練習に回す）。 */
function ConsultScript({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <p data-testid="consult-script">{text}</p>
  ) : (
    <div>
      <p class="prompt">専門医への電話の最初の30秒を、声に出して言ってから開く。</p>
      <button type="button" class="btn" onClick={() => setOpen(true)}>
        言ったので見る
      </button>
    </div>
  );
}

export function SpecialtyView({ id }: { id: string }) {
  const { data } = useApp();
  const s = specialtyById.get(id);
  useRecordView('spec', id, !!s);
  if (!s) return <main class="page"><p>科が見つかりません。</p></main>;
  const ds = drills.filter((d) => d.specialty === id);
  const doneIds = new Set(data.drillLogs.map((l) => l.drillId));
  const doneCount = ds.filter((d) => doneIds.has(d.id)).length;
  return (
    <main class="page">
      <p class="muted small">
        科の学習｜{s.name} <ReviewBadge review={s.review} />
      </p>
      <h1>{s.name}</h1>
      <MarkButtons status={plainStatus('spec', s.id, progressInput(data, Date.now()))} />
      {s.externalLink ? (
        <p>
          <a href={s.externalLink.url}>{s.externalLink.label}</a>
        </p>
      ) : null}
      <Section title="見逃してはいけない疾患">
        {s.mustNotMiss.length === 0 ? (
          <p class="empty">（未記入）</p>
        ) : (
          <ul class="lines">
            {s.mustNotMiss.map((m) => (
              <li>
                {m.disease}
                {m.timeWindow ? `（${m.timeWindow}）` : ''}
                {m.cardId && cardById.get(m.cardId) ? (
                  <>
                    {' '}
                    → <a href={`#/card/${m.cardId}?from=study`}>{cardById.get(m.cardId)!.title}</a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="朝まで待てない条件">
        <Lines items={s.cannotWait ?? []} />
      </Section>
      <Section title="朝まで待てる条件">
        <Lines items={s.canWait ?? []} />
      </Section>
      <Section title="専門医が来るまでにやってはいけないこと">
        <Lines items={s.doNotDo ?? []} />
      </Section>
      <Section title="よくあるもの">
        <Lines items={s.common} />
      </Section>
      <Section title="緊急度を見分ける問い">
        <Lines items={s.urgencyQuestions} />
      </Section>
      <Section title="処置の前に準備すること">
        <Lines items={s.procedurePrep} />
      </Section>
      <Section title="専門医のコツ">
        <Lines items={s.tips} />
      </Section>
      <Section title="相談の伝え方">
        {s.consultScript ? <ConsultScript text={s.consultScript} /> : <p class="empty">（未記入）</p>}
      </Section>
      <Section title={`この科の練習（${doneCount}/${ds.length}問を1回以上）`}>
        {ds.length === 0 ? (
          <p class="empty">練習はまだありません。</p>
        ) : (
          <ul class="list">
            {ds.map((d) => (
              <li>
                <a class="btn btn-list" href={`#/drill/${d.id}`}>
                  <span>{DRILL_KIND_LABEL[d.kind]}</span>
                  <span class="muted small">{doneIds.has(d.id) ? '解いた' : '未練習'}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Sources sources={s.sources} updatedAt={s.updatedAt} review={s.review} />
    </main>
  );
}

