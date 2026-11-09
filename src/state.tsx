// アプリ全体の状態（端末内の記録を読み込んで持つ）。
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { DayLog, DrillLog, FacilityProfile, LearningState, Lookup, Mark, Snapshot, Trouble } from './types';
import * as db from './store/db';
import { registry } from './content';
import { newProfile } from './logic/facility';
import { DAY } from './logic/time';

export interface AppData {
  profiles: FacilityProfile[];
  active: FacilityProfile;
  learning: Map<string, LearningState>;
  lookups: Lookup[];
  drillLogs: DrillLog[];
  days: DayLog[];
  snapshots: Snapshot[];
  marks: Mark[];
  troubles: Trouble[];
  lastExportAt: number | null;
  firstUseAt: number;
  persisted: boolean | null;
}

interface Ctx {
  data: AppData | null;
  refresh: () => Promise<void>;
}

const AppCtx = createContext<Ctx>({ data: null, refresh: async () => {} });

async function load(): Promise<AppData> {
  let profiles = await db.listProfiles();
  if (profiles.length === 0) {
    const p = newProfile(registry, 'ward', '自施設');
    await db.saveProfile(p);
    await db.setSetting('activeProfileId', p.id);
    profiles = [p];
  }
  let firstUseAt = await db.getSetting<number>('firstUseAt');
  if (!firstUseAt) {
    firstUseAt = Date.now();
    await db.setSetting('firstUseAt', firstUseAt);
  }
  const activeId = await db.getSetting<string>('activeProfileId');
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0];
  return {
    profiles,
    active,
    learning: await db.listLearning(),
    lookups: await db.listLookups(),
    drillLogs: await db.getAll<DrillLog>('drillLogs'),
    days: await db.listDays(),
    snapshots: await db.listSnapshots(),
    marks: await db.listMarks(),
    troubles: await db.listTroubles(),
    lastExportAt: (await db.getSetting<number>('lastExportAt')) ?? null,
    firstUseAt,
    persisted: (await db.getSetting<boolean>('persisted')) ?? null,
  };
}

export function AppProvider({ children }: { children: ComponentChildren }) {
  const [data, setData] = useState<AppData | null>(null);
  const refresh = useCallback(async () => setData(await load()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <AppCtx.Provider value={{ data, refresh }}>{children}</AppCtx.Provider>;
}

export function useApp(): { data: AppData; refresh: () => Promise<void> } {
  const { data, refresh } = useContext(AppCtx);
  if (!data) throw new Error('not ready');
  return { data, refresh };
}
export const useAppMaybe = () => useContext(AppCtx);

/** 最後の書き出し（なければ使い始め）から30日たち、記録があれば書き出しを促す。 */
export function needsExportReminder(d: AppData, now: number): boolean {
  const hasData = d.learning.size > 0 || d.lookups.length > 0;
  const since = d.lastExportAt ?? d.firstUseAt;
  return hasData && now - since >= 30 * DAY;
}
