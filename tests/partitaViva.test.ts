import { describe, expect, it } from 'vitest';
import { MatchSim } from '../src/sim/match';
import { offBallJob } from '../src/sim/ai';
import { BASE_STAT, paceOf, shotAimErr } from '../src/sim/abilita';
import { TEAMS } from '../src/data/teams';
import { PITCHES } from '../src/data/pitches';
import type { MatchConfig, PlayerStats, TeamDef } from '../src/sim/types';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.stadio, difficulty: 'normale',
    durationSec: 120, powerUps: false, goldenGoal: false, seed: 5, humanTeam: 0, ...over,
  };
}
const NONE = { mx: 0, my: 0, shoot: false, pass: false, sprint: false };

function started(over: Partial<MatchConfig> = {}) {
  const sim = new MatchSim(cfg(over));
  for (let i = 0; i < 150; i++) sim.update(1 / 60, NONE);
  sim.events.length = 0;
  return sim;
}

/** Tutti lontano dall'azione, così ogni test mette in campo solo chi gli serve. */
function clear(sim: MatchSim) {
  for (const p of sim.players) {
    p.x = sim.W / 2;
    p.y = 20;
    p.vx = p.vy = 0;
  }
}

const stats = (v: number, speed = v): PlayerStats => ({ speed, shot: v, pass: v, tackle: v, control: v, keeping: v });
const team = (id: string, s: PlayerStats): TeamDef => ({ ...TEAMS[0], id, players: TEAMS[0].players.map((p) => ({ ...p, stats: { ...s } })) });

describe('tiro intelligente', () => {
  it('mirando al centro sceglie l\'angolo lontano dal portiere', () => {
    const sim = started();
    clear(sim);
    const h = sim.human!;
    const gk = sim.teams[1][0];
    h.x = sim.W - 160;
    h.y = sim.H / 2;
    sim.ball.x = h.x;
    sim.ball.y = h.y;
    gk.x = sim.W - 12;
    gk.y = sim.goalTop + 14; // portiere sul palo alto
    const ty = sim.openGoalY(h, sim.H / 2);
    expect(ty).toBeGreaterThan(sim.H / 2);
  });

  it('rispetta la metà della porta scelta col joystick', () => {
    const sim = started();
    clear(sim);
    const h = sim.human!;
    h.x = sim.W - 160;
    h.y = sim.H / 2;
    sim.ball.x = h.x;
    sim.ball.y = h.y;
    const gk = sim.teams[1][0];
    gk.x = sim.W - 12;
    gk.y = sim.goalBottom - 10;
    // anche se il basso è coperto male, se chiedo l'alto tiro in alto
    expect(sim.openGoalY(h, sim.goalTop)).toBeLessThan(sim.H / 2);
  });

  it('evita il difensore che chiude la linea di tiro', () => {
    const sim = started();
    clear(sim);
    const h = sim.human!;
    h.x = sim.W - 150;
    h.y = sim.H / 2;
    sim.ball.x = h.x;
    sim.ball.y = h.y;
    const gk = sim.teams[1][0];
    gk.x = sim.W - 10;
    gk.y = sim.H / 2;
    // difensore davanti alla metà bassa dello specchio
    const def = sim.teams[1][1];
    def.x = sim.W - 60;
    def.y = sim.H / 2 + 20;
    const ty = sim.openGoalY(h, sim.H / 2);
    expect(ty).toBeLessThan(sim.H / 2);
  });
});

describe('statistiche bilanciate', () => {
  it('il giocatore medio corre come prima, la differenza tra lento e veloce è contenuta', () => {
    expect(paceOf(stats(BASE_STAT))).toBeCloseTo(BASE_STAT, 5);
    const fast = paceOf(stats(0.9, 1.1));
    const slow = paceOf(stats(0.9, 0.8));
    expect(fast).toBeGreaterThan(slow);
    // prima il rapporto era 1.1 / 0.8 = 1.375
    expect(fast / slow).toBeLessThan(1.22);
  });

  it('chi ha più tiro sbaglia meno la mira', () => {
    expect(shotAimErr(stats(1.1))).toBeLessThan(shotAimErr(stats(0.8)));
  });

  it('una squadra solo veloce non schiaccia una squadra più tecnica', () => {
    const fast = team('veloci', stats(0.85, 1.1));
    const skill = team('tecnici', stats(0.98, 0.85));
    let fastWins = 0;
    let skillWins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const swap = seed % 2 === 0;
      const sim = new MatchSim(cfg({ humanTeam: null, seed, home: swap ? skill : fast, away: swap ? fast : skill }));
      for (let t = 0; t < 400 && sim.phase !== 'end'; t += 1 / 60) {
        sim.update(1 / 60);
        sim.events.length = 0;
      }
      const f = swap ? sim.score[1] : sim.score[0];
      const s = swap ? sim.score[0] : sim.score[1];
      if (f > s) fastWins++;
      else if (s > f) skillWins++;
    }
    expect(skillWins).toBeGreaterThanOrEqual(2);
    expect(fastWins).toBeLessThanOrEqual(7);
  });
});

describe('cambio giocatore più furbo', () => {
  it('in difesa preferisce chi sta tra la palla e la nostra porta', () => {
    const sim = started();
    clear(sim);
    const carrier = sim.teams[1][4];
    carrier.x = sim.W / 2;
    carrier.y = sim.H / 2;
    sim.ball.owner = carrier;
    sim.ball.x = carrier.x - 6;
    sim.ball.y = carrier.y;
    const behind = sim.teams[0][3]; // alle spalle dell'attaccante, un po' più vicino
    behind.x = carrier.x + 45;
    behind.y = carrier.y;
    const goalSide = sim.teams[0][1]; // davanti alla nostra porta, sulla traiettoria
    goalSide.x = carrier.x - 90;
    goalSide.y = carrier.y + 10;
    expect(sim.switchScore(goalSide)).toBeLessThan(sim.switchScore(behind));
  });

  it('mostra il segnalino del compagno migliore quando difendiamo', () => {
    const sim = started();
    clear(sim);
    const carrier = sim.teams[1][4];
    carrier.x = sim.W / 2;
    carrier.y = sim.H / 2;
    sim.ball.owner = carrier;
    const goalSide = sim.teams[0][1];
    goalSide.x = carrier.x - 70;
    goalSide.y = carrier.y;
    sim.setHuman(4);
    const far = sim.teams[0][4];
    far.x = sim.W - 40;
    far.y = sim.H - 30;
    expect(sim.switchHint).toBe(goalSide);
    // con la palla nostra il segnalino sparisce
    sim.ball.owner = far;
    expect(sim.switchHint).toBeNull();
  });
});

describe('movimenti senza palla', () => {
  it('il compagno più avanzato si inserisce, quello dietro viene incontro', () => {
    const sim = started({ humanTeam: null });
    clear(sim);
    const t = sim.teams[0];
    const carrier = t[2];
    carrier.x = sim.W * 0.55;
    carrier.y = sim.H / 2;
    sim.ball.owner = carrier;
    const fwd = t[4];
    fwd.x = sim.W * 0.7;
    fwd.y = sim.H * 0.3;
    const back = t[1];
    back.x = sim.W * 0.35;
    back.y = sim.H * 0.6;
    const other = t[3];
    other.x = sim.W * 0.2;
    other.y = sim.H * 0.2;
    expect(offBallJob(sim, fwd, carrier)).toBe('inserimento');
    expect(offBallJob(sim, back, carrier)).toBe('appoggio');
    expect(offBallJob(sim, other, carrier)).toBe('posizione');
  });
});
