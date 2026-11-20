import Phaser from 'phaser';
import { arrow, button, COLORS, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { load, save } from '../save/storage';
import { frameIndex, HAIR, makePlayerSheet, SKIN } from '../gfx/sprites';
import type { Difficulty } from '../sim/types';
import { HERO_NAMES, HERO_NUMBERS } from '../modes/career';
import {
  newWorldTour, WORLD_STAGES, WT_GOAL_TEXT, WT_KITS, wtConquered, wtOppTeam, wtTeam,
  type WorldTourState, type WtCaptain, type WtControl,
} from '../modes/worldTour';
import { PITCHES } from '../data/pitches';
import { backToMenu, backToScene } from './demo';
import { askName } from '../ui/nameInput';
import { sfx } from '../audio/sfx';

const NAMES = HERO_NAMES.filter((n) => !['Lila', 'Taro', 'Jude', 'Rico'].includes(n));
const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];

/** Contorni stilizzati dei continenti sulla mappa pixelata (x, y, w, h normalizzati 0..1). */
const CONTINENTS: [number, number, number, number][] = [
  // Nord America
  [0.08, 0.14, 0.20, 0.24],
  [0.14, 0.36, 0.10, 0.14],
  // Sud America
  [0.21, 0.52, 0.14, 0.34],
  [0.24, 0.84, 0.06, 0.08],
  // Groenlandia / Islanda
  [0.32, 0.08, 0.08, 0.10],
  // Europa
  [0.41, 0.16, 0.14, 0.20],
  // Africa
  [0.42, 0.39, 0.16, 0.34],
  [0.48, 0.72, 0.06, 0.10],
  // Asia
  [0.55, 0.15, 0.34, 0.30],
  [0.78, 0.44, 0.09, 0.12],
  // Oceania
  [0.77, 0.65, 0.14, 0.16],
];

const LABEL_POS: Record<string, [number, number, number]> = {
  barcellona: [8, 8, 0],
  londra: [-8, -6, 1],
  tokyo: [-8, 0, 1],
  rio: [8, 0, 0],
  reykjavik: [8, -4, 0],
  buenosaires: [8, 4, 0],
};

interface SceneData {
  celebrate?: number;
}

/** Street World Tour: creazione squadra e mappa mondiale in 6 tappe. */
export class WorldTourScene extends Phaser.Scene {
  private teamName = 'Street Stars';
  private draft!: WtCaptain;
  private kit = 0;
  private diff: Difficulty = 'normale';
  private control: WtControl = 'squadra';
  private confirmReset = false;
  private selected = -1;
  private celebrate?: number;

  constructor() {
    super('worldtour');
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
    this.diff = DIFFS.includes(d) ? d : 'normale';
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
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.9).setOrigin(0).setInteractive();
    const wt = load().worldTour;
    if (!wt) this.buildCreate(W, H);
    else this.buildMap(wt, W, H);
  }

  private buildCreate(W: number, H: number) {
    shadowTxt(this, W / 2, 18, 'STREET WORLD TOUR', 16, '#ffd23f');
    txt(this, W / 2, 38, 'Sei tappe folli intorno al mondo tra flipper, fango e vulcani.', 6, '#3fd0ff');

    const fake = newWorldTour(this.teamName, { ...this.draft }, this.kit, this.diff, this.control);
    const team = wtTeam(fake);
    const g = this.add.graphics();
    const lx = Math.max(16, W / 2 - 274);
    panel(g, lx, 56, 236, 224, 0x1b1d2e, WT_KITS[this.kit].colors.shirt2, 0.94);
    txt(this, lx + 118, 70, this.teamName.toUpperCase(), 8, '#ffffff');
    [0, 1, 2, 3].forEach((i, k) => {
      const key = `wt_mate_${i}`;
      makePlayerSheet(this, key, team, team.players[i]);
      const x = lx + 34 + k * 56;
      this.add.image(x, 134, key, frameIndex('down', 'idle')).setScale(2).setOrigin(0.5, 1).setTint(0xb0b0c8);
      txt(this, x, 142, team.players[i].name, 6, '#8a8fb0');
    });
    makePlayerSheet(this, 'wt_cap_prev', team, team.players[4]);
    const img = this.add.image(lx + 118, 246, 'wt_cap_prev', frameIndex('down', 'idle')).setScale(4).setOrigin(0.5, 1);
    this.tweens.add({ targets: img, y: 242, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    txt(this, lx + 118, 262, `CAP. ${this.draft.name.toUpperCase()}  N. ${this.draft.number}`, 6, '#ffd23f');

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
    txt(this, rx - 116, 66, 'CLUB', 6, '#8a8fb0').setOrigin(0, 0.5);
    button(this, rx + 34, 66, 140, 20, this.teamName.toUpperCase(), () => {
      askName(this.teamName, 14, 'NOME DELLA SQUADRA').then((n) => {
        if (n) this.teamName = n;
        if (this.scene.isActive()) this.build();
      });
    }, { size: 7, color: 0x2f9a8a });
    txt(this, rx - 116, 92, 'CAPITANO', 6, '#8a8fb0').setOrigin(0, 0.5);
    button(this, rx + 34, 92, 140, 20, this.draft.name.toUpperCase(), () => {
      askName(this.draft.name, 12, 'NOME DEL CAPITANO').then((n) => {
        if (n) this.draft.name = n;
        if (this.scene.isActive()) this.build();
      });
    }, { size: 7, color: 0x2f6fd0 });
    row(118, 'DIVISA', WT_KITS[this.kit].name, (d) => (this.kit = cyc(this.kit, WT_KITS.length, d)));
    const L = this.draft.look;
    row(144, 'PELLE', `${L.skin + 1}/${SKIN.length}`, (d) => (L.skin = cyc(L.skin, SKIN.length, d)));
    row(170, 'CAPELLI', `${L.hair + 1}/${HAIR.length}`, (d) => (L.hair = cyc(L.hair, HAIR.length, d)));
    row(196, 'NUMERO', String(this.draft.number), (d) => {
      const i = HERO_NUMBERS.indexOf(this.draft.number);
      this.draft.number = HERO_NUMBERS[cyc(Math.max(0, i), HERO_NUMBERS.length, d)];
    });
    txt(this, rx - 116, 224, 'CPU', 6, '#8a8fb0').setOrigin(0, 0.5);
    const bs: Button[] = [];
    DIFFS.forEach((d, i) => {
      const b = button(this, rx - 44 + i * 70, 224, 64, 20, d.toUpperCase(), () => {
        this.diff = d;
        bs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(d === this.diff);
      bs.push(b);
    });
    txt(this, rx - 116, 252, 'CONTROLLI', 6, '#8a8fb0').setOrigin(0, 0.5);
    const cs: Button[] = [];
    (['squadra', 'solo'] as const).forEach((k, i) => {
      const b = button(this, rx - 9 + i * 105, 252, 99, 20, k === 'squadra' ? 'TUTTA LA SQUADRA' : 'SOLO CAPITANO', () => {
        this.control = k;
        cs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(k === this.control);
      cs.push(b);
    });

    button(this, 64, H - 28, 96, 28, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const go = button(this, W - 118, H - 30, 206, 34, 'PARTI PER IL TOUR', () => {
      const wt = newWorldTour(this.teamName, { ...this.draft, look: { ...this.draft.look } }, this.kit, this.diff, this.control);
      save((s) => (s.worldTour = wt));
      sfx.select();
      backToScene(this, 'story', { lines: WORLD_STAGES[0].before, step: 0, then: 'match', saga: 'worldtour' });
    }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
    this.tweens.add({ targets: go.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private buildMap(wt: WorldTourState, W: number, H: number) {
    const k = WT_KITS[wt.kit] ?? WT_KITS[0];
    const owned = wtConquered(wt);
    if (this.selected < 0) this.selected = this.celebrate !== undefined && this.celebrate < owned ? this.celebrate : Math.min(wt.step, WORLD_STAGES.length - 1);

    const mw = Math.min(310, W * 0.52);
    const mh = H - 36;
    const mx = 10;
    const my = 18;
    const g = this.add.graphics();
    // cornice stile radar mondiale
    panel(g, mx, my, mw, mh, 0x101c34, 0x2e4570, 0.96);
    for (let x = mx + 20; x < mx + mw; x += 28) g.fillStyle(0x1f355c, 0.35).fillRect(x, my + 2, 1, mh - 4);
    for (let y = my + 20; y < my + mh; y += 28) g.fillStyle(0x1f355c, 0.35).fillRect(mx + 2, y, mw - 4, 1);
    for (const [cx, cy, cw, ch] of CONTINENTS) {
      const rx = Math.round(mx + cx * mw);
      const ry = Math.round(my + cy * mh);
      const rw = Math.round(cw * mw);
      const rh = Math.round(ch * mh);
      g.fillStyle(0x1a2a24, 0.9).fillRect(rx + 2, ry + 2, rw, rh);
      g.fillStyle(0x2e5e46, 0.95).fillRect(rx, ry, rw, rh);
      g.fillStyle(0x3f7b5a, 0.6).fillRect(rx, ry, rw, 2);
    }

    txt(this, mx + 10, my + 12, `STREET WORLD TOUR · ${owned}/${WORLD_STAGES.length}`, 6, '#ffd23f').setOrigin(0, 0.5);

    const pt = (i: number) => ({
      x: Math.round(mx + WORLD_STAGES[i].mx * mw),
      y: Math.round(my + WORLD_STAGES[i].my * mh),
    });

    // rotta aerea tratteggiata tra le tappe
    for (let i = 0; i < WORLD_STAGES.length - 1; i++) {
      const a = pt(i);
      const b = pt(i + 1);
      const steps = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 7));
      const done = i < owned;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        g.fillStyle(done ? 0xffd23f : 0x5d7aa8, done ? 0.9 : 0.45).fillRect(Math.round(a.x + (b.x - a.x) * t) - 1, Math.round(a.y + (b.y - a.y) * t) - 1, 2, 2);
      }
    }

    WORLD_STAGES.forEach((st, i) => {
      const p = pt(i);
      const isOwned = i < owned;
      const isNext = i === wt.step && !wt.finished;
      const locked = !isOwned && !isNext;
      if (isOwned) {
        const fg = this.add.graphics();
        fg.fillStyle(0x1a1222).fillRect(p.x - 1, p.y - 14, 3, 15);
        fg.fillStyle(0xe8e8e8).fillRect(p.x, p.y - 14, 1, 14);
        fg.fillStyle(0x1a1222).fillRect(p.x + 1, p.y - 15, 11, 8);
        fg.fillStyle(k.colors.shirt).fillRect(p.x + 2, p.y - 14, 9, 6);
        fg.fillStyle(k.colors.shirt2).fillRect(p.x + 5, p.y - 12, 3, 2);
      } else if (isNext) {
        g.fillStyle(0x1a1222).fillRect(p.x - 4, p.y - 4, 8, 8);
        g.fillStyle(0xffd23f).fillRect(p.x - 3, p.y - 3, 6, 6);
        const ring = this.add.graphics();
        ring.lineStyle(2, 0xffd23f, 1).strokeRect(-7, -7, 14, 14);
        ring.setPosition(p.x, p.y);
        this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 900, repeat: -1 });
        const ball = this.add.image(p.x, p.y - 12, 'ball').setScale(1);
        this.tweens.add({ targets: ball, y: p.y - 20, duration: 320, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
      } else {
        g.fillStyle(0x1a1222).fillRect(p.x - 3, p.y - 3, 6, 6);
        g.fillStyle(0x7c8aa6).fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      const [ox, oy, org] = LABEL_POS[st.id] ?? [8, 0, 0];
      txt(this, p.x + ox, p.y + oy, st.name, 6, i === this.selected ? '#ffd23f' : locked ? '#7c8aa6' : '#ffffff', {
        stroke: '#101c34',
        strokeThickness: 3,
      }).setOrigin(org, 0.5);
      const z = this.add.zone(p.x, p.y, 32, 26).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (this.selected === i) return;
        this.selected = i;
        this.celebrate = undefined;
        sfx.select();
        this.build();
      });
    });

    if (this.celebrate !== undefined && this.celebrate < owned) {
      const st = WORLD_STAGES[this.celebrate];
      const banner = shadowTxt(this, mx + mw / 2, H / 2 - 20, `${st.name} SUPERATA!`, 14, '#ffd23f', '#a0381e', 3);
      banner.c.setScale(0.3).setAlpha(0);
      this.tweens.add({ targets: banner.c, scale: 1, alpha: 1, delay: 250, duration: 400, ease: 'Back.easeOut' });
      this.tweens.add({ targets: banner.c, alpha: 0, delay: 2100, duration: 450 });
      this.celebrate = undefined;
    }

    this.buildPanel(wt, mx + mw + 10, W, H);
  }

  private buildPanel(wt: WorldTourState, rx: number, W: number, H: number) {
    const g = this.add.graphics();
    const rw = W - rx - 10;
    const rcx = rx + rw / 2;
    const i = this.selected;
    const st = WORLD_STAGES[i];
    const owned = wtConquered(wt);
    const isOwned = i < owned;
    const isNext = i === wt.step && !wt.finished;
    panel(g, rx, 10, rw, 290, 0x1b1d2e, isOwned ? COLORS.good : isNext ? COLORS.accent : 0x3a3d55, 0.95);

    if (wt.finished && i === WORLD_STAGES.length - 1) {
      shadowTxt(this, rcx, 34, 'CAMPIONI DEL MONDO!', 8, '#ffd23f');
      txt(this, rcx, 54, `${wt.teamName} ha conquistato il World Tour!`, 6, '#ffffff', { wordWrap: { width: rw - 16 }, align: 'center' });
      const mine = wtTeam(wt, WORLD_STAGES.length);
      makePlayerSheet(this, 'wt_cap_hub', mine, mine.players[4]);
      this.add.image(rcx, 134, 'wt_cap_hub', frameIndex('down', 'celebrate')).setScale(3).setOrigin(0.5, 1);
      txt(this, rcx, 152, `Partite ${wt.apps} · Vittorie ${wt.wins}`, 6, '#d8dcf0');
      txt(this, rcx, 168, `Gol fatti ${wt.goalsFor} · subiti ${wt.goalsAgainst}`, 6, '#d8dcf0');
      txt(this, rcx, 194, 'Tocca una città sulla mappa', 6, '#8a8fb0');
      txt(this, rcx, 206, 'per rivedere tappe e souvenir.', 6, '#8a8fb0');
      button(this, rcx, 242, Math.min(200, rw - 20), 28, 'RIGUARDA IL FINALE', () => {
        backToScene(this, 'story', { lines: st.win, step: i, then: 'worldtour', saga: 'worldtour' });
      }, { size: 6, color: 0x8a3fd0 });
    } else {
      txt(this, rcx, 24, `TAPPA ${i + 1}/${WORLD_STAGES.length} · ${st.country.toUpperCase()}`, 6, '#8a8fb0');
      shadowTxt(this, rcx, 42, st.name, 14, isOwned ? '#5be37d' : '#ffffff');
      txt(this, rcx, 60, st.place, 6, '#3fd0ff', { wordWrap: { width: rw - 16 }, align: 'center' });
      const mine = wtTeam(wt, i);
      const opp = wtOppTeam(wt, i);
      const drawTeam = (x: number, colors: { shirt: number; shirt2: number }, label: string) => {
        g.fillStyle(0x1a1222).fillRect(x - 12, 74, 24, 24);
        g.fillStyle(colors.shirt).fillRect(x - 10, 76, 20, 20);
        g.fillStyle(colors.shirt2).fillRect(x - 3, 76, 6, 20);
        txt(this, x, 106, label, 6, '#ffffff');
      };
      drawTeam(rcx - 52, mine.colors, mine.short);
      txt(this, rcx, 86, 'VS', 8, '#ffd23f');
      drawTeam(rcx + 52, opp.colors, opp.short);
      txt(this, rcx, 122, `${opp.name} · Cap. ${st.captain.name}`, 6, '#d8dcf0');
      const conds = [
        PITCHES[st.pitch].name,
        st.weather === 'pioggia' ? 'Pioggia' : '',
        st.night ? 'Notte' : '',
        st.mods?.superMult ? `Super x${st.mods.superMult}` : '',
        st.mods?.staminaMult === 0 ? 'Scatto inf.' : '',
      ].filter(Boolean).join(' · ');
      txt(this, rcx, 138, conds, 6, '#8a8fb0', { wordWrap: { width: rw - 16 }, align: 'center' });
      g.fillStyle(0x0d0a1a, 0.8).fillRect(rx + 8, 156, rw - 16, 34);
      txt(this, rcx, 165, 'OBIETTIVO', 6, '#5be37d');
      txt(this, rcx, 180, st.startScore ? `${WT_GOAL_TEXT[st.goal]} (si parte 0-1)` : WT_GOAL_TEXT[st.goal], 6, '#ffffff', { wordWrap: { width: rw - 24 }, align: 'center' });

      const sv = st.souvenir;
      const locked = i > wt.step;
      g.fillStyle(isOwned ? 0xff7ab8 : 0x2e3250).fillRect(rx + 12, 202, 8, 8);
      txt(this, rx + 26, 206, isOwned ? sv.name : `SOUVENIR: ${locked ? '???' : sv.name}`, 6, isOwned ? '#ff7ab8' : '#d8dcf0').setOrigin(0, 0.5);
      txt(this, rx + 26, 222, locked ? 'Si scopre raggiungendo la tappa.' : sv.desc, 6, '#8a8fb0', { wordWrap: { width: rw - 34 } }).setOrigin(0, 0.5);

      if (isNext) {
        const play = button(this, rcx, 262, Math.min(180, rw - 20), 28, i === WORLD_STAGES.length - 1 ? 'GIOCA LA FINALE' : 'GIOCA', () => {
          sfx.select();
          backToScene(this, 'story', { lines: st.before, step: i, then: 'match', saga: 'worldtour' });
        }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
        this.tweens.add({ targets: play.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else if (isOwned) {
        txt(this, rcx, 246, 'TAPPA VINTA!', 8, '#5be37d');
        button(this, rcx, 270, Math.min(170, rw - 20), 22, 'RIVEDI LA STORIA', () => {
          backToScene(this, 'story', { lines: [...st.before.filter((l) => l.who !== 'title'), ...st.win], step: i, then: 'worldtour', saga: 'worldtour' });
        }, { size: 6, color: 0x8a3fd0 });
      } else {
        txt(this, rcx, 258, 'Supera prima', 6, '#8a8fb0');
        txt(this, rcx, 272, `${WORLD_STAGES[wt.step].name}!`, 6, '#ffd23f');
      }
    }

    const by = H - 26;
    button(this, rx + 34, by + 4, 60, 24, 'MENU', () => backToMenu(this), { color: 0x3a3d55, size: 6 });
    const solo = wt.control === 'solo';
    button(this, rcx - 2, by + 4, Math.min(100, rw - 170), 24, solo ? 'SOLO CAP.' : 'SQUADRA', () => {
      save((s) => {
        if (s.worldTour) s.worldTour.control = s.worldTour.control === 'squadra' ? 'solo' : 'squadra';
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
      save((s) => delete s.worldTour);
      this.build();
    }, { size: 6, color: this.confirmReset ? 0x8a3040 : 0x3a3d55 });
  }
}
