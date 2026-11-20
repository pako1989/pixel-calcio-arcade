import { EpicMatch, TECHS, clamp, type AttackAction, type DefenseAction, type Encounter, type KeeperAction, type LgPlayer, type LgTeam, type MatchOpts, type ShotInfo, type Side, type Step } from './leggenda';

/**
 * Leggenda del Pallone, campo libero: come nei vecchi giochi di calcio anime,
 * muovi tu il giocatore sul campo; quando un avversario ti si scontra contro
 * si ferma tutto e scegli cosa fare (dribbling, passaggio, tiro, tecnica).
 * In difesa muovi il tuo difensore: se tocca chi ha palla parte il duello.
 * Logica pura (niente grafica): metri, x 0..100 lungo il campo, y 0..64 in largo.
 */

export const FIELD_L = 100;
export const FIELD_W = 64;
export const CY = FIELD_W / 2;
/** Distanza (metri) a cui due giocatori si scontrano. */
export const CONTACT = 2.4;
/** Unità di tempo della partita per ogni secondo di corsa. */
export const TIME_K = 0.3;

export interface Pos {
  x: number;
  y: number;
}

/** Cosa interrompe la corsa (la scena apre un menu o fa giocare la CPU). */
export type FieldEvent =
  | { t: 'contact'; def: string }
  | { t: 'keeper' }
  | { t: 'cpuShot' }
  | { t: 'cpuPass'; to: string };

export interface Stick {
  mx: number;
  my: number;
}

/** Posizioni di base (squadra che attacca verso destra), per ruolo e indice nel ruolo. */
const BASE: Record<string, [number, number][]> = {
  GK: [[2, CY]],
  DEF: [[17, 22], [17, 42]],
  MID: [[31, 15], [31, 49]],
  FWD: [[43, 27], [43, 38]],
};

/** Energia spesa al secondo correndo col pallone, e recuperata senza palla. */
export const RUN_COST = 1.6;
export const REST_GAIN = 0.35;

/** Velocità in metri al secondo. */
export const SPEED = { hero: 8.6, cpuCarrier: 5.5, press1: 6.3, press2: 4.9, mateRun: 6.2, matePress: 5.0 };

const dist = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y);

/** Distanza di un punto dal segmento a-b. */
function segDist(p: Pos, a: Pos, b: Pos): { d: number; t: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const L = vx * vx + vy * vy || 1;
  const t = clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / L, 0, 1);
  return { d: Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t)), t };
}

export class FieldMatch extends EpicMatch {
  pos: Record<string, Pos> = {};
  /** Secondi in cui un giocatore è a terra/frastornato e non può contrastare. */
  stun: Record<string, number> = {};
  /** Chi muovi tu col joystick. */
  ctrl = '';
  /** Pausa dagli scontri dopo un duello. */
  cooldown = 0;
  private aiT = 0;
  private prevCarrier = '';
  /** Fattore velocità degli avversari (difficoltà). */
  cpuPace: number;

  constructor(home: LgTeam, away: LgTeam, opts: MatchOpts & { cpuPace?: number }) {
    super(home, away, opts);
    this.cpuPace = opts.cpuPace ?? 1;
    this.formation(this.side, true);
    this.afterPoss();
  }

  // ---------- posizioni ----------

  roleSlot(p: LgPlayer): [number, number] {
    const t = this.teams[this.sideOf(p.id)];
    const i = t.players.filter((q) => q.role === p.role).indexOf(p);
    const list = BASE[p.role];
    return list[Math.min(list.length - 1, Math.max(0, i))];
  }

  /** Dove vorrebbe stare un giocatore senza palla. */
  spot(p: LgPlayer): Pos {
    const side = this.sideOf(p.id);
    const ball = this.pos[this.carrier] ?? { x: 50, y: CY };
    // coordinate "di squadra": si attacca sempre verso destra
    const bx = side === 0 ? ball.x : FIELD_L - ball.x;
    const by = side === 0 ? ball.y : FIELD_W - ball.y;
    const [x0, y0] = this.roleSlot(p);
    let x: number;
    let y = y0 + (by - CY) * 0.35;
    if (p.role === 'GK') {
      x = 1.6;
      y = clamp(CY + (by - CY) * 0.25, CY - 4, CY + 4);
    } else if (side === this.side) {
      // si attacca: tutti in avanti, le punte si smarcano davanti al pallone
      x = x0 + 20 + (bx - 50) * 0.5;
      if (p.role === 'FWD') x = Math.max(x, bx + 9);
      if (p.role === 'MID') x = Math.max(x, bx - 6);
      x = clamp(x, 6, 88);
    } else {
      // si difende: tra il pallone e la propria porta
      x = x0 + (bx - 50) * 0.45;
      x = clamp(Math.min(x, bx - 4), 5, 80);
    }
    y = clamp(y, 3, FIELD_W - 3);
    return side === 0 ? { x, y } : { x: FIELD_L - x, y: FIELD_W - y };
  }

  /** Rimette tutti in formazione (calcio d'inizio). */
  formation(kick: Side, snap: boolean) {
    for (const t of this.teams) {
      for (const p of t.players) {
        const side = this.sideOf(p.id);
        const [x0, y0] = this.roleSlot(p);
        let x = p.role === 'GK' ? 1.6 : Math.min(46, x0 * 1.05);
        if (side !== kick && p.role !== 'GK') x = Math.min(x, 40);
        const pos = side === 0 ? { x, y: y0 } : { x: FIELD_L - x, y: FIELD_W - y0 };
        if (snap || !this.pos[p.id]) this.pos[p.id] = pos;
        else Object.assign(this.pos[p.id], pos);
      }
    }
    const c = this.pos[this.carrier];
    if (c) {
      c.x = 50;
      c.y = CY;
    }
    this.stun = {};
    this.cooldown = 1;
  }

  // ---------- possesso ----------

  override kickoff(side: Side) {
    super.kickoff(side);
    if (this.pos) this.formation(side, false);
  }

  override startPossession(side: Side, carrier: string, x: number) {
    this.prevCarrier = this.carrier;
    this.side = side;
    this.carrier = carrier;
    this.x = clamp(x, 1, 99);
    this.passed.clear();
    this.poss++;
    this.engagers = [];
    if (this.pos) this.afterPoss();
  }

  private afterPoss() {
    const c = this.pos[this.carrier];
    if (c && Math.abs(c.x - this.x) > 1) c.x = this.x;
    if (c) this.x = c.x;
    if (this.prevCarrier && this.prevCarrier !== this.carrier && this.sideOf(this.prevCarrier) !== this.side) this.stun[this.prevCarrier] = 1.3;
    this.cooldown = Math.max(this.cooldown, 0.9);
    this.aiT = 0.6;
    if (this.side === 0) this.ctrl = this.carrier;
    else this.pickDefender();
  }

  /** In difesa controlli il tuo giocatore più vicino al pallone. */
  pickDefender(exclude?: string) {
    const b = this.pos[this.carrier];
    const mine = this.teams[0].players.filter((p) => p.role !== 'GK' && p.id !== exclude && !(this.stun[p.id] > 0));
    const pool = mine.length ? mine : this.teams[0].players.filter((p) => p.role !== 'GK');
    pool.sort((a, c) => dist(this.pos[a.id], b) - dist(this.pos[c.id], b));
    this.ctrl = pool[0].id;
  }

  /** Bottone CAMBIA: passa al prossimo difensore più vicino. */
  switchDefender() {
    if (this.side === 0) return;
    this.pickDefender(this.ctrl);
  }

  /** Compagni a cui passare, dove si trovano davvero. */
  override passTargets(): { id: string; x: number }[] {
    if (!this.pos?.[this.carrier]) return super.passTargets();
    const c = this.pos[this.carrier];
    const fwd = this.side === 0 ? 1 : -1;
    return this.teams[this.side].players
      .filter((p) => p.id !== this.carrier && p.role !== 'GK')
      .map((p) => ({ id: p.id, x: this.pos[p.id].x }))
      .filter((t) => (t.x - c.x) * fwd > -10 && dist(this.pos[t.id], c) < 45)
      .sort((a, b) => this.distance(a.x) - this.distance(b.x));
  }

  /** Prima di un passaggio o di un tiro: chi può mettersi in mezzo (in base al campo). */
  prepare(kind: 'passaggio' | 'tiro', to?: string) {
    const c = this.pos[this.carrier];
    const goal: Pos = { x: this.side === 0 ? FIELD_L : 0, y: CY };
    const end = kind === 'tiro' ? goal : this.pos[to ?? ''] ?? goal;
    const defSide = (1 - this.side) as Side;
    const list: { id: string; x: number; t: number }[] = [];
    for (const p of this.teams[defSide].players) {
      if (p.role === 'GK' || this.stun[p.id] > 0) continue;
      const q = this.pos[p.id];
      const s = segDist(q, c, end);
      if (s.t <= 0.02 || s.d > (kind === 'tiro' ? 5.5 : 3.5)) continue;
      list.push({ id: p.id, x: q.x, t: s.t });
    }
    list.sort((a, b) => a.t - b.t);
    this.engagers = list.map(({ id, x }) => ({ id, x }));
    this.x = c.x;
  }

  /** L'avversario contro cui ti sei scontrato. */
  encounter(def: string): Encounter {
    return { def: this.player(def), x: this.pos[this.carrier].x };
  }

  override duel(att: AttackAction, enc: Encounter | null, def: DefenseAction): Step[] {
    if (att.kind === 'passaggio') this.prepare('passaggio', att.to);
    const att0 = this.carrier;
    const steps = super.duel(att, enc, def);
    for (const s of steps) {
      if (s.t === 'duel' && s.kind === 'dribbling' && s.win) {
        // il difensore resta a terra, chi attacca scatta via
        this.stun[s.def] = this.sideOf(s.def) === 1 ? 2.4 : 1.5;
        const a = this.pos[att0];
        const dir = this.sideOf(att0) === 0 ? 1 : -1;
        a.x = clamp(a.x + dir * 2.5, 1, FIELD_L - 1);
        this.x = a.x;
      }
      if (s.t === 'pass') {
        // chi riceve si ferma dov'è: il pallone arriva lì
        this.x = this.pos[s.to].x;
        this.stun[s.from] = 0;
        // il joystick passa a chi riceve
        if (this.side === 0) this.ctrl = s.to;
      }
    }
    this.cooldown = Math.max(this.cooldown, 0.8);
    return steps;
  }

  override shoot(att: AttackAction, enc: Encounter | null, def: DefenseAction | null): ShotInfo {
    this.prepare('tiro');
    const info = super.shoot(att, enc, def);
    this.cooldown = Math.max(this.cooldown, 0.8);
    return info;
  }

  override save(shot: ShotInfo, ka: KeeperAction): Step[] {
    const st = super.save(shot, ka);
    // rilancio del portiere: il compagno riceve a centrocampo
    const to = st.find((s) => s.t === 'turnover');
    if (to && to.t === 'turnover') {
      const p = this.pos[to.carrier];
      p.x = to.x;
    }
    return st;
  }

  // ---------- un passo della corsa ----------

  private speedOf(id: string, base: number) {
    return base * (0.8 + 0.5 * (this.ef(id) - 0.6));
  }

  private moveTo(id: string, to: Pos, sp: number, dt: number) {
    const p = this.pos[id];
    const dx = to.x - p.x;
    const dy = to.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.2) return;
    const k = Math.min(1, (sp * dt) / d);
    p.x += dx * k;
    p.y += dy * k;
  }

  private keepIn(id: string) {
    const p = this.pos[id];
    p.x = clamp(p.x, 0.5, FIELD_L - 0.5);
    p.y = clamp(p.y, 1, FIELD_W - 1);
  }

  /**
   * Avanza il campo di `dt` secondi. `stick` è il joystick (null = fermo).
   * Restituisce l'evento che ferma la corsa, se c'è.
   */
  step(dt: number, stick: Stick | null): FieldEvent | null {
    if (this.over) return null;
    this.tick(dt * TIME_K);
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const id of Object.keys(this.stun)) this.stun[id] = Math.max(0, this.stun[id] - dt);
    if (this.side === 0) this.ctrl = this.carrier;
    const carrier = this.carrier;
    const cpos = this.pos[carrier];
    const attSide = this.side;
    const defSide = (1 - attSide) as Side;

    // chi pressa: i due difensori più vicini al pallone
    const defs = this.teams[defSide].players
      .filter((p) => p.role !== 'GK' && !(this.stun[p.id] > 0) && !(defSide === 0 && p.id === this.ctrl))
      .sort((a, b) => dist(this.pos[a.id], cpos) - dist(this.pos[b.id], cpos));
    const press = new Map<string, number>();
    if (defSide === 1) {
      if (defs[0]) press.set(defs[0].id, SPEED.press1 * this.cpuPace);
      if (defs[1]) press.set(defs[1].id, SPEED.press2 * this.cpuPace);
    } else {
      // i tuoi compagni aiutano: chi è vicino va a chiudere
      if (defs[0] && dist(this.pos[defs[0].id], cpos) < 22) press.set(defs[0].id, SPEED.matePress);
      if (defs[1] && dist(this.pos[defs[1].id], cpos) < 14) press.set(defs[1].id, SPEED.matePress * 0.85);
    }

    const lastY = cpos.y;
    const hasStick = !!stick && Math.hypot(stick.mx, stick.my) > 0.15;
    for (const t of this.teams) {
      for (const p of t.players) {
        const id = p.id;
        if (this.stun[id] > 0) continue;
        if (id === this.ctrl && hasStick) {
          const n = Math.max(1, Math.hypot(stick!.mx, stick!.my));
          const sp = this.speedOf(id, SPEED.hero);
          this.pos[id].x += (stick!.mx / n) * sp * dt;
          this.pos[id].y += (stick!.my / n) * sp * dt;
        } else if (id === carrier && attSide === 1) {
          this.cpuRun(dt);
        } else if (id === carrier) {
          // la tua punta col pallone sta ferma se non tocchi il joystick
        } else if (press.has(id)) {
          // si va incontro al pallone, un passo davanti per tagliare la strada
          const dir = attSide === 0 ? 1 : -1;
          const aim = { x: cpos.x + dir * 1.2, y: cpos.y };
          this.moveTo(id, aim, this.speedOf(id, press.get(id)!), dt);
        } else if (id === this.ctrl && attSide === 1) {
          // il tuo difensore senza joystick va piano verso il pallone
          this.moveTo(id, cpos, this.speedOf(id, SPEED.matePress), dt);
        } else {
          const sp = p.role === 'GK' ? 5 : t === this.teams[attSide] ? SPEED.mateRun : 5.4 * (defSide === 1 ? this.cpuPace : 1);
          this.moveTo(id, this.spot(p), this.speedOf(id, sp), dt);
        }
        this.keepIn(id);
      }
    }
    // correre col pallone stanca, chi è senza palla riprende fiato piano
    const moved = Math.abs(cpos.x - this.x) + Math.abs(cpos.y - lastY);
    if (moved > 0.05) this.spend(carrier, RUN_COST * dt);
    for (const t of this.teams) for (const p of t.players) if (p.id !== carrier) this.restore(p.id, REST_GAIN * dt);
    this.x = cpos.x;

    if (this.cooldown > 0) return null;
    // scontri
    let best: { id: string; d: number } | null = null;
    for (const p of this.teams[defSide].players) {
      if (p.role === 'GK' || this.stun[p.id] > 0) continue;
      const d = dist(this.pos[p.id], cpos);
      if (d < CONTACT && (!best || d < best.d)) best = { id: p.id, d };
    }
    if (best) return { t: 'contact', def: best.id };
    const gk = this.keeper(defSide);
    const dGoal = this.distance(cpos.x);
    if (attSide === 0) {
      if (dist(this.pos[gk.id], cpos) < 3.6 || dGoal < 5) return { t: 'keeper' };
      return null;
    }
    // la CPU decide se tirare o passare
    this.aiT -= dt;
    if (dist(this.pos[gk.id], cpos) < 3.6 || dGoal < 9) return { t: 'cpuShot' };
    if (this.aiT <= 0) {
      this.aiT = 0.45;
      const shots = this.techsOf(carrier, 'tiro').filter((t) => dGoal <= this.techRange(t));
      if (shots.length && this.rng.chance(0.12)) return { t: 'cpuShot' };
      if (dGoal < 18 && this.rng.chance(0.2)) return { t: 'cpuShot' };
      if (this.rng.chance(0.07)) {
        const free = this.passTargets().filter((tg) => this.distance(tg.x) < dGoal - 6 && !this.teams[0].players.some((q) => dist(this.pos[q.id], this.pos[tg.id]) < 4));
        if (free.length) return { t: 'cpuPass', to: free[0].id };
      }
    }
    return null;
  }

  private techRange(t: string) {
    return TECHS[t].range ?? 22;
  }

  /** La CPU porta palla verso la tua porta, scansando i tuoi giocatori. */
  private cpuRun(dt: number) {
    const id = this.carrier;
    const p = this.pos[id];
    let dx = -1;
    let dy = (CY - p.y) * 0.04;
    for (const q of this.teams[0].players) {
      if (q.role === 'GK') continue;
      const o = this.pos[q.id];
      const ahead = p.x - o.x;
      const d = dist(o, p);
      if (ahead > -1 && d < 9) {
        const push = (9 - d) / 9;
        dy += (p.y >= o.y ? 1 : -1) * push * 1.2;
      }
    }
    const n = Math.hypot(dx, dy) || 1;
    dx /= n;
    dy /= n;
    const sp = this.speedOf(id, SPEED.cpuCarrier * this.cpuPace);
    p.x += dx * sp * dt;
    p.y += dy * sp * dt;
  }
}
