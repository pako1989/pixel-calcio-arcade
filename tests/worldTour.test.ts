import { describe, expect, it } from 'vitest';
import { MatchSim } from '../src/sim/match';
import { PITCHES } from '../src/data/pitches';
import { TEAMS } from '../src/data/teams';
import type { MatchConfig } from '../src/sim/types';
import { newTally } from '../src/modes/tally';
import type { MatchOutcome } from '../src/modes/modes';
import {
  applyWorldTourResult,
  checkWtGoal,
  newWorldTour,
  WORLD_STAGES,
  wtConquered,
  wtLaunch,
  wtTeam,
} from '../src/modes/worldTour';
import { checkTrophies, newTotals } from '../src/modes/trophies';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0],
    away: TEAMS[1],
    pitch: PITCHES.stadio,
    difficulty: 'normale',
    durationSec: 120,
    powerUps: true,
    goldenGoal: false,
    seed: 17,
    humanTeam: null,
    ...over,
  };
}

function advancePastKickoff(sim: MatchSim) {
  for (let i = 0; i < 120; i++) sim.update(1 / 60);
  sim.events.length = 0;
}

function outcome(score: [number, number], superGoals = 0, tallyGoals?: [number, number]): MatchOutcome {
  const tally = newTally();
  tally.goals = tallyGoals ?? ([...score] as [number, number]);
  tally.superGoals = [superGoals, 0];
  return {
    launch: {
      mode: 'worldtour',
      config: { home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.flipper, difficulty: 'normale', durationSec: 120, powerUps: true, goldenGoal: true, humanTeam: 0 },
    },
    result: { score, stats: { shots: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [50, 50] }, goldenGoal: false, scorers: [] },
    tally,
  };
}

describe('nuovi campi caotici', () => {
  it('flipper: i respingenti rilanciano il pallone ed emettono evento bumper', () => {
    const sim = new MatchSim(cfg({ pitch: PITCHES.flipper, seed: 5 }));
    advancePastKickoff(sim);
    for (const p of sim.players) { p.x = 20; p.y = 20; }
    const bm = sim.pitch.bumpers![0];
    const b = sim.ball;
    b.owner = null;
    b.shotFrom = { x: 100, y: bm.y };
    b.x = bm.x - bm.r - 1;
    b.y = bm.y;
    b.z = 2;
    b.vx = 260;
    b.vy = 0;
    b.vz = 0;
    b.banked = false;
    sim.update(1 / 60);
    expect(sim.events.some((e) => e.type === 'bumper')).toBe(true);
    expect(b.vx).toBeLessThan(0);
    expect(b.banked).toBe(true);
  });

  it('fango: le pozze rallentano la corsa e frenano la palla a terra ma non in aria', () => {
    const sim = new MatchSim(cfg({ pitch: PITCHES.fango, seed: 8 }));
    advancePastKickoff(sim);
    const mud = sim.pitch.mud![2];
    const b = sim.ball;
    b.owner = null;
    // palla rasoterra nel fango
    b.x = mud.x;
    b.y = mud.y;
    b.z = 0;
    b.vx = 300;
    b.vy = 0;
    b.vz = 0;
    sim.update(0.1);
    const groundSpeedInMud = b.speed;

    // palla alta sopra la stessa pozza
    const simAir = new MatchSim(cfg({ pitch: PITCHES.fango, seed: 8 }));
    advancePastKickoff(simAir);
    simAir.ball.owner = null;
    simAir.ball.x = mud.x;
    simAir.ball.y = mud.y;
    simAir.ball.z = 12;
    simAir.ball.vx = 300;
    simAir.ball.vy = 0;
    simAir.ball.vz = 40;
    simAir.update(0.1);
    expect(simAir.ball.speed).toBeGreaterThan(groundSpeedInMud);
  });

  it('vulcano: il geyser erutta lanciando in aria il pallone ed emette evento geyser', () => {
    const sim = new MatchSim(cfg({ pitch: PITCHES.vulcano, seed: 11 }));
    advancePastKickoff(sim);
    for (const p of sim.players) { p.x = 20; p.y = 20; }
    const gy = sim.pitch.geysers![0];
    let erupted = false;
    for (let i = 0; i < 60 * 14 && !erupted; i++) {
      sim.ball.owner = null;
      sim.ball.x = gy.x;
      sim.ball.y = gy.y;
      sim.ball.z = 0;
      sim.ball.vx = 0;
      sim.ball.vy = 0;
      sim.update(1 / 60);
      if (sim.events.some((e) => e.type === 'geyser' && Math.hypot(e.x - gy.x, e.y - gy.y) < 5)) {
        erupted = true;
        expect(sim.ball.vz).toBeGreaterThan(200);
        expect(sim.ball.z).toBeGreaterThan(2);
      }
      sim.events.length = 0;
    }
    expect(erupted).toBe(true);
  });
});

describe('nuovi power-up', () => {
  it('ghiaccio rallenta la squadra avversaria', () => {
    const simNormal = new MatchSim(cfg({ seed: 20 }));
    advancePastKickoff(simNormal);
    const simIce = new MatchSim(cfg({ seed: 20 }));
    advancePastKickoff(simIce);
    simIce.ice[0] = 5;

    const pNorm = simNormal.teams[1][4];
    const pIce = simIce.teams[1][4];
    pNorm.x = pIce.x = 420;
    pNorm.y = pIce.y = 240;
    pNorm.vx = pNorm.vy = pIce.vx = pIce.vy = 0;
    pNorm.wantX = pIce.wantX = 1;
    pNorm.wantY = pIce.wantY = 0;
    for (let i = 0; i < 20; i++) {
      simNormal.update(1 / 60);
      simIce.update(1 / 60);
    }
    expect(Math.hypot(pIce.vx, pIce.vy)).toBeLessThan(Math.hypot(pNorm.vx, pNorm.vy));
  });

  it('calamita attira il pallone libero verso il giocatore di campo più vicino', () => {
    const sim = new MatchSim(cfg({ seed: 21 }));
    advancePastKickoff(sim);
    sim.magnet[0] = 7;
    const p = sim.teams[0][4];
    p.x = 300;
    p.y = 240;
    for (const q of sim.players) if (q !== p) { q.x = 20; q.y = 20; }
    const b = sim.ball;
    b.owner = null;
    b.isShot = false;
    b.x = 390;
    b.y = 240;
    b.z = 0;
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    sim.update(1 / 60);
    expect(b.vx).toBeLessThan(0);
  });

  it('gigante attiva b.giant sul tiro e aumenta potenza e rimbalzo', () => {
    const simBase = new MatchSim(cfg({ seed: 22 }));
    advancePastKickoff(simBase);
    const kBase = simBase.teams[0][4];
    simBase.shoot(kBase, 0, 0.6, false);

    const simGiant = new MatchSim(cfg({ seed: 22 }));
    advancePastKickoff(simGiant);
    simGiant.giant[0] = 8;
    const kGiant = simGiant.teams[0][4];
    simGiant.shoot(kGiant, 0, 0.6, false);

    expect(simGiant.ball.giant).toBe(true);
    expect(simGiant.ball.speed).toBeGreaterThan(simBase.ball.speed * 1.12);
    expect(simGiant.ball.vz).toBeGreaterThan(simBase.ball.vz * 1.12);

    // verifica rimbalzo aumentato (restituzione >= 0.84)
    simGiant.ball.owner = null;
    simGiant.ball.x = 420;
    simGiant.ball.y = 240;
    simGiant.ball.z = 1;
    simGiant.ball.vz = -200;
    simGiant.updateBallPhysics(1 / 60);
    expect(simGiant.ball.vz).toBeGreaterThan(160);
  });
});

describe('street world tour', () => {
  const cap = { name: 'Leo', number: 10, look: { skin: 0, hair: 0, hairStyle: 0 } };

  it('6 tappe con id unici e parametri validi', () => {
    expect(WORLD_STAGES.length).toBe(6);
    expect(new Set(WORLD_STAGES.map((s) => s.id)).size).toBe(6);
    expect(WORLD_STAGES.map((s) => s.pitch)).toEqual(['flipper', 'fango', 'flipper', 'spiaggia', 'vulcano', 'stadio']);
  });

  it('una sconfitta non fa avanzare, completando tutte le tappe si vince il tour e i trofei', () => {
    const wt = newWorldTour('Street Stars', cap, 0, 'normale', 'squadra');
    expect(wtConquered(wt)).toBe(0);
    const baseShot = wtTeam(wt).players[0].stats.shot;

    const fail = applyWorldTourResult(wt, outcome([0, 1]));
    expect(fail.success).toBe(false);
    expect(wt.step).toBe(0);
    expect(wt.apps).toBe(1);

    for (let i = 0; i < WORLD_STAGES.length; i++) {
      const launch = wtLaunch(wt, (_h, a) => a);
      expect(launch.mode).toBe('worldtour');
      expect(launch.config.pitch.id).toBe(WORLD_STAGES[i].pitch);
      const rep = applyWorldTourResult(wt, outcome([4, 0], 1, [4, 0]));
      expect(rep.success).toBe(true);
    }

    expect(wt.finished).toBe(true);
    expect(wtConquered(wt)).toBe(6);
    expect(wtTeam(wt, WORLD_STAGES.length).players[0].stats.shot).toBeGreaterThan(baseShot);
    expect(wtLaunch(wt, (_h, a) => a).superStart).toBe(0.6);

    const have: string[] = [];
    const unlocked = checkTrophies(have, {
      totals: newTotals(),
      cups: 0,
      stickers: 0,
      maxLevelPlayers: 0,
      worldTour: wtConquered(wt),
    });
    expect(unlocked.map((t) => t.id)).toContain('worldtour:3');
    expect(unlocked.map((t) => t.id)).toContain('worldtour:6');
  });

  it('verifica obiettivi speciali delle tappe', () => {
    expect(checkWtGoal('winBy2', outcome([2, 1]))).toBe(false);
    expect(checkWtGoal('winBy2', outcome([3, 1]))).toBe(true);
    expect(checkWtGoal('score3', outcome([2, 0], 0, [2, 0]))).toBe(false);
    expect(checkWtGoal('score3', outcome([3, 2], 0, [3, 2]))).toBe(true);
    expect(checkWtGoal('superGoal', outcome([2, 0], 0))).toBe(false);
    expect(checkWtGoal('superGoal', outcome([2, 0], 1))).toBe(true);
    expect(checkWtGoal('cleanSheet', outcome([2, 1]))).toBe(false);
    expect(checkWtGoal('cleanSheet', outcome([1, 0]))).toBe(true);
  });
});
