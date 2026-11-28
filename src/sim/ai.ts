/**
 * IA della CPU. Idee riprese (non il codice) da "SimpleSoccer" di Mat Buckland:
 * la squadra è in attacco o in difesa, un giocatore insegue la palla, gli altri
 * cercano "punti di supporto" o marcano; prima di passare si controlla che la
 * linea di passaggio sia libera; il portiere si mette tra palla e porta.
 */
import type { Player } from './entities';
import type { MatchSim } from './match';
import { clamp, dist, distToSegment, len, norm, type Vec } from './math';
import type { FormationId } from './types';
import { aiSpecial } from './specials';

const FORMATIONS: Record<FormationId, Record<number, [number, number]>> = {
  '1-2-1': {
    1: [0.2, 0.5],
    2: [0.4, 0.26],
    3: [0.4, 0.74],
    4: [0.62, 0.5],
  },
  '1-1-2': {
    1: [0.24, 0.5],
    2: [0.45, 0.46],
    3: [0.66, 0.26],
    4: [0.7, 0.72],
  },
  '2-1-1': {
    1: [0.16, 0.34],
    2: [0.18, 0.66],
    3: [0.42, 0.5],
    4: [0.6, 0.5],
  },
};

const ROLE_X: Record<string, [number, number]> = {
  DEF: [0.08, 0.6],
  MID: [0.16, 0.85],
  FWD: [0.3, 0.92],
  GK: [0, 0.2],
};

export function homePos(sim: MatchSim, p: Player, attacking: boolean): Vec {
  const fId = (p.team === 0 ? sim.cfg.formation : sim.cfg.awayFormation) ?? '1-2-1';
  const [bx, by] = FORMATIONS[fId][p.idx] ?? [0.4, 0.5];
  const b = sim.ball;
  const bnx = sim.toTeamX(p.team, b.x);
  const bny = b.y / sim.H;
  // atteggiamento: la squadra "attacco" sale in blocco e pressa alta, "difesa" resta bassa
  const tac = sim.tactic[p.team];
  const shift = tac === 'attacco' ? 0.08 : tac === 'difesa' ? -0.09 : 0;
  let nx = bx + (bnx - 0.5) * 0.5 + (attacking ? 0.1 : -0.07) + (p.role === 'GK' ? 0 : shift);
  let [lo, hi] = ROLE_X[p.role] ?? [0.1, 0.9];
  if (fId === '1-1-2' && p.idx === 3) hi = Math.max(hi, 0.9);
  if (fId === '2-1-1' && p.idx === 2) lo = Math.min(lo, 0.1);
  nx = clamp(nx, lo, hi);
  const ny = clamp(by + (bny - 0.5) * 0.42, 0.08, 0.92);
  return { x: sim.fromTeamX(p.team, nx), y: ny * sim.H };
}

/** Posizione futura (approssimata) della palla libera dopo t secondi. */
export function predictBall(sim: MatchSim, t: number): Vec {
  const b = sim.ball;
  if (b.owner) return { x: b.x + b.vx * t, y: b.y + b.vy * t };
  const k = 0.95 * sim.pitch.ballFriction;
  const f = (1 - Math.exp(-k * t)) / k;
  return { x: clamp(b.x + b.vx * f, 0, sim.W), y: clamp(b.y + b.vy * f, 0, sim.H) };
}

/** Punto in cui il giocatore può raggiungere la palla, e in quanto tempo. */
export function interceptPoint(sim: MatchSim, p: Player): { pt: Vec; t: number } {
  const sp = sim.maxSpeed(p) * 0.95;
  for (let t = 0; t <= 2.4; t += 0.1) {
    const pt = predictBall(sim, t);
    if (dist(p, pt) <= sp * t + 8) return { pt, t };
  }
  const pt = predictBall(sim, 2.4);
  return { pt, t: 2.4 + dist(p, pt) / sp };
}

/** Il giocatore della squadra (escluso il portiere) che arriva prima sulla palla. */
export function chaserOf(sim: MatchSim, team: 0 | 1): Player | null {
  let best: Player | null = null;
  let bestT = Infinity;
  const b = sim.ball;
  for (const p of sim.teams[team]) {
    if (p.isGK || p.state === 'stun' || p.out > 0) continue;
    const t = b.owner ? dist(p, b) / sim.maxSpeed(p) : interceptPoint(sim, p).t;
    // chi è controllato dall'umano conta un po' di più: evita che l'IA gli "rubi" l'azione
    const tt = sim.isHuman(p) ? t * 0.8 : t;
    if (tt < bestT) {
      bestT = tt;
      best = p;
    }
  }
  return best;
}

export function isPassSafe(sim: MatchSim, from: Vec, to: Vec, team: 0 | 1): boolean {
  const opp = sim.teams[team === 0 ? 1 : 0];
  const L = dist(from, to);
  for (const o of opp) {
    const d = distToSegment(o, from, to);
    // gli avversari più lontani lungo la linea hanno più tempo per intercettare
    const along = clamp(((o.x - from.x) * (to.x - from.x) + (o.y - from.y) * (to.y - from.y)) / (L * L || 1), 0, 1);
    const margin = 12 + along * L * 0.12;
    if (d < margin) return false;
  }
  return true;
}

function nearestOpp(sim: MatchSim, pt: Vec, team: 0 | 1): { p: Player | null; d: number } {
  let best: Player | null = null;
  let bd = Infinity;
  for (const o of sim.teams[team === 0 ? 1 : 0]) {
    const d = dist(o, pt);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return { p: best, d: bd };
}

/** Valuta un compagno come destinatario di passaggio (più alto = meglio). */
function passScore(sim: MatchSim, from: Player, to: Player): number {
  if (to === from || to.out > 0) return -Infinity;
  const d = dist(from, to);
  if (d < 40 || d > 420) return -Infinity;
  if (!isPassSafe(sim, from, to, from.team)) return -Infinity;
  const progress = sim.toTeamX(from.team, to.x) - sim.toTeamX(from.team, from.x);
  const open = Math.min(1, nearestOpp(sim, to, from.team).d / 90);
  let s = progress * 2.2 + open * 0.9 - d / 900;
  if (to.isGK) s -= 1.2;
  // con un solo giocatore controllato, i compagni lo cercano più spesso
  if (sim.locked && sim.isHuman(to)) s += 0.35;
  return s;
}

export function bestPass(sim: MatchSim, p: Player): { target: Player; score: number } | null {
  let best: Player | null = null;
  let bs = -Infinity;
  for (const t of sim.teams[p.team]) {
    const s = passScore(sim, p, t);
    if (s > bs) {
      bs = s;
      best = t;
    }
  }
  return best ? { target: best, score: bs } : null;
}

/** Bersaglio del passaggio per il giocatore umano, nella direzione del joystick. */
export function chooseHumanPassTarget(sim: MatchSim, p: Player, dir: number): Player | null {
  let best: Player | null = null;
  let bs = -Infinity;
  const dx = Math.cos(dir);
  const dy = Math.sin(dir);
  for (const t of sim.teams[p.team]) {
    if (t === p || t.out > 0) continue;
    const d = dist(p, t);
    if (d < 20) continue;
    const c = ((t.x - p.x) * dx + (t.y - p.y) * dy) / d;
    if (c < 0.35) continue;
    let s = c * 2.4 - d / 450;
    if (!isPassSafe(sim, p, t, p.team)) s -= 0.5;
    if (t.isGK) s -= 1;
    if (s > bs) {
      bs = s;
      best = t;
    }
  }
  return best;
}

function supportSpot(sim: MatchSim, p: Player, carrier: Player): Vec {
  const home = homePos(sim, p, true);
  let best = home;
  let bs = -Infinity;
  const gx = sim.oppGoalX(p.team);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const pt = { x: clamp(home.x + i * 50, 20, sim.W - 20), y: clamp(home.y + j * 50, 20, sim.H - 20) };
      let s = sim.toTeamX(p.team, pt.x) * 1.2;
      s += Math.min(1, nearestOpp(sim, pt, p.team).d / 110) * 0.9;
      if (isPassSafe(sim, carrier, pt, p.team)) s += 1;
      const dc = dist(pt, carrier);
      if (dc < 70) s -= 0.8;
      if (dc > 330) s -= 0.6;
      if (len(gx - pt.x, sim.H / 2 - pt.y) < 230) s += 0.35;
      // non ammassarsi con i compagni
      for (const m of sim.teams[p.team]) {
        if (m !== p && m !== carrier && dist(m, pt) < 55) s -= 0.5;
      }
      s += sim.rng.range(0, 0.15);
      if (s > bs) {
        bs = s;
        best = pt;
      }
    }
  }
  return best;
}

/** Decisioni "lente" (a intervalli che dipendono dalla difficoltà). */
export function aiThink(sim: MatchSim, p: Player) {
  const b = sim.ball;
  const team = p.team;
  const opp = team === 0 ? 1 : 0;
  p.wantSprint = false;
  if (b.owner === p) {
    carrierThink(sim, p);
    return;
  }
  const hasBall = sim.teamHasBall(team);
  const oppBall = sim.teamHasBall(opp);
  if (hasBall) {
    const carrier = b.owner!;
    const s = supportSpot(sim, p, carrier);
    p.tx = s.x;
    p.ty = s.y;
    p.wantSprint = dist(p, s) > 120 && p.stamina > 0.5;
    return;
  }
  // passaggio in arrivo per me: vado incontro alla palla
  if (b.passTarget === p) {
    const ip = interceptPoint(sim, p);
    p.tx = ip.pt.x;
    p.ty = ip.pt.y;
    return;
  }
  const chaser = chaserOf(sim, team);
  if (chaser === p) {
    if (oppBall) {
      const o = b.owner!;
      // pressa stando tra l'avversario e la propria porta
      const gx = sim.ownGoalX(team);
      const n = norm(gx - o.x, sim.H / 2 - o.y);
      p.tx = o.x + o.vx * 0.25 + n.x * 6;
      p.ty = o.y + o.vy * 0.25 + n.y * 6;
    } else {
      const ip = interceptPoint(sim, p);
      p.tx = ip.pt.x;
      p.ty = ip.pt.y;
    }
    p.wantSprint = dist(p, { x: p.tx, y: p.ty }) > 50 && p.stamina > 0.3;
    return;
  }
  const home = homePos(sim, p, false);
  if (oppBall) {
    // marcatura: assegna i difensori agli attaccanti più pericolosi
    const gx = sim.ownGoalX(team);
    const threats = sim.teams[opp]
      .filter((o) => !o.isGK && o !== b.owner)
      .sort((a, c) => Math.abs(a.x - gx) - Math.abs(c.x - gx));
    const mates = sim.teams[team]
      .filter((m) => !m.isGK && m !== chaser && !sim.isHuman(m))
      .sort((a, c) => Math.abs(a.x - gx) - Math.abs(c.x - gx));
    const k = mates.indexOf(p);
    const t = threats[k];
    if (t) {
      const n = norm(gx - t.x, sim.H / 2 - t.y);
      // marcatura stretta solo vicino alla propria porta, altrimenti a zona
      const danger = 1 - sim.toTeamX(team, t.x);
      const tac = sim.tactic[team];
      const w = clamp(danger * 1.4, tac === 'attacco' ? 0.6 : tac === 'difesa' ? 0.25 : 0.35, 1);
      p.tx = (t.x + n.x * 16) * w + home.x * (1 - w);
      p.ty = (t.y + n.y * 16) * w + home.y * (1 - w);
      return;
    }
  }
  p.tx = home.x;
  p.ty = home.y;
}

function carrierThink(sim: MatchSim, p: Player) {
  const d = sim.diff[p.team];
  const rng = sim.rng;
  const gx = sim.oppGoalX(p.team);
  const gy = sim.H / 2;
  const dGoal = len(gx - p.x, gy - p.y);
  const opp = sim.teams[p.team === 0 ? 1 : 0];
  const gk = opp[0];

  // il giocatore umano ha chiesto la palla: gliela passo
  const hero = sim.human;
  if (sim.locked && sim.callT > 0 && hero && hero.team === p.team && hero !== p && p.holdT > 0.1) {
    sim.callT = 0;
    if (dist(p, hero) > 24 && hero.state !== 'stun') {
      sim.pass(p, hero);
      return;
    }
  }
  if (p.holdT > 0.15) {
    // tiro?
    const range = 250 * p.def.stats.shot;
    let blocked = false;
    for (const o of opp) {
      if (o.isGK) continue;
      if (distToSegment(o, p, { x: gx, y: gy }) < 14) blocked = true;
    }
    const angleOk = Math.abs(gx - p.x) > Math.abs(gy - p.y) * 0.6;
    if (angleOk && (dGoal < 125 || (dGoal < range && !blocked && rng.chance(0.55 + d.decision * 0.4)))) {
      const ty = gk.y < gy ? sim.goalBottom - 11 : sim.goalTop + 11;
      const dir = Math.atan2(ty - p.y + rng.range(-8, 8), gx - p.x);
      const power = sim.superBar[p.team] >= 1 ? 1 : clamp(0.5 + dGoal / 420, 0.55, 1);
      sim.shoot(p, dir, power, false);
      return;
    }
    // filtrante o pallonetto per un compagno lanciato in avanti
    if (p.holdT > 0.5 && rng.chance(0.05 + d.decision * 0.07)) {
      const tgt = sim.throughTarget(p, Math.atan2(gy - p.y, gx - p.x));
      const dir0 = sim.dirOf(p.team);
      if (tgt && (tgt.x - p.x) * dir0 > 70 && nearestOpp(sim, tgt, p.team).d > 30) {
        sim.throughPass(p, tgt, isPassSafe(sim, p, tgt, p.team) ? 'filtrante' : 'pallonetto');
        return;
      }
    }
    // passaggio?
    const near = nearestOpp(sim, p, p.team);
    const pressured = near.d < 34;
    const bp = bestPass(sim, p);
    if (bp) {
      const want =
        (pressured && rng.chance(0.35 + d.decision * 0.5) && bp.score > -0.4) ||
        (bp.score > 0.45 && rng.chance(0.12 + d.decision * 0.12)) ||
        (p.holdT > 3.2 && bp.score > -0.8);
      if (want) {
        sim.pass(p, bp.target);
        return;
      }
    }
  }
  // dribbling verso la porta evitando gli avversari
  const dir = sim.dirOf(p.team);
  const aim = { x: gx - dir * 50, y: gy + (p.y - gy) * 0.25 };
  let v = norm(aim.x - p.x, aim.y - p.y);
  let ax = 0;
  let ay = 0;
  for (const o of opp) {
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    const dd = len(dx, dy);
    if (dd > 75 || dd < 1) continue;
    const ahead = (dx * v.x + dy * v.y) / dd;
    if (ahead < -0.2) continue;
    // spinta laterale per scartare l'avversario
    const side = v.x * dy - v.y * dx > 0 ? -1 : 1;
    const w = ((75 - dd) / 75) * 1.6;
    ax += -v.y * side * w;
    ay += v.x * side * w;
  }
  // non finire contro le sponde
  if (p.y < 40) ay += 0.8;
  if (p.y > sim.H - 40) ay -= 0.8;
  v = norm(v.x + ax, v.y + ay);
  p.tx = p.x + v.x * 60;
  p.ty = p.y + v.y * 60;
  const open = nearestOpp(sim, { x: p.x + v.x * 40, y: p.y + v.y * 40 }, p.team).d > 50;
  p.wantSprint = open && p.stamina > 0.45 && dGoal > 120;
}

/** Ogni frame: muove verso il bersaglio e decide i contrasti. */
export function decideAiActions(sim: MatchSim, p: Player, dt: number) {
  if (p.energy >= 1 && aiSpecial(sim, p, dt)) return;
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const d = len(dx, dy);
  if (d < 3) {
    p.wantX = p.wantY = 0;
  } else {
    const k = Math.min(1, d / 28);
    p.wantX = (dx / d) * k;
    p.wantY = (dy / d) * k;
  }
  // tiro al volo / rovesciata su palla alta in zona d'attacco
  const b = sim.ball;
  if (!b.owner && !p.isGK && sim.canVolley(p) && sim.toTeamX(p.team, p.x) > 0.56) {
    const gx = sim.oppGoalX(p.team);
    const gk = sim.teams[p.team === 0 ? 1 : 0][0];
    const ty = gk && gk.y < sim.H / 2 ? sim.goalBottom - 11 : sim.goalTop + 11;
    if (sim.rng.chance(clamp(0.45 + sim.diff[p.team].decision * 0.45, 0.4, 0.95))) {
      const dir = Math.atan2(ty - p.y + sim.rng.range(-8, 8), gx - p.x);
      if (sim.attemptVolley(p, dir, 0.88, false)) return;
    }
  }
  // contrasto in scivolata (sulla linea di porta evita tuffi ciechi verso la propria rete)
  const o = b.owner;
  if (o && o.team !== p.team && p.canAct && p.tackleCd <= 0 && !(o.isGK && sim.inOwnBox(o.team, o.x, o.y))) {
    const nearOwnLine = sim.toTeamX(p.team, p.x) < 0.09 && (o.x - p.x) * sim.dirOf(p.team) < 0;
    const dd = dist(p, o);
    if (!nearOwnLine && dd < 22 && dd > 6) {
      const rate = sim.diff[p.team].tackle;
      if (sim.rng.chance(rate * dt)) {
        const tx = o.x + o.vx * 0.12;
        const ty = o.y + o.vy * 0.12;
        const slideDir = sim.toTeamX(p.team, p.x) < 0.16 && (tx - p.x) * sim.dirOf(p.team) < -2
          ? sim.safeClearDir(p.team, p.x, p.y)
          : Math.atan2(ty - p.y, tx - p.x);
        sim.startSlide(p, slideDir);
      }
    }
  }
}

/** Portiere: posizione, tuffo, presa e rinvio. */
export function aiGoalkeeper(sim: MatchSim, gk: Player, dt: number) {
  const b = sim.ball;
  const team = gk.team;
  const gx = sim.ownGoalX(team);
  const dir = sim.dirOf(team);
  gk.wantSprint = false;

  if (b.owner === gk) {
    gk.wantX = gk.wantY = 0;
    if (gk.holdT > 0.9) {
      const bp = bestPass(sim, gk);
      if (bp && bp.score > -0.5) {
        sim.pass(gk, bp.target);
      } else {
        const a = (dir > 0 ? 0 : Math.PI) + sim.rng.range(-0.5, 0.5);
        sim.kickBall(gk, a, 360, 130, 0);
        sim.events.push({ type: 'kick', x: gk.x, y: gk.y, power: 0.7, team });
      }
    }
    return;
  }
  if (!gk.canAct) {
    sim.keeperContact(gk);
    return;
  }

  // tiro in arrivo?
  const towardGoal = b.vx * -dir > 60;
  let target: Vec;
  if (!b.owner && towardGoal && b.speed > 170) {
    const tLine = (gx - b.x) / (b.vx || 1e-6);
    const yAt = b.y + b.vy * tLine;
    const onTarget = tLine > 0 && tLine < 1.3 && yAt > sim.goalTop - 14 && yAt < sim.goalBottom + 14;
    if (onTarget) {
      if (!gk.seenShot) {
        gk.seenShot = true;
        const kp = sim.diff[team].keeper;
        gk.reactT = clamp(0.2 - kp * 0.1, 0.04, 0.16) + sim.rng.range(0, 0.06);
      }
      gk.reactT -= dt;
      const tk = Math.max(0.05, (gk.x - b.x) / (b.vx || 1e-6));
      const py = clamp(b.y + b.vy * tk, sim.goalTop - 10, sim.goalBottom + 10);
      if (gk.reactT <= 0 && Math.abs(py - gk.y) > 10 && tk < 0.5) {
        const kp = gk.def.stats.keeping * sim.diff[team].keeper;
        const maxV = 240 * kp;
        gk.setState('dive', 0);
        gk.vy = clamp((py - gk.y) / Math.max(tk, 0.12), -maxV, maxV);
        gk.vx = dir * 20;
        gk.facing = gk.vy > 0 ? Math.PI / 2 : -Math.PI / 2;
        sim.events.push({ type: 'slide', x: gk.x, y: gk.y });
        sim.keeperContact(gk);
        return;
      }
      target = { x: gk.x, y: py };
    } else {
      gk.seenShot = false;
      target = guardPoint(sim, gk);
    }
  } else {
    gk.seenShot = false;
    target = guardPoint(sim, gk);
    if (b.owner && b.owner.team !== team && !b.owner.isGK) {
      // duello a tu per tu: se l'attaccante entra o si invola verso l'area senza difensori davanti, esce basso
      const att = b.owner;
      const gxDist = Math.abs(b.x - gx);
      const inDangerZone =
        sim.inOwnBox(team, b.x, b.y) ||
        (gxDist < 130 && Math.abs(b.y - sim.H / 2) < sim.pitch.goalWidth * 0.9);
      const hasCover = sim.teams[team].some(
        (m) => !m.isGK && m.out <= 0 && Math.abs(m.x - gx) < gxDist - 4 && Math.abs(m.y - b.y) < 42,
      );
      if (inDangerZone && (!hasCover || sim.inOwnBox(team, b.x, b.y)) && gk.saveCd <= 0) {
        target = {
          x: b.x + att.vx * 0.08 - dir * 2,
          y: clamp(b.y + att.vy * 0.08, sim.goalTop - 36, sim.goalBottom + 36),
        };
        gk.wantSprint = true;
      }
    } else if (!b.owner && sim.inOwnBox(team, b.x, b.y) && b.speed < 200) {
      // palla libera nell'area: esce a prenderla
      const mine = dist(gk, b);
      let closest = true;
      for (const o of sim.teams[team === 0 ? 1 : 0]) if (dist(o, b) < mine) closest = false;
      if (closest) target = { x: b.x, y: b.y };
    }
  }
  // limiti: resta vicino alla porta
  target.x = dir > 0 ? clamp(target.x, gx + 4, gx + 102) : clamp(target.x, gx - 102, gx - 4);
  const dx = target.x - gk.x;
  const dy = target.y - gk.y;
  const d = len(dx, dy);
  if (d < 2) {
    gk.wantX = gk.wantY = 0;
  } else {
    const k = Math.min(1, d / 16);
    gk.wantX = (dx / d) * k;
    gk.wantY = (dy / d) * k;
  }
  sim.keeperContact(gk);
}

function guardPoint(sim: MatchSim, gk: Player): Vec {
  const b = sim.ball;
  const gx = sim.ownGoalX(gk.team);
  const gy = sim.H / 2;
  const d = len(b.x - gx, b.y - gy);
  const n = norm(b.x - gx, b.y - gy);
  const out = clamp(d * 0.12, 10, 34);
  return {
    x: gx + n.x * out,
    y: clamp(gy + n.y * out * 1.6, sim.goalTop + 6, sim.goalBottom - 6),
  };
}
