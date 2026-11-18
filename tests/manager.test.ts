import { describe, expect, it } from 'vitest';
import {
  applyManagerResult, autoLineup, buy, canSell, MAX_SQUAD, ME, myFixture, myTeamDef, newManager, position,
  roundRobin, sell, simulateMyMatch, starters, table, upgrade, type ManagerState,
} from '../src/modes/manager';

function playSeason(st: ManagerState, mine: (st: ManagerState) => [number, number]) {
  const s = st.season;
  let guard = 0;
  while (st.season === s && guard++ < 40) {
    const [a, b] = mine(st);
    applyManagerResult(st, a, b, []);
  }
}

describe('manager', () => {
  it('calendario: ognuno affronta tutti due volte, una in casa e una fuori', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fx = roundRobin(ids);
    expect(fx.length).toBe(14);
    for (const r of fx) {
      const seen = new Set(r.flatMap((f) => [f.h, f.a]));
      expect(seen.size).toBe(8);
    }
    const pairs = new Set(fx.flat().map((f) => `${f.h}-${f.a}`));
    expect(pairs.size).toBe(56);
  });

  it('nuova carriera: rosa valida, 8 squadre, una partita a giornata', () => {
    const st = newManager('Borgo FC', 0, 'normale', 1);
    expect(st.squad.length).toBe(9);
    expect(starters(st).length).toBe(5);
    expect(st.clubs.length).toBe(7);
    expect(new Set(st.squad.map((p) => p.name)).size).toBe(st.squad.length);
    expect(myFixture(st)).not.toBeNull();
    const t = myTeamDef(st);
    expect(t.players.length).toBe(5);
    expect(t.players[0].role).toBe('GK');
  });

  it('vincendo sempre si sale fino alla Serie Pixel', () => {
    const st = newManager('Borgo FC', 1, 'normale', 2);
    for (let i = 0; i < 3; i++) {
      playSeason(st, () => [3, 0]);
      expect(st.seasonEnd?.outcome).toBe('campione');
    }
    expect(st.division).toBe(3);
    expect(st.titles).toBe(3);
    expect(st.season).toBe(4);
    expect(st.week).toBe(0);
    expect(st.squad.length).toBeGreaterThanOrEqual(6);
    expect(st.fixtures.flat().every((f) => f.gh === undefined)).toBe(true);
  });

  it('perdendo sempre si retrocede (ma non sotto il quartiere)', () => {
    const st = newManager('Borgo FC', 2, 'normale', 3);
    playSeason(st, () => [0, 2]);
    expect(st.division).toBe(0);
    playSeason(st, () => [3, 0]);
    expect(st.division).toBe(1);
    playSeason(st, () => [0, 4]);
    expect(st.seasonEnd?.outcome).toBe('retrocesso');
    expect(st.division).toBe(0);
  });

  it('classifica coerente e marcatori contati', () => {
    const st = newManager('Borgo FC', 0, 'normale', 4);
    const scorer = starters(st)[4].name;
    applyManagerResult(st, 2, 1, [scorer, scorer]);
    expect(st.squad.find((p) => p.name === scorer)!.goals).toBe(2);
    const t = table(st);
    expect(t.length).toBe(8);
    expect(t.reduce((s, r) => s + r.p, 0)).toBe(8);
    expect(t.find((r) => r.id === ME)!.pts).toBe(3);
    expect(position(st)).toBeGreaterThanOrEqual(1);
  });

  it('mercato: comprare, vendere, limiti di rosa', () => {
    const st = newManager('Borgo FC', 0, 'normale', 5);
    st.budget = 10_000_000;
    while (st.squad.length < MAX_SQUAD) expect(buy(st, st.market[0].id)).toBe(true);
    expect(buy(st, st.market[0].id)).toBe(false);
    const before = st.budget;
    const bench = st.squad.find((p) => !st.lineup.includes(p.id) && p.role !== 'GK')!;
    expect(sell(st, bench.id)).toBe(true);
    expect(st.budget).toBeGreaterThan(before);
    const gks = st.squad.filter((p) => p.role === 'GK');
    for (const g of gks.slice(1)) sell(st, g.id);
    expect(canSell(st, gks[0].id)).not.toBeNull();
    expect(starters(st).length).toBe(5);
    expect(upgrade(st, 'stadium')).toBe(true);
    expect(st.stadium).toBe(1);
  });

  it('la simulazione vera gira e le finanze reggono una stagione', () => {
    const st = newManager('Borgo FC', 0, 'normale', 6);
    autoLineup(st);
    let goals = 0;
    playSeason(st, (s) => {
      const r = simulateMyMatch(s);
      goals += r.score[0] + r.score[1];
      return r.score;
    });
    expect(goals).toBeGreaterThan(10);
    expect(st.budget).toBeGreaterThan(0);
    for (const p of st.squad) {
      expect(p.energy).toBeGreaterThan(0);
      expect(Number.isFinite(p.stats.shot)).toBe(true);
    }
  });
});
