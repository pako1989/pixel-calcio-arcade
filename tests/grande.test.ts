import { describe, expect, it } from 'vitest';
import { MatchSim } from '../src/sim/match';
import { TEAMS, expandTeam } from '../src/data/teams';
import { PITCHES, bigPitch, BIG_PITCHES } from '../src/data/pitches';
import { FORMATIONS_11, type MatchConfig } from '../src/sim/types';
import { homePos } from '../src/sim/ai';
import { addXp, grownTeam, newProgress } from '../src/modes/progress';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: expandTeam(TEAMS[0]), away: expandTeam(TEAMS[1]), pitch: bigPitch(PITCHES.stadio), difficulty: 'normale',
    durationSec: 120, powerUps: false, goldenGoal: false, seed: 3, humanTeam: null, ...over,
  };
}
const NONE = { mx: 0, my: 0, shoot: false, pass: false, sprint: false };

describe('11 contro 11', () => {
  it('le squadre hanno 11 giocatori con i ruoli giusti e numeri diversi', () => {
    const t = expandTeam(TEAMS[0]);
    expect(t.players).toHaveLength(11);
    expect(t.players.map((p) => p.role)).toEqual(['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD']);
    expect(new Set(t.players.map((p) => p.number)).size).toBe(11);
    expect(new Set(t.players.map((p) => p.name)).size).toBe(11);
    // i titolari originali restano
    expect(t.players[0].name).toBe(TEAMS[0].players[0].name);
    expect(t.players[9].name).toBe(TEAMS[0].players[4].name);
    // è deterministica
    expect(expandTeam(TEAMS[0]).players.map((p) => p.name)).toEqual(t.players.map((p) => p.name));
  });

  it('il campo grande e il calcio d\'inizio mettono tutti nella propria metà', () => {
    const sim = new MatchSim(cfg());
    expect(sim.players).toHaveLength(22);
    expect(sim.teamSize).toBe(11);
    for (const p of sim.players) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(sim.W);
      if (p.team === 0) expect(p.x).toBeLessThanOrEqual(sim.W / 2 + 10);
      else expect(p.x).toBeGreaterThanOrEqual(sim.W / 2 - 10);
    }
    expect(sim.ball.owner).toBe(sim.teams[sim.kickoffTeam][10]);
  });

  it('ogni modulo dà posizioni diverse e dentro il campo a tutti', () => {
    for (const f of FORMATIONS_11) {
      const sim = new MatchSim(cfg({ formation: f, awayFormation: f }));
      for (const att of [true, false]) {
        const pts = sim.teams[0].map((p) => homePos(sim, p, att));
        for (const pt of pts) {
          expect(pt.x).toBeGreaterThanOrEqual(0);
          expect(pt.x).toBeLessThanOrEqual(sim.W);
          expect(pt.y).toBeGreaterThan(0);
          expect(pt.y).toBeLessThan(sim.H);
        }
        // nessuna coppia di compagni esattamente sullo stesso punto
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(20);
        }
      }
    }
  });

  it('un modulo da 5 su una squadra da 11 ripiega sul 4-4-2', () => {
    const sim = new MatchSim(cfg({ formation: '1-2-1' }));
    const a = sim.teams[0].map((p) => homePos(sim, p, true));
    const sim2 = new MatchSim(cfg({ formation: '4-4-2' }));
    const b = sim2.teams[0].map((p) => homePos(sim2, p, true));
    expect(a).toEqual(b);
  });

  it('una partita CPU contro CPU si gioca fino in fondo con gol e tiri da entrambe le parti', () => {
    let goals = 0;
    let shots = 0;
    let finished = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const sim = new MatchSim(cfg({ seed }));
      for (let i = 0; i < 60 * 400 && sim.phase !== 'end'; i++) {
        sim.update(1 / 60, NONE);
        for (const p of sim.players) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
      }
      if (sim.phase === 'end') finished++;
      goals += sim.score[0] + sim.score[1];
      shots += sim.stats.shots[0] + sim.stats.shots[1];
      expect(sim.stats.shots[0]).toBeGreaterThan(0);
      expect(sim.stats.shots[1]).toBeGreaterThan(0);
    }
    console.log(`11v11: 4 partite, ${goals} gol, ${shots} tiri`);
    expect(finished).toBe(4);
    expect(goals).toBeGreaterThan(0);
  });

  it('i campi ingrandibili restano giocabili', () => {
    for (const id of BIG_PITCHES) {
      const sim = new MatchSim(cfg({ pitch: bigPitch(PITCHES[id]), durationSec: 30 }));
      for (let i = 0; i < 60 * 40; i++) sim.update(1 / 60, NONE);
      for (const p of sim.players) expect(p.x).toBeGreaterThan(-20);
    }
  });

  it('con intervallo e cambi funziona anche a 11', () => {
    const sim = new MatchSim(cfg({ humanTeam: 0, halftime: true }));
    for (let i = 0; i < 60 * 200 && sim.phase !== 'halftime'; i++) sim.update(1 / 60, NONE);
    expect(sim.phase).toBe('halftime');
    expect(sim.substitute(0, 5, 1)).toBe(true);
    sim.resumeSecondHalf();
    expect(sim.phase).toBe('kickoff');
    expect(sim.humanIdx).toBe(10);
  });

  it('il tempo di calcolo di una partita è basso (reggerà sul telefono)', () => {
    const sim = new MatchSim(cfg({ durationSec: 60 }));
    const t0 = performance.now();
    let frames = 0;
    for (; frames < 60 * 60 && sim.phase !== 'end'; frames++) sim.update(1 / 60, NONE);
    const ms = (performance.now() - t0) / frames;
    console.log(`11v11: ${ms.toFixed(2)} ms per frame di simulazione`);
    expect(ms).toBeLessThan(4);
  });

  it('esperienza e crescita seguono i titolari originali, non gli indici dell\'11', () => {
    const base = TEAMS[0];
    const big = expandTeam(base);
    const p = newProgress();
    addXp(p, big, () => 40);
    // la rosa da 5 ha solo 5 voci di esperienza: i sei giocatori nuovi non contano
    expect(p.xp[base.id]).toHaveLength(5);
    const grown = grownTeam(big, p);
    expect(grown.players).toHaveLength(11);
    expect(grown.core).toEqual(big.core);
    // l'attaccante originale è in posizione 9 e prende la sua esperienza
    expect(big.core?.[9]).toBe(4);
    expect(p.xp[base.id][4]).toBe(40);
  });
});
