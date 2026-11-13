// content/ 配下の JSON をビルド時に取り込む。通信はしない。

import type { Card, Drill, Drug, Registry, Specialty, Topic } from './types';
import registryJson from '../content/registry.json';
import { sortCards } from './logic/order';

const cardMods = import.meta.glob<Card>('../content/cards/*.json', { eager: true, import: 'default' });
const drillMods = import.meta.glob<Drill>('../content/drills/*.json', { eager: true, import: 'default' });
const specMods = import.meta.glob<Specialty>('../content/specialties/*.json', { eager: true, import: 'default' });
const topicMods = import.meta.glob<Topic>('../content/topics/*.json', { eager: true, import: 'default' });
const drugMods = import.meta.glob<Drug>('../content/drugs/*.json', { eager: true, import: 'default' });

export const registry = registryJson as unknown as Registry;
export const cards: Card[] = sortCards(Object.values(cardMods), registry);
export const drills: Drill[] = Object.values(drillMods).sort((a, b) => a.id.localeCompare(b.id));
export const specialties: Specialty[] = Object.values(specMods).sort((a, b) => a.id.localeCompare(b.id));

export const topics: Topic[] = Object.values(topicMods).sort((a, b) => a.title.localeCompare(b.title, 'ja'));
export const drugs: Drug[] = Object.values(drugMods).sort((a, b) => a.generic.localeCompare(b.generic, 'ja'));
export const topicById = new Map(topics.map((t) => [t.id, t]));
export const drugById = new Map(drugs.map((d) => [d.id, d]));
export const fieldLabel = (id: string) => registry.fields.find((f) => f.id === id)?.label ?? id;
/** 分野の中は order の小さい順（なければ後ろ）、同じなら題名の順 */
export const topicsForField = (id: string) => topics.filter((t) => t.field === id).sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000));
export const topicsForCard = (cardId: string) => topics.filter((t) => t.cards?.includes(cardId));

export const cardById = new Map(cards.map((c) => [c.id, c]));
export const drillById = new Map(drills.map((d) => [d.id, d]));
export const specialtyById = new Map(specialties.map((s) => [s.id, s]));

const labelMaps = {
  state: new Map(registry.states.map((s) => [s.id, s.label])),
  scene: new Map(registry.scenes.map((s) => [s.id, s.label])),
  equipment: new Map(registry.equipment.map((s) => [s.id, s.label])),
};
export const stateLabel = (id: string) => labelMaps.state.get(id) ?? id;
export const sceneLabel = (id: string) => labelMaps.scene.get(id) ?? id;
export const equipmentLabel = (id: string) => labelMaps.equipment.get(id) ?? id;

export function cardsForState(stateId: string): Card[] {
  return cards.filter((c) => c.states.includes(stateId));
}
export const commonCards = () => cards.filter((c) => c.common);
export const drillsForCard = (c: Card) => (c.drills ?? []).map((id) => drillById.get(id)).filter((d): d is Drill => !!d);
