import { Ball, Player, type PowerUp, type PowerUpKind, type SimEvent } from './entities';
import { clamp, dist, len, norm, Rng, turnTowards, type Vec } from './math';
import type { Difficulty, MatchConfig, MatchResult, MatchStats, PitchDef } from './types';
import { aiThink, aiGoalkeeper, chooseHumanPassTarget, decideAiActions } from './ai';

export const GOAL_DEPTH = 22;
export const CROSSBAR = 28;
export const BALL_R = 3;
export const PLAYER_R = 6;
const GRAVITY = 520;
const CHARGE_TIME = 0.75;

export interface HumanInput {
  mx: number;
  my: number;
  shoot: boolean;
  pass: boolean;
  sprint: boolean;
}

export const NO_INPUT: HumanInput = { mx: 0, my: 0, shoot: false, pass: false, sprint: false };

export interface DiffParams {
  speed: number;
  think: number;
  tackle: number;
  shotErr: number;
  keeper: number;
  steal: number;
  decision: number;
}

export const DIFFICULTY: Record<Difficulty, DiffParams> = {
  facile: { speed: 0.85, think: 0.34, tackle: 0.7, shotErr: 0.17, keeper: 0.78, steal: 0.5, decision: 0.5 },
  normale: { speed: 0.94, think: 0.23, tackle: 1.3, shotErr: 0.11, keeper: 0.93, steal: 0.85, decision: 0.72 },
  difficile: { speed: 1.01, think: 0.16, tackle: 2.0, shotErr: 0.07, keeper: 1.05, steal: 1.2, decision: 0.9 },
};

export type Phase = 'kickoff' | 'play' | 'goal' | 'golden' | 'end';

export class MatchSim {
  readonly pitch: PitchDef;
  readonly W: number;
  readonly H: number;
  readonly goalTop: number;
  readonly goalBottom: number;
  readonly rng: Rng;
  readonly players: Player[] = [];
  readonly teams: [Player[], Player[]] = [[], []];
  readonly ball = new Ball();
  score: [number, number] = [0, 0];
  timeLeft: number;
  elapsed = 0;
  phase: Phase = 'kickoff';
  phaseT = 0;
  kickoffTeam: 0 | 1 = 0;
  goldenGoal = false;
  events: SimEvent[] = [];
  /** Indice (in teams[humanTeam]) del giocatore controllato. */
  humanIdx = 4;
  readonly humanTeam: 0 | 1 | null;
  charge = 0;
  charging = false;
  private prevShoot = false;
  private prevPass = false;
  private switchCd = 0;
  superBar: [number, number] = [0, 0];
  fireShot: [boolean, boolean] = [false, false];
  turbo: [number, number] = [0, 0];
  wall: [number, number] = [0, 0];
  powerUps: PowerUp[] = [];
  private powerUpT = 12;
  private nextPowerUpId = 1;
  wind: Vec = { x: 0, y: 0 };
  private windT = 0;
  stats: MatchStats = { shots: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [0, 0] };
  scorers: MatchResult['scorers'] = [];
  readonly diff: [DiffParams, DiffParams];

  constructor(readonly cfg: MatchConfig) {
    this.pitch = cfg.pitch;
    this.W = cfg.pitch.width;
    this.H = cfg.pitch.height;
    this.goalTop = this.H / 2 - cfg.pitch.goalWidth / 2;
    this.goalBottom = this.H / 2 + cfg.pitch.goalWidth / 2;
    this.rng = new Rng(cfg.seed ?? Date.now());
    this.timeLeft = cfg.durationSec;
    this.humanTeam = cfg.humanTeam;
    const cpu = DIFFICULTY[cfg.difficulty];
    const mate = DIFFICULTY.normale;
    this.diff = [
      cfg.humanTeam === 0 ? mate : cpu,
      cfg.humanTeam === 1 ? mate : cpu,
    ];
    let id = 0;
    [cfg.home, cfg.away].forEach((t, ti) => {
      t.players.forEach((pd, i) => {
        const p = new Player(id++, ti as 0 | 1, i, pd);
        this.players.push(p);
        this.teams[ti].push(p);
      });
    });
    this.kickoffTeam = this.rng.chance(0.5) ? 0 : 1;
    this.setupKickoff();
    this.events.push({ type: 'whistle', kind: 'start' });
  }

  // ---------- geometria ----------
  /** Direzione d'attacco della squadra: +1 verso destra, -1 verso sinistra. */
  dirOf(team: 0 | 1): number {
    return team === 0 ? 1 : -1;
  }
  ownGoalX(team: 0 | 1): number {
    return team === 0 ? 0 : this.W;
  }
  oppGoalX(team: 0 | 1): number {
    return team === 0 ? this.W : 0;
  }
  get human(): Player | null {
    return this.humanTeam === null ? null : this.teams[this.humanTeam][this.humanIdx];
  }
  isHuman(p: Player): boolean {
    return this.humanTeam === p.team && this.humanIdx === p.idx;
  }
  teamHasBall(team: 0 | 1): boolean {
    return this.ball.owner !== null && this.ball.owner.team === team;
  }
  /** Coordinate "normalizzate per la squadra": 0 = propria porta, 1 = porta avversaria. */
  toTeamX(team: 0 | 1, x: number): number {
    return team === 0 ? x / this.W : 1 - x / this.W;
  }
  fromTeamX(team: 0 | 1, nx: number): number {
    return team === 0 ? nx * this.W : (1 - nx) * this.W;
  }
  inOwnBox(team: 0 | 1, x: number, y: number): boolean {
    const gx = this.ownGoalX(team);
    return Math.abs(x - gx) < 90 && y > this.goalTop - 50 && y < this.goalBottom + 50;
  }

  // ---------- fasi ----------
  setupKickoff() {
    this.phase = 'kickoff';
    this.phaseT = 1.4;
    const b = this.ball;
    b.owner = null;
    b.x = this.W / 2;
    b.y = this.H / 2;
    b.z = 0;
    b.stop();
    b.fire = b.superShot = b.isShot = false;
    b.passTarget = null;
    b.lastTouch = null;
    const KO: [number, number][] = [
      [0.04, 0.5],
      [0.2, 0.5],
      [0.34, 0.22],
      [0.34, 0.78],
      [0.44, 0.5],
    ];
    for (const p of this.players) {
      const [nx, ny] = KO[p.idx];
      p.x = this.fromTeamX(p.team, nx);
      p.y = ny * this.H;
      p.vx = p.vy = 0;
      p.facing = p.team === 0 ? 0 : Math.PI;
      p.setState('run');
      p.kickCd = p.pickupCd = p.tackleCd = 0;
      p.holdT = 0;
      p.stamina = 1;
      p.tx = p.x;
      p.ty = p.y;
    }
    const kicker = this.teams[this.kickoffTeam][4];
    kicker.x = this.W / 2 - this.dirOf(this.kickoffTeam) * 9;
    kicker.y = this.H / 2;
    b.owner = kicker;
    b.lastTouch = kicker;
    if (this.humanTeam !== null) this.humanIdx = this.humanTeam === this.kickoffTeam ? 4 : 4;
    this.charge = 0;
    this.charging = false;
  }

  private startPlay() {
    this.phase = 'play';
    this.events.push({ type: 'whistle', kind: 'kickoff' });
  }

  private scoreGoal(team: 0 | 1) {
    const b = this.ball;
    const scorerP = b.lastTouch;
    const own = !!scorerP && scorerP.team !== team;
    this.score[team]++;
    const name = scorerP ? scorerP.def.name + (own ? ' (aut.)' : '') : '?';
    this.scorers.push({ team, name, time: this.elapsed });
    this.events.push({ type: 'goal', team, scorer: name, x: b.x, y: b.y, own });
    this.phase = 'goal';
    this.phaseT = 3.2;
    b.fire = false;
    b.superShot = false;
    b.isShot = false;
    for (const p of this.players) {
      p.setState(p.team === team ? 'celebrate' : 'sad', 0);
    }
    this.kickoffTeam = team === 0 ? 1 : 0;
  }

  get result(): MatchResult {
    const tot = this.stats.possession[0] + this.stats.possession[1] || 1;
    return {
      score: [...this.score] as [number, number],
      stats: {
        ...this.stats,
        possession: [Math.round((this.stats.possession[0] / tot) * 100), Math.round((this.stats.possession[1] / tot) * 100)],
      },
      goldenGoal: this.goldenGoal,
      scorers: this.scorers,
    };
  }

  // ---------- ciclo principale ----------
  update(dt: number, input: HumanInput = NO_INPUT) {
    dt = Math.min(dt, 1 / 20);
    this.phaseT -= dt;
    switch (this.phase) {
      case 'kickoff':
        this.updatePlayersIdle(dt);
        if (this.phaseT <= 0) this.startPlay();
        this.syncOwnedBall();
        break;
      case 'goal':
        this.updatePlayersIdle(dt, true);
        this.updateBallPhysics(dt);
        if (this.phaseT <= 0) {
          if (this.goldenGoal || (this.timeLeft <= 0 && this.score[0] !== this.score[1])) {
            this.endMatch();
          } else {
            this.setupKickoff();
          }
        }
        break;
      case 'golden':
        this.updatePlayersIdle(dt);
        if (this.phaseT <= 0) this.setupKickoff();
        break;
      case 'play':
        this.updatePlay(dt, input);
        break;
      case 'end':
        this.updatePlayersIdle(dt, true);
        this.updateBallPhysics(dt);
        break;
    }
    this.prevShoot = input.shoot;
    this.prevPass = input.pass;
  }

  private endMatch() {
    this.phase = 'end';
    this.phaseT = 99;
    this.events.push({ type: 'whistle', kind: 'end' });
    const winner = this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : -1;
    for (const p of this.players) {
      p.setState(winner === -1 ? 'run' : p.team === winner ? 'celebrate' : 'sad');
    }
    this.ball.owner = null;
  }

  private updatePlayersIdle(dt: number, celebrate = false) {
    for (const p of this.players) {
      p.stateT += dt;
      if (celebrate && (p.state === 'celebrate' || p.state === 'sad')) {
        // chi festeggia corre verso il marcatore
        const s = this.ball.lastTouch;
        if (p.state === 'celebrate' && s && p !== s) {
          const d = dist(p, s);
          if (d > 18) {
            const n = norm(s.x - p.x, s.y - p.y);
            p.vx += (n.x * 110 - p.vx) * Math.min(1, dt * 4);
            p.vy += (n.y * 110 - p.vy) * Math.min(1, dt * 4);
          } else {
            p.vx *= 0.9;
            p.vy *= 0.9;
          }
        } else {
          p.vx *= 0.9;
          p.vy *= 0.9;
        }
      } else {
        p.vx *= 0.85;
        p.vy *= 0.85;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.runPhase += len(p.vx, p.vy) * dt * 0.12;
      if (len(p.vx, p.vy) > 10) p.facing = Math.atan2(p.vy, p.vx);
    }
  }

  private updatePlay(dt: number, input: HumanInput) {
    this.timeLeft -= dt;
    this.elapsed += dt;
    if (this.ball.owner) this.stats.possession[this.ball.owner.team] += dt;

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.score[0] === this.score[1] && this.cfg.goldenGoal && !this.goldenGoal) {
        this.goldenGoal = true;
        this.phase = 'golden';
        this.phaseT = 2.2;
        this.events.push({ type: 'whistle', kind: 'golden' });
        return;
      }
      if (!this.goldenGoal) {
        this.endMatch();
        return;
      }
    }

    // timer di squadra
    for (const t of [0, 1] as const) {
      if (this.turbo[t] > 0) this.turbo[t] -= dt;
      if (this.wall[t] > 0) this.wall[t] -= dt;
    }
    this.updateWind(dt);
    this.updatePowerUps(dt);

    // decisioni
    this.handleHuman(dt, input);
    for (const p of this.players) {
      p.kickCd -= dt;
      p.tackleCd -= dt;
      p.pickupCd -= dt;
      p.saveCd -= dt;
      if (this.isHuman(p)) continue;
      if (p.isGK) {
        aiGoalkeeper(this, p, dt);
      } else {
        p.thinkT -= dt;
        if (p.thinkT <= 0) {
          p.thinkT = this.diff[p.team].think * this.rng.range(0.8, 1.25);
          aiThink(this, p);
        }
        decideAiActions(this, p, dt);
      }
    }

    // movimento
    for (const p of this.players) this.movePlayer(p, dt);
    this.separatePlayers();
    this.handleSteals(dt);
    this.updateBallPhysics(dt);
    this.handleBallPickup();
    this.autoSwitch(dt);
  }

  // ---------- umano ----------
  private handleHuman(dt: number, input: HumanInput) {
    const h = this.human;
    if (!h) return;
    const mag = Math.min(1, len(input.mx, input.my));
    if (mag > 0.15) {
      const n = norm(input.mx, input.my);
      h.wantX = n.x * mag;
      h.wantY = n.y * mag;
    } else {
      h.wantX = h.wantY = 0;
    }
    h.wantSprint = input.sprint;

    const owns = this.ball.owner === h;
    const shootPressed = input.shoot && !this.prevShoot;
    const shootReleased = !input.shoot && this.prevShoot;
    const passPressed = input.pass && !this.prevPass;

    if (owns) {
      if (shootPressed) {
        this.charging = true;
        this.charge = 0;
      }
      if (this.charging && input.shoot) {
        this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
      }
      if (this.charging && shootReleased) {
        this.charging = false;
        const dir = mag > 0.15 ? Math.atan2(input.my, input.mx) : h.facing;
        this.shoot(h, dir, 0.3 + this.charge * 0.7, true);
        this.charge = 0;
        return;
      }
      if (passPressed && !this.charging) {
        const dir = mag > 0.15 ? Math.atan2(input.my, input.mx) : h.facing;
        const target = chooseHumanPassTarget(this, h, dir);
        if (target) {
          this.pass(h, target);
          this.setHuman(target.idx);
        } else {
          // nessun compagno: lancio in avanti
          this.kickBall(h, dir, 300, 40, 0);
          this.events.push({ type: 'pass', x: h.x, y: h.y, team: h.team });
        }
      }
    } else {
      this.charging = false;
      this.charge = 0;
      if (shootPressed && h.canAct && h.tackleCd <= 0) {
        const dir = mag > 0.15 ? Math.atan2(input.my, input.mx) : h.facing;
        this.startSlide(h, dir);
      }
      if (passPressed && !this.teamHasBall(h.team)) {
        this.switchToBest(true);
      }
    }
  }

  setHuman(idx: number) {
    if (this.humanTeam === null || idx === this.humanIdx) return;
    this.humanIdx = idx;
    this.switchCd = 0.5;
    this.charging = false;
    this.events.push({ type: 'switch', id: this.teams[this.humanTeam][idx].id });
  }

  private switchToBest(force: boolean) {
    if (this.humanTeam === null) return;
    const b = this.ball;
    const team = this.teams[this.humanTeam];
    let best = -1;
    let bestD = Infinity;
    for (const p of team) {
      if (p.isGK) continue;
      // punta un po' davanti alla palla
      const d = dist(p, { x: b.x + b.vx * 0.25, y: b.y + b.vy * 0.25 });
      if (d < bestD) {
        bestD = d;
        best = p.idx;
      }
    }
    if (best < 0) return;
    if (force && best === this.humanIdx) {
      // passa al secondo più vicino
      let second = -1;
      let sd = Infinity;
      for (const p of team) {
        if (p.isGK || p.idx === this.humanIdx) continue;
        const d = dist(p, b);
        if (d < sd) {
          sd = d;
          second = p.idx;
        }
      }
      if (second >= 0) this.setHuman(second);
      return;
    }
    const cur = team[this.humanIdx];
    if (force || dist(cur, b) - bestD > 40) this.setHuman(best);
  }

  private autoSwitch(dt: number) {
    if (this.humanTeam === null) return;
    this.switchCd -= dt;
    const b = this.ball;
    const team = this.humanTeam;
    if (b.owner && b.owner.team === team) {
      if (!b.owner.isGK && b.owner.idx !== this.humanIdx) this.setHuman(b.owner.idx);
      return;
    }
    // passaggio in arrivo a un compagno: controllo a lui
    if (b.passTarget && b.passTarget.team === team && !b.passTarget.isGK) {
      if (b.passTarget.idx !== this.humanIdx) this.setHuman(b.passTarget.idx);
      return;
    }
    if (this.switchCd <= 0) this.switchToBest(false);
  }

  // ---------- azioni ----------
  startSlide(p: Player, dir: number) {
    p.setState('slide', 0);
    p.facing = dir;
    const sp = 230 * p.def.stats.speed;
    p.vx = Math.cos(dir) * sp;
    p.vy = Math.sin(dir) * sp;
    p.tackleCd = 0.9;
    this.events.push({ type: 'slide', x: p.x, y: p.y });
  }

  kickBall(p: Player, dir: number, speed: number, vz: number, spin: number) {
    const b = this.ball;
    b.owner = null;
    b.lastTouch = p;
    b.x = p.x + Math.cos(dir) * 8;
    b.y = p.y + Math.sin(dir) * 8;
    b.vx = Math.cos(dir) * speed;
    b.vy = Math.sin(dir) * speed;
    b.vz = vz;
    b.z = Math.max(b.z, 1);
    b.spin = spin;
    b.passTarget = null;
    b.isShot = false;
    p.kickCd = 0.32;
    p.holdT = 0;
    p.facing = dir;
    if (p.state === 'run') p.setState('kick', 0);
  }

  /** Tiro: `power` 0..1. `assist` corregge leggermente la mira verso la porta. */
  shoot(p: Player, dir: number, power: number, assist: boolean) {
    const team = p.team;
    const gx = this.oppGoalX(team);
    const toGoal = Math.atan2(this.H / 2 - p.y, gx - p.x);
    const dGoal = len(gx - p.x, this.H / 2 - p.y);
    let superShot = false;
    if (this.superBar[team] >= 1 && power > 0.85) {
      superShot = true;
      this.superBar[team] = 0;
    }
    const fire = this.fireShot[team];
    this.fireShot[team] = false;

    if (assist && dGoal < 420) {
      const d = Math.abs(Math.atan2(Math.sin(dir - toGoal), Math.cos(dir - toGoal)));
      const c = Math.cos(dir);
      if (d < 0.9 && (gx - p.x) * c > 0) {
        // dove attraverserebbe la linea di porta? la mira viene portata dentro lo specchio
        const crossY = p.y + Math.tan(dir) * (gx - p.x);
        const goalHalf = this.pitch.goalWidth / 2 - 9;
        const ty = clamp(crossY, this.H / 2 - goalHalf, this.H / 2 + goalHalf);
        const target = Math.atan2(ty - p.y, gx - p.x);
        dir += Math.atan2(Math.sin(target - dir), Math.cos(target - dir)) * 0.75;
      }
    }
    const st = p.def.stats.shot;
    const err = (1 - power * 0.4) * 0.05 + (1.15 - st) * 0.08 + (this.isHuman(p) ? 0 : this.diff[team].shotErr);
    dir += this.rng.range(-err, err) * (superShot ? 0.2 : 1);
    let speed = (250 + power * 330) * (0.85 + st * 0.18);
    let vz = 20 + 105 * power * power + this.rng.range(0, 15);
    let spin = 0;
    if (fire) speed *= 1.3;
    if (superShot) {
      speed *= 1.4;
      vz = 60;
      // effetto a giro: parte larga e rientra
      spin = (this.rng.chance(0.5) ? 1 : -1) * 520;
      dir -= Math.sign(spin) * 0.22;
    }
    this.kickBall(p, dir, speed, vz, spin);
    const b = this.ball;
    b.fire = fire;
    b.superShot = superShot;
    b.isShot = true;
    this.stats.shots[team]++;
    this.events.push({ type: 'shot', x: p.x, y: p.y, power, team, superShot, fire });
  }

  pass(p: Player, target: Player) {
    const b = this.ball;
    const lead = 0.35;
    const tx = target.x + target.vx * lead;
    const ty = target.y + target.vy * lead;
    const d = len(tx - p.x, ty - p.y);
    const speed = clamp(140 + d * 1.15, 190, 470) * (0.9 + p.def.stats.pass * 0.12) * Math.sqrt(this.pitch.ballFriction);
    const err = (1.15 - p.def.stats.pass) * 0.06;
    const dir = Math.atan2(ty - p.y, tx - p.x) + this.rng.range(-err, err);
    const lob = d > 260 ? 90 : 0;
    this.kickBall(p, dir, lob ? speed * 0.85 : speed, lob, 0);
    b.passTarget = target;
    this.stats.passes[p.team]++;
    this.events.push({ type: 'pass', x: p.x, y: p.y, team: p.team });
  }

  addSuper(team: 0 | 1, amount: number) {
    const before = this.superBar[team];
    this.superBar[team] = Math.min(1, before + amount);
    if (before < 1 && this.superBar[team] >= 1) this.events.push({ type: 'superReady', team });
  }

  // ---------- movimento giocatori ----------
  maxSpeed(p: Player): number {
    let s = 128 * p.def.stats.speed * this.pitch.playerSpeed;
    if (!this.isHuman(p)) s *= this.diff[p.team].speed;
    if (p.sprinting) s *= 1.32;
    if (this.ball.owner === p) s *= 0.92;
    if (this.turbo[p.team] > 0) s *= 1.2;
    if (p.isGK) s *= 1.05;
    return s;
  }

  private movePlayer(p: Player, dt: number) {
    p.stateT += dt;
    const grip = this.pitch.playerGrip;
    if (p.state === 'slide') {
      const f = Math.exp(-3.2 * dt);
      p.vx *= f;
      p.vy *= f;
      if (p.stateT > 0.55) p.setState('stun', 0.0);
      this.slideHits(p);
    } else if (p.state === 'stun') {
      const f = Math.exp(-8 * dt);
      p.vx *= f;
      p.vy *= f;
      if (p.stateT > 0.45) p.setState('run');
    } else if (p.state === 'dive') {
      const f = Math.exp(-2.5 * dt);
      p.vx *= f;
      p.vy *= f;
      if (p.stateT > 0.7) p.setState('stun', 0.2);
    } else {
      if (p.state === 'kick' && p.stateT > 0.22) p.setState('run');
      // sprint e fiato
      const wantsSprint = p.wantSprint && (p.stamina > 0.05 || this.turbo[p.team] > 0);
      p.sprinting = wantsSprint && len(p.wantX, p.wantY) > 0.3;
      if (p.sprinting && this.turbo[p.team] <= 0) p.stamina = Math.max(0, p.stamina - dt * 0.32);
      else p.stamina = Math.min(1, p.stamina + dt * 0.18);
      const ms = this.maxSpeed(p);
      const dvx = p.wantX * ms - p.vx;
      const dvy = p.wantY * ms - p.vy;
      const acc = 950 * grip * (p.state === 'kick' ? 0.4 : 1);
      const dl = len(dvx, dvy);
      const step = Math.min(dl, acc * dt);
      if (dl > 1e-3) {
        p.vx += (dvx / dl) * step;
        p.vy += (dvy / dl) * step;
      }
      const wl = len(p.wantX, p.wantY);
      if (wl > 0.1) {
        const target = Math.atan2(p.wantY, p.wantX);
        const turn = (this.ball.owner === p ? 9 : 14) * dt;
        p.facing = turnTowards(p.facing, target, turn);
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const sp = len(p.vx, p.vy);
    p.runPhase += sp * dt * 0.11;
    // limiti del campo
    const m = 4;
    const minX = p.isGK ? -6 : m;
    const maxX = p.isGK ? this.W + 6 : this.W - m;
    if (p.x < minX) {
      p.x = minX;
      p.vx = Math.max(0, p.vx);
    }
    if (p.x > maxX) {
      p.x = maxX;
      p.vx = Math.min(0, p.vx);
    }
    if (p.y < m) {
      p.y = m;
      p.vy = Math.max(0, p.vy);
    }
    if (p.y > this.H - m) {
      p.y = this.H - m;
      p.vy = Math.min(0, p.vy);
    }
    if (p === this.ball.owner) p.holdT += dt;
  }

  private separatePlayers() {
    const ps = this.players;
    const minD = PLAYER_R * 2;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD * minD && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  /** Scivolata: chi la fa può rubare palla o far cadere l'avversario. */
  private slideHits(p: Player) {
    const b = this.ball;
    if (p.stateT > 0.4) return;
    const owner = b.owner;
    if (owner && owner.team !== p.team && !(owner.isGK && this.inOwnBox(owner.team, owner.x, owner.y))) {
      if (dist(p, b) < 11 || dist(p, owner) < 12) {
        const ratio = p.def.stats.tackle / (owner.def.stats.control + 0.2);
        const won = this.rng.chance(clamp(0.55 + ratio * 0.3, 0.4, 0.95));
        this.events.push({ type: 'tackle', x: b.x, y: b.y, won, team: p.team });
        if (won) {
          b.owner = null;
          const dir = p.facing + this.rng.range(-0.6, 0.6);
          b.vx = Math.cos(dir) * 200 + p.vx * 0.3;
          b.vy = Math.sin(dir) * 200 + p.vy * 0.3;
          b.vz = 60;
          b.lastTouch = p;
          b.passTarget = null;
          owner.setState('stun', 0);
          owner.pickupCd = 0.6;
          this.stats.tackles[p.team]++;
          this.addSuper(p.team, 0.14);
        }
        p.stateT = Math.max(p.stateT, 0.4);
      }
    } else if (!owner && b.z < 10 && dist(p, b) < 10 && p.kickCd <= 0) {
      // tocca una palla libera: la allontana nella direzione della scivolata
      b.vx = Math.cos(p.facing) * 230 + p.vx * 0.2;
      b.vy = Math.sin(p.facing) * 230 + p.vy * 0.2;
      b.vz = 40;
      b.lastTouch = p;
      b.passTarget = null;
      b.isShot = false;
      p.kickCd = 0.3;
    }
  }

  /** Contrasto "in piedi": un difensore che pressa può soffiare la palla. */
  private handleSteals(dt: number) {
    const b = this.ball;
    const owner = b.owner;
    if (!owner) return;
    if (owner.isGK && this.inOwnBox(owner.team, owner.x, owner.y)) return;
    for (const p of this.teams[owner.team === 0 ? 1 : 0]) {
      if (!p.canAct || p.pickupCd > 0) continue;
      const d = dist(p, b);
      if (d > 10) continue;
      const rate = this.isHuman(p) ? 1.6 : 1.1 * this.diff[p.team].steal;
      const chance = rate * (p.def.stats.tackle / owner.def.stats.control) * dt * 2.2;
      if (this.rng.chance(chance)) {
        b.owner = p;
        b.lastTouch = p;
        p.holdT = 0;
        owner.pickupCd = 0.7;
        owner.setState('stun', 0.15);
        this.events.push({ type: 'steal', x: b.x, y: b.y, team: p.team });
        this.stats.tackles[p.team]++;
        this.addSuper(p.team, 0.1);
        return;
      }
    }
  }

  private syncOwnedBall() {
    const b = this.ball;
    const o = b.owner;
    if (!o) return;
    const off = 7 + Math.sin(o.runPhase * 2) * 1.6 * Math.min(1, len(o.vx, o.vy) / 80);
    b.x = o.x + Math.cos(o.facing) * off;
    b.y = o.y + Math.sin(o.facing) * off + 1;
    b.z = 0;
    b.vx = o.vx;
    b.vy = o.vy;
    b.vz = 0;
    b.roll += len(o.vx, o.vy) * 0.016;
  }

  // ---------- palla ----------
  updateBallPhysics(dt: number) {
    const b = this.ball;
    if (b.owner) {
      this.syncOwnedBall();
      // la palla non esce dal campo mentre si dribbla
      b.x = clamp(b.x, BALL_R, this.W - BALL_R);
      b.y = clamp(b.y, BALL_R, this.H - BALL_R);
      return;
    }
    // sotto-passi per evitare che la palla "salti" i pali
    const steps = Math.max(1, Math.ceil((b.speed * dt) / 4));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.ballStep(h);
      if (this.phase !== 'play' && this.phase !== 'goal' && this.phase !== 'end') break;
    }
  }

  private ballStep(dt: number) {
    const b = this.ball;
    // effetto
    if (b.spin !== 0) {
      const s = b.speed;
      if (s > 1) {
        b.vx += (-b.vy / s) * b.spin * dt;
        b.vy += (b.vx / s) * b.spin * dt;
      }
      b.spin *= Math.exp(-1.6 * dt);
    }
    // vento
    if (this.pitch.wind && b.z > 1) {
      b.vx += this.wind.x * dt;
      b.vy += this.wind.y * dt;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.z > 0) {
      b.vz -= GRAVITY * dt;
      const air = Math.exp(-0.15 * dt);
      b.vx *= air;
      b.vy *= air;
    }
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -40) {
        b.vz = -b.vz * this.pitch.ballBounce;
        if (b.vz > 25) this.events.push({ type: 'bounce', x: b.x, y: b.y, power: b.vz });
      } else b.vz = 0;
      if (b.vz === 0) {
        const k = 0.95 * this.pitch.ballFriction;
        const f = Math.exp(-k * dt);
        b.vx *= f;
        b.vy *= f;
        const s = b.speed;
        const lin = 30 * this.pitch.ballFriction * dt;
        if (s <= lin) {
          b.vx = b.vy = 0;
        } else {
          b.vx -= (b.vx / s) * lin;
          b.vy -= (b.vy / s) * lin;
        }
      }
    }
    b.roll += b.speed * dt * 0.25;
    if (b.speed < 120) {
      b.isShot = false;
      if (b.speed < 60) {
        b.fire = false;
        b.superShot = false;
      }
    }
    this.ballCollisions();
  }

  private ballCollisions() {
    const b = this.ball;
    const W = this.W;
    const H = this.H;
    const r = BALL_R;
    const wb = this.pitch.wallBounce;
    const inMouth = b.y > this.goalTop + r && b.y < this.goalBottom - r;
    const underBar = b.z < CROSSBAR;
    // muro (power-up) davanti alla porta
    for (const t of [0, 1] as const) {
      if (this.wall[t] <= 0) continue;
      const wx = t === 0 ? 10 : W - 10;
      const dir = t === 0 ? -1 : 1; // la palla che va verso la porta di t
      if (b.y > this.goalTop - 14 && b.y < this.goalBottom + 14 && b.z < 34) {
        if (dir < 0 && b.x < wx + r && b.x > wx - 8 && b.vx < 0) {
          b.x = wx + r;
          b.vx = -b.vx * 0.8;
          this.events.push({ type: 'wall', x: b.x, y: b.y, power: Math.abs(b.vx) });
          b.isShot = false;
        } else if (dir > 0 && b.x > wx - r && b.x < wx + 8 && b.vx > 0) {
          b.x = wx - r;
          b.vx = -b.vx * 0.8;
          this.events.push({ type: 'wall', x: b.x, y: b.y, power: Math.abs(b.vx) });
          b.isShot = false;
        }
      }
    }

    // pali
    for (const gx of [0, W]) {
      for (const gy of [this.goalTop, this.goalBottom]) {
        const dx = b.x - gx;
        const dy = b.y - gy;
        const d = len(dx, dy);
        if (d < r + 2 && b.z < CROSSBAR + 2) {
          const nx = dx / (d || 1);
          const ny = dy / (d || 1);
          const dot = b.vx * nx + b.vy * ny;
          if (dot < 0) {
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
            b.vx *= 0.7;
            b.vy *= 0.7;
            this.events.push({ type: 'post', x: gx, y: gy });
            b.isShot = false;
          }
          b.x = gx + nx * (r + 2);
          b.y = gy + ny * (r + 2);
        }
      }
    }

    // dentro la porta: rete
    const insideLeft = b.x < 0 && b.y > this.goalTop && b.y < this.goalBottom;
    const insideRight = b.x > W && b.y > this.goalTop && b.y < this.goalBottom;
    if (insideLeft || insideRight) {
      if (this.phase === 'play' && b.z < CROSSBAR) {
        if (insideLeft && b.x < -r) this.scoreGoal(1);
        else if (insideRight && b.x > W + r) this.scoreGoal(0);
      }
      const back = insideLeft ? -GOAL_DEPTH : W + GOAL_DEPTH;
      if (insideLeft && b.x < back + r) {
        b.x = back + r;
        b.vx = Math.abs(b.vx) * 0.15;
        b.vy *= 0.5;
      }
      if (insideRight && b.x > back - r) {
        b.x = back - r;
        b.vx = -Math.abs(b.vx) * 0.15;
        b.vy *= 0.5;
      }
      if (b.y < this.goalTop + r) {
        b.y = this.goalTop + r;
        b.vy = Math.abs(b.vy) * 0.2;
      }
      if (b.y > this.goalBottom - r) {
        b.y = this.goalBottom - r;
        b.vy = -Math.abs(b.vy) * 0.2;
      }
      if (b.z > CROSSBAR - 4) {
        b.z = CROSSBAR - 4;
        b.vz = -Math.abs(b.vz) * 0.3;
      }
      return;
    }

    // sponde laterali e di fondo
    if (b.x < r && !(inMouth && underBar)) {
      b.x = r;
      if (b.vx < 0) {
        b.vx = -b.vx * wb;
        this.wallHit(Math.abs(b.vx));
      }
    }
    if (b.x > W - r && !(inMouth && underBar)) {
      b.x = W - r;
      if (b.vx > 0) {
        b.vx = -b.vx * wb;
        this.wallHit(Math.abs(b.vx));
      }
    }
    if (b.y < r) {
      b.y = r;
      if (b.vy < 0) {
        b.vy = -b.vy * wb;
        this.wallHit(Math.abs(b.vy));
      }
    }
    if (b.y > H - r) {
      b.y = H - r;
      if (b.vy > 0) {
        b.vy = -b.vy * wb;
        this.wallHit(Math.abs(b.vy));
      }
    }
  }

  private wallHit(power: number) {
    const b = this.ball;
    b.isShot = false;
    b.passTarget = null;
    if (power > 60) this.events.push({ type: 'wall', x: b.x, y: b.y, power });
  }

  private handleBallPickup() {
    const b = this.ball;
    if (b.owner || this.phase !== 'play') return;
    let best: Player | null = null;
    let bestD = 11;
    for (const p of this.players) {
      if (!p.canAct || p.kickCd > 0 || p.pickupCd > 0) continue;
      if (p.isGK) continue; // il portiere ha la sua logica di parata/presa
      const reach = b.z < 14;
      if (!reach) continue;
      const d = dist(p, b);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    const p = best;
    const s = b.speed;
    const friendly = b.lastTouch && b.lastTouch.team === p.team;
    const intended = b.passTarget === p;
    // controllo di palle veloci
    const limit = (intended ? 520 : friendly ? 420 : 340) * p.def.stats.control;
    if (s > limit && !(b.fire && p.team !== b.lastTouch?.team)) {
      if (s > limit) {
        // respinta (deviazione)
        const a = Math.atan2(b.vy, b.vx) + this.rng.range(-1.2, 1.2);
        const ns = s * 0.4;
        b.vx = Math.cos(a) * ns;
        b.vy = Math.sin(a) * ns;
        b.vz = 50;
        b.lastTouch = p;
        b.isShot = false;
        b.passTarget = null;
        p.kickCd = 0.2;
        this.events.push({ type: 'bounce', x: b.x, y: b.y, power: 80 });
        return;
      }
    }
    if (b.fire && b.lastTouch && b.lastTouch.team !== p.team) {
      // un tiro di fuoco travolge chi lo intercetta
      p.setState('stun', 0);
      p.vx = b.vx * 0.3;
      p.vy = b.vy * 0.3;
      b.vx *= 0.75;
      b.vy *= 0.75;
      p.pickupCd = 0.6;
      this.events.push({ type: 'bounce', x: b.x, y: b.y, power: 120 });
      return;
    }
    const prev = b.lastTouch;
    if (prev && prev !== p && prev.team === p.team && b.passTarget) this.addSuper(p.team, 0.08);
    b.owner = p;
    b.lastTouch = p;
    b.passTarget = null;
    b.isShot = false;
    b.fire = false;
    b.superShot = false;
    b.spin = 0;
    p.holdT = 0;
    if (s > 30) p.facing = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI; // si gira verso la palla
    if (p.team !== this.humanTeam || !this.isHuman(p)) {
      // l'IA guarda verso la porta avversaria dopo lo stop
      if (!this.isHuman(p)) p.facing = Math.atan2(this.H / 2 - p.y, this.oppGoalX(p.team) - p.x);
    }
  }

  // ---------- portiere (contatto con la palla) ----------
  /** Il portiere prova a fermare la palla: chiamata da aiGoalkeeper. */
  keeperContact(gk: Player) {
    const b = this.ball;
    if (b.owner || gk.saveCd > 0 || gk.kickCd > 0) return;
    const diving = gk.state === 'dive';
    const reach = diving ? 13 : 9;
    if (b.z > (diving ? 30 : 24)) return;
    const d = dist(gk, b);
    if (d > reach) return;
    gk.saveCd = 0.35;
    const s = b.speed;
    const shotFromOpp = b.lastTouch && b.lastTouch.team !== gk.team;
    const kp = gk.def.stats.keeping * this.diff[gk.team].keeper;
    if (shotFromOpp && s > 200) {
      // probabilità di parare
      let p = clamp(1.05 - (s - 200) / 900, 0.35, 0.95) * kp;
      if (b.superShot) p *= 0.45;
      if (b.fire) p *= 0.6;
      if (!this.rng.chance(clamp(p, 0.1, 0.97))) {
        gk.saveCd = 1;
        return; // battuto!
      }
      const canCatch = !b.fire && !b.superShot && s < 330 * kp;
      if (canCatch) {
        this.keeperCatch(gk);
        this.events.push({ type: 'save', x: b.x, y: b.y, catch: true, team: gk.team });
      } else {
        // respinta
        const out = this.dirOf(gk.team);
        const a = Math.atan2(this.rng.range(-1, 1), out) + this.rng.range(-0.5, 0.5);
        const ns = s * this.rng.range(0.3, 0.5);
        b.vx = Math.cos(a) * ns;
        b.vy = Math.sin(a) * ns;
        b.vz = this.rng.range(40, 110);
        b.lastTouch = gk;
        b.isShot = false;
        b.fire = false;
        b.superShot = false;
        b.spin = 0;
        b.passTarget = null;
        gk.kickCd = 0.4;
        this.events.push({ type: 'save', x: b.x, y: b.y, catch: false, team: gk.team });
      }
      return;
    }
    // palla lenta o retropassaggio: la prende
    this.keeperCatch(gk);
  }

  private keeperCatch(gk: Player) {
    const b = this.ball;
    b.owner = gk;
    b.lastTouch = gk;
    b.stop();
    b.fire = b.superShot = b.isShot = false;
    b.passTarget = null;
    gk.holdT = 0;
    gk.facing = gk.team === 0 ? 0 : Math.PI;
  }

  // ---------- vento e power-up ----------
  private updateWind(dt: number) {
    if (!this.pitch.wind) return;
    this.windT -= dt;
    if (this.windT <= 0) {
      this.windT = this.rng.range(9, 15);
      const a = this.rng.range(0, Math.PI * 2);
      const m = this.rng.range(40, 110);
      this.wind = { x: Math.cos(a) * m, y: Math.sin(a) * m };
    }
  }

  private updatePowerUps(dt: number) {
    if (!this.cfg.powerUps) return;
    this.powerUpT -= dt;
    if (this.powerUpT <= 0 && this.powerUps.length < 2) {
      this.powerUpT = this.rng.range(13, 20);
      const kinds: PowerUpKind[] = ['fuoco', 'turbo', 'muro'];
      const kind = this.rng.pick(kinds);
      const pu: PowerUp = {
        id: this.nextPowerUpId++,
        kind,
        x: this.rng.range(this.W * 0.25, this.W * 0.75),
        y: this.rng.range(this.H * 0.15, this.H * 0.85),
        life: 14,
      };
      this.powerUps.push(pu);
      this.events.push({ type: 'powerupSpawn', kind, x: pu.x, y: pu.y });
    }
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.life -= dt;
      let taken: Player | null = null;
      for (const p of this.players) {
        if (dist(p, pu) < 12) {
          taken = p;
          break;
        }
      }
      // anche la palla può raccoglierlo: vale per chi l'ha toccata per ultimo
      if (!taken && this.ball.z < 10 && dist(this.ball, pu) < 9 && this.ball.lastTouch) taken = this.ball.lastTouch;
      if (taken) {
        this.applyPowerUp(pu.kind, taken.team);
        this.events.push({ type: 'powerup', kind: pu.kind, team: taken.team, x: pu.x, y: pu.y });
        this.powerUps.splice(i, 1);
      } else if (pu.life <= 0) {
        this.powerUps.splice(i, 1);
      }
    }
  }

  applyPowerUp(kind: PowerUpKind, team: 0 | 1) {
    if (kind === 'fuoco') this.fireShot[team] = true;
    else if (kind === 'turbo') this.turbo[team] = 8;
    else this.wall[team] = 9;
  }
}
