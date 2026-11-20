import { describe, expect, it } from 'vitest';
import { ALBUM_PAGES, ALL_STICKERS, duplicates, newAlbum, openPack, owned, PACK_SIZE, swapDuplicates, SWAP_COST } from '../src/modes/album';
import { Rng } from '../src/sim/math';

describe('album figurine', () => {
  it('numeri unici e ogni pagina ha figurine', () => {
    expect(new Set(ALL_STICKERS.map((s) => s.id)).size).toBe(ALL_STICKERS.length);
    expect(ALL_STICKERS.map((s) => s.n)).toEqual(ALL_STICKERS.map((_, i) => i + 1));
    for (const p of ALBUM_PAGES) expect(p.stickers.length).toBeGreaterThan(0);
  });

  it('i pacchetti danno figurine e alla fine si completa tutto', () => {
    const a = newAlbum();
    expect(a.packs).toBe(3);
    const rng = new Rng(3);
    const r = openPack(a, rng)!;
    expect(r.stickers.length).toBe(PACK_SIZE);
    expect(a.packs).toBe(2);
    let guard = 0;
    while (owned(a) < ALL_STICKERS.length && guard++ < 2000) {
      if (a.packs === 0) {
        if (!swapDuplicates(a)) a.packs++;
      }
      openPack(a, rng);
    }
    expect(owned(a)).toBe(ALL_STICKERS.length);
    expect(a.pagesDone.length).toBe(ALBUM_PAGES.length);
  });

  it('lo scambio usa i doppioni', () => {
    const a = newAlbum();
    a.packs = 0;
    a.have[ALL_STICKERS[0].id] = SWAP_COST + 1;
    expect(duplicates(a)).toBe(SWAP_COST);
    expect(swapDuplicates(a)).toBe(true);
    expect(a.packs).toBe(1);
    expect(duplicates(a)).toBe(0);
    expect(swapDuplicates(a)).toBe(false);
  });
});
