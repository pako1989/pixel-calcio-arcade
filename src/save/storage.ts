/** Salvataggi locali: preferenze, statistiche, torneo, missioni e storia. */
import type { CareerState } from '../modes/career';
import type { ConquistaState } from '../modes/conquista';
import type { ManagerState } from '../modes/manager';
import type { AlbumSave } from '../modes/album';
import { newProgress, type ProgressSave } from '../modes/progress';
import type { MissionsSave } from '../modes/missions';
import type { TournamentState } from '../modes/tournament';
import type { LeggendaSave } from '../modes/leggenda';
import type { SurvivalRecord, SurvivalState } from '../modes/survival';

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
    /** Volumi 0..1 di musica, effetti e pubblico. */
    music: number;
    sfx: number;
    crowd: number;
    /** Telecronaca a voce. */
    voice: boolean;
    /** Meteo e orario scelti in Partita veloce. */
    weather: string;
    night: string;
    /** Falli, cartellini e infortuni in partita. */
    fouls: boolean;
  };
  record: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number };
  /** Diventa un mito (storia). */
  career?: CareerState;
  /** Coppa in corso. */
  tournament?: TournamentState;
  /** Coppe vinte nella modalità torneo. */
  trophies?: number;
  missions?: MissionsSave;
  /** Quartiere contro Città (saga della squadra). */
  conquista?: ConquistaState;
  /** Modalità manager (club, rosa, campionato). */
  manager?: ManagerState;
  /** Album delle figurine. */
  album?: AlbumSave;
  /** Monete, negozio, crescita dei giocatori e rivalità. */
  progress?: ProgressSave;
  /** Leggenda del Pallone (storia in stile anime). */
  leggenda?: LeggendaSave;
  /** Sopravvivenza roguelite: corsa in corso e record personale. */
  survival?: SurvivalState;
  survivalBest?: SurvivalRecord;
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
    music: 0.6,
    sfx: 0.8,
    crowd: 0.8,
    voice: true,
    weather: 'sereno',
    night: 'giorno',
    fouls: false,
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

/** Applica all'audio le preferenze salvate. */
export function audioPrefs() {
  const s = load().settings;
  return { muted: s.muted, music: s.music, sfx: s.sfx, crowd: s.crowd, voice: s.voice };
}

/** Progressi (monete, negozio, crescita), creati al primo uso. */
export function progressOf(): ProgressSave {
  const d = load();
  if (!d.progress) d.progress = newProgress();
  const p = d.progress;
  // salvataggi vecchi: campi aggiunti dopo
  p.xp = p.xp ?? {};
  p.vs = p.vs ?? {};
  return p;
}
