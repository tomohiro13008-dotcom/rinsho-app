// 参照セクションの検索（端末内だけ）。全角半角・大文字小文字・カタカナひらがなをそろえて部分一致。

import type { Card, Drug, Topic } from '../types';

export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '');
}

export type Hit =
  | { kind: 'topic'; item: Topic }
  | { kind: 'drug'; item: Drug }
  | { kind: 'card'; item: Card };

function textOf(h: Hit): string {
  if (h.kind === 'topic') return [h.item.title, ...h.item.tags, ...h.item.summary, ...h.item.points].join(' ');
  if (h.kind === 'drug') return [h.item.generic, h.item.drugClass, ...h.item.brands.map((b) => b.name), ...h.item.doses.map((d) => d.indication)].join(' ');
  return [h.item.title, ...h.item.summary].join(' ');
}

/** 空白で区切った語をすべて含むものを返す。題名・名前に当たったものを先に。 */
export function search(q: string, data: { topics: Topic[]; drugs: Drug[]; cards: Card[] }): Hit[] {
  const terms = q.split(/\s+/).map(normalize).filter(Boolean);
  if (terms.length === 0) return [];
  const all: Hit[] = [
    ...data.drugs.map((item) => ({ kind: 'drug' as const, item })),
    ...data.topics.map((item) => ({ kind: 'topic' as const, item })),
    ...data.cards.map((item) => ({ kind: 'card' as const, item })),
  ];
  const head = (h: Hit) => normalize(h.kind === 'drug' ? [h.item.generic, ...h.item.brands.map((b) => b.name)].join(' ') : h.item.title);
  return all
    .filter((h) => {
      const t = normalize(textOf(h));
      return terms.every((x) => t.includes(x));
    })
    .sort((a, b) => Number(terms.some((x) => head(b).includes(x))) - Number(terms.some((x) => head(a).includes(x))));
}
