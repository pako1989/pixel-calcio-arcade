import { makeTeam, teamById, type TeamSeed } from '../data/teams';
import type { Difficulty, PitchId, PlayerDef, TeamDef } from '../sim/types';
import type { MatchLaunch, MatchOutcome } from './modes';
import { PITCHES } from '../data/pitches';

/**
 * "Diventa un mito": modalità storia. Crei il tuo giocatore e lo porti
 * dal campetto di quartiere alla finale di Coppa, tra dialoghi, rivali
 * e abilità da migliorare.
 */

export type AttrId = 'speed' | 'shot' | 'pass' | 'control' | 'tackle';
export const ATTRS: { id: AttrId; label: string }[] = [
  { id: 'speed', label: 'VELOCITÀ' },
  { id: 'shot', label: 'TIRO' },
  { id: 'pass', label: 'PASSAGGIO' },
  { id: 'control', label: 'DRIBBLING' },
  { id: 'tackle', label: 'CONTRASTO' },
];
export const MAX_LEVEL = 5;

export type Perk = 'bomber' | 'leader';
export const PERKS: Record<Perk, { name: string; desc: string }> = {
  bomber: { name: 'ISTINTO DEL BOMBER', desc: 'La barra SUPER parte già a metà.' },
  leader: { name: 'LEADER', desc: 'I compagni giocano meglio con te in campo.' },
};

export interface Hero {
  name: string;
  number: number;
  look: PlayerDef['look'];
}

/** Chi controlli in partita: solo il tuo campione o tutta la squadra (con i cambi). */
export type CareerControl = 'solo' | 'squadra';

export interface CareerState {
  hero: Hero;
  difficulty: Difficulty;
  /** Assente nei salvataggi vecchi: vale 'solo'. */
  control?: CareerControl;
  attrs: Record<AttrId, number>;
  points: number;
  step: number;
  perks: Perk[];
  goals: number;
  apps: number;
  wins: number;
  finished: boolean;
}

export type CharId = 'hero' | 'nonno' | 'mister' | 'rocco' | 'max' | 'sara' | 'title';
export interface Line {
  who: CharId;
  text: string;
}

export type CareerGoal = 'win' | 'notLose' | 'heroGoal';

export interface StoryStep {
  chapter: string;
  title: string;
  /** Squadra del protagonista e avversaria (chiavi di CLUBS o di TEAMS). */
  team: string;
  opp: string;
  rival?: boolean;
  pitch: PitchId;
  place: string;
  duration: number;
  goldenGoal: boolean;
  startScore?: [number, number];
  goal: CareerGoal;
  perk?: Perk;
  before: Line[];
  win: Line[];
  lose: Line[];
}

/** Squadre della storia (oltre a quelle della partita veloce). */
const CLUBS: Record<string, TeamSeed> = {
  rione: { id: 'rione', name: 'Ragazzi del Rione', short: 'RIO', colors: { shirt: 0xf2f2f2, shirt2: 0x2fae5a, shorts: 0x2fae5a, socks: 0xf2f2f2, gk: 0xff7a1a }, pattern: 'hoops', stars: 1 },
  piazza: { id: 'piazza', name: 'Quelli della Piazza', short: 'PIA', colors: { shirt: 0xc8202a, shirt2: 0xf2f2f2, shorts: 0x2b2b2b, socks: 0xc8202a, gk: 0x29c7c7 }, pattern: 'half', stars: 1 },
  sanvito: { id: 'sanvito', name: 'Polisportiva San Vito', short: 'SVI', colors: { shirt: 0x2a9fd6, shirt2: 0xf5d13b, shorts: 0xf2f2f2, socks: 0x2a9fd6, gk: 0xe0457b }, pattern: 'stripes', stars: 2 },
  riserve: { id: 'riserve', name: 'Riserve San Vito', short: 'RIS', colors: { shirt: 0xff7a1a, shirt2: 0xf2f2f2, shorts: 0x2b2b2b, socks: 0xff7a1a, gk: 0x9bd12a }, pattern: 'plain', stars: 2 },
  lidi: { id: 'lidi', name: 'Lidi Azzurri', short: 'LID', colors: { shirt: 0x29c7c7, shirt2: 0xf2f2f2, shorts: 0xf2f2f2, socks: 0x29c7c7, gk: 0xff6a00 }, pattern: 'hoops', stars: 2 },
  porto: { id: 'porto', name: 'Atletico Porto', short: 'ATP', colors: { shirt: 0xc8202a, shirt2: 0x202020, shorts: 0x202020, socks: 0xc8202a, gk: 0xf5c400 }, pattern: 'stripes', stars: 3 },
  marea: { id: 'marea', name: 'Città di Marea', short: 'MAR', colors: { shirt: 0x14306b, shirt2: 0x29c7c7, shorts: 0x14306b, socks: 0x29c7c7, gk: 0xff7a1a }, pattern: 'sash', stars: 3 },
  falchi: { id: 'falchi', name: 'Falchi di Montagna', short: 'FAL', colors: { shirt: 0x7a5230, shirt2: 0xf2f2f2, shorts: 0xf2f2f2, socks: 0x7a5230, gk: 0x3a7bff }, pattern: 'half', stars: 3 },
  torri: { id: 'torri', name: 'Torri Grigie', short: 'TOR', colors: { shirt: 0x8a8fa0, shirt2: 0x202020, shorts: 0x202020, socks: 0x8a8fa0, gk: 0xff5aa0 }, pattern: 'plain', stars: 3 },
};

export const STORY: StoryStep[] = [
  {
    chapter: 'CAPITOLO 1', title: 'IL CAMPETTO', team: 'rione', opp: 'piazza', rival: true,
    pitch: 'quartiere', place: 'La gabbia dietro casa', duration: 120, goldenGoal: true, goal: 'win',
    before: [
      { who: 'title', text: 'CAPITOLO 1\nIL CAMPETTO' },
      { who: 'nonno', text: 'Eccolo, il pallone che usavo da ragazzo. È vecchio, ma ha ancora qualche gol dentro.' },
      { who: 'hero', text: 'Grazie nonno! Un giorno giocherò in uno stadio vero, vedrai.' },
      { who: 'nonno', text: 'Lo stadio arriva dopo. Prima c\'è il campetto. E al campetto comanda Rocco.' },
      { who: 'rocco', text: 'Ehi, {nome}! Partita secca: chi perde lascia la gabbia per tutta l\'estate.' },
      { who: 'hero', text: 'Ci sto. Preparati a cercarti un altro campo.' },
    ],
    win: [
      { who: 'rocco', text: 'Fortuna. Solo fortuna. La prossima volta ti faccio vedere io.' },
      { who: 'mister', text: 'Scusate, ragazzi... Sono Bruno, allenatore della Polisportiva San Vito. Ti ho visto giocare, {nome}.' },
      { who: 'mister', text: 'Sabato facciamo i provini. Vieni a farti vedere?' },
      { who: 'hero', text: 'Ci sarò, mister!' },
    ],
    lose: [
      { who: 'rocco', text: 'La gabbia è nostra! Tornate quando avrete imparato a giocare.' },
      { who: 'nonno', text: 'Hai perso una partita, non la strada. Testa alta, si rigioca.' },
    ],
  },
  {
    chapter: 'CAPITOLO 2', title: 'IL PROVINO', team: 'sanvito', opp: 'riserve',
    pitch: 'neve', place: 'Campo comunale, gennaio', duration: 120, goldenGoal: false, goal: 'heroGoal',
    before: [
      { who: 'title', text: 'CAPITOLO 2\nIL PROVINO' },
      { who: 'mister', text: 'Gennaio, campo gelato. Qui si vede chi ha fame davvero.' },
      { who: 'mister', text: 'Partitella contro le riserve. Non mi interessa il risultato: voglio vederti segnare.' },
      { who: 'hero', text: 'Basta un gol? Allora ne faccio due.' },
      { who: 'mister', text: 'Prima fanne uno. E attento al ghiaccio: si scivola.' },
    ],
    win: [
      { who: 'mister', text: 'Bene, bene. Hai il gol nel sangue. Da oggi giochi con la San Vito.' },
      { who: 'nonno', text: 'Lo sapevo! Ho già ritagliato l\'articolo sul giornalino di quartiere.' },
      { who: 'hero', text: 'Nonno, non c\'è nessun articolo...' },
      { who: 'nonno', text: 'Ci sarà.' },
    ],
    lose: [
      { who: 'mister', text: 'Niente gol, niente squadra. Però hai coraggio: ti do un\'altra possibilità.' },
    ],
  },
  {
    chapter: 'CAPITOLO 3', title: 'IL TORNEO DEL LIDO', team: 'sanvito', opp: 'lidi',
    pitch: 'spiaggia', place: 'Lido Azzurro, semifinale', duration: 150, goldenGoal: true, goal: 'win',
    before: [
      { who: 'title', text: 'CAPITOLO 3\nIL TORNEO DEL LIDO' },
      { who: 'sara', text: 'Buongiorno ascoltatori di Radio Pixel! Sara Lume in diretta dal Torneo del Lido!' },
      { who: 'sara', text: 'Tutti parlano del ragazzino della San Vito: {nome}. Vediamo se è vera gloria.' },
      { who: 'mister', text: 'Sabbia pesante: la palla si ferma subito. Tirate forte e niente passaggi lunghi.' },
    ],
    win: [
      { who: 'sara', text: 'La San Vito è in finale! E dall\'altra parte c\'è... l\'Atletico Porto di Rocco Ferraro!' },
      { who: 'rocco', text: 'Ci rivediamo, {nome}. Stavolta sotto le luci, sul tetto del Porto.' },
    ],
    lose: [
      { who: 'sara', text: 'La San Vito si insabbia! Ma il regolamento del torneo concede un ripescaggio...' },
      { who: 'mister', text: 'Ci hanno ripescati. Non sprechiamo la seconda occasione.' },
    ],
  },
  {
    chapter: 'CAPITOLO 3', title: 'FINALE SUL TETTO', team: 'sanvito', opp: 'porto', rival: true,
    pitch: 'tetto', place: 'Tetto del Porto, di notte', duration: 150, goldenGoal: true, goal: 'win', perk: 'bomber',
    before: [
      { who: 'rocco', text: 'Benvenuto nel mio campo. Quassù il vento soffia sempre dalla mia parte.' },
      { who: 'hero', text: 'Il vento cambia, Rocco. Come le partite.' },
      { who: 'mister', text: 'Guardate la freccia del vento in alto a sinistra e tirate di conseguenza!' },
    ],
    win: [
      { who: 'sara', text: 'Incredibile! La San Vito vince il Torneo del Lido!' },
      { who: 'max', text: 'Max Scaglia, procuratore. Ho visto abbastanza: il Città di Marea, Serie C, ti vuole.' },
      { who: 'hero', text: 'La Serie C? Io?' },
      { who: 'max', text: 'Tu. Firma qui. E smettila di fare quella faccia.' },
    ],
    lose: [
      { who: 'rocco', text: 'Il tetto è mio, {nome}. Torna quando sarai cresciuto.' },
      { who: 'mister', text: 'Rigiochiamo la finale. Stavolta usa il vento, non combatterlo.' },
    ],
  },
  {
    chapter: 'CAPITOLO 4', title: 'SERIE C', team: 'marea', opp: 'falchi',
    pitch: 'stadio', place: 'Stadio della Marea, debutto', duration: 150, goldenGoal: true, goal: 'win',
    before: [
      { who: 'title', text: 'CAPITOLO 4\nSERIE C' },
      { who: 'max', text: 'Primo giorno da professionista. Stadio vero, tifosi veri, tacchetti veri.' },
      { who: 'mister', text: 'Sorpresa! Mi hanno preso come vice allenatore. Ti tengo d\'occhio, ragazzo.' },
      { who: 'nonno', text: 'Sono in tribuna! Ho portato anche la banda del quartiere.' },
      { who: 'hero', text: 'Nonno... la banda no...' },
    ],
    win: [
      { who: 'sara', text: 'Debutto da sogno per {nome}! Il Città di Marea vola!' },
      { who: 'nonno', text: 'La banda ha suonato a ogni passaggio. Anche a quelli sbagliati.' },
    ],
    lose: [
      { who: 'max', text: 'Debutto amaro. Succede ai migliori. Testa alla prossima... cioè a questa, di nuovo.' },
    ],
  },
  {
    chapter: 'CAPITOLO 4', title: 'LA RIMONTA', team: 'marea', opp: 'torri',
    pitch: 'tetto', place: 'Campo delle Torri Grigie', duration: 150, goldenGoal: false, startScore: [0, 2], goal: 'notLose', perk: 'leader',
    before: [
      { who: 'sara', text: 'Trasferta di notte sul campo-terrazza delle Torri Grigie: padroni di casa avanti 2-0!' },
      { who: 'mister', text: 'Siamo sotto di due. Entri tu. Non mi serve un miracolo: mi basta non perdere.' },
      { who: 'hero', text: 'E se vinciamo?' },
      { who: 'mister', text: 'Allora la pizza la offro io.' },
    ],
    win: [
      { who: 'mister', text: 'Che rimonta! Hai trascinato tutta la squadra.' },
      { who: 'max', text: 'Il mio telefono scotta, {nome}. La Serie A ti chiama: le Rondini FC.' },
      { who: 'hero', text: 'Le Rondini... la squadra che guardavo in TV con il nonno!' },
    ],
    lose: [
      { who: 'mister', text: 'Niente pizza stasera. Riproviamo: palla a terra e un passo alla volta.' },
    ],
  },
  {
    chapter: 'CAPITOLO 5', title: 'SERIE A', team: 'rondini', opp: 'draghi',
    pitch: 'stadio', place: 'Stadio Arcade, debutto in A', duration: 150, goldenGoal: false, goal: 'heroGoal',
    before: [
      { who: 'title', text: 'CAPITOLO 5\nSERIE A' },
      { who: 'sara', text: 'Radio Pixel, ora in diretta nazionale! {nome} debutta in Serie A con le Rondini FC.' },
      { who: 'max', text: 'Contro i Draghi Verdi, i campioni in carica. Nessuno si aspetta niente da te. Perfetto.' },
      { who: 'hero', text: 'Basta un gol per farsi ricordare.' },
    ],
    win: [
      { who: 'sara', text: 'Gol al debutto in Serie A! Il quartiere è in festa!' },
      { who: 'nonno', text: 'La banda suona da mezz\'ora. Non riesco più a fermarli.' },
    ],
    lose: [
      { who: 'max', text: 'Nessun gol stavolta. In Serie A si impara in fretta. Riprovaci.' },
    ],
  },
  {
    chapter: 'CAPITOLO 5', title: 'IL DERBY', team: 'rondini', opp: 'lupi', rival: true,
    pitch: 'neve', place: 'Derby sotto la neve', duration: 150, goldenGoal: true, goal: 'win',
    before: [
      { who: 'sara', text: 'È il giorno del derby! Rondini FC contro Lupi Rossi... e il nuovo acquisto dei Lupi è Rocco Ferraro!' },
      { who: 'rocco', text: 'Dal campetto alla Serie A, e siamo ancora uno contro l\'altro. Destino.' },
      { who: 'hero', text: 'Stavolta niente vento a salvarti.' },
      { who: 'rocco', text: 'No. Stavolta c\'è la neve.' },
    ],
    win: [
      { who: 'rocco', text: '...Bella partita, {nome}. Lo ammetto. Ma in finale sarà diverso.' },
      { who: 'sara', text: 'Le Rondini volano in finale di Coppa! E gli avversari saranno... ancora i Lupi Rossi!' },
    ],
    lose: [
      { who: 'rocco', text: 'Il derby è nostro! Come ai vecchi tempi alla gabbia.' },
      { who: 'nonno', text: 'Ricordi? Una partita persa non è la strada persa. Si rigioca.' },
    ],
  },
  {
    chapter: 'CAPITOLO 6', title: 'LA FINALE', team: 'rondini', opp: 'lupi', rival: true,
    pitch: 'stadio', place: 'Finale di Coppa', duration: 180, goldenGoal: true, goal: 'win',
    before: [
      { who: 'title', text: 'CAPITOLO 6\nLA FINALE' },
      { who: 'nonno', text: 'Questo l\'ho portato con me. Il vecchio pallone. Per scaramanzia.' },
      { who: 'hero', text: 'Dammelo, nonno. Lo tengo nello spogliatoio.' },
      { who: 'max', text: 'Stadio pieno, tutto il paese davanti alla TV. Nessuna pressione, eh.' },
      { who: 'rocco', text: 'Ultima partita, {nome}. Chi vince si prende tutto.' },
    ],
    win: [
      { who: 'sara', text: 'FINITA! Le Rondini FC vincono la Coppa! {nome} entra nella leggenda!' },
      { who: 'rocco', text: 'Mi hai battuto anche stavolta. Magari un giorno giocheremo nella stessa squadra.' },
      { who: 'mister', text: 'Dal campo gelato alla Coppa. Io l\'avevo detto, eh.' },
      { who: 'nonno', text: 'Il pallone aveva ancora qualche gol dentro. Ma tutto il resto... ce l\'hai messo tu.' },
      { who: 'title', text: 'SEI DIVENTATO\nUN MITO' },
    ],
    lose: [
      { who: 'rocco', text: 'La Coppa è nostra! Ma che partita, {nome}.' },
      { who: 'max', text: 'C\'è sempre la rivincita. Il calcio è fatto così.' },
    ],
  },
];

export const GOAL_TEXT: Record<CareerGoal, string> = {
  win: 'Vinci la partita',
  notLose: 'Non perdere (siete sotto 0-2)',
  heroGoal: 'Segna almeno un gol con il tuo giocatore',
};

export const HERO_NAMES = ['Nico', 'Ciro', 'Leo', 'Dario', 'Tino', 'Sandro', 'Gigi', 'Enzo', 'Marco', 'Peppe', 'Luca', 'Sami'];
export const HERO_NUMBERS = [7, 9, 10, 11, 17, 21, 99];

export function newCareer(hero: Hero, difficulty: Difficulty, control: CareerControl = 'solo'): CareerState {
  return {
    hero,
    difficulty,
    control,
    attrs: { speed: 0, shot: 0, pass: 0, control: 0, tackle: 0 },
    points: 2,
    step: 0,
    perks: [],
    goals: 0,
    apps: 0,
    wins: 0,
    finished: false,
  };
}

export function heroDef(c: CareerState): PlayerDef {
  const lv = (id: AttrId) => 0.84 + c.attrs[id] * 0.05;
  return {
    name: c.hero.name,
    number: c.hero.number,
    role: 'FWD',
    stats: { speed: lv('speed') + 0.02, shot: lv('shot') + 0.04, pass: lv('pass'), tackle: lv('tackle'), control: lv('control'), keeping: 0.6 },
    look: c.hero.look,
  };
}

function seedOf(id: string): number {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Squadra della storia o della partita veloce, con nomi diversi da quello del protagonista. */
export function clubById(id: string, heroName = ''): TeamDef {
  const base = CLUBS[id] ? makeTeam(CLUBS[id], seedOf(id)) : teamById(id);
  const t: TeamDef = { ...base, players: base.players.map((p) => ({ ...p, stats: { ...p.stats } })) };
  for (const p of t.players) if (p.name.toLowerCase() === heroName.toLowerCase()) p.name += ' J.';
  return t;
}

const ROCCO_LOOK = { skin: 1, hair: 4, hairStyle: 3 };

export function teamsFor(c: CareerState, step: StoryStep): { mine: TeamDef; opp: TeamDef } {
  const mine = clubById(step.team, c.hero.name);
  if (c.perks.includes('leader')) {
    for (const p of mine.players) for (const k of Object.keys(p.stats) as (keyof PlayerDef['stats'])[]) p.stats[k] += 0.04;
  }
  mine.players[4] = heroDef(c);
  const opp = clubById(step.opp, c.hero.name);
  if (step.rival) {
    const r = opp.players[4];
    opp.players[4] = { ...r, name: 'Ferraro', number: 10, look: ROCCO_LOOK, stats: { ...r.stats, shot: r.stats.shot + 0.06, speed: r.stats.speed + 0.03 } };
  }
  return { mine, opp };
}

/** La CPU è un po' più morbida nei primi capitoli. */
export function difficultyFor(c: CareerState, stepIdx: number): Difficulty {
  if (stepIdx < 3 && c.difficulty === 'normale') return 'facile';
  if (stepIdx < 3 && c.difficulty === 'difficile') return 'normale';
  return c.difficulty;
}

export function careerLaunch(c: CareerState, fixKits: (h: TeamDef, a: TeamDef) => TeamDef): MatchLaunch {
  const step = STORY[c.step];
  const { mine, opp } = teamsFor(c, step);
  return {
    mode: 'mito',
    startScore: step.startScore,
    superStart: c.perks.includes('bomber') ? 0.5 : 0,
    hudGoal: GOAL_TEXT[step.goal].toUpperCase(),
    modeData: { step: c.step },
    config: {
      home: mine,
      away: fixKits(mine, opp),
      pitch: PITCHES[step.pitch],
      difficulty: difficultyFor(c, c.step),
      durationSec: step.duration,
      powerUps: true,
      goldenGoal: step.goldenGoal,
      humanTeam: 0,
      lockHuman: c.control === 'squadra' ? undefined : 4,
    },
  };
}

export function heroGoals(c: CareerState, out: MatchOutcome): number {
  return out.result.scorers.filter((s) => s.team === 0 && s.name === c.hero.name).length;
}

export interface CareerReport {
  success: boolean;
  heroGoals: number;
  points: number;
  perk?: Perk;
  finished: boolean;
}

/** Applica il risultato di una partita della storia. */
export function applyCareerResult(c: CareerState, out: MatchOutcome): CareerReport {
  const step = STORY[c.step];
  const [a, b] = out.result.score;
  const hg = heroGoals(c, out);
  const success = step.goal === 'win' ? a > b : step.goal === 'notLose' ? a >= b : hg >= 1;
  c.apps++;
  c.goals += hg;
  if (a > b) c.wins++;
  let points = 1;
  let perk: Perk | undefined;
  if (success) {
    points = 2 + Math.min(3, hg);
    if (step.perk && !c.perks.includes(step.perk)) {
      c.perks.push(step.perk);
      perk = step.perk;
    }
    c.step++;
    if (c.step >= STORY.length) {
      c.finished = true;
      c.step = STORY.length - 1;
    }
  }
  c.points += points;
  return { success, heroGoals: hg, points, perk, finished: c.finished && success };
}

export function upgradeCost(): number {
  return 1;
}

export function fillName(s: string, name: string): string {
  return s.replace(/\{nome\}/g, name);
}

/** Personaggi dei dialoghi: nome, divisa e aspetto per il ritratto. */
export interface CastMember {
  name: string;
  team: TeamDef;
  def: PlayerDef;
}

function npcTeam(name: string, shirt: number, shirt2: number, pattern: TeamDef['pattern'] = 'plain'): TeamDef {
  return { id: 'npc', name, short: 'NPC', colors: { shirt, shirt2, shorts: 0x2b2b3b, socks: 0x2b2b3b, gk: shirt }, pattern, players: [], stars: 1 };
}

function npc(name: string, number: number, look: PlayerDef['look']): PlayerDef {
  return { name, number, role: 'MID', look, stats: { speed: 1, shot: 1, pass: 1, tackle: 1, control: 1, keeping: 1 } };
}

export function castFor(c: CareerState, stepIdx: number): Record<Exclude<CharId, 'title'>, CastMember> {
  const step = STORY[Math.min(stepIdx, STORY.length - 1)];
  const { mine, opp } = teamsFor(c, step);
  const roccoTeam = ['porto', 'lupi'].includes(step.opp) ? opp : clubById('piazza');
  return {
    hero: { name: c.hero.name, team: mine, def: heroDef(c) },
    nonno: { name: 'Nonno Tano', team: npcTeam('n', 0x7a5230, 0x5a3a20), def: npc('Tano', 0, { skin: 0, hair: 5, hairStyle: 1 }) },
    mister: { name: 'Mister Bruno', team: npcTeam('m', 0x3a4a7a, 0xf2f2f2, 'half'), def: npc('Bruno', 0, { skin: 2, hair: 3, hairStyle: 0 }) },
    rocco: { name: 'Rocco Ferraro', team: roccoTeam, def: npc('Ferraro', 10, ROCCO_LOOK) },
    max: { name: 'Max Scaglia', team: npcTeam('x', 0x202028, 0xf2f2f2, 'sash'), def: npc('Max', 0, { skin: 1, hair: 0, hairStyle: 1 }) },
    sara: { name: 'Sara Lume', team: npcTeam('s', 0x9b3fd0, 0xffd23f, 'plain'), def: npc('Sara', 0, { skin: 3, hair: 2, hairStyle: 2 }) },
  };
}
