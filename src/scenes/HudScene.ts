import Phaser from 'phaser';
import type { MatchScene, HudMessage } from './MatchScene';
import { button, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { isTouch } from '../ui/fullscreen';
import { load, save } from '../save/storage';
import { sfx } from '../audio/sfx';
import { backToMenu, backToScene } from './demo';
import { MODES } from '../modes/modes';

interface TouchButton {
  id: 'shoot' | 'pass' | 'sprint';
  x: number;
  y: number;
  r: number;
  color: number;
  label: Phaser.GameObjects.Text;
  pointer: number | null;
}

export class HudScene extends Phaser.Scene {
  private match!: MatchScene;
  private g!: Phaser.GameObjects.Graphics;
  private ctrlG!: Phaser.GameObjects.Graphics;
  private scoreT!: Phaser.GameObjects.Text;
  private timeT!: Phaser.GameObjects.Text;
  private homeT!: Phaser.GameObjects.Text;
  private awayT!: Phaser.GameObjects.Text;
  private goldenT!: Phaser.GameObjects.Text;
  private goalT?: Phaser.GameObjects.Text;
  private windT?: Phaser.GameObjects.Text;
  private condT?: Phaser.GameObjects.Text;
  private buttons: TouchButton[] = [];
  private joy = { pointer: null as number | null, bx: 0, by: 0, kx: 0, ky: 0 };
  private touch = true;
  private msgQueue: Phaser.GameObjects.Container[] = [];
  private pauseLayer?: Phaser.GameObjects.Container;
  private pauseBtn!: Button;
  private lastScore = '';
  private help?: Phaser.GameObjects.Container;

  constructor() {
    super('hud');
  }

  create() {
    this.match = this.scene.get('match') as MatchScene;
    this.touch = isTouch();
    this.buttons = [];
    this.joy.pointer = null;
    this.msgQueue = [];
    this.pauseLayer = undefined;
    this.input.addPointer(3);
    this.g = this.add.graphics();
    this.ctrlG = this.add.graphics();
    const cfg = this.match.launch.config;
    this.homeT = txt(this, 0, 0, cfg.home.short, 8);
    this.awayT = txt(this, 0, 0, cfg.away.short, 8);
    this.scoreT = txt(this, 0, 0, '0 - 0', 16, '#ffffff');
    this.timeT = txt(this, 0, 0, '0:00', 8, '#ffd23f');
    this.goldenT = txt(this, 0, 0, 'GOLDEN GOL', 6, '#ff5a5a').setVisible(false);
    const goal = this.match.launch.hudGoal;
    if (goal) {
      this.goalT = txt(this, 0, 0, 'OBIETTIVO: ' + goal, 6, '#5be37d', { backgroundColor: '#0d0a1acc', padding: { x: 4, y: 3 } });
    }
    if (cfg.pitch.wind) this.windT = txt(this, 0, 0, 'VENTO', 6, '#bfe6ff');
    const cond = [cfg.pitch.slope ? 'PENDENZA' : '', cfg.pitch.waves ? 'ONDE' : '', cfg.weather === 'pioggia' ? 'PIOGGIA' : cfg.weather === 'nebbia' ? 'NEBBIA' : '', cfg.night && cfg.pitch.id !== 'tetto' ? 'NOTTE' : '']
      .filter(Boolean)
      .join(' · ');
    if (cond) this.condT = txt(this, 0, 0, cond, 6, '#bfe6ff', { backgroundColor: '#0d0a1acc', padding: { x: 4, y: 3 } }).setOrigin(0, 0.5);
    this.pauseBtn = button(this, 0, 0, 26, 22, 'II', () => this.togglePause(true), { size: 8 });

    if (this.touch) {
      const mk = (id: TouchButton['id'], label: string, color: number): TouchButton => ({
        id,
        x: 0,
        y: 0,
        r: 0,
        color,
        label: txt(this, 0, 0, label, 6, '#ffffff'),
        pointer: null,
      });
      this.buttons.push(mk('shoot', 'TIRA', 0xe8443a), mk('pass', 'PASSA', 0x2f8be0), mk('sprint', 'SCATTO', 0xe0a020));
    }
    this.layout();

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.scale.on('resize', this.layout, this);
    this.match.events.on('msg', this.showMsg, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.match.events.off('msg', this.showMsg, this);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
    });
    const esc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const p = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    esc.on('down', () => this.togglePause(!this.pauseLayer));
    p.on('down', () => this.togglePause(!this.pauseLayer));

    // pausa automatica se l'app va in background
    const onHide = () => {
      if (document.hidden && !this.pauseLayer && this.scene.isActive()) this.togglePause(true);
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onHide));

    if (!load().settings.tutorialSeen) this.showHelp();
  }

  private layout() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.homeT.setPosition(W / 2 - 66, 14);
    this.awayT.setPosition(W / 2 + 66, 14);
    this.scoreT.setPosition(W / 2, 16);
    this.timeT.setPosition(W / 2, 37);
    this.goldenT.setPosition(W / 2, 50);
    this.goalT?.setPosition(W / 2, H - 12);
    this.windT?.setPosition(46, 14);
    this.condT?.setPosition(8, this.windT ? 46 : 14);
    this.pauseBtn.c.setPosition(W - 22, 18);
    // pulsanti touch: arco in basso a destra
    const pos: Record<string, [number, number, number]> = {
      shoot: [W - 54, H - 56, 30],
      pass: [W - 122, H - 34, 24],
      sprint: [W - 110, H - 100, 21],
    };
    for (const b of this.buttons) {
      const [x, y, r] = pos[b.id];
      b.x = x;
      b.y = y;
      b.r = r;
      b.label.setPosition(x, y);
    }
  }

  private onDown(p: Phaser.Input.Pointer) {
    sfx.unlock();
    if (this.match.replaying) {
      this.match.endReplay();
      return;
    }
    if (this.pauseLayer || !this.touch) return;
    const W = this.scale.width;
    // pulsanti
    let best: TouchButton | null = null;
    let bd = Infinity;
    for (const b of this.buttons) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < b.r * 1.55 && d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best && best.pointer === null) {
      best.pointer = p.id;
      this.setBtn(best.id, true);
      return;
    }
    if (p.x < W * 0.5 && this.joy.pointer === null && p.y > 40) {
      this.joy.pointer = p.id;
      this.joy.bx = Phaser.Math.Clamp(p.x, 46, W * 0.5);
      this.joy.by = Phaser.Math.Clamp(p.y, 60, this.scale.height - 40);
      this.joy.kx = p.x;
      this.joy.ky = p.y;
      this.updateJoy(p);
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id === this.joy.pointer) this.updateJoy(p);
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p.id === this.joy.pointer) {
      this.joy.pointer = null;
      this.match.ctrl.tMx = 0;
      this.match.ctrl.tMy = 0;
    }
    for (const b of this.buttons) {
      if (b.pointer === p.id) {
        b.pointer = null;
        this.setBtn(b.id, false);
      }
    }
  }

  private updateJoy(p: Phaser.Input.Pointer) {
    const R = 34;
    let dx = p.x - this.joy.bx;
    let dy = p.y - this.joy.by;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      // la base segue il dito
      this.joy.bx += (dx / d) * (d - R);
      this.joy.by += (dy / d) * (d - R);
      dx = p.x - this.joy.bx;
      dy = p.y - this.joy.by;
    }
    this.joy.kx = p.x;
    this.joy.ky = p.y;
    this.match.ctrl.tMx = dx / R;
    this.match.ctrl.tMy = dy / R;
  }

  private setBtn(id: TouchButton['id'], v: boolean) {
    const c = this.match.ctrl;
    if (id === 'shoot') c.tShoot = v;
    if (id === 'pass') c.tPass = v;
    if (id === 'sprint') c.tSprint = v;
    if (v && navigator.vibrate) navigator.vibrate(8);
  }

  update() {
    const sim = this.match.sim;
    if (!sim) return;
    const W = this.scale.width;
    const H = this.scale.height;
    const cfg = this.match.launch.config;
    const g = this.g;
    g.clear();
    // tabellone
    panel(g, W / 2 - 92, 4, 184, 22, 0x1b1d2e, 0x2e3250, 0.92);
    g.fillStyle(cfg.home.colors.shirt).fillRect(W / 2 - 88, 8, 6, 14);
    g.fillStyle(cfg.home.colors.shirt2).fillRect(W / 2 - 85, 8, 3, 14);
    g.fillStyle(cfg.away.colors.shirt).fillRect(W / 2 + 82, 8, 6, 14);
    g.fillStyle(cfg.away.colors.shirt2).fillRect(W / 2 + 85, 8, 3, 14);
    panel(g, W / 2 - 24, 29, 48, 14, 0x1b1d2e, 0x2e3250, 0.92);
    const sc = `${sim.score[0]} - ${sim.score[1]}`;
    if (sc !== this.lastScore) {
      this.lastScore = sc;
      this.scoreT.setText(sc);
      this.tweens.add({ targets: this.scoreT, scale: { from: 1.6, to: 1 }, duration: 400, ease: 'Back.easeOut' });
    }
    const tl = Math.ceil(sim.timeLeft);
    this.timeT.setText(sim.goldenGoal ? 'GG' : `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`);
    this.timeT.setColor(tl <= 10 && !sim.goldenGoal ? (Math.floor(this.time.now / 250) % 2 ? '#ff5a5a' : '#ffffff') : '#ffd23f');
    this.goldenT.setVisible(sim.goldenGoal);

    // barre super
    for (const t of [0, 1] as const) {
      const x = t === 0 ? W / 2 - 92 : W / 2 + 40;
      const y = 29;
      const v = sim.superBar[t];
      g.fillStyle(0x1a1222, 0.9).fillRect(x, y, 52, 7);
      const full = v >= 1;
      const col = full ? (Math.floor(this.time.now / 120) % 2 ? 0xffd23f : 0xff3fa4) : 0x3fd0ff;
      if (t === 0) g.fillStyle(col).fillRect(x + 1, y + 1, Math.round(50 * v), 5);
      else g.fillStyle(col).fillRect(x + 51 - Math.round(50 * v), y + 1, Math.round(50 * v), 5);
      // barra dello spettacolo (giocate di stile) della squadra umana
      const showStyle = t === sim.cfg.humanTeam;
      if (showStyle) {
        const sv = Math.min(1, sim.style[t]);
        g.fillStyle(0x1a1222, 0.9).fillRect(x, y + 8, 52, 5);
        const sw = Math.round(50 * sv);
        g.fillStyle(0xff7ab8).fillRect(t === 0 ? x + 1 : x + 51 - sw, y + 9, sw, 3);
        // tacche: ogni giocata vale un ottavo circa
        g.fillStyle(0x1a1222, 0.6);
        for (let k = 1; k < 5; k++) g.fillRect(x + 1 + k * 10, y + 9, 1, 3);
      }
      // potenziamenti attivi
      let ix = t === 0 ? x : x + 52 - 10;
      const iy = y + (showStyle ? 16 : 10);
      const drawChip = (c: number, label: number) => {
        g.fillStyle(0x1a1222).fillRect(ix - 1, iy - 1, 12, 8);
        g.fillStyle(c).fillRect(ix, iy, Math.max(1, Math.round(10 * label)), 6);
        ix += t === 0 ? 14 : -14;
      };
      if (sim.fireShot[t]) drawChip(0xff7a1a, 1);
      if (sim.turbo[t] > 0) drawChip(0xffe03a, sim.turbo[t] / 8);
      if (sim.wall[t] > 0) drawChip(0xc4552e, sim.wall[t] / 9);
    }

    // vento
    if (this.windT && cfg.pitch.wind) {
      const wx = sim.wind.x;
      const wy = sim.wind.y;
      const m = Math.hypot(wx, wy);
      panel(g, 8, 6, 76, 30, 0x1b1d2e, 0x2e3250, 0.85);
      const cx = 46;
      const cy = 27;
      const a = Math.atan2(wy, wx);
      const L = 4 + (m / 110) * 10;
      g.lineStyle(2, 0xbfe6ff);
      g.lineBetween(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      g.fillStyle(0xbfe6ff).fillCircle(cx + Math.cos(a) * L, cy + Math.sin(a) * L, 2);
    }

    // controlli touch
    const cg = this.ctrlG;
    cg.clear();
    if (this.touch && !this.pauseLayer) {
      const h = sim.human;
      const owns = !!h && sim.ball.owner === h;
      const teamHas = !!h && sim.teamHasBall(h.team);
      for (const b of this.buttons) {
        const pressed = b.pointer !== null;
        const r = pressed ? b.r - 2 : b.r;
        cg.fillStyle(0x000000, 0.25).fillCircle(b.x + 2, b.y + 3, r);
        cg.fillStyle(b.color, pressed ? 0.75 : 0.42).fillCircle(b.x, b.y, r);
        cg.lineStyle(2, 0xffffff, pressed ? 0.95 : 0.55).strokeCircle(b.x, b.y, r);
        if (b.id === 'shoot') b.label.setText(owns ? 'TIRA' : 'SCIVOLA');
        if (b.id === 'pass') b.label.setText(owns ? 'PASSA' : sim.locked ? 'CHIEDI' : teamHas ? 'PASSA' : 'CAMBIA');
      }
      // anello di carica sul tasto TIRA
      if (sim.charging) {
        const sb = this.buttons[0];
        const c = sim.charge;
        cg.lineStyle(4, c > 0.85 ? (sim.superBar[sim.humanTeam ?? 0] >= 1 ? 0xff3fa4 : 0xffd23f) : 0x5be37d, 1);
        cg.beginPath();
        cg.arc(sb.x, sb.y, sb.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c, false);
        cg.strokePath();
      }
      // joystick
      const active = this.joy.pointer !== null;
      const bx = active ? this.joy.bx : 70;
      const by = active ? this.joy.by : H - 70;
      cg.fillStyle(0xffffff, active ? 0.12 : 0.06).fillCircle(bx, by, 34);
      cg.lineStyle(2, 0xffffff, active ? 0.5 : 0.22).strokeCircle(bx, by, 34);
      const kx = active ? Phaser.Math.Clamp(this.joy.kx, bx - 34, bx + 34) : bx;
      const ky = active ? Phaser.Math.Clamp(this.joy.ky, by - 34, by + 34) : by;
      cg.fillStyle(0xffffff, active ? 0.55 : 0.2).fillCircle(kx, ky, 15);
    }
  }

  private showMsg(m: HudMessage) {
    const W = this.scale.width;
    const H = this.scale.height;
    // un messaggio alla volta
    for (const c of this.msgQueue) c.destroy();
    this.msgQueue = [];
    const size = m.big ? 32 : 16;
    const y = m.big ? H * 0.38 : H * 0.3;
    const { c } = shadowTxt(this, W / 2, y, m.text, size, m.color ?? '#ffffff', '#1a1222', m.big ? 4 : 2);
    if (m.sub) {
      const s = txt(this, 0, size * 0.5 + 14, m.sub, 8, '#ffffff');
      s.setShadow(1, 1, '#1a1222', 0, true, true);
      c.add(s);
    }
    c.setScale(0.2);
    this.msgQueue.push(c);
    this.tweens.add({ targets: c, scale: 1, duration: 320, ease: 'Back.easeOut' });
    if (m.big) this.tweens.add({ targets: c, angle: { from: -4, to: 4 }, duration: 260, yoyo: true, repeat: 3 });
    this.tweens.add({
      targets: c,
      alpha: 0,
      y: y - 16,
      delay: m.ms ?? 1100,
      duration: 300,
      onComplete: () => c.destroy(),
    });
  }

  private showHelp() {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    panel(g, W / 2 - 170, H / 2 - 62, 340, 112, 0x1b1d2e, 0x2e3250, 0.94);
    c.add(g);
    const lines = this.touch
      ? ['COME SI GIOCA', '', 'Joystick a sinistra: muoviti', 'TIRA: tieni premuto per caricare', 'PASSA: passaggio verso il joystick', 'Senza palla: SCIVOLA e CAMBIA', 'SCATTO: corri più veloce']
      : ['COME SI GIOCA', '', 'Frecce/WASD: muoviti', 'J o X: tira (tieni premuto)', 'K o Z: passa / cambia', 'Senza palla J: scivolata', 'L o Shift: scatto  -  Esc: pausa'];
    lines.forEach((l, i) => c.add(txt(this, W / 2, H / 2 - 50 + i * 14, l, i === 0 ? 8 : 6, i === 0 ? '#ffd23f' : '#ffffff')));
    this.help = c;
    this.time.delayedCall(5200, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() });
      save((d) => (d.settings.tutorialSeen = true));
    });
  }

  togglePause(on: boolean) {
    if (on === !!this.pauseLayer) return;
    if (this.match.finished) return;
    if (on) {
      this.help?.destroy();
      this.help = undefined;
      this.scene.pause('match');
      this.match.ctrl.reset();
      for (const b of this.buttons) b.pointer = null;
      this.joy.pointer = null;
      const W = this.scale.width;
      const H = this.scale.height;
      const c = this.add.container(0, 0);
      const bg = this.add.rectangle(0, 0, W, H, 0x0a0816, 0.7).setOrigin(0).setInteractive();
      c.add(bg);
      c.add(shadowTxt(this, W / 2, H / 2 - 80, 'PAUSA', 24, '#ffd23f').c);
      const b1 = button(this, W / 2, H / 2 - 30, 180, 26, 'RIPRENDI', () => this.togglePause(false), { color: 0x2f8be0 });
      const b2 = button(this, W / 2, H / 2 + 6, 180, 26, 'OPZIONI', () => {
        this.scene.launch('settings');
        this.scene.bringToTop('settings');
      });
      const b3 = button(this, W / 2, H / 2 + 42, 180, 26, this.match.launch.mode === 'quick' ? 'ESCI AL MENU' : 'ABBANDONA', () => this.quit(), { color: 0x8a3040 });
      c.add([b1.c, b2.c, b3.c]);
      this.pauseLayer = c;
      this.ctrlG.clear();
    } else {
      this.pauseLayer?.destroy();
      this.pauseLayer = undefined;
      this.scene.resume('match');
    }
  }

  private quit() {
    this.pauseLayer?.destroy();
    this.pauseLayer = undefined;
    const mode = MODES.find((m) => m.id === this.match.launch.mode);
    if (mode && mode.id !== 'quick') backToScene(this, mode.scene);
    else backToMenu(this);
  }
}
