import Phaser from 'phaser';
import { arrow, button, COLORS, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { load, save } from '../save/storage';
import { frameIndex, HAIR, makePlayerSheet, SKIN } from '../gfx/sprites';
import { drawItaly, MAP_COLS, MAP_ROWS, project } from '../gfx/italyMap';
import type { Difficulty } from '../sim/types';
import { HERO_NAMES, HERO_NUMBERS } from '../modes/career';
import {
  CITIES, cityTeam, conquered, CQ_GOAL_TEXT, KITS, newConquista, vicoloTeam,
  type ConquistaState, type CqCaptain, type CqControl,
} from '../modes/conquista';
import { PITCHES } from '../data/pitches';
import { backToMenu, backToScene } from './demo';
import { askName } from '../ui/nameInput';
import { sfx } from '../audio/sfx';

/** Nomi proposti per il capitano (diversi da quelli dei compagni). */
const NAMES = HERO_NAMES.filter((n) => !['Peppe', 'Lello', 'Ciccio', 'Totò', 'Mimmo'].includes(n));
const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];
const S = 3;
/** Posizione delle etichette delle città rispetto al segnaposto. */
const LABEL: Record<string, [number, number, number]> = {
  napoli: [8, 2, 0],
  bari: [8, -2, 0],
  palermo: [0, -12, 0.5],
  cagliari: [-8, 2, 1],
  roma: [8, 0, 0],
  firenze: [-8, 2, 1],
  bologna: [8, -2, 0],
  venezia: [8, 0, 0],
  torino: [0, 12, 0.5],
  milano: [0, -12, 0.5],
};

interface SceneData {
  celebrate?: number;
}

/** Quartiere contro Città: creazione della squadra e mappa della conquista. */
export class ConquistaScene extends Phaser.Scene {
  private draft!: CqCaptain;
  private kit = 0;
  private diff: Difficulty = 'facile';
  private control: CqControl = 'solo';
  private confirmReset = false;
  private selected = -1;
  private celebrate?: number;

  constructor() {
    super('conquista');
  }

  init(d: SceneData) {
    this.celebrate = d?.celebrate;
  }

  create() {
    this.draft = {
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      number: 10,
      look: { skin: Math.floor(Math.random() * SKIN.length), hair: Math.floor(Math.random() * 5), hairStyle: 0 },
    };
    const d = load().settings.difficulty as Difficulty;
    this.diff = DIFFS.includes(d) ? d : 'facile';
    this.confirmReset = false;
    this.selected = -1;
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.tweens.killAll();
    this.children.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.88).setOrigin(0).setInteractive();
    const q = load().conquista;
    if (!q) this.buildCreate(W, H);
    else this.buildMap(q, W, H);
  }

  // ---------- creazione della squadra ----------
  private buildCreate(W: number, H: number) {
    shadowTxt(this, W / 2, 18, 'QUARTIERE VS CITTÀ', 16, '#ffd23f');
    txt(this, W / 2, 38, 'Il campetto di Vicolo Stella sta per diventare un parcheggio.', 6, '#d8dcf0');
    txt(this, W / 2, 50, 'Salvalo: conquista l\'Italia città per città.', 6, '#d8dcf0');

    const fake = newConquista({ ...this.draft }, this.kit, this.diff);
    const team = vicoloTeam(fake);
    const g = this.add.graphics();
    const lx = Math.max(16, W / 2 - 274);
    panel(g, lx, 64, 236, 214, 0x1b1d2e, KITS[this.kit].colors.shirt, 0.92);
    txt(this, lx + 118, 78, 'VICOLO STELLA', 8, '#ffffff');
    // la squadra: capitano davanti, compagni dietro
    const mates = [0, 1, 2, 3];
    mates.forEach((i, k) => {
      const key = `cq_mate_${i}`;
      makePlayerSheet(this, key, team, team.players[i]);
      const x = lx + 34 + k * 56;
      this.add.image(x, 140, key, frameIndex('down', 'idle')).setScale(2).setOrigin(0.5, 1).setTint(0xb0b0c8);
      txt(this, x, 148, team.players[i].name, 6, '#8a8fb0');
    });
    makePlayerSheet(this, 'cq_cap_prev', team, team.players[4]);
    const img = this.add.image(lx + 118, 252, 'cq_cap_prev', frameIndex('down', 'idle')).setScale(4).setOrigin(0.5, 1);
    this.tweens.add({ targets: img, y: 248, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    txt(this, lx + 118, 266, `CAP. ${this.draft.name.toUpperCase()}  N. ${this.draft.number}`, 6, '#ffd23f');

    const rx = lx + 236 + 30 + 120;
    const row = (y: number, label: string, value: string, change: (d: -1 | 1) => void) => {
      txt(this, rx - 116, y, label, 6, '#8a8fb0').setOrigin(0, 0.5);
      txt(this, rx + 34, y, value, 6, '#ffffff');
      arrow(this, rx - 30, y, -1, () => {
        change(-1);
        sfx.select();
        this.build();
      });
      arrow(this, rx + 98, y, 1, () => {
        change(1);
        sfx.select();
        this.build();
      });
    };
    const cyc = (v: number, n: number, d: number) => (v + d + n) % n;
    txt(this, rx - 116, 72, 'CAPITANO', 6, '#8a8fb0').setOrigin(0, 0.5);
    button(this, rx + 34, 72, 140, 22, this.draft.name.toUpperCase(), () => {
      askName(this.draft.name, 12, 'NOME DEL CAPITANO').then((n) => {
        if (n) this.draft.name = n;
        if (this.scene.isActive()) this.build();
      });
    }, { size: 8, color: 0x2f6fd0 });
    row(102, 'DIVISA', KITS[this.kit].name, (d) => (this.kit = cyc(this.kit, KITS.length, d)));
    const L = this.draft.look;
    row(130, 'PELLE', `${L.skin + 1}/${SKIN.length}`, (d) => (L.skin = cyc(L.skin, SKIN.length, d)));
    row(158, 'CAPELLI', `${L.hair + 1}/${HAIR.length}`, (d) => (L.hair = cyc(L.hair, HAIR.length, d)));
    row(186, 'NUMERO', String(this.draft.number), (d) => {
      const i = HERO_NUMBERS.indexOf(this.draft.number);
      this.draft.number = HERO_NUMBERS[cyc(Math.max(0, i), HERO_NUMBERS.length, d)];
    });
    txt(this, rx - 116, 216, 'CPU', 6, '#8a8fb0').setOrigin(0, 0.5);
    const bs: Button[] = [];
    DIFFS.forEach((d, i) => {
      const b = button(this, rx - 44 + i * 70, 216, 64, 20, d.toUpperCase(), () => {
        this.diff = d;
        bs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(d === this.diff);
      bs.push(b);
    });
    txt(this, rx - 116, 246, 'CONTROLLI', 6, '#8a8fb0').setOrigin(0, 0.5);
    const cs: Button[] = [];
    (['solo', 'squadra'] as const).forEach((k, i) => {
      const b = button(this, rx - 9 + i * 105, 246, 99, 20, k === 'solo' ? 'SOLO CAPITANO' : 'TUTTA LA SQUADRA', () => {
        this.control = k;
        cs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(k === this.control);
      cs.push(b);
    });

    button(this, 64, H - 28, 96, 28, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const go = button(this, W - 110, H - 30, 190, 34, 'INIZIA LA SAGA', () => {
      const q = newConquista({ ...this.draft, look: { ...this.draft.look } }, this.kit, this.diff, this.control);
      save((s) => (s.conquista = q));
      sfx.select();
      backToScene(this, 'story', { lines: CITIES[0].before, step: 0, then: 'match', saga: 'conquista' });
    }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
    this.tweens.add({ targets: go.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- mappa ----------
  private buildMap(q: ConquistaState, W: number, H: number) {
    const k = KITS[q.kit] ?? KITS[0];
    const owned = conquered(q);
    // durante la festa la città appena presa si colora dopo l'animazione
    const celebrating = this.celebrate !== undefined && this.celebrate < owned;
    const shownOwned = celebrating ? this.celebrate! : owned;
    if (this.selected < 0) this.selected = celebrating ? this.celebrate! : Math.min(q.step, CITIES.length - 1);

    const mw = MAP_COLS * S;
    const mh = MAP_ROWS * S;
    const scale = Math.min(1, (H - 16) / mh);
    const mx = 8;
    const my = Math.round((H - mh * scale) / 2);
    const key = `italy_${shownOwned}_${q.kit}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawItaly(CITIES, shownOwned, k.colors.shirt, k.colors.shirt2));
    const map = this.add.image(mx, my, key).setOrigin(0).setScale(S * scale);
    const toScreen = (i: number) => {
      const p = project(CITIES[i].lon, CITIES[i].lat);
      return { x: mx + p.x * S * scale, y: my + p.y * S * scale };
    };
    if (celebrating) {
      const after = `italy_${owned}_${q.kit}`;
      if (!this.textures.exists(after)) this.textures.addCanvas(after, drawItaly(CITIES, owned, k.colors.shirt, k.colors.shirt2));
      const top = this.add.image(mx, my, after).setOrigin(0).setScale(S * scale).setAlpha(0);
      this.tweens.add({ targets: top, alpha: 1, delay: 700, duration: 500, onComplete: () => map.setVisible(false) });
    }

    txt(this, mx + 6, my + 8, `CONQUISTATE ${owned}/${CITIES.length}`, 6, '#ffd23f').setOrigin(0, 0.5);

    // percorso già fatto
    const g = this.add.graphics();
    for (let i = 0; i < Math.min(owned, CITIES.length - 1); i++) {
      const a = toScreen(i);
      const b = toScreen(i + 1);
      const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 6));
      const done = i + 1 < owned || (i + 1 === owned && owned === CITIES.length);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        g.fillStyle(done ? 0xffd23f : 0xffffff, done ? 0.9 : 0.5).fillRect(Math.round(a.x + (b.x - a.x) * t) - 1, Math.round(a.y + (b.y - a.y) * t) - 1, 2, 2);
      }
    }

    // segnaposto delle città
    CITIES.forEach((c, i) => {
      const p = toScreen(i);
      const isOwned = i < owned;
      const isNext = i === q.step && !q.finished;
      const locked = !isOwned && !isNext;
      const m = this.add.graphics();
      if (isOwned) {
        // bandierina con i colori della squadra
        const flag = this.add.container(p.x, p.y);
        const fg = this.add.graphics();
        fg.fillStyle(0x1a1222).fillRect(-1, -14, 3, 15);
        fg.fillStyle(0xe8e8e8).fillRect(0, -14, 1, 14);
        fg.fillStyle(0x1a1222).fillRect(1, -15, 12, 9);
        fg.fillStyle(k.colors.shirt).fillRect(2, -14, 10, 7);
        fg.fillStyle(k.colors.shirt2).fillRect(6, -12, 2, 3);
        fg.fillStyle(0x1a1222, 0.5).fillRect(-3, 0, 7, 2);
        flag.add(fg);
        if (celebrating && i === this.celebrate) {
          flag.y -= 60;
          flag.setAlpha(0);
          this.tweens.add({ targets: flag, y: p.y, alpha: 1, duration: 600, delay: 250, ease: 'Bounce.easeOut', onStart: () => sfx.fanfare() });
        }
      } else if (isNext) {
        m.fillStyle(0x1a1222).fillRect(p.x - 4, p.y - 4, 8, 8);
        m.fillStyle(0xffd23f).fillRect(p.x - 3, p.y - 3, 6, 6);
        const ring = this.add.graphics();
        ring.lineStyle(2, 0xffd23f, 1).strokeRect(-7, -7, 14, 14);
        ring.setPosition(p.x, p.y);
        this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 900, repeat: -1 });
        const ball = this.add.image(p.x, p.y - 12, 'ball').setScale(1);
        this.tweens.add({ targets: ball, y: p.y - 20, duration: 320, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
      } else {
        m.fillStyle(0x1a1222).fillRect(p.x - 3, p.y - 3, 6, 6);
        m.fillStyle(0x8a8fa0).fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      const [ox, oy, org] = LABEL[c.id] ?? [8, 0, 0];
      const lab = txt(this, p.x + ox, p.y + oy, c.name, 6, i === this.selected ? '#ffd23f' : locked ? '#8a8fb0' : '#ffffff', {
        stroke: '#1a1222',
        strokeThickness: 3,
      });
      lab.setOrigin(org, 0.5);
      // tocco sulla città: si vedono i dettagli (anche quelle future)
      const z = this.add.zone(p.x, p.y, 30, 26).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (this.selected === i) return;
        this.selected = i;
        this.celebrate = undefined;
        sfx.select();
        this.build();
      });
    });

    if (celebrating) {
      const c = CITIES[this.celebrate!];
      const banner = shadowTxt(this, mx + (mw * scale) / 2, H / 2 - 20, `${c.name} È VOSTRA!`, 16, '#ffd23f', '#a0381e', 3);
      banner.c.setScale(0.3).setAlpha(0);
      this.tweens.add({ targets: banner.c, scale: 1, alpha: 1, delay: 800, duration: 450, ease: 'Back.easeOut' });
      this.tweens.add({ targets: banner.c, alpha: 0, delay: 2600, duration: 500 });
      this.celebrate = undefined;
    }

    this.buildPanel(q, mx + mw * scale + 10, W, H);
  }

  private buildPanel(q: ConquistaState, rx: number, W: number, H: number) {
    const g = this.add.graphics();
    const rw = W - rx - 10;
    const rcx = rx + rw / 2;
    const i = this.selected;
    const c = CITIES[i];
    const owned = conquered(q);
    const isOwned = i < owned;
    const isNext = i === q.step && !q.finished;
    panel(g, rx, 10, rw, 290, 0x1b1d2e, isOwned ? COLORS.good : isNext ? COLORS.accent : 0x3a3d55, 0.95);

    if (q.finished && i === CITIES.length - 1) {
      shadowTxt(this, rcx, 36, 'L\'ITALIA È VOSTRA', 8, '#ffd23f');
      txt(this, rcx, 56, 'Il campetto di Vicolo Stella è salvo!', 6, '#ffffff', { wordWrap: { width: rw - 16 }, align: 'center' });
      const mine = vicoloTeam(q, CITIES.length);
      makePlayerSheet(this, 'cq_cap_hub', mine, mine.players[4]);
      this.add.image(rcx, 136, 'cq_cap_hub', frameIndex('down', 'celebrate')).setScale(3).setOrigin(0.5, 1);
      txt(this, rcx, 152, `Partite ${q.apps} · Vittorie ${q.wins}`, 6, '#d8dcf0');
      txt(this, rcx, 168, `Gol fatti ${q.goalsFor} · subiti ${q.goalsAgainst}`, 6, '#d8dcf0');
      txt(this, rcx, 192, 'Tocca le città per rivedere', 6, '#8a8fb0');
      txt(this, rcx, 204, 'le tappe e i ricordi.', 6, '#8a8fb0');
      button(this, rcx, 240, Math.min(200, rw - 20), 28, 'RIGUARDA IL FINALE', () => {
        backToScene(this, 'story', { lines: c.win, step: i, then: 'conquista', saga: 'conquista' });
      }, { size: 6, color: 0x8a3fd0 });
    } else {
      txt(this, rcx, 24, `TAPPA ${i + 1}/${CITIES.length}`, 6, '#8a8fb0');
      shadowTxt(this, rcx, 42, c.name, 16, isOwned ? '#5be37d' : '#ffffff');
      txt(this, rcx, 62, c.place, 6, '#3fd0ff', { wordWrap: { width: rw - 16 }, align: 'center' });
      const mine = vicoloTeam(q, i);
      const opp = cityTeam(q, i);
      const drawTeam = (x: number, colors: { shirt: number; shirt2: number }, label: string) => {
        g.fillStyle(0x1a1222).fillRect(x - 12, 76, 24, 24);
        g.fillStyle(colors.shirt).fillRect(x - 10, 78, 20, 20);
        g.fillStyle(colors.shirt2).fillRect(x - 3, 78, 6, 20);
        txt(this, x, 108, label, 6, '#ffffff');
      };
      drawTeam(rcx - 52, mine.colors, mine.short);
      txt(this, rcx, 88, 'VS', 8, '#ffd23f');
      drawTeam(rcx + 52, opp.colors, opp.short);
      txt(this, rcx, 124, opp.name, 6, '#d8dcf0');
      txt(this, rcx, 138, `Capitano: ${c.captain.name} · Forza ${opp.stars}/5`, 6, '#8a8fb0');
      txt(this, rcx, 152, `Campo: ${PITCHES[c.pitch].name}`, 6, '#8a8fb0');
      g.fillStyle(0x0d0a1a, 0.8).fillRect(rx + 8, 164, rw - 16, 32);
      txt(this, rcx, 173, 'OBIETTIVO', 6, '#5be37d');
      txt(this, rcx, 187, c.startScore ? `${CQ_GOAL_TEXT[c.goal]} (si parte 0-1)` : CQ_GOAL_TEXT[c.goal], 6, '#ffffff', { wordWrap: { width: rw - 24 }, align: 'center' });
      // ricordo della città
      const sv = c.souvenir;
      g.fillStyle(isOwned ? 0xff7ab8 : 0x2e3250).fillRect(rx + 12, 206, 8, 8);
      txt(this, rx + 26, 210, isOwned ? sv.name : `RICORDO: ${locked(i, q) ? '???' : sv.name}`, 6, isOwned ? '#ff7ab8' : '#d8dcf0').setOrigin(0, 0.5);
      txt(this, rx + 26, 224, locked(i, q) ? 'Si scopre arrivando in città.' : sv.desc, 6, '#8a8fb0', { wordWrap: { width: rw - 34 } }).setOrigin(0, 0.5);

      if (isNext) {
        const play = button(this, rcx, 262, Math.min(170, rw - 20), 28, i === CITIES.length - 1 ? 'GIOCA LA FINALE' : 'GIOCA', () => {
          sfx.select();
          backToScene(this, 'story', { lines: c.before, step: i, then: 'match', saga: 'conquista' });
        }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
        this.tweens.add({ targets: play.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else if (isOwned) {
        txt(this, rcx, 246, 'CONQUISTATA!', 8, '#5be37d');
        button(this, rcx, 270, Math.min(170, rw - 20), 22, 'RIVEDI LA STORIA', () => {
          backToScene(this, 'story', { lines: [...c.before.filter((l) => l.who !== 'title'), ...c.win], step: i, then: 'conquista', saga: 'conquista' });
        }, { size: 6, color: 0x8a3fd0 });
      } else {
        txt(this, rcx, 258, 'Conquista prima', 6, '#8a8fb0');
        txt(this, rcx, 272, `${CITIES[q.step].name}!`, 6, '#ffd23f');
      }
    }

    const by = H - 26;
    button(this, rx + 34, by + 4, 60, 24, 'MENU', () => backToMenu(this), { color: 0x3a3d55, size: 6 });
    const solo = q.control !== 'squadra';
    button(this, rcx - 2, by + 4, Math.min(100, rw - 170), 24, solo ? 'SOLO CAP.' : 'SQUADRA', () => {
      save((s) => {
        if (s.conquista) s.conquista.control = s.conquista.control === 'squadra' ? 'solo' : 'squadra';
      });
      sfx.select();
      this.build();
    }, { size: 6, color: solo ? 0x8a3fd0 : 0x2f6fd0 });
    button(this, rx + rw - 36, by + 4, 64, 24, this.confirmReset ? 'SICURO?' : 'NUOVA', () => {
      if (!this.confirmReset) {
        this.confirmReset = true;
        this.build();
        return;
      }
      this.confirmReset = false;
      this.selected = -1;
      save((s) => delete s.conquista);
      this.build();
    }, { size: 6, color: this.confirmReset ? 0x8a3040 : 0x3a3d55 });
  }
}

/** Le città oltre la prossima tappa non svelano ancora il loro ricordo. */
function locked(i: number, q: ConquistaState): boolean {
  return i > q.step;
}
