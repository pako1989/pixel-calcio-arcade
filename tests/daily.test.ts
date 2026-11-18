import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import { applyDaily, dailyFor, dailyState, dailyText, matchCounts } from '../src/modes/daily';
import { addMatchTotals, checkTrophies, newTotals, TROPHIES } from '../src/modes/trophies';
import { bestOnPitch, teamRatings, voteFor } from '../src/modes/ratings';
import { newTally, TallyTracker } from '../src/modes/tally';
import type { MatchOutcome } from '../src/modes/modes';
import { MatchSim } from '../src/sim/match';
import { PITCHES } from '../src/data/pitches';

function outcome(score: [number, number], tune?: (t: ReturnType<typeof newTally>) => void): MatchOutcome {
  const tally = newTally();
  tune?.(tally);
  return {
    launch: { mode: 'quick', config: { home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.stadio, difficulty: 'normale', durationSec: 60, powerUps: true, goldenGoal: false, humanTeam: 0 } },
    result: { score, stats: { shots: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [50, 50] }, goldenGoal: false, scorers: [] },
    tally,
  };
}

describe('sfide del giorno', () => {
  it('tre sfide diverse, uguali per lo stesso giorno', () => {
    const a = dailyFor('2026-11-18');
    expect(a).toHaveLength(3);
    expect(new Set(a.map((d) => d.kind)).size).toBe(3);
    expect(dailyFor('2026-11-18')).toEqual(a);
    expect(a.every((d) => d.reward > 0 && dailyText(d).length > 0)).toBe(true);
  });
  it('si azzera quando cambia il giorno', () => {
    const s = dailyState(undefined, '2026-11-18');
    s.got[0] = 1;
    expect(dailyState(s, '2026-11-18')).toBe(s);
    expect(dailyState(s, '2026-11-19').got).toEqual([0, 0, 0]);
  });
  it('le partite si sommano fino a completare', () => {
    const s = dailyState(undefined, '2026-11-18');
    s.list = [{ kind: 'gol', n: 3, reward: 40 }, { kind: 'imbattuto', n: 1, reward: 70 }, { kind: 'tunnel', n: 2, reward: 90 }];
    expect(applyDaily(s, outcome([2, 1]))).toEqual([]);
    expect(s.got).toEqual([2, 0, 0]);
    const done = applyDaily(s, outcome([1, 0], (t) => (t.tunnels[0] = 1)));
    expect(done.map((d) => d.kind)).toEqual(['gol', 'imbattuto']);
    expect(applyDaily(s, outcome([5, 0])).length).toBe(0);
    expect(s.got[0]).toBe(3);
  });
});

describe('trofei', () => {
  it('si sbloccano una volta sola', () => {
    const t = newTotals();
    addMatchTotals(t, outcome([3, 0]), true);
    expect(t).toMatchObject({ partite: 1, vittorie: 1, gol: 3, imbattuto: 1, rivali: 1 });
    const have: string[] = [];
    const ctx = { totals: t, cups: 0, stickers: 0, maxLevelPlayers: 0 };
    const first = checkTrophies(have, ctx).map((d) => d.id);
    expect(first).toEqual(expect.arrayContaining(['partite:1', 'vittorie:1', 'imbattuto:1', 'rivali:1']));
    expect(checkTrophies(have, ctx)).toEqual([]);
    expect(new Set(TROPHIES.map((d) => d.id)).size).toBe(TROPHIES.length);
  });
});

describe('pagella', () => {
  it('i voti premiano gol e parate e restano tra 4 e 10', () => {
    const z = { goals: 0, assists: 0, shots: 0, passes: 0, tackles: 0, saves: 0, tricks: 0, fouls: 0, reds: 0 };
    expect(voteFor('MID', z, 0, 0)).toBe(6);
    expect(voteFor('FWD', { ...z, goals: 2 }, 2, 0)).toBeGreaterThan(7.5);
    expect(voteFor('GK', z, 0, 9)).toBe(4);
    expect(voteFor('FWD', { ...z, goals: 9, assists: 5 }, 9, 0)).toBe(10);
  });
  it('una partita vera riempie i numeri dei giocatori', () => {
    const sim = new MatchSim({ home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.stadio, difficulty: 'normale', durationSec: 90, powerUps: false, goldenGoal: false, humanTeam: null, seed: 7 });
    const tr = new TallyTracker();
    for (let i = 0; i < 60 * 95 && sim.phase !== 'end'; i++) {
      sim.update(1 / 60);
      for (const e of sim.events) tr.feed(e, sim.elapsed);
      sim.events.length = 0;
    }
    const r = sim.result;
    const goals = tr.t.players[0].reduce((s, p) => s + p.goals, 0) + tr.t.ownGoals[1];
    expect(goals).toBe(r.score[0]);
    expect(tr.t.players[0].reduce((s, p) => s + p.passes, 0)).toBeGreaterThan(0);
    const h = teamRatings(TEAMS[0], 0, tr.t, r);
    const best = bestOnPitch(h, teamRatings(TEAMS[1], 1, tr.t, r), r);
    expect(h).toHaveLength(TEAMS[0].players.length);
    expect(best.vote).toBeGreaterThanOrEqual(Math.max(...h.map((x) => x.vote)));
    expect(matchCounts({ ...outcome(r.score), tally: tr.t }).gol).toBe(r.score[0]);
  });
});
