import type { Face, LgPlayer, LgTeam, Objective } from './leggenda';
import type { Role } from '../sim/types';

/**
 * Leggenda del Pallone: personaggi, squadre ed episodi della storia.
 * Tutti i nomi, i personaggi e le tecniche sono inventati.
 */

// ---------- personaggi (ritratti) ----------

export interface Character {
  name: string;
  face: Face;
  /** Colore della maglia nel ritratto. */
  shirt: number;
}

const F = (skin: number, hair: number, style: Face['style'], eyes: number, extra: Partial<Face> = {}): Face => ({ skin, hair, style, eyes, brows: 'fiero', ...extra });

const AZZ = 0x2f6fd0;
const PORTO = 0xff8a2a;

export const CAST: Record<string, Character> = {
  nico: { name: 'Nico Vento', face: F(0, 0x6a3018, 'punte', 0x3a8ae0), shirt: PORTO },
  nicokid: { name: 'Nico (8 anni)', face: F(0, 0x6a3018, 'punte', 0x3a8ae0), shirt: 0xf2f2f2 },
  dario: { name: 'Dario Luna', face: F(0, 0xd8dce8, 'lunghi', 0x8a6aff, { brows: 'calmo' }), shirt: PORTO },
  dariokid: { name: 'Dario (8 anni)', face: F(0, 0xd8dce8, 'lunghi', 0x8a6aff, { brows: 'calmo' }), shirt: 0x3fd0ff },
  tommaso: { name: 'Tommaso Ferri', face: F(1, 0x151515, 'corti', 0x5a3a20, { band: 0xe8443a }), shirt: 0x3a3a48 },
  sandro: { name: 'Sandro Fulmine', face: F(2, 0x151515, 'ricci', 0xffb21e), shirt: 0xffd23f },
  gigi: { name: 'Gigi Sasso', face: F(2, 0x5c3a20, 'rasati', 0x5a3a20, { brows: 'calmo' }), shirt: PORTO },
  bea: { name: 'Bea Corsi', face: F(0, 0xd2a24c, 'raccolti', 0x3fae5a, { brows: 'calmo' }), shirt: PORTO },
  pippo: { name: 'Pippo', face: F(1, 0x8e3b1a, 'ciuffo', 0x5a3a20, { brows: 'calmo' }), shirt: 0xf2f2f2 },
  maestro: { name: 'Il Maestro', face: F(1, 0x9a9aa8, 'brizzolati', 0x3a3a48, { glasses: true, scarf: 0x7a7f9a, beard: true, brows: 'calmo' }), shirt: 0x2a2c3a },
  maestrogiovane: { name: 'Corrado Nebbia', face: F(1, 0x2a1c14, 'ciuffo', 0x3a8ae0), shirt: AZZ },
  papa: { name: 'Papà', face: F(1, 0x2a1c14, 'corti', 0x3a8ae0, { beard: true, brows: 'calmo' }), shirt: 0x1f3a6a },
  edo: { name: 'Edo Rampa', face: F(0, 0xe2c25c, 'ciuffo', 0x3fae5a), shirt: 0x8a1a2a },
  raffo: { name: 'Raffo Nero', face: F(0, 0x2a1a3a, 'lunghi', 0xffd23f), shirt: 0x1c1c26 },
  ivo: { name: 'Ivo Brina', face: F(1, 0x1a2a4a, 'punte', 0x3fd0ff), shirt: 0x3fb8ff },
  paco: { name: 'Paco Herrera', face: F(2, 0x151515, 'ricci', 0x5a3a20), shirt: 0x1f8a4a },
  bram: { name: 'Bram Diga', face: F(0, 0xe8d070, 'corti', 0x3a8ae0, { brows: 'calmo' }), shirt: 0xff8a2a },
  nacho: { name: 'Nacho Ferreyra', face: F(1, 0x3a2414, 'lunghi', 0x5a3a20, { band: 0xf2f2f2 }), shirt: 0x8fd8ff },
  erik: { name: 'Erik Lund', face: F(0, 0xf0eedc, 'ciuffo', 0x8fd8ff), shirt: 0xc8202a },
  even: { name: 'Even Lund', face: F(0, 0xf0eedc, 'ciuffo', 0x8fd8ff, { brows: 'calmo' }), shirt: 0xc8202a },
  rafa: { name: 'Rafa Lima', face: F(3, 0x151515, 'ricci', 0x5a3a20, { band: 0x3fae5a }), shirt: 0xffd23f },
  telecronista: { name: 'Telecronista', face: F(1, 0x5c3a20, 'corti', 0x5a3a20, { glasses: true, brows: 'calmo' }), shirt: 0x7a1a2a },
};

// ---------- squadre ----------

type Stats = [drb: number, pas: number, sht: number, tck: number, blk: number, gk: number];

function P(id: string, name: string, num: number, role: Role, s: Stats, sta: number, techs: string[] = [], face?: Face): LgPlayer {
  return {
    id, name, num, role,
    drb: s[0], pas: s[1], sht: s[2], tck: s[3], blk: s[4], gk: s[5],
    sta, techs,
    face: face ?? CAST[id]?.face ?? F(1, 0x2a1c14, 'corti', 0x5a3a20, { brows: 'calmo' }),
  };
}

/** Comparsa: aspetto generato dal nome. */
function extra(id: string, name: string, num: number, role: Role, lvl: number, seed: number): LgPlayer {
  const styles: Face['style'][] = ['corti', 'ciuffo', 'rasati', 'ricci', 'punte', 'lunghi'];
  const hairs = [0x2a1c14, 0x5c3a20, 0xd2a24c, 0x151515, 0x8e3b1a];
  const face = F(seed % 5, hairs[seed % hairs.length], styles[(seed * 7) % styles.length], [0x5a3a20, 0x3a8ae0, 0x3fae5a][seed % 3], { brows: 'calmo' });
  const b = lvl;
  const st: Stats =
    role === 'GK' ? [b - 3, b - 2, b - 3, b - 2, b - 1, b + 1] :
    role === 'DEF' ? [b - 1, b - 1, b - 2, b + 1, b + 1, 1] :
    role === 'MID' ? [b, b + 1, b - 1, b, b - 1, 1] : [b + 1, b - 1, b + 1, b - 2, b - 2, 1];
  return P(id, name, num, role, st, 80 + lvl * 6, [], face);
}

const T = (id: string, name: string, short: string, shirt: number, shirt2: number, shorts: number, gk: number, pattern: LgTeam['pattern'], players: LgPlayer[]): LgTeam => ({
  id, name, short, pattern, players,
  colors: { shirt, shirt2, shorts, socks: shirt, gk },
});

/** La squadra di Nico, che cresce episodio dopo episodio. */
export function heroTeam(ep: number): LgTeam {
  const g = Math.min(ep, 9) * 0.22;
  const r = (v: number) => Math.round((v + g) * 10) / 10;
  const nico = P('nico', 'Nico', 10, 'FWD', [r(7), r(6.5), r(7), 4, 4, 2], 110 + ep * 6, ['gabbiano', 'vortice', 'cometa', 'mezzaluna', 'eclissi', 'tempesta', 'aurora']);
  if (ep === 0) {
    return T('porto', 'Ragazzi del Porto', 'POR', 0xf2f2f2, 0x3fd0ff, 0x1f3a6a, 0x5be37d, 'hoops', [
      extra('gaspare', 'Gaspare', 1, 'GK', 5, 3),
      extra('ciro', 'Ciro', 4, 'DEF', 5, 5),
      extra('momo', 'Momo', 5, 'DEF', 5, 8),
      P('pippo', 'Pippo', 8, 'MID', [5, 6, 5, 5, 4, 1], 90),
      extra('lino', 'Lino', 6, 'MID', 5, 11),
      extra('ugo', 'Ugo', 9, 'FWD', 5, 2),
      nico,
    ]);
  }
  const tommaso = P('tommaso', 'Tommaso', 1, 'GK', [3, 5, 3, 4, 6, r(8)], 110 + ep * 4, ['acciaio', 'rondine']);
  const gigi = P('gigi', 'Gigi', 5, 'DEF', [4, 5, 4, r(7), r(7.5), 2], 110, ['muraglia']);
  const dario = P('dario', 'Dario', 11, 'MID', [r(7.5), r(8), r(6), 5, 4, 2], 100 + ep * 5, ['passoluna']);
  if (ep <= 4) {
    return T('portobello', 'Portobello FC', 'PFC', PORTO, 0xffffff, 0xffffff, 0x3a3a48, 'plain', [
      tommaso,
      gigi,
      extra('ciro', 'Ciro', 4, 'DEF', 6, 5),
      ep >= 3 ? dario : P('pippo', 'Pippo', 8, 'MID', [5.5, 6, 5, 5, 4, 1], 90),
      P('bea', 'Bea', 7, 'MID', [6.5, 6.5, 5.5, 5, 4, 1], 100),
      extra('ugo', 'Ugo', 9, 'FWD', 6, 2),
      nico,
    ]);
  }
  return T('italia', 'Italia U15', 'ITA', AZZ, 0xffffff, 0xffffff, 0x3a3a48, 'plain', [
    tommaso,
    gigi,
    extra('valli', 'Valli', 3, 'DEF', 7, 6),
    dario,
    extra('spina', 'Spina', 8, 'MID', 7, 9),
    P('sandro', 'Sandro', 9, 'FWD', [r(6.5), 5.5, r(8.5), 5, 4, 2], 115, ['tuono']),
    nico,
  ]);
}

function rivals(ep: number): LgTeam {
  switch (ep) {
    case 0:
      return T('santelmo', 'Collegio Sant\'Elmo', 'SEL', 0x8a1a2a, 0xffd23f, 0x1c1c26, 0x3a3a48, 'stripes', [
        P('tommaso', 'Ferri', 1, 'GK', [3, 5, 3, 4, 6, 7.5], 120, ['acciaio']),
        extra('se2', 'Bassi', 2, 'DEF', 4, 1), extra('se3', 'Corso', 3, 'DEF', 4, 4),
        extra('se6', 'Lauro', 6, 'MID', 4, 7), extra('se8', 'Pini', 8, 'MID', 4, 9),
        extra('se11', 'Gallo', 11, 'FWD', 4, 13), P('edo', 'Edo', 10, 'FWD', [5.5, 5, 5.5, 4, 3, 1], 90),
      ]);
    case 1:
      return T('faro', 'Scuola Faro Rosso', 'FAR', 0xe8443a, 0xffffff, 0xe8443a, 0x2f9a50, 'hoops', [
        extra('fa1', 'Moli', 1, 'GK', 7, 2), extra('fa2', 'Scoglio', 2, 'DEF', 7.2, 6), extra('fa3', 'Ancora', 3, 'DEF', 7.2, 10),
        extra('fa6', 'Remo', 6, 'MID', 6.5, 3), extra('fa8', 'Vela', 8, 'MID', 6.5, 12), extra('fa9', 'Prua', 9, 'FWD', 6.5, 4), extra('fa10', 'Boa', 10, 'FWD', 6.5, 7),
      ]);
    case 2:
    case 4: {
      const sandro = P('sandro', 'Fulmine', 9, 'FWD', [6.5, 5.5, ep === 4 ? 8.5 : 8, 5, 4, 2], 120, ['tuono']);
      const gk = ep === 4
        ? P('raffo', 'Raffo Nero', 1, 'GK', [3, 5, 3, 4, 6, 7.6], 125, ['gattonero'])
        : extra('mo1', 'Grigi', 1, 'GK', 6, 4);
      return T('monteruvido', 'Monteruvido', 'MON', 0xffd23f, 0x1c1c26, 0x1c1c26, 0x8a3fd0, 'stripes', [
        gk, extra('mo2', 'Pietra', 2, 'DEF', 6 + ep * 0.2, 8), extra('mo3', 'Roccia', 3, 'DEF', 6 + ep * 0.2, 1),
        extra('mo6', 'Larice', 6, 'MID', 6 + ep * 0.2, 6), extra('mo8', 'Abete', 8, 'MID', 6 + ep * 0.2, 9),
        extra('mo10', 'Cima', 10, 'FWD', 6, 3), sandro,
      ]);
    }
    case 3:
      return T('saline', 'Accademia Saline', 'SAL', 0x3fb8ff, 0xffffff, 0xffffff, 0xe8443a, 'half', [
        extra('sa1', 'Sorrentino', 1, 'GK', 7.3, 5), extra('sa2', 'Marea', 2, 'DEF', 7.3, 7), extra('sa3', 'Riva', 3, 'DEF', 7.3, 2),
        extra('sa6', 'Spuma', 6, 'MID', 7.3, 11), extra('sa8', 'Conchiglia', 8, 'MID', 7.3, 4),
        extra('sa9', 'Gabbia', 9, 'FWD', 7.3, 9), P('ivo', 'Ivo Brina', 10, 'FWD', [8, 6, 6.5, 4, 4, 1], 110, ['ondasalata']),
      ]);
    case 5:
      return T('messico', 'Messico U15', 'MEX', 0x1f8a4a, 0xffffff, 0xffffff, 0x3a3a48, 'plain', [
        extra('mx1', 'Ortega', 1, 'GK', 8.3, 3), extra('mx2', 'Ruiz', 2, 'DEF', 8.3, 8), extra('mx3', 'Soto', 3, 'DEF', 8.3, 1),
        extra('mx6', 'Vega', 6, 'MID', 8.3, 5), extra('mx8', 'Luna', 8, 'MID', 8.3, 12),
        extra('mx9', 'Cruz', 9, 'FWD', 8.3, 2), P('paco', 'Paco Herrera', 10, 'FWD', [7, 6.5, 8, 4, 4, 1], 120, ['serpente']),
      ]);
    case 6:
      return T('olanda', 'Olanda U15', 'OLA', 0xff8a2a, 0xffffff, 0xffffff, 0x1c1c26, 'plain', [
        P('bram', 'Bram Diga', 1, 'GK', [3, 5, 3, 5, 7, 9], 170, ['diga']),
        extra('ol2', 'Visser', 2, 'DEF', 7.8, 6), extra('ol3', 'Bakker', 3, 'DEF', 7.8, 9),
        extra('ol6', 'Smit', 6, 'MID', 7.8, 2), extra('ol8', 'Mulder', 8, 'MID', 7.8, 13),
        extra('ol9', 'Dekker', 9, 'FWD', 7.8, 4), extra('ol10', 'Meijer', 10, 'FWD', 7.8, 10),
      ]);
    case 7:
      return T('argentina', 'Argentina U15', 'ARG', 0x8fd8ff, 0xffffff, 0x1c1c26, 0xffd23f, 'stripes', [
        extra('ar1', 'Rojas', 1, 'GK', 8.7, 5), extra('ar2', 'Paz', 2, 'DEF', 8.7, 8), extra('ar3', 'Gil', 3, 'DEF', 8.7, 1),
        extra('ar5', 'Moreno', 5, 'MID', 8.7, 6), extra('ar8', 'Acosta', 8, 'MID', 8.7, 11),
        extra('ar9', 'Ibarra', 9, 'FWD', 8.7, 3), P('nacho', 'Nacho Ferreyra', 10, 'FWD', [8.5, 7, 8, 4, 4, 1], 130, ['tango', 'pampero']),
      ]);
    case 8:
      return norway();
    default:
      return T('brasile', 'Brasile U15', 'BRA', 0xffd23f, 0x3fae5a, 0x2f6fd0, 0x3a3a48, 'plain', [
        P('caio', 'Caio', 1, 'GK', [3, 5, 3, 4, 7, 8.8], 150, ['tucano']),
        extra('br2', 'Souza', 2, 'DEF', 9.2, 7), extra('br3', 'Alves', 3, 'DEF', 9.2, 4),
        extra('br5', 'Duda', 5, 'MID', 9.2, 3), extra('br8', 'Teo', 8, 'MID', 9.2, 12),
        extra('br9', 'Biel', 9, 'FWD', 9.2, 6), P('rafa', 'Rafa Lima', 10, 'FWD', [9.5, 8, 8.5, 4, 4, 1], 150, ['colibri', 'solare']),
      ]);
  }
}

function norway(): LgTeam {
  const t = T('norvegia', 'Norvegia U15', 'NOR', 0xc8202a, 0x1f3a6a, 0xffffff, 0x3fd0ff, 'sash', [
    P('nordberg', 'Nordberg', 1, 'GK', [3, 5, 3, 4, 7, 8.5], 140, ['ghiaccio']),
    extra('no2', 'Haugen', 2, 'DEF', 9, 7), extra('no3', 'Dahl', 3, 'DEF', 9, 4),
    extra('no6', 'Berg', 6, 'MID', 9, 9), extra('no8', 'Moe', 8, 'MID', 9, 12),
    P('erik', 'Erik Lund', 9, 'FWD', [7.5, 7, 8.5, 4, 4, 1], 130, ['valanga']),
    P('even', 'Even Lund', 10, 'FWD', [7.5, 7.5, 8, 4, 4, 1], 130, []),
  ]);
  return t;
}
export function rivalTeam(ep: number): LgTeam {
  return rivals(ep);
}

// ---------- storia ----------

/** Battuta: `who` è un personaggio di CAST, 'narr' il narratore, 'title' un cartello. */
export interface LgLine {
  who: string;
  text: string;
  /** Ricordo: immagine color seppia. */
  fb?: boolean;
}

export type Trigger = 'start' | 'half' | 'goalFor' | 'goalAgainst' | 'rivalTech' | 'late';

export interface ScriptEvent {
  when: Trigger;
  /** 'rivalTech': quale tecnica avversaria; 'late': minuto dal quale scatta. */
  arg?: string | number;
  lines: LgLine[];
  /** Tecnica insegnata in quel momento. */
  unlock?: string;
  /** Energia restituita a un giocatore. */
  refill?: string;
}

export interface Episode {
  title: string;
  place: string;
  objective: Objective;
  /** Durata reale della partita (sul tabellone si vede sempre da 0' a 90'). */
  minutes: number;
  intro: LgLine[];
  win: LgLine[];
  lose: LgLine[];
  script: ScriptEvent[];
  /** Tecniche insegnate dalla storia all'inizio dell'episodio. */
  teaches?: string[];
  /** Infortunio: energia massima ridotta. */
  injured?: Record<string, number>;
  /** Colore del cielo dello stadio (per variare). */
  sky: number;
  night?: boolean;
  snow?: boolean;
}

const t = (a: string, b: string): LgLine => ({ who: 'title', text: `${a}\n${b}` });
const n = (text: string, fb = false): LgLine => ({ who: 'narr', text, fb });
const L = (who: string, text: string, fb = false): LgLine => ({ who, text, fb });

export const EPISODES: Episode[] = [
  {
    title: 'Il ragazzo col pallone',
    place: 'Portobello, il campo sulla collina',
    objective: { kind: 'segna', n: 1 },
    minutes: 30,
    sky: 0x7ac8ff,
    intro: [
      t('EPISODIO 1', 'IL RAGAZZO COL PALLONE'),
      n('Portobello, un paese di pescatori. Un ragazzino di undici anni scende dalla corriera con una valigia... e un pallone.'),
      L('nico', 'Eccomi, Portobello! Il mare, il porto... e quel campo lassù sulla collina!'),
      L('papa', 'Nico, il pallone è il tuo migliore amico. Se lo tratti bene, non ti tradirà mai.', true),
      L('nicokid', 'Papà, un giorno sentirai il mio nome anche in mezzo al mare!', true),
      L('edo', 'Ehi, nuovo! Questo campo è del Collegio Sant\'Elmo. E al nostro portiere nessuno ha mai segnato.'),
      L('tommaso', 'Io sono Tommaso Ferri. Nessun tiro entra nella mia porta. Mai.'),
      L('nico', 'Allora sarò il primo! Ragazzi del porto, si gioca!'),
    ],
    script: [
      { when: 'start', lines: [L('telecronista', 'Il campo del collegio è lunghissimo: da qui la porta sembra lontana un chilometro!')] },
      { when: 'goalFor', lines: [L('tommaso', 'Impossibile... ha segnato a ME?!')] },
    ],
    win: [
      L('tommaso', 'Nessuno mi aveva mai segnato. Nico Vento... ricorderò il tuo nome.'),
      L('nico', 'E io il tuo! Perché non vieni a giocare con noi al Portobello FC?'),
      n('Sulla collina, un uomo con gli occhiali scuri e una sciarpa grigia ha visto tutto.'),
      L('maestro', 'Quel ragazzo... calcia come qualcuno che conoscevo tanto tempo fa.'),
    ],
    lose: [L('tommaso', 'Te l\'avevo detto. Torna quando sarai pronto.')],
  },
  {
    title: 'Il Maestro nella nebbia',
    place: 'Portobello, la spiaggia all\'alba',
    objective: { kind: 'vinci' },
    minutes: 36,
    sky: 0xffb8a0,
    teaches: ['gabbiano', 'acciaio'],
    intro: [
      t('EPISODIO 2', 'IL MAESTRO NELLA NEBBIA'),
      n('All\'alba la spiaggia è avvolta dalla nebbia. Nico si allena da solo, tirando contro il muro del faro.'),
      L('maestro', 'Calci forte, ragazzo. Ma il tuo pallone vola dritto come un sasso.'),
      L('nico', 'E lei chi è?'),
      L('maestro', 'Chiamami Maestro. Guarda i gabbiani: salgono col vento e poi piombano giù sul pesce. Un tiro deve fare lo stesso.'),
      L('nico', 'Salire altissimo... e piombare giù all\'improvviso!'),
      n('NUOVA TECNICA: TIRO DEL GABBIANO! Sale oltre le nuvole e cade di colpo sotto la traversa.'),
      L('tommaso', 'Nico! Ho deciso: da oggi difendo la porta del Portobello FC. Con le mie MANI D\'ACCIAIO.'),
      L('bea', 'Prima partita di campionato: Scuola Faro Rosso. Hanno la difesa più dura della costa!'),
    ],
    script: [
      { when: 'start', lines: [L('maestro', 'Quando hai davanti un difensore, scegli bene: dribbling, passaggio o tiro. E guarda come si muove lui.')] },
      { when: 'goalFor', lines: [L('bea', 'Che tiro! Il pallone è sceso come un gabbiano!')] },
    ],
    win: [
      L('maestro', 'Non male. Ma il campionato è lungo... e a Monteruvido c\'è un ragazzo che tira come un temporale.'),
      L('nico', 'Un temporale? Non vedo l\'ora!'),
      n('Allenati col Maestro e vinci i duelli: con i Punti Leggenda impari nuove tecniche.'),
    ],
    lose: [L('maestro', 'Il gabbiano non si arrende alla prima onda. Riprova.')],
  },
  {
    title: 'Il fulmine di Monteruvido',
    place: 'Monteruvido, stadio di montagna',
    objective: { kind: 'nonperdere' },
    minutes: 36,
    sky: 0x5a5f80,
    night: true,
    intro: [
      t('EPISODIO 3', 'IL FULMINE DI MONTERUVIDO'),
      n('Monteruvido, un paese tra le montagne. Il cielo è nero. Tuona.'),
      L('sandro', 'Sei tu il ragazzino del porto? Io sono Sandro Fulmine. Il mio tiro non l\'ha mai fermato nessuno.'),
      L('tommaso', 'Fino a oggi.'),
      L('sandro', 'Ah sì? Allora preparati al TIRO TUONO. Lo sentirai arrivare da quaranta metri.'),
      L('bea', 'Attenti! Se Sandro prende palla, chiudetegli la strada prima che tiri!'),
      L('nico', 'Ragazzi, oggi basta non perdere. Difendiamo tutti insieme!'),
    ],
    script: [
      { when: 'rivalTech', arg: 'tuono', lines: [L('telecronista', 'Da quaranta metri?! Il pallone ruggisce come un tuono!'), L('tommaso', 'Le mie mani... tremano ancora.')] },
      { when: 'half', lines: [L('gigi', 'Se mi butto davanti al pallone con tutto il corpo... forse lo fermo!')] },
    ],
    win: [
      L('sandro', 'Hai resistito al mio tuono. Ci rivediamo in finale, Vento.'),
      L('nico', 'Ci conto, Fulmine!'),
      L('gigi', 'Ho capito una cosa: se mi metto davanti al pallone, divento un muro!'),
      n('Gigi può imparare la MURAGLIA UMANA con i Punti Leggenda.'),
    ],
    lose: [L('sandro', 'Torna sulla tua spiaggia, ragazzo del porto.')],
  },
  {
    title: 'La promessa sulla spiaggia',
    place: 'Portobello, la stazione',
    objective: { kind: 'vinci' },
    minutes: 40,
    sky: 0x7ac8ff,
    teaches: ['mezzaluna', 'passoluna'],
    intro: [
      t('EPISODIO 4', 'LA PROMESSA SULLA SPIAGGIA'),
      n('Tre anni prima.', true),
      L('nicokid', 'Dario! Prometti che un giorno giocheremo insieme in un vero stadio!', true),
      L('dariokid', 'Promesso. Il tuo vento e la mia luna: insieme saremo imbattibili.', true),
      n('Oggi. Un ragazzo con i capelli d\'argento scende dal treno.'),
      L('dario', 'Nico! Te l\'avevo promesso. Sono tornato.'),
      L('nico', 'Dario Luna! Ti ricordi ancora il nostro uno-due?'),
      L('dario', 'Come dimenticarlo? La DOPPIA MEZZALUNA: io giro a destra, tu a sinistra, e nessuno capisce più dov\'è il pallone.'),
      n('NUOVA COMBO: DOPPIA MEZZALUNA (Nico + Dario). NUOVA TECNICA: PASSAGGIO LUNA.'),
      L('bea', 'Semifinale contro l\'Accademia Saline. Il loro Ivo Brina dribbla come un\'onda!'),
    ],
    script: [
      { when: 'start', lines: [L('dario', 'Nico, quando un difensore ti chiude, chiamami: la mezzaluna non la ferma nessuno.')] },
      { when: 'goalFor', lines: [L('dario', 'Come ai vecchi tempi!')] },
    ],
    win: [
      L('bea', 'Siamo in finale! E indovinate contro chi...'),
      L('nico', 'Sandro Fulmine.'),
      L('maestro', 'Allenati, Nico. In finale ti servirà un tiro che non conosce distanza.'),
    ],
    lose: [L('dario', 'Non preoccuparti. Una promessa non scade.')],
  },
  {
    title: 'Tuono contro Vento',
    place: 'Finale del campionato regionale',
    objective: { kind: 'vinci' },
    minutes: 45,
    sky: 0xff9a5a,
    intro: [
      t('EPISODIO 5', 'TUONO CONTRO VENTO'),
      n('Finale del campionato regionale. Sugli spalti c\'è tutta Portobello.'),
      L('sandro', 'Ho un nuovo portiere: Raffo Nero. Lo chiamano il Gatto Nero.'),
      L('raffo', 'Non lascio passare neanche l\'aria. Ti mangio il pallone, Vento.'),
      L('maestro', 'Nico. Il campo è lungo, ma un tiro vero non conosce distanza.'),
      L('nico', 'Un tiro... che attraversa tutto il campo?'),
      L('maestro', 'Il BOLIDE COMETA. Quando avrai abbastanza Punti Leggenda, imparalo. E ricorda: ogni parata speciale stanca il portiere.'),
    ],
    script: [
      { when: 'rivalTech', arg: 'gattonero', lines: [L('raffo', 'Miao. Troppo facile.'), L('dario', 'Ogni volta che para così perde energia. Continuiamo a tirare!')] },
      { when: 'half', lines: [L('maestro', 'Il Gatto Nero è stanco: guarda la sua barra dell\'energia. Adesso!')] },
    ],
    win: [
      L('sandro', 'Hai vinto tu. Ma ho sentito una voce: la Nazionale vuole tutti e due.'),
      n('IL PORTOBELLO FC È CAMPIONE REGIONALE!'),
      L('maestro', 'È ora che tu veda il mondo, Nico.'),
    ],
    lose: [L('raffo', 'Il gatto ha sette vite. Tu no.')],
  },
  {
    title: 'La convocazione',
    place: 'Mondiali giovanili, girone',
    objective: { kind: 'vinci' },
    minutes: 45,
    sky: 0x7ac8ff,
    teaches: ['tuono'],
    intro: [
      t('EPISODIO 6', 'LA CONVOCAZIONE'),
      n('La lettera arriva un martedì: convocati in Nazionale Under 15 per i Mondiali giovanili!'),
      L('sandro', 'Compagni di squadra, Vento. Ma il numero 10 te lo devi guadagnare.'),
      L('nico', 'Allora giochiamo per vincere. Insieme!'),
      L('maestro', 'Indovinate chi è il nuovo allenatore della Nazionale.'),
      L('nico', 'MAESTRO?!'),
      L('maestro', 'Ho le mie ragioni. Primo avversario: il Messico. Il tiro di Paco Herrera curva come un serpente.'),
      n('Sandro Fulmine gioca con te: il TIRO TUONO è della tua squadra!'),
    ],
    script: [
      { when: 'rivalTech', arg: 'serpente', lines: [L('tommaso', 'Ha cambiato direzione tre volte in aria!')] },
      { when: 'goalFor', lines: [L('sandro', 'Non male, Vento. Ma il prossimo lo segno io.')] },
    ],
    win: [
      L('paco', 'Bravi, italiani. Ma il prossimo avversario è l\'Olanda... e lì c\'è la Diga.'),
      L('nico', 'La Diga?'),
    ],
    lose: [L('maestro', 'Al Mondiale non si perdona niente. Di nuovo.')],
  },
  {
    title: 'La Diga',
    place: 'Mondiali giovanili, seconda partita',
    objective: { kind: 'vinci' },
    minutes: 50,
    sky: 0x9ab8e0,
    intro: [
      t('EPISODIO 7', 'LA DIGA'),
      L('bram', 'Io sono Bram Diga. Il mare non passa la diga. Il pallone neanche.'),
      L('dario', 'Nico, è enorme... e ha energia da vendere.'),
      L('nico', 'Allora lo stanchiamo. Tanti tiri, e quando cede... il colpo finale!'),
      L('maestro', 'Ogni muro ha una crepa. E una combo vale più di un tiro solo.'),
    ],
    script: [
      { when: 'rivalTech', arg: 'diga', lines: [L('telecronista', 'Che parata! Sembra che la porta si sia chiusa da sola!')] },
      { when: 'late', arg: 55, lines: [L('bram', 'Ah... ah... le mie braccia...'), L('dario', 'Si sta stancando! Adesso, Nico!')] },
    ],
    win: [
      L('bram', 'La diga... si è rotta. Andate avanti, italiani.'),
      n('Quarti di finale conquistati. Ma quella notte, in allenamento...'),
    ],
    lose: [L('bram', 'Il mare non passa. Te l\'avevo detto.')],
  },
  {
    title: 'La ferita',
    place: 'Mondiali giovanili, quarti di finale',
    objective: { kind: 'vinci' },
    minutes: 50,
    sky: 0xd08a6a,
    injured: { nico: 0.6 },
    intro: [
      t('EPISODIO 8', 'LA FERITA'),
      n('La notte prima dei quarti, in allenamento, Nico cade male. La caviglia si gonfia.'),
      L('bea', 'Nico! Il medico dice che non dovresti giocare!'),
      L('nico', 'Non posso fermarmi proprio adesso.'),
      L('papa', 'Quando il mare è grosso, il marinaio non lascia la barca. Stringe i denti e rema.', true),
      L('maestro', 'Anch\'io ho giocato con una gamba ferita, una volta. Poi non ho giocato più. Risparmia le forze: usa i compagni.'),
      L('nico', 'Maestro... allora lei era...'),
      L('maestro', 'Un\'altra volta. Adesso c\'è l\'Argentina. E Nacho Ferreyra balla il tango col pallone.'),
      n('INFORTUNIO: Nico ha meno energia. Passa la palla e usa le combo!'),
    ],
    script: [
      { when: 'half', lines: [L('nico', 'La caviglia... brucia...'), L('sandro', 'Lascia fare a me per un po\', Vento. Il tuono ti copre le spalle!')] },
      { when: 'rivalTech', arg: 'tango', lines: [L('gigi', 'Ma dov\'è finito?! Ha ballato intorno a me!')] },
    ],
    win: [
      L('nacho', 'Con una caviglia sola mi hai battuto. Rispetto, amico.'),
      n('Semifinale! Ma la caviglia di Nico ha bisogno di riposo...'),
    ],
    lose: [L('maestro', 'Non arrenderti. Fidati dei compagni.')],
  },
  {
    title: 'Il gelo del Nord',
    place: 'Mondiali giovanili, semifinale',
    objective: { kind: 'vinci' },
    minutes: 55,
    sky: 0xc8d8e8,
    snow: true,
    intro: [
      t('EPISODIO 9', 'IL GELO DEL NORD'),
      n('Semifinale. Sullo stadio nevica.'),
      L('erik', 'Noi siamo i gemelli Lund.'),
      L('even', 'Due corpi, un solo tiro: la VALANGA GEMELLA.'),
      L('dario', 'Anche noi siamo in due, Nico. Ricordi la promessa?'),
      L('maestro', 'Il vostro legame è la vostra arma. Il TIRO ECLISSI: due piedi, un solo colpo.'),
      L('tommaso', 'Valanga o no, questa porta resta chiusa.'),
    ],
    script: [
      { when: 'rivalTech', arg: 'valanga', lines: [L('telecronista', 'I due gemelli calciano insieme! È una valanga!')] },
      { when: 'goalFor', lines: [L('dario', 'Nico, siamo a un passo dalla finale!')] },
    ],
    win: [
      L('erik', 'Finale meritata, italiani.'),
      n('Domani la finale del Mondiale giovanile. Contro il Brasile di Rafa Lima, il ragazzo che danza col pallone.'),
      L('maestro', 'Nico, stanotte ti racconterò una storia.'),
    ],
    lose: [L('even', 'La neve copre tutto. Anche i sogni.')],
  },
  {
    title: 'L\'alba della leggenda',
    place: 'Finale dei Mondiali giovanili',
    objective: { kind: 'vinci' },
    minutes: 60,
    sky: 0xffc07a,
    intro: [
      t('EPISODIO 10', 'L\'ALBA DELLA LEGGENDA'),
      n('Vent\'anni fa, una finale. Il numero 10 più forte d\'Italia si accascia a terra. Il ginocchio ha ceduto.', true),
      L('maestrogiovane', 'Non adesso... non proprio adesso...', true),
      L('maestro', 'Quel numero 10 ero io, Corrado Nebbia. Non ho mai finito quella partita.'),
      L('nico', 'Maestro... allora la finiamo insieme. Oggi.'),
      L('rafa', 'Ehi, Vento! Il campo è grande, ma io ci ballo sopra. Vediamo chi arriva prima in porta.'),
      L('nico', 'Il campo può essere lungo quanto vuoi. Io arrivo in fondo!'),
    ],
    script: [
      { when: 'rivalTech', arg: 'colibri', lines: [L('telecronista', 'Rafa Lima vola sul campo come un colibrì!')] },
      {
        when: 'late',
        arg: 50,
        unlock: 'aurora',
        refill: 'nico',
        lines: [
          L('maestro', 'Nico! Il gabbiano sale, la cometa attraversa il cielo... e poi arriva l\'alba. Metti tutto in un solo tiro!'),
          L('nico', 'Il... TIRO DELL\'AURORA!'),
          n('NUOVA TECNICA: TIRO DELL\'AURORA! L\'energia di Nico torna al massimo.'),
        ],
      },
    ],
    win: [
      L('rafa', 'Che tiro... sembrava il sole che sorge. Complimenti, campione.'),
      n('L\'ITALIA È CAMPIONE DEL MONDO GIOVANILE!'),
      L('maestro', 'Adesso la mia partita è finita davvero. Grazie, Nico.'),
      L('nico', 'È solo l\'inizio, Maestro. Il prossimo sogno sono i Mondiali dei grandi!'),
      t('FINE', 'LA LEGGENDA CONTINUA'),
    ],
    lose: [L('rafa', 'Ancora un ballo, Vento?')],
  },
];

/** Commenti mentre si corre sul campo lunghissimo. */
export const RUN_LINES = {
  start: ['{n} parte palla al piede!', 'Il campo davanti a {n} sembra non finire mai!', '{n} scatta: la porta è lontanissima!'],
  mid: ['Ancora {d} metri alla porta!', 'Corre, corre... il campo è infinito!', 'Il pubblico trattiene il fiato!', 'Quanti metri ancora? {d}!'],
  near: ['È al limite dell\'area!', '{n} è davanti al portiere!', 'Ora o mai più!'],
  longShot: ['Da lì?! Non può tirare da così lontano!', 'Tira da {d} metri! È una follia!', 'Il pallone attraversa tutto il campo!'],
  mateCheer: ['Vai {n}! Non fermarti!', 'Forza {n}!', 'Sei il migliore, {n}!'],
  rivalTaunt: ['Non passerai!', 'Fermati lì!', 'Il pallone è mio!', 'Qui non si passa!'],
};
