import { teamById } from '../data/teams';
import { PITCHES, PITCH_ORDER } from '../data/pitches';
import { MatchSim } from '../sim/match';
import { Rng } from '../sim/math';
import type { PlayerDef, TeamDef } from '../sim/types';
import type { MatchLaunch, MatchOutcome } from './modes';
import { ATTRS, castFor, clubById, heroDef, npcTeam, ROCCO_LOOK, STORY, type AttrId, type CareerState, type CastMember, type CharId, type Line } from './career';
import {
  heroTally, heroVote, makeHeadline, makeTalk, resultOf, trustAfter, TRUST_BENCH, HERO_IDX, type Headline, type Talk,
} from './spogliatoio';

/**
 * "Diventa un mito" dopo la Coppa: la carriera da professionista.
 * Stagioni da 7 giornate in Serie A Pixel, fiducia del mister (se è bassa
 * parti dalla panchina), offerte di mercato a fine anno, Nazionale,
 * premi, età e ritiro. Lo scopo: arrivare a 100 di reputazione, cioè MITO.
 */

/** Livello massimo delle abilità nella carriera da pro (nella storia è 5). */
export const PRO_MAX_LEVEL = 8;
/** Serie A Pixel: le Rondini, i Lupi di Rocco e le grandi d'Italia (nomi di fantasia). */
export const PRO_LEAGUE = ['rondini', 'lupi', 'zebre', 'diavoli', 'biscioni', 'ciucci', 'lupacchiotti', 'aquilotti'];
const LEAGUE: TeamDef[] = PRO_LEAGUE.map((id) => teamById(id));
export const PRO_ROUNDS = PRO_LEAGUE.length - 1;
export const RETIRE_AGE = 30;
export const LAST_AGE = 37;

export interface ProRow {
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface ProOffer {
  club: string;
  /** Monete a partita. */
  salary: number;
  role: 'titolare' | 'rotazione';
  /** L'offerta della squadra attuale (rinnovo). */
  renew?: boolean;
}

export interface ProSeasonLog {
  season: number;
  age: number;
  club: string;
  apps: number;
  goals: number;
  avg: number;
  pos: number;
  prizes: string[];
}

export type ProPhase = 'league' | 'nazionale' | 'offers' | 'retired';

export interface ProState {
  season: number;
  age: number;
  club: string;
  /** Squadra di Rocco Ferraro, l'eterno rivale. */
  rocco: string;
  fixtures: [string, string][][];
  round: number;
  table: Record<string, ProRow>;
  goals: number;
  apps: number;
  votes: number[];
  reputation: number;
  salary: number;
  role: 'titolare' | 'rotazione';
  phase: ProPhase;
  offers: ProOffer[];
  /** Panchina: punteggio del primo tempo giocato senza di te. */
  bench?: { round: number; score: [number, number] };
  log: ProSeasonLog[];
  cabinet: { scudetti: number; cannoniere: number; pallone: number; nazionale: number };
  /** Gol in Nazionale (totale). */
  natGoals: number;
  /** Eventi della stagione già raccontati. */
  seen: string[];
}

// ---------------------------------------------------------------- stato

function makeFixtures(ids: string[], seed: number): [string, string][][] {
  const rng = new Rng(seed);
  const t = ids.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  // metodo del cerchio: il primo resta fermo, gli altri ruotano
  const rounds: [string, string][][] = [];
  const n = t.length;
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) pairs.push([t[i], t[n - 1 - i]]);
    rounds.push(pairs);
    t.splice(1, 0, t.pop()!);
  }
  return rounds;
}

function emptyTable(): Record<string, ProRow> {
  const t: Record<string, ProRow> = {};
  for (const tm of LEAGUE) t[tm.id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  return t;
}

export function newPro(c: CareerState): ProState {
  return {
    season: 1,
    age: 20,
    club: 'rondini',
    rocco: 'lupi',
    fixtures: makeFixtures(PRO_LEAGUE, 101 + c.hero.name.length),
    round: 0,
    table: emptyTable(),
    goals: 0,
    apps: 0,
    votes: [],
    reputation: 25,
    salary: 15,
    role: 'titolare',
    phase: 'league',
    offers: [],
    log: [],
    cabinet: { scudetti: 0, cannoniere: 0, pallone: 0, nazionale: 0 },
    natGoals: 0,
    seen: [],
  };
}

export function standings(p: ProState): { id: string; row: ProRow }[] {
  return Object.entries(p.table)
    .map(([id, row]) => ({ id, row }))
    .sort((a, b) => b.row.pts - a.row.pts || b.row.gf - b.row.ga - (a.row.gf - a.row.ga) || b.row.gf - a.row.gf);
}

export function position(p: ProState): number {
  return standings(p).findIndex((s) => s.id === p.club) + 1;
}

export function opponentOf(p: ProState): string | undefined {
  const pair = p.fixtures[p.round]?.find((f) => f.includes(p.club));
  if (!pair) return undefined;
  return pair[0] === p.club ? pair[1] : pair[0];
}

export const avgVote = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0);

/** Fama del campione: da Promessa a MITO. */
export function statusOf(rep: number): { name: string; color: string } {
  if (rep >= 100) return { name: 'MITO', color: '#ffd23f' };
  if (rep >= 80) return { name: 'LEGGENDA', color: '#ff7ab8' };
  if (rep >= 60) return { name: 'FUORICLASSE', color: '#3fd0ff' };
  if (rep >= 40) return { name: 'CAMPIONE', color: '#5be37d' };
  if (rep >= 20) return { name: 'PROFESSIONISTA', color: '#d8dcf0' };
  return { name: 'PROMESSA', color: '#8a8fb0' };
}

export const isBench = (c: CareerState) => (c.trust ?? 60) < TRUST_BENCH;

/** Allenatore della squadra (nome sempre uguale per lo stesso club). */
export function coachOf(club: string): string {
  const names = ['Bruno', 'Ferretti', 'Caputo', 'Lanza', 'Mazzoni', 'Bellini', 'Orsini', 'De Santis', 'Valli'];
  if (club === 'rondini') return 'Mister Bruno';
  let h = 0;
  for (const ch of club) h += ch.charCodeAt(0);
  return 'Mister ' + names[1 + (h % (names.length - 1))];
}

// ---------------------------------------------------------------- squadre

/** Nazionale Pixel e la Selezione del Mondo per la finale delle Nazioni. */
const NAZ: TeamDef = {
  id: 'nazionale', name: 'Nazionale Pixel', short: 'NAZ',
  colors: { shirt: 0x2a6fd6, shirt2: 0xf2f2f2, shorts: 0xf2f2f2, socks: 0x2a6fd6, gk: 0x2b2b2b }, pattern: 'plain', stars: 5,
  players: [],
};
const MONDO: TeamDef = {
  id: 'mondo', name: 'Selezione del Mondo', short: 'MON',
  colors: { shirt: 0xf5c400, shirt2: 0x1f9e4a, shorts: 0x1f9e4a, socks: 0xf5c400, gk: 0xc8202a }, pattern: 'stripes', stars: 5,
  players: [],
};

function boosted(t: TeamDef, d: number): TeamDef {
  return { ...t, players: t.players.map((p) => ({ ...p, stats: Object.fromEntries(Object.entries(p.stats).map(([k, v]) => [k, v + d])) as PlayerDef['stats'] })) };
}

function nationalTeams(c: CareerState): { mine: TeamDef; opp: TeamDef } {
  // i migliori delle due squadre più forti di Serie A Pixel
  const draghi = clubById('draghi', c.hero.name);
  const tigri = clubById('tigri', c.hero.name);
  const mine: TeamDef = { ...NAZ, players: draghi.players.map((p, i) => (i % 2 ? tigri.players[i] : p)) };
  mine.players = mine.players.map((p) => ({ ...p, stats: { ...p.stats } }));
  mine.players[HERO_IDX] = heroDef(c, PRO_MAX_LEVEL);
  const lupi = clubById('lupi', c.hero.name);
  const opp: TeamDef = boosted({ ...MONDO, players: lupi.players.map((p, i) => ({ ...p, name: ['Costa', 'Müller', 'Silva', 'Okafor', 'Tanaka'][i] ?? p.name })) }, 0.05);
  return { mine, opp };
}

export function proTeams(c: CareerState, p: ProState): { mine: TeamDef; opp: TeamDef } {
  if (p.phase === 'nazionale') return nationalTeams(c);
  const mine = clubById(p.club, c.hero.name);
  if (c.perks.includes('leader')) {
    for (const pl of mine.players) for (const k of Object.keys(pl.stats) as (keyof PlayerDef['stats'])[]) pl.stats[k] += 0.04;
  }
  mine.players[HERO_IDX] = heroDef(c, PRO_MAX_LEVEL);
  const oppId = opponentOf(p) ?? 'lupi';
  const opp = clubById(oppId, c.hero.name);
  if (oppId === p.rocco && p.club !== p.rocco) {
    const r = opp.players[HERO_IDX];
    opp.players[HERO_IDX] = { ...r, name: 'Ferraro', number: 10, look: ROCCO_LOOK, stats: { ...r.stats, shot: r.stats.shot + 0.08, speed: r.stats.speed + 0.04 } };
  }
  if (p.club === p.rocco) {
    const r = mine.players[3];
    mine.players[3] = { ...r, name: 'Ferraro', number: 10, look: ROCCO_LOOK, stats: { ...r.stats, shot: r.stats.shot + 0.08 } };
  }
  return { mine, opp };
}

/** Campo della giornata: cambia ogni volta, come le trasferte. */
export function proPitch(p: ProState) {
  if (p.phase === 'nazionale') return PITCHES.stadio;
  return PITCHES[PITCH_ORDER[(p.season * 3 + p.round) % PITCH_ORDER.length]];
}

/** Primo tempo giocato dalla CPU mentre sei in panchina. */
function simulateFirstHalf(home: TeamDef, away: TeamDef, seed: number, dur: number): [number, number] {
  const sim = new MatchSim({ home, away, pitch: PITCHES.stadio, difficulty: 'normale', durationSec: dur, powerUps: false, goldenGoal: false, seed, humanTeam: null });
  const dt = 1 / 30;
  for (let t = 0; t < dur + 30 && sim.phase !== 'end'; t += dt) {
    sim.update(dt);
    sim.events.length = 0;
  }
  return [sim.score[0], sim.score[1]];
}

export const PRO_DURATION = 150;

/** Prepara la partita della giornata (calcola il primo tempo se parti dalla panchina). */
export function proLaunch(c: CareerState, fixKits: (h: TeamDef, a: TeamDef) => TeamDef): MatchLaunch {
  const p = c.pro!;
  const { mine, opp } = proTeams(c, p);
  const nat = p.phase === 'nazionale';
  let startScore: [number, number] | undefined;
  let dur = nat ? 180 : PRO_DURATION;
  let hud = nat ? 'VINCI LA FINALE DELLE NAZIONI' : 'GIOCA BENE: PRENDITI UN VOTO ALTO';
  if (!nat && isBench(c)) {
    if (!p.bench || p.bench.round !== p.round) {
      const orig = clubById(p.club, c.hero.name);
      p.bench = { round: p.round, score: simulateFirstHalf(orig, opp, p.season * 1000 + p.round * 37 + 5, PRO_DURATION / 2) };
    }
    startScore = p.bench.score;
    dur = PRO_DURATION / 2;
    hud = 'SEI ENTRATO DALLA PANCHINA: CONVINCI IL MISTER';
  }
  return {
    mode: 'mito',
    startScore,
    superStart: c.perks.includes('bomber') ? 0.5 : 0,
    hudGoal: hud,
    spotlight: HERO_IDX,
    modeData: { pro: true, season: p.season, round: p.round, phase: p.phase },
    config: {
      home: mine,
      away: fixKits(mine, opp),
      pitch: proPitch(p),
      difficulty: c.difficulty,
      durationSec: dur,
      powerUps: true,
      goldenGoal: nat,
      humanTeam: 0,
      lockHuman: c.control === 'squadra' ? undefined : HERO_IDX,
      night: nat || p.round === PRO_ROUNDS - 1,
    },
  };
}

// ---------------------------------------------------------------- risultati

function poisson(rng: Rng, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let q = 1;
  do {
    k++;
    q *= rng.next();
  } while (q > L && k < 10);
  return k - 1;
}

function addResult(t: Record<string, ProRow>, h: string, a: string, gh: number, ga: number) {
  const H = t[h];
  const A = t[a];
  H.p++;
  A.p++;
  H.gf += gh;
  H.ga += ga;
  A.gf += ga;
  A.ga += gh;
  if (gh > ga) {
    H.w++;
    H.pts += 3;
    A.l++;
  } else if (gh < ga) {
    A.w++;
    A.pts += 3;
    H.l++;
  } else {
    H.d++;
    A.d++;
    H.pts++;
    A.pts++;
  }
}

export interface ProReport {
  vote: number;
  goals: number;
  res: 'w' | 'd' | 'l';
  points: number;
  salary: number;
  rep: number;
  trust: number;
  fromBench: boolean;
  headline: Headline;
  /** Fine stagione: premi vinti. */
  seasonEnd?: { pos: number; prizes: string[]; nazionale: boolean };
  natWon?: boolean;
}

function prizesOf(p: ProState): string[] {
  const out: string[] = [];
  const pos = position(p);
  const avg = avgVote(p.votes);
  if (pos === 1) {
    out.push('SCUDETTO');
    p.cabinet.scudetti++;
  }
  if (p.goals >= 7) {
    out.push('CAPOCANNONIERE');
    p.cabinet.cannoniere++;
  }
  if (avg >= 7.2 && p.apps >= 5) {
    out.push('PALLONE D\'ORO PIXEL');
    p.cabinet.pallone++;
  }
  return out;
}

/** Applica una partita della carriera da pro. */
export function applyProResult(c: CareerState, out: MatchOutcome): ProReport {
  const p = c.pro!;
  const vote = heroVote(out);
  const t = heroTally(out);
  const res = resultOf(out);
  const fromBench = !!out.launch.startScore && p.phase === 'league';
  const before = c.trust ?? 60;
  c.trust = trustAfter(before, vote, res);
  const goals = t.goals;
  c.goals += goals;
  c.apps++;
  if (res === 'w') c.wins++;
  const points = vote >= 7.5 ? 2 : vote >= 6 ? 1 : 0;
  c.points += points;
  const mineName = out.launch.config.home.name;
  const oppName = out.launch.config.away.name;
  const headline = makeHeadline(c.hero.name, mineName, oppName, vote, t, res, out.result.score, p.season * 31 + p.round * 7 + goals);
  c.news = [headline, ...(c.news ?? [])].slice(0, 6);
  const repGain = Math.max(0, vote - 6) * 1.5 + goals * 0.8 + (res === 'w' ? 0.5 : 0);
  const salary = p.salary;
  const rep: ProReport = { vote, goals, res, points, salary, rep: Math.round(repGain * 10) / 10, trust: c.trust - before, fromBench, headline };

  if (p.phase === 'nazionale') {
    p.natGoals += goals;
    const [a, b] = out.result.score;
    rep.natWon = a > b;
    if (rep.natWon) {
      p.cabinet.nazionale++;
      p.reputation += 8;
    }
    p.reputation = Math.min(120, p.reputation + repGain);
    p.phase = 'offers';
    p.offers = makeOffers(p);
    c.talk = undefined;
    return rep;
  }

  p.goals += goals;
  p.apps++;
  p.votes.push(vote);
  p.reputation = Math.min(120, p.reputation + repGain);
  // la nostra partita e le altre della giornata
  const [a, b] = out.result.score;
  const opp = opponentOf(p)!;
  addResult(p.table, p.club, opp, a, b);
  const rng = new Rng(p.season * 977 + p.round * 131 + 3);
  for (const [h, w] of p.fixtures[p.round]) {
    if (h === p.club || w === p.club) continue;
    const d = teamById(h).stars - teamById(w).stars;
    addResult(p.table, h, w, poisson(rng, Math.max(0.4, 1.6 + d * 0.35)), poisson(rng, Math.max(0.4, 1.4 - d * 0.35)));
  }
  p.round++;
  p.bench = undefined;
  c.talk = makeTalk(vote, goals, res, fromBench, p.round + p.season + goals, { who: 'mister', name: coachOf(p.club) });

  if (p.round >= PRO_ROUNDS) {
    const pos = position(p);
    const prizes = prizesOf(p);
    p.reputation = Math.min(120, p.reputation + prizes.length * 5 + (pos <= 3 ? 2 : 0));
    p.log.push({ season: p.season, age: p.age, club: p.club, apps: p.apps, goals: p.goals, avg: avgVote(p.votes), pos, prizes });
    const nazionale = avgVote(p.votes) >= 6.8 || p.reputation >= 50;
    p.phase = nazionale ? 'nazionale' : 'offers';
    if (!nazionale) p.offers = makeOffers(p);
    rep.seasonEnd = { pos, prizes, nazionale };
  }
  return rep;
}

/** Offerte di mercato di fine stagione (più fama = squadre più forti). */
export function makeOffers(p: ProState): ProOffer[] {
  const rng = new Rng(p.season * 4111 + Math.round(p.reputation));
  const minStars = p.reputation >= 60 ? 4 : p.reputation >= 35 ? 3 : 2;
  const pool = LEAGUE.filter((t) => t.id !== p.club && t.stars >= minStars).map((t) => t.id);
  const out: ProOffer[] = [];
  while (out.length < 2 && pool.length) {
    const id = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const st = teamById(id).stars;
    out.push({
      club: id,
      salary: Math.round(10 + st * 4 + p.reputation / 4),
      role: p.reputation / 20 + 1.5 >= st ? 'titolare' : 'rotazione',
    });
  }
  const avg = avgVote(p.votes);
  out.unshift({ club: p.club, salary: Math.round(p.salary + (avg >= 6.5 ? 5 : 0) + p.reputation / 10), role: avg >= 6.3 ? 'titolare' : 'rotazione', renew: true });
  return out;
}

/** Firma un contratto e parte la nuova stagione. */
export function signOffer(c: CareerState, o: ProOffer) {
  const p = c.pro!;
  const moved = o.club !== p.club;
  p.club = o.club;
  p.salary = o.salary;
  p.role = o.role;
  c.trust = o.role === 'titolare' ? 65 : 48;
  newSeason(c);
  if (moved) p.seen = p.seen.filter((s) => !s.startsWith('arrivo'));
}

function newSeason(c: CareerState) {
  const p = c.pro!;
  p.season++;
  p.age++;
  p.round = 0;
  p.table = emptyTable();
  p.fixtures = makeFixtures(PRO_LEAGUE, p.season * 7919 + 13);
  p.goals = 0;
  p.apps = 0;
  p.votes = [];
  p.offers = [];
  p.phase = 'league';
  p.bench = undefined;
  // dopo i 31 anni il fisico cala: si perde un livello di velocità a stagione
  if (p.age >= 32 && c.attrs.speed > 0) c.attrs.speed--;
  // Rocco ogni tanto cambia squadra
  if (p.season % 3 === 0) {
    const others = PRO_LEAGUE.filter((id) => id !== p.rocco);
    p.rocco = others[p.season % others.length];
  }
}

export function retire(c: CareerState) {
  c.pro!.phase = 'retired';
  c.talk = undefined;
}

export function maxLevelFor(c: CareerState): number {
  return c.pro ? PRO_MAX_LEVEL : 5;
}

export function decliningAttr(c: CareerState): AttrId | null {
  return c.pro && c.pro.age >= 31 ? 'speed' : null;
}

export { ATTRS };

// ---------------------------------------------------------------- racconto

/** Dialoghi prima della partita: eventi della stagione, rivale, panchina. */
export function proBefore(c: CareerState): Line[] {
  const p = c.pro!;
  const club = teamById(p.club).name;
  const lines: Line[] = [];
  const once = (id: string, l: Line[]) => {
    if (p.seen.includes(id)) return;
    p.seen.push(id);
    lines.push(...l);
  };
  if (p.phase === 'nazionale') {
    lines.push(
      { who: 'title', text: `ESTATE ${p.season}\nLA NAZIONALE` },
      { who: 'sara', text: 'Notizia bomba: {nome} è stato convocato in Nazionale per la Finale delle Nazioni!' },
      { who: 'nonno', text: 'Ho comprato una TV nuova solo per questa partita. Non farmela rimpiangere.' },
      { who: 'hero', text: 'Contro la Selezione del Mondo... Nonno, guarda bene: sto per segnare per te.' },
    );
    return lines;
  }
  const opp = opponentOf(p) ?? '';
  const oppName = teamById(opp).name;
  if (p.round === 0) {
    lines.push({ who: 'title', text: `STAGIONE ${p.season}\n${club.toUpperCase()}` });
    if (p.season === 1) {
      once('pro1', [
        { who: 'max', text: 'Ora si fa sul serio, {nome}. Serie A Pixel: sette giornate, una classifica, nessuno sconto.' },
        { who: 'max', text: 'Gioca bene e il mister ti darà fiducia. Gioca male e scalderai la panchina.' },
        { who: 'max', text: 'E a fine anno... il mio telefono comincerà a squillare. Offerte, contratti, monete.' },
        { who: 'hero', text: 'Io voglio solo giocare. Le monete le conti tu.' },
        { who: 'max', text: 'Il dieci per cento, ricordatelo.' },
      ]);
    } else {
      lines.push({ who: 'mister', text: p.role === 'titolare' ? 'Nuova stagione, {nome}. Sei uno dei nostri leader: comportati da tale.' : 'Benvenuto. Qui il posto si conquista in allenamento, non con il nome.' });
      if (p.age >= 32) lines.push({ who: 'nonno', text: 'Gli anni passano anche per te, campione. Le gambe rallentano, ma la testa è più veloce.' });
      if (p.age === RETIRE_AGE) lines.push({ who: 'max', text: 'Trent\'anni, {nome}. Quando vorrai appendere le scarpe al chiodo, basta un cenno.' });
    }
  }
  if (isBench(c)) {
    lines.push({ who: 'mister', text: pickLine(p, ['Oggi parti dalla panchina. Ti butto dentro nel secondo tempo: fatti trovare pronto.', 'In panchina, {nome}. Le ultime prestazioni non mi hanno convinto. Entri dopo.']) });
  }
  if (opp === p.rocco && p.club !== p.rocco) {
    lines.push(
      { who: 'rocco', text: pickLine(p, [`Ci risiamo, {nome}. ${club} contro ${oppName}, e stavolta vinco io.`, 'Ancora tu? Pensavo ti fossi ritirato. Ah no, quello sarò io a farlo fare a te.', 'Dal campetto alla Serie A e sei ancora lento come allora.']) },
      { who: 'hero', text: pickLine(p, ['Parla meno e corri di più, Rocco.', 'La gabbia te la ricordi? Finisce uguale.', 'Ti aspetto in campo.']) },
    );
  } else if (p.club === p.rocco) {
    once(`compagno${p.season}`, [
      { who: 'rocco', text: 'Non guardarmi così. Siamo compagni di squadra, adesso. Mi tocca passartela, la palla.' },
      { who: 'hero', text: 'Chi l\'avrebbe detto, eh? Il campetto ci ha portati qui tutti e due.' },
      { who: 'rocco', text: 'Non diventiamo amici però. Andiamo a vincere.' },
    ]);
  } else if (p.round === PRO_ROUNDS - 1) {
    const pos = position(p);
    lines.push({ who: 'sara', text: pos === 1 ? `Ultima giornata: ${club} in testa alla classifica! {nome} può regalare lo scudetto!` : `Ultima giornata di campionato. ${club} è ${pos}° in classifica: ogni gol conta.` });
  } else if (p.round > 0) {
    const ev = EVENTS[(p.season * 3 + p.round * 5) % EVENTS.length];
    lines.push(...ev(p, oppName));
  }
  if (!lines.length) lines.push({ who: 'mister', text: `Oggi c'è ${oppName}. Testa e gambe, {nome}.` });
  return lines;
}

function pickLine(p: ProState, arr: string[]): string {
  return arr[(p.season + p.round) % arr.length];
}

const EVENTS: ((p: ProState, opp: string) => Line[])[] = [
  (_p, opp) => [
    { who: 'sara', text: `Radio Pixel, intervista lampo! {nome}, cosa ti aspetti dalla sfida con ${opp}?` },
    { who: 'hero', text: 'Mi aspetto di divertirmi. Se mi diverto io, si diverte anche il pubblico.' },
  ],
  () => [
    { who: 'nonno', text: 'Pronto? Sono io. Ho visto la partita al bar. Il barista dice che sei il più forte.' },
    { who: 'hero', text: 'Nonno, il barista è tuo cugino.' },
    { who: 'nonno', text: 'E allora? Mica è cieco.' },
  ],
  (p) => [
    { who: 'max', text: 'Uno sponsor di scarpini vuole la tua faccia sui cartelloni. Ho detto sì, ovviamente.' },
    { who: 'hero', text: p.age > 28 ? 'Spero mi facciano qualche ruga in meno.' : 'La mia faccia? Sui cartelloni? Mia madre impazzirà.' },
  ],
  (_p, opp) => [
    { who: 'mister', text: `${opp} pressa alto. Se ti marcano in due, scarica subito sul compagno libero.` },
    { who: 'hero', text: 'E se mi marcano in tre?' },
    { who: 'mister', text: 'Allora dribblali. Per questo ti paghiamo.' },
  ],
  () => [
    { who: 'sara', text: 'Fuori dallo stadio c\'è un bambino con la maglia numero {numero} e la scritta "{nome}" fatta col pennarello.' },
    { who: 'hero', text: 'Fatelo entrare negli spogliatoi. Quel bambino ero io, dieci anni fa.' },
  ],
  (p) => [
    { who: 'rocco', text: `Ti seguo, sai? ${p.goals} gol finora. Io ne ho fatti di più. Forse.` },
    { who: 'hero', text: 'Forse. Rocco, quando ammetterai che ti diverti a sfidarmi?' },
    { who: 'rocco', text: 'Mai.' },
  ],
  () => [
    { who: 'nonno', text: 'Il campetto dietro casa l\'hanno ridipinto. Hanno messo una targa: "Qui ha iniziato {nome}".' },
    { who: 'hero', text: 'Davvero?!' },
    { who: 'nonno', text: 'No, l\'ho messa io. Ma prima o poi la mettono loro.' },
  ],
];

/** Battute dopo la fine della stagione. */
export function proSeasonEnd(c: CareerState, r: ProReport): Line[] {
  const p = c.pro!;
  const e = r.seasonEnd;
  if (!e) return [];
  const club = teamById(p.club).name;
  const lines: Line[] = [{ who: 'title', text: `FINE STAGIONE ${p.season}\n${club.toUpperCase()} ${e.pos}°` }];
  if (e.prizes.includes('SCUDETTO')) lines.push({ who: 'sara', text: `${club} CAMPIONE DI SERIE A PIXEL! E {nome} è il simbolo di questa squadra!` });
  else lines.push({ who: 'sara', text: `Il campionato si chiude con ${club} al ${e.pos}° posto.` });
  if (e.prizes.includes('CAPOCANNONIERE')) lines.push({ who: 'sara', text: `${p.goals} gol: {nome} è il capocannoniere del torneo!` });
  if (e.prizes.includes('PALLONE D\'ORO PIXEL')) lines.push({ who: 'nonno', text: 'Il Pallone d\'Oro Pixel! Lo metto in vetrina, vicino al pallone vecchio. Stanno bene insieme.' });
  if (e.nazionale) lines.push({ who: 'max', text: 'Non andare in vacanza: c\'è una chiamata dalla Nazionale.' });
  else lines.push({ who: 'max', text: 'Il mercato è aperto. Vediamo chi ti vuole.' });
  return lines;
}

export function proFill(s: string, c: CareerState): string {
  return s.replace(/\{nome\}/g, c.hero.name).replace(/\{numero\}/g, String(c.hero.number));
}

export const ATTR_LABEL: Record<AttrId, string> = Object.fromEntries(ATTRS.map((a) => [a.id, a.label])) as Record<AttrId, string>;

export type { Talk };

/** Personaggi dei dialoghi della carriera da pro. */
export function proCast(c: CareerState): Record<Exclude<CharId, 'title'>, CastMember> {
  const p = c.pro!;
  const base = castFor(c, STORY.length - 1);
  const { mine, opp } = proTeams(c, p);
  const roccoTeam = p.club === p.rocco ? mine : clubById(p.rocco, c.hero.name);
  const coach = coachOf(p.club);
  return {
    ...base,
    hero: { ...base.hero, team: mine, def: heroDef(c, PRO_MAX_LEVEL) },
    rocco: { ...base.rocco, team: opponentOf(p) === p.rocco ? opp : roccoTeam },
    mister: p.phase === 'nazionale' ? { ...base.mister, name: 'Il C.T.' } : { ...base.mister, name: coach, team: npcTeam('m', mine.colors.shirt, mine.colors.shirt2, 'half') },
  };
}

export function proPlace(c: CareerState): string {
  const p = c.pro!;
  if (p.phase === 'nazionale') return 'Stadio Nazionale, finale';
  if (p.phase !== 'league') return `${teamById(p.club).name} · fine stagione ${p.season}`;
  const opp = opponentOf(p);
  return `${teamById(p.club).name} · giornata ${p.round + 1}${opp ? ' contro ' + teamById(opp).name : ''}`;
}

/** Ultima scena: l'addio al calcio. */
export function proRetireLines(c: CareerState): Line[] {
  const p = c.pro!;
  const st = statusOf(p.reputation);
  const lines: Line[] = [
    { who: 'title', text: `L'ADDIO\n${c.hero.name.toUpperCase()}` },
    { who: 'sara', text: `Dopo ${c.apps} partite e ${c.goals} gol, {nome} appende le scarpe al chiodo. Lo stadio è tutto in piedi.` },
  ];
  if (p.reputation >= 100) {
    lines.push(
      { who: 'rocco', text: 'Va bene, lo ammetto. Sei stato il più forte. Contento? ...Mi mancherai, {nome}.' },
      { who: 'nonno', text: 'Il campetto dietro casa adesso ha il tuo nome. Stavolta la targa l\'hanno messa davvero.' },
      { who: 'title', text: `SEI DIVENTATO\nUN MITO` },
    );
  } else {
    lines.push(
      { who: 'nonno', text: 'Non è il numero di coppe che conta. È che ogni volta che giocavi, la gente sorrideva.' },
      { who: 'hero', text: 'Nonno... il pallone vecchio ce l\'hai ancora? Ho qualche nipote da allenare.' },
      { who: 'title', text: `FINE CARRIERA\n${st.name}` },
    );
  }
  return lines;
}
