import { describe, expect, it } from 'vitest';
import { MatchSim } from '../src/sim/match';
import { homePos } from '../src/sim/ai';
import { TEAMS } from '../src/data/teams';
import { PITCHES } from '../src/data/pitches';
import type { MatchConfig } from '../src/sim/types';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.stadio, difficulty: 'normale',
    durationSec: 120, powerUps: false, goldenGoal: false, seed: 7, humanTeam: 0, ...over,
  };
}
const NONE = { mx: 0, my: 0, shoot: false, pass: false, sprint: false };

/** Mette il giocatore umano a metà campo con la palla e un compagno più avanti. */
function setup() {
  const sim = new MatchSim(cfg());
  for (let i = 0; i < 200; i++) sim.update(1 / 60, NONE);
  const h = sim.human!;
  h.x = 300;
  h.y = sim.H / 2;
  h.vx = h.vy = 0;
  sim.ball.owner = h;
  sim.ball.x = h.x;
  sim.ball.y = h.y;
  const mate = sim.teams[0].find((p) => p !== h && !p.isGK)!;
  mate.x = 560;
  mate.y = sim.H / 2 - 30;
  mate.vx = mate.vy = 0;
  // gli altri compagni lontano dalla traiettoria
  for (const p of sim.teams[0]) if (p !== h && p !== mate && !p.isGK) { p.x = 100; p.y = 40; p.vx = p.vy = 0; }
  // avversari lontani
  for (const o of sim.teams[1]) if (!o.isGK) { o.x = sim.W - 60; o.y = 30; }
  return { sim, h, mate };
}

function hold(sim: MatchSim, secs: number) {
  const input = { ...NONE, mx: 1 };
  for (let t = 0; t < secs; t += 1 / 60) sim.update(1 / 60, { ...input, pass: true });
  sim.update(1 / 60, { ...input, pass: false });
}

describe('passaggi in stile Tsubasa/FIFA', () => {
  it('tocco breve: passaggio normale', () => {
    const { sim } = setup();
    hold(sim, 0.08);
    expect(sim.ball.passTarget).not.toBeNull();
    expect(sim.ball.through).toBeNull();
  });

  it('PASSA tenuto: filtrante rasoterra davanti al compagno', () => {
    const { sim } = setup();
    hold(sim, 0.4);
    expect(sim.ball.through).toBe('filtrante');
    expect(sim.ball.passTarget).not.toBeNull();
    expect(Math.abs(sim.ball.vz)).toBeLessThan(20);
    // la palla va verso il compagno e questi scatta verso il punto d'arrivo
    expect(sim.ball.vx).toBeGreaterThan(100);
    expect(sim.ball.passTarget!.wantSprint).toBe(true);
  });

  it('PASSA tenuto a lungo: pallonetto che scavalca', () => {
    const { sim } = setup();
    hold(sim, 0.95);
    expect(sim.ball.through).toBe('pallonetto');
    expect(sim.ball.vz).toBeGreaterThan(100);
  });

  it('un passaggio che arriva al compagno aumenta la catena', () => {
    const { sim, h, mate } = setup();
    sim.ball.owner = null;
    sim.ball.x = mate.x + 2;
    sim.ball.y = mate.y;
    sim.ball.vx = sim.ball.vy = 0;
    sim.ball.z = 0;
    sim.ball.lastTouch = h;
    sim.ball.passTarget = mate;
    sim.ball.through = 'filtrante';
    sim.update(1 / 60, NONE);
    expect(sim.ball.owner).toBe(mate);
    expect(sim.chain[0]).toBe(1);
    expect(sim.ball.through).toBeNull();
  });

  it('la catena si azzera se la palla passa agli avversari', () => {
    const { sim } = setup();
    sim.chain[0] = 3;
    const opp = sim.teams[1][2];
    opp.x = sim.ball.x + 3;
    opp.y = sim.ball.y;
    sim.ball.owner = null;
    sim.ball.vx = sim.ball.vy = 0;
    sim.ball.lastTouch = sim.teams[0][3];
    sim.ball.passTarget = null;
    for (let i = 0; i < 20; i++) sim.update(1 / 60, NONE);
    expect(sim.chain[0]).toBe(0);
  });
});

describe('tattica', () => {
  it('attacco sposta in avanti la squadra, difesa la tiene bassa', () => {
    const sim = new MatchSim(cfg());
    const p = sim.teams[0][2];
    sim.setTactic(0, 'equilibrio');
    const base = homePos(sim, p, false).x;
    sim.setTactic(0, 'attacco');
    expect(homePos(sim, p, false).x).toBeGreaterThan(base);
    sim.setTactic(0, 'difesa');
    expect(homePos(sim, p, false).x).toBeLessThan(base);
  });

  it('la CPU in svantaggio a fine partita passa all\'attacco', () => {
    const sim = new MatchSim(cfg({ humanTeam: 0, durationSec: 100 }));
    sim.score = [2, 0];
    sim.timeLeft = 20;
    sim.phase = 'play';
    for (let i = 0; i < 60 * 5; i++) sim.update(1 / 60, NONE);
    expect(sim.tactic[1]).toBe('attacco');
  });

  it('le partite CPU contro CPU restano equilibrate con filtranti e catene', () => {
    let goals = 0;
    let chains = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const sim = new MatchSim(cfg({ humanTeam: null, seed, durationSec: 120 }));
      for (let t = 0; t < 400 && sim.phase !== 'end'; t += 1 / 60) {
        sim.update(1 / 60);
        for (const e of sim.events) if (e.type === 'chain') chains++;
        sim.events.length = 0;
      }
      goals += sim.score[0] + sim.score[1];
    }
    expect(goals / 6).toBeGreaterThan(1);
    expect(goals / 6).toBeLessThan(14);
    expect(chains).toBeGreaterThan(0);
  });
});
