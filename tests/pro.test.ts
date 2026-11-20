import { describe, expect, it } from 'vitest';
import { newCareer, applyCareerResult, careerLaunch } from '../src/modes/career';
import type { MatchOutcome } from '../src/modes/modes';
import { newTally } from '../src/modes/tally';
import {
  applyProResult, newPro, opponentOf, proBefore, proLaunch, PRO_ROUNDS, signOffer, standings, retire, proRetireLines, proSeasonEnd,
} from '../src/modes/pro';
import { makeTalk, trustAfter } from '../src/modes/spogliatoio';

function outcome(launch: MatchOutcome['launch'], score: [number, number], heroGoals = 0): MatchOutcome {
  const tally = newTally();
  tally.players[0][4] = { goals: heroGoals, assists: 0, shots: heroGoals + 2, passes: 6, tackles: 1, saves: 0, tricks: 0, fouls: 0, reds: 0 };
  return {
    launch,
    result: { score, stats: { shots: [5, 3], passes: [10, 8], tackles: [3, 3], possession: [50, 50] }, goldenGoal: false, scorers: [] },
    tally,
  };
}

const hero = { name: 'Nico', number: 10, look: { skin: 0, hair: 0, hairStyle: 0 } };

describe('spogliatoio', () => {
  it('fiducia sale con voti alti e scende con voti bassi', () => {
    expect(trustAfter(50, 8, 'w')).toBeGreaterThan(60);
    expect(trustAfter(50, 4.5, 'l')).toBeLessThan(40);
    expect(trustAfter(99, 10, 'w')).toBe(100);
  });
  it('colloquio con tre risposte', () => {
    for (const v of [4, 6, 8]) expect(makeTalk(v, 0, 'd', false, 1, { who: 'mister', name: 'X' }).options).toHaveLength(3);
  });
  it('la storia dà voto, colloquio e titolo di giornale', () => {
    const c = newCareer(hero, 'facile');
    const l = careerLaunch(c, (_h, a) => a);
    expect(l.spotlight).toBe(4);
    const r = applyCareerResult(c, outcome(l, [2, 0], 2));
    expect(r.vote).toBeGreaterThanOrEqual(7);
    expect(c.talk).toBeDefined();
    expect(c.news?.[0].title).toContain('NICO');
  });
});

describe('carriera da pro', () => {
  it('stagione completa, offerte, nuova stagione e ritiro', () => {
    const c = newCareer(hero, 'normale');
    c.finished = true;
    c.pro = newPro(c);
    const p = c.pro;
    for (let r = 0; r < PRO_ROUNDS; r++) {
      expect(opponentOf(p)).toBeDefined();
      expect(proBefore(c).length).toBeGreaterThan(0);
      const l = proLaunch(c, (_h, a) => a);
      expect(l.config.home.players[4].name).toBe('Nico');
      const rep = applyProResult(c, outcome(l, [2, 1], 1));
      if (r < PRO_ROUNDS - 1) expect(rep.seasonEnd).toBeUndefined();
      else {
        expect(rep.seasonEnd).toBeDefined();
        expect(proSeasonEnd(c, rep).length).toBeGreaterThan(1);
      }
    }
    // ogni squadra ha giocato tutte le partite
    for (const s of standings(p)) expect(s.row.p).toBe(PRO_ROUNDS);
    expect(standings(p)[0].id).toBe(p.club); // 7 vittorie su 7
    expect(p.cabinet.scudetti).toBe(1);
    expect(p.cabinet.cannoniere).toBe(1);
    expect(p.phase).toBe('nazionale');
    const nl = proLaunch(c, (_h, a) => a);
    expect(nl.config.home.name).toBe('Nazionale Pixel');
    applyProResult(c, outcome(nl, [1, 0], 1));
    expect(p.cabinet.nazionale).toBe(1);
    expect(p.phase).toBe('offers');
    expect(p.offers.length).toBe(3);
    expect(p.offers[0].renew).toBe(true);
    signOffer(c, p.offers[1]);
    expect(p.season).toBe(2);
    expect(p.age).toBe(21);
    expect(p.round).toBe(0);
    expect(p.phase).toBe('league');
    retire(c);
    expect(p.phase).toBe('retired');
    expect(proRetireLines(c).length).toBeGreaterThan(2);
  });

  it('con poca fiducia si parte dalla panchina, a metà partita', () => {
    const c = newCareer(hero, 'normale');
    c.finished = true;
    c.pro = newPro(c);
    c.trust = 20;
    const l = proLaunch(c, (_h, a) => a);
    expect(l.startScore).toBeDefined();
    expect(l.config.durationSec).toBe(75);
    // il primo tempo non cambia se si riprova
    const l2 = proLaunch(c, (_h, a) => a);
    expect(l2.startScore).toEqual(l.startScore);
  });
});
