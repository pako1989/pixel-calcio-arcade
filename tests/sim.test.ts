import { describe, expect, it } from 'vitest';
import { MatchSim } from '../src/sim/match';
import { TEAMS } from '../src/data/teams';
import { PITCHES, PITCH_ORDER } from '../src/data/pitches';
import type { MatchConfig } from '../src/sim/types';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0],
    away: TEAMS[1],
    pitch: PITCHES.stadio,
    difficulty: 'normale',
    durationSec: 120,
    powerUps: true,
    goldenGoal: false,
    seed: 42,
    humanTeam: null,
    ...over,
  };
}

function run(sim: MatchSim, maxSec = 400) {
  const dt = 1 / 60;
  for (let t = 0; t < maxSec && sim.phase !== 'end'; t += dt) {
    sim.update(dt);
    sim.events.length = 0;
  }
}

describe('simulazione partita', () => {
  it('una partita CPU contro CPU finisce con gol e senza valori NaN', () => {
    let goals = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const sim = new MatchSim(cfg({ seed }));
      run(sim);
      expect(sim.phase).toBe('end');
      for (const p of sim.players) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      goals += sim.score[0] + sim.score[1];
    }
    // in media qualche gol a partita: è un arcade
    expect(goals / 6).toBeGreaterThan(1.5);
    expect(goals / 6).toBeLessThan(14);
  });

  it('tutti i campi funzionano', () => {
    for (const id of PITCH_ORDER) {
      const sim = new MatchSim(cfg({ pitch: PITCHES[id], seed: 7 }));
      run(sim);
      expect(sim.phase).toBe('end');
    }
  });

  it('un tiro dentro la porta vale gol', () => {
    const sim = new MatchSim(cfg({ seed: 3 }));
    sim.update(2); // fine calcio d'inizio (dt limitato, ripeto)
    for (let i = 0; i < 100; i++) sim.update(1 / 60);
    const b = sim.ball;
    b.owner = null;
    b.x = sim.W - 30;
    b.y = sim.H / 2;
    b.z = 0;
    b.vx = 600;
    b.vy = 0;
    b.vz = 0;
    // sposta il portiere
    sim.teams[1][0].y = 20;
    b.lastTouch = sim.teams[0][4];
    for (let i = 0; i < 30; i++) sim.update(1 / 60);
    expect(sim.score[0]).toBe(1);
  });

  it('golden gol: in parità si continua', () => {
    const sim = new MatchSim(cfg({ durationSec: 1, goldenGoal: true, seed: 9 }));
    for (let i = 0; i < 60 * 5; i++) sim.update(1 / 60);
    expect(sim.goldenGoal || sim.score[0] !== sim.score[1]).toBe(true);
  });
});

describe('giocatore umano', () => {
  it('correndo verso la porta e tirando si segna (CPU facile)', () => {
    let goals = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const sim = new MatchSim(cfg({ seed, humanTeam: 0, difficulty: 'facile', durationSec: 90 }));
      let shootHeld = 0;
      for (let t = 0; t < 120 && sim.phase !== 'end'; t += 1 / 60) {
        const h = sim.human!;
        const b = sim.ball;
        const input = { mx: 0, my: 0, shoot: false, pass: false, sprint: true };
        if (b.owner === h) {
          const dx = sim.W - h.x;
          const dy = sim.H / 2 - h.y;
          const d = Math.hypot(dx, dy);
          input.mx = dx / d;
          input.my = dy / d;
          if (d < 200 || shootHeld > 0) {
            shootHeld += 1 / 60;
            input.shoot = shootHeld < 0.5;
            if (!input.shoot) shootHeld = 0;
          }
        } else {
          shootHeld = 0;
          const dx = b.x - h.x;
          const dy = b.y - h.y;
          const d = Math.hypot(dx, dy) || 1;
          input.mx = dx / d;
          input.my = dy / d;
        }
        sim.update(1 / 60, input);
        sim.events.length = 0;
      }
      goals += sim.score[0];
    }
    expect(goals).toBeGreaterThan(2);
  });
});

describe('campi speciali', () => {
  for (const id of ['piazza', 'montagna', 'molo'] as const) {
    it(`${id}: la partita finisce, la palla resta in campo e fuori dagli ostacoli`, () => {
      const sim = new MatchSim(cfg({ pitch: PITCHES[id], seed: 9 }));
      const dt = 1 / 60;
      let waves = 0;
      for (let t = 0; t < 400 && sim.phase !== 'end'; t += dt) {
        sim.update(dt);
        for (const e of sim.events) if (e.type === 'wave') waves++;
        sim.events.length = 0;
        const b = sim.ball;
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
        for (const o of sim.pitch.obstacles ?? []) {
          if (b.z < o.h) expect(Math.hypot(b.x - o.x, b.y - o.y)).toBeGreaterThan(o.r);
        }
      }
      expect(sim.phase).toBe('end');
      if (id === 'molo') expect(waves).toBeGreaterThan(2);
    });
  }
});

describe('falli e stile', () => {
  it('con i falli attivi ci sono cartellini, e la partita resta valida', () => {
    let fouls = 0;
    let tricks = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const sim = new MatchSim(cfg({ seed, fouls: true, difficulty: 'difficile' }));
      const dt = 1 / 60;
      for (let t = 0; t < 400 && sim.phase !== 'end'; t += dt) {
        sim.update(dt);
        for (const e of sim.events) {
          if (e.type === 'foul') fouls++;
          if (e.type === 'trick') tricks++;
        }
        sim.events.length = 0;
        for (const p of sim.players) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      expect(sim.phase).toBe('end');
    }
    expect(fouls).toBeGreaterThan(0);
    expect(tricks).toBeGreaterThan(0);
  });
  it('senza falli attivi nessun fallo', () => {
    const sim = new MatchSim(cfg({ seed: 3, difficulty: 'difficile' }));
    let fouls = 0;
    for (let t = 0; t < 400 && sim.phase !== 'end'; t += 1 / 60) {
      sim.update(1 / 60);
      for (const e of sim.events) if (e.type === 'foul') fouls++;
      sim.events.length = 0;
    }
    expect(fouls).toBe(0);
  });
});
