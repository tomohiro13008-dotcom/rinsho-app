import { describe, expect, it } from 'vitest';
import { stripPrivateSources } from '../../src/build/strip-private';

describe('配布版で自分用の出典を落とす', () => {
  it('public:false の出典だけを消し、ほかは残す', () => {
    const src = JSON.stringify({
      id: 'x',
      sources: [
        { type: 'guideline', title: 'G', public: true },
        { type: 'book', title: '本', locator: 'p.12', public: false },
      ],
      nested: { sources: [{ title: 'n', public: false }] },
    });
    const out = JSON.parse(stripPrivateSources(src));
    expect(out.sources).toEqual([{ type: 'guideline', title: 'G', public: true }]);
    expect(out.nested.sources).toEqual([]);
    expect(stripPrivateSources(src)).not.toContain('p.12');
  });
});
