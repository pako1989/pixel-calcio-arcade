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

function makePlayers(seed: number, level: number): PlayerDef[] {
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

interface TeamSeed {
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

export const TEAMS: TeamDef[] = SEEDS.map((s, i) => ({
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
