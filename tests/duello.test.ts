import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import { buildDeck, canPlace, cardOf, cpuPlay, duelCoins, endTurn, newDuel, place, recordDuel, WIN_ROUNDS } from '../src/modes/duello';

describe('duello a carte', () => {
  it('ogni mazzo ha 8 carte con un capitano e valori sensati', () => {
    const d = buildDeck(TEAMS[0], TEAMS, 5, 'a');
    expect(d).toHaveLength(8);
    expect(d.filter((c) => c.captain)).toHaveLength(1);
    for (const c of d) {
      expect(c.dribble).toBeGreaterThanOrEqual(1);
      expect(c.defense).toBeLessThanOrEqual(9);
      expect(c.cost).toBeGreaterThanOrEqual(1);
    }
    expect(cardOf(TEAMS[0].players[0], 'x').role).toBe('GK');
  });

  it('al primo turno non si attacca: nessun vantaggio per chi batte per primo', () => {
    const st = newDuel(TEAMS[0], TEAMS[1], TEAMS, 3);
    st.sides[0].field[0].dribble = 9;
    st.sides[1].field[0].defense = 1;
    expect(endTurn(st)).toEqual([]);
    expect(st.wins).toEqual([0, 0]);
  });

  it('si schiera con energia e le carte entrano in campo al turno dopo', () => {
    const st = newDuel(TEAMS[0], TEAMS[1], TEAMS, 3);
    expect(st.sides[0].field).toHaveLength(1);
    const c = st.sides[0].bench.find((x) => canPlace(st, 0, x))!;
    expect(place(st, 0, c.id)).toBe(true);
    expect(st.sides[0].pending).toContain(c);
    expect(st.sides[0].field).not.toContain(c);
    expect(place(st, 1, st.sides[1].bench[0].id)).toBe(false); // non è il suo turno
    endTurn(st);
    expect(st.turn).toBe(1);
  });

  it('un attaccante più forte salta il difensore e, a campo vuoto, segna', () => {
    const st = newDuel(TEAMS[0], TEAMS[1], TEAMS, 3);
    endTurn(st); // primo turno: si schiera soltanto
    endTurn(st);
    st.sides[0].field[0].dribble = 9;
    st.sides[1].field[0].defense = 2;
    const ev = endTurn(st);
    expect(ev.some((e) => e.kind === 'beat')).toBe(true);
    expect(ev.some((e) => e.kind === 'goal')).toBe(true);
    expect(st.wins[0]).toBe(1);
    expect(st.round).toBe(2);
    // nuovo round: campi ripristinati e batte per primo chi ha subito
    expect(st.turn).toBe(1);
    expect(st.sides[0].field).toHaveLength(1);
  });

  it('una difesa molto più forte elimina chi attacca', () => {
    const st = newDuel(TEAMS[0], TEAMS[1], TEAMS, 3);
    endTurn(st);
    endTurn(st);
    st.sides[0].field[0].dribble = 2;
    st.sides[1].field[0].defense = 6;
    const ev = endTurn(st);
    const stop = ev.find((e) => e.kind === 'stop');
    expect(stop && stop.kind === 'stop' && stop.out).toBe(true);
    expect(st.sides[0].field).toHaveLength(0);
  });

  it('CPU contro CPU: il duello finisce sempre, con un vincitore o un pareggio', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const st = newDuel(TEAMS[seed % TEAMS.length], TEAMS[(seed + 3) % TEAMS.length], TEAMS, seed);
      let guard = 0;
      while (!st.over && guard++ < 400) {
        cpuPlay(st, st.turn, seed % 2 ? 'normale' : 'difficile');
        endTurn(st);
      }
      expect(st.over).toBe(true);
      expect(Math.max(...st.wins)).toBeLessThanOrEqual(WIN_ROUNDS);
    }
  });

  it('la CPU difficile batte la CPU facile più spesso del contrario', () => {
    let hard = 0;
    let easy = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const st = newDuel(TEAMS[0], TEAMS[0], TEAMS, seed);
      let g = 0;
      while (!st.over && g++ < 400) {
        cpuPlay(st, st.turn, st.turn === 0 ? 'difficile' : 'facile');
        endTurn(st);
      }
      if (st.winner === 0) hard++;
      if (st.winner === 1) easy++;
    }
    expect(hard).toBeGreaterThan(easy);
  });

  it('monete e record', () => {
    const st = newDuel(TEAMS[0], TEAMS[1], TEAMS, 1);
    st.over = true;
    st.winner = 0;
    st.wins = [2, 1];
    expect(duelCoins(st)).toBe(50);
    const r = recordDuel(undefined, st);
    expect(r).toEqual({ played: 1, won: 1, streak: 1, bestStreak: 1 });
  });
});
