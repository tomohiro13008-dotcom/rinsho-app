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
  type: 'guideline' | 'book' | 'web' | 'label';
  title: string;
  edition?: string;
  /** CQ や頁 */
  locator?: string;
  /** 照合した範囲と、していない範囲 */
  checkedScope?: string;
  url?: string;
  /** false は自分用（書籍の頁など）。配布版のビルドで落とす。 */
  public: boolean;
  /** 原典を開いて確かめた日（YYYY-MM-DD） */
  verifiedAt?: string;
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
  /** 看護師の第一声（例「SpO2が85です」）。学習の想起で題名の代わりに出し、どのカードかを当てさせる。 */
  firstCalls?: string[];
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
  /** 朝まで待てる条件 */
  canWait?: string[];
  /** 朝まで待てない条件 */
  cannotWait?: string[];
  /** 専門医が来るまでにやってはいけないこと */
  doNotDo?: string[];
  consultScript?: string;
  sources: Source[];
  updatedAt: string;
  review: Review;
}

// ---- 参照セクション（教科書・レファレンス） ----

/** 表。数値は書き手が作って照合したもので、アプリは計算しない。 */
export interface Table {
  caption?: string;
  columns: string[];
  rows: string[][];
  note?: string;
}

export interface TopicSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: Table;
  /** カルテなどの空欄の型。患者の情報は入れない。そのまま写して使う骨組み。 */
  template?: { label?: string; lines: string[] };
  /** 確認問題（学習の「参照の確認問題」に出る） */
  question?: string;
  answer?: string;
  /** sources の何番目を根拠にしたか（0始まり） */
  sourceIndexes?: number[];
}

export interface Verification {
  checked: string[];
  unverified: string[];
  editorialNote?: string;
}

/** 参照項目。冒頭に要約とポイント、次に表と詳細。 */
export interface Topic {
  id: string;
  field: string;
  /** 分野の中での並び順（小さい順。なければ題名の順で後ろ） */
  order?: number;
  title: string;
  tags: string[];
  summary: string[];
  points: string[];
  sections: TopicSection[];
  pitfalls: string[];
  cards?: string[];
  drugs?: string[];
  related?: string[];
  sources: Source[];
  verification: Verification;
  updatedAt: string;
  review: Review;
}

export interface DrugBrand {
  name: string;
  /** 規格・含量（例：1管1mL中 1mg） */
  strength: string;
  maker?: string;
}

export interface DoseRow {
  indication: string;
  /** 成人／小児など */
  population: string;
  dose: string;
  route: string;
  /** 間隔・繰り返し・最大量 */
  repeat?: string;
  /** 出どころ（添付文書／ガイドライン名） */
  basis: string;
  note?: string;
  sourceIndexes?: number[];
}

export interface Drug {
  id: string;
  generic: string;
  brands: DrugBrand[];
  drugClass: string;
  summary: string[];
  doses: DoseRow[];
  preparation: { label: string; recipe: string }[];
  weightTable?: Table;
  cautions: string[];
  topics?: string[];
  sources: Source[];
  verification: Verification;
  updatedAt: string;
  review: Review;
}

export interface RegistryItem {
  id: string;
  label: string;
}

export interface Registry {
  states: RegistryItem[];
  /** 参照セクションの分野 */
  fields: RegistryItem[];
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

export type QueueSource = 'marked' | 'field' | 'briefing' | 'review' | 'new' | 'manual';

export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

export interface HistoryEntry {
  at: number;
  result: Rating;
  seconds: number;
  levelAfter: MasteryLevel;
  source: QueueSource;
  /** 題名の代わりに出した看護師の第一声 */
  prompt?: string;
  /** 項目ごとの照合：言えた数と全体の数、言えなかった項目のキー */
  checked?: number;
  total?: number;
  missed?: string[];
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

/** 本番の後に「迷った行」へ付ける印。患者の情報は持たず、カードの行だけを指す。 */
export interface Mark {
  id?: number;
  cardId: string;
  /** 行のキー（first:0 / call:1 / branch:0 / step:2） */
  line: string;
  /** 印を付けたときの行の文（カードが直されても何に迷ったか分かるように） */
  text: string;
  at: number;
}

/** 当直で困った科（参照の分野 id）を1タップで残す記録。 */
export interface Trouble {
  id?: number;
  field: string;
  at: number;
}

/** 目次で付ける印。項目のキーは `card:<id>` `topic:<id>` `drug:<id>` `spec:<id>`。 */
export type ItemKind = 'card' | 'topic' | 'drug' | 'spec';

export interface Flag {
  key: string;
  /** 重要（自分で付ける） */
  important?: boolean;
  /** 苦手（自分で付ける。記録からの自動の分は保存しない） */
  weak?: boolean;
  /** 要復習を付けた時刻。カードはこのあと練習すると消える */
  reviewAt?: number | null;
  at: number;
}

/** 参照・薬・科のページを開いた記録（読んだかどうかを目次に出すため）。 */
export interface View {
  key: string;
  firstAt: number;
  lastAt: number;
  count: number;
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
