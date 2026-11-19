import Phaser from 'phaser';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load, progressOf, save } from '../save/storage';
import { portrait } from '../gfx/animeArt';
import { hex } from '../gfx/px';
import { canLearn, knows, learn, MY_TECHS, newLeggenda, objectiveText, TECH_OWNER, TECHS, TRAIN_FULL, trainingReward, type LeggendaSave } from '../modes/leggenda';
import { CAST, EPISODES } from '../modes/leggendaStory';
import { today } from '../modes/daily';
import { backToMenu } from './demo';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { goFullscreen, isTouch } from '../ui/fullscreen';

type View = 'episodi' | 'tecniche' | 'allenamento';

/** Il rivale (o il personaggio chiave) di ogni episodio, per la copertina. */
const EP_FACE = ['tommaso', 'maestro', 'sandro', 'dario', 'raffo', 'paco', 'bram', 'nacho', 'erik', 'rafa'];

interface HubData {
  celebrate?: number;
}

/** Leggenda del Pallone: episodi della storia, libro delle tecniche, allenamento col Maestro. */
export class LeggendaScene extends Phaser.Scene {
  private view: View = 'episodi';
  private sel = 0;
  private sv!: LeggendaSave;
  private celebrate?: number;
  private train?: { kick: number; score: number; pos: number; dir: number; speed: number; running: boolean; results: number[] };
  private trainG?: Phaser.GameObjects.Graphics;
  private trainInfo?: Phaser.GameObjects.Text;

  constructor() {
    super('leggenda');
  }

  init(d: HubData) {
    this.celebrate = d?.celebrate;
  }

  create() {
    // la partita dimostrativa del menu non serve qui sotto
    if (this.scene.isActive('match')) this.scene.stop('match');
    if (this.scene.isActive('hud')) this.scene.stop('hud');
    const all = load();
    this.sv = all.leggenda = all.leggenda ?? newLeggenda();
    this.sel = Math.min(this.sv.cleared, EPISODES.length - 1);
    this.view = 'episodi';
    this.train = undefined;
    music.play('leggenda');
    this.cameras.main.fadeIn(250, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    if (this.celebrate !== undefined) this.time.delayedCall(350, () => this.party(this.celebrate!));
  }

  private bg() {
    const W = this.scale.width;
    const H = this.scale.height;
    const key = `lg_hub_${W}x${H}`;
    if (!this.textures.exists(key)) {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d')!;
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#1a1040');
      gr.addColorStop(0.45, '#8a3a6a');
      gr.addColorStop(0.75, '#ff8a4a');
      gr.addColorStop(1, '#ffd27a');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      // sole al tramonto, a strisce
      const sx = W * 0.72;
      const sy = H * 0.74;
      for (let r = 70; r > 0; r -= 2) {
        ctx.fillStyle = r > 50 ? 'rgba(255,220,120,0.08)' : '#ffe08a';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#8a3a6a';
      for (let i = 0; i < 5; i++) ctx.fillRect(sx - 60, sy + 6 + i * 9, 120, 2 + i);
      // mare e campo
      ctx.fillStyle = '#3a2a5a';
      ctx.fillRect(0, H * 0.8, W, H * 0.2);
      ctx.fillStyle = '#2a7a3a';
      ctx.fillRect(0, H * 0.86, W, H * 0.14);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(0, H * 0.86, W, 2);
      ctx.fillRect(W / 2, H * 0.86, 2, H * 0.14);
      // porta
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(W - 60, H * 0.86 - 34, 3, 34);
      ctx.fillRect(W - 60, H * 0.86 - 34, 44, 3);
      this.textures.addCanvas(key, cv);
    }
    this.add.image(0, 0, key).setOrigin(0);
    // raggi che girano
    const g = this.add.graphics({ x: W * 0.72, y: H * 0.74 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.fillStyle(0xffe08a, 0.06).fillTriangle(0, 0, Math.cos(a - 0.08) * 600, Math.sin(a - 0.08) * 600, Math.cos(a + 0.08) * 600, Math.sin(a + 0.08) * 600);
    }
    this.tweens.add({ targets: g, angle: 360, duration: 60000, repeat: -1 });
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.45).setOrigin(0);
  }

  private build() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.trainG = undefined;
    const W = this.scale.width;
    this.bg();
    // titolo
    const t1 = shadowTxt(this, 16, 18, 'LEGGENDA', 16, '#ffd23f', '#a0381e', 2);
    t1.main.setOrigin(0, 0.5);
    t1.sh.setOrigin(0, 0.5);
    const t2 = txt(this, 18, 38, 'DEL PALLONE', 8, '#ffffff').setOrigin(0, 0.5);
    void t2;
    const coins = progressOf().coins;
    txt(this, W - 12, 14, `${this.sv.pts} PUNTI LEGGENDA`, 7, '#3fd0ff').setOrigin(1, 0.5);
    txt(this, W - 12, 28, `${coins} MONETE`, 6, '#ffd23f').setOrigin(1, 0.5);
    // schede
    const tabs: [View, string][] = [['episodi', 'EPISODI'], ['tecniche', 'TECNICHE'], ['allenamento', 'ALLENAMENTO']];
    const tw = Math.min(130, (W - 120) / 3);
    tabs.forEach(([v, l], i) => {
      const b = button(this, W / 2 - tw - 10 + i * (tw + 10) + 30, 62, tw, 20, l, () => {
        if (this.train?.running) return;
        this.view = v;
        this.train = undefined;
        this.build();
      }, { size: 6, color: 0x2f6fd0 });
      b.setSelected(this.view === v);
    });
    button(this, 40, 62, 60, 20, 'MENU', () => backToMenu(this), { size: 6, color: 0x3a3d55 });
    if (this.view === 'episodi') this.buildEpisodes();
    else if (this.view === 'tecniche') this.buildTechs();
    else this.buildTraining();
  }

  // ---------- episodi ----------

  private buildEpisodes() {
    const W = this.scale.width;
    const lw = Math.min(250, W * 0.42);
    const g = this.add.graphics();
    panel(g, 10, 80, lw, 270, 0x1b1d2e, 0x2e3250, 0.92);
    EPISODES.forEach((e, i) => {
      const y = 94 + i * 26;
      const done = i < this.sv.cleared;
      const open = i <= this.sv.cleared;
      const sel = i === this.sel;
      if (sel) g.fillStyle(COLORS.accent, 0.25).fillRect(14, y - 11, lw - 8, 22);
      g.fillStyle(done ? 0x5be37d : open ? COLORS.accent : 0x3a3d55).fillCircle(28, y, 9);
      txt(this, 28, y, open ? String(i + 1) : '?', 6, open ? '#1a1222' : '#8a8fb0');
      txt(this, 44, y, open ? e.title : '???', 6, open ? (sel ? '#ffd23f' : '#ffffff') : '#5a5f80').setOrigin(0, 0.5);
      if (done) txt(this, lw, y, '✓', 7, '#5be37d').setOrigin(1, 0.5);
      const z = this.add.zone(10 + lw / 2, y, lw, 24).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        sfx.click();
        this.sel = i;
        this.build();
      });
    });
    // copertina dell'episodio scelto
    const x0 = 20 + lw;
    const pw = W - x0 - 10;
    const pg = this.add.graphics();
    panel(pg, x0, 80, pw, 270, 0x1b1d2e, COLORS.accent, 0.94);
    const i = this.sel;
    const e = EPISODES[i];
    const open = i <= this.sv.cleared;
    const cx = x0 + pw / 2;
    txt(this, cx, 96, `EPISODIO ${i + 1}`, 7, '#3fd0ff');
    txt(this, cx, 114, open ? e.title.toUpperCase() : '???', e.title.length > 22 ? 7 : 8, '#ffd23f', { wordWrap: { width: pw - 20 }, align: 'center' });
    if (!open) {
      txt(this, cx, 200, 'Supera l\'episodio precedente\nper scoprire questo capitolo.', 7, '#8a8fb0', { align: 'center', lineSpacing: 8 });
      return;
    }
    // Nico contro il personaggio chiave
    const nico = CAST.nico;
    const other = CAST[EP_FACE[i]];
    const fy = 210;
    this.add.image(cx - 50, fy, portrait(this, 'nico', nico.face, nico.shirt, { expr: 'grinta' })).setScale(2).setOrigin(0.5, 1);
    this.add.image(cx + 50, fy, portrait(this, EP_FACE[i], other.face, other.shirt, { expr: 'normale' })).setScale(2).setOrigin(0.5, 1).setFlipX(true);
    shadowTxt(this, cx, fy - 50, 'VS', 12, '#ffd23f', '#a0381e', 2);
    txt(this, cx, fy + 12, e.place, 6, '#c8cce8');
    txt(this, cx, fy + 30, `OBIETTIVO: ${objectiveText(e.objective).toUpperCase()}`, 6, '#ffffff');
    txt(this, cx, fy + 44, i >= 5 ? 'Mondiali giovanili' : i >= 1 ? 'Campionato regionale' : 'Partitella', 6, '#8a8fb0');
    const done = i < this.sv.cleared;
    button(this, cx, fy + 70, Math.min(200, pw - 40), 26, done ? 'RIGIOCA' : 'GIOCA', () => this.play(i), { color: done ? 0x2f6fd0 : 0xe85a1a, size: 8 });
    if (i === 0 && this.sv.cleared === 0) {
      txt(this, cx, fy + 104, 'Quando incontri un avversario scegli:\ndribbling, passaggio, tiro o una tecnica.', 6, '#ffe9a0', { align: 'center', lineSpacing: 6 });
    }
  }

  private play(ep: number) {
    if (isTouch()) goFullscreen();
    sfx.unlock();
    this.cameras.main.fadeOut(250, 10, 8, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('epic', { ep }));
  }

  private party(ep: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    sfx.fanfare();
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, H / 2 - 30, W, 60, 0x0d0a1a, 0.9).setOrigin(0));
    const text = ep >= EPISODES.length - 1 ? 'CAMPIONI DEL MONDO!' : `EPISODIO ${ep + 1} SUPERATO!`;
    const t = shadowTxt(this, W / 2, H / 2, text, 14, '#ffd23f', '#a0381e', 2);
    c.add(t.c);
    const em = this.add.particles(0, 0, 'confetti', {
      x: { min: 0, max: W },
      y: -10,
      speedY: { min: 80, max: 180 },
      speedX: { min: -40, max: 40 },
      rotate: { min: 0, max: 360 },
      lifespan: 3000,
      tint: [0xffd23f, 0x3fd0ff, 0xff5a5a, 0x5be37d],
      quantity: 3,
      frequency: 30,
    }).setDepth(101);
    this.time.delayedCall(1800, () => em.stop());
    this.tweens.add({ targets: c, alpha: 0, delay: 1800, duration: 400, onComplete: () => c.destroy() });
  }

  // ---------- tecniche ----------

  private buildTechs() {
    const W = this.scale.width;
    const g = this.add.graphics();
    panel(g, 10, 80, W - 20, 272, 0x1b1d2e, 0x2e3250, 0.94);
    const cols = 2;
    const cw = (W - 36) / cols;
    const ch = 41;
    MY_TECHS.forEach((id, i) => {
      const t = TECHS[id];
      const x = 18 + (i % cols) * (cw + 4);
      const y = 86 + Math.floor(i / cols) * (ch + 2);
      const has = knows(this.sv, id);
      const owner = CAST[TECH_OWNER[id]];
      g.fillStyle(has ? 0x2a2e4a : 0x20223a).fillRect(x, y, cw, ch);
      g.fillStyle(t.color, has ? 1 : 0.4).fillRect(x, y, 3, ch);
      if (owner) this.add.image(x + 6, y + ch - 1, portrait(this, TECH_OWNER[id], owner.face, owner.shirt)).setScale(0.8).setOrigin(0, 1).setAlpha(has ? 1 : 0.45);
      const tx = x + 50;
      txt(this, tx, y + 9, t.name, 6, has ? hex(t.color) : '#8a8fb0').setOrigin(0, 0.5);
      const kind = { tiro: 'TIRO', dribbling: 'DRIBBLING', passaggio: 'PASSAGGIO', parata: 'PARATA', blocco: 'BLOCCO' }[t.kind];
      txt(this, tx, y + 21, `${kind} +${t.power}  ·  ${t.cost} EN${t.partner ? '  ·  COMBO' : ''}`, 6, '#c8cce8').setOrigin(0, 0.5);
      txt(this, tx, y + 32, t.desc, 6, '#8a8fb0').setOrigin(0, 0.5);
      const rx = x + cw - 6;
      if (has) txt(this, rx, y + 9, 'IMPARATA', 5, '#5be37d').setOrigin(1, 0.5);
      else if (!t.unlock?.pts) txt(this, rx, y + 9, `STORIA: EP.${(t.unlock?.ep ?? 0) + 1}`, 5, '#8a8fb0').setOrigin(1, 0.5);
      else if (this.sv.cleared < t.unlock.ep) txt(this, rx, y + 9, `DALL'EP.${t.unlock.ep + 1}`, 5, '#8a8fb0').setOrigin(1, 0.5);
      else {
        const ok = canLearn(this.sv, id);
        const b = button(this, rx - 38, y + 11, 74, 14, `${t.unlock.pts} PL`, () => {
          if (learn(this.sv, id)) {
            save();
            sfx.powerup();
            this.build();
          }
        }, { size: 6, color: ok ? 0x2f9a50 : 0x3a3d55 });
        b.setEnabled(ok);
      }
    });
  }

  // ---------- allenamento ----------

  private buildTraining() {
    const W = this.scale.width;
    const H = this.scale.height;
    const g = this.add.graphics();
    panel(g, 10, 80, W - 20, 272, 0x1b1d2e, 0x2e3250, 0.94);
    const m = CAST.maestro;
    this.add.image(24, 348, portrait(this, 'maestro', m.face, m.shirt)).setScale(2.2).setOrigin(0, 1);
    const day = today();
    const done = this.sv.trainDay === day ? this.sv.trainCount : 0;
    const left = Math.max(0, TRAIN_FULL - done);
    txt(this, 140, 100, 'IL MAESTRO:', 7, '#3fd0ff').setOrigin(0, 0.5);
    txt(this, 140, 122, 'Calcia quando il cursore è nella zona d\'oro.\nCinque tiri: ogni centro vale Punti Leggenda.', 6, '#ffffff', { lineSpacing: 6 }).setOrigin(0, 0.5);
    txt(this, 140, 146, left > 0 ? `Allenamenti a punti pieni oggi: ${left}/${TRAIN_FULL}` : 'Per oggi hai dato tutto: i punti sono ridotti.', 6, left > 0 ? '#5be37d' : '#ffd23f').setOrigin(0, 0.5);
    txt(this, 140, 160, `Record: ${this.sv.trainBest}/15`, 6, '#8a8fb0').setOrigin(0, 0.5);
    this.trainG = this.add.graphics();
    this.trainInfo = txt(this, W / 2 + 60, 290, '', 8, '#ffd23f');
    if (!this.train) {
      button(this, W / 2 + 60, 316, 180, 26, 'INIZIA', () => {
        this.train = { kick: 0, score: 0, pos: 0, dir: 1, speed: 0.9, running: true, results: [] };
        this.build();
      }, { color: 0xe85a1a, size: 8 });
    } else if (this.train.running) {
      button(this, W / 2 + 60, 316, 180, 26, 'CALCIA!', () => this.kick(), { color: 0xc0306a, size: 8 });
    } else {
      button(this, W / 2 + 60, 316, 180, 26, 'DI NUOVO', () => {
        this.train = { kick: 0, score: 0, pos: 0, dir: 1, speed: 0.9, running: true, results: [] };
        this.build();
      }, { color: 0x2f6fd0, size: 8 });
    }
    this.drawTrain();
    void H;
  }

  update(_t: number, dms: number) {
    const tr = this.train;
    if (!tr?.running || this.view !== 'allenamento') return;
    tr.pos += tr.dir * tr.speed * (dms / 1000);
    if (tr.pos > 1) {
      tr.pos = 1;
      tr.dir = -1;
    } else if (tr.pos < 0) {
      tr.pos = 0;
      tr.dir = 1;
    }
    this.drawTrain();
  }

  private drawTrain() {
    const g = this.trainG;
    const tr = this.train;
    if (!g) return;
    const W = this.scale.width;
    g.clear();
    const bw = Math.min(360, W - 220);
    const x0 = W / 2 + 60 - bw / 2;
    const y = 214;
    g.fillStyle(0x0d0a1a).fillRect(x0 - 3, y - 3, bw + 6, 22);
    g.fillStyle(0x3a3d55).fillRect(x0, y, bw, 16);
    g.fillStyle(0x2f9a50).fillRect(x0 + bw * 0.3, y, bw * 0.4, 16);
    g.fillStyle(0x5be37d).fillRect(x0 + bw * 0.4, y, bw * 0.2, 16);
    g.fillStyle(0xffd23f).fillRect(x0 + bw * 0.46, y, bw * 0.08, 16);
    if (tr) {
      const cx = x0 + bw * tr.pos;
      g.fillStyle(0xffffff).fillRect(cx - 2, y - 6, 4, 28);
      // palloni calciati
      for (let i = 0; i < 5; i++) {
        const r = tr.results[i];
        const c = r === undefined ? 0x3a3d55 : r === 3 ? 0xffd23f : r === 2 ? 0x5be37d : r === 1 ? 0x2f9a50 : 0xff5a5a;
        g.fillStyle(c).fillCircle(W / 2 + 60 - 48 + i * 24, y + 44, 7);
      }
      this.trainInfo?.setText(tr.running ? `TIRO ${tr.kick + 1}/5` : '');
    }
  }

  private kick() {
    const tr = this.train;
    if (!tr?.running) return;
    const d = Math.abs(tr.pos - 0.5);
    const pts = d <= 0.04 ? 3 : d <= 0.1 ? 2 : d <= 0.2 ? 1 : 0;
    tr.results.push(pts);
    tr.score += pts;
    tr.kick++;
    tr.speed *= 1.25;
    if (pts === 3) sfx.superShot();
    else if (pts > 0) sfx.kick(0.7);
    else sfx.ooh();
    const W = this.scale.width;
    const msg = ['FUORI!', 'BUONO', 'OTTIMO!', 'PERFETTO!'][pts];
    const t = shadowTxt(this, W / 2 + 60, 186, msg, 10, pts === 3 ? '#ffd23f' : pts ? '#5be37d' : '#ff5a5a', '#1a1222', 2);
    this.tweens.add({ targets: t.c, y: 170, alpha: 0, delay: 400, duration: 400, onComplete: () => t.c.destroy() });
    if (tr.kick >= 5) {
      tr.running = false;
      const got = trainingReward(this.sv, tr.score, today());
      save();
      this.time.delayedCall(500, () => {
        this.build();
        const r = shadowTxt(this, W / 2 + 60, 260, `${tr.score}/15  ·  +${got} PUNTI LEGGENDA`, 8, '#3fd0ff', '#1a1222', 2);
        r.c.setScale(0.5);
        this.tweens.add({ targets: r.c, scale: 1, duration: 300, ease: 'Back.easeOut' });
        sfx.coin();
      });
    }
  }
}
