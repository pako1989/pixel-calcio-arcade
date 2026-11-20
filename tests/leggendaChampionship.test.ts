import { describe, it, expect } from 'vitest';
import { newChampionshipState, recordChampionshipMatch } from '../src/modes/leggenda';

describe('Campionato Nazionale Giovanile', () => {
  it('initializes championship with group stage and 4 teams', () => {
    const cs = newChampionshipState();
    expect(cs.active).toBe(true);
    expect(cs.stage).toBe('group');
    expect(cs.teams.length).toBe(4);
    expect(cs.matches.length).toBe(6);
    expect(cs.teams.some((t) => t.id === 'portobello')).toBe(true);
  });

  it('records match results and updates standings table', () => {
    const cs = newChampionshipState();
    const match = cs.matches[0]; // portobello vs santelmo
    recordChampionshipMatch(cs, match.id, 2, 0);

    expect(match.played).toBe(true);
    expect(match.homeScore).toBe(2);
    expect(match.awayScore).toBe(0);

    const portobello = cs.teams.find((t) => t.id === 'portobello')!;
    expect(portobello.p).toBe(1);
    expect(portobello.w).toBe(1);
    expect(portobello.gf).toBe(2);
    expect(portobello.ga).toBe(0);
    expect(portobello.pts).toBe(3);
  });

  it('progresses to final after group stage is complete', () => {
    const cs = newChampionshipState();
    // Play all 6 group matches
    for (const m of cs.matches.filter((x) => x.stage === 'group')) {
      const hs = m.homeId === 'portobello' ? 3 : 1;
      const as = m.awayId === 'portobello' ? 0 : 1;
      recordChampionshipMatch(cs, m.id, hs, as);
    }

    expect(cs.stage).toBe('final');
    const finalMatch = cs.matches.find((x) => x.stage === 'final');
    expect(finalMatch).toBeDefined();
    expect(finalMatch?.homeId).toBe('portobello');
  });
});
