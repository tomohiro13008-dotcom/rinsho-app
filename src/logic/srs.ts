// 間隔反復。自己評価4段階で次の間隔を伸縮する単純な方式（仮）。
// アルゴリズムは Scheduler を差し替えれば変えられる。数値は根拠のある値ではなく初期値。

import type { Rating } from '../types';
import { DAY, startOfDay } from './time';

export interface Schedule {
  intervalDays: number;
  /** 次に出す日（その日の0時、現地時刻） */
  due: number;
}

export interface Scheduler {
  name: string;
  next(prevIntervalDays: number, rating: Rating, now: number): Schedule;
}

function dueAfter(days: number, now: number): number {
  return startOfDay(now) + days * DAY;
}

export const simpleScheduler: Scheduler = {
  name: 'simple-v0',
  next(prev, rating, now) {
    let days: number;
    switch (rating) {
      case 'again':
        days = 1;
        break;
      case 'hard':
        days = Math.max(1, Math.round(prev * 1.2));
        break;
      case 'good':
        days = prev < 1 ? 1 : prev < 3 ? 3 : Math.round(prev * 2);
        break;
      case 'easy':
        days = prev < 1 ? 3 : Math.round(prev * 3);
        break;
    }
    days = Math.min(days, 180);
    return { intervalDays: days, due: dueAfter(days, now) };
  },
};

let current: Scheduler = simpleScheduler;
export function getScheduler(): Scheduler {
  return current;
}
export function setScheduler(s: Scheduler): void {
  current = s;
}
