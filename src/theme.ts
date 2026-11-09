// 色の定義（改訂設計7章）。ライトはデジタル庁ガイドブックのパレットから。
// ダークはガイドブックに記載がないため独自に決めた（仮）。どちらも tests/unit/contrast.test.ts で
// 文字 4.5:1・図形 3:1 を検証する。色は4系統（主操作・危険・できた・補足）に限り、必ず文字やアイコンを添える。

export interface Theme {
  bg: string;
  surface: string;
  text: string;
  label: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  dangerBg: string;
  success: string;
  onSuccess: string;
  increase: string;
  decrease: string;
  track: string;
  focus: string;
}

export const light: Theme = {
  bg: '#F8F8FB',
  surface: '#FFFFFF',
  text: '#000000',
  label: '#626264',
  border: '#7F7F84',
  primary: '#0017C1',
  onPrimary: '#FFFFFF',
  danger: '#CE0000',
  onDanger: '#FFFFFF',
  dangerBg: '#FDEEEE',
  success: '#197A4B',
  onSuccess: '#FFFFFF',
  increase: '#3460FB',
  decrease: '#FE3939',
  track: '#E6E6EA',
  focus: '#0017C1',
};

export const dark: Theme = {
  bg: '#121215',
  surface: '#1D1D22',
  text: '#FFFFFF',
  label: '#B9B9C0',
  border: '#8A8A93',
  primary: '#8DA6FF',
  onPrimary: '#000000',
  danger: '#FF7A7A',
  onDanger: '#000000',
  dangerBg: '#3A1A1A',
  success: '#5CC795',
  onSuccess: '#000000',
  increase: '#7C9BFF',
  decrease: '#FF7A7A',
  track: '#3A3A42',
  focus: '#8DA6FF',
};

function vars(t: Theme): string {
  return Object.entries(t)
    .map(([k, v]) => `--${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v};`)
    .join('');
}

export function themeCss(): string {
  return `:root{${vars(light)}color-scheme:light dark;}@media (prefers-color-scheme: dark){:root{${vars(dark)}}}`;
}

// ---- コントラスト（WCAG 2 の相対輝度） ----
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
