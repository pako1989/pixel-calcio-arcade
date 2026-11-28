import { describe, expect, it } from 'vitest';
import { MatchSim, PENALTY_SPOT } from '../src/sim/match';
import { TEAMS } from '../src/data/teams';
import { PITCHES, PITCH_ORDER } from '../src/data/pitches';
import { applyWeather, randomConditions, weatherAllowed, weatherOdds, WEATHERS } from '../src/data/weather';
import type { MatchConfig } from '../src/sim/types';
import { Rng } from '../src/sim/math';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0],
    away: TEAMS[1],
    pitch: PITCHES.stadio,
    difficulty: 'normale',
    durationSec: 120,
    powerUps: false,
    goldenGoal: false,
    seed: 7,
    humanTeam: null,
    ...over,
  };
}

function step(sim: MatchSim, sec: number) {
  const dt = 1 / 60;
  for (let t = 0; t < sec && sim.phase !== 'end'; t += dt) {
    sim.update(dt);
    sim.events.length = 0;
  }
}

describe('meteo', () => {
  it('le probabilità per campo sommano a 1 e rispettano i divieti', () => {
    for (const id of PITCH_ORDER) {
      const o = weatherOdds(id);
      const tot = WEATHERS.reduce((a, w) => a + o[w], 0);
      expect(tot).toBeCloseTo(1, 5);
      for (const w of WEATHERS) if (!weatherAllowed(id, w)) expect(o[w]).toBe(0);
    }
    expect(weatherOdds('neve').pioggia).toBe(0);
    expect(weatherOdds('spiaggia').neve).toBe(0);
    expect(weatherOdds('montagna').neve).toBeGreaterThan(weatherOdds('stadio').neve);
  });

  it('il meteo casuale esce vario e solo tra quelli ammessi', () => {
    const rng = new Rng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const c = randomConditions('stadio', () => rng.next());
      seen.add(c.weather);
      const n = randomConditions('neve', () => rng.next());
      expect(weatherAllowed('neve', n.weather)).toBe(true);
      expect(randomConditions('tetto', () => rng.next()).night).toBe(true);
    }
    for (const w of WEATHERS) expect(seen.has(w)).toBe(true);
  });

  it('neve, vento e temporale cambiano la fisica del campo', () => {
    const p = PITCHES.stadio;
    const neve = applyWeather(p, 'neve');
    expect(neve.ballFriction).toBeGreaterThan(p.ballFriction);
    expect(neve.playerSpeed).toBeLessThan(p.playerSpeed);
    expect(applyWeather(p, 'vento').wind).toBe(true);
    const t = applyWeather(p, 'temporale');
    expect(t.wind).toBe(true);
    expect(t.windPower).toBeGreaterThan(1);
    expect(t.playerGrip).toBeLessThan(p.playerGrip);
  });

  it('con il vento la simulazione genera raffiche e la partita resta valida', () => {
    for (const weather of ['vento', 'temporale', 'neve'] as const) {
      const sim = new MatchSim(cfg({ weather, durationSec: 40 }));
      step(sim, 90);
      expect(sim.phase).toBe('end');
      if (weather !== 'neve') expect(Math.hypot(sim.wind.x, sim.wind.y)).toBeGreaterThan(0);
      for (const pl of sim.players) expect(Number.isFinite(pl.x) && Number.isFinite(pl.y)).toBe(true);
    }
  });
});

describe('supplementari', () => {
  it('sul pareggio si giocano i supplementari, poi la partita finisce', () => {
    const sim = new MatchSim(cfg({ extraTime: true, durationSec: 90 }));
    step(sim, 3);
    sim.score = [1, 1];
    sim.timeLeft = 0.01;
    let extra = false;
    const dt = 1 / 60;
    for (let i = 0; i < 30; i++) {
      sim.update(dt);
      if (sim.events.some((e) => e.type === 'whistle' && e.kind === 'extra')) extra = true;
      sim.events.length = 0;
    }
    expect(extra).toBe(true);
    expect(sim.extraTime).toBe(true);
    expect(sim.timeLeft).toBe(30);
    step(sim, 200);
    expect(sim.phase).toBe('end');
    expect(sim.result.extraTime).toBe(true);
  });

  it('senza supplementari il pareggio finisce subito', () => {
    const sim = new MatchSim(cfg({ durationSec: 30 }));
    step(sim, 3);
    sim.score = [0, 0];
    sim.timeLeft = 0.01;
    step(sim, 1);
    expect(sim.phase).toBe('end');
    expect(sim.result.extraTime).toBeUndefined();
  });
});

describe('rigori in partita', () => {
  function ready(over: Partial<MatchConfig> = {}) {
    const sim = new MatchSim(cfg(over));
    step(sim, 3);
    return sim;
  }

  it('il rigore mette la palla sul dischetto e tutti gli altri fuori area', () => {
    const sim = ready();
    const taker = sim.teams[0][4];
    sim.setupPenalty(taker, 1);
    expect(sim.phase).toBe('penalty');
    const gx = sim.oppGoalX(0);
    expect(Math.abs(sim.ball.x - gx)).toBe(PENALTY_SPOT);
    expect(sim.ball.y).toBe(sim.H / 2);
    const gk = sim.teams[1].find((p) => p.isGK)!;
    for (const p of sim.players) {
      if (p === taker || p === gk) continue;
      expect(sim.inOwnBox(1, p.x, p.y)).toBe(false);
    }
    expect(sim.penalty?.interactive).toBe(false);
  });

  it('CPU contro CPU il rigore si tira da solo e il gioco riprende', () => {
    let goals = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const sim = ready({ seed });
      const before = sim.score[0];
      sim.setupPenalty(sim.teams[0][4], 1);
      step(sim, 3);
      expect(sim.penalty).toBeNull();
      expect(sim.phase).not.toBe('penalty');
      goals += sim.score[0] - before;
    }
    // la maggior parte dei rigori va a segno, ma non tutti
    expect(goals).toBeGreaterThan(20);
    expect(goals).toBeLessThan(40);
  });

  it('con il giocatore umano aspetta la mini-sfida e poi applica l\'esito', () => {
    const sim = ready({ humanTeam: 0 });
    sim.setupPenalty(sim.teams[0][4], 1);
    expect(sim.penalty?.interactive).toBe(true);
    sim.penalty!.open = true;
    step(sim, 20);
    expect(sim.phase).toBe('penalty');
    let goalEv = false;
    sim.resolvePenalty('gol', 0.5);
    for (const e of sim.events) if (e.type === 'goal' && e.pen) goalEv = true;
    expect(goalEv).toBe(true);
    expect(sim.score[0]).toBe(1);
    expect(sim.phase).toBe('goal');
  });

  it('rigore parato: la palla è del portiere; palo: palla viva in campo', () => {
    const sim = ready({ humanTeam: 0 });
    sim.setupPenalty(sim.teams[1][4], 0);
    sim.resolvePenalty('parato');
    const gk = sim.teams[0].find((p) => p.isGK)!;
    expect(sim.ball.owner).toBe(gk);
    expect(sim.phase).toBe('play');
    sim.setupPenalty(sim.teams[0][4], 1);
    sim.resolvePenalty('palo', -0.9);
    expect(sim.ball.owner).toBeNull();
    expect(sim.phase).toBe('play');
    expect(sim.score).toEqual([0, 0]);
  });

  it('nella carriera (un solo giocatore) la mini-sfida tocca solo a chi è controllato', () => {
    const sim = ready({ humanTeam: 0, lockHuman: 4 });
    sim.setupPenalty(sim.teams[0][3], 1);
    expect(sim.penalty?.interactive).toBe(false);
    step(sim, 3);
    sim.setupPenalty(sim.teams[0][4], 1);
    expect(sim.penalty?.interactive).toBe(true);
  });

  it('se nessuno apre la mini-sfida il rigore si tira comunque', () => {
    const sim = ready({ humanTeam: 0 });
    sim.setupPenalty(sim.teams[0][4], 1);
    step(sim, 20);
    expect(sim.phase).not.toBe('penalty');
  });

  it('con i rigori attivi le partite CPU contro CPU finiscono regolarmente', () => {
    let pens = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new MatchSim(cfg({ seed, penaltyKicks: true, durationSec: 150 }));
      const dt = 1 / 60;
      for (let t = 0; t < 400 && sim.phase !== 'end'; t += dt) {
        sim.update(dt);
        for (const e of sim.events) if (e.type === 'penalty') pens++;
        sim.events.length = 0;
      }
      expect(sim.phase).toBe('end');
    }
    // CPU contro CPU si entra poco in area palla al piede: i rigori restano rari
    expect(pens).toBeLessThan(10);
  });
});
