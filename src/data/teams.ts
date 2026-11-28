import type { PlayerDef, PlayerStats, Role, TeamDef } from '../sim/types';
import { Rng } from '../sim/math';

const NOMI = [
  'Rossi', 'Esposito', 'Bianchi', 'Ferri', 'Greco', 'Conte', 'Marino', 'Gallo', 'Costa', 'Fontana',
  'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Caruso', 'Ricci', 'Leone', 'Serra', 'Villa', 'Testa',
  'Fabbri', 'Mancini', 'De Luca', 'Romano', 'Santoro', 'Martini', 'Longo', 'Gentile', 'Pace', 'Vitale',
  'Orlando', 'Sala', 'Galli', 'Riva', 'Neri', 'Bruno', 'Grasso', 'Monti', 'Parisi', 'Fiore',
];

const ROLES: Role[] = ['GK', 'DEF', 'MID', 'MID', 'FWD'];

function makeStats(rng: Rng, role: Role, level: number): PlayerStats {
  const r = () => rng.range(-0.06, 0.06);
  const b = 0.72 + level * 0.07;
  const s: PlayerStats = {
    speed: b + r(),
    shot: b + r(),
    pass: b + r(),
    tackle: b + r(),
    control: b + r(),
    keeping: b + r(),
  };
  if (role === 'FWD') {
    s.shot += 0.08;
    s.speed += 0.04;
  } else if (role === 'DEF') {
    s.tackle += 0.08;
  } else if (role === 'MID') {
    s.pass += 0.06;
    s.control += 0.04;
  } else {
    s.keeping += 0.1;
  }
  return s;
}

const NUMBERS = [1, 3, 6, 8, 9];

export function makePlayers(seed: number, level: number): PlayerDef[] {
  const rng = new Rng(seed);
  const used = new Set<string>();
  return ROLES.map((role, i) => {
    let name = rng.pick(NOMI);
    while (used.has(name)) name = rng.pick(NOMI);
    used.add(name);
    return {
      name,
      number: NUMBERS[i],
      role,
      stats: makeStats(rng, role, level),
      look: { skin: Math.floor(rng.next() * 5), hair: Math.floor(rng.next() * 6), hairStyle: Math.floor(rng.next() * 4) },
    };
  });
}

export interface TeamSeed {
  id: string;
  name: string;
  short: string;
  colors: TeamDef['colors'];
  pattern: TeamDef['pattern'];
  stars: number;
}

const SEEDS: TeamSeed[] = [
  { id: 'rondini', name: 'Rondini FC', short: 'RON', colors: { shirt: 0x1d3f8f, shirt2: 0xf2f2f2, shorts: 0xf2f2f2, socks: 0x1d3f8f, gk: 0xf5c400 }, pattern: 'sash', stars: 4 },
  { id: 'lupi', name: 'Lupi Rossi', short: 'LUP', colors: { shirt: 0xc8202a, shirt2: 0x8a1018, shorts: 0x1a1a1a, socks: 0xc8202a, gk: 0x2fbf5a }, pattern: 'plain', stars: 4 },
  { id: 'gabbiani', name: 'Gabbiani', short: 'GAB', colors: { shirt: 0xf2f2f2, shirt2: 0x2a9fd6, shorts: 0x2a9fd6, socks: 0xf2f2f2, gk: 0xff7a1a }, pattern: 'hoops', stars: 3 },
  { id: 'vulcani', name: 'Vulcani', short: 'VUL', colors: { shirt: 0xff6a00, shirt2: 0x2b2b2b, shorts: 0x2b2b2b, socks: 0xff6a00, gk: 0x7d5cff }, pattern: 'half', stars: 3 },
  { id: 'draghi', name: 'Draghi Verdi', short: 'DRA', colors: { shirt: 0x1f9e4a, shirt2: 0xf5d13b, shorts: 0xf5d13b, socks: 0x1f9e4a, gk: 0xe0457b }, pattern: 'stripes', stars: 5 },
  { id: 'pirati', name: 'Pirati del Porto', short: 'PIR', colors: { shirt: 0x202020, shirt2: 0xe8e8e8, shorts: 0x202020, socks: 0x202020, gk: 0x29c7c7 }, pattern: 'stripes', stars: 3 },
  { id: 'tigri', name: 'Tigri Gialle', short: 'TIG', colors: { shirt: 0xf5c400, shirt2: 0x202020, shorts: 0x202020, socks: 0xf5c400, gk: 0x3a7bff }, pattern: 'hoops', stars: 4 },
  { id: 'aquile', name: 'Aquile Viola', short: 'AQU', colors: { shirt: 0x6a2bbf, shirt2: 0xf2f2f2, shorts: 0xf2f2f2, socks: 0x6a2bbf, gk: 0x9bd12a }, pattern: 'plain', stars: 2 },
];

const k = (shirt: number, shirt2: number, shorts: number, socks: number, gk: number) => ({ shirt, shirt2, shorts, socks, gk });

/**
 * Squadre "leggendarie" ispirate ai club famosi: soprannomi e colori che li
 * ricordano, ma nomi, stemmi e maglie sono di fantasia (nessun marchio reale).
 */
export const FAMOUS_IT: TeamSeed[] = [
  { id: 'zebre', name: 'Zebre Torinesi', short: 'ZEB', colors: k(0xf2f2f2, 0x1a1a1a, 0xf2f2f2, 0xf2f2f2, 0xf5c400), pattern: 'stripes', stars: 5 },
  { id: 'diavoli', name: 'Diavoli Rossoneri', short: 'DIA', colors: k(0xc8202a, 0x1a1a1a, 0xf2f2f2, 0x1a1a1a, 0x2fbf5a), pattern: 'stripes', stars: 5 },
  { id: 'biscioni', name: 'Biscioni Nerazzurri', short: 'BIS', colors: k(0x1d3f8f, 0x1a1a1a, 0x1a1a1a, 0x1a1a1a, 0xff7a1a), pattern: 'stripes', stars: 5 },
  { id: 'ciucci', name: 'Ciucci Azzurri', short: 'CIU', colors: k(0x3a9ae0, 0xf2f2f2, 0xf2f2f2, 0x3a9ae0, 0x9bd12a), pattern: 'plain', stars: 5 },
  { id: 'lupacchiotti', name: 'Lupacchiotti Giallorossi', short: 'GRS', colors: k(0x8a1a24, 0xf5b400, 0xf2f2f2, 0x1a1a1a, 0x3fd0ff), pattern: 'sash', stars: 4 },
  { id: 'aquilotti', name: 'Aquilotti Biancocelesti', short: 'ABC', colors: k(0x8fd0f5, 0xf2f2f2, 0xf2f2f2, 0x8fd0f5, 0xe0457b), pattern: 'plain', stars: 4 },
  { id: 'dea', name: 'Dea Orobica', short: 'DEA', colors: k(0x1a1a1a, 0x2a6fe0, 0x1a1a1a, 0x1a1a1a, 0xf5c400), pattern: 'stripes', stars: 4 },
];

/** Club di provincia ispirati alla tradizione (nomi di fantasia). */
export const FAMOUS_PROV: TeamSeed[] = [
  { id: 'gigli', name: 'Gigli Viola', short: 'GIG', colors: k(0x5a2a9a, 0xf2f2f2, 0xf2f2f2, 0x5a2a9a, 0xf5c400), pattern: 'plain', stars: 3 },
  { id: 'grifoni', name: 'Grifoni Rossoblù', short: 'GRI', colors: k(0xa81c2a, 0x1d2f6f, 0xf2f2f2, 0x1a1a1a, 0x9bd12a), pattern: 'half', stars: 3 },
  { id: 'torelli', name: 'Torelli Granata', short: 'TOR', colors: k(0x7a1a24, 0xf2f2f2, 0xf2f2f2, 0x7a1a24, 0x3fd0ff), pattern: 'plain', stars: 3 },
  { id: 'felsinei', name: 'Felsinei Rossoblù', short: 'FEL', colors: k(0x1d2f6f, 0xc8202a, 0xf2f2f2, 0x1d2f6f, 0xf5c400), pattern: 'stripes', stars: 3 },
  { id: 'blucerchiati', name: 'Blucerchiati della Lanterna', short: 'BLU', colors: k(0x1d4fae, 0xf2f2f2, 0xf2f2f2, 0x1d4fae, 0xff7a1a), pattern: 'hoops', stars: 3 },
  { id: 'scaligeri', name: 'Scaligeri Gialloblù', short: 'SCA', colors: k(0x1d3f8f, 0xf5c400, 0x1d3f8f, 0xf5c400, 0xe04040), pattern: 'half', stars: 3 },
  { id: 'gialloverdi', name: 'Canarini Gialloverdi', short: 'CAN', colors: k(0xf5d13b, 0x1f9e4a, 0x1f9e4a, 0xf5d13b, 0x7d5cff), pattern: 'sash', stars: 2 },
];

/** Grandi d'Europa (di fantasia) per la Coppa d'Europa Pixel. */
export const FAMOUS_EU: TeamSeed[] = [
  { id: 'merengues', name: 'Merengues Blancos', short: 'BLA', colors: k(0xf5f5f5, 0xd4af37, 0xf5f5f5, 0xf5f5f5, 0x2fbf5a), pattern: 'plain', stars: 5 },
  { id: 'blaugrana', name: 'Blaugrana Catalani', short: 'BLG', colors: k(0x1d3f8f, 0xa01c3a, 0x1d3f8f, 0x1d3f8f, 0xf5c400), pattern: 'stripes', stars: 5 },
  { id: 'bavaresi', name: 'Bavaresi Rossi', short: 'BAV', colors: k(0xd8202a, 0xf2f2f2, 0xd8202a, 0xd8202a, 0x1a1a1a), pattern: 'plain', stars: 5 },
  { id: 'celesti', name: 'Celesti di Manchester', short: 'CEL', colors: k(0x7cc0ee, 0xf2f2f2, 0xf2f2f2, 0x7cc0ee, 0xf5c400), pattern: 'plain', stars: 5 },
  { id: 'diavolirossi', name: 'Diavoli Rossi del Nord', short: 'DRN', colors: k(0xd8202a, 0x1a1a1a, 0xf2f2f2, 0x1a1a1a, 0x2fbf5a), pattern: 'plain', stars: 4 },
  { id: 'mersey', name: 'Rossi della Mersey', short: 'RSM', colors: k(0xb81c2a, 0xf5c400, 0xb81c2a, 0xb81c2a, 0x7d5cff), pattern: 'plain', stars: 5 },
  { id: 'principi', name: 'Principi di Parigi', short: 'PAR', colors: k(0x14204a, 0xd8202a, 0x14204a, 0x14204a, 0xf5c400), pattern: 'sash', stars: 5 },
  { id: 'gialloneri', name: 'Gialloneri della Ruhr', short: 'RUH', colors: k(0xf5d10a, 0x1a1a1a, 0x1a1a1a, 0xf5d10a, 0x3a7bff), pattern: 'plain', stars: 4 },
  { id: 'lancieri', name: 'Lancieri di Amsterdam', short: 'LAN', colors: k(0xf2f2f2, 0xc8202a, 0xf2f2f2, 0xf2f2f2, 0x1a1a1a), pattern: 'half', stars: 4 },
  { id: 'colchoneros', name: 'Materassai di Madrid', short: 'MAT', colors: k(0xc8202a, 0xf2f2f2, 0x1d3f8f, 0xc8202a, 0x2fbf5a), pattern: 'stripes', stars: 4 },
  { id: 'cannonieri', name: 'Cannonieri di Londra', short: 'LON', colors: k(0xd8202a, 0xf2f2f2, 0xf2f2f2, 0xd8202a, 0xf5c400), pattern: 'half', stars: 4 },
  { id: 'aquile_lisbona', name: 'Aquile di Lisbona', short: 'LIS', colors: k(0xc8202a, 0xf2f2f2, 0xf2f2f2, 0xc8202a, 0x3a7bff), pattern: 'plain', stars: 4 },
];

/** Le squadre selezionabili: le classiche del gioco più le "leggende" italiane ed europee. */
const ALL_SEEDS: TeamSeed[] = [...SEEDS, ...FAMOUS_IT, ...FAMOUS_EU.slice(0, 8)];

export const TEAMS: TeamDef[] = ALL_SEEDS.map((s, i) => ({
  ...s,
  players: makePlayers(1000 + i * 77, s.stars),
}));

export function teamById(id: string): TeamDef {
  return TEAMS.find((t) => t.id === id) ?? TEAMS[0];
}

/** Restituisce true se le maglie si somigliano troppo (serve per scegliere la divisa da trasferta). */
export function colorsClash(a: number, b: number): boolean {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
  const db = (a & 255) - (b & 255);
  return Math.sqrt(dr * dr + dg * dg + db * db) < 120;
}

/** Divisa da trasferta: inverte maglia e colore secondario. */
export function awayKit(t: TeamDef): TeamDef {
  return {
    ...t,
    colors: { ...t.colors, shirt: t.colors.shirt2, shirt2: t.colors.shirt, shorts: t.colors.shirt, socks: t.colors.shirt2 },
  };
}

/** Crea una squadra (usata da storia e missioni) a partire da colori e forza. */
export function makeTeam(s: TeamSeed, seed: number): TeamDef {
  return { ...s, players: makePlayers(seed, s.stars) };
}

/** Formato dell'11 contro 11: ordine in rosa 0 portiere, 1-4 difensori, 5-8 centrocampisti, 9-10 attaccanti. */
const BIG_ROLES: Role[] = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'];
const BIG_NUMBERS = [1, 2, 3, 4, 5, 6, 8, 7, 10, 9, 11];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Porta una squadra da 5 a 11 giocatori: i cinque titolari restano (con le loro statistiche,
 * abilità e crescita) e gli altri sei nascono dalla forza (stelle) della squadra.
 */
export function expandTeam(team: TeamDef): TeamDef {
  if (team.players.length >= 11) return team;
  const rng = new Rng(hashStr(team.id) + 77);
  const pool = new Map<Role, PlayerDef[]>();
  for (const p of team.players) pool.set(p.role, [...(pool.get(p.role) ?? []), p]);
  const used = new Set(team.players.map((p) => p.name));
  const core: number[] = [];
  const players = BIG_ROLES.map((role, i) => {
    const mine = pool.get(role);
    const base = mine?.shift();
    core.push(base ? team.players.indexOf(base) : -1);
    if (base) return { ...base, number: BIG_NUMBERS[i] };
    let name = rng.pick(NOMI);
    for (let g = 0; used.has(name) && g < 40; g++) name = rng.pick(NOMI);
    used.add(name);
    return {
      name,
      number: BIG_NUMBERS[i],
      role,
      stats: makeStats(rng, role, Math.max(1, team.stars)),
      look: { skin: Math.floor(rng.next() * 5), hair: Math.floor(rng.next() * 6), hairStyle: Math.floor(rng.next() * 4) },
    };
  });
  return { ...team, players, core };
}
