import { describe, expect, it } from 'vitest';
import { goals, isOver, newShootout, nextTeam, quickShootout, resolveShot, takers, winner, type PenOutcome } from '../src/modes/penalties';
import { applyUserResult, newTournament, quickMatch } from '../src/modes/tournament';
import { applyWeather } from '../src/data/weather';
import { TEAMS } from '../src/data/teams';
import { PITCHES } from '../src/data/pitches';
import { Rng } from '../src/sim/math';

function kick(s: ReturnType<typeof newShootout>, r: PenOutcome) {
  s.kicks.push({ team: nextTeam(s), taker: 'x', result: r });
}

describe('rigori', () => {
  it('si alternano e finiscono prima se una squadra non può più rimontare', () => {
    const s = newShootout(0);
    expect(nextTeam(s)).toBe(0);
    kick(s, 'gol');
    expect(nextTeam(s)).toBe(1);
    // 3-0 dopo tre tiri a testa: la squadra B ne ha solo due da tirare
    kick(s, 'parato');
    kick(s, 'gol');
    kick(s, 'fuori');
    kick(s, 'gol');
    expect(isOver(s)).toBe(false);
    kick(s, 'palo');
    expect(isOver(s)).toBe(true);
    expect(winner(s)).toBe(0);
  });

  it('dopo cinque tiri pari si va a oltranza', () => {
    const s = newShootout(1);
    for (let i = 0; i < 10; i++) kick(s, 'gol');
    expect(isOver(s)).toBe(false);
    kick(s, 'gol');
    expect(isOver(s)).toBe(false);
    kick(s, 'parato');
    expect(isOver(s)).toBe(true);
    expect(winner(s)).toBe(1);
    expect(goals(s)).toEqual([5, 6]);
  });

  it('pali, fuori e parate', () => {
    expect(resolveShot({ u: 1.2, v: 0.3 }, null, 0.5)).toBe('fuori');
    expect(resolveShot({ u: 0.3, v: 1.2 }, null, 0.5)).toBe('fuori');
    expect(resolveShot({ u: 0.98, v: 0.3 }, null, 0.5)).toBe('palo');
    expect(resolveShot({ u: 0.7, v: 0.3 }, { u: 0.7, v: 0.35 }, 0.5)).toBe('parato');
    expect(resolveShot({ u: 0.7, v: 0.3 }, { u: -0.7, v: 0.35 }, 0.5)).toBe('gol');
  });

  it('il portiere tira per ultimo', () => {
    const t = takers(TEAMS[0]);
    expect(t[t.length - 1].role).toBe('GK');
  });

  it('una serie simulata ha sempre un vincitore', () => {
    for (let i = 0; i < 50; i++) {
      const [a, b] = quickShootout(TEAMS[0], TEAMS[1], new Rng(i));
      expect(a).not.toBe(b);
    }
  });
});

describe('torneo con i rigori', () => {
  it('pareggio e rigori vinti: si passa il turno', () => {
    const st = newTournament('rondini', 'normale', 5);
    expect(applyUserResult(st, 1, 1, false, [4, 3])).toBe('avanti');
    expect(st.results[0][0].pens).toEqual([4, 3]);
  });
  it('pareggio e rigori persi: eliminati', () => {
    const st = newTournament('rondini', 'normale', 5);
    expect(applyUserResult(st, 2, 2, false, [2, 4])).toBe('eliminato');
  });
  it('le partite della CPU finite pari si decidono ai rigori', () => {
    for (let i = 0; i < 80; i++) {
      const m = quickMatch(TEAMS[0].id, TEAMS[1].id, new Rng(i));
      if (m.ga === m.gb) expect(m.pens).toBeDefined();
      expect([m.a, m.b]).toContain(m.winner);
    }
  });
});

describe('meteo', () => {
  it('la pioggia frena la palla e fa scivolare', () => {
    const p = applyWeather(PITCHES.stadio, 'pioggia');
    expect(p.ballFriction).toBeGreaterThan(PITCHES.stadio.ballFriction);
    expect(p.playerGrip).toBeLessThan(PITCHES.stadio.playerGrip);
    expect(applyWeather(PITCHES.stadio, 'nebbia')).toBe(PITCHES.stadio);
  });
});
