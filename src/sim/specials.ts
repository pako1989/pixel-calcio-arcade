import type { Player } from './entities';
import type { MatchSim } from './match';
import { clamp, dist, len } from './math';
import type { Role } from './types';

/**
 * Supermosse stile anime. Ogni giocatore ha una barra di energia personale (0..1) che si
 * ricarica con passaggi, contrasti e dribbling. A barra piena il tasto SUPER scatena la mossa
 * del suo ruolo; le mosse più forti si sbloccano con la crescita (livelli o stelle della squadra).
 */

export type SpecialId = 'fulmine' | 'cometa' | 'gemello' | 'arcobaleno' | 'tornado' | 'muro' | 'tsunami' | 'pietra';

export interface SpecialDef {
  id: SpecialId;
  name: string;
  /** Nome corto per il tasto. */
  short: string;
  desc: string;
  color: number;
  role: Role;
}

export const SPECIALS: Record<SpecialId, SpecialDef> = {
  fulmine: { id: 'fulmine', name: 'TIRO FULMINE', short: 'FULMINE', desc: 'Tiro a zigzag velocissimo: il portiere non lo legge.', color: 0xffe03a, role: 'FWD' },
  cometa: { id: 'cometa', name: 'TIRO COMETA', short: 'COMETA', desc: 'Sale altissimo e precipita sotto la traversa: perfetto da lontano.', color: 0xff8a3a, role: 'FWD' },
  gemello: { id: 'gemello', name: 'TIRO GEMELLO', short: 'GEMELLO', desc: 'Il pallone si sdoppia: da vicino il portiere va in confusione.', color: 0xb06aff, role: 'FWD' },
  arcobaleno: { id: 'arcobaleno', name: 'PASSAGGIO ARCOBALENO', short: 'ARCOBAL.', desc: 'Lancio altissimo e preciso al compagno più avanzato. Poi tiro combinato!', color: 0xff5aa8, role: 'MID' },
  tornado: { id: 'tornado', name: 'DRIBBLING TORNADO', short: 'TORNADO', desc: 'Scatto travolgente: nessuno ti ruba palla e butti a terra chi tocchi.', color: 0x3fd0ff, role: 'MID' },
  muro: { id: 'muro', name: 'MURO D\'ACCIAIO', short: 'MURO', desc: 'Un muro chiude la porta per qualche secondo.', color: 0xc4c8d8, role: 'DEF' },
  tsunami: { id: 'tsunami', name: 'SCIVOLATA TSUNAMI', short: 'TSUNAMI', desc: 'Onda che spazza via chi ha palla e gli avversari vicini.', color: 0x3f8bff, role: 'DEF' },
  pietra: { id: 'pietra', name: 'MANO DI PIETRA', short: 'PIETRA', desc: 'Il portiere para da solo anche i tiri speciali (scatta in automatico).', color: 0x9ad04a, role: 'GK' },
};

/** Mosse per ruolo, nell'ordine di sblocco (livello di crescita 1, 3, 5 → tier 1, 2, 3). */
export const SPECIAL_TREE: Record<Role, SpecialId[]> = {
  FWD: ['fulmine', 'cometa', 'gemello'],
  MID: ['arcobaleno', 'tornado'],
  DEF: ['muro', 'tsunami'],
  GK: ['pietra'],
};

export function unlockedSpecials(role: Role, tier: number): SpecialId[] {
  return SPECIAL_TREE[role].slice(0, Math.max(1, tier));
}

/** Tier di base dalle stelle della squadra: 1–2 → 1, 3–4 → 2, 5 → 3. */
export function starTier(stars: number): 1 | 2 | 3 {
  return stars >= 5 ? 3 : stars >= 3 ? 2 : 1;
}

export function tierOf(sim: MatchSim, p: Player): number {
  const t = p.team === 0 ? sim.cfg.home : sim.cfg.away;
  return Math.max(p.def.specialTier ?? 0, starTier(t.stars ?? 1));
}

export function specialsOf(sim: MatchSim, p: Player): SpecialId[] {
  return unlockedSpecials(p.role, tierOf(sim, p));
}

const opp = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);

/** Quale mossa scatterebbe adesso (null = nessuna utile in questo momento). */
export function pickSpecial(sim: MatchSim, p: Player): SpecialId | null {
  if (p.isGK) return null;
  const list = specialsOf(sim, p);
  const b = sim.ball;
  const owns = b.owner === p;
  const team = p.team;
  if (p.role === 'FWD') {
    if (!owns) return null;
    const gx = sim.oppGoalX(team);
    const d = len(gx - p.x, sim.H / 2 - p.y);
    if (d > 250 && list.includes('cometa')) return 'cometa';
    if (d < 190 && list.includes('gemello')) return 'gemello';
    return 'fulmine';
  }
  if (p.role === 'MID') {
    if (!owns) return null;
    const near = nearestOpp(sim, p);
    if (list.includes('tornado') && near < 55) return 'tornado';
    return list.includes('arcobaleno') ? 'arcobaleno' : null;
  }
  // difensore
  const o = b.owner;
  if (list.includes('tsunami')) {
    if (o && o.team !== team && dist(p, o) < 80) return 'tsunami';
    if (!o && dist(p, b) < 60 && b.z < 14) return 'tsunami';
  }
  if (list.includes('muro') && !sim.teamHasBall(team)) return 'muro';
  return null;
}

function nearestOpp(sim: MatchSim, p: Player): number {
  let best = Infinity;
  for (const o of sim.teams[opp(p.team)]) {
    if (o.isGK || o.out > 0) continue;
    best = Math.min(best, dist(p, o));
  }
  return best;
}

function announce(sim: MatchSim, p: Player, id: SpecialId) {
  const d = SPECIALS[id];
  sim.events.push({ type: 'special', id, name: d.name, team: p.team, idx: p.idx, pid: p.id, who: p.def.name, x: p.x, y: p.y, color: d.color });
  p.energy = 0;
  sim.specialsUsed[p.team]++;
}

/** Scatena la supermossa del giocatore. Restituisce false se non può (energia, fase, nessuna mossa utile). */
export function useSpecial(sim: MatchSim, p: Player): boolean {
  if (!sim.specialsOn || p.energy < 1 || !p.canAct || sim.phase !== 'play') return false;
  const id = pickSpecial(sim, p);
  if (!id) return false;
  switch (id) {
    case 'fulmine':
    case 'cometa':
    case 'gemello':
      specialShot(sim, p, id);
      break;
    case 'arcobaleno':
      if (!rainbowPass(sim, p)) return false;
      break;
    case 'tornado':
      p.spT = 0.95;
      p.spKind = 'tornado';
      p.comboT = 3;
      break;
    case 'tsunami':
      tsunami(sim, p);
      break;
    case 'muro':
      sim.wall[p.team] = Math.max(sim.wall[p.team], 6);
      break;
    default:
      return false;
  }
  announce(sim, p, id);
  return true;
}

/** Il portiere con energia piena para da solo un tiro pericoloso. */
export function tryStoneHand(sim: MatchSim, gk: Player): boolean {
  if (!sim.specialsOn || gk.energy < 1) return false;
  announce(sim, gk, 'pietra');
  return true;
}

function specialShot(sim: MatchSim, p: Player, id: 'fulmine' | 'cometa' | 'gemello') {
  const b = sim.ball;
  const team = p.team;
  const gx = sim.oppGoalX(team);
  const gy = sim.H / 2;
  const gk = sim.teams[opp(team)].find((q) => q.isGK);
  const half = sim.pitch.goalWidth / 2 - 9;
  // il fulmine mira al centro (lo zigzag fa il resto), gli altri all'angolo lontano dal portiere
  const ty = id === 'fulmine' ? gy : gk && gk.y < gy ? gy + half * 0.75 : gy - half * 0.75;
  const d = len(gx - p.x, ty - p.y);
  const dir = Math.atan2(ty - p.y, gx - p.x);
  const st = p.def.stats.shot;
  let speed: number;
  let vz: number;
  if (id === 'cometa') {
    const T = clamp(d / 520, 0.55, 0.9);
    vz = (12 + 260 * T * T) / T;
    speed = (d / T) * 1.07;
  } else if (id === 'gemello') {
    speed = 600 * (0.9 + st * 0.15);
    vz = 28;
  } else {
    speed = 580 * (0.9 + st * 0.15);
    vz = 22;
  }
  const combo = p.comboT > 0;
  if (combo) {
    speed *= 1.18;
    p.comboT = 0;
    sim.events.push({ type: 'combo', team, idx: p.idx, x: p.x, y: p.y });
  }
  sim.kickBall(p, dir, speed, vz, 0);
  b.shotFrom = { x: p.x, y: p.y };
  b.isShot = true;
  b.superShot = true;
  b.fire = false;
  b.special = { id, t: 0 };
  p.kickCd = 0.5;
  sim.stats.shots[team]++;
  sim.events.push({ type: 'shot', x: p.x, y: p.y, power: 1, team, superShot: true, fire: false, idx: p.idx, special: id });
}

function rainbowPass(sim: MatchSim, p: Player): boolean {
  const team = p.team;
  let best: Player | null = null;
  let bestScore = -Infinity;
  const mine = sim.toTeamX(team, p.x);
  for (const q of sim.teams[team]) {
    if (q === p || q.isGK || q.out > 0) continue;
    const prog = sim.toTeamX(team, q.x);
    const score = prog - (dist(p, q) < 60 ? 0.3 : 0) - (prog < mine - 0.05 ? 0.4 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  if (!best) return false;
  const tx = best.x + best.vx * 0.5;
  const ty = best.y + best.vy * 0.5;
  const dd = len(tx - p.x, ty - p.y);
  const T = clamp(Math.max(dd / 430, 0.55), 0.55, 1.05);
  const dir = Math.atan2(ty - p.y, tx - p.x);
  sim.kickBall(p, dir, (dd / T) * 1.04, 260 * T, 0);
  const b = sim.ball;
  b.passTarget = best;
  b.special = { id: 'arcobaleno', t: 0 };
  best.comboT = 3;
  sim.stats.passes[team]++;
  sim.events.push({ type: 'pass', x: p.x, y: p.y, team, idx: p.idx });
  return true;
}

function tsunami(sim: MatchSim, p: Player) {
  const b = sim.ball;
  const team = p.team;
  p.spT = 0.55;
  p.spKind = 'tsunami';
  p.setState('stun', 0);
  p.stateT = -0.15;
  for (const o of sim.teams[opp(team)]) {
    if (o.isGK || o.out > 0 || dist(o, p) > 70) continue;
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    const dl = len(dx, dy) || 1;
    o.setState('stun', 0);
    o.vx = (dx / dl) * 230;
    o.vy = (dy / dl) * 230;
    o.pickupCd = Math.max(o.pickupCd, 0.7);
  }
  const owner = b.owner;
  if (owner && owner.team !== team && !(owner.isGK && sim.inOwnBox(owner.team, owner.x, owner.y))) {
    b.owner = p;
    b.lastTouch = p;
    b.passTarget = null;
    p.holdT = 0;
    owner.pickupCd = 0.9;
    if (sim.toTeamX(team, b.x) < 0.3) p.facing = sim.safeClearDir(team, p.x, p.y);
    sim.stats.tackles[team]++;
    sim.events.push({ type: 'tackle', x: b.x, y: b.y, won: true, team, idx: p.idx });
  } else if (!owner && b.z < 14 && dist(p, b) < 60) {
    b.owner = p;
    b.lastTouch = p;
    b.passTarget = null;
    b.isShot = false;
    b.fire = b.superShot = false;
    b.special = null;
    p.holdT = 0;
  }
}

/** Effetti continui delle mosse in corso (tornado, tsunami) e carica passiva. */
export function updateSpecials(sim: MatchSim, dt: number) {
  for (const p of sim.players) {
    if (p.comboT > 0) p.comboT -= dt;
    if (p.spT > 0) {
      p.spT -= dt;
      if (p.spKind === 'tornado' && p.out <= 0) {
        for (const o of sim.teams[opp(p.team)]) {
          if (o.isGK || o.out > 0 || o.state === 'stun' || dist(o, p) > 20) continue;
          const dx = o.x - p.x;
          const dy = o.y - p.y;
          const dl = len(dx, dy) || 1;
          o.setState('stun', 0);
          o.vx = (dx / dl) * 200;
          o.vy = (dy / dl) * 200;
          o.pickupCd = Math.max(o.pickupCd, 0.6);
          sim.events.push({ type: 'bounce', x: o.x, y: o.y, power: 90 });
        }
      }
      if (p.spT <= 0) {
        // la pietra dura finché il portiere non para un tiro; qui si spegne il resto
        p.spT = 0;
        p.spKind = '';
      }
    }
    if (sim.phase === 'play' && p.out <= 0) sim.addEnergy(p, dt * (p.isGK ? 0.012 : 0.008));
  }
}

/** Intelligenza della CPU: quando scatenare la propria supermossa. */
export function aiSpecial(sim: MatchSim, p: Player, dt: number): boolean {
  if (!sim.specialsOn || p.energy < 1 || p.isGK || !p.canAct || sim.phase !== 'play') return false;
  if (!sim.rng.chance(dt * 2.2 * sim.diff[p.team].decision)) return false;
  const id = pickSpecial(sim, p);
  if (!id) return false;
  const b = sim.ball;
  switch (id) {
    case 'fulmine':
    case 'cometa':
    case 'gemello': {
      const gx = sim.oppGoalX(p.team);
      const d = len(gx - p.x, sim.H / 2 - p.y);
      if (p.holdT < 0.1 || d > 340 || sim.toTeamX(p.team, p.x) < 0.55) return false;
      break;
    }
    case 'arcobaleno':
      if (p.holdT < 0.5 || sim.toTeamX(p.team, p.x) > 0.8) return false;
      break;
    case 'tornado':
      if (sim.toTeamX(p.team, p.x) < 0.3) return false;
      break;
    case 'muro':
      if (!b.owner || sim.toTeamX(p.team, b.x) > 0.4) return false;
      break;
    default:
      break;
  }
  return useSpecial(sim, p);
}
