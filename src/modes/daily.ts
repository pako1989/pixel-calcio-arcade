import { Rng } from '../sim/math';
import type { MatchOutcome } from './modes';

/**
 * Sfide del giorno: tre obiettivi nuovi ogni giorno, uguali per tutto il giorno,
 * che si completano sommando le partite giocate (qualsiasi modalità).
 */

export type DailyKind = 'gol' | 'vinci' | 'tunnel' | 'giocate' | 'imbattuto' | 'contrasti' | 'super' | 'parate' | 'assist';

export interface DailyDef {
  kind: DailyKind;
  n: number;
  reward: number;
}

export interface DailySave {
  day: string;
  list: DailyDef[];
  got: number[];
  /** Sfide già pagate. */
  done: boolean[];
}

const KINDS: { kind: DailyKind; min: number; max: number; per: number }[] = [
  { kind: 'gol', min: 3, max: 6, per: 10 },
  { kind: 'vinci', min: 1, max: 3, per: 30 },
  { kind: 'tunnel', min: 1, max: 2, per: 35 },
  { kind: 'giocate', min: 3, max: 6, per: 10 },
  { kind: 'imbattuto', min: 1, max: 1, per: 50 },
  { kind: 'contrasti', min: 5, max: 10, per: 6 },
  { kind: 'super', min: 1, max: 2, per: 35 },
  { kind: 'parate', min: 4, max: 8, per: 7 },
  { kind: 'assist', min: 2, max: 3, per: 20 },
];

export function dailyText(d: DailyDef): string {
  const n = d.n;
  switch (d.kind) {
    case 'gol':
      return `Segna ${n} gol`;
    case 'vinci':
      return n === 1 ? 'Vinci una partita' : `Vinci ${n} partite`;
    case 'tunnel':
      return n === 1 ? 'Fai un tunnel' : `Fai ${n} tunnel`;
    case 'giocate':
      return `Fai ${n} giocate di stile`;
    case 'imbattuto':
      return 'Vinci senza subire gol';
    case 'contrasti':
      return `Vinci ${n} contrasti`;
    case 'super':
      return n === 1 ? 'Segna con il super tiro' : `Segna ${n} gol col super tiro`;
    case 'parate':
      return `Fai ${n} parate col portiere`;
    case 'assist':
      return `Fai ${n} assist`;
  }
}

/** La data di oggi (ora locale) come chiave. */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyFor(day: string): DailyDef[] {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rng = new Rng(h >>> 0);
  const pool = [...KINDS];
  const out: DailyDef[] = [];
  while (out.length < 3) {
    const k = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const n = k.min + Math.floor(rng.next() * (k.max - k.min + 1));
    out.push({ kind: k.kind, n, reward: Math.round((20 + n * k.per) / 5) * 5 });
  }
  return out;
}

/** Le sfide di oggi: se il giorno è cambiato si ricomincia. */
export function dailyState(s: DailySave | undefined, day = today()): DailySave {
  if (s && s.day === day) return s;
  return { day, list: dailyFor(day), got: [0, 0, 0], done: [false, false, false] };
}

/** Quanto vale una partita per ogni tipo di sfida (squadra umana = 0). */
export function matchCounts(o: MatchOutcome): Record<DailyKind, number> {
  const t = o.tally;
  const [a, b] = o.result.score;
  const won = o.result.penalties ? o.result.penalties[0] > o.result.penalties[1] : a > b;
  const assists = t.players[0].reduce((s, p) => s + p.assists, 0);
  const gkSaves = t.saves[0];
  return {
    gol: a,
    vinci: won ? 1 : 0,
    tunnel: t.tunnels[0],
    giocate: t.tricks[0],
    imbattuto: won && b === 0 ? 1 : 0,
    contrasti: t.tacklesWon[0],
    super: t.superGoals[0],
    parate: gkSaves,
    assist: assists,
  };
}

/** Aggiunge la partita alle sfide; restituisce quelle appena completate. */
export function applyDaily(s: DailySave, o: MatchOutcome): DailyDef[] {
  const c = matchCounts(o);
  const fresh: DailyDef[] = [];
  s.list.forEach((d, i) => {
    if (s.done[i]) return;
    s.got[i] = Math.min(d.n, s.got[i] + c[d.kind]);
    if (s.got[i] >= d.n) {
      s.done[i] = true;
      fresh.push(d);
    }
  });
  return fresh;
}

/** Bonus se completi tutte e tre le sfide del giorno. */
export const DAILY_ALL_BONUS = 50;
