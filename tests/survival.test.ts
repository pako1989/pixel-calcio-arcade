import { describe, expect, it } from 'vitest';
import { PITCHES } from '../src/data/pitches';
import { TEAMS } from '../src/data/teams';
import { checkObjective, MISSIONS } from '../src/modes/missions';
import { newTally, TallyTracker } from '../src/modes/tally';
import {
  applySurvivalMatch,
  generateRound,
  newSurvival,
  pickDraftOption,
  playerOverall,
  statDiffs,
  survivalLaunch,
  type SurvivalRecord,
} from '../src/modes/survival';
import { checkTrophies, newTotals } from '../src/modes/trophies';
import type { MatchOutcome } from '../src/modes/modes';
import { MatchSim, NO_INPUT } from '../src/sim/match';

function makeOutcome(score: [number, number], extraTally?: Partial<ReturnType<typeof newTally>>): MatchOutcome {
  const tally = { ...newTally(), ...extraTally };
  return {
    launch: {
      mode: 'sopravvivenza',
      config: {
        home: TEAMS[0],
        away: TEAMS[1],
        pitch: PITCHES.stadio,
        difficulty: 'normale',
        durationSec: 90,
        powerUps: true,
        goldenGoal: true,
        humanTeam: 0,
      },
    },
    result: {
      score,
      stats: { shots: [3, 1], passes: [6, 4], tackles: [2, 1], possession: [55, 45] },
      goldenGoal: false,
      scorers: [],
    },
    tally,
  };
}

describe('espansione missioni e campi speciali', () => {
  it('copre tutti i campi speciali (piazza, montagna, molo) e ha 18 missioni valide', () => {
    expect(MISSIONS.length).toBe(18);
    const pitches = new Set(MISSIONS.map((m) => m.pitch));
    expect(pitches.has('piazza')).toBe(true);
    expect(pitches.has('montagna')).toBe(true);
    expect(pitches.has('molo')).toBe(true);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(18);
  });

  it('traccia e valuta gol di sponda, da lontano e giocate di stile', () => {
    const tracker = new TallyTracker();
    tracker.feed({ type: 'goal', team: 0, scorer: 'Rossi', x: 840, y: 240, own: false, idx: 4 }, 20);
    tracker.feed({ type: 'trick', kind: 'sponda', team: 0, x: 840, y: 240, name: 'Rossi', idx: 4 }, 20);
    tracker.feed({ type: 'trick', kind: 'lontano', team: 0, x: 840, y: 240, name: 'Rossi', idx: 4 }, 35);

    const o = makeOutcome([2, 1], tracker.t);
    expect(checkObjective({ kind: 'bankGoal' }, o)).toBe(true);
    expect(checkObjective({ kind: 'longGoal' }, o)).toBe(true);
    expect(checkObjective({ kind: 'tricks', n: 2 }, o)).toBe(true);
    expect(checkObjective({ kind: 'tricks', n: 3 }, o)).toBe(false);
  });

  it('applica correttamente i modificatori arcade in MatchSim', () => {
    const sim = new MatchSim({
      home: TEAMS[0],
      away: TEAMS[1],
      pitch: PITCHES.montagna,
      difficulty: 'normale',
      durationSec: 60,
      powerUps: true,
      goldenGoal: false,
      humanTeam: 0,
      seed: 42,
      mods: {
        alwaysFire: true,
        startWall: 10,
        startTurbo: 8,
        superMult: 2,
        staminaMult: 0,
      },
    });
    expect(sim.wall[0]).toBe(10);
    expect(sim.turbo[0]).toBe(8);
    expect(sim.fireShot[0]).toBe(true);
    sim.addSuper(0, 0.3);
    expect(sim.superBar[0]).toBeCloseTo(0.6, 5);
    for (let i = 0; i < 150; i++) {
      sim.update(1 / 60, { ...NO_INPUT, mx: 1, sprint: true });
    }
    expect(sim.human!.stamina).toBe(1);
  });
});

describe('modalità sopravvivenza roguelite', () => {
  it('inizia al round 1, genera boss al round 5 e scala le difficoltà', () => {
    const st = newSurvival('rondini', 'facile', 777);
    expect(st.active).toBe(true);
    expect(st.round).toBe(1);
    expect(st.next.isBoss).toBe(false);
    expect(st.next.rule).toBe('normal');

    const r5 = generateRound(5, 'facile', 777, 'rondini', st.next.pitch);
    expect(r5.isBoss).toBe(true);
    expect(r5.opp.name).toContain('BOSS');
    expect(r5.pitch).not.toBe(st.next.pitch);
    expect(r5.difficulty).toBe('normale');
  });

  it('vincendo genera un draft (ruba giocatore + bonus), applica la scelta e avanza al round successivo', () => {
    const st = newSurvival('aquile', 'normale', 1234);
    const rec: SurvivalRecord = { bestRound: 0, runs: 0, totalWins: 0 };

    const rep = applySurvivalMatch(st, makeOutcome([2, 0]), rec);
    expect(rep.won).toBe(true);
    expect(rep.coins).toBe(28);
    expect(st.pendingDraft?.length).toBe(3);

    const stealOpt = st.pendingDraft!.find((o) => o.kind === 'steal');
    const perkOpt = st.pendingDraft!.find((o) => o.kind === 'perk');
    expect(stealOpt).toBeDefined();
    expect(perkOpt).toBeDefined();

    // Scegliamo di rubare un giocatore
    const stealIdx = st.pendingDraft!.findIndex((o) => o.kind === 'steal');
    const stolenDef = st.pendingDraft![stealIdx];
    if (stolenDef.kind !== 'steal') throw new Error('expected steal');

    expect(pickDraftOption(st, stealIdx)).toBe(true);
    expect(st.stolen).toBe(1);
    expect(st.round).toBe(2);
    expect(st.pendingDraft).toBeUndefined();
    expect(st.team.players[stolenDef.roleIdx].name).toBe(stolenDef.player.name);

    // Round 2: vinciamo e scegliamo un bonus squadra
    const rep2 = applySurvivalMatch(st, makeOutcome([3, 1]), rec);
    expect(rep2.won).toBe(true);
    const perkIdx = st.pendingDraft!.findIndex((o) => o.kind === 'perk');
    expect(pickDraftOption(st, perkIdx)).toBe(true);
    expect(st.perks.length).toBe(1);
    expect(st.round).toBe(3);

    const launch = survivalLaunch(st, (_h, a) => a);
    expect(launch.mode).toBe('sopravvivenza');
    expect(launch.config.goldenGoal).toBe(true);
  });

  it('perdendo chiude la run, salva il riepilogo e sblocca i trofei', () => {
    const st = newSurvival('rondini', 'normale', 99);
    const rec: SurvivalRecord = { bestRound: 1, runs: 0, totalWins: 0 };

    // Supera round 1, 2, 3
    for (let r = 1; r <= 3; r++) {
      const winRep = applySurvivalMatch(st, makeOutcome([1, 0]), rec);
      expect(winRep.won).toBe(true);
      pickDraftOption(st, 0);
    }
    expect(st.round).toBe(4);

    // Perde al round 4 (3 round superati)
    const loseRep = applySurvivalMatch(st, makeOutcome([0, 2]), rec);
    expect(loseRep.won).toBe(false);
    expect(loseRep.roundCleared).toBe(3);
    expect(st.active).toBe(false);
    expect(st.lastSummary?.newRecord).toBe(true);
    expect(st.lastSummary?.wins).toBe(3);

    const unlocked = checkTrophies([], {
      totals: newTotals(),
      cups: 0,
      stickers: 0,
      maxLevelPlayers: 0,
      survival: 3,
      missions: 18,
    });
    expect(unlocked.some((t) => t.id === 'sopravvivenza:3')).toBe(true);
    expect(unlocked.some((t) => t.id === 'missioni:18')).toBe(true);
  });

  it('calcola overall e differenze statistiche per il confronto nel draft', () => {
    const a = TEAMS[0].players[4];
    const b = TEAMS[4].players[4];
    expect(playerOverall(a)).toBeGreaterThan(0);
    expect(Array.isArray(statDiffs(b, a))).toBe(true);
  });
});
