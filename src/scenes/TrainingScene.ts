import Phaser from 'phaser';
import type { PlayerDef, TeamDef } from '../sim/types';
import { FRAME, frameIndex, makePlayerSheet } from '../gfx/sprites';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { sfx } from '../audio/sfx';
import { Rng } from '../sim/math';
import { backToMenu } from './demo';
import { load, progressOf, save } from '../save/storage';
import { TEAMS } from '../data/teams';
import { drawGoalBackground, drawGoalNet, GOAL_H, GOAL_HW, GROUND_Y, SPOT_Y } from '../gfx/goalView';
import { cpuDive, cpuReach, cpuShot, keeperOf, resolveShot, userReach, userShot, type GoalPoint, type PenOutcome } from '../modes/penalties';
import { DRILLS, finishTraining, targetPoints, targetsFor, TRAIN_SESSIONS, trainingState, type DrillDef, type Target } from '../modes/training';
import { equipped, grownTeam, kitVariant } from '../modes/progress';
import { today } from '../modes/daily';

type Phase = 'menu' | 'aim' | 'power' | 'run' | 'flight' | 'result' | 'done';

const LATE = 0.22;
/** A che punto del volo il pallone passa sopra la barriera. */
const WALL_T = 0.45;
const WALL_HH = 52;

/** Allenamento: tiro al bersaglio, punizioni con la barriera, riflessi del portiere. */
export class TrainingScene extends Phaser.Scene {
  private drill?: DrillDef;
  private phase: Phase = 'menu';
  private phaseT = 0;
  private team!: TeamDef;
  private rival!: TeamDef;
  private rng = new Rng();
  private cx = 0;
  private n = 0;
  private score = 0;
  private aim: GoalPoint | null = null;
  private power = 0;
  private meterT = 0;
  private shot: GoalPoint = { u: 0, v: 0 };
  private outcome: PenOutcome = 'gol';
  private targets: Target[] = [];
  private curl = 0;
  private wallU = 0;
  private blocked = false;
  private dive: GoalPoint | null = null;
  private diveLate = 0;
  private flightT = 0;
  private taker!: PlayerDef;
  private kicker?: Phaser.GameObjects.Sprite;
  private keeper?: Phaser.GameObjects.Sprite;
  private ball?: Phaser.GameObjects.Sprite;
  private ballShadow?: Phaser.GameObjects.Image;
  private wall: Phaser.GameObjects.Sprite[] = [];
  private netG?: Phaser.GameObjects.Graphics;
  private fxG?: Phaser.GameObjects.Graphics;
  private meterG?: Phaser.GameObjects.Graphics;
  private hint?: Phaser.GameObjects.Text;
  private scoreT?: Phaser.GameObjects.Text;
  private curlBtns: ReturnType<typeof button>[] = [];

  constructor() {
    super('training');
  }

  init(d?: { drill?: string }) {
    this.drill = DRILLS.find((x) => x.id === d?.drill);
    this.phase = this.drill ? 'aim' : 'menu';
    const p = progressOf();
    const base = TEAMS.find((t) => t.id === load().settings.homeTeam) ?? TEAMS[0];
    this.team = kitVariant(grownTeam(base, p), equipped(p, 'maglia'));
    this.rival = TEAMS[(TEAMS.indexOf(base) + 3) % TEAMS.length];
    this.n = 0;
    this.score = 0;
    this.curl = 0;
    this.wall = [];
    this.curlBtns = [];
    this.kicker = this.keeper = this.ball = undefined;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cx = Math.round(W / 2);
    this.cameras.main.fadeIn(250, 10, 8, 20);
    const key = `trainbg_${W}_${this.team.id}`;
    drawGoalBackground(this, W, H, [this.team.colors.shirt, 0x3a4060], key);
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
    this.netG = this.add.graphics().setDepth(2);
    drawGoalNet(this.netG, this.cx, 0);
    if (!this.drill) return this.buildMenu();
    this.startDrill();
  }

  // ---------- scelta dell'esercizio ----------

  private buildMenu() {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = trainingState(progressOf().training, today());
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.78).setOrigin(0).setDepth(10);
    shadowTxt(this, W / 2, 22, 'ALLENAMENTO', 16, '#ffd23f').c.setDepth(11);
    const left = Math.max(0, TRAIN_SESSIONS - t.sessions);
    txt(this, W / 2, 44, left > 0 ? `Oggi ancora ${left} allenament${left === 1 ? 'o' : 'i'} che fanno crescere ${this.team.name}` : 'Oggi i giocatori sono stanchi: si gioca solo per il record', 6, left > 0 ? '#5be37d' : '#ff9a5a').setDepth(11);
    const cw = Math.min(170, (W - 40) / 3 - 10);
    DRILLS.forEach((d, i) => {
      const x = W / 2 + (i - 1) * (cw + 12);
      const y = 168;
      const g = this.add.graphics().setDepth(11);
      panel(g, x - cw / 2, y - 100, cw, 200, 0x1b1d2e, 0x2e3250, 0.97);
      txt(this, x, y - 84, d.name, 6, '#ffd23f', { wordWrap: { width: cw - 16 }, align: 'center' }).setDepth(12);
      this.drillIcon(g, d, x, y - 36);
      txt(this, x, y + 10, d.desc, 6, '#d8dcf0', { wordWrap: { width: cw - 16 }, align: 'center', lineSpacing: 3 }).setDepth(12);
      const roles = d.roles.map((r) => ({ GK: 'portiere', DEF: 'difensori', MID: 'centrocampisti', FWD: 'attaccanti' })[r]).join(', ');
      txt(this, x, y + 38, `Crescono: ${roles}`, 6, '#3fd0ff', { wordWrap: { width: cw - 16 }, align: 'center', lineSpacing: 3 }).setDepth(12);
      txt(this, x, y + 62, `Record: ${t.best[d.id] ?? 0}`, 6, '#8a8fb0').setDepth(12);
      button(this, x, y + 82, cw - 24, 22, 'VIA!', () => {
        sfx.select();
        this.scene.restart({ drill: d.id });
      }, { size: 6, color: COLORS.good, textColor: '#1a1222' }).c.setDepth(12);
    });
    button(this, 64, H - 22, 96, 26, 'MENU', () => backToMenu(this), { color: 0x3a3d55 }).c.setDepth(12);
  }

  private drillIcon(g: Phaser.GameObjects.Graphics, d: DrillDef, x: number, y: number) {
    // porticina
    g.fillStyle(0xf4f4f4).fillRect(x - 36, y - 22, 72, 4).fillRect(x - 36, y - 22, 4, 40).fillRect(x + 32, y - 22, 4, 40);
    if (d.id === 'bersagli') {
      for (const [r, c] of [[12, 0xe8443a], [8, 0xffffff], [4, 0xe8443a]] as const) g.fillStyle(c).fillCircle(x + 14, y - 4, r);
    } else if (d.id === 'punizioni') {
      g.fillStyle(0xe8443a).fillRect(x - 14, y + 2, 8, 16).fillRect(x - 4, y + 2, 8, 16);
      g.lineStyle(2, 0xffd23f).beginPath().arc(x + 2, y + 24, 30, -2.6, -0.9).strokePath();
    } else {
      g.fillStyle(0xffd23f).fillRect(x - 20, y - 6, 26, 10);
      g.fillStyle(0xf3cba5).fillRect(x + 6, y - 6, 8, 8);
    }
  }

  // ---------- esercizio ----------

  private startDrill() {
    const d = this.drill!;
    const W = this.scale.width;
    const gkDef = keeperOf(this.team);
    const best = [...this.team.players].filter((p) => p.role !== 'GK').sort((a, b) => b.stats.shot - a.stats.shot)[0];
    this.taker = d.id === 'portiere' ? [...this.rival.players].filter((p) => p.role !== 'GK').sort((a, b) => b.stats.shot - a.stats.shot)[0] : best;
    const kTeam = d.id === 'portiere' ? this.rival : this.team;
    makePlayerSheet(this, 'tr_kicker', kTeam, this.taker);
    this.kicker = this.add.sprite(this.cx - this.kx, SPOT_Y + 46, 'tr_kicker', frameIndex('up', 'idle')).setScale(4.2).setOrigin(0.5, 22 / FRAME).setDepth(8);
    if (d.id !== 'bersagli') {
      const kd = d.id === 'portiere' ? gkDef : keeperOf(this.rival);
      makePlayerSheet(this, 'tr_keeper', d.id === 'portiere' ? this.team : this.rival, kd);
      this.keeper = this.add.sprite(this.cx, GROUND_Y + 2, 'tr_keeper', frameIndex('down', 'idle')).setScale(3.4).setOrigin(0.5, 22 / FRAME).setDepth(5);
    }
    if (d.id === 'punizioni') {
      const wd = this.rival.players.filter((p) => p.role !== 'GK').slice(0, 2);
      wd.forEach((p, i) => {
        makePlayerSheet(this, `tr_wall${i}`, this.rival, p);
        this.wall.push(this.add.sprite(0, this.wallY(), `tr_wall${i}`, frameIndex('down', 'idle')).setScale(2.6).setOrigin(0.5, 22 / FRAME).setDepth(6));
      });
      this.curlBtns = (['◄', '●', '►'] as const).map((l, i) =>
        button(this, this.cx - 186 + i * 40, this.scale.height - 22, 34, 22, l === '●' ? 'NO' : l === '◄' ? '<' : '>', () => this.setCurl(i - 1), { size: 6 }),
      );
      txt(this, this.cx - 146, this.scale.height - 44, 'EFFETTO', 6, '#ffffff', { backgroundColor: '#0d0a1acc', padding: { x: 3, y: 2 } });
      this.setCurl(0);
    }
    this.ballShadow = this.add.image(this.cx, SPOT_Y + 4, 'ballShadow').setScale(3).setAlpha(0.35).setDepth(6);
    this.ball = this.add.sprite(this.cx, SPOT_Y, 'ball', 0).setScale(3).setOrigin(0.5, 0.75).setDepth(7);
    this.fxG = this.add.graphics().setDepth(4);
    this.meterG = this.add.graphics().setDepth(20);
    this.hint = txt(this, this.cx, 58, '', 8, '#ffffff', { backgroundColor: '#0d0a1acc', padding: { x: 6, y: 4 }, align: 'center' }).setDepth(30);
    const bg = this.add.graphics().setDepth(29);
    panel(bg, W / 2 - 110, 6, 220, 30, 0x1b1d2e, 0x2e3250, 0.92);
    this.scoreT = txt(this, W / 2, 21, '', 8, '#ffd23f').setDepth(30);
    button(this, W - 22, 18, 26, 22, 'X', () => this.scene.restart({}), { size: 8 }).c.setDepth(31);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.keyboard?.on('keydown-SPACE', () => this.onKey());
    this.events.once('shutdown', () => this.input.removeAllListeners());
    this.nextShot();
  }

  /** Il tiratore parte più di lato nelle punizioni, per non coprire la barriera. */
  private get kx() {
    return this.drill?.id === 'punizioni' ? 110 : 46;
  }

  private wallY() {
    return SPOT_Y + (GROUND_Y - SPOT_Y) * WALL_T + 4;
  }

  private setCurl(c: number) {
    this.curl = c;
    this.curlBtns.forEach((b, i) => b.setSelected(i - 1 === c));
  }

  private updateScore() {
    const d = this.drill!;
    this.scoreT?.setText(`${d.name}  ·  ${Math.min(this.n + 1, d.shots)}/${d.shots}  ·  PUNTI ${this.score}`);
  }

  private nextShot() {
    const d = this.drill!;
    this.updateScore();
    if (this.n >= d.shots) return this.finish();
    this.aim = null;
    this.dive = null;
    this.diveLate = 0;
    this.blocked = false;
    this.power = 0;
    this.meterG?.clear();
    this.fxG?.clear();
    drawGoalNet(this.netG!, this.cx, 0);
    this.kicker!.setFrame(frameIndex('up', 'idle')).setPosition(this.cx - this.kx, SPOT_Y + 46);
    this.ball!.setPosition(this.cx, SPOT_Y).setScale(3).setAlpha(1).setVisible(true);
    this.ballShadow!.setPosition(this.cx, SPOT_Y + 4).setScale(3).setVisible(true);
    this.keeper?.setPosition(this.cx, GROUND_Y + 2).setRotation(0).setOrigin(0.5, 22 / FRAME).setFrame(frameIndex('down', 'idle')).setFlipX(false);
    if (d.id === 'bersagli') {
      this.targets = targetsFor(this.n, () => this.rng.next());
      this.drawTargets();
    }
    if (d.id === 'punizioni') {
      // la barriera si sposta a ogni tiro
      this.wallU = this.rng.range(-0.5, 0.5);
      const x = this.cx + this.wallU * GOAL_HW * WALL_T;
      this.wall.forEach((s, i) => s.setPosition(x + (i - 0.5) * 30, this.wallY()).setFrame(frameIndex('down', 'idle')));
    }
    if (d.id === 'portiere') {
      this.phase = 'run';
      this.phaseT = 0;
      this.shot = cpuShot(this.taker, 'normale', this.rng, this.n * 0.02);
      this.hint?.setText('Tocca dove ti tuffi!');
    } else {
      this.phase = 'aim';
      this.hint?.setText(d.id === 'punizioni' ? 'Scegli l\'effetto, poi tocca la porta' : 'Tocca la porta per mirare');
    }
  }

  private drawTargets() {
    const g = this.fxG!;
    g.clear();
    for (const t of this.targets) {
      const p = this.map(t);
      const r = t.r * GOAL_H;
      g.fillStyle(0x1a1222, 0.5).fillCircle(p.x + 2, p.y + 2, r);
      g.fillStyle(0xe8443a).fillCircle(p.x, p.y, r);
      g.fillStyle(0xffffff).fillCircle(p.x, p.y, r * 0.7);
      g.fillStyle(0xe8443a).fillCircle(p.x, p.y, r * 0.4);
    }
  }

  private map(p: GoalPoint) {
    return { x: this.cx + p.u * GOAL_HW, y: GROUND_Y - p.v * GOAL_H };
  }

  private unmap(x: number, y: number): GoalPoint {
    return { u: (x - this.cx) / GOAL_HW, v: (GROUND_Y - y) / GOAL_H };
  }

  // ---------- comandi ----------

  private inGoal(p: Phaser.Input.Pointer) {
    return p.y < GROUND_Y + 40 && p.y > 40 && Math.abs(p.x - this.cx) < GOAL_HW + 60;
  }

  private onKey() {
    if (this.phase === 'aim') {
      this.aim = { u: this.rng.range(-0.7, 0.7), v: 0.4 };
      this.startPower();
    } else if (this.phase === 'power') this.kick();
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.phase === 'aim' && this.inGoal(p)) this.setAim(p);
    else if (this.phase === 'power') this.kick();
    else if ((this.phase === 'run' || this.phase === 'flight') && this.drill?.id === 'portiere' && !this.dive && this.inGoal(p)) this.userDive(p);
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
    const g = this.meterG!;
    g.clear();
    const { x, y } = this.map(this.aim);
    g.lineStyle(3, 0x1a1222).strokeCircle(x, y, 12);
    g.lineStyle(1, 0xffd23f).strokeCircle(x, y, 12);
    g.fillStyle(0xffd23f).fillRect(x - 1, y - 6, 2, 12).fillRect(x - 6, y - 1, 12, 2);
  }

  private startPower() {
    this.phase = 'power';
    this.meterT = 0;
    this.hint?.setText('Tocca quando la barra è nel VERDE!');
  }

  private drawMeter() {
    const g = this.meterG!;
    const x = this.scale.width - 46;
    const y0 = 110;
    const h = 170;
    g.fillStyle(0x1a1222).fillRect(x - 3, y0 - 3, 22, h + 6);
    const zone = (a: number, b: number, c: number) => g.fillStyle(c).fillRect(x, y0 + h * (1 - b), 16, h * (b - a));
    zone(0, 0.55, 0x4a6080);
    zone(0.55, 0.82, 0x5be37d);
    zone(0.82, 0.9, 0xffd23f);
    zone(0.9, 1, 0xff5a5a);
    const yy = y0 + h * (1 - this.power);
    g.fillStyle(0xffffff).fillRect(x - 6, yy - 2, 28, 4);
  }

  private kick() {
    if (this.phase !== 'power' || !this.aim) return;
    this.phase = 'run';
    this.phaseT = 0;
    this.hint?.setText('');
    this.shot = userShot(this.aim, this.power, this.taker, this.rng);
    const d = this.drill!;
    if (d.id === 'punizioni') {
      // all'altezza della barriera: passa di lato o sopra?
      const s = this.ballAt(WALL_T);
      const wx = this.cx + this.wallU * GOAL_HW * WALL_T;
      const lifted = this.wallY() - s.y;
      this.blocked = Math.abs(s.x - wx) < 30 && lifted < WALL_HH;
      const gk = keeperOf(this.rival);
      this.dive = cpuDive(this.shot, 'normale', this.power, this.rng);
      this.outcome = resolveShot(this.shot, this.dive, cpuReach(gk, 'normale', this.power) * 0.85);
    } else this.outcome = resolveShot(this.shot, null, 0);
  }

  private userDive(p: Phaser.Input.Pointer) {
    const late = this.phase === 'flight' ? this.flightT / LATE : 0;
    if (late > 1) return;
    const a = this.unmap(p.x, p.y);
    this.dive = { u: Phaser.Math.Clamp(a.u, -1.05, 1.05), v: Phaser.Math.Clamp(a.v, 0, 1) };
    this.diveLate = late;
    this.animateDive(this.dive, this.phase === 'flight' ? 240 : 340);
    if (this.phase === 'flight') this.outcome = resolveShot(this.shot, this.dive, userReach(keeperOf(this.team), late));
  }

  private animateDive(d: GoalPoint, ms: number) {
    const k = this.keeper!;
    const { x, y } = this.map(d);
    const side = d.u < 0 ? -1 : 1;
    if (Math.abs(d.u) < 0.22) {
      k.setFrame(frameIndex('down', 'celebrate'));
      this.tweens.add({ targets: k, x, y: Math.min(GROUND_Y + 2, y + 50), duration: ms * 0.7, ease: 'Quad.easeOut' });
      return;
    }
    k.setFrame(frameIndex('side', 'dive')).setOrigin(0.5, 0.5).setFlipX(side < 0);
    k.y = GROUND_Y - 30;
    this.tweens.add({ targets: k, x: x - side * 22, y: Math.min(GROUND_Y - 14, y + 4), rotation: side * (d.v > 0.55 ? -0.35 : 0.15), duration: ms, ease: 'Quad.easeOut' });
  }

  /** Posizione a schermo del pallone a una frazione t del volo (con effetto e parabola). */
  private ballAt(t: number) {
    const end = this.map(this.shot);
    const e = 1 - (1 - t) * (1 - t) * 0.4 - (1 - t) * 0.6;
    const curl = this.drill?.id === 'punizioni' ? this.curl : 0;
    const arc = this.drill?.id === 'punizioni' ? (0.15 + this.power * 0.55) * GOAL_H * 0.9 : 14;
    return {
      x: this.cx + (end.x - this.cx) * e - curl * 0.55 * Math.sin(Math.PI * t) * GOAL_HW * 0.8,
      y: SPOT_Y + (end.y - SPOT_Y) * e - Math.sin(Math.PI * t) * arc,
      e,
    };
  }

  private launch() {
    this.kicker!.setFrame(frameIndex('up', 'kick'));
    sfx.kick(this.drill?.id === 'portiere' ? 0.75 : this.power);
    this.phase = 'flight';
    this.flightT = 0;
    const d = this.drill!;
    if (d.id === 'punizioni') {
      // la barriera salta
      this.wall.forEach((s) => this.tweens.add({ targets: s, y: this.wallY() - 14, duration: 180, yoyo: true, ease: 'Quad.easeOut' }));
      if (this.dive && !this.blocked) this.animateDive(this.dive, 420);
    }
    if (d.id === 'portiere') {
      this.outcome = resolveShot(this.shot, this.dive, userReach(keeperOf(this.team), this.diveLate));
    }
  }

  private resolve() {
    this.phase = 'result';
    this.phaseT = 1.5;
    const d = this.drill!;
    let pts = 0;
    let label = '';
    let color = '#ffffff';
    if (d.id === 'bersagli') {
      pts = this.outcome === 'gol' ? targetPoints(this.shot, this.targets) : 0;
      label = pts === 5 ? 'CENTRO!' : pts === 3 ? 'BERSAGLIO!' : pts === 1 ? 'IN PORTA' : this.outcome === 'palo' ? 'PALO!' : 'FUORI!';
      color = pts >= 3 ? '#ffd23f' : pts ? '#ffffff' : '#ff5a5a';
    } else if (d.id === 'punizioni') {
      if (this.blocked) label = 'BARRIERA!';
      else if (this.outcome === 'gol') {
        pts = 3;
        label = this.curl !== 0 ? 'GOL A GIRO!' : 'GOL!';
      } else label = this.outcome === 'parato' ? 'PARATA' : this.outcome === 'palo' ? 'PALO!' : 'FUORI!';
      color = pts ? '#ffd23f' : '#ff5a5a';
    } else {
      pts = this.outcome === 'parato' ? 2 : this.outcome === 'gol' ? 0 : 1;
      label = this.outcome === 'parato' ? 'PARATA!' : this.outcome === 'gol' ? 'GOL...' : this.outcome === 'palo' ? 'PALO!' : 'FUORI!';
      color = pts === 2 ? '#3fd0ff' : pts ? '#ffffff' : '#ff5a5a';
    }
    this.score += pts;
    if (pts >= 3 || (d.id === 'portiere' && pts === 2)) sfx.trick();
    else if (pts === 0) sfx.ooh();
    if (this.outcome === 'gol' && !this.blocked) {
      sfx.net();
      this.tweens.addCounter({ from: 1, to: 0, duration: 600, onUpdate: (tw) => drawGoalNet(this.netG!, this.cx, tw.getValue() ?? 0, this.shot.u) });
    }
    if (this.outcome === 'palo') sfx.post();
    const c = this.add.container(this.cx, 236).setDepth(40);
    c.add(shadowTxt(this, 0, 0, label, 16, color, '#1a1222', 2).c);
    if (pts) c.add(txt(this, 0, 22, `+${pts}`, 8, '#ffd23f'));
    c.setScale(0.4);
    this.tweens.add({ targets: c, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1100, duration: 250, onComplete: () => c.destroy() });
    this.n++;
    this.updateScore();
  }

  private finish() {
    this.phase = 'done';
    this.hint?.setText('');
    const d = this.drill!;
    const W = this.scale.width;
    const H = this.scale.height;
    const p = progressOf();
    const base = TEAMS.find((t) => t.id === load().settings.homeTeam) ?? TEAMS[0];
    const t = trainingState(p.training, today());
    const rw = finishTraining(p, t, base, d, this.score);
    p.training = t;
    save();
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x0a0816, 0.7).setOrigin(0).setInteractive());
    c.add(shadowTxt(this, W / 2, 70, 'FINE ALLENAMENTO', 16, '#ffd23f').c);
    c.add(txt(this, W / 2, 104, `Punti: ${this.score}${rw.record ? '  ·  NUOVO RECORD!' : `  ·  record ${t.best[d.id] ?? 0}`}`, 8, rw.record ? '#5be37d' : '#ffffff'));
    const lines: [string, string][] = [];
    if (rw.tired) lines.push(['I giocatori sono stanchi: niente esperienza fino a domani', '#ff9a5a']);
    else lines.push([`+${rw.xp} esperienza a ogni ${d.roles.includes('GK') ? 'portiere' : 'giocatore allenato'}`, '#3fd0ff']);
    for (const u of rw.ups.slice(0, 3)) lines.push([`${u.name} sale al livello ${u.level}${u.skill ? ` · nuova abilità: ${u.skill}` : ''}`, '#ff7ab8']);
    lines.forEach(([s, col], i) => c.add(txt(this, W / 2, 132 + i * 16, s, 6, col)));
    if (rw.record || rw.ups.length) sfx.fanfare();
    c.add(button(this, W / 2 - 150, H - 60, 130, 28, 'ESERCIZI', () => this.scene.restart({}), { color: 0x3a3d55 }).c);
    c.add(button(this, W / 2, H - 60, 130, 28, 'RIPROVA', () => this.scene.restart({ drill: d.id }), { color: COLORS.good, textColor: '#1a1222' }).c);
    c.add(button(this, W / 2 + 150, H - 60, 130, 28, 'MENU', () => backToMenu(this), { color: 0x3a3d55 }).c);
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.1, deltaMs / 1000);
    switch (this.phase) {
      case 'power':
        this.meterT += dt;
        this.power = (1 - Math.cos(this.meterT * Math.PI * 2 * 0.95)) / 2;
        this.meterG!.clear();
        if (this.aim) {
          const { x, y } = this.map(this.aim);
          this.meterG!.lineStyle(1, 0xffd23f).strokeCircle(x, y, 12);
        }
        this.drawMeter();
        break;
      case 'run': {
        this.phaseT += dt;
        const dur = this.drill?.id === 'portiere' ? 1.3 : 0.35;
        const k = Phaser.Math.Clamp(this.phaseT / dur, 0, 1);
        this.kicker!.x = this.cx - this.kx + (this.kx - 14) * k;
        this.kicker!.y = SPOT_Y + 46 - 32 * k;
        this.kicker!.setFrame(frameIndex('up', `run${Math.floor(k * 8) % 4}` as 'run0'));
        if (this.phaseT >= dur) {
          this.meterG?.clear();
          this.launch();
        }
        break;
      }
      case 'flight': {
        this.flightT += dt;
        const DUR = this.drill?.id === 'punizioni' ? 0.75 : 0.5;
        let t = Math.min(1, this.flightT / DUR);
        if (this.blocked && t > WALL_T) t = WALL_T;
        const s = this.ballAt(t);
        let { x, y } = s;
        if (this.outcome === 'parato' && !this.blocked && t > 0.82) {
          const q = (t - 0.82) / 0.18;
          x += (this.shot.u < 0 ? -1 : 1) * q * 30;
          y += q * 50;
        }
        this.ball!.setPosition(x, y).setScale(3 - s.e * 1.6);
        this.ball!.setFrame(Math.floor(this.flightT * 30) % 4);
        this.ballShadow!.setPosition(this.cx + (x - this.cx), SPOT_Y + 4 + (GROUND_Y + 6 - SPOT_Y - 4) * s.e).setScale(3 - s.e * 1.6);
        if (this.blocked && this.flightT / DUR >= WALL_T) {
          // respinta della barriera
          this.tweens.add({ targets: this.ball, y: SPOT_Y - 10, x: x + this.rng.range(-60, 60), duration: 400, ease: 'Quad.easeOut' });
          sfx.tackle();
          this.resolve();
        } else if (t >= 1) {
          this.ballShadow!.setVisible(false);
          this.resolve();
        }
        break;
      }
      case 'result':
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.nextShot();
        break;
      default:
        break;
    }
    // portiere che aspetta muovendosi
    if (this.keeper && (this.phase === 'aim' || this.phase === 'power' || (this.phase === 'run' && !this.dive))) {
      const tt = this.time.now / 1000;
      this.keeper.x = this.cx + Math.sin(tt * 2.2) * 10;
    }
  }
}
