import { Rng } from '../sim/math';
import type { Role } from '../sim/types';
import { TECHS, type LeggendaSave, type LgPlayer, type LgTeam } from './leggenda';
import { CAST, heroTeam, rivalTeam } from './leggendaStory';

/**
 * Squadra delle Stelle (Leggenda del Pallone): i personaggi della storia diventano
 * carte da collezionare. I rivali battuti si uniscono a te, gli altri escono dalle
 * buste; i doppioni fanno salire di livello il giocatore e sbloccano le sue tecniche.
 * Con 7 carte formi la tua squadra e la porti al Torneo delle Stelle.
 */

export type StarRarity = 'bronzo' | 'argento' | 'oro' | 'leggenda';
export const RARITIES: StarRarity[] = ['bronzo', 'argento', 'oro', 'leggenda'];
export const RARITY_NAME: Record<StarRarity, string> = { bronzo: 'BRONZO', argento: 'ARGENTO', oro: 'ORO', leggenda: 'LEGGENDA' };
export const RARITY_COLOR: Record<StarRarity, number> = { bronzo: 0xc0763a, argento: 0xc8ccd8, oro: 0xffd23f, leggenda: 0xc06aff };

export interface StarCard {
  id: string;
  /** Il giocatore come appare nella sua versione migliore della storia. */
  base: LgPlayer;
  rarity: StarRarity;
  /** Squadra di provenienza. */
  team: string;
  teamShort: string;
  shirt: number;
  gk: number;
  /** Episodio in cui lo incontri: prima non esce nelle buste. */
  ep: number;
}

/** Il protagonista e i rivali più forti, i più rari da trovare. */
const LEGENDS = ['nico', 'dario', 'rafa', 'nacho', 'erik'];
/** Personaggi con un nome nella storia ma senza tecniche. */
const NAMED = ['pippo', 'bea', 'edo', 'valli', 'spina', 'even'];

const power = (p: LgPlayer) => p.drb + p.pas + p.sht + p.tck + p.blk + p.gk;

function build(): StarCard[] {
  const out = new Map<string, StarCard>();
  const add = (t: LgTeam, ep: number) => {
    for (const p of t.players) {
      const prev = out.get(p.id);
      if (prev) {
        // stesso personaggio in più squadre: si tiene la versione più forte, l'episodio del primo incontro
        if (power(p) > power(prev.base)) out.set(p.id, { ...prev, base: p, team: t.name, teamShort: t.short, shirt: t.colors.shirt, gk: t.colors.gk });
        continue;
      }
      out.set(p.id, { id: p.id, base: p, rarity: 'bronzo', team: t.name, teamShort: t.short, shirt: t.colors.shirt, gk: t.colors.gk, ep });
    }
  };
  // i tuoi compagni, nell'ordine in cui arrivano nella storia
  for (let ep = 0; ep <= 9; ep++) {
    add(heroTeam(ep), ep);
    add(rivalTeam(ep), ep);
  }
  for (const c of out.values()) {
    const p = c.base;
    if (LEGENDS.includes(p.id)) c.rarity = 'leggenda';
    else if (p.techs.length > 0 || p.id === 'even') c.rarity = 'oro';
    else if (NAMED.includes(p.id) || Math.max(p.drb, p.pas, p.sht, p.tck, p.blk, p.gk) >= 9.5) c.rarity = 'argento';
    else c.rarity = 'bronzo';
  }
  const order = (r: StarRarity) => RARITIES.indexOf(r);
  return [...out.values()].sort((a, b) => order(b.rarity) - order(a.rarity) || a.ep - b.ep || power(b.base) - power(a.base));
}

export const STAR_CARDS: StarCard[] = build();
export const cardById = (id: string) => STAR_CARDS.find((c) => c.id === id);

/** Il rivale che si unisce a te quando superi un episodio per la prima volta. */
export const RECRUITS: Record<number, string[]> = {
  0: ['tommaso'],
  1: ['gigi'],
  2: ['sandro'],
  3: ['dario', 'ivo'],
  4: ['raffo'],
  5: ['paco'],
  6: ['bram'],
  7: ['nacho'],
  8: ['erik', 'even'],
  9: ['rafa'],
};

/** Si parte con i Ragazzi del Porto: sette carte per una squadra completa. */
export const STARTERS = ['nico', 'gaspare', 'ciro', 'momo', 'pippo', 'lino', 'ugo'];

/** Ruoli dei 7 posti della squadra. */
export const SLOTS: Role[] = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];

export interface StelleSave {
  /** Copie possedute di ogni carta. */
  have: Record<string, number>;
  /** Livello (1..5) delle carte. */
  level: Record<string, number>;
  /** I 7 della squadra (id delle carte), nell'ordine di SLOTS. */
  lineup: (string | null)[];
  /** Episodi di cui hai già ricevuto il rivale. */
  recruitedEp: number;
  /** Turni del Torneo delle Stelle vinti almeno una volta. */
  rounds: number;
  /** Buste aperte senza trovare una leggenda (per la garanzia). */
  dry: number;
  /** Buste da aprire avute in premio. */
  packs: Record<PackId, number>;
}

export function newStelle(): StelleSave {
  const have: Record<string, number> = {};
  const level: Record<string, number> = {};
  for (const id of STARTERS) {
    have[id] = 1;
    level[id] = 1;
  }
  return { have, level, lineup: ['gaspare', 'ciro', 'momo', 'pippo', 'lino', 'ugo', 'nico'], recruitedEp: 0, rounds: 0, dry: 0, packs: { bronzo: 0, oro: 0, mito: 0 } };
}

/** Prende (o crea) il salvataggio della Squadra delle Stelle e aggiunge i rivali già battuti. */
export function stelleOf(sv: LeggendaSave): { st: StelleSave; joined: string[] } {
  const st = (sv.stelle = sv.stelle ?? newStelle());
  st.packs = { bronzo: st.packs?.bronzo ?? 0, oro: st.packs?.oro ?? 0, mito: st.packs?.mito ?? 0 };
  st.lineup = SLOTS.map((_, i) => st.lineup?.[i] ?? null);
  const joined: string[] = [];
  while (st.recruitedEp < sv.cleared) {
    for (const id of RECRUITS[st.recruitedEp] ?? []) {
      if (!cardById(id)) continue;
      if (!st.have[id]) joined.push(id);
      addCopy(st, id);
    }
    st.recruitedEp++;
  }
  return { st, joined };
}

export function owns(st: StelleSave, id: string): boolean {
  return (st.have[id] ?? 0) > 0;
}

export function levelOfCard(st: StelleSave, id: string): number {
  return owns(st, id) ? Math.max(1, Math.min(MAX_STAR, st.level[id] ?? 1)) : 0;
}

function addCopy(st: StelleSave, id: string) {
  st.have[id] = (st.have[id] ?? 0) + 1;
  if (!st.level[id]) st.level[id] = 1;
}

// ---------- livelli ----------

export const MAX_STAR = 5;

/** Doppioni necessari per passare dal livello `lv` al successivo. */
export const upgradeCost = (lv: number) => lv;

/** Copie in più rispetto a quella che usi. */
export const spare = (st: StelleSave, id: string) => Math.max(0, (st.have[id] ?? 0) - 1);

export function canUpgrade(st: StelleSave, id: string): boolean {
  const lv = levelOfCard(st, id);
  return lv > 0 && lv < MAX_STAR && spare(st, id) >= upgradeCost(lv);
}

export function upgrade(st: StelleSave, id: string): boolean {
  if (!canUpgrade(st, id)) return false;
  const lv = levelOfCard(st, id);
  st.have[id] -= upgradeCost(lv);
  st.level[id] = lv + 1;
  return true;
}

/** Livello necessario per la tecnica numero `k` del giocatore (la prima subito). */
export const techLevel = (k: number) => Math.min(MAX_STAR, k + 1);

/** Le tecniche che la carta sa usare al suo livello. */
export function cardTechs(card: StarCard, lv: number): string[] {
  return card.base.techs.filter((_, k) => lv >= techLevel(k));
}

/** Il giocatore al livello della carta: +0.35 a ogni statistica e più energia per livello. */
export function cardPlayer(card: StarCard, lv: number): LgPlayer {
  const b = card.base;
  const up = (v: number) => Math.round(Math.min(11, v + (lv - 1) * 0.35) * 10) / 10;
  return {
    ...b,
    face: { ...b.face },
    drb: up(b.drb),
    pas: up(b.pas),
    sht: up(b.sht),
    tck: up(b.tck),
    blk: up(b.blk),
    gk: b.role === 'GK' ? up(b.gk) : b.gk,
    sta: b.sta + (lv - 1) * 6,
    techs: cardTechs(card, lv),
  };
}

/** Valutazione della carta da 40 a 99, per il ruolo dove gioca. */
export function rating(p: LgPlayer, role: Role = p.role): number {
  const w =
    role === 'GK' ? p.gk * 0.7 + p.blk * 0.2 + p.pas * 0.1 :
    role === 'DEF' ? p.tck * 0.4 + p.blk * 0.35 + p.pas * 0.15 + p.drb * 0.1 :
    role === 'MID' ? p.pas * 0.4 + p.drb * 0.3 + p.sht * 0.15 + p.tck * 0.15 :
    p.sht * 0.45 + p.drb * 0.35 + p.pas * 0.2;
  const techBonus = p.techs.length * 1.5;
  return Math.max(40, Math.min(99, Math.round(20 + w * 8 + techBonus)));
}

// ---------- intesa ----------

/** Coppie nate nella storia: in squadra insieme si capiscono al volo. */
export const LINKS: { a: string; b: string; name: string }[] = [
  { a: 'nico', b: 'dario', name: 'Vento e Luna' },
  { a: 'nico', b: 'sandro', name: 'Vento e Tuono' },
  { a: 'tommaso', b: 'gigi', name: 'Muro del Porto' },
  { a: 'erik', b: 'even', name: 'Gemelli Lund' },
  { a: 'nico', b: 'tommaso', name: 'La sfida sulla collina' },
  { a: 'dario', b: 'bea', name: 'Regia del Portobello' },
  { a: 'nico', b: 'pippo', name: 'Amici del porto' },
  { a: 'sandro', b: 'raffo', name: 'Monteruvido' },
  { a: 'nacho', b: 'rafa', name: 'Sudamerica' },
];

export interface Chemistry {
  /** 0..100 */
  value: number;
  links: string[];
  notes: string[];
}

export function chemistry(st: StelleSave): Chemistry {
  const ids = st.lineup.filter((x): x is string => !!x);
  let v = 40;
  const links: string[] = [];
  const notes: string[] = [];
  for (const l of LINKS) {
    if (ids.includes(l.a) && ids.includes(l.b)) {
      v += 12;
      links.push(l.name);
    }
  }
  // tre o più dalla stessa squadra
  const byTeam = new Map<string, number>();
  for (const id of ids) {
    const c = cardById(id);
    if (c) byTeam.set(c.team, (byTeam.get(c.team) ?? 0) + 1);
  }
  for (const [team, n] of byTeam) {
    if (n >= 3) {
      v += 5 * (n - 2);
      notes.push(`${n} da ${team}`);
    }
  }
  // fuori ruolo
  let off = 0;
  st.lineup.forEach((id, i) => {
    const c = id ? cardById(id) : undefined;
    if (c && c.base.role !== SLOTS[i]) off++;
  });
  if (off) {
    v -= off * 12;
    notes.push(`${off} fuori ruolo`);
  }
  return { value: Math.max(0, Math.min(100, v)), links, notes };
}

export function lineupComplete(st: StelleSave): boolean {
  return st.lineup.length === SLOTS.length && st.lineup.every((id) => !!id && owns(st, id));
}

/** La tua squadra in campo: livelli, ruolo del posto e intesa. */
export function starTeam(st: StelleSave): LgTeam {
  const ch = chemistry(st).value;
  // intesa 50 = neutra; 100 = +0.6 e +10% di energia; 0 = -0.6 e -10%
  const k = (ch - 50) / 50;
  const players = st.lineup.map((id, i) => {
    const card = cardById(id!)!;
    const p = cardPlayer(card, levelOfCard(st, card.id));
    const role = SLOTS[i];
    const off = p.role !== role ? -1 : 0;
    const f = (v: number) => Math.max(1, Math.round((v + k * 0.6 + off) * 10) / 10);
    return {
      ...p,
      role,
      num: i === 0 ? 1 : p.num === 1 ? 12 + i : p.num,
      drb: f(p.drb), pas: f(p.pas), sht: f(p.sht), tck: f(p.tck), blk: f(p.blk),
      gk: role === 'GK' ? f(p.gk) : p.gk,
      sta: Math.round(p.sta * (1 + k * 0.1)),
    };
  });
  return { id: 'stelle', name: 'Squadra delle Stelle', short: 'STL', colors: { shirt: 0x1a2a6a, shirt2: 0xffd23f, shorts: 0xf2f2f2, socks: 0x1a2a6a, gk: 0x5be37d }, pattern: 'sash', players };
}

/** Le tecniche a disposizione della tua squadra (al livello delle carte). */
export function starKnown(team: LgTeam): string[] {
  return [...new Set(team.players.flatMap((p) => p.techs))];
}

/** Forza media della squadra (per la schermata). */
export function teamRating(st: StelleSave): number {
  const ids = st.lineup;
  let tot = 0;
  let n = 0;
  ids.forEach((id, i) => {
    const c = id ? cardById(id) : undefined;
    if (!c) return;
    const p = cardPlayer(c, levelOfCard(st, c.id));
    tot += rating(p, SLOTS[i]) - (p.role !== SLOTS[i] ? 10 : 0);
    n++;
  });
  return n ? Math.round(tot / n) : 0;
}

/** Mette una carta in un posto (se era già in squadra, i due si scambiano). */
export function place(st: StelleSave, slot: number, id: string | null) {
  if (id && !owns(st, id)) return;
  const prev = id ? st.lineup.indexOf(id) : -1;
  if (prev >= 0) st.lineup[prev] = st.lineup[slot];
  st.lineup[slot] = id;
}

/** La squadra migliore possibile con le carte che hai: ogni posto al più forte nel ruolo. */
export function autoLineup(st: StelleSave) {
  const pool = STAR_CARDS.filter((c) => owns(st, c.id)).map((c) => ({ c, p: cardPlayer(c, levelOfCard(st, c.id)) }));
  const used = new Set<string>();
  const out: (string | null)[] = SLOTS.map(() => null);
  // prima i ruoli giusti, poi si riempiono i buchi con chi resta
  SLOTS.forEach((role, i) => {
    const best = pool.filter((x) => !used.has(x.c.id) && x.p.role === role).sort((a, b) => rating(b.p, role) - rating(a.p, role))[0];
    if (best) {
      out[i] = best.c.id;
      used.add(best.c.id);
    }
  });
  SLOTS.forEach((role, i) => {
    if (out[i]) return;
    const best = pool.filter((x) => !used.has(x.c.id)).sort((a, b) => rating(b.p, role) - rating(a.p, role))[0];
    if (best) {
      out[i] = best.c.id;
      used.add(best.c.id);
    }
  });
  st.lineup = out;
}

// ---------- buste ----------

export type PackId = 'bronzo' | 'oro' | 'mito';

export interface PackDef {
  id: PackId;
  name: string;
  size: number;
  /** Prezzo in monete o in Punti Leggenda. */
  price: number;
  currency: 'monete' | 'pl';
  /** Probabilità per rarità. */
  odds: Record<StarRarity, number>;
  /** Almeno una carta di questa rarità (o più rara). */
  guarantee?: StarRarity;
  desc: string;
}

export const PACKS: PackDef[] = [
  { id: 'bronzo', name: 'BUSTA STELLE', size: 3, price: 120, currency: 'monete', odds: { bronzo: 0.62, argento: 0.27, oro: 0.09, leggenda: 0.02 }, desc: '3 carte' },
  { id: 'oro', name: 'BUSTA ORO', size: 3, price: 320, currency: 'monete', odds: { bronzo: 0.35, argento: 0.4, oro: 0.2, leggenda: 0.05 }, guarantee: 'oro', desc: '3 carte, almeno un ORO' },
  { id: 'mito', name: 'BUSTA MITO', size: 4, price: 450, currency: 'pl', odds: { bronzo: 0.2, argento: 0.4, oro: 0.3, leggenda: 0.1 }, guarantee: 'leggenda', desc: '4 carte, una LEGGENDA' },
];
export const packById = (id: PackId) => PACKS.find((p) => p.id === id)!;

/** Dopo tante buste senza leggende ne arriva una di sicuro. */
export const PITY = 15;

/** Carte che possono uscire: solo i personaggi che hai già incontrato nella storia. */
export function packPool(sv: LeggendaSave): StarCard[] {
  return STAR_CARDS.filter((c) => c.ep <= sv.cleared);
}

export interface PackPull {
  card: StarCard;
  isNew: boolean;
}

function pickRarity(rng: Rng, odds: Record<StarRarity, number>, min: StarRarity, available: Set<StarRarity>): StarRarity {
  const ok = RARITIES.filter((r) => RARITIES.indexOf(r) >= RARITIES.indexOf(min) && available.has(r));
  if (!ok.length) return [...available][0];
  const tot = ok.reduce((t, r) => t + odds[r], 0);
  let x = rng.next() * tot;
  for (const r of ok) {
    x -= odds[r];
    if (x <= 0) return r;
  }
  return ok[ok.length - 1];
}

/** Apre una busta (già pagata o avuta in premio): carte a caso, le mancanti un po' più probabili. */
export function openStarPack(sv: LeggendaSave, st: StelleSave, id: PackId, rng: Rng = new Rng()): PackPull[] {
  const pack = packById(id);
  const pool = packPool(sv);
  const avail = new Set(pool.map((c) => c.rarity));
  const out: PackPull[] = [];
  let gotLegend = false;
  for (let i = 0; i < pack.size; i++) {
    const last = i === pack.size - 1;
    let min: StarRarity = 'bronzo';
    if (last && pack.guarantee && !out.some((o) => RARITIES.indexOf(o.card.rarity) >= RARITIES.indexOf(pack.guarantee!))) min = pack.guarantee;
    if (last && !gotLegend && st.dry + 1 >= PITY) min = 'leggenda';
    const r = pickRarity(rng, pack.odds, min, avail);
    const cands = pool.filter((c) => c.rarity === r);
    const missing = cands.filter((c) => !owns(st, c.id) && !out.some((o) => o.card.id === c.id));
    const card = missing.length && rng.chance(0.55) ? rng.pick(missing) : rng.pick(cands);
    out.push({ card, isNew: !owns(st, card.id) });
    addCopy(st, card.id);
    if (card.rarity === 'leggenda') gotLegend = true;
  }
  st.dry = gotLegend ? 0 : st.dry + 1;
  // le carte migliori si scoprono per ultime
  return out.sort((a, b) => RARITIES.indexOf(a.card.rarity) - RARITIES.indexOf(b.card.rarity));
}

// ---------- Torneo delle Stelle ----------

export interface StarRound {
  name: string;
  /** Squadra della storia (episodio) che ritrovi, rinforzata. */
  ep: number;
  /** Rinforzo delle statistiche avversarie. */
  boost: number;
  /** Serve aver superato questo episodio della storia. */
  needs: number;
  reward: { coins: number; pts: number; pack?: PackId };
}

export const STAR_ROUNDS: StarRound[] = [
  { name: 'Amichevole al Faro', ep: 1, boost: 0.6, needs: 2, reward: { coins: 80, pts: 20, pack: 'bronzo' } },
  { name: 'Rivincita a Monteruvido', ep: 4, boost: 0.6, needs: 5, reward: { coins: 100, pts: 30 } },
  { name: 'Torneo delle Saline', ep: 3, boost: 1.2, needs: 4, reward: { coins: 120, pts: 30, pack: 'bronzo' } },
  { name: 'Sfida al Messico', ep: 5, boost: 0.6, needs: 6, reward: { coins: 140, pts: 40 } },
  { name: 'La Diga di nuovo', ep: 6, boost: 0.8, needs: 7, reward: { coins: 160, pts: 40, pack: 'oro' } },
  { name: 'Tango a Buenos Aires', ep: 7, boost: 0.8, needs: 8, reward: { coins: 180, pts: 50 } },
  { name: 'Bufera del Nord', ep: 8, boost: 0.9, needs: 9, reward: { coins: 200, pts: 60, pack: 'oro' } },
  { name: 'Carnevale di Rio', ep: 9, boost: 0.9, needs: 10, reward: { coins: 240, pts: 80 } },
  { name: 'FINALE: All Stars del Mondo', ep: 9, boost: 0.6, needs: 10, reward: { coins: 400, pts: 150, pack: 'mito' } },
];

/** La squadra delle stelle avversarie della finale: i migliori rivali del mondo. */
function allStars(): LgTeam {
  const pick = (id: string) => cardById(id)!.base;
  return {
    id: 'allstars', name: 'All Stars del Mondo', short: 'ALL',
    colors: { shirt: 0x1c1c26, shirt2: 0xffd23f, shorts: 0x1c1c26, socks: 0xffd23f, gk: 0xff3fa4 }, pattern: 'sash',
    players: [pick('nordberg'), pick('mx2'), pick('ar2'), pick('br5'), pick('ivo'), pick('paco'), pick('nacho')].map((p) => ({ ...p, face: { ...p.face } })),
  };
}

/**
 * La squadra avversaria di un turno. Chi gioca con te non può stare anche dall'altra
 * parte: al suo posto entra una riserva.
 */
export function starOpponent(r: number, mine: string[]): LgTeam {
  const def = STAR_ROUNDS[r];
  const t = r === STAR_ROUNDS.length - 1 ? allStars() : rivalTeam(def.ep);
  const b = (v: number) => Math.round(Math.min(11, v + def.boost) * 10) / 10;
  return {
    ...t,
    players: t.players.map((p, i) => {
      const taken = mine.includes(p.id);
      const q: LgPlayer = taken
        ? { ...p, id: `${p.id}_ris`, name: `Riserva ${i + 1}`, techs: [], face: { ...p.face, style: 'corti', hair: 0x2a1c14 } }
        : { ...p, face: { ...p.face } };
      return { ...q, drb: b(q.drb), pas: b(q.pas), sht: b(q.sht), tck: b(q.tck), blk: b(q.blk), gk: q.role === 'GK' ? b(q.gk) : q.gk, sta: q.sta + Math.round(def.boost * 10) };
    }),
  };
}

export function roundOpen(sv: LeggendaSave, st: StelleSave, r: number): boolean {
  return r <= st.rounds && sv.cleared >= STAR_ROUNDS[r].needs;
}

export interface RoundReward {
  coins: number;
  pts: number;
  pack?: PackId;
  first: boolean;
}

/** Premio di un turno: pieno la prima volta, ridotto se lo rigiochi. */
export function roundReward(sv: LeggendaSave, st: StelleSave, r: number, won: boolean, goals: number): RoundReward {
  const def = STAR_ROUNDS[r].reward;
  if (!won) return { coins: 10 + goals * 5, pts: 5, first: false };
  const first = r === st.rounds;
  const out: RoundReward = first
    ? { coins: def.coins + goals * 5, pts: def.pts, pack: def.pack, first }
    : { coins: Math.round(def.coins * 0.3) + goals * 5, pts: Math.round(def.pts * 0.3), first };
  if (first) st.rounds = r + 1;
  sv.pts += out.pts;
  if (out.pack) st.packs[out.pack] = (st.packs[out.pack] ?? 0) + 1;
  return out;
}

/** Ritratto: il personaggio del cast (se c'è) o la carta. */
export function castShirt(card: StarCard): number {
  return CAST[card.id]?.shirt ?? (card.base.role === 'GK' ? card.gk : card.shirt);
}

export const TECH_KIND_NAME = (id: string) => ({ tiro: 'TIRO', dribbling: 'DRIBBLING', passaggio: 'PASSAGGIO', parata: 'PARATA', blocco: 'BLOCCO' })[TECHS[id].kind];
