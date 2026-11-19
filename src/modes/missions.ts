import type { Difficulty, MatchMods, PitchId, Weather } from '../sim/types';
import type { MatchOutcome } from './modes';

/** Obiettivi delle missioni: tutti devono essere raggiunti. */
export type Objective =
  | { kind: 'win' }
  | { kind: 'notLose' }
  | { kind: 'winBy'; n: number }
  | { kind: 'score'; n: number }
  | { kind: 'clean' }
  | { kind: 'superGoal'; n: number }
  | { kind: 'fireGoal' }
  | { kind: 'tackles'; n: number }
  | { kind: 'scoreWithin'; sec: number }
  | { kind: 'bankGoal' }
  | { kind: 'longGoal' }
  | { kind: 'tricks'; n: number };

export interface MissionDef {
  id: string;
  title: string;
  brief: string;
  team: string;
  opp: string;
  pitch: PitchId;
  difficulty: Difficulty;
  duration: number;
  powerUps: boolean;
  goldenGoal: boolean;
  startScore?: [number, number];
  weather?: Weather;
  night?: boolean;
  mods?: MatchMods;
  superStart?: number;
  goals: Objective[];
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'primo', title: 'PRIMI PASSI', brief: 'Scaldiamo i piedi: fai vedere che sai trovare la porta.',
    team: 'rondini', opp: 'aquile', pitch: 'stadio', difficulty: 'facile', duration: 120, powerUps: true, goldenGoal: false,
    goals: [{ kind: 'score', n: 2 }],
  },
  {
    id: 'blindata', title: 'PORTA BLINDATA', brief: 'Il mister vuole zero gol subiti. Difendi e colpisci quando serve.',
    team: 'gabbiani', opp: 'aquile', pitch: 'stadio', difficulty: 'facile', duration: 120, powerUps: false, goldenGoal: false,
    goals: [{ kind: 'win' }, { kind: 'clean' }],
  },
  {
    id: 'lampo', title: 'GOL LAMPO', brief: 'Il pubblico è appena entrato: segna nei primi 40 secondi!',
    team: 'tigri', opp: 'pirati', pitch: 'stadio', difficulty: 'facile', duration: 120, powerUps: false, goldenGoal: false,
    goals: [{ kind: 'scoreWithin', sec: 40 }],
  },
  {
    id: 'super', title: 'SUPER BOMBER', brief: 'Riempi la barra SUPER con passaggi e contrasti, poi carica il tiro al massimo.',
    team: 'lupi', opp: 'gabbiani', pitch: 'stadio', difficulty: 'facile', duration: 180, powerUps: false, goldenGoal: false,
    goals: [{ kind: 'superGoal', n: 1 }, { kind: 'notLose' }],
  },
  {
    id: 'sabbia', title: 'SABBIA NEGLI SCARPINI', brief: 'In spiaggia la palla si ferma subito. Vinci con almeno 2 gol di scarto.',
    team: 'vulcani', opp: 'pirati', pitch: 'spiaggia', difficulty: 'facile', duration: 150, powerUps: true, goldenGoal: false,
    goals: [{ kind: 'winBy', n: 2 }],
  },
  {
    id: 'ghiaccio', title: 'PISTA GHIACCIATA', brief: 'Niente aiutini: power-up spenti e si scivola ovunque. Vinci!',
    team: 'draghi', opp: 'tigri', pitch: 'neve', difficulty: 'normale', duration: 150, powerUps: false, goldenGoal: true,
    goals: [{ kind: 'win' }],
  },
  {
    id: 'rimonta', title: 'LA RIMONTA', brief: 'Entri in campo e state perdendo 0-2. Ribalta tutto!',
    team: 'rondini', opp: 'lupi', pitch: 'stadio', difficulty: 'facile', duration: 180, powerUps: true, goldenGoal: true,
    startScore: [0, 2], goals: [{ kind: 'win' }],
  },
  {
    id: 'muro', title: 'MURO UMANO', brief: 'Recupera palloni con le scivolate: almeno 6 contrasti vinti, e non perdere.',
    team: 'pirati', opp: 'vulcani', pitch: 'quartiere', difficulty: 'normale', duration: 150, powerUps: false, goldenGoal: false,
    goals: [{ kind: 'tackles', n: 6 }, { kind: 'notLose' }],
  },
  {
    id: 'vento', title: 'NOTTE DI VENTO', brief: 'Sul tetto il vento sposta i tiri. Segna almeno 3 gol.',
    team: 'gabbiani', opp: 'vulcani', pitch: 'tetto', difficulty: 'normale', duration: 180, powerUps: true, goldenGoal: false,
    goals: [{ kind: 'score', n: 3 }],
  },
  {
    id: 'fuoco', title: 'PALLA DI FUOCO', brief: 'Prendi il power-up del fuoco e segna con un tiro infuocato.',
    team: 'vulcani', opp: 'aquile', pitch: 'spiaggia', difficulty: 'normale', duration: 180, powerUps: true, goldenGoal: false,
    goals: [{ kind: 'fireGoal' }],
  },
  {
    id: 'gabbia', title: 'GABBIA INFERNALE', brief: 'I Draghi Verdi sono i più forti. Nella gabbia con le sponde, battili.',
    team: 'tigri', opp: 'draghi', pitch: 'quartiere', difficulty: 'normale', duration: 150, powerUps: true, goldenGoal: true,
    goals: [{ kind: 'win' }],
  },
  {
    id: 'leggenda', title: 'DAVIDE E GOLIA', brief: 'La squadra più debole contro la più forte, CPU difficile. Vinci senza subire gol.',
    team: 'aquile', opp: 'draghi', pitch: 'stadio', difficulty: 'difficile', duration: 180, powerUps: true, goldenGoal: false,
    goals: [{ kind: 'win' }, { kind: 'clean' }],
  },
  {
    id: 'piazza_sponda', title: 'RIMBALZI IN PIAZZA', brief: 'Sui sampietrini tra fontana e statua: sfrutta gli ostacoli per un gol di sponda e vinci.',
    team: 'gabbiani', opp: 'pirati', pitch: 'piazza', difficulty: 'normale', duration: 150, powerUps: true, goldenGoal: false,
    goals: [{ kind: 'bankGoal' }, { kind: 'win' }],
  },
  {
    id: 'piazza_notte', title: 'NOTTE SUI SAMPIETRINI', brief: 'Pioggia e riflettori in piazza: palla veloce tra i monumenti. Vinci con 2 gol di scarto!',
    team: 'rondini', opp: 'tigri', pitch: 'piazza', difficulty: 'normale', duration: 150, powerUps: true, goldenGoal: false,
    weather: 'pioggia', night: true,
    goals: [{ kind: 'winBy', n: 2 }],
  },
  {
    id: 'montagna_valanga', title: 'VALANGA IN DISCESA', brief: 'Campo in pendenza verso il basso e carica SUPER doppia: travolgili con almeno 3 gol!',
    team: 'vulcani', opp: 'lupi', pitch: 'montagna', difficulty: 'normale', duration: 150, powerUps: true, goldenGoal: false,
    mods: { speedMult: 1.15, superMult: 2 },
    goals: [{ kind: 'score', n: 3 }, { kind: 'win' }],
  },
  {
    id: 'montagna_nebbia', title: 'SCALATA NELLA NEBBIA', brief: 'Sotto 0-1 in alta quota avvolti dalla nebbia. Ribalta la partita prima del fischio!',
    team: 'tigri', opp: 'biscioni', pitch: 'montagna', difficulty: 'normale', duration: 180, powerUps: true, goldenGoal: true,
    weather: 'nebbia', startScore: [0, 1],
    goals: [{ kind: 'win' }],
  },
  {
    id: 'molo_onde', title: 'ONDE SUL MOLO', brief: 'Le onde spazzano il campo! Trova lo spazio per un gol da lontano e non perdere.',
    team: 'pirati', opp: 'gabbiani', pitch: 'molo', difficulty: 'normale', duration: 150, powerUps: true, goldenGoal: false,
    goals: [{ kind: 'longGoal' }, { kind: 'notLose' }],
  },
  {
    id: 'tempesta_porto', title: 'TEMPESTA PERFETTA', brief: 'Notte di tempesta sul molo: tiri infuocati per tutti! Batti i Draghi Verdi.',
    team: 'lupi', opp: 'draghi', pitch: 'molo', difficulty: 'difficile', duration: 180, powerUps: true, goldenGoal: true,
    weather: 'pioggia', night: true, mods: { alwaysFire: true, fastPowerUps: true },
    goals: [{ kind: 'win' }],
  },
];

export function objectiveText(o: Objective): string {
  switch (o.kind) {
    case 'win': return 'Vinci la partita';
    case 'notLose': return 'Non perdere';
    case 'winBy': return `Vinci con almeno ${o.n} gol di scarto`;
    case 'score': return `Segna almeno ${o.n} gol`;
    case 'clean': return 'Non subire gol';
    case 'superGoal': return o.n > 1 ? `Segna ${o.n} gol col super tiro` : 'Segna col super tiro';
    case 'fireGoal': return 'Segna con un tiro di fuoco';
    case 'tackles': return `Vinci almeno ${o.n} contrasti`;
    case 'scoreWithin': return `Segna entro ${o.sec} secondi`;
    case 'bankGoal': return 'Segna un gol di sponda o rimbalzo';
    case 'longGoal': return 'Segna un gol da lontano';
    case 'tricks': return `Fai almeno ${o.n} giocate di stile`;
  }
}

/** Gol fatti durante la partita (esclusi quelli del punteggio di partenza). */
export function checkObjective(o: Objective, out: MatchOutcome): boolean {
  const [a, b] = out.result.score;
  const t = out.tally;
  switch (o.kind) {
    case 'win': return a > b;
    case 'notLose': return a >= b;
    case 'winBy': return a - b >= o.n;
    case 'score': return t.goals[0] >= o.n;
    case 'clean': return t.goals[1] === 0;
    case 'superGoal': return t.superGoals[0] >= o.n;
    case 'fireGoal': return t.fireGoals[0] >= 1;
    case 'tackles': return t.tacklesWon[0] >= o.n;
    case 'scoreWithin': return t.firstGoalAt[0] >= 0 && t.firstGoalAt[0] <= o.sec;
    case 'bankGoal': return (t.bankGoals?.[0] ?? 0) >= 1;
    case 'longGoal': return (t.longGoals?.[0] ?? 0) >= 1;
    case 'tricks': return t.tricks[0] >= o.n;
  }
}

export interface MissionsSave {
  done: Record<string, boolean>;
}

/** Le missioni si sbloccano un po' alla volta: sempre 3 disponibili oltre a quelle completate. */
export function isUnlocked(i: number, done: Record<string, boolean>): boolean {
  let completed = 0;
  for (const m of MISSIONS) if (done[m.id]) completed++;
  return i < completed + 3 || !!done[MISSIONS[i].id];
}
