import { describe, expect, it } from 'vitest';
// @ts-expect-error 型のない .mjs
import { alias, doseTokens, mismatches } from '../../scripts/review-order.mjs';

describe('照合の順番表：薬の量の食い違いの候補', () => {
  it('一般名から短い名前を作る', () => {
    expect(alias('アミオダロン塩酸塩')).toBe('アミオダロン');
    expect(alias('ヒドロコルチゾンコハク酸エステルナトリウム')).toBe('ヒドロコルチゾン');
    expect(alias('フロセミド（注射）')).toBe('フロセミド');
  });

  it('量の表記を拾う（幅・体重あたり・カンマ）', () => {
    expect(doseTokens('2.5〜5mg/kg（最大300mg）、1,000mg')).toEqual(['2.5〜5mg/kg', '300mg', '1000mg']);
  });

  it('薬のページにない量だけを候補にし、ノルアドレナリンをアドレナリンと取り違えない', () => {
    const drugs = [{ id: 'adrenaline', generic: 'アドレナリン', summary: ['1mg'], doses: [{ dose: '0.01mg/kg' }], preparation: [] }];
    const items = [
      { id: 'a', summary: ['アドレナリン1mgを3〜5分ごと', 'アドレナリン2〜10μg/分の持続', 'ノルアドレナリン0.05μg/kg/分'] },
    ];
    const out = mismatches(drugs, items);
    expect(out.map((m: { token: string }) => m.token)).toEqual(['2〜10μg']);
  });
});
