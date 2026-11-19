import Phaser from 'phaser';
import { COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { asPlayerDef, asTeamDef, portrait } from '../gfx/animeArt';
import { frameIndex, makePlayerSheet, type Dir, type Pose } from '../gfx/sprites';
import { hex } from '../gfx/px';
import {
  TECHS, episodeReward, objectiveMet, objectiveText,
  type AttackAction, type DefenseAction, type DefKind, type Encounter, type KeeperAction, type LeggendaSave,
  type LgPlayer, type ShotInfo, type Side, type Step, newLeggenda,
} from '../modes/leggenda';
import { CY, FIELD_L, FIELD_W, FieldMatch, type FieldEvent } from '../modes/leggendaField';
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

/** Metri -> pixel: il campo visto dall'alto, più grande dello schermo in tutte e due le direzioni. */
const PXM = 15;
const MARGIN = 70;
const WORLD_W = MARGIN * 2 + FIELD_L * PXM;
const WORLD_H = MARGIN * 2 + FIELD_W * PXM;
const wx = (m: number) => MARGIN + m * PXM;
const wy = (m: number) => MARGIN + m * PXM;
/** Larghezza della porta (metri). */
const GOAL_HALF = 3.7;

interface Actor {
  p: LgPlayer;
  side: Side;
  idx: number;
  spr: Phaser.GameObjects.Sprite;
  sh: Phaser.GameObjects.Image;
  pose: Pose | null;
  poseUntil: number;
  face: 1 | -1;
  dir: Dir;
  /** Spostamento dell'ultimo fotogramma (per l'animazione di corsa). */
  moving: boolean;
}

interface Opt<T> {
  label: string;
  sub?: string;
  value: T;
  color?: number;
  enabled?: boolean;
}

/** Cosa ferma la corsa: un evento del campo o il tasto AZIONE. */
type Stop = FieldEvent | { t: 'action' } | { t: 'over' };

const DEF_HINT: Record<DefKind, string> = {
  contrasto: 'punta il pallone: vuole il contrasto',
  intercetto: 'copre i compagni: pronto a intercettare',
  blocco: 'si piazza davanti alla porta',
};
const ATK_HINT = { dribbling: 'sembra voler dribblare', passaggio: 'cerca un compagno', tiro: 'carica il tiro!' };

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/**
 * Leggenda del Pallone: muovi il giocatore sul campo col joystick; quando ti
 * scontri con un avversario si ferma tutto e scegli la mossa.
 */
export class EpicMatchScene extends Phaser.Scene {
  private m!: FieldMatch;
  private epi = 0;
  private ep!: Episode;
  private sv!: LeggendaSave;
  private alive = false;
  private actors = new Map<string, Actor>();
  private ball!: Phaser.GameObjects.Sprite;
  private ballSh!: Phaser.GameObjects.Image;
  private holder: string | null = null;
  private ballZ = 0;
  private camX = 0;
  private camY = 0;
  private scoreT!: Phaser.GameObjects.Text;
  private timeT!: Phaser.GameObjects.Text;
  private radar!: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private distT!: Phaser.GameObjects.Text;
  private ctrlT!: Phaser.GameObjects.Text;
  private choice?: Phaser.GameObjects.Container;
  private comments: { who: string; text: string }[] = [];
  private commentBox?: Phaser.GameObjects.Container;
  private commentUntil = 0;
  private fired = new Set<number>();
  private enc: Encounter | null = null;
  private exitArmed = false;
  private exitBtn!: Phaser.GameObjects.Text;
  private trail?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Corsa libera in corso: il campo si muove e il joystick comanda. */
  private playing = false;
  private stopRes?: (s: Stop) => void;
  private actionReq = false;
  private joy = { pointer: null as number | null, bx: 0, by: 0, kx: 0, ky: 0 };
  private joyG!: Phaser.GameObjects.Graphics;
  private joyHelp!: Phaser.GameObjects.Text;
  private actBtn!: Phaser.GameObjects.Container;
  private actLbl!: Phaser.GameObjects.Text;
  private actSub!: Phaser.GameObjects.Text;
  private actDown = false;
  private keys?: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space', Phaser.Input.Keyboard.Key>;
  /** Compagni evidenziati mentre scegli a chi passare. */
  private marks: string[] = [];
  private nextCm = 0;
  private nearSaid = -1;

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
    this.playing = false;
    this.stopRes = undefined;
    this.actionReq = false;
    this.marks = [];
    this.joy.pointer = null;
    this.nearSaid = -1;
    fxSpeed.v = 1;
    music.play('leggenda');
    this.events.once('shutdown', () => {
      this.alive = false;
      this.playing = false;
      this.tweens.killAll();
      this.time.removeAllEvents();
    });

    // tecniche insegnate dalla storia all'inizio dell'episodio
    for (const t of this.ep.teaches ?? []) if (!this.sv.learned.includes(t)) this.sv.learned.push(t);
    save();

    const diff = all.settings.difficulty;
    const assist = diff === 'facile' ? 10 : diff === 'difficile' ? -2 : 4;
    this.m = new FieldMatch(heroTeam(this.epi), rivalTeam(this.epi), {
      minutes: this.ep.minutes,
      assist,
      known: [...this.sv.learned],
      injured: this.ep.injured,
      cpuPace: diff === 'facile' ? 0.88 : diff === 'difficile' ? 1.08 : 1,
    });
    if (this.ep.injured?.nico) this.m.teams[0].players.find((p) => p.id === 'nico')!.face.plaster = true;

    this.drawPitch();
    this.makeActors();
    this.ball = this.add.sprite(wx(50), wy(CY), 'ball', 0).setScale(2).setDepth(2000);
    this.ballSh = this.add.image(wx(50), wy(CY), 'ballShadow').setScale(2).setAlpha(0.35).setDepth(10);
    this.holder = this.m.carrier;
    this.over = this.add.graphics().setDepth(2500);
    this.distT = txt(this, 0, 0, '', 6, '#ffffff', { backgroundColor: '#1a1222', padding: { x: 3, y: 2 } }).setDepth(2600);
    this.ctrlT = txt(this, 0, 0, '', 6, '#ffd23f').setDepth(2600);
    this.buildHud();
    this.buildControls();
    this.snapActors();
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.camX = wx(50) - this.scale.width / 2;
    this.camY = wy(CY) - this.scale.height / 2;
    this.cameras.main.setScroll(this.camX, this.camY);
    this.cameras.main.fadeIn(300, 10, 8, 20);
    this.input.on('pointerdown', () => {
      // durante le scene animate un tocco le accelera
      if (!this.choice && !this.playing) fxSpeed.v = Math.min(3, fxSpeed.v + 1);
    });
    this.input.on('pointerup', () => (fxSpeed.v = 1));
    void this.run();
  }

  // ---------- grafica ----------

  private drawPitch() {
    const key = `lg_field_${this.epi}`;
    if (!this.textures.exists(key)) {
      const cv = document.createElement('canvas');
      cv.width = WORLD_W;
      cv.height = WORLD_H;
      const ctx = cv.getContext('2d')!;
      const ep = this.ep;
      const col = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
      // tribune tutto intorno, piene di tifosi
      ctx.fillStyle = col(ep.night ? 0x1c1f38 : 0x3a3e58);
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      for (let y = 0; y < WORLD_H; y += 5) {
        for (let x = (y % 2) * 2; x < WORLD_W; x += 5) {
          const inField = x > MARGIN - 26 && x < WORLD_W - MARGIN + 26 && y > MARGIN - 26 && y < WORLD_H - MARGIN + 26;
          if (inField) continue;
          const r = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const v = r - Math.floor(r);
          if (v < 0.15) continue;
          const shirt = [0xe8443a, 0xffffff, 0x2f6fd0, 0xffd23f, 0x3fae5a, 0xff8a2a][Math.floor(v * 6)];
          ctx.fillStyle = col(shirt, ep.night ? 0.65 : 0.95);
          ctx.fillRect(x, y + 2, 3, 2);
          ctx.fillStyle = col(0xf3cba5, ep.night ? 0.55 : 0.9);
          ctx.fillRect(x + 1, y, 2, 2);
        }
      }
      // cartelloni a bordo campo
      const ads = ['LEGGENDA', 'PIXEL', 'CALCIO', 'VENTO', 'GOL!', 'ARCADE'];
      const adc = [0xe8443a, 0x2f6fd0, 0xffd23f, 0x3fae5a, 0xff8a2a, 0x8a3fd0];
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = col(0x1a1222);
      ctx.fillRect(MARGIN - 28, MARGIN - 28, FIELD_L * PXM + 56, FIELD_W * PXM + 56);
      for (let i = 0; i * 150 < FIELD_L * PXM + 40; i++) {
        for (const yy of [MARGIN - 26, WORLD_H - MARGIN + 12]) {
          const x = MARGIN - 26 + i * 150;
          ctx.fillStyle = col(adc[(i + (yy > MARGIN ? 3 : 0)) % adc.length]);
          ctx.fillRect(x, yy, 148, 14);
          ctx.fillStyle = i % 3 === 2 ? '#1a1222' : '#ffffff';
          ctx.fillText(ads[(i + (yy > MARGIN ? 2 : 0)) % ads.length], x + 12, yy + 7);
        }
      }
      // prato a strisce
      const g1 = ep.night ? 0x2f7a32 : ep.snow ? 0x5a9a5a : 0x3f9a3a;
      const g2 = ep.night ? 0x358a38 : ep.snow ? 0x66a866 : 0x4aa844;
      ctx.fillStyle = col(ep.night ? 0x245a28 : 0x347f30);
      ctx.fillRect(MARGIN - 12, MARGIN - 12, FIELD_L * PXM + 24, FIELD_W * PXM + 24);
      for (let m = 0; m < FIELD_L; m += 5) {
        ctx.fillStyle = col(Math.floor(m / 5) % 2 === 0 ? g1 : g2);
        ctx.fillRect(wx(m), wy(0), 5 * PXM, FIELD_W * PXM);
      }
      // linee
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx(0), wy(0), FIELD_L * PXM, FIELD_W * PXM);
      ctx.beginPath();
      ctx.moveTo(wx(50), wy(0));
      ctx.lineTo(wx(50), wy(FIELD_W));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wx(50), wy(CY), 9.15 * PXM, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(wx(50) - 3, wy(CY) - 3, 6, 6);
      for (const s of [0, 1]) {
        const gx = s === 0 ? 0 : FIELD_L;
        const d = s === 0 ? 1 : -1;
        const box = (len: number, half: number) => ctx.strokeRect(Math.min(wx(gx), wx(gx + d * len)), wy(CY - half), len * PXM, half * 2 * PXM);
        box(16.5, 20.15);
        box(5.5, 9.15);
        ctx.fillRect(wx(gx + d * 11) - 2, wy(CY) - 2, 4, 4);
        ctx.beginPath();
        ctx.arc(wx(gx + d * 11), wy(CY), 9.15 * PXM, s === 0 ? -0.93 : Math.PI - 0.93, s === 0 ? 0.93 : Math.PI + 0.93);
        ctx.stroke();
      }
      // le porte, con la rete
      for (const s of [0, 1]) {
        const gx = wx(s === 0 ? 0 : FIELD_L);
        const d = s === 0 ? -1 : 1;
        const depth = 2.2 * PXM;
        const y0 = wy(CY - GOAL_HALF);
        const h = GOAL_HALF * 2 * PXM;
        ctx.fillStyle = 'rgba(20,20,40,0.45)';
        ctx.fillRect(Math.min(gx, gx + d * depth), y0, depth, h);
        ctx.strokeStyle = 'rgba(230,230,240,0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= depth; i += 6) {
          ctx.beginPath();
          ctx.moveTo(gx + d * i, y0);
          ctx.lineTo(gx + d * i, y0 + h);
          ctx.stroke();
        }
        for (let j = 0; j <= h; j += 6) {
          ctx.beginPath();
          ctx.moveTo(gx, y0 + j);
          ctx.lineTo(gx + d * depth, y0 + j);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.min(gx, gx + d * depth), y0 - 3, depth + 2, 3);
        ctx.fillRect(Math.min(gx, gx + d * depth), y0 + h, depth + 2, 3);
        ctx.fillRect(gx - 2, y0 - 3, 4, h + 6);
      }
      if (ep.snow) {
        for (let i = 0; i < 2500; i++) {
          const r = Math.sin(i * 91.7) * 9999;
          const v = r - Math.floor(r);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(wx(Math.floor(v * FIELD_L)), wy(((v * 7919) % 1) * FIELD_W), 2, 2);
        }
      }
      if (ep.night) {
        for (const [x, y] of [[0, 0], [WORLD_W, 0], [0, WORLD_H], [WORLD_W, WORLD_H]]) {
          const g = ctx.createRadialGradient(x, y, 4, x, y, 160);
          g.addColorStop(0, 'rgba(255,255,230,0.8)');
          g.addColorStop(1, 'rgba(255,255,230,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 160, y - 160, 320, 320);
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
        this.actors.set(p.id, { p, side: side as Side, idx: i, spr, sh, pose: null, poseUntil: 0, face: side === 0 ? 1 : -1, dir: 'side', moving: false });
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

  /** Tutti al loro posto, senza animazione. */
  private snapActors() {
    for (const a of this.actors.values()) {
      const p = this.m.pos[a.p.id];
      a.spr.setPosition(wx(p.x), wy(p.y));
    }
    this.updateBall(0);
  }

  // ---------- comandi ----------

  private buildControls() {
    const H = this.scale.height;
    const W = this.scale.width;
    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(3050);
    this.joyHelp = txt(this, 78, H - 128, 'TRASCINA\nPER CORRERE', 6, '#ffffff', { align: 'center', lineSpacing: 4 }).setScrollFactor(0).setDepth(3050);
    this.tweens.add({ targets: this.joyHelp, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    // zona del joystick: tutta la metà sinistra sotto il tabellone
    const z = this.add.zone(0, 56, W * 0.55, H - 56).setOrigin(0).setScrollFactor(0).setInteractive().setDepth(1);
    z.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.joy.pointer !== null) return;
      this.joy.pointer = p.id;
      this.joy.bx = Phaser.Math.Clamp(p.x, 50, W * 0.5);
      this.joy.by = Phaser.Math.Clamp(p.y, 90, H - 50);
      this.joy.kx = p.x;
      this.joy.ky = p.y;
      this.joyHelp.setVisible(false);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joy.pointer) return;
      const R = 40;
      let dx = p.x - this.joy.bx;
      let dy = p.y - this.joy.by;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        this.joy.bx += (dx / d) * (d - R);
        this.joy.by += (dy / d) * (d - R);
        dx = p.x - this.joy.bx;
        dy = p.y - this.joy.by;
      }
      this.joy.kx = p.x;
      this.joy.ky = p.y;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.joy.pointer) this.joy.pointer = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    // tasto AZIONE (in attacco) / CAMBIA (in difesa)
    const bx = W - 64;
    const by = H - 70;
    const c = (this.actBtn = this.add.container(bx, by).setScrollFactor(0).setDepth(3050));
    const g = this.add.graphics();
    const draw = (down: boolean) => {
      g.clear();
      const att = this.m.side === 0;
      const base = att ? 0xc0306a : 0x2f6fd0;
      g.fillStyle(0x000000, 0.35).fillCircle(3, 5, 40);
      g.fillStyle(COLORS.ink).fillCircle(0, down ? 2 : 0, 40);
      g.fillStyle(Phaser.Display.Color.ValueToColor(base).darken(25).color).fillCircle(0, down ? 2 : 0, 37);
      g.fillStyle(base).fillCircle(0, down ? 0 : -2, 34);
      g.fillStyle(0xffffff, 0.22).fillCircle(-10, -14, 10);
    };
    draw(false);
    this.actLbl = txt(this, 0, -5, 'AZIONE', 8, '#ffffff');
    this.actSub = txt(this, 0, 9, 'passa o tira', 5, '#ffe0ea');
    c.add([g, this.actLbl, this.actSub]);
    const hit = this.add.zone(bx, by, 96, 96).setScrollFactor(0).setInteractive().setDepth(3051);
    hit.on('pointerdown', () => {
      if (!this.playing) return;
      this.actDown = true;
      draw(true);
      sfx.click();
    });
    const up = () => {
      if (!this.actDown) return;
      this.actDown = false;
      draw(false);
      if (!this.playing) return;
      if (this.m.side === 0) this.actionReq = true;
      else {
        this.m.switchDefender();
        sfx.blip();
      }
    };
    hit.on('pointerup', up);
    hit.on('pointerout', () => {
      this.actDown = false;
      draw(false);
    });
    this.events.on('lg-side', () => draw(false));

    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, space: K.SPACE }) as typeof this.keys;
      kb.on('keydown-SPACE', () => {
        if (!this.playing) return;
        if (this.m.side === 0) this.actionReq = true;
        else this.m.switchDefender();
      });
    }
  }

  /** Direzione del joystick (o delle frecce), null se fermo. */
  private stick(): { mx: number; my: number } | null {
    let mx = 0;
    let my = 0;
    if (this.joy.pointer !== null) {
      mx = (this.joy.kx - this.joy.bx) / 40;
      my = (this.joy.ky - this.joy.by) / 40;
    }
    const k = this.keys;
    if (k) {
      if (k.left.isDown || k.a.isDown) mx -= 1;
      if (k.right.isDown || k.d.isDown) mx += 1;
      if (k.up.isDown || k.w.isDown) my -= 1;
      if (k.down.isDown || k.s.isDown) my += 1;
    }
    if (Math.hypot(mx, my) < 0.2) return null;
    return { mx, my };
  }

  private drawControls() {
    const g = this.joyG;
    g.clear();
    const H = this.scale.height;
    const show = this.playing;
    this.actBtn.setVisible(show);
    if (!show) return;
    const att = this.m.side === 0;
    this.actLbl.setText(att ? 'AZIONE' : 'CAMBIA');
    this.actSub.setText(att ? 'passa o tira' : 'altro difensore');
    const active = this.joy.pointer !== null;
    const bx = active ? this.joy.bx : 78;
    const by = active ? this.joy.by : H - 74;
    g.fillStyle(0x000000, active ? 0.3 : 0.18).fillCircle(bx, by, 44);
    g.lineStyle(2, 0xffffff, active ? 0.5 : 0.25).strokeCircle(bx, by, 44);
    const kx = active ? bx + Phaser.Math.Clamp(this.joy.kx - bx, -40, 40) : bx;
    const ky = active ? by + Phaser.Math.Clamp(this.joy.ky - by, -40, 40) : by;
    g.fillStyle(0xffffff, active ? 0.6 : 0.3).fillCircle(kx, ky, 18);
  }

  // ---------- la corsa ----------

  /** Corsa libera finché non succede qualcosa. */
  private play(): Promise<Stop> {
    this.actionReq = false;
    this.enc = null;
    this.holder = this.m.carrier;
    this.events.emit('lg-side');
    return new Promise((res) => {
      this.stopRes = res;
      this.playing = true;
    });
  }

  private stopPlay(s: Stop) {
    this.playing = false;
    this.joy.pointer = null;
    const r = this.stopRes;
    this.stopRes = undefined;
    r?.(s);
  }

  update(time: number, dms: number) {
    if (!this.m) return;
    const dt = Math.min(0.05, dms / 1000);
    const m = this.m;
    if (this.playing) {
      if (this.actionReq) this.stopPlay({ t: 'action' });
      else {
        const side = m.side;
        const ev = m.step(dt, this.stick());
        if (m.side !== side) this.events.emit('lg-side');
        this.holder = m.carrier;
        if (ev) this.stopPlay(ev);
        else if (m.over || (m.half === 1 && m.time >= m.duration / 2)) this.stopPlay({ t: 'over' });
        this.runComments(time);
        this.refreshHud();
      }
    }
    for (const a of this.actors.values()) {
      const p = m.pos[a.p.id];
      const tx = wx(p.x);
      const ty = wy(p.y);
      const dx = tx - a.spr.x;
      const dy = ty - a.spr.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.3) {
        // salti grandi (rimesse, calcio d'inizio): ci si arriva correndo
        const k = d > 30 ? Math.min(1, (700 * dt * fxSpeed.v) / d) : 1;
        a.spr.x += dx * k;
        a.spr.y += dy * k;
        if (Math.abs(dx) > Math.abs(dy) * 0.8) {
          a.dir = 'side';
          a.face = dx > 0 ? 1 : -1;
        } else a.dir = dy > 0 ? 'down' : 'up';
        a.moving = true;
      } else {
        a.moving = false;
        if (a.p.id !== this.holder) {
          const bx = this.ball.x;
          const by = this.ball.y;
          if (Math.abs(bx - a.spr.x) > Math.abs(by - a.spr.y)) {
            a.dir = 'side';
            a.face = bx > a.spr.x ? 1 : -1;
          } else if (Math.abs(by - a.spr.y) > 8) a.dir = by > a.spr.y ? 'down' : 'up';
        }
      }
      let pose: Pose = a.moving ? (['run0', 'run1', 'run2', 'run3'] as Pose[])[Math.floor(time / 90) % 4] : 'idle';
      let dir = a.dir;
      if (m.stun[a.p.id] > 0) pose = m.stun[a.p.id] > 1 ? 'slide' : 'sad';
      if (a.pose && time < a.poseUntil) pose = a.pose;
      if (pose === 'slide' || pose === 'kick' || pose === 'dive' || pose === 'celebrate' || pose === 'sad') dir = 'side';
      a.spr.setFrame(frameIndex(dir, pose));
      a.spr.setFlipX(dir === 'side' && a.face < 0);
      a.spr.setDepth(100 + a.spr.y);
      a.sh.setPosition(a.spr.x, a.spr.y);
    }
    this.updateBall(time);
    // telecamera che segue il pallone, un po' avanti nella direzione d'attacco
    const W = this.scale.width;
    const H = this.scale.height;
    const lead = m.side === 0 ? 60 : -60;
    const wantX = Phaser.Math.Clamp(this.ball.x + lead - W / 2, 0, WORLD_W - W);
    const wantY = Phaser.Math.Clamp(this.ball.y - H / 2 + 10, 0, WORLD_H - H);
    const k = Math.min(1, dt * 5 * fxSpeed.v);
    this.camX += (wantX - this.camX) * k;
    this.camY += (wantY - this.camY) * k;
    this.cameras.main.setScroll(Math.round(this.camX), Math.round(this.camY));
    this.drawOverlay();
    this.drawRadar();
    this.drawControls();
    if (this.commentBox && time > this.commentUntil) {
      this.commentBox.destroy();
      this.commentBox = undefined;
    }
    if (!this.commentBox && this.comments.length) this.showComment(this.comments.shift()!);
  }

  /** Commenti mentre si corre. */
  private runComments(time: number) {
    const m = this.m;
    if (time < this.nextCm) return;
    const d = m.distance();
    const id = m.carrier;
    if (m.side === 0 && d < 26 && this.nearSaid !== m.poss) {
      this.nearSaid = m.poss;
      this.comment('telecronista', this.fill(pick(RUN_LINES.near), id));
      sfx.heartbeat();
      this.nextCm = time + 3500;
      return;
    }
    if (Math.random() < 0.5) {
      if (m.side === 0 && d > 40) this.comment('telecronista', this.fill(pick(Math.random() < 0.5 ? RUN_LINES.mid : RUN_LINES.start), id, d));
      else if (m.side === 0) {
        const mate = m.teams[0].players.find((p) => p.id !== id && p.role !== 'GK');
        if (mate) this.comment(mate.id, this.fill(pick(RUN_LINES.mateCheer), id));
      }
    }
    this.nextCm = time + 5000;
  }

  private updateBall(time: number) {
    if (this.holder) {
      const a = this.actors.get(this.holder);
      if (a) {
        const ox = a.dir === 'side' ? a.face * 10 : 0;
        const oy = a.dir === 'down' ? 6 : a.dir === 'up' ? -6 : -3;
        this.ball.setPosition(a.spr.x + ox, a.spr.y + oy);
        this.ballZ = 0;
        if (a.moving) this.ball.setFrame(Math.floor(time / 70) % 4);
      }
    }
    this.ballSh.setPosition(this.ball.x, this.ball.y + this.ballZ + 2);
    this.ball.setDepth(100 + this.ball.y + this.ballZ + 4);
  }

  /** Barre dell'energia, chi comandi, metri dalla porta. */
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
    // chi comandi: anello giallo ai piedi
    const me = this.actors.get(this.m.ctrl);
    if (me && (this.playing || this.choice)) {
      g.lineStyle(2, 0xffd23f, 0.95).strokeEllipse(me.spr.x, me.spr.y, 34, 13);
      const tri = me.spr.y - 60;
      g.fillStyle(0xffd23f).fillTriangle(me.spr.x - 5, tri, me.spr.x + 5, tri, me.spr.x, tri + 6);
      this.ctrlT.setText(me.p.name.toUpperCase()).setPosition(me.spr.x, tri - 7).setVisible(true);
    } else this.ctrlT.setVisible(false);
    for (const id of this.marks) {
      const a = this.actors.get(id);
      if (!a) continue;
      g.lineStyle(2, 0x5be3c0, 1).strokeEllipse(a.spr.x, a.spr.y, 36, 14);
    }
    if (this.holder) bar(this.holder, 0x5be37d);
    if (this.enc) bar(this.enc.def.id, 0x5be37d);
    if (me && me.p.id !== this.holder && this.m.side === 1) bar(me.p.id, 0x5be37d);
    const a = this.holder ? this.actors.get(this.holder) : undefined;
    if (a && this.m.side === 0) {
      const d = Math.round(FIELD_L - (a.spr.x - MARGIN) / PXM);
      this.distT.setText(`${Math.max(0, d)} m`).setPosition(a.spr.x + 24, a.spr.y - 30).setVisible(true);
    } else this.distT.setVisible(false);
  }

  private buildHud() {
    const W = this.scale.width;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);
    const g = this.add.graphics();
    g.fillStyle(0x0d0a1a, 0.85).fillRect(W / 2 - 120, 0, 240, 30);
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
    this.exitBtn.setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
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

  /** Campo in miniatura (in alto a destra): dove sono tutti. */
  private drawRadar() {
    const W = this.scale.width;
    const g = this.radar;
    g.clear();
    const w = 80;
    const h = Math.round((w * FIELD_W) / FIELD_L);
    const x0 = W - w - 8;
    const y0 = 22;
    g.fillStyle(0x0d0a1a, 0.7).fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    g.fillStyle(0x2f7a32, 0.9).fillRect(x0, y0, w, h);
    g.fillStyle(0xffffff, 0.5).fillRect(x0 + w / 2, y0, 1, h);
    g.fillStyle(0xffffff).fillRect(x0 - 2, y0 + h / 2 - 3, 2, 6).fillRect(x0 + w, y0 + h / 2 - 3, 2, 6);
    const sx = (wpx: number) => x0 + (((wpx - MARGIN) / PXM) / FIELD_L) * w;
    const sy = (wpy: number) => y0 + (((wpy - MARGIN) / PXM) / FIELD_W) * h;
    g.lineStyle(1, 0xffffff, 0.45).strokeRect(sx(this.camX), sy(this.camY), (this.scale.width / PXM / FIELD_L) * w, (this.scale.height / PXM / FIELD_W) * h);
    for (const a of this.actors.values()) {
      const me = a.p.id === this.m.ctrl;
      g.fillStyle(me ? 0xffd23f : a.side === 0 ? 0x3fd0ff : 0xff5a5a).fillRect(Math.round(sx(a.spr.x)) - 1, Math.round(sy(a.spr.y)) - 1, me ? 3 : 2, me ? 3 : 2);
    }
    g.fillStyle(0xffffff).fillRect(Math.round(sx(this.ball.x)) - 1, Math.round(sy(this.ball.y)) - 1, 2, 2);
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
      // margine in basso: sui telefoni il bordo dello schermo è curvo
      const ph = 30 + rows * 34;
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
        const z = this.add.zone(x, y, bw + 6, 30).setScrollFactor(0).setInteractive({ useHandCursor: true });
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
  /** Le tue scelte in attacco (enc: chi ti ha fermato; free: aperto col tasto AZIONE, si può tornare a correre). */
  private async chooseAttack(enc: Encounter | null, free: boolean, defHint?: DefKind): Promise<AttackAction | null> {
    const m = this.m;
    const c = m.player(m.carrier);
    const d = Math.round(m.distance());
    const info = `${c.name}  EN ${Math.round(m.energy[c.id])}/${m.maxEnergy[c.id]}  ·  ${d} m dalla porta`;
    const hint = enc && defHint ? `${enc.def.name}: ${DEF_HINT[defHint]}` : enc ? undefined : free ? 'Campo libero: passa o tira' : 'Solo davanti al portiere!';
    const specials = [...m.techsOf(c.id, 'dribbling').filter(() => !!enc), ...m.techsOf(c.id, 'tiro'), ...m.techsOf(c.id, 'passaggio')];
    const allSpecials = c.techs.filter((t) => (m.sideOf(c.id) === 1 || m.opts.known.includes(t)) && (TECHS[t].kind !== 'dribbling' || !!enc));
    const targets = m.passTargets();
    for (;;) {
      const main: Opt<string>[] = [];
      if (enc) main.push({ label: 'DRIBBLING', sub: '4 EN', value: 'dribbling', color: 0x2f6fd0 });
      if (targets.length) main.push({ label: 'PASSAGGIO', sub: '3 EN', value: 'passaggio', color: 0x2f9a8a });
      main.push({ label: 'TIRO', sub: `8 EN · ${d} m`, value: 'tiro', color: 0xc0306a });
      if (allSpecials.length) main.push({ label: 'SPECIALI!', sub: `${specials.length} pronte`, value: 'spec', color: 0xffd23f, enabled: specials.length > 0 });
      if (free) main.push({ label: 'CORRI', sub: 'torna a correre', value: 'corri', color: 0x2f9a50 });
      const k = await this.choose(info, hint, main);
      if (k === 'corri') return null;
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
      const gain = Math.round((t.x - m.x) * (m.side === 0 ? 1 : -1));
      return { label: p.name.toUpperCase(), sub: `${gain >= 0 ? '+' : ''}${gain} m · ${p.techs.some((q) => TECHS[q].kind === 'tiro' && m.opts.known.includes(q)) ? 'BOMBER' : p.role === 'FWD' ? 'ATT' : p.role === 'MID' ? 'CEN' : 'DIF'}`, value: t.id, color: 0x2f9a8a };
    });
    opts.push({ label: 'INDIETRO', value: '', color: 0x3a3d55 });
    this.marks = m.passTargets().slice(0, 3).map((t) => t.id);
    const to = await this.choose(info, hint, opts);
    this.marks = [];
    return to;
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
    if (this.epi === 0 || !this.sv.cleared) {
      await this.say([
        { who: 'maestro', text: 'Muovi Nico col joystick a sinistra. Quando un avversario ti viene addosso, si ferma tutto: scegli dribbling, passaggio, tiro o una tecnica.' },
        { who: 'maestro', text: 'Col tasto AZIONE puoi passare o tirare quando vuoi. In difesa corri addosso a chi ha palla: CAMBIA ti dà un altro difensore.' },
      ]);
    }
    sfx.whistle(1, true);
    sfx.startCrowd(0.6);
    this.events.once('shutdown', () => sfx.stopCrowd());
    await this.script('start');
    while (this.alive && !this.m.over) {
      const m = this.m;
      if (m.checkHalf()) {
        this.holder = m.carrier;
        this.enc = null;
        sfx.whistle(2);
        await this.banner('INTERVALLO', '#3fd0ff', 1200);
        this.comment('telecronista', 'Si riparte! Le squadre hanno ripreso fiato.');
        this.snapActors();
        await this.script('half');
      }
      await this.lateScripts();
      if (!this.alive) return;
      this.refreshHud();
      const s = await this.play();
      if (!this.alive) return;
      this.holder = m.carrier;
      this.refreshHud();
      if (s.t === 'over') continue;
      if (s.t === 'action') {
        const a = await this.chooseAttack(null, true);
        if (a) await this.attack(a, null, null);
      } else if (s.t === 'keeper') {
        sfx.heartbeat();
        const a = (await this.chooseAttack(null, false))!;
        await this.attack(a, null, null);
      } else if (s.t === 'contact') {
        const enc = m.encounter(s.def);
        this.enc = enc;
        sfx.blip();
        this.cameras.main.shake(120, 0.004);
        if (m.side === 0) {
          if (Math.random() < 0.35) this.comment(enc.def.id, pick(RUN_LINES.rivalTaunt));
          const aiDef = m.aiDefense(enc);
          const hint = m.hint(aiDef.kind, ['contrasto', 'intercetto', 'blocco'] as const);
          const a = (await this.chooseAttack(enc, false, hint))!;
          await this.attack(a, enc, aiDef);
        } else {
          const a = m.aiAttack(enc);
          await this.wait(150);
          const def = await this.chooseDefense(enc, a);
          await this.attack(a, enc, def);
        }
      } else if (s.t === 'cpuShot') {
        const a = m.aiAttack(null);
        await this.attack(a.kind === 'tiro' ? a : { kind: 'tiro' }, null, null);
      } else if (s.t === 'cpuPass') {
        await this.attack({ kind: 'passaggio', to: s.to }, null, { kind: 'intercetto' });
      }
      this.enc = null;
      this.refreshHud();
    }
    if (this.alive) await this.finish();
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
        await this.wait(500);
      }
    }
  }

  private async passBall(from: string, to: string) {
    const b = this.actors.get(to)!;
    this.holder = null;
    this.setPose(from, 'kick', 300);
    sfx.pass();
    const bp = this.m.pos[to];
    const tx = wx(bp.x) + (this.m.side === 0 ? 10 : -10);
    const ty = wy(bp.y) - 3;
    void b;
    const dist = Math.hypot(tx - this.ball.x, ty - this.ball.y);
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
      const blocker = this.actors.get(s.by)!;
      await this.flyBall(blocker.spr.x, blocker.spr.y - 6, tech ? 1.6 : 1);
      this.tweens.add({ targets: blocker.spr, y: blocker.spr.y - 14, duration: 140, yoyo: true });
      if (s.tech) {
        await duelFx(this, this.who(s.by), this.who(shooter), { kind: 'blocco', attTech: this.techFx(s.tech), defKind: 'blocco', win: s.ok });
      } else if (s.ok) {
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
    const goalX = side === 0 ? wx(FIELD_L) : wx(0);
    await this.flyBall(goalX - (side === 0 ? 24 : -24), wy(CY) - 6, tech ? 1.8 : 1.1);
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
    const dist = Math.hypot(x - this.ball.x, y - this.ball.y);
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
    this.enc = null;
    this.cameras.main.flash(200, 255, 255, 255);
    this.snapActors();
    this.camX = Phaser.Math.Clamp(wx(50) - this.scale.width / 2, 0, WORLD_W);
    this.camY = Phaser.Math.Clamp(wy(CY) - this.scale.height / 2, 0, WORLD_H);
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
      const [a, b] = this.m.teams;
      const rows = [
        `Duelli vinti: ${this.m.duelsWon}`,
        `Punti Leggenda: +${r.pts}`,
        `Monete: +${r.coins + bonus}`,
        ...(r.first ? [this.epi >= EPISODES.length - 1 ? 'STORIA COMPLETATA!' : 'NUOVO EPISODIO SBLOCCATO!'] : []),
        ...trophies.map((t) => `TROFEO: ${t}`),
      ];
      const ph = 150 + rows.length * 15;
      const y0 = Math.max(44, (H - ph) / 2);
      const g = this.add.graphics();
      const pw = Math.min(W - 40, 440);
      panel(g, W / 2 - pw / 2, y0, pw, ph, 0x1b1d2e, ok ? COLORS.accent : 0xff5a5a, 0.97);
      c.add(g);
      c.add(shadowTxt(this, W / 2, y0 + 24, ok ? 'OBIETTIVO RAGGIUNTO!' : 'OBIETTIVO MANCATO', 12, ok ? '#5be37d' : '#ff5a5a', '#1a1222', 2).c);
      c.add(txt(this, W / 2, y0 + 50, `${a.name}  ${this.m.score[0]} - ${this.m.score[1]}  ${b.name}`, 7, '#ffffff'));
      const scorers = this.m.scorers.map((s) => `${this.m.player(s.by).name} ${Math.min(90, Math.floor((s.time / this.m.duration) * 90))}'`).join('   ');
      if (scorers) c.add(txt(this, W / 2, y0 + 66, scorers, 6, '#8a8fb0', { wordWrap: { width: pw - 30 }, align: 'center' }));
      c.add(txt(this, W / 2, y0 + 88, objectiveText(this.ep.objective), 7, '#ffd23f'));
      rows.forEach((s, i) => c.add(txt(this, W / 2, y0 + 110 + i * 15, s, 7, s.startsWith('TROFEO') ? '#ff7ab8' : /!$/.test(s) ? '#5be37d' : '#ffffff')));
      const t = txt(this, W / 2, y0 + ph - 12, 'TOCCA PER CONTINUARE', 6, '#8a8fb0');
      c.add(t);
      this.tweens.add({ targets: t, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 250 });
      this.time.delayedCall(700, () => {
        const z = this.add.zone(0, 0, W, H).setOrigin(0).setScrollFactor(0).setInteractive();
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
