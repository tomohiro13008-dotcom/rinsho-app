// データの型。改訂設計 v1.1 の6章に対応する。

export type StepKind = 'procedure' | 'decision' | 'number' | 'equipment' | 'communication';

export interface Step {
  text: string;
  kind: StepKind;
  /** この行に必要な設備（registry.equipment の id）。 */
  requires?: string[];
  /** 設備がないときに代わりに出す行（呼ぶ・送る・つなぐ）。requires があれば必須。 */
  ifMissing?: string;
  /** 習熟2（ヒント）で見せる短い言葉。なければ先頭数文字を出す。 */
  keyword?: string;
}

export interface Branch {
  if: string;
  then: string;
  else?: string;
}

export interface Source {
  type: 'guideline' | 'book' | 'web';
  title: string;
  edition?: string;
  /** CQ や頁 */
  locator?: string;
  /** 照合した範囲と、していない範囲 */
  checkedScope?: string;
  url?: string;
  /** false は自分用（書籍の頁など）。配布版のビルドで落とす。 */
  public: boolean;
}

/** 0 AI下書き / 1 自分で照合済み / 2 専門医レビュー済み / 3 現場で使って確認 */
export type ReviewLevel = 0 | 1 | 2 | 3;

export interface Review {
  level: ReviewLevel;
  byRole?: string;
  date?: string;
}

export interface CallForHelp {
  criteria: string[];
  whom?: string;
  script?: string;
}

export interface Card {
  id: string;
  title: string;
  /** 状態に関わらずホーム最上段に出す共通カード（ABCDE・呼ぶ/送る・SBAR）。 */
  common?: boolean;
  states: string[];
  scenes: string[];
  specialties: string[];
  summary: string[];
  firstActions: string[];
  steps: Step[];
  branches: Branch[];
  callForHelp: CallForHelp;
  transfer?: string;
  pitfalls: string[];
  sources: Source[];
  updatedAt: string;
  review: Review;
  drills?: string[];
}

export type DrillKind = 'sequence' | 'branch' | 'recall' | 'sayAloud' | 'scenario';

export interface Drill {
  id: string;
  /** 柱A のカードに紐づく練習。cardId か specialty のどちらかは必須。 */
  cardId?: string;
  /** 柱B（科）の練習 */
  specialty?: string;
  kind: DrillKind;
  prompt: string;
  answer: string;
  why?: string;
  targetSeconds?: number | null;
  /** sequence のときの正しい順番 */
  items?: string[];
}

export interface MustNotMiss {
  disease: string;
  timeWindow?: string;
  cardId?: string;
}

export interface Specialty {
  id: string;
  name: string;
  externalLink?: { label: string; url: string };
  mustNotMiss: MustNotMiss[];
  common: string[];
  urgencyQuestions: string[];
  procedurePrep: string[];
  tips: string[];
  consultScript?: string;
  sources: Source[];
  updatedAt: string;
  review: Review;
}

export interface RegistryItem {
  id: string;
  label: string;
}

export interface Registry {
  states: RegistryItem[];
  scenes: RegistryItem[];
  equipment: RegistryItem[];
  tierPresets: Record<string, string[]>;
}

// ---- 端末内だけに保存するもの ----

export interface FacilityProfile {
  id: string;
  name: string;
  tier: string;
  switches: Record<string, boolean>;
  /** 物の場所など。患者情報は書かない。 */
  notes: string;
  /** 応援医・上位施設の連絡先。端末内のみ。 */
  contacts: string;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type QueueSource = 'field' | 'briefing' | 'review' | 'new' | 'manual';

export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

export interface HistoryEntry {
  at: number;
  result: Rating;
  seconds: number;
  levelAfter: MasteryLevel;
  source: QueueSource;
}

export interface LearningState {
  cardId: string;
  level: MasteryLevel;
  intervalDays: number;
  due: number | null;
  history: HistoryEntry[];
}

export interface Lookup {
  id?: number;
  cardId: string;
  at: number;
  mode: 'field' | 'briefing';
}

export interface DrillLog {
  id?: number;
  drillId: string;
  at: number;
  result: Rating;
}

/** 「見ずに言える段階」の測定（始めと4週後）。 */
export interface Snapshot {
  /** YYYY-MM-DD */
  date: string;
  at: number;
  levels: Record<string, MasteryLevel>;
}

export interface DayLog {
  /** YYYY-MM-DD（端末の現地時刻） */
  date: string;
  /** その日に初めて学習を開いたときの「今日の想起」の件数 */
  firstQueueSize: number;
}
