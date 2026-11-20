import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { APP_VERSION, CHANGELOG, VERSION_TAG } from '../src/ui/version';
import { newChampionshipState, recordChampionshipMatch } from '../src/modes/leggenda';

describe('versione 0.9.3', () => {
  it('sincronizza CHANGELOG e package.json sulla 0.9.3', () => {
    expect(APP_VERSION).toBe('0.9.3');
    expect(APP_VERSION).toBe(pkg.version);
    expect(CHANGELOG[0]?.version).toBe(VERSION_TAG);
  });
});

describe('Campionato Nazionale Giovanile (Leggenda del Pallone)', () => {
  it('gestisce gironi e fase finale correttamente', () => {
    const cs = newChampionshipState();
    expect(cs.teams).toHaveLength(4);
    expect(cs.matches).toHaveLength(6);
    expect(cs.stage).toBe('group');
    recordChampionshipMatch(cs, cs.matches[0].id, 1, 0);
    expect(cs.matches[0].played).toBe(true);
  });
});
