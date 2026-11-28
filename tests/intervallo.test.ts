import { describe, expect, it } from 'vitest';
import { MatchSim, MAX_SUBS } from '../src/sim/match';
import { TEAMS } from '../src/data/teams';
import { PITCHES } from '../src/data/pitches';
import type { MatchConfig } from '../src/sim/types';

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.stadio, difficulty: 'normale',
    durationSec: 120, powerUps: false, goldenGoal: false, seed: 11, humanTeam: 0, halftime: true, ...over,
  };
}
const NONE = { mx: 0, my: 0, shoot: false, pass: false, sprint: false };

function toHalftime(sim: MatchSim) {
  for (let i = 0; i < 60 * 200 && sim.phase !== 'halftime'; i++) sim.update(1 / 60, NONE);
  expect(sim.phase).toBe('halftime');
}

describe('intervallo', () => {
  it('si ferma a metà del tempo e non prima', () => {
    const sim = new MatchSim(cfg());
    toHalftime(sim);
    expect(sim.timeLeft).toBeLessThanOrEqual(60);
    expect(sim.timeLeft).toBeGreaterThan(58);
    const before = sim.timeLeft;
    for (let i = 0; i < 120; i++) sim.update(1 / 60, NONE);
    expect(sim.timeLeft).toBe(before);
    expect(sim.phase).toBe('halftime');
  });

  it('senza l\'opzione la partita non si ferma', () => {
    const sim = new MatchSim(cfg({ halftime: false }));
    for (let i = 0; i < 60 * 400 && sim.phase !== 'end'; i++) {
      sim.update(1 / 60, NONE);
      expect(sim.phase).not.toBe('halftime');
    }
    expect(sim.phase).toBe('end');
  });

  it('il secondo tempo riparte dall\'altra squadra e si gioca fino alla fine', () => {
    const sim = new MatchSim(cfg());
    const first = sim['initialKick' as keyof MatchSim] as unknown as 0 | 1;
    toHalftime(sim);
    sim.resumeSecondHalf();
    expect(sim.phase).toBe('kickoff');
    expect(sim.kickoffTeam).toBe(first === 0 ? 1 : 0);
    for (let i = 0; i < 60 * 200 && sim.phase !== 'end'; i++) {
      sim.update(1 / 60, NONE);
      expect(sim.phase).not.toBe('halftime');
    }
    expect(sim.phase).toBe('end');
  });

  it('i titolari si stancano e la riserva entra fresca', () => {
    const sim = new MatchSim(cfg());
    toHalftime(sim);
    const p = sim.teams[0][2];
    expect(p.fitness).toBeLessThan(1);
    const old = p.def.name;
    const res = sim.bench[0][1].def.name;
    expect(sim.substitute(0, 2, 1)).toBe(true);
    expect(p.def.name).toBe(res);
    expect(p.fitness).toBe(1);
    expect(sim.bench[0][1].def.name).toBe(old);
    expect(sim.bench[0][1].fitness).toBeLessThan(1);
    expect(sim.events.some((e) => e.type === 'sub')).toBe(true);
  });

  it('i cambi sono limitati, vietati al portiere e solo durante l\'intervallo', () => {
    const sim = new MatchSim(cfg());
    expect(sim.substitute(0, 2, 0)).toBe(false);
    toHalftime(sim);
    expect(sim.substitute(0, 0, 0)).toBe(false);
    for (let i = 0; i < MAX_SUBS; i++) expect(sim.substitute(0, 1 + (i % 4), i % 3)).toBe(true);
    expect(sim.substitute(0, 4, 0)).toBe(false);
    sim.resumeSecondHalf();
    expect(sim.substitute(1, 2, 0)).toBe(false);
  });

  it('la CPU cambia da sola chi è più stanco', () => {
    const sim = new MatchSim(cfg({ seed: 5 }));
    toHalftime(sim);
    expect(sim.subsLeft[1]).toBeLessThanOrEqual(MAX_SUBS);
    expect(sim.subsLeft[0]).toBe(MAX_SUBS);
  });

  it('modulo e tattica si cambiano nell\'intervallo', () => {
    const sim = new MatchSim(cfg());
    toHalftime(sim);
    sim.setFormation(0, '2-1-1');
    sim.setTactic(0, 'attacco');
    expect(sim.cfg.formation).toBe('2-1-1');
    expect(sim.tactic[0]).toBe('attacco');
  });

  it('le riserve hanno ruoli e nomi diversi dai titolari', () => {
    const sim = new MatchSim(cfg());
    expect(sim.bench[0].map((r) => r.def.role)).toEqual(['DEF', 'MID', 'FWD']);
    const names = new Set(TEAMS[0].players.map((p) => p.name));
    for (const r of sim.bench[0]) expect(names.has(r.def.name)).toBe(false);
  });
});
