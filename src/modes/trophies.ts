import type { MatchOutcome } from './modes';
import { matchCounts } from './daily';

/** Bacheca dei trofei: traguardi di tutta la carriera, con monete in premio. */

export interface Totals {
  partite: number;
  vittorie: number;
  gol: number;
  giocate: number;
  tunnel: number;
  imbattuto: number;
  super: number;
  assist: number;
  rivali: number;
  sfide: number;
}

export type TrophyStat = keyof Totals | 'coppe' | 'figurine' | 'livello5' | 'leggenda' | 'sopravvivenza' | 'missioni';

export interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  stat: TrophyStat;
  n: number;
  reward: number;
}

const T = (stat: TrophyStat, n: number, name: string, desc: string, reward: number): TrophyDef => ({ id: `${stat}:${n}`, stat, n, name, desc, reward });

export const TROPHIES: TrophyDef[] = [
  T('partite', 1, 'Primo fischio', 'Gioca la prima partita', 20),
  T('partite', 10, 'Abituale', 'Gioca 10 partite', 50),
  T('partite', 50, 'Veterano', 'Gioca 50 partite', 150),
  T('vittorie', 1, 'Prima gioia', 'Vinci una partita', 20),
  T('vittorie', 10, 'Vincente', 'Vinci 10 partite', 60),
  T('vittorie', 50, 'Leggenda', 'Vinci 50 partite', 200),
  T('gol', 10, 'Bomber', 'Segna 10 gol', 40),
  T('gol', 50, 'Cannoniere', 'Segna 50 gol', 120),
  T('gol', 100, 'Re del gol', 'Segna 100 gol', 250),
  T('giocate', 10, 'Artista', '10 giocate di stile', 40),
  T('giocate', 50, 'Fantasista', '50 giocate di stile', 150),
  T('tunnel', 5, 'Tunnel!', 'Fai 5 tunnel', 60),
  T('tunnel', 25, 'Re del tunnel', 'Fai 25 tunnel', 200),
  T('imbattuto', 1, 'Porta chiusa', 'Vinci a porta chiusa', 30),
  T('imbattuto', 10, 'Muro', '10 vittorie a zero', 150),
  T('super', 5, 'Super!', '5 gol col super tiro', 60),
  T('assist', 10, 'Uomo assist', 'Fai 10 assist', 60),
  T('rivali', 1, 'Vendetta', 'Batti una rivale', 60),
  T('rivali', 5, 'Senza paura', 'Batti 5 volte le rivali', 150),
  T('sfide', 3, 'Costante', 'Completa 3 sfide', 40),
  T('sfide', 15, 'Instancabile', 'Completa 15 sfide', 150),
  T('coppe', 1, 'Coppa Pixel', 'Vinci un torneo', 100),
  T('coppe', 5, 'Re delle coppe', 'Vinci 5 tornei', 300),
  T('figurine', 31, 'Mezzo album', 'Metà delle figurine', 80),
  T('figurine', 62, 'Album completo', 'Tutte le figurine', 300),
  T('livello5', 1, 'Cresciuto in casa', 'Un giocatore al livello 5', 80),
  T('leggenda', 1, 'Ragazzo prodigio', 'Leggenda: 1° episodio', 40),
  T('leggenda', 5, 'Campione regionale', 'Leggenda: 5° episodio', 120),
  T('leggenda', 10, 'Leggenda del Pallone', 'Vinci i Mondiali giovanili', 400),
  T('sopravvivenza', 3, 'Sopravvissuto', 'Sopravvivenza: supera 3 round', 60),
  T('sopravvivenza', 5, 'Cacciatore di Boss', 'Sopravvivenza: batti un Boss', 150),
  T('sopravvivenza', 10, 'Re della Scala', 'Sopravvivenza: supera 10 round', 350),
  T('missioni', 18, 'Tuttofare', 'Completa tutte le 18 missioni', 250),
];

export function newTotals(): Totals {
  return { partite: 0, vittorie: 0, gol: 0, giocate: 0, tunnel: 0, imbattuto: 0, super: 0, assist: 0, rivali: 0, sfide: 0 };
}

/** Aggiunge una partita ai totali. */
export function addMatchTotals(t: Totals, o: MatchOutcome, beatRival: boolean) {
  const c = matchCounts(o);
  t.partite++;
  t.vittorie += c.vinci;
  t.gol += c.gol;
  t.giocate += c.giocate;
  t.tunnel += c.tunnel;
  t.imbattuto += c.imbattuto;
  t.super += c.super;
  t.assist += c.assist;
  if (beatRival) t.rivali++;
}

export interface TrophyCtx {
  totals: Totals;
  cups: number;
  stickers: number;
  maxLevelPlayers: number;
  /** Episodi superati nella Leggenda del Pallone. */
  legend?: number;
  /** Miglior round superato in Sopravvivenza. */
  survival?: number;
  /** Numero di missioni completate. */
  missions?: number;
}

export function trophyValue(d: TrophyDef, c: TrophyCtx): number {
  if (d.stat === 'coppe') return c.cups;
  if (d.stat === 'figurine') return c.stickers;
  if (d.stat === 'livello5') return c.maxLevelPlayers;
  if (d.stat === 'leggenda') return c.legend ?? 0;
  if (d.stat === 'sopravvivenza') return c.survival ?? 0;
  if (d.stat === 'missioni') return c.missions ?? 0;
  return c.totals[d.stat];
}

/** Trofei appena conquistati (non ancora in `have`): li aggiunge e li restituisce. */
export function checkTrophies(have: string[], c: TrophyCtx): TrophyDef[] {
  const fresh = TROPHIES.filter((d) => !have.includes(d.id) && trophyValue(d, c) >= d.n);
  for (const d of fresh) have.push(d.id);
  return fresh;
}
