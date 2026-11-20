import { makeTeam, type TeamSeed } from '../data/teams';
import { PITCHES } from '../data/pitches';
import type { Difficulty, MatchMods, PitchId, PlayerDef, PlayerStats, TeamDef, Weather } from '../sim/types';
import type { MatchLaunch, MatchOutcome } from './modes';
import { npc, npcTeam, type CastMember } from './career';

/**
 * "Street World Tour": campagna arcade internazionale in 6 tappe.
 * Campi folli, meteo estremo e regole speciali in giro per il mondo,
 * con potenziamenti permanenti ("souvenir") dopo ogni tappa vinta.
 */

export type WtChar = 'hero' | 'marco' | 'lila' | 'vargas' | 'local' | 'title';
export interface WtLine {
  who: WtChar;
  text: string;
  /** Per who = 'local': permette di citare il capitano di un'altra tappa. */
  of?: number;
}

export type WtGoal = 'win' | 'winBy2' | 'score3' | 'superGoal' | 'cleanSheet';

export const WT_GOAL_TEXT: Record<WtGoal, string> = {
  win: 'Vinci la partita',
  winBy2: 'Vinci con almeno 2 gol di scarto',
  score3: 'Segna almeno 3 gol e vinci',
  superGoal: 'Segna un SUPER GOL e vinci',
  cleanSheet: 'Vinci senza subire gol',
};

export interface WtSouvenir {
  name: string;
  desc: string;
  stat?: keyof PlayerStats;
  stat2?: keyof PlayerStats;
  all?: boolean;
  superStart?: boolean;
}

export interface WorldStage {
  id: string;
  name: string;
  country: string;
  /** Coordinate normalizzate (0..1) sulla mappa del mondo stilizzata. */
  mx: number;
  my: number;
  place: string;
  pitch: PitchId;
  weather?: Weather;
  night?: boolean;
  mods?: MatchMods;
  startScore?: [number, number];
  goal: WtGoal;
  duration: number;
  goldenGoal: boolean;
  opp: TeamSeed;
  captain: { name: string; look: PlayerDef['look'] };
  souvenir: WtSouvenir;
  before: WtLine[];
  win: WtLine[];
  lose: WtLine[];
}

const kit = (shirt: number, shirt2: number, shorts: number, gk: number) => ({ shirt, shirt2, shorts, socks: shirt, gk });

export const WORLD_STAGES: WorldStage[] = [
  {
    id: 'barcellona',
    name: 'BARCELLONA',
    country: 'Spagna',
    mx: 0.45,
    my: 0.34,
    place: 'Sala Arcade del Raval, Barcellona',
    pitch: 'flipper',
    goal: 'win',
    duration: 120,
    goldenGoal: true,
    opp: { id: 'raval', name: 'Furia Blaugrana', short: 'FBL', colors: kit(0x1b3a8a, 0xc8202a, 0x1b3a8a, 0xffd23f), pattern: 'stripes', stars: 2 },
    captain: { name: 'Mateo', look: { skin: 1, hair: 0, hairStyle: 1 } },
    souvenir: { name: 'GETTONE D\'ORO', desc: '+dribbling e +tiro per tutta la squadra', stat: 'control', stat2: 'shot' },
    before: [
      { who: 'title', text: 'TAPPA 1\nBARCELLONA' },
      { who: 'marco', text: 'Ragazzi, è arrivato l\'invito ufficiale: siamo dentro lo Street World Tour! Sei città folli in tutto il pianeta.' },
      { who: 'vargas', text: 'Benvenuti nel mio torneo, dilettanti. Qui le regole normali restano fuori dal cancello.' },
      { who: 'lila', text: 'Prima fermata: Barcellona! Ma hanno trasformato il campo in un flipper gigante al neon!' },
      { who: 'local', text: 'Mateo della Furia Blaugrana. Qui i respingenti lanciano la palla a mille all\'ora. Occhio alle sponde!' },
      { who: 'hero', text: 'Flipper o no, noi siamo pronti. Facciamo rumore!' },
    ],
    win: [
      { who: 'local', text: 'Che rimbalzi! Avete dominato le sponde come veri maestri da sala giochi.' },
      { who: 'lila', text: 'Primo timbro sul passaporto! E ci hanno regalato il Gettone d\'Oro del Raval!' },
      { who: 'marco', text: 'Prossimo volo: Londra. Portatevi gli stivali... laggiù piove da tre giorni!' },
    ],
    lose: [
      { who: 'local', text: 'I respingenti vi hanno preso in contropiede! Riproviamo al prossimo gettone.' },
      { who: 'marco', text: 'Sfruttate le sponde laterali per sorprendere il portiere. Si rigioca!' },
    ],
  },
  {
    id: 'londra',
    name: 'LONDRA',
    country: 'Inghilterra',
    mx: 0.42,
    my: 0.22,
    place: 'Parco Fangoso di Camden, Londra',
    pitch: 'fango',
    weather: 'pioggia',
    goal: 'winBy2',
    duration: 150,
    goldenGoal: false,
    opp: { id: 'camden', name: 'Leoni di Camden', short: 'CAM', colors: kit(0xc8202a, 0xf2f2f2, 0xf2f2f2, 0x2fbf5a), pattern: 'half', stars: 3 },
    captain: { name: 'Arthur', look: { skin: 0, hair: 1, hairStyle: 0 } },
    souvenir: { name: 'TACCHETTI INGLESI', desc: '+contrasto e +velocità per tutta la squadra', stat: 'tackle', stat2: 'speed' },
    before: [
      { who: 'title', text: 'TAPPA 2\nLONDRA' },
      { who: 'lila', text: 'Pioggia battente e cinque enormi pozze di fango in mezzo al campo! Che incubo per le scarpe!' },
      { who: 'local', text: 'Arthur, capitano di Camden. Sul fango i passaggi rasoterra si piantano: serve carattere e due gol di scarto!' },
      { who: 'marco', text: '{nome}, evita le pozze quando corri e carica il tiro per alzare la palla sopra il fango!' },
    ],
    win: [
      { who: 'local', text: 'Vittoria netta sotto il diluvio. Tenete questi tacchetti da fango, ve li siete meritati!' },
      { who: 'vargas', text: 'Niente male... ma vediamo come ve la cavate dall\'altra parte del mondo, sotto le luci di Tokyo!' },
    ],
    lose: [
      { who: 'local', text: 'Il fango di Camden ha fermato i vostri tiri. Qui servono due gol di scarto!' },
      { who: 'lila', text: 'Forza {nome}, aggiriamo le pozze e colpiamo più forte!' },
    ],
  },
  {
    id: 'tokyo',
    name: 'TOKYO',
    country: 'Giappone',
    mx: 0.85,
    my: 0.34,
    place: 'Arena Cyber di Shibuya, Tokyo',
    pitch: 'flipper',
    night: true,
    mods: { superMult: 2, fastPowerUps: true },
    goal: 'superGoal',
    duration: 150,
    goldenGoal: true,
    opp: { id: 'shibuya', name: 'Shibuya Cyber', short: 'SHB', colors: kit(0x181c36, 0x39e6ff, 0x181c36, 0xff3fa4), pattern: 'sash', stars: 3 },
    captain: { name: 'Ren', look: { skin: 0, hair: 3, hairStyle: 2 } },
    souvenir: { name: 'BATTERIA NEON', desc: 'La barra SUPER parte già carica al 60%', superStart: true },
    before: [
      { who: 'title', text: 'TAPPA 3\nTOKYO' },
      { who: 'lila', text: 'Shibuya di notte è pazzesca! L\'Arena Cyber brilla di neon e i power-up spuntano a raffica!' },
      { who: 'local', text: 'Sono Ren. Qui l\'energia SUPER carica al doppio della velocità. Voglio vedere un vero SUPER GOL!' },
      { who: 'marco', text: 'Obiettivo chiaro: carica al massimo quando la barra lampeggia e vinci la partita!' },
    ],
    win: [
      { who: 'local', text: 'Incredibile! Quel Super Tiro ha illuminato tutta Shibuya!' },
      { who: 'marco', text: 'Con questa Batteria Neon partiremo ogni partita con la barra SUPER già bella carica!' },
      { who: 'lila', text: 'Ora si vola al caldo: destinazione Rio de Janeiro!' },
    ],
    lose: [
      { who: 'local', text: 'Senza un Super Gol e la vittoria, Shibuya non concede il passaggio.' },
      { who: 'marco', text: 'Passaggi rapidi per caricare la barra, poi tieni premuto TIRO fino al lampo fucsia!' },
    ],
  },
  {
    id: 'rio',
    name: 'RIO DE JANEIRO',
    country: 'Brasile',
    mx: 0.30,
    my: 0.67,
    place: 'Spiaggia di Copacabana, Rio',
    pitch: 'spiaggia',
    mods: { speedMult: 1.15, staminaMult: 0 },
    goal: 'score3',
    duration: 150,
    goldenGoal: false,
    opp: { id: 'samba', name: 'Samba Street', short: 'SMB', colors: kit(0xf5d13b, 0x1f9e4a, 0x1d3f8f, 0xff7a1a), pattern: 'hoops', stars: 4 },
    captain: { name: 'Thiago', look: { skin: 3, hair: 0, hairStyle: 3 } },
    souvenir: { name: 'PALLONE CARIOCA', desc: '+velocità e +passaggio per tutta la squadra', stat: 'speed', stat2: 'pass' },
    before: [
      { who: 'title', text: 'TAPPA 4\nRIO DE JANEIRO' },
      { who: 'lila', text: 'Copacabana! Musica ovunque e... zero fatica! Oggi si può scattare all\'infinito!' },
      { who: 'local', text: 'Thiago, Samba Street. Qui si balla e si attacca: per batterci dovete segnare almeno 3 gol!' },
      { who: 'hero', text: 'Scatto infinito sulla sabbia? Sarà una festa di gol!' },
    ],
    win: [
      { who: 'local', text: 'Joga bonito! Avete segnato a raffica e fatto ballare tutto il pubblico!' },
      { who: 'vargas', text: 'Mmm... state ancora in piedi. Allora alziamo la temperatura: benvenuti sul vulcano d\'Islanda!' },
    ],
    lose: [
      { who: 'local', text: 'A Rio servono almeno tre gol e la vittoria! Ballate più veloci!' },
      { who: 'marco', text: 'Tieni sempre premuto SCATTO e cerca tiri potenti da vicino!' },
    ],
  },
  {
    id: 'reykjavik',
    name: 'REYKJAVIK',
    country: 'Islanda',
    mx: 0.38,
    my: 0.13,
    place: 'Cratere di Magma, Reykjavik',
    pitch: 'vulcano',
    night: true,
    startScore: [0, 1],
    mods: { fastPowerUps: true },
    goal: 'win',
    duration: 150,
    goldenGoal: true,
    opp: { id: 'magma', name: 'Vichinghi di Magma', short: 'VKM', colors: kit(0x281e24, 0xff5a1e, 0x281e24, 0x39e6ff), pattern: 'half', stars: 4 },
    captain: { name: 'Freja', look: { skin: 0, hair: 2, hairStyle: 2 } },
    souvenir: { name: 'PIETRA LAVICA', desc: '+tiro e +parate per tutta la squadra', stat: 'shot', stat2: 'keeping' },
    before: [
      { who: 'title', text: 'TAPPA 5\nREYKJAVIK' },
      { who: 'lila', text: 'Mamma mia! Giochiamo dentro un cratere circondato dalla lava... e quei geyser stanno per esplodere!' },
      { who: 'local', text: 'Freja dei Vichinghi di Magma. Siete arrivati tardi nella tempesta: partiamo avanti 1-0!' },
      { who: 'marco', text: 'Sfruttate i geyser e i nuovi power-up: il ghiaccio congela gli avversari e la calamita attira la palla!' },
    ],
    win: [
      { who: 'local', text: 'Avete domato il vulcano e ribaltato lo svantaggio! Siete pronti per la finale.' },
      { who: 'marco', text: 'Ultima fermata: Buenos Aires! Lì ci aspetta la Selección Callejera!' },
    ],
    lose: [
      { who: 'local', text: 'Il calore del cratere e quel gol di vantaggio hanno fatto la differenza.' },
      { who: 'marco', text: 'Occhio ai cerchi arancioni prima che erutti il geyser. Riproviamo!' },
    ],
  },
  {
    id: 'buenosaires',
    name: 'BUENOS AIRES',
    country: 'Argentina',
    mx: 0.27,
    my: 0.81,
    place: 'Bombonera Callejera, Buenos Aires',
    pitch: 'stadio',
    night: true,
    mods: { superMult: 1.5, fastPowerUps: true },
    goal: 'win',
    duration: 180,
    goldenGoal: true,
    opp: { id: 'callejera', name: 'Selección Callejera', short: 'SEL', colors: kit(0x52b6f0, 0xffffff, 0x1d2a4a, 0xffd23f), pattern: 'stripes', stars: 5 },
    captain: { name: 'Dante', look: { skin: 2, hair: 0, hairStyle: 2 } },
    souvenir: { name: 'TROFEO DEL MONDO', desc: '+tutto per la squadra: campioni della strada!', all: true },
    before: [
      { who: 'title', text: 'FINALE MONDIALE\nBUENOS AIRES' },
      { who: 'lila', text: 'Stadio stracolmo sotto i riflettori! Tutti i capitani del mondo stanno guardando questa finale!' },
      { who: 'vargas', text: 'Siete arrivati fino all\'atto finale, {nome}. Ma la Selección Callejera non ha mai perso in casa.' },
      { who: 'local', text: 'Dante, numero 10 di Buenos Aires. Qui non ci sono trappole: solo grande calcio, talento e cuore!' },
      { who: 'hero', text: 'Da Barcellona fino a qui, passando per fango e vulcani. Questa coppa è nostra!' },
    ],
    win: [
      { who: 'lila', text: 'GOOOL! È FINITA! SIAMO I RE DELLO STREET WORLD TOUR!' },
      { who: 'local', text: 'Chapeau, {nome}. Avete battuto il mondo intero con stile e coraggio.' },
      { who: 'vargas', text: 'Incredibile... devo ammetterlo: siete la squadra di strada più forte del pianeta.' },
      { who: 'marco', text: 'Sei tappe, sei imprese leggendarie. Alziamo il Trofeo del Mondo!' },
      { who: 'title', text: 'CAMPIONI\nDEL MONDO!' },
    ],
    lose: [
      { who: 'local', text: 'La Bombonera resta imbattuta. Ma siete stati avversari degni!' },
      { who: 'marco', text: 'Siamo arrivati fin qui, non molliamo proprio ora! Rivincita!' },
    ],
  },
];

export const WT_KITS: { name: string; colors: TeamDef['colors']; pattern: TeamDef['pattern'] }[] = [
  { name: 'TURBO NEON', colors: kit(0x1b1e3b, 0x39e6ff, 0x1b1e3b, 0xff3fa4), pattern: 'sash' },
  { name: 'FUOCO DEL SUD', colors: kit(0xe8443a, 0xffd23f, 0x1f1d2b, 0x39e6ff), pattern: 'stripes' },
  { name: 'SMERALDO', colors: kit(0x1f9e5a, 0xf2f2f2, 0x1d2a3a, 0xff7a1a), pattern: 'half' },
  { name: 'SOLSTIZIO', colors: kit(0x7a2bd8, 0xff7ab8, 0x1f1d2b, 0xffd23f), pattern: 'hoops' },
];

export interface WtCaptain {
  name: string;
  number: number;
  look: PlayerDef['look'];
}

export type WtControl = 'squadra' | 'solo';

export interface WorldTourState {
  teamName: string;
  captain: WtCaptain;
  kit: number;
  difficulty: Difficulty;
  control: WtControl;
  /** Tappa corrente (0..WORLD_STAGES.length - 1). */
  step: number;
  apps: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  finished: boolean;
}

export function newWorldTour(teamName: string, captain: WtCaptain, kitIdx: number, difficulty: Difficulty, control: WtControl = 'squadra'): WorldTourState {
  return { teamName: teamName || 'Street Stars', captain, kit: kitIdx, difficulty, control, step: 0, apps: 0, wins: 0, goalsFor: 0, goalsAgainst: 0, finished: false };
}

export function wtConquered(s: WorldTourState): number {
  return s.finished ? WORLD_STAGES.length : s.step;
}

const WT_MATES = ['Lila', 'Taro', 'Jude', 'Rico'];

export function wtTeam(s: WorldTourState, step = s.step): TeamDef {
  const k = WT_KITS[s.kit] ?? WT_KITS[0];
  const short = s.teamName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const stars = Math.min(5, 2 + Math.floor(step / 2));
  const t = makeTeam({ id: 'worldtour', name: s.teamName, short, colors: { ...k.colors }, pattern: k.pattern, stars }, 7711);
  t.players.forEach((p, i) => {
    if (i < 4) p.name = WT_MATES[i];
  });
  t.players[0].look = { skin: 1, hair: 4, hairStyle: 2 };
  // souvenir delle tappe già vinte
  for (let i = 0; i < Math.min(step, WORLD_STAGES.length); i++) {
    const sv = WORLD_STAGES[i].souvenir;
    for (const p of t.players) {
      if (sv.all) for (const key of Object.keys(p.stats) as (keyof PlayerStats)[]) p.stats[key] += 0.03;
      if (sv.stat) p.stats[sv.stat] += 0.05;
      if (sv.stat2) p.stats[sv.stat2] += 0.04;
    }
  }
  t.players[4] = {
    name: s.captain.name,
    number: s.captain.number,
    role: 'FWD',
    look: s.captain.look,
    stats: { ...t.players[4].stats, shot: t.players[4].stats.shot + 0.05, speed: t.players[4].stats.speed + 0.04 },
  };
  for (const p of t.players) if (p !== t.players[4] && p.name.toLowerCase() === s.captain.name.toLowerCase()) p.name += ' B.';
  return t;
}

function seedOf(id: string): number {
  let h = 19;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function wtOppTeam(s: WorldTourState, idx: number): TeamDef {
  const st = WORLD_STAGES[idx];
  const t = makeTeam(st.opp, seedOf(st.id));
  t.players[4] = { ...t.players[4], name: st.captain.name, number: 10, look: st.captain.look, stats: { ...t.players[4].stats, shot: t.players[4].stats.shot + 0.04 } };
  for (const p of t.players) if (p !== t.players[4] && p.name.toLowerCase() === s.captain.name.toLowerCase()) p.name += ' J.';
  return t;
}

export function wtDifficulty(s: WorldTourState, idx: number): Difficulty {
  if (idx < 2 && s.difficulty === 'normale') return 'facile';
  if (idx < 2 && s.difficulty === 'difficile') return 'normale';
  return s.difficulty;
}

function hasSuperStart(step: number): boolean {
  return WORLD_STAGES.slice(0, Math.min(step, WORLD_STAGES.length)).some((st) => st.souvenir.superStart);
}

export function wtLaunch(s: WorldTourState, fixKits: (h: TeamDef, a: TeamDef) => TeamDef): MatchLaunch {
  const st = WORLD_STAGES[s.step];
  const mine = wtTeam(s);
  const opp = wtOppTeam(s, s.step);
  return {
    mode: 'worldtour',
    startScore: st.startScore,
    superStart: hasSuperStart(s.step) ? 0.6 : 0,
    hudGoal: `${st.name}: ${WT_GOAL_TEXT[st.goal]}`.toUpperCase(),
    modeData: { step: s.step },
    config: {
      home: mine,
      away: fixKits(mine, opp),
      pitch: PITCHES[st.pitch],
      difficulty: wtDifficulty(s, s.step),
      durationSec: st.duration,
      powerUps: true,
      goldenGoal: st.goldenGoal,
      weather: st.weather,
      night: st.night,
      mods: st.mods,
      humanTeam: 0,
      lockHuman: s.control === 'squadra' ? undefined : 4,
    },
  };
}

export function checkWtGoal(goal: WtGoal, out: MatchOutcome): boolean {
  const [a, b] = out.result.score;
  const t = out.tally;
  switch (goal) {
    case 'win':
      return a > b;
    case 'winBy2':
      return a - b >= 2;
    case 'score3':
      return a > b && t.goals[0] >= 3;
    case 'superGoal':
      return a > b && t.superGoals[0] >= 1;
    case 'cleanSheet':
      return a > b && t.goals[1] === 0;
  }
}

export interface WtReport {
  success: boolean;
  stage: WorldStage;
  captainGoals: number;
  finished: boolean;
}

export function applyWorldTourResult(s: WorldTourState, out: MatchOutcome): WtReport {
  const stage = WORLD_STAGES[s.step];
  const score = out.result.score;
  const cg = out.result.scorers.filter((x) => x.team === 0 && x.name === s.captain.name).length;
  const success = checkWtGoal(stage.goal, out);
  s.apps++;
  s.goalsFor += score[0];
  s.goalsAgainst += score[1];
  if (score[0] > score[1]) s.wins++;
  if (success) {
    if (s.step >= WORLD_STAGES.length - 1) s.finished = true;
    else s.step++;
  }
  return { success, stage, captainGoals: cg, finished: success && s.finished };
}

export function fillWt(text: string, s: WorldTourState): string {
  return text.replace(/\{nome\}/g, s.captain.name).replace(/\{squadra\}/g, s.teamName);
}

export function wtCast(s: WorldTourState, step: number, line: WtLine): CastMember {
  const idx = Math.min(step, WORLD_STAGES.length - 1);
  switch (line.who) {
    case 'hero':
    case 'title': {
      const t = wtTeam(s, idx);
      return { name: s.captain.name, team: t, def: t.players[4] };
    }
    case 'marco':
      return { name: 'Marco · Coach', team: npcTeam('mc', 0x2f9a8a, 0xffd23f, 'half'), def: npc('Marco', 0, { skin: 1, hair: 1, hairStyle: 0 }) };
    case 'lila': {
      const t = wtTeam(s, idx);
      return { name: 'Lila', team: t, def: { ...t.players[0], role: 'FWD', name: 'Lila', number: 7 } };
    }
    case 'vargas':
      return { name: 'Don Vargas', team: npcTeam('vg', 0x1a1826, 0xffd23f, 'sash'), def: npc('Vargas', 0, { skin: 2, hair: 5, hairStyle: 1 }) };
    case 'local': {
      const ci = line.of ?? idx;
      const t = wtOppTeam(s, ci);
      return { name: `${WORLD_STAGES[ci].captain.name} · ${WORLD_STAGES[ci].opp.short}`, team: t, def: t.players[4] };
    }
  }
}
