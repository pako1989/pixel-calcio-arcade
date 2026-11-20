import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { APP_VERSION, VERSION_TAG } from '../src/ui/version';
import { MatchSim } from '../src/sim/match';
import { PITCHES } from '../src/data/pitches';
import { TEAMS } from '../src/data/teams';
import type { MatchConfig } from '../src/sim/types';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0],
    away: TEAMS[1],
    pitch: PITCHES.stadio,
    difficulty: 'normale',
    durationSec: 120,
    powerUps: false,
    goldenGoal: false,
    seed: 31,
    humanTeam: 0,
    ...over,
  };
}

function advancePastKickoff(sim: MatchSim) {
  for (let i = 0; i < 120; i++) sim.update(1 / 60);
  sim.events.length = 0;
}

describe('versione in home', () => {
  it('sincronizza APP_VERSION e VERSION_TAG con package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(VERSION_TAG).toBe(`v${pkg.version}`);
  });
});

describe('tiro al volo e rovesciata', () => {
  it('non attiva il tiro al volo con palla rasoterra o troppo alta', () => {
    const sim = new MatchSim(cfg());
    advancePastKickoff(sim);
    const p = sim.teams[0][4];
    p.x = 600;
    p.y = 240;
    p.facing = 0;
    p.kickCd = 0;
    sim.ball.owner = null;
    sim.ball.x = 610;
    sim.ball.y = 240;
    sim.ball.z = 2;
    expect(sim.canVolley(p)).toBeNull();
    sim.ball.z = 40;
    expect(sim.canVolley(p)).toBeNull();
  });

  it('attiva il tiro al volo frontale su palla a mezza altezza', () => {
    const sim = new MatchSim(cfg());
    advancePastKickoff(sim);
    const p = sim.teams[0][4];
    p.x = 620;
    p.y = 240;
    p.facing = 0;
    p.kickCd = 0;
    sim.ball.owner = null;
    sim.ball.x = 630;
    sim.ball.y = 240;
    sim.ball.z = 9;
    sim.ball.vx = 0;
    sim.ball.vy = 0;
    sim.ball.vz = 0;

    expect(sim.canVolley(p)).toBe('volo');
    const kind = sim.attemptVolley(p, 0, 0.9, true);
    expect(kind).toBe('volo');
    expect(p.state).toBe('volley');
    expect(sim.ball.volley).toBe('volo');
    expect(sim.ball.speed).toBeGreaterThan(360);
    expect(sim.stylePoints[0]).toBe(2);
    expect(sim.events.some((e) => e.type === 'trick' && e.kind === 'volo')).toBe(true);
    expect(sim.events.some((e) => e.type === 'shot' && e.volley === 'volo')).toBe(true);
  });

  it('attiva la rovesciata su palla alta spalle alla porta e marca il gol per il replay', () => {
    const sim = new MatchSim(cfg({ seed: 44 }));
    advancePastKickoff(sim);
    for (const q of sim.players) {
      q.x = 40;
      q.y = 40;
    }
    const p = sim.teams[0][4];
    p.x = sim.W - 75;
    p.y = sim.H / 2;
    p.facing = Math.PI; // spalle alla porta avversaria
    p.kickCd = 0;
    p.pickupCd = 0;
    sim.ball.owner = null;
    sim.ball.x = p.x + 8;
    sim.ball.y = p.y;
    sim.ball.z = 16;
    sim.ball.vx = 0;
    sim.ball.vy = 0;
    sim.ball.vz = 0;

    expect(sim.canVolley(p)).toBe('rovesciata');
    const kind = sim.attemptVolley(p, Math.PI, 0.95, false);
    expect(kind).toBe('rovesciata');
    expect(p.state).toBe('bicycle');
    expect(sim.ball.volley).toBe('rovesciata');
    expect(sim.ball.vx).toBeGreaterThan(300); // reindirizzata verso la porta avversaria
    expect(sim.stylePoints[0]).toBe(3);
    expect(sim.events.some((e) => e.type === 'trick' && e.kind === 'rovesciata')).toBe(true);

    // lascia che la palla entri in rete per verificare il tag sull'evento goal
    sim.events.length = 0;
    for (let i = 0; i < 60 && sim.phase === 'play'; i++) sim.update(1 / 60);
    const goal = sim.events.find((e) => e.type === 'goal');
    expect(goal).toBeDefined();
    if (goal && goal.type === 'goal') {
      expect(goal.volley).toBe('rovesciata');
    }
  });
});
