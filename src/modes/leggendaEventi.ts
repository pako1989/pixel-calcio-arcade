import type { LgLine } from './leggendaStory';

/**
 * Leggenda del Pallone: imprevisti prima del fischio d'inizio.
 * Prima di alcune partite succede qualcosa nello spogliatoio e tocca a te scegliere:
 * ogni scelta dà un vantaggio ma ha anche un prezzo. Qui c'è solo la logica pura.
 */

/** Effetto di una scelta sulla partita che sta per iniziare. */
export interface EventFx {
  /** Bonus (o malus) ai tuoi duelli. */
  assist?: number;
  /** Energia di tutta la squadra, per esempio 1.1 = +10%. */
  team?: number;
  /** Energia solo di Nico. */
  nico?: number;
}

export interface EventChoice {
  label: string;
  sub: string;
  fx: EventFx;
  /** Cosa succede dopo la scelta. */
  after: LgLine[];
}

export interface PreEvent {
  id: string;
  title: string;
  intro: LgLine[];
  choices: EventChoice[];
}

const L = (who: string, text: string): LgLine => ({ who, text });

export const PRE_EVENTS: PreEvent[] = [
  {
    id: 'panini',
    title: 'IL PANINO DI NONNA',
    intro: [L('pippo', 'Ragazzi, mia nonna ha preparato dei panini enormi! Chi ne vuole uno prima della partita?')],
    choices: [
      { label: 'MANGIO TUTTO', sub: 'ENERGIA +15%  DUELLI -2', fx: { team: 1.15, assist: -2 }, after: [L('pippo', 'Ottimo! Però adesso corriamo un po\' più piano...')] },
      { label: 'SOLO UN MORSO', sub: 'ENERGIA +5%', fx: { team: 1.05 }, after: [L('bea', 'Saggio. Meglio leggeri.')] },
    ],
  },
  {
    id: 'bea',
    title: 'LA LAVAGNA DI BEA',
    intro: [L('bea', 'Ho studiato gli avversari. Posso disegnare una tattica prima del fischio. Che preferite?')],
    choices: [
      { label: 'ATTACCO', sub: 'DUELLI +4  ENERGIA -8%', fx: { assist: 4, team: 0.92 }, after: [L('nico', 'Tutti avanti! Si gioca all\'attacco!')] },
      { label: 'PRUDENZA', sub: 'ENERGIA +10%  DUELLI -1', fx: { team: 1.1, assist: -1 }, after: [L('gigi', 'Io resto dietro: sono la vostra diga!')] },
    ],
  },
  {
    id: 'sciarpa',
    title: 'LA SCIARPA PORTAFORTUNA',
    intro: [L('papa', 'Nico, ti ho portato la sciarpa del Maestro. Dicono che porti fortuna... ma solo se la indossa chi la merita.')],
    choices: [
      { label: 'LA INDOSSO', sub: 'NICO +20%  DUELLI -1', fx: { nico: 1.2, assist: -1 }, after: [L('nico', 'Sento il vento di tutto il mare!')] },
      { label: 'LA DO A DARIO', sub: 'DUELLI +3', fx: { assist: 3 }, after: [L('dario', 'Grazie. La luna ha bisogno di un po\' di coraggio.')] },
    ],
  },
  {
    id: 'allenamento',
    title: 'ALLENAMENTO DI NOTTE',
    intro: [L('sandro', 'Non riesco a dormire. Facciamo un ultimo allenamento al buio? Oppure ci fidiamo di quel che sappiamo?')],
    choices: [
      { label: 'ALLENIAMOCI', sub: 'DUELLI +5  ENERGIA -12%', fx: { assist: 5, team: 0.88 }, after: [L('sandro', 'Che tuono! Adesso ho i muscoli di legno... ma vedrete!')] },
      { label: 'RIPOSIAMO', sub: 'ENERGIA +12%', fx: { team: 1.12 }, after: [L('tommaso', 'Sonno e concentrazione. La mia ricetta.')] },
    ],
  },
  {
    id: 'tifosi',
    title: 'I TIFOSI DEL PORTO',
    intro: [L('bea', 'Fuori dallo stadio c\'è un gruppo di tifosi di Portobello con un tamburo gigante. Vogliono salutarvi!')],
    choices: [
      { label: 'SALUTO TUTTI', sub: 'DUELLI +3  ENERGIA -5%', fx: { assist: 3, team: 0.95 }, after: [L('nico', 'Con tutta Portobello alle spalle non perdo!')] },
      { label: 'MI CONCENTRO', sub: 'NICO +10%', fx: { nico: 1.1 }, after: [L('nico', 'Dopo, tamburi e abbracci. Adesso testa alla partita.')] },
    ],
  },
  {
    id: 'scarpe',
    title: 'LE SCARPE NUOVE',
    intro: [L('gigi', 'Il negozio di Portobello ci ha regalato scarpe nuove di zecca! Ma non sono ancora rodate.')],
    choices: [
      { label: 'LE METTO', sub: 'DUELLI +4  ENERGIA -6%', fx: { assist: 4, team: 0.94 }, after: [L('gigi', 'Che grip! Ma i piedi... bruciano un po\'.')] },
      { label: 'TENGO LE VECCHIE', sub: 'ENERGIA +6%', fx: { team: 1.06 }, after: [L('gigi', 'Le vecchie scarpe sono come amici fedeli.')] },
    ],
  },
  {
    id: 'rivale',
    title: 'LA STRETTA DI MANO',
    intro: [L('dario', 'Il capitano avversario ci aspetta nel tunnel. Vuole salutarci. Potrebbe essere una trappola, o rispetto.')],
    choices: [
      { label: 'STRINGO LA MANO', sub: 'ENERGIA +8%', fx: { team: 1.08 }, after: [L('nico', 'Giochiamo da avversari, ma con rispetto. Si respira meglio!')] },
      { label: 'LO SFIDO', sub: 'NICO +18%  DUELLI -2', fx: { nico: 1.18, assist: -2 }, after: [L('nico', 'Ti aspetto in campo!')] },
    ],
  },
  {
    id: 'pioggia',
    title: 'IL CAMPO È SCIVOLOSO',
    intro: [L('tommaso', 'Il campo è bagnato. Possiamo passarlo a spazzare, ma ci vorrà tempo. Oppure giochiamo così, con prudenza.')],
    choices: [
      { label: 'LO ASCIUGHIAMO', sub: 'ENERGIA -5%  DUELLI +2', fx: { team: 0.95, assist: 2 }, after: [L('bea', 'Scope, stracci e olio di gomito! Pronti!')] },
      { label: 'GIOCHIAMO COSÌ', sub: 'ENERGIA +4%  DUELLI -1', fx: { team: 1.04, assist: -1 }, after: [L('tommaso', 'Mani d\'acciaio, ma anche guanti di scorta!')] },
    ],
  },
];

/** Dal terzo episodio in poi succede qualcosa quasi sempre; prima, solo ogni tanto. */
export function eventChance(ep: number): number {
  return ep < 1 ? 0 : ep < 3 ? 0.4 : 0.65;
}

/** Sceglie un imprevisto (o nessuno), senza ripetere l'ultimo. `rnd` restituisce un numero tra 0 e 1. */
export function pickEvent(ep: number, rnd: () => number, last?: string): PreEvent | null {
  if (rnd() >= eventChance(ep)) return null;
  const pool = PRE_EVENTS.filter((e) => e.id !== last);
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}
