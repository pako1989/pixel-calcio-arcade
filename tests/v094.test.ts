import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { APP_VERSION, CHANGELOG, VERSION_TAG } from '../src/ui/version';
import { newManager, renewContract } from '../src/modes/manager';

describe('versione 0.9.4', () => {
  it('sincronizza CHANGELOG e package.json sulla 0.9.4', () => {
    expect(APP_VERSION).toBe('0.9.4');
    expect(APP_VERSION).toBe(pkg.version);
    expect(CHANGELOG[0]?.version).toBe(VERSION_TAG);
  });
});

describe('Carriera Allenatore Avanzata (Sponsor & Contratti)', () => {
  it('inizializza sponsor e boardConfidence e permette rinnovo contratto', () => {
    const st = newManager('Atletico Test', 0, 'normale');
    expect(st.sponsor).toBeDefined();
    expect(st.sponsor.weekly).toBeGreaterThan(0);
    expect(st.boardConfidence).toBe(75);

    const p = st.squad[0];
    const ok = renewContract(st, p.id);
    expect(ok).toBe(true);
  });
});
