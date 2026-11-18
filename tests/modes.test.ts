import { describe, expect, it } from 'vitest';
import { applyUserResult, newTournament, userOpponent } from '../src/modes/tournament';
import { checkObjective, isUnlocked, MISSIONS } from '../src/modes/missions';
import { applyCareerResult, careerLaunch, newCareer, STORY, teamsFor } from '../src/modes/career';
import { newTally } from '../src/modes/tally';
import { TEAMS, teamById } from '../src/data/teams';
import { PITCHES } from '../src/data/pitches';
import type { MatchOutcome } from '../src/modes/modes';
import { MatchSim } from '../src/sim/match';

function outcome(score: [number, number], scorers: { team: 0 | 1; name: string; time: number }[] = []): MatchOutcome {
  const tally = newTally();
  tally.goals = [...score] as [number, number];
  return {
    launch: { mode: 'quick', config: { home: TEAMS[0], away: TEAMS[1], pitch: PITCHES.stadio, difficulty: 'facile', durationSec: 60, powerUps: true, goldenGoal: false, humanTeam: 0 } },
    result: { score, stats: { shots: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [50, 50] }, goldenGoal: false, scorers },
    tally,
  };
}

describe('torneo', () => {
  it('8 squadre diverse, vincendo sempre si diventa campioni', () => {
    const st = newTournament('rondini', 'normale', 123);
    expect(new Set(st.bracket).size).toBe(8);
    expect(st.bracket[0]).toBe('rondini');
    expect(applyUserResult(st, 2, 1, false)).toBe('avanti');
    expect(applyUserResult(st, 3, 0, false)).toBe('avanti');
    expect(userOpponent(st)).not.toBeNull();
    expect(applyUserResult(st, 1, 0, true)).toBe('campione');
    expect(st.champion).toBe('rondini');
    expect(userOpponent(st)).toBeNull();
  });
  it('eliminati ai quarti: la coppa si completa da sola', () => {
    const st = newTournament('aquile', 'facile', 5);
    expect(applyUserResult(st, 0, 2, false)).toBe('eliminato');
    expect(st.round).toBe(3);
    expect(st.champion).toBeDefined();
    expect(st.champion).not.toBe('aquile');
    for (const r of st.results) for (const m of r) expect(m.ga).not.toBe(m.gb);
  });
});

describe('missioni', () => {
  it('obiettivi valutati correttamente', () => {
    const o = outcome([3, 0]);
    expect(checkObjective({ kind: 'win' }, o)).toBe(true);
    expect(checkObjective({ kind: 'clean' }, o)).toBe(true);
    expect(checkObjective({ kind: 'winBy', n: 3 }, o)).toBe(true);
    expect(checkObjective({ kind: 'superGoal', n: 1 }, o)).toBe(false);
    expect(checkObjective({ kind: 'notLose' }, outcome([1, 1]))).toBe(true);
  });
  it('id unici, squadre esistenti e sblocco progressivo', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      expect(teamById(m.team).id).toBe(m.team);
      expect(teamById(m.opp).id).toBe(m.opp);
    }
    expect(isUnlocked(2, {})).toBe(true);
    expect(isUnlocked(3, {})).toBe(false);
    expect(isUnlocked(3, { primo: true })).toBe(true);
  });
});

describe('diventa un mito', () => {
  const hero = { name: 'Nico', number: 10, look: { skin: 0, hair: 0, hairStyle: 0 } };
  it('il protagonista è in squadra e il rivale negli avversari', () => {
    const c = newCareer(hero, 'normale');
    const { mine, opp } = teamsFor(c, STORY[0]);
    expect(mine.players[4].name).toBe('Nico');
    expect(opp.players[4].name).toBe('Ferraro');
    expect(mine.players.filter((p) => p.name === 'Nico').length).toBe(1);
    const l = careerLaunch(c, (_h, a) => a);
    expect(l.config.difficulty).toBe('facile');
  });
  it('si arriva alla fine vincendo tutte le partite', () => {
    const c = newCareer(hero, 'facile');
    let guard = 0;
    while (!c.finished && guard++ < 50) {
      const step = STORY[c.step];
      const start = step.startScore ?? [0, 0];
      const o = outcome([start[0] + 3, start[1]], [{ team: 0, name: 'Nico', time: 10 }]);
      expect(applyCareerResult(c, o).success).toBe(true);
    }
    expect(c.finished).toBe(true);
    expect(c.perks).toEqual(['bomber', 'leader']);
    expect(c.goals).toBe(STORY.length);
  });
  it('una sconfitta non fa avanzare ma dà un punto', () => {
    const c = newCareer(hero, 'facile');
    const r = applyCareerResult(c, outcome([0, 1]));
    expect(r.success).toBe(false);
    expect(c.step).toBe(0);
    expect(c.points).toBe(3);
  });
  it('ogni partita della storia si gioca senza errori', () => {
    const c = newCareer(hero, 'normale');
    c.perks = ['bomber', 'leader'];
    for (let i = 0; i < STORY.length; i++) {
      c.step = i;
      const l = careerLaunch(c, (_h, a) => a);
      const sim = new MatchSim({ ...l.config, humanTeam: null, durationSec: 20, goldenGoal: false, seed: i + 1 });
      for (let t = 0; t < 40 * 60 && sim.phase !== 'end'; t++) {
        sim.update(1 / 60);
        sim.events.length = 0;
      }
      expect(sim.phase).toBe('end');
    }
  });
});
