import type { Card, Registry } from '../types';

/** 共通カードを先に、次に状態の並び（命に関わる順）、同じなら id 順。 */
export function sortCards(cards: Card[], registry: Registry): Card[] {
  const rank = new Map(registry.states.map((s, i) => [s.id, i]));
  const key = (c: Card) => Math.min(...c.states.map((s) => rank.get(s) ?? 999), 999);
  return [...cards].sort((a, b) => {
    if (!!a.common !== !!b.common) return a.common ? -1 : 1;
    const d = key(a) - key(b);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}
