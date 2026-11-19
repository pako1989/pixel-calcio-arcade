import Phaser from 'phaser';
import { COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { asPlayerDef, asTeamDef, portrait } from '../gfx/animeArt';
import { frameIndex, makePlayerSheet, type Pose } from '../gfx/sprites';
import { hex } from '../gfx/px';
import {
  EpicMatch, TECHS, episodeReward, objectiveMet, objectiveText,
  type AttackAction, type DefenseAction, type DefKind, type Encounter, type KeeperAction, type LeggendaSave,
  type LgPlayer, type ShotInfo, type Side, type Step, newLeggenda,
} from '../modes/leggenda';
import { EPISODES, RUN_LINES, CAST, heroTeam, rivalTeam, type Episode, type LgLine, type Trigger } from '../modes/leggendaStory';
import { LgTalk } from './lgTalk';
import { duelFx, fxSpeed, keeperFx, pop, shotFx, type Who } from './epicFx';
import { load, progressOf, save } from '../save/storage';
import { checkTrophies, newTotals } from '../modes/trophies';
import { owned as ownedStickers } from '../modes/album';
import { levelOf, MAX_LEVEL } from '../modes/progress';
import { backToScene } from './demo';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { commentary } from '../audio/commentary';

export interface EpicData {
  ep: number;
}

/** Metri -> pixel nel mondo: il campo è lungo cinque schermate. */
const PXM = 30;
const X0 = 110;
const WORLD_W = X0 * 2 + 100 * PXM;
const PT = 122;
const PB = 300;
const MIDY = 211;
const LANE = 64;
/** Corsia di ogni giocatore (per indice nella squadra: POR, DIF, DIF, CEN, CEN, ATT, ATT). */
const LANES = [0, -0.5, 0.5, -0.9, 0.3, -0.35, 0.65];
const wx = (m: number) => X0 + m * PXM;

interface Actor {
  p: LgPlayer;
  side: Side;
  idx: number;
  spr: Phaser.GameObjects.Sprite;
  sh: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  pose: Pose | null;
  poseUntil: number;
  face: 1 | -1;
}

interface Opt<T> {
  label: string;
  sub?: string;
  value: T;
  color?: number;
  enabled?: boolean;
}

const DEF_HINT: Record<DefKind, string> = {
  contrasto: 'punta il pallone: vuole il contrasto',
  intercetto: 'copre i compagni: pronto a intercettare',
  blocco: 'si piazza davanti alla porta',
};
const ATK_HINT = { dribbling: 'sembra voler dribblare', passaggio: 'cerca un compagno', tiro: 'carica il tiro!' };

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** Leggenda del Pallone: la partita a turni sul campo lunghissimo. */
export class EpicMatchScene extends Phaser.Scene {
  private m!: EpicMatch;
  private epi = 0;
  private ep!: Episode;
  private sv!: LeggendaSave;
  private alive = false;
  private actors = new Map<string, Actor>();
  private ball!: Phaser.GameObjects.Sprite;
  private ballSh!: Phaser.GameObjects.Image;
  private holder: string | null = null;
  private ballZ = 0;
  /** Coordinata (metri) mostrata per chi ha palla durante la corsa. */
  private viewX = 50;
  private camX = 0;
  private scoreT!: Phaser.GameObjects.Text;
  private timeT!: Phaser.GameObjects.Text;
  private radar!: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private distT!: Phaser.GameObjects.Text;
  private choice?: Phaser.GameObjects.Container;
  private comments: { who: string; text: string }[] = [];
  private commentBox?: Phaser.GameObjects.Container;
  private commentUntil = 0;
  private fired = new Set<number>();
  private enc: Encounter | null = null;
  private exitArmed = false;
  private exitBtn!: Phaser.GameObjects.Text;
  private trail?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('epic');
  }

  init(d: EpicData) {
    this.epi = Math.max(0, Math.min(EPISODES.length - 1, d?.ep ?? 0));
  }

  create() {
    this.alive = true;
    this.ep = EPISODES[this.epi];
    const all = load();
    this.sv = all.leggenda = all.leggenda ?? newLeggenda();
    this.actors.clear();
    this.fired.clear();
    this.comments = [];
    this.holder = null;
    this.exitArmed = false;
    fxSpeed.v = 1;
    music.play('leggenda');
    this.events.once('shutdown', () => {
      this.alive = false;
      this.tweens.killAll();
      this.time.removeAllEvents();
    });

    // tecniche insegnate dalla storia all'inizio dell'episodio
    for (const t of this.ep.teaches ?? []) if (!this.sv.learned.includes(t)) this.sv.learned.push(t);
    save();

    const diff = all.settings.difficulty;
    const assist = diff === 'facile' ? 10 : diff === 'difficile' ? -2 : 4;
    this.m = new EpicMatch(heroTeam(this.epi), rivalTeam(this.epi), {
      minutes: this.ep.minutes,
      assist,
      known: [...this.sv.learned],
      injured: this.ep.injured,
    });
    if (this.ep.injured?.nico) this.m.teams[0].players.find((p) => p.id === 'nico')!.face.plaster = true;

    this.drawPitch();
    this.makeActors();
    this.ball = this.add.sprite(wx(50), MIDY, 'ball', 0).setScale(2).setDepth(2000);
    this.ballSh = this.add.image(wx(50), MIDY, 'ballShadow').setScale(2).setAlpha(0.35).setDepth(10);
    this.holder = this.m.carrier;
    this.over = this.add.graphics().setDepth(2500);
    this.distT = txt(this, 0, 0, '', 6, '#ffffff', { backgroundColor: '#1a1222', padding: { x: 3, y: 2 } }).setDepth(2600);
    this.buildHud();
    this.layout(true);
    this.cameras.main.setBounds(0, 0, WORLD_W, this.scale.height);
    this.camX = wx(50) - this.scale.width / 2;
    this.cameras.main.scrollX = this.camX;
    this.cameras.main.fadeIn(300, 10, 8, 20);
    this.input.on('pointerdown', () => {
      if (!this.choice) fxSpeed.v = Math.min(3, fxSpeed.v + 1);
    });
    this.input.on('pointerup', () => (fxSpeed.v = 1));
    void this.run();
  }

  // ---------- grafica ----------

  private drawPitch() {
    const key = `lg_pitch_${this.epi}`;
    if (!this.textures.exists(key)) {
      const H = 360;
      const cv = document.createElement('canvas');
      cv.width = WORLD_W;
      cv.height = H;
      const ctx = cv.getContext('2d')!;
      const ep = this.ep;
      const col = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
      const sky = ep.night ? 0x141a3a : ep.sky;
      ctx.fillStyle = col(sky);
      ctx.fillRect(0, 0, WORLD_W, H);
      // tribune
      const tier = ep.night ? 0x262a48 : 0x4a4e6a;
      for (let y = 34; y < 104; y += 7) {
        ctx.fillStyle = col(tier, 1);
        ctx.fillRect(0, y, WORLD_W, 7);
        ctx.fillStyle = col(0x000000, 0.25);
        ctx.fillRect(0, y + 6, WORLD_W, 1);
        for (let x = (y % 2) * 2; x < WORLD_W; x += 5) {
          const r = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const v = r - Math.floor(r);
          if (v < 0.12) continue;
          const shirt = [0xe8443a, 0xffffff, 0x2f6fd0, 0xffd23f, 0x3fae5a, 0xff8a2a][Math.floor(v * 6)];
          ctx.fillStyle = col(shirt, ep.night ? 0.7 : 1);
          ctx.fillRect(x, y + 3, 3, 3);
          ctx.fillStyle = col(0xf3cba5, ep.night ? 0.6 : 1);
          ctx.fillRect(x + 1, y + 1, 2, 2);
        }
      }
      ctx.fillStyle = col(0x1a1222);
      ctx.fillRect(0, 30, WORLD_W, 4);
      if (ep.night) {
        for (let x = 200; x < WORLD_W; x += 600) {
          const g = ctx.createRadialGradient(x, 18, 2, x, 18, 60);
          g.addColorStop(0, 'rgba(255,255,230,0.9)');
          g.addColorStop(1, 'rgba(255,255,230,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 60, 0, 120, 80);
        }
      }
      // cartelloni
      const ads = ['LEGGENDA', 'PIXEL', 'CALCIO', 'VENTO', 'GOL!', 'ARCADE'];
      const adc = [0xe8443a, 0x2f6fd0, 0xffd23f, 0x3fae5a, 0xff8a2a, 0x8a3fd0];
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textBaseline = 'middle';
      for (let i = 0; i * 150 < WORLD_W; i++) {
        ctx.fillStyle = col(adc[i % adc.length]);
        ctx.fillRect(i * 150, 104, 148, 16);
        ctx.fillStyle = i % 3 === 2 ? '#1a1222' : '#ffffff';
        ctx.fillText(ads[i % ads.length], i * 150 + 12, 113);
      }
      // prato a strisce
      const g1 = ep.night ? 0x2f7a32 : ep.snow ? 0x5a9a5a : 0x3f9a3a;
      const g2 = ep.night ? 0x358a38 : ep.snow ? 0x66a866 : 0x4aa844;
      ctx.fillStyle = col(ep.night ? 0x245a28 : 0x347f30);
      ctx.fillRect(0, 120, WORLD_W, H - 120);
      for (let m = -4; m < 104; m += 5) {
        ctx.fillStyle = col(Math.floor(m / 5) % 2 === 0 ? g1 : g2);
        ctx.fillRect(wx(m), PT - 2, 5 * PXM, PB - PT + 4);
      }
      // linee
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const line = (x: number, y: number, w: number, h: number) => ctx.fillRect(Math.round(x), Math.round(y), Math.max(2, w), Math.max(2, h));
      line(wx(0), PT, 100 * PXM, 2);
      line(wx(0), PB, 100 * PXM + 2, 2);
      line(wx(0), PT, 2, PB - PT);
      line(wx(100), PT, 2, PB - PT);
      line(wx(50), PT, 2, PB - PT);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(wx(50) + 1, MIDY, 110, 46, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (const s of [0, 1]) {
        const gx = s === 0 ? wx(0) : wx(100);
        const d = s === 0 ? 1 : -1;
        ctx.strokeRect(Math.min(gx, gx + d * 16.5 * PXM), MIDY - 66, 16.5 * PXM, 132);
        ctx.strokeRect(Math.min(gx, gx + d * 5.5 * PXM), MIDY - 32, 5.5 * PXM, 64);
        ctx.fillRect(gx + d * 11 * PXM - 2, MIDY - 2, 4, 4);
        ctx.beginPath();
        ctx.ellipse(gx + d * 16.5 * PXM, MIDY, 60, 34, 0, s === 0 ? -Math.PI / 2 : Math.PI / 2, s === 0 ? Math.PI / 2 : (3 * Math.PI) / 2);
        ctx.stroke();
      }
      // metri dalla porta, come i cartelli di un campo lunghissimo
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let m = 10; m < 100; m += 10) {
        const lbl = String(m <= 50 ? m : 100 - m);
        ctx.fillText(lbl, wx(m) - lbl.length * 4, PB + 14);
        ctx.fillRect(wx(m), PB + 2, 2, 5);
      }
      // porte (rete dietro la linea)
      for (const s of [0, 1]) {
        const gx = s === 0 ? wx(0) : wx(100);
        const d = s === 0 ? -1 : 1;
        ctx.fillStyle = 'rgba(20,20,40,0.45)';
        ctx.fillRect(Math.min(gx, gx + d * 34), MIDY - 46, 34, 92);
        ctx.strokeStyle = 'rgba(230,230,240,0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 34; i += 6) {
          ctx.beginPath();
          ctx.moveTo(gx + d * i, MIDY - 46);
          ctx.lineTo(gx + d * i, MIDY + 46);
          ctx.stroke();
        }
        for (let j = -46; j <= 46; j += 6) {
          ctx.beginPath();
          ctx.moveTo(gx, MIDY + j);
          ctx.lineTo(gx + d * 34, MIDY + j);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gx - 2, MIDY - 50, 4, 100);
        ctx.fillRect(Math.min(gx, gx + d * 34), MIDY - 50, 34, 3);
      }
      if (ep.snow) {
        for (let i = 0; i < 2500; i++) {
          const r = Math.sin(i * 91.7) * 9999;
          const v = r - Math.floor(r);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(Math.floor(v * WORLD_W), PT + Math.floor(((v * 7919) % 1) * (PB - PT)), 2, 2);
        }
      }
      this.textures.addCanvas(key, cv);
    }
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
    if (this.ep.snow) {
      this.add.particles(0, 0, 'px2', {
        x: { min: 0, max: this.scale.width },
        y: -4,
        speedY: { min: 30, max: 60 },
        speedX: { min: -20, max: 10 },
        lifespan: 7000,
        frequency: 60,
        alpha: 0.8,
      }).setScrollFactor(0).setDepth(2900);
    }
  }

  private makeActors() {
    this.m.teams.forEach((t, side) => {
      const td = asTeamDef(t);
      t.players.forEach((p, i) => {
        const key = `lg_${t.id}_${p.id}`;
        makePlayerSheet(this, key, td, asPlayerDef(p));
        const sh = this.add.image(0, 0, 'shadow').setScale(2).setAlpha(0.3).setDepth(5);
        const spr = this.add.sprite(0, 0, key, frameIndex('side', 'idle')).setScale(2).setOrigin(0.5, 0.92);
        this.actors.set(p.id, { p, side: side as Side, idx: i, spr, sh, tx: 0, ty: 0, pose: null, poseUntil: 0, face: side === 0 ? 1 : -1 });
      });
    });
  }

  private who(id: string): Who {
    const a = this.actors.get(id)!;
    const t = this.m.teams[a.side];
    return {
      id,
      name: a.p.name,
      face: a.p.face,
      shirt: a.p.role === 'GK' ? t.colors.gk : t.colors.shirt,
      sheet: `lg_${t.id}_${id}`,
      side: a.side,
    };
  }

  private laneOf(a: Actor) {
    const l = LANES[a.idx] ?? 0;
    return a.side === 0 ? l : -l;
  }

  /** Dove deve stare ognuno in base all'azione. */
  private layout(snap = false) {
    const m = this.m;
    const vx = this.viewX;
    const dir = m.side === 0 ? 1 : -1;
    const targets = new Map(m.passTargets().map((t) => [t.id, t.x]));
    const enc = this.enc;
    const carrierA = this.actors.get(m.carrier);
    const cl = carrierA ? this.laneOf(carrierA) * 0.35 : 0;
    let behind = 0;
    let chase = 0;
    for (const a of this.actors.values()) {
      let x: number;
      let lane = this.laneOf(a);
      if (a.p.role === 'GK') {
        x = a.side === 0 ? 2 : 98;
        lane = 0;
        const near = Math.abs(vx - x) < 25;
        if (near) x += a.side === 0 ? 3 : -3;
      } else if (a.side === m.side) {
        if (a.p.id === m.carrier) {
          x = vx;
          lane = cl;
        } else if (targets.has(a.p.id)) {
          const tgt = targets.get(a.p.id)!;
          x = vx + (tgt - m.x);
        } else {
          x = vx - dir * (10 + behind * 6);
          behind++;
        }
      } else {
        const e = m.engagers.find((q) => q.id === a.p.id);
        if (enc && enc.def.id === a.p.id) {
          x = enc.x;
          lane = cl + 0.12;
        } else if (m.passed.has(a.p.id)) {
          x = vx - dir * (3 + chase * 2.5);
          lane = cl + (chase % 2 ? 0.35 : -0.35);
          chase++;
        } else if (e) {
          x = e.x;
        } else {
          x = m.spotOf(a.p.id);
          lane = lane < 0 ? -0.95 : 0.95;
        }
      }
      a.tx = wx(Phaser.Math.Clamp(x, -1, 101));
      a.ty = MIDY + Phaser.Math.Clamp(lane, -1.25, 1.25) * LANE;
      if (snap) {
        a.spr.setPosition(a.tx, a.ty);
      }
    }
    if (snap) this.updateBall(0);
  }

  update(time: number, dms: number) {
    if (!this.m) return;
    const dt = dms / 1000;
    for (const a of this.actors.values()) {
      const dx = a.tx - a.spr.x;
      const dy = a.ty - a.spr.y;
      const d = Math.hypot(dx, dy);
      const isCarrier = a.p.id === this.holder;
      const sp = (isCarrier ? 900 : 240) * dt * fxSpeed.v;
      if (d > 1) {
        const k = Math.min(1, sp / d);
        a.spr.x += dx * k;
        a.spr.y += dy * k;
        if (Math.abs(dx) > 0.5) a.face = dx > 0 ? 1 : -1;
      } else {
        const bx = this.ball.x;
        if (Math.abs(bx - a.spr.x) > 6) a.face = bx > a.spr.x ? 1 : -1;
      }
      const moving = d > 1.5;
      let pose: Pose = moving ? (['run0', 'run1', 'run2', 'run3'] as Pose[])[Math.floor(time / 90) % 4] : 'idle';
      if (a.pose && time < a.poseUntil) pose = a.pose;
      a.spr.setFrame(frameIndex('side', pose));
      a.spr.setFlipX(a.face < 0);
      a.spr.setDepth(100 + a.spr.y);
      a.sh.setPosition(a.spr.x, a.spr.y);
    }
    this.updateBall(time);
    // telecamera che segue il pallone
    const W = this.scale.width;
    const want = Phaser.Math.Clamp(this.ball.x - W / 2, 0, WORLD_W - W);
    this.camX += (want - this.camX) * Math.min(1, dt * 6 * fxSpeed.v);
    this.cameras.main.scrollX = Math.round(this.camX);
    this.drawOverlay();
    this.drawRadar();
    if (this.commentBox && time > this.commentUntil) {
      this.commentBox.destroy();
      this.commentBox = undefined;
    }
    if (!this.commentBox && this.comments.length) this.showComment(this.comments.shift()!);
  }

  private updateBall(time: number) {
    if (this.holder) {
      const a = this.actors.get(this.holder);
      if (a) {
        this.ball.setPosition(a.spr.x + a.face * 10, a.spr.y - 3);
        this.ballZ = 0;
        const moving = Math.abs(a.tx - a.spr.x) > 2;
        if (moving) this.ball.setFrame(Math.floor(time / 70) % 4);
      }
    }
    this.ballSh.setPosition(this.ball.x, this.ball.y + this.ballZ + 2);
    this.ball.setDepth(100 + this.ball.y + this.ballZ + 4);
  }

  /** Barre dell'energia sopra chi ha palla e chi lo affronta, metri dalla porta. */
  private drawOverlay() {
    const g = this.over;
    g.clear();
    const bar = (id: string, color: number) => {
      const a = this.actors.get(id);
      if (!a) return;
      const v = this.m.energy[id] / Math.max(1, this.m.maxEnergy[id]);
      const x = a.spr.x - 14;
      const y = a.spr.y - 52;
      g.fillStyle(0x1a1222).fillRect(x - 1, y - 1, 30, 5);
      g.fillStyle(0x3a3d55).fillRect(x, y, 28, 3);
      g.fillStyle(v > 0.5 ? color : v > 0.25 ? 0xffd23f : 0xff5a5a).fillRect(x, y, Math.round(28 * v), 3);
    };
    if (this.holder) bar(this.holder, 0x5be37d);
    if (this.enc) bar(this.enc.def.id, 0x5be37d);
    const a = this.holder ? this.actors.get(this.holder) : undefined;
    if (a) {
      const d = Math.round(this.m.side === 0 ? 100 - (a.spr.x - X0) / PXM : (a.spr.x - X0) / PXM);
      this.distT.setText(`${Math.max(0, d)} m`).setPosition(a.spr.x, a.spr.y - 62).setVisible(true);
    } else this.distT.setVisible(false);
  }

  private buildHud() {
    const W = this.scale.width;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);
    const g = this.add.graphics();
    g.fillStyle(0x0d0a1a, 0.85).fillRect(W / 2 - 120, 0, 240, 30);
    g.fillStyle(0x0d0a1a, 0.85).fillRect(W / 2 - 150, 30, 300, 14);
    c.add(g);
    const [a, b] = this.m.teams;
    c.add(txt(this, W / 2 - 96, 11, a.short, 8, hex(a.colors.shirt === 0xf2f2f2 ? 0xffffff : a.colors.shirt)));
    c.add(txt(this, W / 2 + 96, 11, b.short, 8, hex(b.colors.shirt)));
    this.scoreT = txt(this, W / 2, 11, '0 - 0', 12, '#ffffff');
    this.timeT = txt(this, W / 2, 24, "0'", 6, '#ffd23f');
    c.add([this.scoreT, this.timeT]);
    this.radar = this.add.graphics();
    c.add(this.radar);
    c.add(txt(this, 10, 10, `EP.${this.epi + 1}`, 6, '#8a8fb0').setOrigin(0, 0.5));
    this.exitBtn = txt(this, W - 8, 10, 'ESCI', 6, '#8a8fb0', { backgroundColor: '#22253a', padding: { x: 4, y: 3 } }).setOrigin(1, 0.5);
    this.exitBtn.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (!this.exitArmed) {
        this.exitArmed = true;
        this.exitBtn.setText('SICURO? ESCI').setColor('#ff5a5a');
        this.time.delayedCall(2500, () => {
          this.exitArmed = false;
          this.exitBtn?.setText('ESCI').setColor('#8a8fb0');
        });
        return;
      }
      this.leave();
    });
    c.add(this.exitBtn);
  }

  private refreshHud() {
    this.scoreT.setText(`${this.m.score[0]} - ${this.m.score[1]}`);
    this.timeT.setText(`${this.m.clock}'  ${this.m.half}° T`);
  }

  private drawRadar() {
    const W = this.scale.width;
    const g = this.radar;
    g.clear();
    const x0 = W / 2 - 144;
    const w = 288;
    const y0 = 33;
    const h = 8;
    g.fillStyle(0x2f7a32).fillRect(x0, y0, w, h);
    g.fillStyle(0xffffff, 0.5).fillRect(x0 + w / 2, y0, 1, h);
    g.fillStyle(0xffffff).fillRect(x0 - 2, y0 + 2, 2, 4).fillRect(x0 + w, y0 + 2, 2, 4);
    // riquadro dello schermo visibile
    const vx0 = (this.camX - X0) / PXM;
    const vw = this.scale.width / PXM;
    g.lineStyle(1, 0xffffff, 0.5).strokeRect(x0 + (vx0 / 100) * w, y0 - 1, (vw / 100) * w, h + 2);
    for (const a of this.actors.values()) {
      const m = (a.spr.x - X0) / PXM;
      const yy = y0 + h / 2 + ((a.spr.y - MIDY) / (LANE * 1.3)) * (h / 2);
      g.fillStyle(a.side === 0 ? 0x3fd0ff : 0xff5a5a).fillRect(x0 + (m / 100) * w - 1, yy - 1, 2, 2);
    }
    const bm = (this.ball.x - X0) / PXM;
    g.fillStyle(0xffffff).fillRect(x0 + (bm / 100) * w - 1, y0 - 2, 3, 3);
  }

  // ---------- commenti ----------

  private comment(who: string, text: string) {
    if (this.comments.length > 2) this.comments.shift();
    this.comments.push({ who, text });
  }

  private showComment(cm: { who: string; text: string }) {
    const W = this.scale.width;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(3100);
    const a = this.actors.get(cm.who);
    const ch = CAST[cm.who];
    const faceKey = a
      ? portrait(this, cm.who, a.p.face, a.p.role === 'GK' ? this.m.teams[a.side].colors.gk : this.m.teams[a.side].colors.shirt, { expr: /!/.test(cm.text) ? 'grinta' : 'normale' })
      : ch
        ? portrait(this, cm.who, ch.face, ch.shirt, { expr: /!/.test(cm.text) ? 'grinta' : 'normale' })
        : null;
    const bw = Math.min(W - 20, 360);
    const g = this.add.graphics();
    panel(g, 10, 50, bw, 30, 0x1b1d2e, a?.side === 1 ? 0xff5a5a : COLORS.accent, 0.92);
    c.add(g);
    if (faceKey) c.add(this.add.image(12, 82, faceKey).setScale(0.75).setOrigin(0, 1));
    const name = a?.p.name ?? ch?.name ?? '';
    c.add(txt(this, 52, 58, name.toUpperCase(), 6, a?.side === 1 ? '#ff8a8a' : '#ffd23f').setOrigin(0, 0.5));
    c.add(txt(this, 52, 70, cm.text, 7, '#ffffff', { wordWrap: { width: bw - 50 } }).setOrigin(0, 0.5));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
    this.commentBox = c;
    this.commentUntil = this.time.now + 1500 + cm.text.length * 25;
  }

  private fill(s: string, id: string, d?: number) {
    return s.replace('{n}', this.actors.get(id)?.p.name ?? '').replace('{d}', String(Math.round(d ?? this.m.distance())));
  }

  // ---------- attese e scelte ----------

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms / fxSpeed.v, () => r()));
  }

  private choose<T>(info: string, hint: string | undefined, opts: Opt<T>[]): Promise<T> {
    return new Promise((resolve) => {
      this.choice?.destroy();
      const W = this.scale.width;
      const H = this.scale.height;
      const c = (this.choice = this.add.container(0, 0).setScrollFactor(0).setDepth(3500));
      const rows = Math.ceil(opts.length / 4);
      const ph = 22 + rows * 34;
      const g = this.add.graphics();
      g.fillStyle(0x0d0a1a, 0.9).fillRect(0, H - ph, W, ph);
      g.fillStyle(COLORS.accent).fillRect(0, H - ph, W, 2);
      c.add(g);
      c.add(txt(this, 10, H - ph + 11, info, 6, '#ffffff').setOrigin(0, 0.5));
      if (hint) c.add(txt(this, W - 10, H - ph + 11, hint, 6, '#ffd23f').setOrigin(1, 0.5));
      const per = Math.min(4, opts.length);
      const bw = Math.min(170, (W - 16) / per - 8);
      opts.forEach((o, i) => {
        const r = Math.floor(i / 4);
        const inRow = Math.min(4, opts.length - r * 4);
        const col = i % 4;
        const x = W / 2 + (col - (inRow - 1) / 2) * (bw + 8);
        const y = H - ph + 22 + r * 34 + 15;
        const en = o.enabled !== false;
        const base = !en ? 0x2a2c3a : o.color ?? COLORS.panelHi;
        const bg = this.add.graphics();
        const draw = (down: boolean) => {
          bg.clear();
          const yo = down ? 2 : 0;
          bg.fillStyle(0x000000, 0.4).fillRect(x - bw / 2 + 2, y - 13 + 3, bw, 28);
          bg.fillStyle(COLORS.ink).fillRect(x - bw / 2 - 2, y - 15 + yo, bw + 4, 30);
          bg.fillStyle(Phaser.Display.Color.ValueToColor(base).darken(25).color).fillRect(x - bw / 2, y - 13 + yo, bw, 26);
          bg.fillStyle(base).fillRect(x - bw / 2, y - 13 + yo, bw, 23);
          bg.fillStyle(0xffffff, 0.25).fillRect(x - bw / 2, y - 13 + yo, bw, 2);
        };
        draw(false);
        const light = Phaser.Display.Color.ValueToColor(base);
        const dark = (light.red * 0.3 + light.green * 0.59 + light.blue * 0.11) > 160;
        const tc = !en ? '#6a6d80' : dark ? '#1a1222' : '#ffffff';
        const lbl = txt(this, x, o.sub ? y - 5 : y - 1, o.label, o.label.length > 14 ? 6 : 7, tc);
        c.add([bg, lbl]);
        if (o.sub) c.add(txt(this, x, y + 6, o.sub, 6, !en ? '#6a6d80' : dark ? '#3a2a10' : '#c8cce8'));
        const z = this.add.zone(x, y, bw + 6, 30).setInteractive({ useHandCursor: true });
        c.add(z);
        z.on('pointerdown', () => {
          if (!en) return;
          draw(true);
          sfx.click();
        });
        z.on('pointerout', () => draw(false));
        z.on('pointerup', () => {
          if (!en) return;
          c.destroy();
          if (this.choice === c) this.choice = undefined;
          resolve(o.value);
        });
      });
      c.setY(30);
      this.tweens.add({ targets: c, y: 0, duration: 140, ease: 'Quad.easeOut' });
    });
  }

  private techOpt<T>(id: string, owner: string, value: T): Opt<T> {
    const t = TECHS[id];
    const partner = t.partner ? ` +${this.m.player(t.partner).name}` : '';
    const ready = this.m.techReady(owner, id);
    let sub = `${t.cost} EN${partner}`;
    if (t.kind === 'tiro') {
      const d = this.m.distance();
      sub = d > (t.range ?? 22) + 4 ? `${t.cost} EN · lontano` : `${t.cost} EN${partner}`;
    }
    return { label: shortName(t.name), sub, value, color: t.color, enabled: ready };
  }

  /** Le tue scelte in attacco. */
  private async chooseAttack(enc: Encounter | null, start: boolean, defHint?: DefKind): Promise<AttackAction> {
    const m = this.m;
    const c = m.player(m.carrier);
    const d = Math.round(m.distance());
    const info = `${c.name}  EN ${Math.round(m.energy[c.id])}/${m.maxEnergy[c.id]}  ·  ${d} m dalla porta`;
    const hint = enc && defHint ? `${enc.def.name}: ${DEF_HINT[defHint]}` : enc ? undefined : start ? 'Campo libero davanti' : 'Solo davanti al portiere!';
    const specials = [...m.techsOf(c.id, 'dribbling').filter(() => !!enc), ...m.techsOf(c.id, 'tiro'), ...m.techsOf(c.id, 'passaggio')];
    const allSpecials = c.techs.filter((t) => (m.sideOf(c.id) === 1 || m.opts.known.includes(t)) && (TECHS[t].kind !== 'dribbling' || !!enc));
    const targets = m.passTargets();
    for (;;) {
      const main: Opt<string>[] = [];
      if (start) main.push({ label: 'AVANZA', sub: 'corri verso la porta', value: 'avanza', color: 0x2f9a50 });
      if (enc) main.push({ label: 'DRIBBLING', sub: '4 EN', value: 'dribbling', color: 0x2f6fd0 });
      if (targets.length) main.push({ label: 'PASSAGGIO', sub: '3 EN', value: 'passaggio', color: 0x2f9a8a });
      main.push({ label: 'TIRO', sub: `8 EN · ${d} m`, value: 'tiro', color: 0xc0306a });
      if (allSpecials.length) main.push({ label: `★ SPECIALI`, sub: `${specials.length} pronte`, value: 'spec', color: 0xffd23f, enabled: specials.length > 0 });
      const k = await this.choose(info, hint, main);
      if (k === 'avanza') return { kind: 'avanza' };
      if (k === 'dribbling') return { kind: 'dribbling' };
      if (k === 'tiro') return { kind: 'tiro' };
      if (k === 'passaggio') {
        const to = await this.chooseTarget(info, hint);
        if (to) return { kind: 'passaggio', to };
        continue;
      }
      // tecniche
      const opts: Opt<string>[] = allSpecials.map((t) => this.techOpt(t, c.id, t));
      opts.push({ label: 'INDIETRO', value: '', color: 0x3a3d55 });
      const t = await this.choose(info, hint, opts);
      if (!t) continue;
      const kind = TECHS[t].kind;
      if (kind === 'passaggio') {
        const to = await this.chooseTarget(info, hint);
        if (to) return { kind: 'passaggio', to, tech: t };
        continue;
      }
      return { kind: kind === 'tiro' ? 'tiro' : 'dribbling', tech: t };
    }
  }

  private async chooseTarget(info: string, hint?: string): Promise<string> {
    const m = this.m;
    const opts: Opt<string>[] = m.passTargets().slice(0, 3).map((t) => {
      const p = m.player(t.id);
      const gain = Math.round(Math.abs(t.x - m.x));
      return { label: p.name.toUpperCase(), sub: `+${gain} m · ${p.techs.some((q) => TECHS[q].kind === 'tiro' && m.opts.known.includes(q)) ? '★' : p.role}`, value: t.id, color: 0x2f9a8a };
    });
    opts.push({ label: 'INDIETRO', value: '', color: 0x3a3d55 });
    return this.choose(info, hint, opts);
  }

  /** Le tue scelte in difesa. */
  private async chooseDefense(enc: Encounter, a: AttackAction): Promise<DefenseAction> {
    const m = this.m;
    const me = enc.def;
    const c = m.player(m.carrier);
    const guess = m.hint(a.kind === 'avanza' ? 'dribbling' : a.kind, ['dribbling', 'passaggio', 'tiro'] as const);
    const info = `${me.name} contro ${c.name}  ·  EN ${Math.round(m.energy[me.id])}/${m.maxEnergy[me.id]}`;
    const hint = `${c.name} ${ATK_HINT[guess]}`;
    const opts: Opt<DefenseAction>[] = [
      { label: 'CONTRASTO', sub: 'contro il dribbling', value: { kind: 'contrasto' }, color: 0x2f6fd0 },
      { label: 'INTERCETTO', sub: 'contro il passaggio', value: { kind: 'intercetto' }, color: 0x2f9a8a },
      { label: 'BLOCCO', sub: 'contro il tiro', value: { kind: 'blocco' }, color: 0xc0306a },
    ];
    for (const t of me.techs.filter((q) => TECHS[q].kind === 'blocco' && m.opts.known.includes(q))) opts.push(this.techOpt(t, me.id, { kind: 'blocco', tech: t }));
    return this.choose(info, hint, opts);
  }

  private async chooseKeeper(shot: ShotInfo): Promise<KeeperAction> {
    const m = this.m;
    const gk = m.keeper(0);
    const p = shot.power;
    const desc = p < 70 ? 'debole' : p < 90 ? 'forte' : p < 110 ? 'fortissimo' : 'devastante';
    const info = `${gk.name}  EN ${Math.round(m.energy[gk.id])}/${m.maxEnergy[gk.id]}`;
    const opts: Opt<KeeperAction>[] = [
      { label: 'PRESA', sub: 'blocca il pallone', value: { kind: 'presa' }, color: 0x2f6fd0 },
      { label: 'PUGNO', sub: 'più sicuro, ma respinge', value: { kind: 'pugno' }, color: 0xc07a1a },
    ];
    for (const t of gk.techs.filter((q) => TECHS[q].kind === 'parata' && m.opts.known.includes(q))) opts.push(this.techOpt(t, gk.id, { kind: p > 90 ? 'pugno' : 'presa', tech: t }));
    return this.choose(info, `Tiro ${desc} in arrivo!`, opts);
  }

  // ---------- la partita ----------

  private async run() {
    await this.wait(300);
    await new LgTalk(this, this.ep.intro, 'full').play();
    if (!this.alive) return;
    await this.banner(`OBIETTIVO: ${objectiveText(this.ep.objective).toUpperCase()}`, '#ffd23f', 1600);
    sfx.whistle(1, true);
    sfx.startCrowd(0.6);
    this.events.once('shutdown', () => sfx.stopCrowd());
    await this.script('start');
    let lastPoss = -1;
    while (this.alive && !this.m.over) {
      const m = this.m;
      if (m.checkHalf()) {
        this.holder = m.carrier;
        this.viewX = m.x;
        this.enc = null;
        sfx.whistle(2);
        await this.banner('INTERVALLO', '#3fd0ff', 1200);
        this.comment('telecronista', 'Si riparte! Le squadre hanno ripreso fiato.');
        this.layout(true);
        await this.script('half');
      }
      await this.lateScripts();
      this.refreshHud();
      const newPoss = m.poss !== lastPoss;
      lastPoss = m.poss;
      this.viewX = m.x;
      this.holder = m.carrier;
      this.enc = null;
      this.layout();
      if (m.side === 0) {
        // a inizio azione: si può tentare il tiro da lontanissimo
        if (newPoss) {
          const long = m.techsOf(m.carrier, 'tiro').some((t) => m.distance() <= (TECHS[t].range ?? 22) + 10);
          if (long) {
            await this.wait(250);
            const a = await this.chooseAttack(null, true);
            if (a.kind !== 'avanza') {
              await this.attack(a, null, null);
              continue;
            }
          }
        }
        const enc = m.nextEncounter();
        await this.runTo(enc ? enc.x : m.shootSpot(), enc);
        if (m.over) break;
        const aiDef = enc ? m.aiDefense(enc) : null;
        const hint = enc && aiDef ? m.hint(aiDef.kind, ['contrasto', 'intercetto', 'blocco'] as const) : undefined;
        const a = await this.chooseAttack(enc, false, hint);
        await this.attack(a, enc, aiDef);
      } else {
        const enc = m.nextEncounter();
        await this.runTo(enc ? enc.x : m.shootSpot(), enc);
        if (m.over) break;
        const a = m.aiAttack(enc);
        await this.wait(200);
        const def = enc ? await this.chooseDefense(enc, a) : null;
        await this.attack(a, enc, def);
      }
      this.refreshHud();
    }
    if (this.alive) await this.finish();
  }

  /** Corsa sul campo lunghissimo fino al prossimo avversario (o al portiere). */
  private async runTo(x: number, enc: Encounter | null) {
    const m = this.m;
    const from = m.x;
    const dist = Math.abs(x - from);
    this.enc = enc;
    const id = m.carrier;
    const side = m.side;
    if (dist > 30 && Math.random() < 0.8) this.comment('telecronista', this.fill(pick(RUN_LINES.start), id));
    else if (side === 0 && Math.random() < 0.3) {
      const mate = this.m.teams[0].players.find((p) => p.id !== id && p.role !== 'GK');
      if (mate) this.comment(mate.id, this.fill(pick(RUN_LINES.mateCheer), id));
    }
    if (dist > 0.5) {
      const dur = Math.max(300, dist * 55);
      let lastCm = this.time.now;
      await new Promise<void>((res) => {
        this.tweens.addCounter({
          from,
          to: x,
          duration: dur,
          ease: 'Sine.easeInOut',
          onUpdate: (tw) => {
            this.viewX = tw.getValue() ?? x;
            this.layout();
            const now = this.time.now;
            if (now - lastCm > 1700 && dist > 40) {
              lastCm = now;
              this.comment('telecronista', this.fill(pick(RUN_LINES.mid), id, side === 0 ? 100 - this.viewX : this.viewX));
            }
          },
          onComplete: () => res(),
        });
      });
    }
    m.advanceTo(x);
    this.viewX = x;
    this.layout();
    this.refreshHud();
    if (enc) {
      if (Math.random() < 0.35) this.comment(enc.def.id, pick(RUN_LINES.rivalTaunt));
      sfx.blip();
    } else if (side === 0) {
      this.comment('telecronista', this.fill(pick(RUN_LINES.near), id));
      sfx.heartbeat();
    }
    await this.wait(250);
  }

  private techFx(id?: string) {
    return id ? { name: TECHS[id].name, color: TECHS[id].color } : undefined;
  }

  private setPose(id: string, pose: Pose, ms: number) {
    const a = this.actors.get(id);
    if (!a) return;
    a.pose = pose;
    a.poseUntil = this.time.now + ms;
  }

  /** Esegue l'azione scelta (o decisa dalla CPU) e la racconta. */
  private async attack(a: AttackAction, enc: Encounter | null, def: DefenseAction | null) {
    const m = this.m;
    if (a.kind === 'tiro') {
      await this.shot(a, enc, def);
      return;
    }
    const steps = m.duel(a, enc, def ?? { kind: 'intercetto' });
    await this.playSteps(steps);
  }

  private async playSteps(steps: Step[]) {
    for (const s of steps) {
      if (!this.alive) return;
      if (s.t === 'duel') {
        await duelFx(this, this.who(s.att), this.who(s.def), {
          kind: s.kind,
          attTech: this.techFx(s.attTech),
          defTech: this.techFx(s.defTech),
          defKind: s.defKind,
          win: s.win,
        });
        await this.afterTech(s.att, s.attTech);
        await this.afterTech(s.def, s.defTech);
        if (s.win && s.kind === 'dribbling') this.setPose(s.def, 'sad', 900);
        if (!s.win) this.setPose(s.def, 'slide', 500);
      } else if (s.t === 'pass') {
        await this.passBall(s.from, s.to);
      } else if (s.t === 'turnover' || s.t === 'rebound') {
        this.enc = null;
        this.holder = s.carrier;
        const p = this.m.player(s.carrier);
        void pop(this, s.t === 'rebound' ? `RIBATTUTA! PALLA A ${p.name.toUpperCase()}` : `PALLA A ${p.name.toUpperCase()}`, s.side === 0 ? '#5be37d' : '#ff8a8a', 700, 8);
        this.viewX = this.m.x;
        this.layout();
        await this.wait(500);
      }
    }
  }

  private async passBall(from: string, to: string) {
    const b = this.actors.get(to)!;
    this.holder = null;
    this.setPose(from, 'kick', 300);
    sfx.pass();
    this.viewX = this.m.x;
    this.layout();
    const tx = b.tx + (this.m.side === 0 ? 10 : -10);
    const ty = b.ty - 3;
    const dist = Math.abs(tx - this.ball.x);
    await new Promise<void>((res) => {
      this.tweens.add({ targets: this.ball, x: tx, y: ty, duration: Math.max(350, dist * 1.4) / fxSpeed.v, ease: 'Sine.easeInOut', onComplete: () => res() });
      this.tweens.addCounter({ from: 0, to: 1, duration: Math.max(350, dist * 1.4) / fxSpeed.v, onUpdate: (t) => (this.ballZ = -Math.sin((t.getValue() ?? 0) * Math.PI) * Math.min(40, dist * 0.08)) });
    });
    this.ballZ = 0;
    this.holder = to;
  }

  /** Dopo una tecnica della CPU: commenti della storia. */
  private async afterTech(id: string, tech?: string) {
    if (!tech || this.m.sideOf(id) === 0) return;
    for (let i = 0; i < this.ep.script.length; i++) {
      const ev = this.ep.script[i];
      if (ev.when === 'rivalTech' && ev.arg === tech && !this.fired.has(i)) {
        this.fired.add(i);
        await this.say(ev.lines);
      }
    }
  }

  private async shot(a: AttackAction, enc: Encounter | null, def: DefenseAction | null) {
    const m = this.m;
    const shooter = m.carrier;
    const side = m.side;
    const dist = m.distance();
    const info = m.shoot(a, enc, def);
    const tech = this.techFx(a.tech);
    this.setPose(shooter, 'kick', 500);
    if (tech) {
      const partner = info.partner ? this.who(info.partner) : undefined;
      await shotFx(this, this.who(shooter), tech, partner);
      await this.afterTech(shooter, a.tech);
    } else {
      sfx.kick(0.8);
    }
    if (dist > 45) this.comment('telecronista', this.fill(pick(RUN_LINES.longShot), shooter, dist));
    // il pallone vola sul campo (attraversandolo tutto, se serve)
    this.holder = null;
    if (tech) {
      this.trail = this.add.particles(0, 0, 'px2', {
        follow: this.ball,
        speed: 20,
        lifespan: 350,
        scale: { start: 2.5, end: 0 },
        tint: [tech.color, 0xffffff],
        frequency: 8,
      }).setDepth(1999);
    }
    for (const s of info.steps) {
      if (s.t !== 'block') continue;
      await this.flyBall(wx(s.x), MIDY + (this.actors.get(s.by)?.ty ?? MIDY) - MIDY, tech ? 1.6 : 1);
      const blocker = this.actors.get(s.by)!;
      this.tweens.add({ targets: blocker.spr, y: blocker.spr.y - 14, duration: 140, yoyo: true });
      if (s.tech) {
        await duelFx(this, this.who(s.by), this.who(shooter), { kind: 'dribbling', attTech: this.techFx(s.tech), defKind: 'blocco', win: s.ok });
      }
      if (s.ok) {
        sfx.tackle();
        await pop(this, 'RESPINTO!', m.sideOf(s.by) === 0 ? '#5be37d' : '#ff8a8a', 600);
      } else {
        sfx.ooh();
        await pop(this, tech ? 'LO TRAVOLGE!' : 'PASSA!', '#ffd23f', 450);
      }
    }
    if (info.blocked) {
      this.trail?.destroy();
      this.trail = undefined;
      const rest = info.steps.filter((s) => s.t === 'turnover' || s.t === 'rebound');
      await this.playSteps(rest);
      return;
    }
    const goalX = side === 0 ? wx(100) : wx(0);
    await this.flyBall(goalX - (side === 0 ? 30 : -30), MIDY - 8, tech ? 1.8 : 1.1);
    this.trail?.destroy();
    this.trail = undefined;
    const ka = side === 0 ? m.aiKeeper(info) : await this.chooseKeeper(info);
    const st = m.save(info, ka);
    const kStep = st.find((s) => s.t === 'keeper');
    if (kStep && kStep.t === 'keeper') {
      await keeperFx(this, this.who(kStep.by), kStep.result, {
        tech: this.techFx(ka.tech),
        shotColor: tech?.color,
        special: !!tech,
        scorer: this.who(shooter),
      });
      await this.afterTech(kStep.by, ka.tech);
    }
    const goal = st.find((s) => s.t === 'goal');
    if (goal) {
      await this.goal(side, shooter, a.tech);
      return;
    }
    await this.playSteps(st.filter((s) => s.t === 'turnover' || s.t === 'rebound'));
  }

  private flyBall(x: number, y: number, speed: number) {
    const dist = Math.abs(x - this.ball.x);
    const dur = Math.max(260, (dist / (1.6 * speed)) / fxSpeed.v);
    return new Promise<void>((res) => {
      this.tweens.add({ targets: this.ball, x, y, duration: dur, ease: 'Linear', onComplete: () => res() });
      this.tweens.add({ targets: this.ball, angle: 1080, duration: dur });
      this.tweens.addCounter({ from: 0, to: 1, duration: dur, onUpdate: (t) => (this.ballZ = -Math.sin((t.getValue() ?? 0) * Math.PI) * Math.min(30, dist * 0.05)) });
    });
  }

  private async goal(side: Side, by: string, tech?: string) {
    const m = this.m;
    this.refreshHud();
    sfx.roar(1.4);
    commentary.say('goal', m.player(by).name);
    const scorer = this.actors.get(by);
    for (const a of this.actors.values()) if (a.side === side) this.setPose(a.p.id, 'celebrate', 1800);
    for (const a of this.actors.values()) if (a.side !== side) this.setPose(a.p.id, 'sad', 1800);
    void scorer;
    await this.banner(side === 0 ? `GOL DI ${m.player(by).name.toUpperCase()}!` : `GOL ${m.teams[1].short}...`, side === 0 ? '#ffd23f' : '#ff8a8a', 1300);
    if (tech && side === 0) this.comment('telecronista', `Con il ${TECHS[tech].name}! Incredibile!`);
    // calcio d'inizio
    this.holder = m.carrier;
    this.viewX = m.x;
    this.enc = null;
    this.cameras.main.flash(200, 255, 255, 255);
    this.layout(true);
    this.camX = Phaser.Math.Clamp(wx(50) - this.scale.width / 2, 0, WORLD_W);
    await this.script(side === 0 ? 'goalFor' : 'goalAgainst');
  }

  private async banner(text: string, color: string, ms: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(3900);
    const g = this.add.graphics();
    g.fillStyle(0x0d0a1a, 0.85).fillRect(0, H / 2 - 26, W, 52);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color).fillRect(0, H / 2 - 26, W, 2).fillRect(0, H / 2 + 24, W, 2);
    c.add(g);
    const t = shadowTxt(this, W / 2, H / 2, text, text.length > 22 ? 10 : 14, color, '#1a1222', 2);
    c.add(t.c);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    t.c.x = W + 200;
    this.tweens.add({ targets: t.c, x: W / 2, duration: 260, ease: 'Quad.easeOut' });
    await this.wait(ms);
    this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
    await this.wait(200);
  }

  private async say(lines: LgLine[]) {
    if (!lines.length || !this.alive) return;
    await new LgTalk(this, lines, 'overlay').play();
  }

  private async script(when: Trigger) {
    for (let i = 0; i < this.ep.script.length; i++) {
      const ev = this.ep.script[i];
      if (ev.when !== when || this.fired.has(i)) continue;
      this.fired.add(i);
      await this.applyEvent(ev);
    }
  }

  private async lateScripts() {
    for (let i = 0; i < this.ep.script.length; i++) {
      const ev = this.ep.script[i];
      if (ev.when !== 'late' || this.fired.has(i) || this.m.clock < Number(ev.arg ?? 0)) continue;
      this.fired.add(i);
      await this.applyEvent(ev);
    }
  }

  private async applyEvent(ev: Episode['script'][number]) {
    await this.say(ev.lines);
    if (ev.unlock) {
      if (!this.sv.learned.includes(ev.unlock)) this.sv.learned.push(ev.unlock);
      if (!this.m.opts.known.includes(ev.unlock)) this.m.opts.known.push(ev.unlock);
      save();
    }
    if (ev.refill) this.m.restore(ev.refill, 999);
  }

  // ---------- fine ----------

  private async finish() {
    const m = this.m;
    this.choice?.destroy();
    sfx.whistle(3, true);
    await this.banner('FISCHIO FINALE', '#ffffff', 1200);
    const ok = objectiveMet(this.ep.objective, m.score);
    const wasCleared = this.sv.cleared;
    const r = episodeReward(this.sv, this.epi, ok, { duelsWon: m.duelsWon, score: m.score, specialGoals: m.specialGoals });
    const p = progressOf();
    p.coins += r.coins;
    // trofei (bacheca comune a tutto il gioco)
    const sv = load();
    const fresh = checkTrophies((p.trophies = p.trophies ?? []), {
      totals: p.totals ?? newTotals(),
      cups: sv.trophies ?? 0,
      stickers: sv.album ? ownedStickers(sv.album) : 0,
      maxLevelPlayers: Object.values(p.xp).flat().filter((x) => levelOf(x) >= MAX_LEVEL).length,
      legend: this.sv.cleared,
    });
    let bonus = 0;
    for (const t of fresh) bonus += t.reward;
    p.coins += bonus;
    save();
    if (ok) {
      sfx.fanfare();
      sfx.roar(1.2);
    } else sfx.sadJingle();
    await this.resultPanel(ok, r, fresh.map((t) => t.name), bonus);
    await new LgTalk(this, ok ? this.ep.win : this.ep.lose, 'full').play();
    if (!this.alive) return;
    const choice = ok ? 'hub' : await this.choose('Obiettivo non raggiunto', undefined, [
      { label: 'RIPROVA', value: 'retry', color: 0x2f9a50 },
      { label: 'MENU EPISODI', value: 'hub', color: 0x3a3d55 },
    ]);
    if (choice === 'retry') {
      this.cameras.main.fadeOut(250, 10, 8, 20);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ ep: this.epi }));
      return;
    }
    backToScene(this, 'leggenda', { celebrate: ok && wasCleared === this.epi ? this.epi : undefined });
  }

  private resultPanel(ok: boolean, r: { coins: number; pts: number; first: boolean }, trophies: string[], bonus: number): Promise<void> {
    return new Promise((res) => {
      const W = this.scale.width;
      const H = this.scale.height;
      const c = this.add.container(0, 0).setScrollFactor(0).setDepth(4500);
      c.add(this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.85).setOrigin(0));
      const g = this.add.graphics();
      const pw = Math.min(W - 40, 420);
      panel(g, W / 2 - pw / 2, 56, pw, 240, 0x1b1d2e, ok ? COLORS.accent : 0xff5a5a, 0.97);
      c.add(g);
      const [a, b] = this.m.teams;
      c.add(shadowTxt(this, W / 2, 84, ok ? 'OBIETTIVO RAGGIUNTO!' : 'OBIETTIVO MANCATO', 12, ok ? '#5be37d' : '#ff5a5a', '#1a1222', 2).c);
      c.add(txt(this, W / 2, 112, `${a.name}  ${this.m.score[0]} - ${this.m.score[1]}  ${b.name}`, 7, '#ffffff'));
      const scorers = this.m.scorers.map((s) => `${this.m.player(s.by).name} ${Math.min(90, Math.floor((s.time / this.m.duration) * 90))}'${s.tech ? ' ★' : ''}`).join('   ');
      if (scorers) c.add(txt(this, W / 2, 128, scorers, 6, '#8a8fb0', { wordWrap: { width: pw - 30 }, align: 'center' }));
      c.add(txt(this, W / 2, 152, objectiveText(this.ep.objective), 7, '#ffd23f'));
      const rows = [
        `Duelli vinti: ${this.m.duelsWon}`,
        `Punti Leggenda: +${r.pts}`,
        `Monete: +${r.coins + bonus}`,
        ...(r.first ? ['NUOVO EPISODIO SBLOCCATO!'] : []),
        ...trophies.map((t) => `TROFEO: ${t}`),
      ];
      rows.forEach((s, i) => c.add(txt(this, W / 2, 176 + i * 16, s, 7, s.startsWith('TROFEO') ? '#ff7ab8' : s.startsWith('NUOVO') ? '#5be37d' : '#ffffff')));
      const t = txt(this, W / 2, 282, 'TOCCA PER CONTINUARE', 6, '#8a8fb0');
      c.add(t);
      this.tweens.add({ targets: t, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 250 });
      this.time.delayedCall(700, () => {
        const z = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
        c.add(z);
        z.once('pointerup', () => {
          c.destroy();
          res();
        });
      });
    });
  }

  private leave() {
    this.alive = false;
    backToScene(this, 'leggenda');
  }
}

/** Nome breve della tecnica per i pulsanti. */
function shortName(n: string): string {
  return n.replace(/^TIRO DEL(L')? ?/, '').replace(/^TIRO /, '').replace(/^DRIBBLING /, '').replace(/^PASSAGGIO /, '').replace(/^PARATA DEL /, '');
}
