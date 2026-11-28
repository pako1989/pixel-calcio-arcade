import Phaser from 'phaser';
import type { Difficulty, PlayerDef, TeamDef, Weather } from '../sim/types';
import type { MatchOutcome } from '../modes/modes';
import { FRAME, frameIndex, makePlayerSheet } from '../gfx/sprites';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { commentary } from '../audio/commentary';
import { Rng } from '../sim/math';
import { backToMenu } from './demo';
import { drawGoalBackground, drawGoalNet, GOAL_H, GOAL_HW, GROUND_Y, SPOT_Y } from '../gfx/goalView';
import { save } from '../save/storage';
import { newAlbum } from '../modes/album';
import {
  cpuDive,
  cpuReach,
  cpuShot,
  goals,
  isOver,
  keeperOf,
  newShootout,
  nextTeam,
  resolveShot,
  takers,
  taken,
  userReach,
  userShot,
  winner,
  type GoalPoint,
  type PenOutcome,
  type Shootout,
} from '../modes/penalties';

/** Un solo calcio di rigore durante la partita: la scena gioca il tiro e restituisce l'esito. */
export interface SinglePenalty {
  /** [squadra del giocatore, CPU]. */
  teams: [TeamDef, TeamDef];
  difficulty: Difficulty;
  /** Squadra che tira (0 = tiri tu, 1 = pari tu). */
  shooter: 0 | 1;
  taker: PlayerDef;
  keeper: PlayerDef;
  night?: boolean;
  weather?: Weather;
  /** Esito e punto della porta (u da -1 a 1). */
  onDone: (o: PenOutcome, u: number) => void;
}

/** Dati della scena: dopo una partita del torneo, la sfida ai rigori da sola o un rigore in partita. */
export interface PenaltyData {
  outcome?: MatchOutcome;
  standalone?: { home: TeamDef; away: TeamDef; difficulty: Difficulty };
  single?: SinglePenalty;
}

type Phase = 'intro' | 'aim' | 'power' | 'userKick' | 'cpuRun' | 'flight' | 'result' | 'end';

const LATE_WINDOW: Record<Difficulty, number> = { facile: 0.3, normale: 0.22, difficile: 0.15 };

export class PenaltyScene extends Phaser.Scene {
  private d!: PenaltyData;
  private teams!: [TeamDef, TeamDef];
  private diff: Difficulty = 'normale';
  private so!: Shootout;
  private rng = new Rng();
  private phase: Phase = 'intro';
  private phaseT = 0;
  private cx = 0;
  private keeper!: Phaser.GameObjects.Sprite;
  private kicker!: Phaser.GameObjects.Sprite;
  private ball!: Phaser.GameObjects.Sprite;
  private ballShadow!: Phaser.GameObjects.Image;
  private reticle!: Phaser.GameObjects.Graphics;
  private meterG!: Phaser.GameObjects.Graphics;
  private boardG!: Phaser.GameObjects.Graphics;
  private boardTxt: Phaser.GameObjects.Text[] = [];
  private hint!: Phaser.GameObjects.Text;
  private bigMsg?: Phaser.GameObjects.Container;
  private netG!: Phaser.GameObjects.Graphics;
  private aim: GoalPoint | null = null;
  private power = 0;
  private meterT = 0;
  private shot: GoalPoint = { u: 0, v: 0 };
  private dive: GoalPoint | null = null;
  private reach = 0.4;
  private outcome: PenOutcome = 'gol';
  private kickAt = 0;
  private diveAt = -1;
  private taker!: PlayerDef;
  private shooter: 0 | 1 = 0;
  private flightT = 0;
  private endLayer?: Phaser.GameObjects.Container;
  private beatT = 0;

  constructor() {
    super('penalties');
  }

  init(d: PenaltyData) {
    this.d = d;
    if (d.single) {
      this.teams = d.single.teams;
      this.diff = d.single.difficulty;
    } else if (d.outcome) {
      const c = d.outcome.launch.config;
      this.teams = [c.home, c.away];
      this.diff = c.difficulty;
    } else {
      const s = d.standalone!;
      this.teams = [s.home, s.away];
      this.diff = s.difficulty;
    }
    this.rng = new Rng(Date.now());
    this.so = newShootout(d.single ? d.single.shooter : this.rng.chance(0.5) ? 0 : 1);
    this.phase = 'intro';
    this.phaseT = d.single ? 1.1 : 2.2;
    this.aim = null;
    this.dive = null;
    this.bigMsg = undefined;
    this.endLayer = undefined;
    this.boardTxt = [];
  }

  private map(p: GoalPoint): { x: number; y: number } {
    return { x: this.cx + p.u * GOAL_HW, y: GROUND_Y - p.v * GOAL_H };
  }

  private unmap(x: number, y: number): GoalPoint {
    return { u: (x - this.cx) / GOAL_HW, v: (GROUND_Y - y) / GOAL_H };
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cx = Math.round(W / 2);
    this.cameras.main.fadeIn(300, 10, 8, 20);
    this.drawBackground(W, H);

    this.netG = this.add.graphics().setDepth(2);
    this.drawNet(0);

    this.keeper = this.add.sprite(this.cx, GROUND_Y + 2, '__DEFAULT').setScale(3.4).setDepth(5);
    this.kicker = this.add.sprite(this.cx - 40, H + 90, '__DEFAULT').setScale(4.2).setOrigin(0.5, 22 / FRAME).setDepth(8);
    this.ballShadow = this.add.image(this.cx, SPOT_Y + 4, 'ballShadow').setScale(3).setAlpha(0.35).setDepth(6);
    this.ball = this.add.sprite(this.cx, SPOT_Y, 'ball', 0).setScale(3).setOrigin(0.5, 0.75).setDepth(7);

    this.reticle = this.add.graphics().setDepth(20);
    this.meterG = this.add.graphics().setDepth(20);
    this.boardG = this.add.graphics().setDepth(30);
    this.hint = txt(this, this.cx, 66, '', 8, '#ffffff', { backgroundColor: '#0d0a1acc', padding: { x: 6, y: 4 } }).setDepth(30);

    // squadra e tiratore
    const one = this.d.single;
    if (one) {
      makePlayerSheet(this, `pen_${one.shooter}_0`, this.teams[one.shooter], one.taker);
      makePlayerSheet(this, `pen_gk_${1 - one.shooter}`, this.teams[1 - one.shooter], one.keeper);
    } else {
      for (const t of [0, 1] as const) {
        takers(this.teams[t]).forEach((p, i) => makePlayerSheet(this, `pen_${t}_${i}`, this.teams[t], p));
        makePlayerSheet(this, `pen_gk_${t}`, this.teams[t], keeperOf(this.teams[t]));
      }
    }

    button(this, W - 22, 18, 26, 22, 'II', () => this.togglePause(), { size: 8 }).c.setDepth(31);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.onKey());
    kb?.on('keydown-ENTER', () => this.onKey());

    if (one) {
      // rigore in partita: musica e pubblico restano quelli della partita
      this.showBig('RIGORE!', one.shooter === 0 ? 'Mira, poi ferma la barra nel verde' : 'Tocca dove ti tuffi', one.shooter === 0 ? '#ffd23f' : '#ff5a5a', 1100);
    } else {
      sfx.startCrowd(0.7);
      music.play('rigori');
      commentary.say('penStart');
      this.showBig('RIGORI!', this.d.outcome ? 'Pareggio: si decide dal dischetto' : `${this.teams[0].name} contro ${this.teams[1].name}`, '#ffd23f', 2000);
      this.drawBoard();
    }
    this.events.once('shutdown', () => {
      if (!this.d.outcome && !this.d.single) sfx.stopCrowd();
      this.input.removeAllListeners();
    });
  }

  // ---------- grafica fissa ----------

  private drawBackground(W: number, H: number) {
    const key = `penbg_${W}_${this.teams[0].id}_${this.teams[1].id}`;
    drawGoalBackground(this, W, H, [this.teams[0].colors.shirt, this.teams[1].colors.shirt], key);
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
    // pubblico che salta: alone che pulsa
    const oc = this.d.outcome?.launch.config;
    const night = this.d.single ? !!this.d.single.night : !!oc?.night || oc?.pitch.id === 'tetto';
    const weather = this.d.single ? this.d.single.weather : oc?.weather;
    this.drawWeather(W, weather);
    if (night) {
      this.add.rectangle(0, 0, W, H, 0x0a0d26, 0.35).setOrigin(0).setDepth(9);
      for (const x of [W * 0.12, W * 0.88]) this.add.image(x, 10, 'glow').setScale(6).setAlpha(0.35).setBlendMode('ADD').setDepth(9.5).setTint(0xfff6d0);
    }
  }

  /** Pioggia o neve anche dal dischetto. */
  private drawWeather(W: number, w?: Weather) {
    if (!w || w === 'sereno' || w === 'vento') return;
    if (w === 'nebbia') {
      this.add.rectangle(0, 0, W, this.scale.height, 0xc4ccd6, 0.16).setOrigin(0).setDepth(9);
      return;
    }
    const snow = w === 'neve';
    if (!snow && !this.textures.exists('streak')) {
      const sg = this.add.graphics();
      sg.fillStyle(0xffffff).fillRect(0, 0, 1, 7);
      sg.generateTexture('streak', 1, 7);
      sg.destroy();
    }
    this.add
      .particles(0, 0, snow ? 'px2' : 'streak', snow
        ? { x: { min: 0, max: W }, y: -8, lifespan: 4200, speedY: { min: 30, max: 60 }, speedX: { min: -14, max: 8 }, scale: { min: 2, max: 4 }, alpha: { min: 0.6, max: 1 }, frequency: 22 }
        : { x: { min: -40, max: W + 40 }, y: -10, lifespan: 800, speedY: { min: 460, max: 560 }, speedX: { min: -80, max: -50 }, rotate: 8, scaleY: 2, alpha: { min: 0.35, max: 0.65 }, tint: 0xcfe0ff, frequency: 8, quantity: 2 })
      .setDepth(9.6);
    if (!snow) this.add.rectangle(0, 0, W, this.scale.height, 0x1a2a4a, 0.18).setOrigin(0).setDepth(9);
  }

  /** Rete e pali; `bulge` gonfia la rete dopo un gol. */
  private drawNet(bulge: number, bx = 0) {
    drawGoalNet(this.netG, this.cx, bulge, bx);
  }

  // ---------- tabellone ----------

  private drawBoard() {
    const g = this.boardG;
    g.clear();
    this.boardTxt.forEach((t) => t.destroy());
    this.boardTxt = [];
    const n = Math.max(5, ...taken(this.so));
    const shown = Math.min(n, 9);
    const w = 96 + shown * 14;
    const x0 = this.cx - w / 2;
    panel(g, x0, 6, w, 40, 0x1b1d2e, 0x2e3250, 0.92);
    const [ga, gb] = goals(this.so);
    for (const t of [0, 1] as const) {
      const y = 17 + t * 18;
      const team = this.teams[t];
      g.fillStyle(team.colors.shirt).fillRect(x0 + 6, y - 5, 4, 10);
      this.boardTxt.push(txt(this, x0 + 14, y, team.short, 6, t === 0 ? '#ffd23f' : '#ffffff').setOrigin(0, 0.5).setDepth(31));
      this.boardTxt.push(txt(this, x0 + w - 8, y, String(t === 0 ? ga : gb), 8, '#ffffff').setOrigin(1, 0.5).setDepth(31));
      const ks = this.so.kicks.filter((k) => k.team === t);
      const off = Math.max(0, n - shown);
      for (let i = 0; i < shown; i++) {
        const k = ks[i + off];
        const x = x0 + 56 + i * 14;
        g.fillStyle(0x1a1222).fillCircle(x, y, 5);
        g.fillStyle(!k ? 0x3a3d55 : k.result === 'gol' ? 0x5be37d : 0xff5a5a).fillCircle(x, y, 4);
      }
    }
  }

  private showBig(text: string, sub: string | undefined, color: string, ms = 1300) {
    this.bigMsg?.destroy();
    const c = this.add.container(this.cx, 240).setDepth(40);
    const t = shadowTxt(this, 0, 0, text, text.length > 10 ? 16 : 24, color, '#1a1222', 3);
    c.add(t.c);
    if (sub) c.add(txt(this, 0, 26, sub, 6, '#ffffff', { backgroundColor: '#0d0a1acc', padding: { x: 4, y: 3 } }));
    c.setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 250, onComplete: () => c.destroy() });
    this.bigMsg = c;
  }

  // ---------- turni ----------

  private nextKick() {
    const one = this.d.single;
    if (one && this.so.kicks.length > 0) {
      // rigore in partita: un tiro solo, poi si torna in campo
      this.phase = 'end';
      this.cameras.main.fadeOut(220, 10, 8, 20);
      const res = this.outcome;
      const u = this.shot.u;
      this.time.delayedCall(230, () => {
        this.scene.stop();
        one.onDone(res, u);
      });
      return;
    }
    if (!one) this.drawBoard();
    if (isOver(this.so)) return this.finish();
    const t = nextTeam(this.so);
    this.shooter = t;
    const list = one ? [one.taker] : takers(this.teams[t]);
    const idx = one ? 0 : taken(this.so)[t] % list.length;
    this.taker = list[idx];
    // tiratore di spalle, portiere avversario in porta
    this.kicker.setTexture(`pen_${t}_${idx}`, frameIndex('up', 'idle')).setPosition(this.cx - 46, this.scale.height + 90).setFlipX(false);
    this.keeper.setTexture(`pen_gk_${1 - t}`, frameIndex('down', 'idle')).setPosition(this.cx, GROUND_Y + 2).setRotation(0).setOrigin(0.5, 22 / FRAME).setFlipX(false);
    this.ball.setPosition(this.cx, SPOT_Y).setScale(3).setVisible(true).setAngle(0);
    this.ballShadow.setPosition(this.cx, SPOT_Y + 4).setScale(3).setVisible(true);
    this.drawNet(0);
    this.aim = null;
    this.dive = null;
    this.diveAt = -1;
    this.power = 0;
    this.reticle.clear();
    this.meterG.clear();
    // il tiratore cammina verso il dischetto
    this.tweens.add({ targets: this.kicker, y: SPOT_Y + 46, duration: 450, ease: 'Sine.easeOut' });
    const human = t === 0;
    const sudden = !one && taken(this.so)[0] >= 5 && taken(this.so)[1] >= 5;
    const label = `${this.taker.name.toUpperCase()}${sudden ? ' · A OLTRANZA' : ''}`;
    if (human) {
      this.phase = 'aim';
      this.hint.setText(`${label}\nTocca la porta per mirare`).setAlign('center');
    } else {
      this.phase = 'cpuRun';
      this.phaseT = 0;
      this.kickAt = 1.5;
      this.hint.setText(`${label}\nTocca dove ti tuffi!`).setAlign('center');
    }
  }

  private onKey() {
    if (this.phase === 'aim') {
      this.aim = { u: 0.6 * (this.rng.chance(0.5) ? 1 : -1), v: 0.3 };
      this.startPower();
    } else if (this.phase === 'power') this.userKick();
  }

  private inGoalArea(p: Phaser.Input.Pointer) {
    return p.y < GROUND_Y + 40 && p.y > 40 && Math.abs(p.x - this.cx) < GOAL_HW + 60;
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.endLayer || this.scene.isPaused()) return;
    if (this.phase === 'aim' && this.inGoalArea(p)) {
      this.setAim(p);
    } else if (this.phase === 'power') {
      this.userKick();
    } else if ((this.phase === 'cpuRun' || this.phase === 'flight') && !this.dive && this.shooter === 1) {
      this.userDive(p);
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (this.phase === 'aim' && p.isDown && this.aim) this.setAim(p);
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (this.phase === 'aim' && this.aim) {
      this.setAim(p);
      this.startPower();
    }
  }

  private setAim(p: Phaser.Input.Pointer) {
    const a = this.unmap(p.x, p.y);
    this.aim = { u: Phaser.Math.Clamp(a.u, -1.1, 1.1), v: Phaser.Math.Clamp(a.v, 0.04, 1.1) };
    this.drawReticle();
  }

  private drawReticle() {
    const g = this.reticle;
    g.clear();
    if (!this.aim) return;
    const { x, y } = this.map(this.aim);
    // più vicino ai pali = più rischio (cerchio più grande)
    const risk = Math.max(0, Math.abs(this.aim.u) - 0.6) + Math.max(0, this.aim.v - 0.7);
    const r = 9 + (1.2 - this.taker.stats.shot) * 14 + risk * 20;
    g.lineStyle(3, 0x1a1222).strokeCircle(x, y, r);
    g.lineStyle(1, 0xffd23f).strokeCircle(x, y, r);
    g.fillStyle(0xffd23f).fillRect(x - 1, y - 6, 2, 12).fillRect(x - 6, y - 1, 12, 2);
  }

  private startPower() {
    this.phase = 'power';
    this.meterT = 0;
    this.hint.setText('Tocca quando la barra è nel VERDE!');
  }

  private drawMeter() {
    const g = this.meterG;
    g.clear();
    const x = this.scale.width - 46;
    const y0 = 110;
    const h = 170;
    g.fillStyle(0x1a1222).fillRect(x - 3, y0 - 3, 22, h + 6);
    g.fillStyle(0x3a3d55).fillRect(x, y0, 16, h);
    const zone = (a: number, b: number, c: number) => g.fillStyle(c).fillRect(x, y0 + h * (1 - b), 16, h * (b - a));
    zone(0, 0.55, 0x4a6080);
    zone(0.55, 0.82, 0x5be37d);
    zone(0.82, 0.9, 0xffd23f);
    zone(0.9, 1, 0xff5a5a);
    const yy = y0 + h * (1 - this.power);
    g.fillStyle(0xffffff).fillRect(x - 6, yy - 2, 28, 4);
    g.fillStyle(0x1a1222).fillRect(x - 6, yy + 2, 28, 1);
  }

  private userKick() {
    if (this.phase !== 'power') return;
    this.phase = 'userKick';
    this.phaseT = 0;
    this.kickAt = 0.35;
    this.hint.setText('');
    this.shot = userShot(this.aim!, this.power, this.taker, this.rng);
    const gk = this.d.single ? this.d.single.keeper : keeperOf(this.teams[1]);
    this.dive = cpuDive(this.shot, this.diff, this.power, this.rng);
    this.reach = cpuReach(gk, this.diff, this.power);
    this.outcome = resolveShot(this.shot, this.dive, this.reach);
  }

  private userDive(p: Phaser.Input.Pointer) {
    const late = this.phase === 'flight' ? this.flightT / LATE_WINDOW[this.diff] : 0;
    if (late > 1) return;
    const a = this.unmap(p.x, p.y);
    this.dive = { u: Phaser.Math.Clamp(a.u, -1.05, 1.05), v: Phaser.Math.Clamp(a.v, 0, 1) };
    this.diveAt = late;
    this.animateDive(this.dive, this.phase === 'flight' ? 260 : 380);
    // se il tiro è già partito, l'esito si ricalcola con il tuffo
    if (this.phase === 'flight') this.outcome = resolveShot(this.shot, this.dive, userReach(this.myKeeper(), late));
  }

  /** Il tiro parte: anima tiratore, palla e (per la CPU) il portiere. */
  private launchBall() {
    this.kicker.setFrame(frameIndex('up', 'kick'));
    sfx.kick(this.shooter === 0 ? this.power : 0.75);
    this.phase = 'flight';
    this.flightT = 0;
    if (this.shooter === 0) {
      if (this.dive) this.animateDive(this.dive, 330);
      else this.keeperHop();
    } else {
      // tiro della CPU: decide adesso dove va
      this.shot = cpuShot(this.taker, this.diff, this.rng, Math.max(0, taken(this.so)[1] - 4) * 0.5);
      this.reach = userReach(this.myKeeper(), Math.max(0, this.diveAt));
      this.outcome = resolveShot(this.shot, this.dive, this.reach);
      if (!this.dive) this.keeperHop();
    }
  }

  private myKeeper(): PlayerDef {
    return this.d.single ? this.d.single.keeper : keeperOf(this.teams[0]);
  }

  private keeperHop() {
    this.tweens.add({ targets: this.keeper, y: GROUND_Y - 12, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
  }

  private animateDive(d: GoalPoint, ms: number) {
    const { x, y } = this.map(d);
    const side = d.u < 0 ? -1 : 1;
    if (Math.abs(d.u) < 0.22) {
      // salto verso l'alto restando al centro
      this.keeper.setFrame(frameIndex('down', 'celebrate'));
      this.tweens.add({ targets: this.keeper, x, y: Math.min(GROUND_Y + 2, y + 50), duration: ms * 0.7, ease: 'Quad.easeOut' });
      return;
    }
    this.keeper.setFrame(frameIndex('side', 'dive')).setOrigin(0.5, 0.5).setFlipX(side < 0);
    this.keeper.setRotation(0);
    this.keeper.y = GROUND_Y - 30;
    this.tweens.add({
      targets: this.keeper,
      x: x - side * 22,
      y: Math.min(GROUND_Y - 14, y + 4),
      rotation: side * (d.v > 0.55 ? -0.35 : 0.15),
      duration: ms,
      ease: 'Quad.easeOut',
    });
  }

  private updateFlight(dt: number) {
    const DUR = 0.5;
    this.flightT += dt;
    const p = Math.min(1, this.flightT / DUR);
    const end = this.map(this.shot);
    const sx = this.cx;
    const sy = SPOT_Y;
    const e = 1 - (1 - p) * (1 - p) * 0.4 - (1 - p) * 0.6; // un po' più veloce all'inizio
    let x = sx + (end.x - sx) * e;
    let y = sy + (end.y - sy) * e - Math.sin(Math.PI * p) * 14;
    // parata: la palla rimbalza indietro quando arriva al portiere
    if (this.outcome === 'parato' && p > 0.82) {
      const q = (p - 0.82) / 0.18;
      x += (this.shot.u < 0 ? -1 : 1) * q * 30;
      y += q * 50;
    }
    this.ball.setPosition(x, y).setScale(3 - e * 1.6);
    this.ball.setFrame(Math.floor(this.flightT * 30) % 4);
    this.ballShadow.setPosition(x, sy + 4 + (GROUND_Y + 6 - sy - 4) * e).setScale(3 - e * 1.6).setAlpha(0.35 - e * 0.15);
    if (p >= 1) this.resolve();
  }

  private resolve() {
    this.phase = 'result';
    this.phaseT = 1.9;
    const res = this.outcome;
    this.so.kicks.push({ team: this.shooter, taker: this.taker.name, result: res });
    const mine = this.shooter === 0;
    const good = (res === 'gol') === mine;
    const { x, y } = this.map(this.shot);
    if (res === 'gol') {
      sfx.net();
      sfx.roar(mine ? 0.8 : 0.4);
      this.tweens.addCounter({ from: 1, to: 0, duration: 600, onUpdate: (tw) => this.drawNet(tw.getValue() ?? 0, this.shot.u) });
      this.tweens.add({ targets: this.ball, y: y + 6, duration: 300 });
      commentary.say('penGoal');
      this.showBig('GOL!', this.taker.name, good ? '#ffd23f' : '#ff5a5a');
      if (!mine && navigator.vibrate) navigator.vibrate(80);
    } else if (res === 'parato') {
      sfx.save();
      commentary.say('penSave');
      this.showBig('PARATO!', undefined, good ? '#3fd0ff' : '#ff5a5a');
      this.tweens.add({ targets: this.ball, y: SPOT_Y - 30, x: x + (this.shot.u < 0 ? -80 : 80), scale: 2.4, duration: 600, ease: 'Quad.easeOut' });
      if (mine === false && navigator.vibrate) navigator.vibrate([60, 40, 120]);
    } else if (res === 'palo') {
      sfx.post();
      sfx.ooh();
      commentary.say('penPost');
      this.showBig('PALO!', undefined, good ? '#3fd0ff' : '#ff5a5a');
      this.cameras.main.shake(150, 0.006);
      this.tweens.add({ targets: this.ball, y: GROUND_Y + 40, x: x - (this.shot.u < 0 ? -50 : 50), scale: 2, duration: 500, ease: 'Quad.easeOut' });
    } else {
      sfx.ooh();
      commentary.say('penMiss');
      this.showBig('FUORI!', undefined, good ? '#3fd0ff' : '#ff5a5a');
      this.tweens.add({ targets: this.ball, y: y - 60, x: x + (this.shot.u < 0 ? -40 : 40), scale: 0.8, alpha: 0, duration: 450 });
    }
    // reazioni
    if (res === 'gol') this.kicker.setFrame(frameIndex('up', 'celebrate'));
    else this.time.delayedCall(300, () => this.kicker.setFrame(frameIndex('up', 'sad')));
    if (this.d.single) this.phaseT = 1.3;
    else this.drawBoard();
    this.ballShadow.setVisible(false);
  }

  private finish() {
    this.phase = 'end';
    this.hint.setText('');
    const w = winner(this.so)!;
    const g = goals(this.so);
    const W = this.scale.width;
    const H = this.scale.height;
    music.stop(0.5);
    commentary.say('penWin', this.teams[w].name);
    if (w === 0) {
      sfx.fanfare();
      sfx.roar(1);
    } else sfx.sadJingle();
    const c = this.add.container(0, 0).setDepth(50);
    this.endLayer = c;
    const bg = this.add.rectangle(0, 0, W, H, 0x0a0816, 0.6).setOrigin(0);
    c.add(bg);
    const t = shadowTxt(this, W / 2, H / 2 - 50, w === 0 ? 'HAI VINTO!' : 'HAI PERSO', 24, w === 0 ? '#ffd23f' : '#ff5a5a', '#1a1222', 3);
    c.add(t.c);
    c.add(txt(this, W / 2, H / 2 - 14, `Rigori ${g[0]} - ${g[1]}  ·  passa ${this.teams[w].name}`, 8, '#ffffff'));
    if (w === 0) {
      const conf = this.add.particles(0, 0, 'confetti', {
        x: { min: 0, max: W },
        y: -6,
        lifespan: 3000,
        speedY: { min: 40, max: 110 },
        speedX: { min: -30, max: 30 },
        rotate: { min: 0, max: 360 },
        tint: [0xffd23f, 0xff5a5a, 0x3fd0ff, 0x5be37d, 0xffffff],
        frequency: 30,
        quantity: 2,
      }).setDepth(51);
      this.time.delayedCall(2500, () => conf.stop());
    }
    if (this.d.outcome) {
      const o = this.d.outcome;
      const b = button(this, W / 2, H / 2 + 40, 170, 32, 'CONTINUA', () => {
        this.scene.launch('result', { ...o, result: { ...o.result, penalties: g } });
        this.scene.stop();
      }, { color: COLORS.good, textColor: '#1a1222' });
      c.add(b.c);
    } else {
      // sfida ai rigori: un pacchetto di figurine (due se vinci)
      save((d) => {
        d.album = d.album ?? newAlbum();
        d.album.packs += w === 0 ? 2 : 1;
      });
      c.add(txt(this, W / 2, H / 2 + 6, `+${w === 0 ? 2 : 1} pacchetti di figurine`, 6, '#1a1222', { backgroundColor: '#ffd23f', padding: { x: 4, y: 3 } }));
      const again = button(this, W / 2 + 90, H / 2 + 40, 160, 32, 'RIVINCITA', () => this.scene.restart(this.d), { color: COLORS.good, textColor: '#1a1222' });
      const menu = button(this, W / 2 - 90, H / 2 + 40, 160, 32, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
      c.add([again.c, menu.c]);
    }
  }

  private pauseLayer?: Phaser.GameObjects.Container;

  private togglePause() {
    if (this.endLayer) return;
    if (this.pauseLayer) {
      this.pauseLayer.destroy();
      this.pauseLayer = undefined;
      this.tweens.resumeAll();
      return;
    }
    this.tweens.pauseAll();
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(0, 0, W, H, 0x0a0816, 0.75).setOrigin(0).setInteractive());
    c.add(shadowTxt(this, W / 2, H / 2 - 70, 'PAUSA', 24, '#ffd23f').c);
    c.add(button(this, W / 2, H / 2 - 24, 180, 26, 'RIPRENDI', () => this.togglePause(), { color: 0x2f8be0 }).c);
    c.add(button(this, W / 2, H / 2 + 12, 180, 26, 'AUDIO', () => {
      this.scene.launch('settings');
      this.scene.bringToTop('settings');
    }).c);
    if (!this.d.outcome && !this.d.single) c.add(button(this, W / 2, H / 2 + 48, 180, 26, 'ESCI AL MENU', () => backToMenu(this), { color: 0x8a3040 }).c);
    this.pauseLayer = c;
  }

  update(_t: number, deltaMs: number) {
    if (this.pauseLayer) return;
    const dt = Math.min(0.1, deltaMs / 1000);
    switch (this.phase) {
      case 'intro':
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.nextKick();
        break;
      case 'power':
        this.meterT += dt;
        // la barra sale e scende sempre più veloce per i rigori decisivi
        this.power = (1 - Math.cos(this.meterT * Math.PI * 2 * (0.95 + Math.min(0.4, this.so.kicks.length * 0.03)))) / 2;
        this.drawMeter();
        break;
      case 'userKick':
        this.phaseT += dt;
        this.runUp(this.phaseT / this.kickAt);
        if (this.phaseT >= this.kickAt) {
          this.meterG.clear();
          this.reticle.clear();
          this.launchBall();
        }
        break;
      case 'cpuRun':
        this.phaseT += dt;
        // battito del cuore mentre la CPU prende la rincorsa
        this.beatT -= dt;
        if (this.beatT <= 0) {
          this.beatT = 0.75;
          sfx.heartbeat();
        }
        if (this.phaseT > 0.5) this.runUp((this.phaseT - 0.5) / (this.kickAt - 0.5));
        if (this.phaseT >= this.kickAt) this.launchBall();
        break;
      case 'flight':
        this.updateFlight(dt);
        break;
      case 'result':
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.nextKick();
        break;
      default:
        break;
    }
    // portiere che si muove sulla linea in attesa
    if ((this.phase === 'aim' || this.phase === 'power' || this.phase === 'cpuRun') && !this.dive) {
      const t = this.time.now / 1000;
      this.keeper.x = this.cx + Math.sin(t * 2.2) * 10;
      this.keeper.setFrame(frameIndex('down', Math.sin(t * 4.4) > 0 ? 'idle' : 'celebrate'));
    }
  }

  /** Rincorsa del tiratore (k da 0 a 1). */
  private runUp(k: number) {
    k = Phaser.Math.Clamp(k, 0, 1);
    const startX = this.cx - 46;
    const startY = SPOT_Y + 46;
    this.kicker.x = startX + (this.cx - 14 - startX) * k;
    this.kicker.y = startY + (SPOT_Y + 14 - startY) * k;
    this.kicker.setFrame(frameIndex('up', (`run${Math.floor(k * 8) % 4}`) as 'run0'));
  }
}
