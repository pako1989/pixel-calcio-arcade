import Phaser from 'phaser';
import { MatchSim } from '../sim/match';
import type { Player } from '../sim/entities';
import type { SimEvent } from '../sim/entities';
import { chooseHumanPassTarget } from '../sim/ai';
import { drawCrowd, drawGoals, drawObstacle, drawPitch, MARGIN, THEMES, Z_SCALE, BAR_H } from '../gfx/pitchArt';
import { GOAL_DEPTH, PASS_LOB_T, PASS_THROUGH_T } from '../sim/match';
import { FRAME, frameIndex, makePlayerSheet, type Dir, type Pose } from '../gfx/sprites';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { commentary } from '../audio/commentary';
import { Controls } from '../input/controls';
import type { MatchLaunch } from '../modes/modes';
import { demoLaunch, fixKits } from './demo';
import { load, progressOf } from '../save/storage';
import { ballTint, equipped, GROWTH_MODES, grownTeam, isRival, kitVariant } from '../modes/progress';
import { TallyTracker } from '../modes/tally';
import { voteFor } from '../modes/ratings';
import { LIVE } from '../modes/spogliatoio';

interface PSprite {
  p: Player;
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
}

/** Colori e nomi delle supermosse in volo. */
const SP_COLORS: Record<string, number> = { fulmine: 0xffe03a, cometa: 0xff8a3a, gemello: 0xb06aff, arcobaleno: 0xff5aa8, combo: 0xffffff };
const SP_NAMES: Record<string, string> = { fulmine: 'TIRO FULMINE', cometa: 'TIRO COMETA', gemello: 'TIRO GEMELLO' };

export interface HudMessage {
  text: string;
  sub?: string;
  color?: string;
  big?: boolean;
  ms?: number;
}

const STEP = 1 / 60;

/** Un fotogramma registrato per il replay: 9 valori per giocatore + la palla. */
interface Snap {
  p: Float32Array;
  st: string[];
  b: [number, number, number, number, number, number, number, number];
}

interface ReplayGoalMeta {
  scorer: string;
  team: 0 | 1;
  teamName: string;
  color: number;
  scoreText: string;
  minute: string;
  tag?: string;
}

const REC_MAX = 330;
const P_FIELDS = 9;

export class MatchScene extends Phaser.Scene {
  sim!: MatchSim;
  launch!: MatchLaunch;
  /** La partita come l'ha preparata la modalità (per rivincita e risultato). */
  private origLaunch!: MatchLaunch;
  /** Si gioca contro una squadra rivale. */
  rival = false;
  private ballSkin = 'classico';
  private celebration = 'salto';
  private markG!: Phaser.GameObjects.Graphics;
  ctrl = new Controls();
  private ps: PSprite[] = [];
  private ball!: Phaser.GameObjects.Sprite;
  /** Secondo pallone del Tiro Gemello. */
  private ballGhost!: Phaser.GameObjects.Sprite;
  private ballShadow!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  /** Segnalino del prossimo compagno da controllare (PASSA in difesa). */
  private hintMarker!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private passRing!: Phaser.GameObjects.Image;
  private volleyRing!: Phaser.GameObjects.Image;
  private chargeG!: Phaser.GameObjects.Graphics;
  private wallG!: Phaser.GameObjects.Graphics;
  private crowdA?: Phaser.GameObjects.Image;
  private crowdB?: Phaser.GameObjects.Image;
  private crowdT = 0;
  private excite = 0;
  private puSprites = new Map<number, { icon: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }>();
  private bumperNodes: { x: number; y: number; c: Phaser.GameObjects.Container }[] = [];
  private geyserG?: Phaser.GameObjects.Graphics;
  private acc = 0;
  private timeScale = 1;
  private hitStop = 0;
  private slowT = 0;
  private endT = 0;
  private camPt = { x: 0, y: 0 };
  private fx!: {
    dust: Phaser.GameObjects.Particles.ParticleEmitter;
    spark: Phaser.GameObjects.Particles.ParticleEmitter;
    fire: Phaser.GameObjects.Particles.ParticleEmitter;
    confetti: Phaser.GameObjects.Particles.ParticleEmitter;
    stars: Phaser.GameObjects.Particles.ParticleEmitter;
    weather?: Phaser.GameObjects.Particles.ParticleEmitter;
    splash?: Phaser.GameObjects.Particles.ParticleEmitter;
  };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private nightOverlay?: Phaser.GameObjects.Rectangle;
  private fog?: Phaser.GameObjects.Image;
  private waveSheet?: Phaser.GameObjects.Image;
  /** Registrazione degli ultimi secondi per il replay del gol. */
  private rec: Snap[] = [];
  private goalFrame = -1;
  private replayIn = 0;
  private replayMeta?: ReplayGoalMeta;
  private replay?: {
    frames: Snap[];
    goalOffset: number;
    head: number;
    live: Snap;
    liveZoom: number;
    layer: Phaser.GameObjects.Container;
    speedBadge: Phaser.GameObjects.Text;
    goalBanner: Phaser.GameObjects.Container;
    bannerShown: boolean;
  };
  private fogWisps: Phaser.GameObjects.Image[] = [];
  private rainOn = false;
  private thunderT = 0;
  private chantT = 0;
  private started = false;
  private vignette?: Phaser.GameObjects.Image;
  private demoT = 0;
  finished = false;
  private tally = new TallyTracker();
  private baseZoom = 1;
  /** Chi aveva la palla prima dell'ultimo passo (per "palla persa"). */
  private prevOwner: Player | null = null;
  private liveN = 0;
  private lastVote = -1;

  constructor() {
    super('match');
  }

  init(data: MatchLaunch) {
    this.origLaunch = data;
    this.launch = this.prepare(data);
    this.ps = [];
    this.puSprites = new Map();
    this.acc = 0;
    this.timeScale = 1;
    this.hitStop = 0;
    this.slowT = 0;
    this.endT = 0;
    this.excite = 0;
    this.demoT = 0;
    this.finished = false;
    this.tally = new TallyTracker();
    this.prevOwner = null;
    this.liveN = 0;
    this.lastVote = -1;
    this.vignette = undefined;
    this.nightOverlay = undefined;
    this.fog = undefined;
    this.waveSheet = undefined;
    this.rec = [];
    this.goalFrame = -1;
    this.replayIn = 0;
    this.replayMeta = undefined;
    this.replay = undefined;
    this.fogWisps = [];
    this.rainOn = false;
    this.thunderT = 14 + Math.random() * 10;
    this.chantT = 12 + Math.random() * 10;
    this.started = false;
    this.crowdA = this.crowdB = undefined;
    this.bumperNodes = [];
    this.geyserG = undefined;
    this.ctrl.reset();
  }

  /**
   * Aggiunge alla partita le scelte del giocatore: falli sì/no, crescita della squadra,
   * maglia, pallone ed esultanza comprati nel negozio.
   */
  private prepare(data: MatchLaunch): MatchLaunch {
    this.rival = false;
    this.ballSkin = 'classico';
    this.celebration = 'salto';
    data = { ...data, config: { ...data.config, specials: !data.demo && (!!data.forceSpecials || load().settings.specials !== false) } };
    if (data.demo || data.config.humanTeam !== 0) return data;
    const cfg = { ...data.config, fouls: load().settings.fouls };
    const p = progressOf();
    this.ballSkin = equipped(p, 'pallone');
    this.celebration = equipped(p, 'esultanza');
    if (GROWTH_MODES.includes(data.mode)) {
      cfg.home = kitVariant(grownTeam(cfg.home, p), equipped(p, 'maglia'));
      cfg.away = fixKits(cfg.home, cfg.away);
      this.rival = isRival(p, cfg.away.id);
    }
    return { ...data, config: cfg };
  }

  create() {
    const cfg = this.launch.config;
    this.sim = new MatchSim(cfg);
    const sim = this.sim;
    if (this.launch.startScore) sim.score = [...this.launch.startScore];
    if (this.launch.superStart && cfg.humanTeam !== null) sim.superBar[cfg.humanTeam] = this.launch.superStart;
    const pitch = cfg.pitch;
    const th = THEMES[pitch.id];
    const W = sim.W;
    const H = sim.H;

    // --- grafica del campo ---
    const pitchKey = `pitch_${pitch.id}`;
    if (!this.textures.exists(pitchKey)) drawPitch(this, pitch, pitchKey);
    this.add.image(-MARGIN, -MARGIN, pitchKey).setOrigin(0).setDepth(0);
    drawCrowd(this, pitch, cfg.home.colors.shirt, cfg.away.colors.shirt, 'crowdA', 'crowdB');
    this.crowdA = this.add.image(-MARGIN, -MARGIN, 'crowdA').setOrigin(0).setDepth(1);
    this.crowdB = this.add.image(-MARGIN, -MARGIN, 'crowdB').setOrigin(0).setDepth(1).setVisible(false);
    const gk = `goal_${pitch.id}`;
    if (!this.textures.exists(gk + '_b')) drawGoals(this, pitch, gk + '_b', gk + '_f');
    const gy = sim.goalTop - BAR_H - 2;
    this.add.image(-GOAL_DEPTH - 2, gy, gk + '_b').setOrigin(0).setDepth(2);
    this.add.image(W - 2, gy, gk + '_b').setOrigin(0).setDepth(2).setFlipX(true);
    this.add.image(-GOAL_DEPTH - 2, gy, gk + '_f').setOrigin(0).setDepth(20);
    this.add.image(W - 2, gy, gk + '_f').setOrigin(0).setDepth(20).setFlipX(true);
    this.wallG = this.add.graphics().setDepth(19);
    // ostacoli (fontana, statua): ordinati in profondità come i giocatori
    for (const [i, o] of (pitch.obstacles ?? []).entries()) {
      const key = `obs_${o.kind}_${o.r}`;
      drawObstacle(this, o.kind, o.r, key);
      this.add.image(o.x, o.y + o.r * 0.55, key).setOrigin(0.5, 1).setDepth(10 + o.y * 0.01);
      this.add.image(o.x + 3, o.y + 3, 'shadow').setScale((o.r * 2.2) / 14, 1.6).setAlpha(0.2).setDepth(3);
      void i;
    }
    for (const bm of pitch.bumpers ?? []) {
      this.add.image(bm.x + 2, bm.y + 3, 'shadow').setScale((bm.r * 2.1) / 14, 1.5).setAlpha(0.28).setDepth(3);
      const c = this.add.container(bm.x, bm.y).setDepth(10 + bm.y * 0.01);
      const g = this.add.graphics();
      g.fillStyle(0x1a1222).fillCircle(0, 0, bm.r + 2);
      g.fillStyle(0xff3fa4).fillCircle(0, 0, bm.r);
      g.fillStyle(0x39e6ff).fillCircle(0, -1, bm.r * 0.72);
      g.fillStyle(0xffd23f).fillCircle(0, -2, bm.r * 0.44);
      g.fillStyle(0xffffff, 0.7).fillCircle(-bm.r * 0.16, -bm.r * 0.22, Math.max(2, bm.r * 0.14));
      c.add(g);
      this.bumperNodes.push({ x: bm.x, y: bm.y, c });
    }
    if (pitch.geysers?.length) {
      this.geyserG = this.add.graphics().setDepth(2.5);
    }
    if (pitch.waves) {
      if (!this.textures.exists('wavesheet')) {
        const cv = document.createElement('canvas');
        cv.width = 8;
        cv.height = 64;
        const c = cv.getContext('2d')!;
        const gr = c.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(120,190,240,0)');
        gr.addColorStop(0.7, 'rgba(90,170,235,0.7)');
        gr.addColorStop(0.92, 'rgba(255,255,255,0.9)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gr;
        c.fillRect(0, 0, 8, 64);
        this.textures.addCanvas('wavesheet', cv);
      }
      this.waveSheet = this.add.image(W / 2, -100, 'wavesheet').setScale((W + 40) / 8, 3).setDepth(9).setVisible(false);
    }

    // --- giocatori ---
    for (const p of sim.players) {
      const team = p.team === 0 ? cfg.home : cfg.away;
      const key = `pl_${p.team}_${p.idx}`;
      makePlayerSheet(this, key, team, p.def);
      const shadow = this.add.image(p.x, p.y, 'shadow').setAlpha(0.28).setDepth(3);
      const spr = this.add.sprite(p.x, p.y, key, 0).setOrigin(0.5, 22 / FRAME);
      this.ps.push({ p, spr, shadow });
    }
    this.ballShadow = this.add.image(0, 0, 'ballShadow').setAlpha(0.35).setDepth(3);
    this.ball = this.add.sprite(0, 0, 'ball', 0).setOrigin(0.5, 0.75);
    this.ballGhost = this.add.sprite(0, 0, 'ball', 0).setOrigin(0.5, 0.75).setVisible(false).setAlpha(0.85);

    this.ring = this.add.image(0, 0, 'ring').setTint(0xffd23f).setAlpha(0.9).setDepth(3.5);
    this.passRing = this.add.image(0, 0, 'ring').setTint(0xffffff).setAlpha(0.45).setDepth(3.5);
    this.volleyRing = this.add.image(0, 0, 'ring').setTint(0xffd23f).setAlpha(0.85).setDepth(10.5);
    this.marker = this.add.image(0, 0, 'marker').setTint(0xffd23f).setDepth(26);
    this.hintMarker = this.add.image(0, 0, 'marker').setTint(0xffffff).setAlpha(0.6).setScale(0.75).setDepth(26).setVisible(false);
    this.chargeG = this.add.graphics().setDepth(27);
    this.markG = this.add.graphics().setDepth(26);
    const hasHuman = cfg.humanTeam !== null;
    this.ring.setVisible(hasHuman);
    this.marker.setVisible(hasHuman);
    this.passRing.setVisible(false);
    this.volleyRing.setVisible(false);

    // --- particelle ---
    const groundTint = pitch.id === 'spiaggia' ? 0xd9bd7c : pitch.id === 'neve' ? 0xffffff : pitch.id === 'quartiere' || pitch.id === 'piazza' ? 0x9a9ca2 : pitch.id === 'molo' ? 0xc89a6a : pitch.id === 'flipper' ? 0x39e6ff : pitch.id === 'fango' ? 0x6b4f35 : pitch.id === 'vulcano' ? 0xff8a3a : 0x6fbf5a;
    this.fx = {
      dust: this.add.particles(0, 0, 'px2', {
        lifespan: { min: 250, max: 520 },
        speed: { min: 15, max: 55 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 0.9, end: 0 },
        tint: [groundTint, Phaser.Display.Color.ValueToColor(groundTint).darken(15).color],
        gravityY: -10,
        emitting: false,
      }).setDepth(16),
      spark: this.add.particles(0, 0, 'px2', {
        lifespan: { min: 150, max: 380 },
        speed: { min: 60, max: 180 },
        scale: { start: 1, end: 0 },
        tint: [0xffffff, 0xfff3a0],
        blendMode: 'ADD',
        emitting: false,
      }).setDepth(25),
      fire: this.add.particles(0, 0, 'soft', {
        lifespan: { min: 180, max: 360 },
        speed: { min: 5, max: 30 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xfff1a0, 0xffb21e, 0xff5a1e, 0xe8381e],
        blendMode: 'ADD',
        emitting: false,
      }).setDepth(24),
      confetti: this.add.particles(0, 0, 'confetti', {
        lifespan: 2600,
        speedX: { min: -60, max: 60 },
        speedY: { min: 20, max: 90 },
        rotate: { min: 0, max: 360 },
        gravityY: 25,
        tint: [0xffd23f, 0xff5a5a, 0x3fd0ff, 0x5be37d, 0xffffff, 0xff7ab8],
        emitting: false,
      }).setDepth(28),
      stars: this.add.particles(0, 0, 'px2', {
        lifespan: 500,
        speed: { min: 40, max: 120 },
        scale: { start: 1.5, end: 0 },
        tint: [0xffd23f, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      }).setDepth(25),
    };
    const weather = cfg.weather ?? 'sereno';
    const night = th.night || !!cfg.night;
    if (weather === 'pioggia') {
      this.rainOn = true;
      if (!this.textures.exists('streak')) {
        const sg = this.add.graphics();
        sg.fillStyle(0xffffff).fillRect(0, 0, 1, 7);
        sg.generateTexture('streak', 1, 7);
        sg.destroy();
      }
      this.fx.weather = this.add.particles(0, 0, 'streak', {
        x: { min: -60, max: 900 },
        y: -12,
        lifespan: 900,
        speedY: { min: 420, max: 520 },
        speedX: { min: -70, max: -50 },
        rotate: 8,
        alpha: { min: 0.35, max: 0.7 },
        tint: [0xcfe0ff, 0x9fb8e8],
        frequency: 6,
        quantity: 2,
      }).setDepth(28).setScrollFactor(0);
      this.fx.splash = this.add.particles(0, 0, 'px2', {
        lifespan: { min: 160, max: 280 },
        speed: { min: 12, max: 30 },
        angle: { min: 200, max: 340 },
        gravityY: 120,
        scale: { start: 0.8, end: 0.2 },
        alpha: { start: 0.8, end: 0 },
        tint: 0xd8e6ff,
        emitting: false,
      }).setDepth(9);
      this.add.rectangle(0, 0, 4000, 4000, 0x1a2a4a, night ? 0.12 : 0.22).setOrigin(0.5).setScrollFactor(0).setDepth(22.5);
    } else if (pitch.id === 'neve') {
      this.fx.weather = this.add.particles(0, 0, 'px2', {
        x: { min: 0, max: 900 },
        y: -10,
        lifespan: 5000,
        speedY: { min: 18, max: 40 },
        speedX: { min: -12, max: 6 },
        scale: { min: 0.5, max: 1 },
        alpha: { min: 0.6, max: 1 },
        frequency: 40,
      }).setDepth(28).setScrollFactor(0);
    } else if (pitch.id === 'tetto' && weather === 'sereno') {
      this.fx.weather = this.add.particles(0, 0, 'px2', {
        x: { min: -100, max: 900 },
        y: { min: -10, max: 380 },
        lifespan: 2200,
        scale: 0.5,
        alpha: { start: 0, end: 0.6, ease: 'Sine.easeInOut' },
        tint: [0xbfd8ff, 0x8fa8d8],
        frequency: 70,
      }).setDepth(28).setScrollFactor(0);
    }
    if (weather === 'nebbia') this.makeFog(night);

    // --- luci ---
    if (night) {
      // notte: campo scuro e quattro torri faro che illuminano il prato
      this.nightOverlay = this.add.rectangle(0, 0, 10, 10, 0x060920, th.night ? 0.32 : 0.55).setOrigin(0).setScrollFactor(0).setDepth(23);
      for (const [x, y] of [
        [W * 0.25, -20],
        [W * 0.75, -20],
        [W * 0.25, H + 20],
        [W * 0.75, H + 20],
      ]) {
        if (th.night) this.add.image(x, y, 'glow').setScale(9, 6).setAlpha(0.22).setBlendMode('ADD').setDepth(23.5).setTint(0xbfe6ff);
      }
      if (!th.night) {
        for (const [x, y] of [
          [-MARGIN + 18, -MARGIN + 14],
          [W + MARGIN - 18, -MARGIN + 14],
          [-MARGIN + 18, H + MARGIN - 14],
          [W + MARGIN - 18, H + MARGIN - 14],
        ]) this.floodlight(x, y);
        // pozze di luce dei fari sul prato
        for (const [x, y] of [
          [W * 0.22, H * 0.28],
          [W * 0.78, H * 0.28],
          [W * 0.22, H * 0.72],
          [W * 0.78, H * 0.72],
          [W * 0.5, H * 0.5],
        ]) this.add.image(x, y, 'glow').setScale(W / 110, H / 90).setAlpha(0.07).setBlendMode('ADD').setDepth(23.5).setTint(0xfff4d8);
      }
    } else if (pitch.id === 'stadio') {
      for (const [x, y] of [
        [-40, -40],
        [W + 40, -40],
        [-40, H + 40],
        [W + 40, H + 40],
      ]) {
        this.add.image(x, y, 'glow').setScale(7).setAlpha(0.16).setBlendMode('ADD').setDepth(23.5);
      }
    }
    this.makeVignette();

    // --- camera ---
    const cam = this.cameras.main;
    cam.setBounds(-MARGIN + 20, -MARGIN + 10, W + MARGIN * 2 - 40, H + MARGIN * 2 - 20);
    cam.setRoundPixels(true);
    // nella Partita grande (11 contro 11) si inquadra più campo
    cam.setZoom(this.launch.demo ? 1 : sim.teamSize > 5 ? 0.95 : 1.3);
    this.baseZoom = cam.zoom;
    this.camPt = { x: W / 2, y: H / 2 };
    cam.centerOn(W / 2, H / 2);
    if (!this.launch.demo) cam.fadeIn(300, 10, 8, 20);

    // --- tastiera ---
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      shoot: K.J, shoot2: K.X, shoot3: K.SPACE,
      pass: K.K, pass2: K.Z,
      sprint: K.L, sprint2: K.SHIFT, sprint3: K.C,
      special: K.E, special2: K.V,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      sfx.stopCrowd();
    });

    if (!this.launch.demo) {
      this.scene.launch('hud');
      sfx.startCrowd(th.crowd);
      if (this.rainOn) sfx.startRain();
      music.play('match');
      const cond = weather === 'pioggia' ? 'rain' : weather === 'nebbia' ? 'fog' : night && !th.night ? 'night' : null;
      if (cond) this.time.delayedCall(400, () => commentary.say(cond));
    } else if (music.playing !== 'menu') music.play('menu');
    this.syncSprites(0);
  }

  /** Torre faro: palo, pannello di lampade e alone. */
  private floodlight(x: number, y: number) {
    const g = this.add.graphics().setDepth(1.5);
    g.fillStyle(0x1a1222).fillRect(x - 2, y - 2, 4, 26);
    g.fillStyle(0x4a5068).fillRect(x - 1, y, 2, 24);
    g.fillStyle(0x1a1222).fillRect(x - 9, y - 8, 18, 9);
    g.fillStyle(0x5a6078).fillRect(x - 8, y - 7, 16, 7);
    for (let i = 0; i < 4; i++) g.fillStyle(0xfffbe0).fillRect(x - 7 + i * 4, y - 6, 3, 2), g.fillStyle(0xfffbe0).fillRect(x - 7 + i * 4, y - 3, 3, 2);
    this.add.image(x, y - 4, 'glow').setScale(1.4).setAlpha(0.9).setBlendMode('ADD').setDepth(23.6).setTint(0xfff6d0);
    this.add.image(x, y - 4, 'glow').setScale(5).setAlpha(0.25).setBlendMode('ADD').setDepth(23.5).setTint(0xfff6d0);
  }

  /** Nebbia: si vede bene solo intorno alla palla. */
  private makeFog(night: boolean) {
    const key = night ? 'fogN' : 'fogD';
    const R = 520;
    if (!this.textures.exists(key)) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = R * 2;
      const ctx = cv.getContext('2d')!;
      const col = night ? '28,32,48' : '196,204,214';
      const gr = ctx.createRadialGradient(R, R, 70, R, R, 260);
      gr.addColorStop(0, `rgba(${col},0.05)`);
      gr.addColorStop(0.45, `rgba(${col},0.55)`);
      gr.addColorStop(1, `rgba(${col},0.93)`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, R * 2, R * 2);
      this.textures.addCanvas(key, cv);
    }
    this.fog = this.add.image(0, 0, key).setDepth(22.8).setScale(1.6);
    for (let i = 0; i < 7; i++) {
      const w = this.add.image(Math.random() * this.sim.W, Math.random() * this.sim.H, 'glow')
        .setScale(5 + Math.random() * 4, 2 + Math.random() * 2)
        .setAlpha(0.18)
        .setTint(night ? 0x3a4060 : 0xe0e6ee)
        .setDepth(22.7);
      this.fogWisps.push(w);
    }
  }

  private updateWeather(dt: number) {
    const b = this.sim.ball;
    if (this.waveSheet) {
      const w = this.sim.wave;
      this.waveSheet.setVisible(w > 0);
      if (w > 0) {
        const H = this.sim.H;
        const k = Math.min(1, w);
        const dir = this.sim.waveDir;
        // l'onda attraversa il campo e poi svanisce
        this.waveSheet.setFlipY(dir < 0);
        this.waveSheet.y = dir > 0 ? -90 + (H + 180) * k : H + 90 - (H + 180) * k;
        this.waveSheet.setAlpha(Math.min(1, Math.sin(k * Math.PI) * 1.3));
        if (this.fx.dust && Math.random() < dt * 30) this.fx.spark.explode(2, Math.random() * this.sim.W, this.waveSheet.y + (dir > 0 ? 50 : -50));
      }
    }
    if (this.fog) {
      // la "finestra" segue la palla con un po' di ritardo
      const tx = b.x;
      const ty = b.y - b.z * Z_SCALE;
      this.fog.x += (tx - this.fog.x) * Math.min(1, dt * 3);
      this.fog.y += (ty - this.fog.y) * Math.min(1, dt * 3);
      for (const [i, w] of this.fogWisps.entries()) {
        w.x += (8 + i * 2) * dt;
        if (w.x > this.sim.W + 150) w.x = -150;
      }
    }
    if (this.rainOn && this.fx.splash) {
      const v = this.cameras.main.worldView;
      const n = Math.random() < dt * 40 ? 2 : 0;
      for (let i = 0; i < n; i++) this.fx.splash.explode(3, v.x + Math.random() * v.width, v.y + Math.random() * v.height);
      if (!this.launch.demo) {
        this.thunderT -= dt;
        if (this.thunderT <= 0) {
          this.thunderT = 16 + Math.random() * 18;
          this.cameras.main.flash(90, 200, 210, 255);
          this.time.delayedCall(160, () => this.cameras.main.flash(60, 160, 170, 220));
          sfx.thunder();
        }
      }
    }
    if (this.geyserG && this.sim.pitch.geysers) {
      const gg = this.geyserG;
      gg.clear();
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.018);
      this.sim.pitch.geysers.forEach((gy, idx) => {
        const st = this.sim.geyserState(idx);
        gg.fillStyle(0x1f1417, 0.85).fillCircle(gy.x, gy.y, gy.r + 3);
        gg.lineStyle(2, st === 'erupt' ? 0xfff3a0 : st === 'warn' ? 0xff9a1a : 0x5c2e28, 0.9).strokeCircle(gy.x, gy.y, gy.r);
        if (st === 'idle') {
          gg.fillStyle(0x4a201b, 0.7).fillCircle(gy.x, gy.y, gy.r * 0.55);
        } else if (st === 'warn') {
          gg.fillStyle(0xff6a1a, 0.35 + pulse * 0.45).fillCircle(gy.x, gy.y, gy.r * (0.65 + pulse * 0.25));
        } else {
          gg.fillStyle(0xff9a1a, 0.75).fillCircle(gy.x, gy.y, gy.r);
          gg.fillStyle(0xfff5c0, 0.9).fillCircle(gy.x, gy.y, gy.r * 0.58);
          if (Math.random() < dt * 28) {
            this.fx.fire.explode(2, gy.x + (Math.random() - 0.5) * gy.r, gy.y - Math.random() * 18);
            this.fx.spark.explode(2, gy.x + (Math.random() - 0.5) * gy.r * 0.7, gy.y - Math.random() * 24);
          }
        }
      });
    }
  }

  private onResize() {
    this.makeVignette();
  }

  private makeVignette() {
    const w = this.scale.width;
    const h = this.scale.height;
    const key = `vig_${w}x${h}`;
    if (!this.textures.exists(key)) {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d')!;
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
      g.addColorStop(0, 'rgba(10,6,24,0)');
      g.addColorStop(1, 'rgba(10,6,24,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      this.textures.addCanvas(key, cv);
    }
    if (this.vignette) this.vignette.setTexture(key);
    else this.vignette = this.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(29);
    this.nightOverlay?.setSize(w, h);
  }

  msg(m: HudMessage) {
    this.events.emit('msg', m);
  }

  private readKeyboard() {
    const k = this.keys;
    const c = this.ctrl;
    let kx = 0;
    let ky = 0;
    if (k.left.isDown || k.a.isDown) kx -= 1;
    if (k.right.isDown || k.d.isDown) kx += 1;
    if (k.up.isDown || k.w.isDown) ky -= 1;
    if (k.down.isDown || k.s.isDown) ky += 1;
    const kl = Math.hypot(kx, ky) || 1;
    if (kx || ky) {
      c.mx = kx / kl;
      c.my = ky / kl;
    } else {
      c.mx = c.tMx;
      c.my = c.tMy;
    }
    c.shoot = c.tShoot || k.shoot.isDown || k.shoot2.isDown || k.shoot3.isDown;
    c.pass = c.tPass || k.pass.isDown || k.pass2.isDown;
    c.sprint = c.tSprint || k.sprint.isDown || k.sprint2.isDown || k.sprint3.isDown;
    c.special = c.tSpecial || k.special.isDown || k.special2.isDown;
  }

  // ---------- replay ----------

  private snap(): Snap {
    const ps = this.sim.players;
    const p = new Float32Array(ps.length * P_FIELDS);
    const st: string[] = [];
    ps.forEach((q, i) => {
      p.set([q.x, q.y, q.vx, q.vy, q.facing, q.stateT, q.runPhase, q.sprinting ? 1 : 0, 0], i * P_FIELDS);
      st.push(q.state);
    });
    const b = this.sim.ball;
    return { p, st, b: [b.x, b.y, b.z, b.roll, b.fire ? 1 : 0, b.superShot ? 1 : 0, b.owner ? b.owner.id : -1, b.giant ? 1 : 0] };
  }

  private applySnap(s: Snap) {
    this.sim.players.forEach((q, i) => {
      const o = i * P_FIELDS;
      q.x = s.p[o];
      q.y = s.p[o + 1];
      q.vx = s.p[o + 2];
      q.vy = s.p[o + 3];
      q.facing = s.p[o + 4];
      q.stateT = s.p[o + 5];
      q.runPhase = s.p[o + 6];
      q.sprinting = s.p[o + 7] > 0;
      q.state = s.st[i] as typeof q.state;
    });
    const b = this.sim.ball;
    [b.x, b.y, b.z, b.roll] = s.b;
    b.fire = s.b[4] > 0;
    b.superShot = s.b[5] > 0;
    b.owner = s.b[6] >= 0 ? this.sim.players.find((q) => q.id === s.b[6]) ?? null : null;
    b.giant = s.b[7] > 0;
  }

  get replaying() {
    return !!this.replay;
  }

  private startReplay() {
    if (this.goalFrame < 0) return;
    // dai 2.8 secondi prima del gol fino a poco dopo l'ingresso in rete
    const from = Math.max(0, this.goalFrame - 165);
    const to = Math.min(this.rec.length, this.goalFrame + 40);
    const frames = this.rec.slice(from, to);
    const goalOffset = this.goalFrame - from;
    this.goalFrame = -1;
    if (frames.length < 30) {
      this.replayMeta = undefined;
      return;
    }
    if (!this.launch.demo) sfx.replay();
    const W = this.scale.width;
    const H = this.scale.height;
    const meta = this.replayMeta;
    this.replayMeta = undefined;
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(40);
    const bars = this.add.graphics();
    // bande cinematografiche + leggere scanline TV retro
    bars.fillStyle(0x000000, 0.88).fillRect(-W, -H, W * 3, H + 34).fillRect(-W, H - 34, W * 3, H);
    bars.fillStyle(0x000000, 0.08);
    for (let y = 36; y < H - 36; y += 4) bars.fillRect(0, y, W, 1);

    const recBg = this.add.graphics();
    recBg.fillStyle(0x14111f, 0.92).fillRect(14, 38, 102, 18);
    recBg.lineStyle(1, 0xff4a4a, 0.85).strokeRect(14, 38, 102, 18);
    const label = this.add.text(20, 47, '● REPLAY', { fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: '#ff4a4a' }).setOrigin(0, 0.5);
    const speedBadge = this.add
      .text(122, 47, 'MOVIOLA 0.8x', { fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#3fd0ff', backgroundColor: '#14111fdd', padding: { x: 5, y: 4 } })
      .setOrigin(0, 0.5);
    this.tweens.add({ targets: label, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
    layer.add([bars, recBg, label, speedBadge]);

    if (meta?.tag) {
      const tagBadge = this.add
        .text(W - 16, 47, meta.tag, { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#ffd23f', backgroundColor: '#14111fee', padding: { x: 6, y: 4 } })
        .setOrigin(1, 0.5);
      layer.add(tagBadge);
    }

    // sottopancia TV arcade con marcatore e risultato
    const goalBanner = this.add.container(0, 0).setAlpha(0);
    if (meta) {
      const bg = this.add.graphics();
      const colHex = '#' + meta.color.toString(16).padStart(6, '0');
      bg.fillStyle(0x14111f, 0.94).fillRect(14, H - 30, 270, 22);
      bg.fillStyle(meta.color, 1).fillRect(14, H - 30, 6, 22);
      bg.lineStyle(1, 0x2e3250, 1).strokeRect(14, H - 30, 270, 22);
      const tTeam = this.add.text(26, H - 23, `${meta.teamName.toUpperCase()}  ${meta.scoreText}`, { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: colHex }).setOrigin(0, 0.5);
      const tScorer = this.add.text(26, H - 14, `${meta.scorer.toUpperCase()}  ${meta.minute}`, { fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#ffffff' }).setOrigin(0, 0.5);
      goalBanner.add([bg, tTeam, tScorer]);
    }
    const hint = this.add.text(W - 14, H - 17, 'tocca per saltare', { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#8a8fb0' }).setOrigin(1, 0.5);
    layer.add([goalBanner, hint]);

    const cam = this.cameras.main;
    const liveZoom = cam.zoom;
    this.tweens.killTweensOf(cam);
    this.tweens.add({ targets: cam, zoom: this.baseZoom * 1.16, duration: 550, ease: 'Sine.easeOut' });
    layer.setScale(1 / cam.zoom).setPosition(W / 2 - W / 2 / cam.zoom, H / 2 - H / 2 / cam.zoom);

    this.replay = { frames, goalOffset, head: 0, live: this.snap(), liveZoom, layer, speedBadge, goalBanner, bannerShown: false };
    for (const o of [this.marker, this.hintMarker, this.ring, this.passRing, this.volleyRing]) o.setVisible(false);
    this.chargeG.clear();
    this.events.emit('replay', true);
  }

  endReplay() {
    const r = this.replay;
    if (!r) return;
    if (!this.launch.demo) sfx.replay();
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    cam.setZoom(r.liveZoom);
    this.applySnap(r.live);
    r.layer.destroy();
    this.replay = undefined;
    const hasHuman = this.launch.config.humanTeam !== null;
    this.marker.setVisible(hasHuman);
    this.ring.setVisible(hasHuman);
    this.syncSprites(0);
    this.events.emit('replay', false);
  }

  private updateReplay(dt: number) {
    const r = this.replay!;
    // salta con un tasto azione
    const k = this.keys;
    if (
      Phaser.Input.Keyboard.JustDown(k.shoot) ||
      Phaser.Input.Keyboard.JustDown(k.shoot2) ||
      Phaser.Input.Keyboard.JustDown(k.pass) ||
      Phaser.Input.Keyboard.JustDown(k.pass2)
    ) {
      return this.endReplay();
    }
    // curva moviola: avvicinamento fluido, ultra slow-mo sul tiro e gol, poi follow-through
    const distToGoal = r.goalOffset - r.head;
    const rate = distToGoal > 36 ? 0.78 : distToGoal > -12 ? 0.34 : 0.6;
    r.speedBadge.setText(rate < 0.45 ? 'MOVIOLA 0.35x' : `MOVIOLA ${rate.toFixed(1)}x`).setColor(rate < 0.45 ? '#ffd23f' : '#3fd0ff');
    if (!r.bannerShown && r.head >= r.goalOffset - 22) {
      r.bannerShown = true;
      this.tweens.add({ targets: r.goalBanner, alpha: 1, duration: 220, ease: 'Sine.easeOut' });
    }
    r.head += dt * 60 * rate;
    const i = Math.floor(r.head);
    if (i >= r.frames.length) return this.endReplay();
    this.applySnap(r.frames[i]);
    this.syncSprites(dt);
    this.marker.setVisible(false);
    this.hintMarker.setVisible(false);
    this.ring.setVisible(false);
    this.passRing.setVisible(false);
    this.updateCamera(dt);
    const W = this.scale.width;
    const H = this.scale.height;
    const z = this.cameras.main.zoom;
    r.layer.setScale(1 / z).setPosition(W / 2 - W / 2 / z, H / 2 - H / 2 / z);
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    if (this.replay) {
      this.updateReplay(dt);
      this.updateCrowd(dt);
      return;
    }
    if (this.replayIn > 0) {
      this.replayIn -= dt;
      if (this.replayIn <= 0 && this.sim.phase === 'goal') this.startReplay();
    }
    this.readKeyboard();
    // rallentatore e "hit stop"
    if (this.hitStop > 0) {
      this.hitStop -= dt;
    } else {
      if (this.slowT > 0) {
        this.slowT -= dt;
        this.timeScale = this.slowT > 0 ? 0.35 : 1;
      }
      this.acc += dt * this.timeScale;
      let n = 0;
      while (this.acc >= STEP && n < 5) {
        this.prevOwner = this.sim.ball.owner;
        this.sim.update(STEP, this.launch.demo ? undefined : this.ctrl);
        this.acc -= STEP;
        n++;
        this.handleEvents();
      }
    }
    this.syncSprites(dt);
    this.updateCamera(dt);
    this.updateCrowd(dt);
    this.updateWeather(dt);
    if (!this.launch.demo && (this.sim.phase === 'play' || this.sim.phase === 'goal')) {
      this.rec.push(this.snap());
      if (this.rec.length > REC_MAX) {
        this.rec.shift();
        if (this.goalFrame > 0) this.goalFrame--;
      }
    }

    if (this.sim.phase === 'end') {
      this.endT += dt;
      if (this.endT > 2.6 && !this.finished) {
        this.finished = true;
        if (this.launch.demo) this.scene.restart(demoLaunch());
        else {
          this.scene.stop('hud');
          const r = this.sim.result;
          if (this.launch.penalties && r.score[0] === r.score[1]) {
            // pareggio: si va ai rigori
            this.scene.launch('penalties', { outcome: { launch: this.origLaunch, result: r, tally: this.tally.t, style: this.sim.stylePoints[0] } });
          } else {
            music.stop(0.3);
            this.scene.launch('result', { launch: this.origLaunch, result: r, tally: this.tally.t, style: this.sim.stylePoints[0] });
          }
        }
      }
    }
    if (this.launch.demo) {
      this.demoT += dt;
      if (this.demoT > 75 && this.sim.phase === 'kickoff') this.scene.restart(demoLaunch());
    }
  }

  private handleEvents() {
    const sim = this.sim;
    const demo = !!this.launch.demo;
    const human = sim.humanTeam;
    const spot = demo ? undefined : this.launch.spotlight;
    for (const e of sim.events) {
      const assistsBefore = spot !== undefined ? (this.tally.t.players[0][spot]?.assists ?? 0) : 0;
      if (!demo) this.tally.feed(e, sim.elapsed);
      this.onEvent(e, demo, human);
      if (spot !== undefined) this.spotlightEvent(e, spot, assistsBefore);
    }
    sim.events.length = 0;
  }

  /** Commenti in diretta sulle giocate del tuo campione e voto nell'HUD. */
  private spotlightEvent(e: SimEvent, spot: number, assistsBefore: number) {
    const me = this.sim.teams[0][spot];
    if (!me) return;
    const mine = 'team' in e && e.team === 0 && 'idx' in e && e.idx === spot;
    const lostByMe = (e.type === 'steal' || (e.type === 'tackle' && e.won)) && e.team === 1 && this.prevOwner === me;
    let label: string | undefined;
    let good = true;
    const pick = (a: string[]) => a[this.liveN++ % a.length];
    if (e.type === 'goal' && e.team === 0 && (this.tally.t.players[0][spot]?.assists ?? 0) > assistsBefore) label = pick(LIVE.assist);
    else if (mine && e.type === 'pass') label = pick(LIVE.pass);
    else if (mine && e.type === 'shot') label = pick(LIVE.shot);
    else if (mine && (e.type === 'steal' || (e.type === 'tackle' && e.won))) label = pick(LIVE.win);
    else if (mine && e.type === 'tackle' && !e.won) {
      label = pick(LIVE.failTackle);
      good = false;
    } else if (mine && e.type === 'trick' && e.kind !== 'lontano' && e.kind !== 'sponda') label = pick(LIVE.trick);
    else if (e.type === 'foul' && e.team === 0 && e.byIdx === spot) {
      label = pick(LIVE.foul);
      good = false;
    } else if (lostByMe) {
      label = pick(LIVE.lost);
      good = false;
    }
    const isGoal = e.type === 'goal';
    if (!label && !isGoal) return;
    if (label) {
      const t = this.add
        .text(me.x, me.y - 30, label, { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: good ? '#5be37d' : '#ff7a7a', stroke: '#1a1222', strokeThickness: 3, resolution: 3 })
        .setOrigin(0.5, 1)
        .setDepth(5000);
      this.tweens.add({ targets: t, y: me.y - 44, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
    }
    const pt = this.tally.t.players[0][spot];
    if (!pt) return;
    const role = this.launch.config.home.players[spot]?.role ?? 'FWD';
    const v = voteFor(role, pt, this.sim.score[0], this.sim.score[1]);
    if (v !== this.lastVote) {
      this.lastVote = v;
      this.events.emit('vote', v);
    }
  }

  private onEvent(e: SimEvent, demo: boolean, human: 0 | 1 | null) {
    const cam = this.cameras.main;
    const quiet = demo; // nella demo niente suoni
    const teamName = (t: 0 | 1) => (t === 0 ? this.launch.config.home.name : this.launch.config.away.name);
    switch (e.type) {
      case 'kick':
        if (!quiet) sfx.kick(e.power);
        this.fx.dust.explode(5, e.x, e.y);
        break;
      case 'pass':
        if (!quiet) sfx.pass();
        this.fx.dust.explode(3, e.x, e.y);
        if (e.kind && !demo && e.team === human) {
          this.msg({ text: e.kind === 'filtrante' ? 'FILTRANTE!' : 'PALLONETTO!', color: e.kind === 'filtrante' ? '#6ae6ff' : '#ff8ad8', ms: 700 });
        }
        break;
      case 'chain':
        if (!demo && e.team === human) {
          this.msg(e.n === 99 ? { text: 'TIRO A CATENA!', color: '#ffd23f' } : { text: `CATENA x${e.n}`, sub: e.n >= 4 ? 'il prossimo tiro è carico' : undefined, color: '#6ae6ff', ms: 800 });
        }
        break;
      case 'mentality':
        if (!demo && e.team === human) {
          this.msg({ text: e.tactic === 'attacco' ? 'ALL\'ATTACCO!' : e.tactic === 'difesa' ? 'SI DIFENDE' : 'EQUILIBRIO', color: '#ffd23f', ms: 800 });
        }
        break;
      case 'shot': {
        if (!quiet) {
          if (e.superShot) {
            sfx.superShot();
            commentary.say('super');
          } else if (e.volley) {
            sfx.volley(e.volley === 'rovesciata');
          } else sfx.kick(e.power);
        }
        this.fx.dust.explode(8, e.x, e.y);
        this.fx.spark.explode(e.superShot ? 24 : e.volley === 'rovesciata' ? 16 : Math.round(4 + e.power * 8), this.sim.ball.x, this.sim.ball.y - 2);
        if (e.volley) this.fx.stars.explode(e.volley === 'rovesciata' ? 12 : 6, e.x, e.y - 12);
        if (e.power > 0.8 || e.superShot || e.fire || e.volley) {
          cam.shake(e.superShot ? 260 : e.volley === 'rovesciata' ? 160 : 110, e.superShot ? 0.012 : e.volley === 'rovesciata' ? 0.007 : 0.004);
          this.hitStop = e.superShot ? 0.12 : e.volley === 'rovesciata' ? 0.075 : 0.045;
        }
        if (e.superShot) {
          cam.flash(120, 255, 240, 200);
          if (!demo && !e.special) this.msg({ text: 'SUPER TIRO!', color: '#ffd23f' });
        }
        this.excite = Math.max(this.excite, 0.6);
        break;
      }
      case 'goal': {
        if (!demo) {
          this.goalFrame = this.rec.length - 1;
          this.replayIn = 1.5;
          const teamCfg = e.team === 0 ? this.launch.config.home : this.launch.config.away;
          const tag = e.own
            ? 'AUTOGOL'
            : e.volley === 'rovesciata'
              ? '★ ROVESCIATA! ★'
              : e.volley === 'volo'
                ? '★ TIRO AL VOLO! ★'
                : e.special
                  ? e.special === 'combo' ? '★ TIRO COMBINATO! ★' : '★ ' + (SP_NAMES[e.special] ?? 'SUPERMOSSA') + '! ★'
                  : e.superGoal
                  ? '★ SUPER TIRO! ★'
                  : e.long
                    ? '★ DA LONTANO! ★'
                    : e.banked
                      ? '★ DI SPONDA! ★'
                      : undefined;
          const min = Math.max(1, Math.round((this.sim.elapsed / Math.max(1, this.launch.config.durationSec)) * 90));
          this.replayMeta = {
            scorer: e.scorer,
            team: e.team,
            teamName: teamCfg.short,
            color: teamCfg.colors.shirt,
            scoreText: `${this.sim.score[0]}-${this.sim.score[1]}`,
            minute: `${min}'`,
            tag,
          };
        }
        if (!quiet) {
          sfx.goal();
          sfx.net();
          commentary.say(e.own ? 'ownGoal' : 'goal', e.scorer);
          // il pubblico di chi ha segnato attacca un coro
          this.time.delayedCall(2600, () => sfx.chant(0, THEMES[this.launch.config.pitch.id].crowd));
          this.chantT = 20 + Math.random() * 10;
        }
        this.excite = 1;
        this.slowT = 0.9;
        cam.shake(380, 0.012);
        cam.flash(160, 255, 255, 255);
        const b = this.sim.ball;
        this.fx.spark.explode(30, b.x, b.y - 6);
        this.fx.stars.explode(20, b.x, b.y - 10);
        const w = cam.worldView;
        for (let i = 0; i < 8; i++) this.fx.confetti.explode(14, w.x + Math.random() * w.width, w.y - 4);
        this.tweens.add({ targets: cam, zoom: this.baseZoom * 1.18, duration: 380, yoyo: true, hold: 600, ease: 'Sine.easeInOut' });
        if (!demo) {
          const mine = human === e.team;
          this.msg({
            text: 'GOL!',
            sub: e.scorer,
            color: human === null || mine ? '#ffd23f' : '#ff5a5a',
            big: true,
            ms: 2600,
          });
          if (navigator.vibrate) navigator.vibrate(mine ? [60, 40, 120] : 80);
        }
        break;
      }
      case 'save':
        if (!quiet) {
          sfx.save();
          commentary.say(e.catch ? 'catch' : 'save');
        }
        this.fx.stars.explode(12, e.x, e.y - 6);
        cam.shake(120, 0.005);
        this.excite = Math.max(this.excite, 0.7);
        if (!demo) this.msg({ text: e.catch ? 'PRESA!' : 'PARATA!', color: '#3fd0ff' });
        break;
      case 'post':
        if (!quiet) {
          sfx.post();
          commentary.say('post');
        }
        cam.shake(140, 0.006);
        this.fx.spark.explode(10, e.x, e.y - BAR_H / 2);
        this.excite = Math.max(this.excite, 0.8);
        if (!demo) this.msg({ text: 'PALO!', color: '#ffffff' });
        break;
      case 'wall':
        if (!quiet) sfx.wall(Math.min(1, e.power / 400));
        if (e.power > 250) cam.shake(70, 0.003);
        this.fx.dust.explode(4, e.x, e.y);
        break;
      case 'bumper': {
        if (!quiet) sfx.bumper();
        this.fx.spark.explode(14, e.x, e.y - 4);
        cam.shake(80, 0.004);
        const node = this.bumperNodes.find((n) => Math.hypot(n.x - e.x, n.y - e.y) < 4);
        if (node) {
          this.tweens.killTweensOf(node.c);
          node.c.setScale(1.38);
          this.tweens.add({ targets: node.c, scale: 1, duration: 150, ease: 'Back.easeOut' });
        }
        break;
      }
      case 'geyser':
        if (!quiet) sfx.geyser();
        this.fx.fire.explode(14, e.x, e.y - 6);
        this.fx.spark.explode(16, e.x, e.y - 12);
        cam.shake(120, 0.005);
        break;
      case 'bounce':
        if (!quiet) sfx.bounce(Math.min(0.4, e.power / 300));
        break;
      case 'tackle':
        if (!quiet) {
          sfx.tackle();
          if (Math.random() < 0.12) commentary.say('tackle');
        }
        this.fx.dust.explode(10, e.x, e.y);
        break;
      case 'slide':
        this.fx.dust.explode(6, e.x, e.y);
        break;
      case 'steal':
        if (!quiet) sfx.pass();
        break;
      case 'whistle':
        if (!quiet) {
          if (e.kind === 'end') {
            sfx.whistle(3, true);
            commentary.say('end');
            music.stop(1.5);
          } else if (e.kind === 'kickoff') {
            sfx.whistle(1);
            if (!this.started) {
              commentary.say(this.rival ? 'rival' : 'start');
              if (this.rival) this.msg({ text: 'SFIDA RIVALE!', sub: `Contro ${this.launch.config.away.name}: monete doppie se vinci`, color: '#ff5a5a', ms: 2400 });
            }
            this.started = true;
          } else if (e.kind === 'golden') {
            sfx.whistle(2);
            commentary.say('golden');
          } else if (e.kind === 'half') {
            sfx.whistle(2);
          }
        }
        if (!demo) {
          if (e.kind === 'golden') this.msg({ text: 'GOLDEN GOL!', sub: 'Chi segna vince', color: '#ffd23f', big: true, ms: 2200 });
          if (e.kind === 'end') this.msg({ text: 'FINE!', color: '#ffffff', big: true, ms: 2400 });
        }
        break;
      case 'powerup': {
        if (!quiet) {
          sfx.powerup();
          const callMap = { fuoco: 'fire', turbo: 'turbo', muro: 'wall', ghiaccio: 'ice', calamita: 'magnet', gigante: 'giant' } as const;
          commentary.say(callMap[e.kind]);
        }
        this.fx.stars.explode(16, e.x, e.y);
        const names = {
          fuoco: 'TIRO DI FUOCO',
          turbo: 'TURBO',
          muro: 'MURO IN PORTA',
          ghiaccio: 'GHIACCIO',
          calamita: 'CALAMITA',
          gigante: 'PALLONE GIGANTE',
        } as const;
        if (!demo) this.msg({ text: names[e.kind] + '!', sub: teamName(e.team), color: human === null || human === e.team ? '#5be37d' : '#ff9a5a' });
        break;
      }
      case 'powerupSpawn':
        this.fx.spark.explode(8, e.x, e.y);
        break;
      case 'superReady':
        if (!quiet && e.team === human) sfx.superReady();
        if (!demo && e.team === human) this.msg({ text: 'SUPER PRONTO!', sub: 'Tiro caricato al massimo', color: '#ffd23f' });
        break;
      case 'special': {
        if (demo) break;
        const col = '#' + e.color.toString(16).padStart(6, '0');
        const mine = e.team === human;
        sfx.superShot();
        this.hitStop = 0.32;
        this.slowT = 0.7;
        cam.shake(480, 0.016);
        cam.flash(260, (e.color >> 16) & 255, (e.color >> 8) & 255, e.color & 255);
        this.fx.spark.explode(40, e.x, e.y - 6);
        this.fx.stars.explode(18, e.x, e.y - 12);
        this.tweens.add({ targets: cam, zoom: this.baseZoom * 1.22, duration: 260, yoyo: true, hold: 500, ease: 'Sine.easeOut' });
        const ring = this.add.circle(e.x, e.y, 8, e.color, 0.25).setStrokeStyle(3, e.color).setDepth(60);
        this.tweens.add({ targets: ring, scale: e.id === 'tsunami' || e.id === 'muro' ? 9 : 5, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        this.events.emit('cutin', { name: e.name, who: e.who, color: col, mine });
        this.excite = 1;
        if (navigator.vibrate) navigator.vibrate([30, 30, 90]);
        break;
      }
      case 'specialReady':
        if (demo || e.team !== human || e.idx !== this.sim.humanIdx) break;
        sfx.superReady();
        this.msg({ text: 'SUPERMOSSA PRONTA!', sub: e.name, color: '#ff7ab8', ms: 900 });
        break;
      case 'combo':
        if (demo) break;
        this.fx.stars.explode(14, e.x, e.y - 12);
        cam.shake(200, 0.008);
        this.msg({ text: 'COMBO!', sub: 'Tiro combinato', color: '#ff7ab8', ms: 900 });
        break;
      case 'switch':
        break;
      case 'sub': {
        // la riserva entra: nuova maglia col suo numero e aspetto
        const ps = this.ps.find((q) => q.p.team === e.team && q.p.idx === e.idx);
        if (ps) {
          const key = `pl_${e.team}_${e.idx}`;
          makePlayerSheet(this, key, e.team === 0 ? this.launch.config.home : this.launch.config.away, ps.p.def);
          ps.spr.setTexture(key, 0);
        }
        break;
      }
      case 'wave':
        if (!quiet) {
          sfx.wave();
          commentary.say('wave');
        }
        if (!demo) this.msg({ text: 'ONDA!', color: '#8fd8ff', ms: 1200 });
        this.cameras.main.shake(400, 0.003);
        break;
      case 'trick': {
        const names = {
          tunnel: 'TUNNEL!',
          dribbling: 'DRIBBLING!',
          lontano: 'GOL DA LONTANO!',
          sponda: 'GOL DI SPONDA!',
          volo: 'TIRO AL VOLO!',
          rovesciata: 'ROVESCIATA!',
        };
        const goalTrick = e.kind === 'lontano' || e.kind === 'sponda';
        if (!quiet) {
          sfx.trick();
          // per i gol speciali la frase arriva dopo il "gol!"
          if (goalTrick) this.time.delayedCall(2200, () => commentary.say(e.kind, e.name));
          else if (e.kind === 'tunnel' || e.kind === 'rovesciata' || e.kind === 'volo' || Math.random() < 0.4) commentary.say(e.kind, e.name);
        }
        this.fx.stars.explode(goalTrick ? 6 : e.kind === 'rovesciata' ? 14 : 10, e.x, e.y - 12);
        if (!demo) {
          const mine = human === null || human === e.team;
          const color = e.kind === 'rovesciata' || e.kind === 'volo' ? (mine ? '#ffd23f' : '#ff9a7a') : mine ? '#ff7ab8' : '#c0a0b8';
          const show = () => this.msg({ text: names[e.kind], sub: e.name, color, ms: 1300 });
          if (goalTrick) this.time.delayedCall(2700, show);
          else show();
        }
        break;
      }
      case 'showtime':
        if (!quiet) {
          sfx.roar(1);
          sfx.chant(e.team === 0 ? 0 : 1, THEMES[this.launch.config.pitch.id].crowd);
          commentary.say('showtime');
        }
        this.excite = 1;
        this.fx.confetti.explode(30, this.sim.ball.x, this.sim.ball.y - 30);
        if (!demo) this.msg({ text: 'SPETTACOLO!', sub: 'Super tiro più carico', color: '#ff7ab8', big: true, ms: 1800 });
        break;
      case 'foul': {
        if (!quiet) {
          sfx.whistle(2);
          sfx.ooh();
          if (e.card === 'red') {
            commentary.say('red', e.by);
            sfx.boo();
          } else if (e.card === 'yellow') commentary.say('yellow', e.by);
          else if (e.injury) commentary.say('injury', e.victim);
        }
        this.fx.dust.explode(12, e.x, e.y);
        cam.shake(150, 0.004);
        if (!demo) {
          if (e.card !== 'none') {
            this.msg({
              text: e.card === 'red' ? 'CARTELLINO ROSSO!' : 'CARTELLINO GIALLO',
              sub: e.card === 'red' ? `${e.by} fuori per 30 secondi` : e.by,
              color: e.card === 'red' ? '#ff5a5a' : '#ffd23f',
              big: e.card === 'red',
              ms: 1800,
            });
          } else this.msg({ text: 'FALLO!', sub: e.by, color: '#ffffff', ms: 1100 });
          if (e.injury) this.time.delayedCall(1900, () => this.msg({ text: 'INFORTUNIO', sub: `${e.victim} è più lento`, color: '#ff9a5a', ms: 1600 }));
        }
        break;
      }
      case 'freekick':
        if (!quiet) commentary.say('freekick');
        if (!demo) {
          this.msg({
            text: 'PUNIZIONE!',
            sub: e.human ? 'Mira con la levetta · tieni TIRO e vai di lato per l\'effetto' : teamName(e.team),
            color: '#ffd23f',
            ms: e.human ? 3200 : 1400,
          });
        }
        break;
      case 'call':
        if (!quiet) sfx.select();
        this.fx.stars.explode(6, e.x, e.y - 14);
        if (!demo) this.msg({ text: 'PASSALA!', color: '#3fd0ff', ms: 700 });
        break;
    }
  }

  /** Colore del pallone comprato nel negozio. */
  private skinBall(t: number) {
    const tint = ballTint(this.ballSkin, t);
    if (tint === null) this.ball.clearTint();
    else this.ball.setTint(tint);
  }

  /** Cartellini e infortuni sopra la testa dei giocatori. */
  private drawMarks() {
    const g = this.markG;
    g.clear();
    if (!this.sim.cfg.fouls) return;
    for (const p of this.sim.players) {
      const x = Math.round(p.x);
      const y = Math.round(p.y - 34);
      if (p.out > 0 || p.yellows > 0) {
        g.fillStyle(0x1a1222).fillRect(x + 5, y - 1, 6, 8);
        g.fillStyle(p.out > 0 ? 0xff3a3a : 0xffd23f).fillRect(x + 6, y, 4, 6);
      }
      if (p.injured) {
        g.fillStyle(0xffffff).fillRect(x - 11, y, 6, 6);
        g.fillStyle(0xe8443a).fillRect(x - 9, y + 1, 2, 4).fillRect(x - 10, y + 2, 4, 2);
      }
    }
    // punizione: traiettoria prevista con l'effetto
    const fk = this.sim.freeKick;
    if (this.sim.phase === 'freekick' && fk && this.sim.isHuman(fk.taker)) {
      const b = this.sim.ball;
      let x = b.x;
      let y = b.y;
      const a = fk.aim - fk.curl * 0.2;
      const sp = 420;
      let vx = Math.cos(a) * sp;
      let vy = Math.sin(a) * sp;
      let spin = fk.curl * 360;
      const dt = 1 / 30;
      const blink = Math.floor(this.time.now / 160) % 2;
      for (let i = 0; i < 26; i++) {
        const s = Math.hypot(vx, vy);
        const nvx = vx + (-vy / s) * spin * dt;
        vy += (vx / s) * spin * dt;
        vx = nvx;
        spin *= Math.exp(-1.6 * dt);
        x += vx * dt;
        y += vy * dt;
        if (i % 2 === blink) continue;
        g.fillStyle(0x1a1222, 0.6).fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
        g.fillStyle(fk.curl === 0 ? 0xffffff : 0xffd23f).fillRect(Math.round(x), Math.round(y), 2, 2);
        if (x < 0 || x > this.sim.W) break;
      }
    }
  }

  private dirOf(p: Player): { dir: Dir; flip: boolean } {
    const c = Math.cos(p.facing);
    const s = Math.sin(p.facing);
    if (Math.abs(c) > 0.55) return { dir: 'side', flip: c < 0 };
    return { dir: s > 0 ? 'down' : 'up', flip: false };
  }

  private syncSprites(dt: number) {
    const sim = this.sim;
    const t = this.time.now / 1000;
    for (const { p, spr, shadow } of this.ps) {
      const { dir, flip } = this.dirOf(p);
      let pose: Pose = 'idle';
      let d: Dir = dir;
      let f = flip;
      let rot = 0;
      let yOff = 0;
      const speed = Math.hypot(p.vx, p.vy);
      switch (p.state) {
        case 'slide':
        case 'stun':
          if (p.state === 'slide' || p.stateT < 0.25) {
            pose = 'slide';
            d = 'side';
            f = Math.cos(p.facing) < 0;
          } else pose = 'idle';
          break;
        case 'dive':
          pose = 'dive';
          d = 'side';
          f = false;
          rot = p.vy < 0 || p.facing < 0 ? -Math.PI / 2 : Math.PI / 2;
          break;
        case 'kick':
          pose = 'kick';
          break;
        case 'volley': {
          pose = 'kick';
          d = 'side';
          f = Math.cos(p.facing) < 0;
          const k = Math.min(1, p.stateT / 0.34);
          yOff = -Math.sin(k * Math.PI) * 9;
          rot = (f ? 1 : -1) * Math.sin(k * Math.PI) * 0.28;
          break;
        }
        case 'bicycle': {
          pose = 'kick';
          d = 'side';
          f = Math.cos(p.facing) < 0;
          const k = Math.min(1, p.stateT / 0.52);
          yOff = -Math.sin(k * Math.PI) * 14;
          rot = (f ? 1 : -1) * (-Math.PI * 0.65 - k * Math.PI * 1.15);
          break;
        }
        case 'celebrate':
          pose = 'celebrate';
          d = 'down';
          f = false;
          yOff = -Math.abs(Math.sin(t * 9 + p.id)) * 5;
          if (sim.phase === 'goal' && p === sim.ball.lastTouch && p.team === this.launch.config.humanTeam && this.celebration !== 'salto') {
            const c = this.celebration;
            const ph = p.stateT;
            if (c === 'capriola') {
              // salto con giro completo ogni 1.2 s
              const k = (ph % 1.2) / 1.2;
              yOff = -Math.sin(k * Math.PI) * 16;
              rot = k < 0.8 ? (k / 0.8) * Math.PI * 2 : 0;
            } else if (c === 'scivolata') {
              pose = ph < 1.4 ? 'slide' : 'celebrate';
              d = 'side';
              f = Math.cos(p.facing) < 0;
              yOff = 0;
            } else if (c === 'aeroplano') {
              pose = speed > 20 ? (`run${Math.floor(p.runPhase) % 4}` as Pose) : 'celebrate';
              d = 'side';
              f = p.vx < 0;
              yOff = 0;
              rot = Math.sin(t * 4) * 0.35;
            } else if (c === 'trottola') {
              const seq: [Dir, boolean][] = [['down', false], ['side', false], ['up', false], ['side', true]];
              [d, f] = seq[Math.floor(t * 12) % 4];
              yOff = -Math.abs(Math.sin(t * 6)) * 3;
            }
            break;
          }
          if (speed > 30) {
            pose = (`run${Math.floor(p.runPhase) % 4}` as Pose);
            d = dir;
            f = flip;
            yOff = 0;
          }
          break;
        case 'sad':
          pose = 'sad';
          d = 'down';
          f = false;
          break;
        default:
          if (speed > 14) pose = `run${Math.floor(p.runPhase) % 4}` as Pose;
      }
      spr.setFrame(frameIndex(d, pose));
      spr.setFlipX(f);
      spr.setRotation(rot);
      if (rot !== 0) spr.setOrigin(0.5, 0.5);
      else spr.setOrigin(0.5, 22 / FRAME);
      spr.setPosition(Math.round(p.x), Math.round(p.y + yOff + (rot !== 0 ? -6 : 0)));
      spr.setDepth(10 + p.y * 0.01);
      if (sim.ice[p.team === 0 ? 1 : 0] > 0) spr.setTint(0x88eeff);
      else spr.clearTint();
      shadow.setPosition(Math.round(p.x + 1), Math.round(p.y + 1));
      shadow.setScale(pose === 'slide' || pose === 'dive' ? 1.5 : 1, 1);
      // scia con turbo, calamita o scatto
      if (p.sprinting && speed > 120 && Math.random() < dt * 14) this.fx.dust.explode(1, p.x - p.vx * 0.04, p.y);
      if (sim.turbo[p.team] > 0 && speed > 80 && Math.random() < dt * 20) this.fx.spark.explode(1, p.x, p.y - 8);
      if (sim.magnet[p.team] > 0 && !p.isGK && Math.random() < dt * 9) this.fx.spark.explode(1, p.x, p.y - 6);
    }

    // palla
    const b = sim.ball;
    const by = b.y - b.z * Z_SCALE;
    const giant = b.giant || (!!b.owner && sim.giant[b.owner.team] > 0);
    this.ball.setPosition(Math.round(b.x), Math.round(by));
    this.ball.setFrame(Math.floor(b.roll / 3) % 4);
    this.ball.setScale((giant ? 1.55 : 1) * (1 + Math.min(0.5, b.z / 90)));
    this.ball.setDepth(10 + b.y * 0.01 + 0.005);
    this.ballShadow.setPosition(Math.round(b.x + b.z * 0.12), Math.round(b.y + 1));
    this.ballShadow.setScale(giant ? 1.55 : 1);
    this.ballShadow.setAlpha(Math.max(0.1, 0.35 - b.z / 200));
    this.ballGhost.setVisible(false);
    if (b.special && !b.owner) {
      const col = SP_COLORS[b.special.id] ?? 0xffffff;
      this.fx.spark.emitParticleAt(b.x, by, 2);
      if (b.special.id === 'arcobaleno') this.ball.setTint(Phaser.Display.Color.HSVToRGB((t * 1.5) % 1, 0.6, 1).color);
      else this.ball.setTint(col);
      if (b.special.id === 'gemello') {
        // il secondo pallone oscilla accanto al primo
        const off = Math.sin(t * 22) * 7;
        this.ballGhost
          .setVisible(true)
          .setPosition(Math.round(b.x), Math.round(by + off))
          .setFrame((Math.floor(b.roll / 3) + 2) % 4)
          .setScale(this.ball.scaleX)
          .setDepth(this.ball.depth + 0.001)
          .setTint(col);
      }
      if (b.special.id === 'fulmine' || b.special.id === 'combo') this.fx.fire.emitParticleAt(b.x, by, 1);
    } else if ((b.fire || b.superShot) && !b.owner) {
      this.fx.fire.emitParticleAt(b.x, by, 2);
      this.ball.setTint(b.superShot ? 0xfff0a0 : 0xffb070);
    } else if (b.owner && sim.fireShot[b.owner.team]) {
      if (Math.random() < 0.5) this.fx.fire.emitParticleAt(b.x, by - 2, 1);
      this.skinBall(t);
    } else if (b.owner && sim.superBar[b.owner.team] >= 1 && Math.random() < 0.3) {
      this.fx.spark.emitParticleAt(b.x, by - 2, 1);
      this.skinBall(t);
    } else this.skinBall(t);
    this.drawMarks();

    // giocatore controllato
    const h = sim.human;
    if (h) {
      const bob = Math.sin(t * 6) * 1.5;
      this.marker.setPosition(Math.round(h.x), Math.round(h.y - 30 + bob));
      const hint = this.replaying ? null : sim.switchHint;
      this.hintMarker.setVisible(!!hint);
      if (hint) this.hintMarker.setPosition(Math.round(hint.x), Math.round(hint.y - 28 - bob));
      this.ring.setPosition(Math.round(h.x), Math.round(h.y + 1));
      const hasBall = b.owner === h;
      // destinatario del passaggio
      if (hasBall && !sim.charging) {
        const mag = Math.hypot(this.ctrl.mx, this.ctrl.my);
        const dir = mag > 0.15 ? Math.atan2(this.ctrl.my, this.ctrl.mx) : h.facing;
        const tgt = chooseHumanPassTarget(sim, h, dir);
        this.passRing.setVisible(!!tgt);
        if (tgt) this.passRing.setPosition(Math.round(tgt.x), Math.round(tgt.y + 1));
      } else this.passRing.setVisible(false);
      // indicatore palla pronta al volo / rovesciata
      const vKind = !this.replaying && !hasBall ? sim.canVolley(h) : null;
      this.volleyRing.setVisible(!!vKind);
      if (vKind) {
        this.volleyRing
          .setPosition(Math.round(b.x), Math.round(by))
          .setTint(vKind === 'rovesciata' ? 0xff5aa8 : 0xffd23f)
          .setScale(1.05 + Math.sin(t * 16) * 0.14)
          .setAlpha(0.75 + Math.sin(t * 16) * 0.2);
      }
      // barra di carica
      this.chargeG.clear();
      if (sim.passCharging && sim.passHold > 0.12) {
        // passaggio tenuto premuto: corto -> filtrante -> pallonetto
        const w = 22;
        const x = Math.round(h.x - w / 2);
        const y = Math.round(h.y - 40);
        const c = Math.min(1, sim.passHold / PASS_LOB_T);
        const col = sim.passHold >= PASS_LOB_T ? 0xff8ad8 : sim.passHold >= PASS_THROUGH_T ? 0x6ae6ff : 0xffffff;
        this.chargeG.fillStyle(0x1a1222).fillRect(x - 1, y - 1, w + 2, 5);
        this.chargeG.fillStyle(0x3a3d55).fillRect(x, y, w, 3);
        this.chargeG.fillStyle(col).fillRect(x, y, Math.round(w * c), 3);
        const tgt = sim.throughTarget(h, Math.hypot(this.ctrl.mx, this.ctrl.my) > 0.15 ? Math.atan2(this.ctrl.my, this.ctrl.mx) : h.facing);
        if (tgt && sim.passHold >= PASS_THROUGH_T) {
          this.passRing.setVisible(true).setPosition(Math.round(tgt.x), Math.round(tgt.y + 1)).setTint(col);
        }
      } else if (sim.charging) {
        const w = 22;
        const x = Math.round(h.x - w / 2);
        const y = Math.round(h.y - 40);
        const c = sim.charge;
        const col = c < 0.5 ? 0x5be37d : c < 0.85 ? 0xffd23f : sim.superBar[h.team] >= 1 ? 0xff3fa4 : 0xff5a3a;
        this.chargeG.fillStyle(0x1a1222).fillRect(x - 1, y - 1, w + 2, 5);
        this.chargeG.fillStyle(0x3a3d55).fillRect(x, y, w, 3);
        this.chargeG.fillStyle(col).fillRect(x, y, Math.round(w * c), 3);
      } else if (sim.specialsOn && !h.isGK) {
        // energia della supermossa sotto i piedi del giocatore controllato
        const w = 18;
        const x = Math.round(h.x - w / 2);
        const y = Math.round(h.y + 9);
        const full = h.energy >= 1;
        this.chargeG.fillStyle(0x1a1222, 0.85).fillRect(x - 1, y - 1, w + 2, 4);
        const pulse = Math.floor(t * 8) % 2 === 0;
        this.chargeG.fillStyle(full ? (pulse ? 0xffd23f : 0xff3fa4) : 0x3fd0ff).fillRect(x, y, Math.round(w * h.energy), 2);
      }
      // fiato: compare quando si sta scattando o si è un po' stanchi
      if (!h.isGK && (h.stamina < 0.98 || h.sprinting)) {
        const w = 18;
        const x = Math.round(h.x - w / 2);
        const y = Math.round(h.y + (sim.specialsOn ? 13 : 9));
        const col = h.stamina > 0.5 ? 0x5be37d : h.stamina > 0.2 ? 0xffd23f : 0xff5a3a;
        this.chargeG.fillStyle(0x1a1222, 0.85).fillRect(x - 1, y - 1, w + 2, 4);
        this.chargeG.fillStyle(col).fillRect(x, y, Math.round(w * h.stamina), 2);
      }
    }

    // power-up
    const alive = new Set<number>();
    for (const pu of sim.powerUps) {
      alive.add(pu.id);
      let s = this.puSprites.get(pu.id);
      if (!s) {
        const glow = this.add.image(pu.x, pu.y - 10, 'glow').setBlendMode('ADD').setScale(0.8).setDepth(9);
        const puTint = { fuoco: 0xff7a1a, turbo: 0xffe03a, muro: 0xff9a7a, ghiaccio: 0x3fd0ff, calamita: 0xff4a8a, gigante: 0xffa020 } as const;
        glow.setTint(puTint[pu.kind]);
        const shadow = this.add.image(pu.x, pu.y + 1, 'shadow').setAlpha(0.25).setScale(0.8).setDepth(3);
        const icon = this.add.image(pu.x, pu.y - 10, `pu_${pu.kind}`).setDepth(10 + pu.y * 0.01);
        s = { icon, glow, shadow };
        this.puSprites.set(pu.id, s);
        icon.setScale(0);
        this.tweens.add({ targets: icon, scale: 1, duration: 300, ease: 'Back.easeOut' });
      }
      const fl = Math.sin(t * 4 + pu.id) * 2;
      s.icon.setY(Math.round(pu.y - 10 + fl));
      s.glow.setY(pu.y - 10 + fl).setAlpha(0.35 + Math.sin(t * 6) * 0.1);
      const blink = pu.life < 3 && Math.floor(t * 8) % 2 === 0;
      s.icon.setVisible(!blink);
    }
    for (const [id, s] of this.puSprites) {
      if (!alive.has(id)) {
        s.icon.destroy();
        s.glow.destroy();
        s.shadow.destroy();
        this.puSprites.delete(id);
      }
    }

    // muro in porta
    this.wallG.clear();
    for (const team of [0, 1] as const) {
      if (sim.wall[team] <= 0) continue;
      const x = team === 0 ? 6 : sim.W - 14;
      const y0 = sim.goalTop - 14;
      const hgt = sim.pitch.goalWidth + 28;
      const zh = 22;
      const blink = sim.wall[team] < 2 && Math.floor(t * 10) % 2 === 0;
      if (blink) continue;
      this.wallG.fillStyle(0x000000, 0.25).fillRect(x + 2, y0 + 2, 8, hgt);
      for (let yy = 0; yy < hgt + zh; yy += 4) {
        const row = Math.floor(yy / 4);
        this.wallG.fillStyle(row % 2 ? 0xc4552e : 0xb04a28).fillRect(x, y0 - zh + yy, 8, 3);
        this.wallG.fillStyle(0xe9d8b5).fillRect(x, y0 - zh + yy + 3, 8, 1);
      }
      this.wallG.fillStyle(0xffffff, 0.3).fillRect(x, y0 - zh, 2, hgt + zh);
    }
  }

  private updateCamera(dt: number) {
    const sim = this.sim;
    const b = sim.ball;
    const cam = this.cameras.main;
    let tx = b.x + b.vx * 0.22;
    let ty = b.y - b.z * Z_SCALE + b.vy * 0.15;
    const h = sim.human;
    const fk = sim.freeKick;
    if (sim.phase === 'freekick' && fk) {
      // si vedono insieme il tiratore e la porta
      tx = (fk.taker.x + sim.oppGoalX(fk.taker.team)) / 2;
      ty = (fk.taker.y + sim.H / 2) / 2;
    } else if (h && sim.phase === 'play') {
      // con un solo giocatore la telecamera segue di più lui
      const w = sim.locked ? 0.4 : 0.2;
      tx = tx * (1 - w) + h.x * w;
      ty = ty * (1 - w) + h.y * w;
    }
    const k = Math.min(1, dt * (sim.phase === 'goal' ? 2 : 4.5));
    this.camPt.x += (tx - this.camPt.x) * k;
    this.camPt.y += (ty - this.camPt.y) * k;
    cam.centerOn(this.camPt.x, this.camPt.y);
  }

  private updateCrowd(dt: number) {
    if (!this.crowdA || !this.crowdB) return;
    const b = this.sim.ball;
    // tensione: palla vicino a una porta
    const nearGoal = Math.min(b.x, this.sim.W - b.x) < 140 ? 0.35 : 0;
    this.excite = Math.max(nearGoal, this.excite - dt * 0.25);
    this.crowdT -= dt;
    if (this.crowdT <= 0) {
      this.crowdT = 0.55 - this.excite * 0.45;
      const v = !this.crowdB.visible;
      this.crowdB.setVisible(v);
      this.crowdA.setVisible(!v);
    }
    sfx.crowdLevel(this.excite);
    if (!this.launch.demo && this.sim.phase === 'play') {
      this.chantT -= dt;
      if (this.chantT <= 0) {
        this.chantT = 22 + Math.random() * 16;
        sfx.chant(undefined, THEMES[this.launch.config.pitch.id].crowd);
      }
    }
  }
}
