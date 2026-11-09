export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** 現場で引いてから「今日の想起」に並ぶまでの時間（改訂設計3章）。 */
export const RECALL_DELAY_MS = 8 * HOUR;

/** 端末の現地時刻で YYYY-MM-DD */
export function dayKey(t: number): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** その日の 0 時（現地時刻） */
export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** その月の 1 日 0 時（現地時刻） */
export function startOfMonth(t: number): number {
  const d = new Date(t);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatDateTime(t: number): string {
  const d = new Date(t);
  return `${dayKey(t)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
