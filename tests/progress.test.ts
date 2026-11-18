import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import {
  addMatchXp, ballTint, buy, coinsForMatch, equip, equipped, grownPlayer, grownTeam, isRival, kitVariant,
  LEVEL_XP, levelOf, newProgress, recordVs, SHOP,
} from '../src/modes/progress';

describe('negozio', () => {
  it('parte con gli oggetti gratis indossati e 100 monete', () => {
    const p = newProgress();
    expect(p.coins).toBe(100);
    expect(equipped(p, 'pallone')).toBe('classico');
    expect(p.owned.length).toBe(SHOP.filter((i) => i.price === 0).length);
  });
  it('compra solo con abbastanza monete e indossa subito', () => {
    const p = newProgress();
    expect(buy(p, 'pallone:oro')).toBe(false);
    p.coins = 400;
    expect(buy(p, 'pallone:oro')).toBe(true);
    expect(p.coins).toBe(50);
    expect(equipped(p, 'pallone')).toBe('oro');
    expect(buy(p, 'pallone:oro')).toBe(false);
    expect(equip(p, 'pallone:classico')).toBe(true);
    expect(equip(p, 'maglia:dorata')).toBe(false);
  });
  it('maglie e palloni hanno un aspetto', () => {
    const t = TEAMS[0];
    expect(kitVariant(t, 'normale')).toBe(t);
    expect(kitVariant(t, 'dorata').colors.shirt).toBe(0xffc83a);
    expect(kitVariant(t, 'nera').colors.gk).toBe(t.colors.gk);
    expect(ballTint('classico', 0)).toBeNull();
    expect(ballTint('arcobaleno', 0)).not.toBe(ballTint('arcobaleno', 1));
  });
});

describe('crescita', () => {
  it('livelli e abilità', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(LEVEL_XP[2])).toBe(3);
    expect(levelOf(9999)).toBe(5);
    const fwd = TEAMS[0].players.find((p) => p.role === 'FWD')!;
    const g = grownPlayer(fwd, LEVEL_XP[2]);
    expect(g.skills).toEqual(['bomber']);
    expect(g.stats.shot).toBeGreaterThan(fwd.stats.shot);
    expect(grownPlayer(fwd, 0)).toBe(fwd);
  });
  it('esperienza dopo la partita e passaggi di livello', () => {
    const p = newProgress();
    const t = TEAMS[0];
    const scorer = t.players[4].name;
    const ups = addMatchXp(p, t, [scorer, scorer], true);
    expect(p.xp[t.id][4]).toBe(12 + 15 + 50);
    expect(p.xp[t.id][0]).toBe(27);
    expect(ups.map((u) => u.name)).toEqual([scorer]);
    expect(grownTeam(t, p).players[4].stats.speed).toBeGreaterThan(t.players[4].stats.speed);
    expect(grownTeam(t, undefined)).toBe(t);
  });
});

describe('rivalità e monete', () => {
  it('diventa rivale dopo due sconfitte in più', () => {
    const p = newProgress();
    recordVs(p, 'lupi', 'l');
    expect(isRival(p, 'lupi')).toBe(false);
    expect(recordVs(p, 'lupi', 'l')).toEqual({ wasRival: false, nowRival: true });
    expect(recordVs(p, 'lupi', 'w')).toEqual({ wasRival: true, nowRival: false });
  });
  it('monete doppie battendo una rivale', () => {
    expect(coinsForMatch(2, 'w', 3, false)).toBe(20 + 20 + 30 + 15);
    expect(coinsForMatch(2, 'w', 3, true)).toBe(2 * 85);
    expect(coinsForMatch(0, 'l', 0, true)).toBe(20);
  });
});
