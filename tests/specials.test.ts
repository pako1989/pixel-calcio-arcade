import { describe, expect, it } from 'vitest';
import { MatchSim } from '../src/sim/match';
import { TEAMS } from '../src/data/teams';
import { PITCHES } from '../src/data/pitches';
import { SPECIAL_TREE, specialsOf, unlockedSpecials, useSpecial, starTier } from '../src/sim/specials';
import type { MatchConfig, TeamDef } from '../src/sim/types';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.stadio, difficulty: 'normale', durationSec: 120,
    powerUps: false, goldenGoal: false, seed: 7, humanTeam: 0, ...over,
  };
}

/** Porta la partita a metà tempo, in gioco. */
function playing(over: Partial<MatchConfig> = {}) {
  const sim = new MatchSim(cfg(over));
  for (let i = 0; i < 200 && sim.phase !== 'play'; i++) sim.update(1 / 60);
  sim.events.length = 0;
  return sim;
}

/** Toglie di mezzo i difensori avversari: resta solo il portiere. */
function clearOpp(sim: MatchSim, team: 0 | 1 = 1) {
  for (const o of sim.teams[team]) {
    if (o.isGK) continue;
    o.x = sim.W * 0.35;
    o.y = 30 + o.idx * 10;
    o.homeX = o.x;
    o.homeY = o.y;
  }
}

function strong(t: TeamDef): TeamDef {
  return { ...t, stars: 5 };
}

describe('supermosse', () => {
  it('le mosse si sbloccano con i tier e le stelle', () => {
    expect(unlockedSpecials('FWD', 1)).toEqual(['fulmine']);
    expect(unlockedSpecials('FWD', 3)).toEqual(SPECIAL_TREE.FWD);
    expect(unlockedSpecials('GK', 3)).toEqual(['pietra']);
    expect(starTier(2)).toBe(1);
    expect(starTier(4)).toBe(2);
    expect(starTier(5)).toBe(3);
  });

  it('l\'energia si ricarica col gioco e non supera 1', () => {
    const sim = playing({ humanTeam: null });
    const p = sim.teams[0][3];
    const before = p.energy;
    sim.addEnergy(p, 0.4);
    expect(p.energy).toBeCloseTo(Math.min(1, before + 0.4), 5);
    sim.addEnergy(p, 5);
    expect(p.energy).toBe(1);
    expect(sim.events.some((e) => e.type === 'specialReady')).toBe(true);
  });

  it('spente: niente energia né mosse', () => {
    const sim = playing({ specials: false });
    const p = sim.teams[0][4];
    sim.addEnergy(p, 1);
    expect(p.energy).toBe(0);
  });

  it('senza energia piena la mossa non parte', () => {
    const sim = playing();
    const p = sim.teams[0][4];
    sim.ball.owner = p;
    p.energy = 0.5;
    expect(useSpecial(sim, p)).toBe(false);
  });

  for (const id of ['fulmine', 'cometa', 'gemello'] as const) {
    it(`tiro ${id}: parte, è un super tiro speciale e può segnare`, () => {
      let goals = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const sim = playing({ home: strong(TEAMS[0]), seed });
        clearOpp(sim);
        const fwd = sim.teams[0].find((q) => q.role === 'FWD')!;
        // vicino o lontano a seconda della mossa
        fwd.x = id === 'cometa' ? sim.W * 0.5 : id === 'gemello' ? sim.W - 120 : sim.W - 220;
        fwd.y = sim.H / 2;
        sim.ball.owner = fwd;
        fwd.energy = 1;
        expect(specialsOf(sim, fwd)).toContain(id);
        expect(useSpecial(sim, fwd)).toBe(true);
        expect(fwd.energy).toBe(0);
        expect(sim.ball.special?.id).toBe(id);
        expect(sim.ball.superShot).toBe(true);
        const ev = sim.events.find((e) => e.type === 'special');
        expect(ev && ev.type === 'special' && ev.id).toBe(id);
        const before = sim.score[0];
        for (let i = 0; i < 240 && sim.phase === 'play'; i++) sim.update(1 / 60);
        if (sim.score[0] > before) goals++;
        expect(Number.isFinite(sim.ball.x)).toBe(true);
      }
      expect(goals).toBeGreaterThanOrEqual(3);
    });
  }

  it('Arcobaleno raggiunge il compagno e prepara il tiro combinato', () => {
    const sim = playing({ home: strong(TEAMS[0]) });
    const mid = sim.teams[0].find((q) => q.role === 'MID')!;
    mid.x = sim.W * 0.4;
    mid.y = sim.H / 2;
    sim.ball.owner = mid;
    mid.energy = 1;
    expect(useSpecial(sim, mid)).toBe(true);
    const target = sim.ball.passTarget!;
    expect(target).toBeTruthy();
    expect(target.comboT).toBeGreaterThan(0);
    let got = false;
    for (let i = 0; i < 200; i++) {
      sim.update(1 / 60);
      if (sim.ball.owner?.team === 0) {
        got = true;
        break;
      }
    }
    expect(got).toBe(true);
  });

  it('Tornado: chi ha la palla non si lascia rubare', () => {
    const sim = playing({ home: strong(TEAMS[0]) });
    const mid = sim.teams[0].find((q) => q.role === 'MID')!;
    mid.x = sim.W * 0.5;
    mid.y = sim.H / 2;
    const o = sim.teams[1].find((q) => q.role === 'DEF')!;
    o.x = mid.x + 14;
    o.y = mid.y;
    sim.ball.owner = mid;
    mid.energy = 1;
    expect(useSpecial(sim, mid)).toBe(true);
    expect(mid.spKind).toBe('tornado');
    for (let i = 0; i < 40; i++) {
      mid.wantX = 1;
      sim.update(1 / 60);
    }
    expect(sim.ball.owner === mid || sim.ball.owner === null || sim.ball.owner.team === 0).toBe(true);
  });

  it('Tsunami ruba palla a chi è vicino, Muro chiude la porta', () => {
    const sim = playing({ home: strong(TEAMS[0]) });
    const def = sim.teams[0].find((q) => q.role === 'DEF')!;
    const att = sim.teams[1].find((q) => q.role === 'FWD')!;
    def.x = sim.W * 0.3;
    def.y = sim.H / 2;
    att.x = def.x + 25;
    att.y = def.y;
    sim.ball.owner = att;
    def.energy = 1;
    expect(useSpecial(sim, def)).toBe(true);
    expect(sim.ball.owner).toBe(def);
    // muro: la squadra non ha il possesso
    const sim2 = playing({ home: { ...strong(TEAMS[0]) } });
    const d2 = sim2.teams[0].find((q) => q.role === 'DEF')!;
    sim2.ball.owner = sim2.teams[1][4];
    d2.x = sim2.W * 0.8; // lontano da avversari: niente tsunami, quindi muro
    d2.y = 20;
    d2.energy = 1;
    expect(useSpecial(sim2, d2)).toBe(true);
    expect(sim2.wall[0]).toBeGreaterThan(0);
  });

  it('Mano di Pietra ferma un super tiro con energia piena', () => {
    let saves = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = playing({ away: strong(TEAMS[1]), home: strong(TEAMS[0]), seed });
      clearOpp(sim);
      const gk = sim.teams[1].find((q) => q.isGK)!;
      gk.energy = 1;
      const fwd = sim.teams[0].find((q) => q.role === 'FWD')!;
      fwd.x = sim.W - 160;
      fwd.y = sim.H / 2;
      sim.ball.owner = fwd;
      fwd.energy = 1;
      useSpecial(sim, fwd);
      sim.specialsUsed = [0, 0];
      const before = sim.score[0];
      for (let i = 0; i < 200 && sim.phase === 'play'; i++) sim.update(1 / 60);
      if (sim.score[0] === before && sim.specialsUsed[1] === 1) saves++;
    }
    expect(saves).toBeGreaterThanOrEqual(8);
  });

  it('la CPU usa le supermosse e la partita resta regolare', () => {
    let used = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const sim = new MatchSim(cfg({ humanTeam: null, seed, home: strong(TEAMS[0]), away: strong(TEAMS[1]) }));
      for (let t = 0; t < 400 && sim.phase !== 'end'; t += 1 / 60) {
        sim.update(1 / 60);
        sim.events.length = 0;
      }
      expect(sim.phase).toBe('end');
      used += sim.specialsUsed[0] + sim.specialsUsed[1];
      for (const p of sim.players) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
    expect(used).toBeGreaterThan(4);
  });
});
