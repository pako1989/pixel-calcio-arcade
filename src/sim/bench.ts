/**
 * Panchina: tre riserve per squadra (difensore, centrocampista, attaccante) per i cambi
 * dell'intervallo. Le statistiche partono da quelle dei titolari dello stesso ruolo,
 * un po' più basse: la riserva è fresca ma di solito non più forte.
 */
import type { PlayerDef, PlayerStats, Role, TeamDef } from './types';
import { Rng } from './math';

export interface Reserve {
  def: PlayerDef;
  /** Condizione fisica (0..1): chi esce resta stanco in panchina. */
  fitness: number;
}

const NOMI = [
  'Sanna', 'Bellini', 'Ferrara', 'Colombo', 'Gatti', 'Pellegrini', 'Basile', 'Amato', 'Silvestri', 'Rinaldi',
  'Cattaneo', 'Valentini', 'Mazza', 'Guerra', 'Piras', 'Coppola', 'Donati', 'Farina', 'Bernardi', 'Cirillo',
];

const SLOTS: { role: Role; number: number }[] = [
  { role: 'DEF', number: 12 },
  { role: 'MID', number: 14 },
  { role: 'FWD', number: 17 },
];

const KEYS: (keyof PlayerStats)[] = ['speed', 'shot', 'pass', 'tackle', 'control', 'keeping'];

export function makeBench(team: TeamDef, seed: number): Reserve[] {
  const rng = new Rng(seed);
  const used = new Set(team.players.map((p) => p.name));
  return SLOTS.map((slot) => {
    const src = team.players.filter((p) => p.role === slot.role);
    const stats = {} as PlayerStats;
    for (const k of KEYS) {
      const avg = src.reduce((a, p) => a + p.stats[k], 0) / Math.max(1, src.length);
      stats[k] = Math.max(0.5, Math.min(1.2, avg * 0.95 + rng.range(-0.04, 0.04)));
    }
    let name = rng.pick(NOMI);
    for (let guard = 0; used.has(name) && guard < 30; guard++) name = rng.pick(NOMI);
    used.add(name);
    return {
      def: {
        name,
        number: slot.number,
        role: slot.role,
        stats,
        look: { skin: Math.floor(rng.next() * 5), hair: Math.floor(rng.next() * 6), hairStyle: Math.floor(rng.next() * 4) },
      },
      fitness: 1,
    };
  });
}

/** Valutazione generale 0..99 di un giocatore (media delle statistiche utili al suo ruolo). */
export function overall(d: PlayerDef): number {
  const s = d.stats;
  const v = d.role === 'GK' ? s.keeping : d.role === 'DEF' ? (s.tackle * 2 + s.speed + s.pass) / 4 : d.role === 'MID' ? (s.pass * 2 + s.control + s.speed) / 4 : (s.shot * 2 + s.speed + s.control) / 4;
  return Math.max(1, Math.min(99, Math.round(v * 80)));
}
