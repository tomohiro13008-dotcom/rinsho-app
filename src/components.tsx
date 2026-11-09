import type { ComponentChildren } from 'preact';
import type { Review, Source } from './types';

const paths: Record<string, string> = {
  alert: 'M12 3 2 21h20L12 3Zm0 6v6m0 3v.01',
  check: 'M4 12l5 5L20 6',
  up: 'M12 19V5m-6 6 6-6 6 6',
  down: 'M12 5v14m-6-6 6 6 6-6',
  swap: 'M7 7h13l-4-4M17 17H4l4 4',
  phone: 'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z',
  info: 'M12 8v.01M12 11v6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
};

export function Icon({ name, label }: { name: keyof typeof paths | string; label?: string }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label}>
      <path d={paths[name]} fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export const REVIEW_LABELS = ['AI下書き・未照合', '自分で照合済み', '専門医レビュー済み', '現場で使って確認'] as const;

export function ReviewBadge({ review }: { review: Review }) {
  const draft = review.level === 0;
  return (
    <span class={`badge ${draft ? 'badge-draft' : ''}`}>
      {draft ? '下書き・未照合' : REVIEW_LABELS[review.level]}
      {review.byRole ? `（${review.byRole}）` : ''}
    </span>
  );
}

/** 空の欄は「未記入」と文字で示す（色だけで示さない）。 */
export function Lines({ items, ordered, empty = '（未記入）' }: { items: string[]; ordered?: boolean; empty?: string }) {
  if (items.length === 0) return <p class="empty">{empty}</p>;
  const L = ordered ? 'ol' : 'ul';
  return (
    <L class="lines">
      {items.map((t) => (
        <li>{t}</li>
      ))}
    </L>
  );
}

export function Section({ title, children, id }: { title: string; children: ComponentChildren; id?: string }) {
  return (
    <section class="section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Sources({ sources, updatedAt, review }: { sources: Source[]; updatedAt: string; review: Review }) {
  return (
    <footer class="sources" aria-label="根拠">
      <h2>根拠・版・更新日</h2>
      {sources.length === 0 ? (
        <p class="empty">出典は未記入</p>
      ) : (
        <ul>
          {sources.map((s) => (
            <li>
              {s.title}
              {s.edition ? `（${s.edition}）` : ''}
              {s.locator ? ` ${s.locator}` : ''}
              {!s.public ? ' ［自分用］' : ''}
              {s.checkedScope ? <div class="muted">照合：{s.checkedScope}</div> : null}
            </li>
          ))}
        </ul>
      )}
      <p class="muted">
        更新日 {updatedAt}・レビュー：<ReviewBadge review={review} />
      </p>
    </footer>
  );
}

export function Disclaimer() {
  return <p class="disclaimer">教育・訓練用。最終判断は担当医と施設の手順に従う</p>;
}
