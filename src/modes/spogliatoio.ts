import { voteFor } from './ratings';
import type { MatchOutcome } from './modes';
import type { PlayerTally } from './tally';

/**
 * Spogliatoio di "Diventa un mito": voto del tuo campione, fiducia
 * dell'allenatore, colloquio dopo la partita e titoli del giornale.
 */

const EMPTY: PlayerTally = { goals: 0, assists: 0, shots: 0, passes: 0, tackles: 0, saves: 0, tricks: 0, fouls: 0, reds: 0 };

/** Indice del protagonista nella sua squadra (squadra 0). */
export const HERO_IDX = 4;

/** Sotto questa fiducia, nella carriera da pro si parte dalla panchina. */
export const TRUST_BENCH = 45;

export type Res = 'w' | 'd' | 'l';

export function resultOf(out: MatchOutcome): Res {
  const [a, b] = out.result.score;
  return a > b ? 'w' : a < b ? 'l' : 'd';
}

export function heroTally(out: MatchOutcome): PlayerTally {
  return out.tally.players[0][HERO_IDX] ?? EMPTY;
}

/** Voto in pagella del tuo campione (da 4 a 10). */
export function heroVote(out: MatchOutcome): number {
  const [a, b] = out.result.score;
  return voteFor('FWD', heroTally(out), a, b);
}

/** La fiducia sale con i voti alti e con le vittorie. */
export function trustAfter(trust: number, vote: number, res: Res): number {
  const d = (vote - 6) * 9 + (res === 'w' ? 3 : res === 'l' ? -2 : 0);
  return Math.max(0, Math.min(100, Math.round(trust + d)));
}

export function trustLabel(t: number, pro = true): { text: string; color: string } {
  if (t >= 80) return { text: 'INTOCCABILE', color: '#5be37d' };
  if (t >= 60) return { text: 'TITOLARE FISSO', color: '#9be37d' };
  if (t >= TRUST_BENCH) return { text: 'IN BILICO', color: '#ffd23f' };
  return { text: pro ? 'PANCHINA' : 'DA CONQUISTARE', color: '#ff9a9a' };
}

// ---------------------------------------------------------------- colloquio

export interface TalkOption {
  label: string;
  reply: string;
  trust: number;
  points: number;
}

export interface Talk {
  /** Chi parla: il nonno (prima della squadra vera) o l'allenatore. */
  who: 'mister' | 'nonno';
  name: string;
  vote: number;
  text: string;
  options: TalkOption[];
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function makeTalk(vote: number, goals: number, res: Res, fromBench: boolean, seed: number, speaker: { who: 'mister' | 'nonno'; name: string }): Talk {
  let text: string;
  let options: TalkOption[];
  if (vote >= 7) {
    text = pick([
      'Partita enorme, {nome}. Continua così e il posto non te lo toglie nessuno.',
      'Così si gioca! Oggi hai trascinato tutti quanti.',
      goals >= 2 ? 'Due gol e mezza squadra avversaria a terra. Che ti hanno dato a colazione?' : 'Hai corso per tre. I compagni ti seguono, l\'hai visto?',
    ], seed);
    if (fromBench) text = 'Sei entrato e hai cambiato la partita. La prossima volta parti dall\'inizio, promesso.';
    options = [
      { label: 'MERITO DELLA SQUADRA', reply: 'Umile, mi piace. Lo spogliatoio ti apprezza.', trust: 6, points: 0 },
      { label: 'VOGLIO PIÙ PALLONI', reply: 'Te li sei guadagnati. Ma non montarti la testa.', trust: -4, points: 2 },
      { label: 'MI ALLENO ANCORA', reply: 'Così mi piaci. Domani doppia seduta, insieme.', trust: 2, points: 1 },
    ];
  } else if (vote >= 6) {
    text = pick([
      'Partita ordinata, {nome}. Ma da te mi aspetto di più.',
      'Sufficiente. Solo sufficiente. Tu puoi fare la differenza, non il compitino.',
      res === 'l' ? 'Abbiamo perso e tu ti sei nascosto un po\'. Non è da te.' : 'Bene il risultato, ma ti ho visto spento a tratti.',
    ], seed);
    options = [
      { label: 'HA RAGIONE, MISTER', reply: 'Bene. Dimostramelo in campo, non a parole.', trust: 4, points: 0 },
      { label: 'MI DIA UN CONSIGLIO', reply: 'Smarcati prima e tira appena puoi. Prova, vedrai.', trust: 1, points: 1 },
      { label: 'MI SERVE PIÙ FIDUCIA', reply: 'La fiducia si conquista. Ma ti ascolto.', trust: -3, points: 1 },
    ];
  } else {
    text = pick([
      'Oggi non ci sei stato, {nome}. Cosa è successo?',
      'Una partita da dimenticare. Te ne rendi conto, vero?',
      'Palle perse, tiri sbagliati... Così non va.',
    ], seed);
    if (fromBench) text = 'Ti ho dato spazio e non l\'hai sfruttato. Così la panchina diventa casa tua.';
    options = [
      { label: 'COLPA MIA, RIMEDIERÒ', reply: 'Questo volevo sentire. Testa alta.', trust: 6, points: 0 },
      { label: 'RESTO DOPO L\'ALLENAMENTO', reply: 'Va bene. Ti tengo d\'occhio.', trust: 2, points: 1 },
      { label: 'NON MI PASSANO LA PALLA', reply: 'Allora vattela a prendere! Le scuse non segnano.', trust: -6, points: 1 },
    ];
  }
  return { ...speaker, vote, text, options };
}

// ---------------------------------------------------------------- giornale

export interface Headline {
  title: string;
  sub: string;
  vote: number;
}

export function makeHeadline(name: string, team: string, opp: string, vote: number, t: PlayerTally, res: Res, score: [number, number], seed: number): Headline {
  const N = name.toUpperCase();
  let title: string;
  if (t.goals >= 3) title = `TRIPLETTA DI ${N}!`;
  else if (t.goals === 2) title = pick([`DOPPIETTA, ${N} SI PRENDE LA SCENA`, `${N} NE FA DUE E ${opp.toUpperCase()} AFFONDA`], seed);
  else if (vote >= 8) title = `${N} INARRESTABILE`;
  else if (t.goals === 1 && res === 'w') title = `${N} DECIDE CONTRO ${opp.toUpperCase()}`;
  else if (t.assists >= 2) title = `${N} UOMO ASSIST`;
  else if (vote <= 5) title = pick([`SERATA NO PER ${N}`, `${N} IRRICONOSCIBILE`, `${N}, CHE FATICA`], seed);
  else if (res === 'l') title = `${team.toUpperCase()} KO, ${N} NON BASTA`;
  else if (res === 'd') title = `PARI CON ${opp.toUpperCase()}, ${N} CI PROVA`;
  else title = pick([`${N}, PROVA DI SOSTANZA`, `${team.toUpperCase()} VINCE, ${N} C'È`], seed);
  const bits = [`${score[0]}-${score[1]} contro ${opp}`, `voto ${vote}`];
  if (t.goals) bits.push(`${t.goals} gol`);
  if (t.assists) bits.push(`${t.assists} assist`);
  return { title, sub: bits.join(' · '), vote };
}

/** Commento lampo sotto il giocatore durante la partita. */
export const LIVE = {
  pass: ['BEL PASSAGGIO', 'PASSAGGIO OK', 'APPOGGIO'],
  shot: ['TIRO!', 'CI PROVA!'],
  win: ['PALLA RECUPERATA', 'CONTRASTO VINTO'],
  lost: ['PALLA PERSA'],
  failTackle: ['CONTRASTO PERSO'],
  trick: ['CHE GIOCATA!'],
  assist: ['ASSIST!'],
  foul: ['FALLO'],
};
