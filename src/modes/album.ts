import { TEAMS } from '../data/teams';
import { PITCHES, PITCH_ORDER } from '../data/pitches';
import type { PitchId } from '../sim/types';
import { Rng } from '../sim/math';

/**
 * Album di figurine: si guadagnano pacchetti giocando, si aprono, si completano le pagine.
 * Una pagina per squadra (stemma + 5 giocatori), una per i campi, una di figurine speciali.
 */

export type Rarity = 'comune' | 'rara' | 'leggendaria';

export type StickerDef =
  | { id: string; n: number; kind: 'stemma'; team: string; rarity: Rarity; name: string }
  | { id: string; n: number; kind: 'giocatore'; team: string; idx: number; rarity: Rarity; name: string }
  | { id: string; n: number; kind: 'campo'; pitch: PitchId; rarity: Rarity; name: string }
  | { id: string; n: number; kind: 'speciale'; icon: SpecialIcon; rarity: Rarity; name: string; desc: string };

export type SpecialIcon = 'coppa' | 'pallone' | 'fuoco' | 'turbo' | 'muro' | 'fischietto';

export interface AlbumPage {
  id: string;
  title: string;
  team?: string;
  stickers: StickerDef[];
}

export interface AlbumSave {
  /** Quante copie di ogni figurina (0 = mancante). */
  have: Record<string, number>;
  packs: number;
  /** Pagine già premiate al completamento. */
  pagesDone: string[];
}

const SPECIALS: { icon: SpecialIcon; name: string; desc: string }[] = [
  { icon: 'coppa', name: 'Coppa Pixel', desc: 'Il trofeo più bello del calcio a 8 bit.' },
  { icon: 'pallone', name: 'Pallone d\'Oro', desc: 'Il premio per il miglior giocatore dell\'anno.' },
  { icon: 'fuoco', name: 'Tiro di Fuoco', desc: 'Il power-up che incendia il pallone.' },
  { icon: 'turbo', name: 'Turbo', desc: 'Il power-up che fa correre come il vento.' },
  { icon: 'muro', name: 'Muro in Porta', desc: 'Il power-up che chiude la porta.' },
  { icon: 'fischietto', name: 'L\'Arbitro', desc: 'Senza di lui non si comincia.' },
];

function build(): AlbumPage[] {
  const pages: AlbumPage[] = [];
  let n = 1;
  for (const t of TEAMS) {
    const best = t.players.reduce((bi, p, i, a) => (ovr(p.stats) > ovr(a[bi].stats) ? i : bi), 0);
    const st: StickerDef[] = [{ id: `stemma:${t.id}`, n: n++, kind: 'stemma', team: t.id, rarity: 'comune', name: t.name }];
    t.players.forEach((p, i) => {
      st.push({ id: `gioc:${t.id}:${i}`, n: n++, kind: 'giocatore', team: t.id, idx: i, rarity: i === best ? 'rara' : 'comune', name: p.name });
    });
    pages.push({ id: `squadra:${t.id}`, title: t.name.toUpperCase(), team: t.id, stickers: st });
  }
  pages.push({
    id: 'campi',
    title: 'I CAMPI',
    stickers: PITCH_ORDER.map((pid) => ({ id: `campo:${pid}`, n: n++, kind: 'campo' as const, pitch: pid, rarity: 'rara' as Rarity, name: PITCHES[pid].name })),
  });
  pages.push({
    id: 'speciali',
    title: 'SPECIALI',
    stickers: SPECIALS.map((s) => ({ id: `spec:${s.icon}`, n: n++, kind: 'speciale' as const, icon: s.icon, rarity: 'leggendaria' as Rarity, name: s.name, desc: s.desc })),
  });
  return pages;
}

function ovr(s: { speed: number; shot: number; pass: number; tackle: number; control: number; keeping: number }) {
  return s.speed + s.shot + s.pass + s.tackle + s.control + s.keeping;
}

export const ALBUM_PAGES: AlbumPage[] = build();
export const ALL_STICKERS: StickerDef[] = ALBUM_PAGES.flatMap((p) => p.stickers);
export const PACK_SIZE = 4;
/** Doppioni necessari per un pacchetto nuovo. */
export const SWAP_COST = 5;
/** Pacchetti in regalo per una pagina completata. */
export const PAGE_BONUS = 2;

const WEIGHT: Record<Rarity, number> = { comune: 1, rara: 0.45, leggendaria: 0.15 };

export function newAlbum(): AlbumSave {
  // tre pacchetti di benvenuto
  return { have: {}, packs: 3, pagesDone: [] };
}

export function owned(a: AlbumSave): number {
  return ALL_STICKERS.filter((s) => (a.have[s.id] ?? 0) > 0).length;
}

export function duplicates(a: AlbumSave): number {
  return Object.values(a.have).reduce((t, c) => t + Math.max(0, c - 1), 0);
}

export function pageComplete(a: AlbumSave, p: AlbumPage): boolean {
  return p.stickers.every((s) => (a.have[s.id] ?? 0) > 0);
}

function draw(rng: Rng): StickerDef {
  const tot = ALL_STICKERS.reduce((t, s) => t + WEIGHT[s.rarity], 0);
  let r = rng.next() * tot;
  for (const s of ALL_STICKERS) {
    r -= WEIGHT[s.rarity];
    if (r <= 0) return s;
  }
  return ALL_STICKERS[ALL_STICKERS.length - 1];
}

export interface PackResult {
  stickers: { def: StickerDef; isNew: boolean }[];
  /** Pagine completate con questo pacchetto (danno pacchetti bonus). */
  completed: AlbumPage[];
}

/** Apre un pacchetto: figurine a caso, le mancanti un po' più probabili per non frustrare. */
export function openPack(a: AlbumSave, rng: Rng = new Rng()): PackResult | null {
  if (a.packs <= 0) return null;
  a.packs--;
  const out: PackResult['stickers'] = [];
  const seen = new Set<string>();
  for (let i = 0; i < PACK_SIZE; i++) {
    let s = draw(rng);
    // una seconda possibilità se esce un doppione (o la stessa del pacchetto)
    if ((a.have[s.id] ?? 0) > 0 || seen.has(s.id)) s = draw(rng);
    seen.add(s.id);
    const isNew = (a.have[s.id] ?? 0) === 0;
    a.have[s.id] = (a.have[s.id] ?? 0) + 1;
    out.push({ def: s, isNew });
  }
  const completed: AlbumPage[] = [];
  for (const p of ALBUM_PAGES) {
    if (!a.pagesDone.includes(p.id) && pageComplete(a, p)) {
      a.pagesDone.push(p.id);
      a.packs += PAGE_BONUS;
      completed.push(p);
    }
  }
  return { stickers: out, completed };
}

/** Scambia SWAP_COST doppioni (i più numerosi prima) con un pacchetto nuovo. */
export function swapDuplicates(a: AlbumSave): boolean {
  if (duplicates(a) < SWAP_COST) return false;
  let left = SWAP_COST;
  while (left > 0) {
    const [id] = Object.entries(a.have).sort((x, y) => y[1] - x[1])[0];
    a.have[id]--;
    left--;
  }
  a.packs++;
  return true;
}

/** Pacchetti guadagnati con una partita. */
export function packsForMatch(won: boolean): number {
  return 1 + (won ? 1 : 0);
}
