import { describe, expect, it } from 'vitest';
import { EPISODES, CAST, heroTeam, rivalTeam } from '../src/modes/leggendaStory';
import { TECHS, MY_TECHS, TECH_OWNER, bonusOf, bonusMet, claimBonus, newLeggenda, BONUS_GOALS } from '../src/modes/leggenda';
import { PRE_EVENTS, pickEvent } from '../src/modes/leggendaEventi';
import { RECRUITS, cardById } from '../src/modes/leggendaStelle';

describe('Leggenda: secondo arco (Oltre l\'alba)', () => {
  it('ci sono 14 episodi e ognuno ha squadre complete e tecniche esistenti', () => {
    expect(EPISODES.length).toBe(14);
    for (let ep = 0; ep < EPISODES.length; ep++) {
      for (const t of [heroTeam(ep), rivalTeam(ep)]) {
        expect(t.players.length).toBe(7);
        for (const p of t.players) for (const q of p.techs) expect(TECHS[q], `${p.id} ${q}`).toBeTruthy();
      }
      for (const ev of EPISODES[ep].script) for (const l of ev.lines) expect(l.who === 'narr' || l.who === 'title' || CAST[l.who], l.who).toBeTruthy();
      for (const l of [...EPISODES[ep].intro, ...EPISODES[ep].win, ...EPISODES[ep].lose]) expect(l.who === 'narr' || l.who === 'title' || CAST[l.who], l.who).toBeTruthy();
    }
  });

  it('le nuove tecniche sono nel libro e i nuovi personaggi diventano carte', () => {
    for (const id of ['nova', 'bastione']) {
      expect(MY_TECHS).toContain(id);
      expect(TECH_OWNER[id]).toBeTruthy();
    }
    for (const ids of Object.values(RECRUITS)) for (const id of ids) expect(cardById(id), id).toBeTruthy();
  });

  it('gli obiettivi bonus si prendono una volta sola', () => {
    expect(BONUS_GOALS.length).toBe(EPISODES.length);
    const s = newLeggenda();
    const good = { duelsWon: 20, score: [5, 0] as [number, number], specialGoals: 5 };
    expect(claimBonus(s, 3, false, good)).toBeNull();
    const r = claimBonus(s, 3, true, good);
    expect(r).not.toBeNull();
    expect(claimBonus(s, 3, true, good)).toBeNull();
    expect(bonusMet(bonusOf(1), { duelsWon: 0, score: [1, 1], specialGoals: 0 })).toBe(false);
  });

  it('gli imprevisti hanno sempre due scelte e non si ripetono di fila', () => {
    for (const e of PRE_EVENTS) expect(e.choices.length).toBeGreaterThanOrEqual(2);
    expect(pickEvent(0, () => 0)).toBeNull();
    let last: string | undefined;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const ev = pickEvent(6, rnd, last);
      if (ev) {
        expect(ev.id).not.toBe(last);
        last = ev.id;
        n++;
      }
    }
    expect(n).toBeGreaterThan(80);
  });
});
