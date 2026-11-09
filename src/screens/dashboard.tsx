// 学習ダッシュボード（改訂設計7章）：左上に「見ずに言える数（前月と並べる）」、右に今日の数、下段に習熟バー、右下に時点。
import { useState } from 'preact/hooks';
import { cardById, cards, registry } from '../content';
import { Icon, Section } from '../components';
import { barsByScene, barsByState, emptyDayRatio, markedLines, masteredCount, masteredLastMonth, troubleCounts, type Bar } from '../logic/dashboard';
import { LEVEL_LABELS, isMastered } from '../logic/mastery';
import { countUnreviewedField } from '../logic/queue';
import { dayKey, formatDateTime } from '../logic/time';
import { addTrouble, deleteTrouble, saveSnapshot } from '../store/db';
import { useApp } from '../state';
import type { MasteryLevel, Snapshot } from '../types';
import { todayQueue } from './learn';

function Bars({ bars, label }: { bars: Bar[]; label: string }) {
  return (
    <table class="bars" aria-label={label}>
      <tbody>
        {bars.map((b) => (
          <tr>
            <th scope="row">{b.label}</th>
            <td class="bar-cell">
              {b.total === 0 ? (
                <span class="muted small">カードなし</span>
              ) : (
                <span class="bar" role="img" aria-label={`${b.total}枚中${b.mastered}枚`}>
                  <span class="bar-fill" style={{ width: `${(b.mastered / b.total) * 100}%` }} />
                </span>
              )}
            </td>
            <td class="num">{b.total === 0 ? '—' : `${b.mastered}/${b.total}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Diff({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  if (d === 0) return <span class="muted">前月末と同じ（{prev}枚）</span>;
  return (
    <span class={d > 0 ? 'inc' : 'dec'}>
      <Icon name={d > 0 ? 'up' : 'down'} /> 前月末 {prev}枚から{d > 0 ? `${d}枚増えた` : `${-d}枚減った`}
    </span>
  );
}

export function Dashboard() {
  const { data, refresh } = useApp();
  const now = Date.now();
  const mastered = masteredCount(cards, data.learning);
  const prev = masteredLastMonth(cards, data.learning, now);
  const queue = todayQueue(data, now);
  const unreviewed = countUnreviewedField(data.lookups, data.learning);
  const empty = emptyDayRatio(data.days);
  const snaps = [...data.snapshots].sort((a, b) => a.at - b.at);

  const takeSnapshot = async () => {
    const levels: Record<string, MasteryLevel> = {};
    for (const c of cards) levels[c.id] = data.learning.get(c.id)?.level ?? 0;
    const s: Snapshot = { date: dayKey(now), at: now, levels };
    await saveSnapshot(s);
    await refresh();
  };

  return (
    <main class="page">
      <h1>学習の記録</h1>
      <div class="kpis">
        <section class="kpi kpi-main" aria-labelledby="k1">
          <h2 id="k1">見ずに言えるカード</h2>
          <p class="kpi-num" data-testid="mastered">
            {mastered}
            <span class="unit">枚／{cards.length}枚</span>
          </p>
          <p class="small">
            <Diff now={mastered} prev={prev} />
          </p>
        </section>
        <section class="kpi" aria-labelledby="k2">
          <h2 id="k2">今日の想起</h2>
          <p class="kpi-num">
            {queue.length}
            <span class="unit">件</span>
          </p>
        </section>
        <section class="kpi" aria-labelledby="k3">
          <h2 id="k3">現場で引いて未復習</h2>
          <p class="kpi-num">
            {unreviewed}
            <span class="unit">枚</span>
          </p>
        </section>
        <section class="kpi" aria-labelledby="k4">
          <h2 id="k4">想起が空だった日</h2>
          <p class="kpi-num">
            {empty.days === 0 ? '—' : `${Math.round((empty.empty / empty.days) * 100)}`}
            <span class="unit">{empty.days === 0 ? '' : '%'}</span>
          </p>
          <p class="small muted">
            学習を開いた{empty.days}日のうち{empty.empty}日
          </p>
        </section>
      </div>
      <Troubles />
      <MarkedLines />
      <Section title="状態別の習熟（命に関わる順・見ずに言える枚数）">
        <Bars bars={barsByState(cards, data.learning, registry)} label="状態別の習熟" />
      </Section>
      <Section title="場面別の習熟">
        <Bars bars={barsByScene(cards, data.learning, registry)} label="場面別の習熟" />
      </Section>
      <Section title="見ずに言える段階の測定（始めと4週後）">
        <p class="small">いまの段階を全カードぶん記録する。始めたときと4週後に押す。</p>
        <button type="button" class="btn" onClick={takeSnapshot}>
          今日の段階を記録する
        </button>
        {snaps.length > 0 ? (
          <table class="snaps">
            <thead>
              <tr>
                <th scope="col">日付</th>
                {([0, 1, 2, 3, 4] as MasteryLevel[]).map((l) => (
                  <th scope="col">{LEVEL_LABELS[l]}</th>
                ))}
                <th scope="col">見ずに言える</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => {
                const vals = Object.values(s.levels);
                return (
                  <tr>
                    <td>{s.date}</td>
                    {[0, 1, 2, 3, 4].map((l) => (
                      <td class="num">{vals.filter((v) => v === l).length}</td>
                    ))}
                    <td class="num">{vals.filter((v) => isMastered(v)).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p class="empty">まだ記録がありません。</p>
        )}
      </Section>
      <p class="muted small as-of">{formatDateTime(now)} 時点・この端末の記録から</p>
    </main>
  );
}

/** 当直で困った科を1タップで残す（改良案④）。多い科が、次に科の学習を足す候補になる。 */
function Troubles() {
  const { data, refresh } = useApp();
  const [last, setLast] = useState<{ id: number; label: string } | null>(null);
  const counts = troubleCounts(data.troubles, registry, Date.now());
  const tap = async (id: string, label: string) => {
    const key = await addTrouble({ field: id, at: Date.now() });
    setLast({ id: key, label });
    await refresh();
  };
  const undo = async () => {
    if (!last) return;
    await deleteTrouble(last.id);
    setLast(null);
    await refresh();
  };
  return (
    <Section title="当直で困った科（1タップで記録）" id="troubles">
      <p class="small">困った科を押す。患者さんの情報は残さない。直近90日で多い科が、次に科の学習を足す候補。</p>
      <div class="trouble-grid">
        {registry.fields.map((f) => (
          <button type="button" class="btn btn-small" data-field={f.id} onClick={() => tap(f.id, f.label)}>
            {f.label}
          </button>
        ))}
      </div>
      {last ? (
        <p role="status" class="small">
          <Icon name="check" /> {last.label}を記録しました。
          <button type="button" class="btn-link" onClick={undo}>
            取り消す
          </button>
        </p>
      ) : null}
      {counts.length === 0 ? (
        <p class="empty">まだ記録がありません。</p>
      ) : (
        <ol class="lines" data-testid="trouble-counts">
          {counts.map((c) => (
            <li data-field={c.id}>
              {c.label}：{c.n}回
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/** 本番で迷った行。自分には想起の燃料、カードには直す箇所になる（改良案③）。 */
function MarkedLines() {
  const { data } = useApp();
  const lines = markedLines(data.marks).slice(0, 20);
  return (
    <Section title="本番で迷った行（カードを直す候補）" id="marked">
      {lines.length === 0 ? (
        <p class="empty">まだ印はありません。現場カードの下の「迷った行に印を付ける」から残せます。</p>
      ) : (
        <ul class="lines" data-testid="marked-list">
          {lines.map((l) => (
            <li data-card={l.cardId} data-line={l.line}>
              <a href={`#/card/${l.cardId}?from=study`}>{cardById.get(l.cardId)?.title ?? l.cardId}</a>：{l.text}
              <span class="muted small">（{l.n}回・最後 {formatDateTime(l.lastAt).slice(0, 10)}）</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
