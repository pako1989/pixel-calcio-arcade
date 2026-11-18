import Phaser from 'phaser';
import { arrow, button, COLORS, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { load, save } from '../save/storage';
import { frameIndex, HAIR, makePlayerSheet, SKIN } from '../gfx/sprites';
import type { Difficulty } from '../sim/types';
import {
  ATTRS, clubById, GOAL_TEXT, heroDef, HERO_NAMES, HERO_NUMBERS, MAX_LEVEL, newCareer, PERKS, STORY,
  teamsFor, type CareerControl, type CareerState, type Hero,
} from '../modes/career';
import { PITCHES } from '../data/pitches';
import { backToMenu, backToScene } from './demo';
import { askName } from '../ui/nameInput';
import { sfx } from '../audio/sfx';

const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];
const STYLE_NAMES = ['CORTI', 'RASATI', 'LUNGHI', 'CIUFFO'];

/** "Diventa un mito": creazione del campione e pagina della carriera. */
export class CareerScene extends Phaser.Scene {
  private draft!: Hero;
  private diff: Difficulty = 'facile';
  private control: CareerControl = 'solo';
  private confirmReset = false;

  constructor() {
    super('career');
  }

  create() {
    this.draft = {
      name: HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)],
      number: 10,
      look: { skin: Math.floor(Math.random() * SKIN.length), hair: Math.floor(Math.random() * 5), hairStyle: 0 },
    };
    const d = load().settings.difficulty as Difficulty;
    this.diff = DIFFS.includes(d) ? d : 'facile';
    this.confirmReset = false;
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.children.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.84).setOrigin(0).setInteractive();
    const c = load().career;
    if (!c) this.buildCreate(W, H);
    else this.buildHub(c, W, H);
  }

  // ---------- creazione ----------
  private buildCreate(W: number, H: number) {
    shadowTxt(this, W / 2, 18, 'CREA IL TUO CAMPIONE', 16, '#ffd23f');
    txt(this, W / 2, 38, 'Dal campetto di quartiere alla finale di Coppa.', 6, '#d8dcf0');

    // anteprima
    const px = W / 2 - 150;
    const g = this.add.graphics();
    panel(g, px - 70, 56, 140, 200, 0x1b1d2e, 0x2e3250, 0.92);
    const fake: CareerState = newCareer(this.draft, this.diff);
    const team = clubById('rione', this.draft.name);
    makePlayerSheet(this, 'hero_prev', team, heroDef(fake));
    const img = this.add.image(px, 200, 'hero_prev', frameIndex('down', 'idle')).setScale(5).setOrigin(0.5, 1);
    this.tweens.add({ targets: img, y: 196, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    txt(this, px, 222, this.draft.name.toUpperCase(), 8, '#ffffff');
    txt(this, px, 238, `N. ${this.draft.number}  ·  ATTACCANTE`, 6, '#8a8fb0');

    // opzioni
    const rx = W / 2 + 70;
    const row = (y: number, label: string, value: string, change: (d: -1 | 1) => void) => {
      txt(this, rx - 120, y, label, 6, '#8a8fb0').setOrigin(0, 0.5);
      txt(this, rx + 30, y, value, 8, '#ffffff');
      arrow(this, rx - 30, y, -1, () => {
        change(-1);
        sfx.select();
        this.build();
      });
      arrow(this, rx + 90, y, 1, () => {
        change(1);
        sfx.select();
        this.build();
      });
    };
    txt(this, rx - 120, 70, 'NOME', 6, '#8a8fb0').setOrigin(0, 0.5);
    button(this, rx + 30, 70, 140, 22, this.draft.name.toUpperCase(), () => {
      askName(this.draft.name).then((n) => {
        if (n) this.draft.name = n;
        if (this.scene.isActive()) this.build();
      });
    }, { size: 8, color: 0x2f6fd0 });
    const cyc = (v: number, n: number, d: number) => (v + d + n) % n;
    const L = this.draft.look;
    row(102, 'PELLE', `${L.skin + 1}/${SKIN.length}`, (d) => (L.skin = cyc(L.skin, SKIN.length, d)));
    row(132, 'CAPELLI', `${L.hair + 1}/${HAIR.length}`, (d) => (L.hair = cyc(L.hair, HAIR.length, d)));
    row(162, 'TAGLIO', STYLE_NAMES[L.hairStyle], (d) => (L.hairStyle = cyc(L.hairStyle, STYLE_NAMES.length, d)));
    row(192, 'NUMERO', String(this.draft.number), (d) => {
      const i = HERO_NUMBERS.indexOf(this.draft.number);
      this.draft.number = HERO_NUMBERS[cyc(Math.max(0, i), HERO_NUMBERS.length, d)];
    });
    txt(this, rx - 120, 226, 'CPU', 6, '#8a8fb0').setOrigin(0, 0.5);
    const bs: Button[] = [];
    DIFFS.forEach((d, i) => {
      const b = button(this, rx - 48 + i * 70, 226, 64, 20, d.toUpperCase(), () => {
        this.diff = d;
        bs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(d === this.diff);
      bs.push(b);
    });

    txt(this, rx - 120, 256, 'CONTROLLI', 6, '#8a8fb0').setOrigin(0, 0.5);
    const cs: Button[] = [];
    (['solo', 'squadra'] as const).forEach((k, i) => {
      const b = button(this, rx - 13 + i * 105, 256, 99, 20, k === 'solo' ? 'SOLO IL MIO' : 'TUTTA LA SQUADRA', () => {
        this.control = k;
        cs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(k === this.control);
      cs.push(b);
    });
    txt(this, rx + 40, 276, this.control === 'solo' ? 'Solo il tuo campione: PASSA senza palla la chiede.' : 'Controlli tutta la squadra e cambi giocatore.', 6, '#5a5f80');

    button(this, 64, H - 28, 96, 28, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const go = button(this, W - 110, H - 30, 190, 34, 'INIZIA LA STORIA', () => {
      const c = newCareer({ ...this.draft, look: { ...this.draft.look } }, this.diff, this.control);
      save((s) => (s.career = c));
      sfx.select();
      backToScene(this, 'story', { lines: STORY[0].before, step: 0, then: 'match' });
    }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
    this.tweens.add({ targets: go.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- pagina della carriera ----------
  private buildHub(c: CareerState, W: number, H: number) {
    const step = STORY[c.step];
    const { mine } = teamsFor(c, step);
    const g = this.add.graphics();

    // scheda del giocatore
    const lw = Math.min(250, W / 2 - 24);
    const lx = 16;
    panel(g, lx, 12, lw, 288, 0x1b1d2e, COLORS.accent, 0.94);
    makePlayerSheet(this, 'hero_hub', mine, heroDef(c));
    this.add.image(lx + 40, 82, 'hero_hub', frameIndex('down', c.finished ? 'celebrate' : 'idle')).setScale(3).setOrigin(0.5, 1);
    txt(this, lx + 76, 30, c.hero.name.toUpperCase(), 8, '#ffd23f').setOrigin(0, 0.5);
    txt(this, lx + 76, 46, `N. ${c.hero.number} · ${mine.short}`, 6, '#d8dcf0').setOrigin(0, 0.5);
    txt(this, lx + 76, 60, `${c.apps} partite · ${c.goals} gol`, 6, '#8a8fb0').setOrigin(0, 0.5);
    g.fillStyle(mine.colors.shirt).fillRect(lx + 76, 70, 10, 6);
    g.fillStyle(mine.colors.shirt2).fillRect(lx + 86, 70, 10, 6);
    txt(this, lx + 102, 73, mine.name, 6, '#8a8fb0').setOrigin(0, 0.5);

    txt(this, lx + 12, 100, 'ABILITÀ', 6, '#8a8fb0').setOrigin(0, 0.5);
    const pts = txt(this, lx + lw - 12, 100, `PUNTI: ${c.points}`, 6, c.points > 0 ? '#ffd23f' : '#5a5f80').setOrigin(1, 0.5);
    if (c.points > 0) this.tweens.add({ targets: pts, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    ATTRS.forEach((a, i) => {
      const y = 120 + i * 24;
      txt(this, lx + 12, y, a.label, 6, '#ffffff').setOrigin(0, 0.5);
      const bx = lx + 92;
      const lv = c.attrs[a.id];
      for (let k = 0; k < MAX_LEVEL; k++) {
        g.fillStyle(0x1a1222).fillRect(bx + k * 20 - 1, y - 5, 18, 10);
        g.fillStyle(k < lv ? COLORS.accent : 0x2e3250).fillRect(bx + k * 20, y - 4, 16, 8);
      }
      if (c.points > 0 && lv < MAX_LEVEL) {
        button(this, lx + lw - 18, y, 20, 18, '+', () => {
          save((s) => {
            if (!s.career || s.career.points <= 0 || s.career.attrs[a.id] >= MAX_LEVEL) return;
            s.career.points--;
            s.career.attrs[a.id]++;
          });
          sfx.select();
          this.build();
        }, { size: 8, color: 0x2f9a50 });
      }
    });
    txt(this, lx + 12, 244, 'SPECIALI', 6, '#8a8fb0').setOrigin(0, 0.5);
    (['bomber', 'leader'] as const).forEach((p, i) => {
      const has = c.perks.includes(p);
      const y = 260 + i * 18;
      g.fillStyle(has ? 0xff7ab8 : 0x2e3250).fillRect(lx + 12, y - 4, 8, 8);
      txt(this, lx + 26, y, has ? `${PERKS[p].name}: ${PERKS[p].desc}` : '??? (si sblocca nella storia)', 6, has ? '#ffffff' : '#5a5f80', { wordWrap: { width: lw - 36 } }).setOrigin(0, 0.5);
    });

    // prossima partita
    const rx = lx + lw + 16;
    const rw = W - rx - 16;
    const rcx = rx + rw / 2;
    panel(g, rx, 12, rw, 248, 0x1b1d2e, 0x3fd0ff, 0.94);
    if (c.finished) {
      shadowTxt(this, rcx, 44, 'LEGGENDA', 16, '#ffd23f');
      txt(this, rcx, 70, 'Hai vinto la Coppa con le Rondini FC!', 6, '#ffffff', { wordWrap: { width: rw - 20 }, align: 'center' });
      txt(this, rcx, 100, `Partite: ${c.apps}`, 8, '#d8dcf0');
      txt(this, rcx, 120, `Gol: ${c.goals}`, 8, '#d8dcf0');
      txt(this, rcx, 140, `Vittorie: ${c.wins}`, 8, '#d8dcf0');
      txt(this, rcx, 172, 'Puoi rivivere la storia con', 6, '#8a8fb0');
      txt(this, rcx, 186, 'un nuovo campione.', 6, '#8a8fb0');
      button(this, rcx, 226, Math.min(200, rw - 20), 28, 'RIGUARDA IL FINALE', () => {
        backToScene(this, 'story', { lines: STORY[STORY.length - 1].win, step: STORY.length - 1, then: 'career' });
      }, { size: 6, color: 0x8a3fd0 });
    } else {
      const { opp } = teamsFor(c, step);
      txt(this, rcx, 28, `${step.chapter} · ${c.step + 1}/${STORY.length}`, 6, '#8a8fb0');
      shadowTxt(this, rcx, 48, step.title, step.title.length > 14 ? 8 : 16, '#ffffff');
      txt(this, rcx, 70, step.place, 6, '#3fd0ff');
      // squadre
      const drawTeam = (x: number, t: typeof mine, label: string) => {
        g.fillStyle(0x1a1222).fillRect(x - 13, 86, 26, 26);
        g.fillStyle(t.colors.shirt).fillRect(x - 11, 88, 22, 22);
        g.fillStyle(t.colors.shirt2).fillRect(x - 3, 88, 6, 22);
        txt(this, x, 122, label, 6, '#ffffff');
      };
      drawTeam(rcx - 60, mine, mine.short);
      txt(this, rcx, 99, 'VS', 8, '#ffd23f');
      drawTeam(rcx + 60, opp, opp.short);
      txt(this, rcx, 138, opp.name, 6, '#d8dcf0');
      txt(this, rcx, 158, `Campo: ${PITCHES[step.pitch].name}`, 6, '#8a8fb0');
      g.fillStyle(0x0d0a1a, 0.8).fillRect(rx + 10, 172, rw - 20, 34);
      txt(this, rcx, 182, 'OBIETTIVO', 6, '#5be37d');
      txt(this, rcx, 196, GOAL_TEXT[step.goal], 6, '#ffffff', { wordWrap: { width: rw - 28 }, align: 'center' });
      if (step.rival) txt(this, rcx, 220, 'In campo c\'è il tuo rivale Rocco!', 6, '#ff9a9a');
      const play = button(this, rcx, 244, Math.min(170, rw - 20), 28, 'GIOCA', () => {
        sfx.select();
        backToScene(this, 'story', { lines: step.before, step: c.step, then: 'match' });
      }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
      this.tweens.add({ targets: play.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (c.points > 0) txt(this, rcx, 276, 'Hai punti abilità da spendere!', 6, '#ffd23f');
    }

    button(this, 64, H - 24, 96, 26, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
    const solo = c.control !== 'squadra';
    button(this, W / 2 - (W < 640 ? 18 : 0), H - 24, 150, 26, solo ? 'GIOCHI: SOLO TU' : 'GIOCHI: SQUADRA', () => {
      save((s) => {
        if (s.career) s.career.control = s.career.control === 'squadra' ? 'solo' : 'squadra';
      });
      sfx.select();
      this.build();
    }, { size: 6, color: solo ? 0x8a3fd0 : 0x2f6fd0 });
    button(this, W - 80, H - 24, 132, 26, this.confirmReset ? 'SICURO?' : 'NUOVA CARRIERA', () => {
      if (!this.confirmReset) {
        this.confirmReset = true;
        this.build();
        return;
      }
      this.confirmReset = false;
      save((s) => delete s.career);
      this.build();
    }, { size: 6, color: this.confirmReset ? 0x8a3040 : 0x3a3d55 });
  }
}
