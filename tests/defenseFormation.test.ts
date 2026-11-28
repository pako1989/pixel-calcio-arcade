import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { APP_VERSION, CHANGELOG, VERSION_TAG } from '../src/ui/version';
import { MatchSim } from '../src/sim/match';
import { homePos } from '../src/sim/ai';
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
    seed: 19,
    humanTeam: 0,
    ...over,
  };
}

function advancePastKickoff(sim: MatchSim) {
  for (let i = 0; i < 120; i++) sim.update(1 / 60);
  sim.events.length = 0;
}

describe('changelog e versione', () => {
  it('espone v0.9.1 nello storico CHANGELOG e mantiene la sincronizzazione con package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(CHANGELOG[0]?.version).toBe(VERSION_TAG);
    expect(CHANGELOG.some((c) => c.version === 'v0.9.1')).toBe(true);
    expect(CHANGELOG[0]?.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe('portiere 1v1 e difesa anti-autogol', () => {
  it('il portiere toglie o respinge in avanti la palla nell 1v1 contro l attaccante', () => {
    // il duello ha una parte di fortuna (un attaccante bravo può saltare il portiere):
    // su più partite il portiere deve vincerne la grande maggioranza, sempre senza autogol
    let won = 0;
    for (let seed = 77; seed < 83; seed++) {
      const sim = new MatchSim(cfg({ seed }));
      advancePastKickoff(sim);
      for (const q of sim.players) {
        q.x = 420;
        q.y = 80;
      }
      const gk = sim.teams[0][0];
      const att = sim.teams[1][4];
      gk.x = 34;
      gk.y = sim.H / 2;
      gk.vx = 0;
      gk.vy = 0;
      gk.pickupCd = 0;
      gk.state = 'run';
      gk.stateT = 0;

      att.x = 42;
      att.y = sim.H / 2;
      att.vx = -60;
      att.vy = 0;
      att.facing = Math.PI;
      att.state = 'run';
      att.stateT = 0;
      sim.ball.owner = att;
      sim.ball.x = att.x - 6;
      sim.ball.y = att.y;
      sim.ball.z = 0;

      for (let i = 0; i < 12 && sim.ball.owner === att; i++) sim.update(1 / 60);

      expect(sim.score[1]).toBe(0);
      if (sim.ball.owner === att) continue;
      won++;
      expect(sim.events.some((e) => e.type === 'save')).toBe(true);
      if (sim.ball.owner !== gk) {
        expect(sim.ball.vx).toBeGreaterThan(0);
      }
    }
    expect(won).toBeGreaterThanOrEqual(4);
  });

  it('il difensore che scivola vicino alla propria linea di porta spazza fuori e non fa autogol', () => {
    const sim = new MatchSim(cfg({ seed: 101, humanTeam: null }));
    advancePastKickoff(sim);
    for (const q of sim.players) {
      q.x = 420;
      q.y = 80;
    }
    const def = sim.teams[0][1];
    const att = sim.teams[1][4];
    att.x = 16;
    att.y = sim.H / 2;
    att.facing = Math.PI;
    att.vx = 0;
    att.vy = 0;
    sim.ball.owner = att;
    sim.ball.x = 9;
    sim.ball.y = sim.H / 2;
    sim.ball.z = 0;

    def.x = 15;
    def.y = sim.H / 2;
    def.facing = Math.PI; // rivolto verso la propria porta!
    def.vx = -120;
    def.vy = 0;
    def.pickupCd = 0;
    def.setState('slide', 0);

    for (let i = 0; i < 25; i++) sim.update(1 / 60);

    expect(sim.score[1]).toBe(0);
    expect(sim.ball.x).toBeGreaterThan(6);
    if (!sim.ball.owner) {
      expect(sim.ball.vx).toBeGreaterThan(0);
    }
  });
});

describe('moduli tattici 5v5', () => {
  it('posiziona i giocatori diversamente tra 1-1-2 e 2-1-1', () => {
    const offSim = new MatchSim(cfg({ formation: '1-1-2' }));
    const defSim = new MatchSim(cfg({ formation: '2-1-1' }));

    const offMid = homePos(offSim, offSim.teams[0][3], true);
    const defMid = homePos(defSim, defSim.teams[0][3], true);
    const offBack = homePos(offSim, offSim.teams[0][2], false);
    const defBack = homePos(defSim, defSim.teams[0][2], false);

    expect(offMid.x).toBeGreaterThan(defMid.x);
    expect(defBack.x).toBeLessThan(offBack.x);
  });
});
