import { describe, expect, it } from 'vitest';
import { newLeggenda } from '../src/modes/leggenda';
import {
  autoLineup, canUpgrade, cardById, chemistry, lineupComplete, openStarPack, packPool, PITY, RARITIES, roundOpen,
  roundReward, SLOTS, STAR_CARDS, STAR_ROUNDS, starKnown, starOpponent, starTeam, stelleOf, upgrade, levelOfCard, cardTechs,
} from '../src/modes/leggendaStelle';
import { FieldMatch } from '../src/modes/leggendaField';
import { Rng } from '../src/sim/math';

describe('Squadra delle Stelle', () => {
  it('carte uniche di tutte le rarità', () => {
    expect(new Set(STAR_CARDS.map((c) => c.id)).size).toBe(STAR_CARDS.length);
    expect(STAR_CARDS.length).toBeGreaterThan(60);
    for (const r of RARITIES) expect(STAR_CARDS.some((c) => c.rarity === r)).toBe(true);
    expect(cardById('nico')!.rarity).toBe('leggenda');
    expect(cardById('tommaso')!.rarity).toBe('oro');
  });

  it('si parte con una squadra completa e i rivali battuti si uniscono', () => {
    const sv = newLeggenda();
    const { st, joined } = stelleOf(sv);
    expect(joined).toEqual([]);
    expect(lineupComplete(st)).toBe(true);
    expect(starTeam(st).players.map((p) => p.role)).toEqual(SLOTS);
    sv.cleared = 4;
    const r = stelleOf(sv);
    expect(r.joined).toEqual(['tommaso', 'gigi', 'sandro', 'dario', 'ivo']);
    expect(stelleOf(sv).joined).toEqual([]);
  });

  it('le buste danno solo personaggi già incontrati, garanzie rispettate', () => {
    const sv = newLeggenda();
    sv.cleared = 3;
    const { st } = stelleOf(sv);
    const pool = new Set(packPool(sv).map((c) => c.id));
    const rng = new Rng(7);
    for (let i = 0; i < 40; i++) {
      const pulls = openStarPack(sv, st, 'oro', rng);
      expect(pulls.length).toBe(3);
      expect(pulls.some((p) => p.card.rarity === 'oro' || p.card.rarity === 'leggenda')).toBe(true);
      for (const p of pulls) expect(pool.has(p.card.id)).toBe(true);
    }
    const mito = openStarPack(sv, st, 'mito', rng);
    expect(mito.some((p) => p.card.rarity === 'leggenda')).toBe(true);
  });

  it('dopo troppe buste senza leggenda ne arriva una', () => {
    const sv = newLeggenda();
    sv.cleared = 10;
    const { st } = stelleOf(sv);
    st.dry = PITY - 1;
    const pulls = openStarPack(sv, st, 'bronzo', new Rng(1));
    expect(pulls.some((p) => p.card.rarity === 'leggenda')).toBe(true);
    expect(st.dry).toBe(0);
  });

  it('i doppioni fanno salire di livello e sbloccano tecniche', () => {
    const { st } = stelleOf(newLeggenda());
    const nico = cardById('nico')!;
    expect(cardTechs(nico, 1)).toEqual(['gabbiano']);
    expect(canUpgrade(st, 'nico')).toBe(false);
    st.have.nico = 4;
    expect(upgrade(st, 'nico')).toBe(true);
    expect(upgrade(st, 'nico')).toBe(true);
    expect(levelOfCard(st, 'nico')).toBe(3);
    expect(st.have.nico).toBe(1);
    expect(starKnown(starTeam(st))).toContain('cometa');
  });

  it('intesa: coppie della storia e fuori ruolo', () => {
    const sv = newLeggenda();
    sv.cleared = 10;
    const { st } = stelleOf(sv);
    const base = chemistry(st).value;
    autoLineup(st);
    expect(lineupComplete(st)).toBe(true);
    const c = chemistry(st);
    expect(c.links.length).toBeGreaterThan(0);
    expect(c.value).toBeGreaterThan(base);
    st.lineup[0] = 'nico';
    st.lineup[6] = 'gaspare';
    expect(chemistry(st).notes.join()).toContain('fuori ruolo');
  });

  it('torneo: avversari senza doppioni, premi e partita giocabile', () => {
    const sv = newLeggenda();
    sv.cleared = 10;
    const { st } = stelleOf(sv);
    autoLineup(st);
    expect(roundOpen(sv, st, 0)).toBe(true);
    expect(roundOpen(sv, st, 1)).toBe(false);
    const mine = starTeam(st);
    for (let r = 0; r < STAR_ROUNDS.length; r++) {
      const opp = starOpponent(r, st.lineup as string[]);
      expect(opp.players.length).toBe(7);
      const ids = new Set([...mine.players, ...opp.players].map((p) => p.id));
      expect(ids.size).toBe(14);
    }
    const m = new FieldMatch(mine, starOpponent(8, st.lineup as string[]), { minutes: 1, assist: 4, known: starKnown(mine), seed: 3 });
    expect(m.teams[0].players.length).toBe(7);
    const rw = roundReward(sv, st, 0, true, 2);
    expect(rw.first).toBe(true);
    expect(st.rounds).toBe(1);
    expect(st.packs.bronzo).toBe(1);
    expect(roundReward(sv, st, 0, true, 0).first).toBe(false);
  });
});
