/** Salvataggi locali: preferenze, statistiche, torneo, missioni e storia. */
import type { CareerState } from '../modes/career';
import type { MissionsSave } from '../modes/missions';
import type { TournamentState } from '../modes/tournament';

const KEY = 'pixel-calcio-arcade:v1';

export interface SaveData {
  settings: {
    muted: boolean;
    homeTeam: string;
    awayTeam: string;
    pitch: string;
    difficulty: string;
    duration: number;
    powerUps: boolean;
    tutorialSeen: boolean;
  };
  record: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number };
  /** Diventa un mito (storia). */
  career?: CareerState;
  /** Coppa in corso. */
  tournament?: TournamentState;
  /** Coppe vinte nella modalità torneo. */
  trophies?: number;
  missions?: MissionsSave;
}

const DEFAULTS: SaveData = {
  settings: {
    muted: false,
    homeTeam: 'rondini',
    awayTeam: 'lupi',
    pitch: 'stadio',
    difficulty: 'normale',
    duration: 150,
    powerUps: true,
    tutorialSeen: false,
  },
  record: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 },
};

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>;
      cache = { ...DEFAULTS, ...d, settings: { ...DEFAULTS.settings, ...d.settings }, record: { ...DEFAULTS.record, ...d.record } };
      return cache;
    }
  } catch {
    /* archivio non disponibile: si usano i valori predefiniti */
  }
  cache = structuredClone(DEFAULTS);
  return cache;
}

export function save(mut?: (d: SaveData) => void) {
  const d = load();
  if (mut) mut(d);
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignora */
  }
}
