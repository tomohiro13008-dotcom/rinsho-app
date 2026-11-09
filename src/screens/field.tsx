// 現場モード：状態の大ボタン → カード。全文をすぐ見せ、何も問わない。開いた記録だけ残す。
import { useEffect } from 'preact/hooks';
import { cardById, cardsForState, commonCards, equipmentLabel, registry, sceneLabel, stateLabel } from '../content';
import { Disclaimer, Icon, Lines, ReviewBadge, Section, Sources } from '../components';
import { resolveStep } from '../logic/facility';
import { addLookup } from '../store/db';
import { needsExportReminder, useApp } from '../state';
import type { Card, FacilityProfile } from '../types';

export function cardHref(c: Card) {
  return `#/card/${c.id}`;
}

function stateHref(stateId: string) {
  const cs = cardsForState(stateId);
  return cs.length === 1 ? cardHref(cs[0]) : `#/state/${stateId}`;
}

export function ExportReminder() {
  const { data } = useApp();
  if (!needsExportReminder(data, Date.now())) return null;
  return (
    <p class="notice" role="status">
      <Icon name="info" /> 最後の書き出しから30日以上たちました。端末の保存領域が消えることがあるため、
      <a href="#/settings">設定から書き出す</a>
    </p>
  );
}

export function Home() {
  const { data } = useApp();
  return (
    <main class="page">
      <ExportReminder />
      <h1 class="visually-hidden">現場</h1>
      <nav aria-label="共通カード" class="common-row">
        {commonCards().map((c) => (
          <a class="btn btn-common" href={cardHref(c)}>
            {c.title}
          </a>
        ))}
      </nav>
      <h2 class="label-heading">何が起きているか</h2>
      <nav aria-label="状態" class="state-grid">
        {registry.states.map((s) => {
          const n = cardsForState(s.id).length;
          return (
            <a class="btn btn-state" href={stateHref(s.id)} data-state={s.id}>
              <span>{s.label}</span>
              {n === 0 ? <span class="muted small">カードなし</span> : null}
            </a>
          );
        })}
      </nav>
      <p class="muted small">
        いまの施設：{data.active.name}（{sceneLabel(data.active.tier)}）・<a href="#/settings">変える</a>
      </p>
    </main>
  );
}

export function StateList({ stateId }: { stateId: string }) {
  const { data } = useApp();
  const cs = cardsForState(stateId);
  const here = cs.filter((c) => c.scenes.includes(data.active.tier));
  const other = cs.filter((c) => !c.scenes.includes(data.active.tier));
  return (
    <main class="page">
      <h1>{stateLabel(stateId)}</h1>
      {cs.length === 0 ? <p class="empty">この状態のカードはまだありません。</p> : null}
      <nav class="list">
        {here.map((c) => (
          <a class="btn btn-list" href={cardHref(c)}>
            {c.title}
          </a>
        ))}
      </nav>
      {other.length > 0 ? (
        <>
          <h2 class="label-heading">ほかの場面のカード</h2>
          <nav class="list">
            {other.map((c) => (
              <a class="btn btn-list" href={cardHref(c)}>
                {c.title}
              </a>
            ))}
          </nav>
        </>
      ) : null}
      <p>
        <a href="#/">ホームへ戻る</a>
      </p>
    </main>
  );
}

/** カードの本文。現場（field）と学習の答え合わせ（reveal）で共用する。 */
export function CardBody({ card, profile, showAllTiers = false }: { card: Card; profile: FacilityProfile; showAllTiers?: boolean }) {
  const steps = card.steps.map((s) => resolveStep(s, profile.switches));
  return (
    <>
      <div class="first-screen">
        <section class="first-actions" aria-labelledby="fa-h">
          <h2 id="fa-h">まずやること</h2>
          <Lines items={card.firstActions} ordered />
        </section>
        <section class="call-help" aria-labelledby="cfh-h" data-testid="call-for-help">
          <h2 id="cfh-h">
            <Icon name="alert" /> 呼ぶ基準
          </h2>
          <Lines items={card.callForHelp.criteria} />
          {card.callForHelp.whom ? <p>誰を：{card.callForHelp.whom}</p> : null}
          {card.callForHelp.script ? <p>第一声：{card.callForHelp.script}</p> : null}
          {profile.contacts.trim() ? (
            <p class="contacts">
              <Icon name="phone" /> 連絡先（自施設メモ）：{profile.contacts}
            </p>
          ) : null}
        </section>
      </div>
      <Section title="分かれ道">
        {card.branches.length === 0 ? (
          <p class="empty">（未記入）</p>
        ) : (
          <ul class="lines">
            {card.branches.map((b) => (
              <li>
                もし {b.if} → {b.then}
                {b.else ? `／そうでなければ ${b.else}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="手順">
        {steps.length === 0 ? (
          <p class="empty">（未記入）</p>
        ) : (
          <ol class="lines steps">
            {steps.map((r) => (
              <li class={r.replaced ? 'step-missing' : ''} data-replaced={r.replaced ? 'true' : 'false'}>
                {r.replaced ? (
                  <span class="tag tag-danger">
                    <Icon name="swap" /> {r.missing.map(equipmentLabel).join('・')}がない
                  </span>
                ) : null}
                <span>{r.text}</span>
                {showAllTiers && r.step.requires?.length ? (
                  <div class="tier-diff muted">
                    {r.replaced ? `設備があれば：${r.step.text}` : `${r.step.requires.map(equipmentLabel).join('・')}がなければ：${r.step.ifMissing ?? '（未記入）'}`}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Section>
      {card.transfer ? (
        <Section title="送る">
          <p>{card.transfer}</p>
        </Section>
      ) : null}
      <Section title="要点">
        <Lines items={card.summary} />
      </Section>
      <Section title="落とし穴">
        <Lines items={card.pitfalls} />
      </Section>
      {profile.notes.trim() ? (
        <Section title="自施設メモ">
          <p class="prewrap">{profile.notes}</p>
        </Section>
      ) : null}
      <Sources sources={card.sources} updatedAt={card.updatedAt} review={card.review} />
    </>
  );
}

export function CardHeader({ card, profile, kind = 'カード' }: { card: Card; profile: FacilityProfile; kind?: string }) {
  const where = sceneLabel(profile.tier);
  const what = card.common ? '共通' : card.states.map(stateLabel).join('・');
  return (
    <header class="card-head">
      <p class="muted small">
        {where}｜{what}｜{kind} <ReviewBadge review={card.review} />
      </p>
      <h1>{card.title}</h1>
      <Disclaimer />
    </header>
  );
}

export function CardView({ cardId, from }: { cardId: string; from: string | null }) {
  const { data, refresh } = useApp();
  const card = cardById.get(cardId);
  useEffect(() => {
    // 科の学習などから参照で開いたとき（from=study）は記録しない
    if (!card || from === 'study') return;
    const mode = from === 'briefing' ? 'briefing' : 'field';
    void addLookup({ cardId: card.id, at: Date.now(), mode }).then(refresh);
  }, [cardId]);
  if (!card) return <main class="page"><p>カードが見つかりません。</p></main>;
  return (
    <main class="page card" data-card={card.id}>
      <CardHeader card={card} profile={data.active} />
      <CardBody card={card} profile={data.active} />
    </main>
  );
}
