import { describe, expect, it } from 'vitest';
import { contrast, dark, light, type Theme } from '../../src/theme';

// 文字は 4.5:1 以上、図形（枠・棒・矢印・フォーカス）は 3:1 以上（デジタル庁ガイドブック、改訂設計7章）。
const textPairs: [keyof Theme, keyof Theme][] = [
  ['text', 'bg'], ['text', 'surface'], ['label', 'bg'], ['label', 'surface'],
  ['primary', 'bg'], ['primary', 'surface'], ['onPrimary', 'primary'],
  ['danger', 'bg'], ['danger', 'surface'], ['danger', 'dangerBg'], ['text', 'dangerBg'], ['onDanger', 'danger'],
  ['success', 'bg'], ['success', 'surface'], ['onSuccess', 'success'],
];
const shapePairs: [keyof Theme, keyof Theme][] = [
  ['border', 'bg'], ['border', 'surface'], ['primary', 'track'], ['success', 'track'],
  ['increase', 'bg'], ['increase', 'surface'], ['decrease', 'bg'], ['decrease', 'surface'],
  ['focus', 'bg'], ['focus', 'surface'], ['danger', 'track'],
];

for (const [name, t] of [['ライト', light], ['ダーク', dark]] as const) {
  describe(`${name}のコントラスト`, () => {
    for (const [a, b] of textPairs) {
      it(`文字 ${a} / ${b} ≥ 4.5`, () => expect(contrast(t[a], t[b])).toBeGreaterThanOrEqual(4.5));
    }
    for (const [a, b] of shapePairs) {
      it(`図形 ${a} / ${b} ≥ 3`, () => expect(contrast(t[a], t[b])).toBeGreaterThanOrEqual(3));
    }
  });
}
