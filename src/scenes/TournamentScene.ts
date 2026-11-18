import Phaser from 'phaser';
import { TEAMS, teamById } from '../data/teams';
import { PITCHES } from '../data/pitches';
import { arrow, button, COLORS, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { load, save } from '../save/storage';
import { frameIndex, makePlayerSheet } from '../gfx/sprites';
import type { Difficulty } from '../sim/types';
import type { MatchLaunch } from '../modes/modes';
import { newTournament, roundTeams, ROUND_NAMES, userOpponent, type TournamentState } from '../modes/tournament';
import { backToMenu, fixKits, startMatch } from './demo';
import { sfx } from '../audio/sfx';

const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];

/** Torneo: scelta della squadra, tabellone a 8 e prossima partita. */
export class TournamentScene extends Phaser.Scene {
  private pick = 0;
  private diff: Difficulty = 'normale';
  private confirmQuit = false;

  constructor() {
    super('tournament');
  }

  create() {
    const s = load().settings;
    this.pick = Math.max(0, TEAMS.findIndex((t) => t.id === s.homeTeam));
    this.diff = (DIFFS.includes(s.difficulty as Difficulty) ? s.difficulty : 'normale') as Difficulty;
    this.confirmQuit = false;
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.children.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.82).setOrigin(0).setInteractive();
    const st = load().tournament;
    if (!st) this.buildNew(W, H);
    else this.buildBracket(st, W, H);
  }

  // ---------- nuova coppa ----------
  private buildNew(W: number, H: number) {
    shadowTxt(this, W / 2, 20, 'COPPA PIXEL', 16, '#ffd23f');
    txt(this, W / 2, 42, 'Quarti, semifinale e finale. Chi perde è fuori!', 6, '#d8dcf0');
    const trophies = load().trophies ?? 0;
    if (trophies > 0) this.drawCup(W - 40, 30, 1), txt(this, W - 40, 58, `x${trophies}`, 8, '#ffd23f');

    const t = TEAMS[this.pick];
    const cx = W / 2;
    const cy = 120;
    const g = this.add.graphics();
    panel(g, cx - 110, cy - 52, 220, 108, 0x1b1d2e, 0x2e3250, 0.92);
    txt(this, cx, cy - 42, 'LA TUA SQUADRA', 6, '#ffd23f');
    for (let i = 0; i < 3; i++) {
      const key = `tprev_${i}`;
      makePlayerSheet(this, key, t, t.players[i + 2]);
      this.add.image(cx - 28 + i * 28, cy - 6, key, frameIndex('down', i === 1 ? 'celebrate' : 'idle')).setScale(2);
    }
    txt(this, cx, cy + 26, t.name.toUpperCase(), 8);
    this.stars(g, cx, cy + 42, t.stars);
    arrow(this, cx - 92, cy - 6, -1, () => this.cycle(-1));
    arrow(this, cx + 92, cy - 6, 1, () => this.cycle(1));

    txt(this, cx - 150, 206, 'CPU', 6, '#8a8fb0').setOrigin(1, 0.5);
    const bs: Button[] = [];
    DIFFS.forEach((d, i) => {
      const b = button(this, cx - 96 + i * 96, 206, 88, 20, d.toUpperCase(), () => {
        this.diff = d;
        bs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(d === this.diff);
      bs.push(b);
    });
    txt(this, cx, 240, 'Un campo diverso a ogni turno. La finale si gioca allo Stadio.', 6, '#8a8fb0');

    button(this, 64, H - 28, 96, 28, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const go = button(this, W - 100, H - 30, 170, 34, 'INIZIA COPPA', () => {
      const st = newTournament(TEAMS[this.pick].id, this.diff);
      save((s) => {
        s.tournament = st;
        s.settings.homeTeam = st.teamId;
        s.settings.difficulty = this.diff;
      });
      sfx.select();
      this.build();
    }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
    this.tweens.add({ targets: go.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private cycle(d: number) {
    this.pick = (this.pick + d + TEAMS.length) % TEAMS.length;
    sfx.select();
    this.build();
  }

  private stars(g: Phaser.GameObjects.Graphics, cx: number, sy: number, n: number) {
    for (let i = 0; i < 5; i++) {
      const sx = cx - 28 + i * 14;
      g.fillStyle(i < n ? 0xffd23f : 0x3a3d55);
      g.fillRect(sx - 1, sy - 4, 3, 9);
      g.fillRect(sx - 4, sy - 1, 9, 3);
      g.fillRect(sx - 2, sy - 2, 5, 5);
    }
  }

  /** Coppa in pixel art. */
  private drawCup(x: number, y: number, s: number) {
    const g = this.add.graphics();
    g.setPosition(x, y).setScale(s);
    const gold = 0xffd23f;
    const dark = 0xc08a1a;
    g.fillStyle(0x1a1222).fillRect(-11, -15, 22, 4).fillRect(-9, -12, 18, 12).fillRect(-4, 0, 8, 6).fillRect(-8, 6, 16, 6);
    g.fillStyle(0x1a1222).fillRect(-15, -12, 5, 9).fillRect(10, -12, 5, 9);
    g.fillStyle(gold).fillRect(-10, -14, 20, 2).fillRect(-8, -12, 16, 11).fillRect(-3, -1, 6, 6).fillRect(-7, 7, 14, 4);
    g.fillStyle(gold).fillRect(-14, -11, 3, 2).fillRect(-14, -9, 2, 5).fillRect(11, -11, 3, 2).fillRect(12, -9, 2, 5);
    g.fillStyle(dark).fillRect(3, -12, 5, 11).fillRect(-7, 9, 14, 2);
    g.fillStyle(0xffffff, 0.8).fillRect(-6, -11, 2, 6);
    return g;
  }

  // ---------- tabellone ----------
  private buildBracket(st: TournamentState, W: number, H: number) {
    const over = st.round > 2 || st.eliminated;
    shadowTxt(this, W / 2, 18, over ? (st.champion === st.teamId ? 'CAMPIONI!' : 'COPPA FINITA') : ROUND_NAMES[st.round], 16, over && st.champion === st.teamId ? '#ffd23f' : '#ffffff');
    const g = this.add.graphics();
    const mine = st.teamId;
    const bw = Math.min(92, (W - 120) / 5);
    const colX = [16 + bw / 2, 16 + bw * 1.5 + 14, W / 2, W - 16 - bw * 1.5 - 14, W - 16 - bw / 2];
    const top = 52;
    const span = 172;
    // posizioni verticali: quarti (4 per lato), semifinali (2), finale (1)
    const slotY = (n: number, i: number) => top + (span / n) * (i + 0.5);
    const box = (x: number, y: number, id: string | undefined, goals: number | undefined, won: boolean, lost: boolean) => {
      const isMe = id === mine;
      const fill = isMe ? 0x3a3060 : 0x1b1d2e;
      g.fillStyle(0x1a1222).fillRect(x - bw / 2 - 1, y - 8, bw + 2, 16);
      g.fillStyle(fill).fillRect(x - bw / 2, y - 7, bw, 14);
      if (id) {
        const t = teamById(id);
        g.fillStyle(t.colors.shirt).fillRect(x - bw / 2 + 2, y - 5, 4, 10);
        g.fillStyle(t.colors.shirt2).fillRect(x - bw / 2 + 6, y - 5, 2, 10);
        txt(this, x - bw / 2 + 12, y + 1, t.short, 6, lost ? '#5a5f80' : isMe ? '#ffd23f' : '#ffffff').setOrigin(0, 0.5);
        if (goals !== undefined) txt(this, x + bw / 2 - 5, y + 1, String(goals), 6, won ? '#5be37d' : '#8a8fb0').setOrigin(1, 0.5);
      } else {
        txt(this, x, y + 1, '?', 6, '#5a5f80');
      }
      if (isMe) g.lineStyle(1, COLORS.accent).strokeRect(x - bw / 2 - 1, y - 8, bw + 2, 16);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, hot: boolean) => {
      g.lineStyle(1, hot ? COLORS.accent : 0x3a3d55);
      const mx = (x1 + x2) / 2;
      g.lineBetween(x1, y1, mx, y1);
      g.lineBetween(mx, y1, mx, y2);
      g.lineBetween(mx, y2, x2, y2);
    };
    const r0 = st.results[0];
    const r1 = st.results[1];
    const r2 = st.results[2];
    const qf = st.bracket;
    const sf = roundTeams(st, 1);
    const fi = roundTeams(st, 2);
    // quarti: 0-3 a sinistra, 4-7 a destra
    for (let i = 0; i < 8; i++) {
      const left = i < 4;
      const x = left ? colX[0] : colX[4];
      const y = slotY(4, i % 4);
      const m = r0?.[Math.floor(i / 2)];
      const goals = m ? (i % 2 === 0 ? m.ga : m.gb) : undefined;
      box(x, y, qf[i], goals, !!m && m.winner === qf[i], !!m && m.winner !== qf[i]);
      const sy = slotY(2, Math.floor((i % 4) / 2));
      const sx = left ? colX[1] : colX[3];
      line(left ? x + bw / 2 : x - bw / 2, y, left ? sx - bw / 2 : sx + bw / 2, sy, !!m && m.winner === qf[i]);
    }
    for (let i = 0; i < 4; i++) {
      const left = i < 2;
      const x = left ? colX[1] : colX[3];
      const y = slotY(2, i % 2);
      const id = sf[i];
      const m = r1?.[Math.floor(i / 2)];
      const goals = m ? (i % 2 === 0 ? m.ga : m.gb) : undefined;
      box(x, y, id, goals, !!m && m.winner === id, !!m && m.winner !== id);
      const fy = slotY(1, 0) + (left ? -12 : 12);
      line(left ? x + bw / 2 : x - bw / 2, y, colX[2] + (left ? -bw / 2 : bw / 2), fy, !!m && m.winner === id);
    }
    for (let i = 0; i < 2; i++) {
      const id = fi[i];
      const m = r2?.[0];
      const goals = m ? (i === 0 ? m.ga : m.gb) : undefined;
      box(colX[2], slotY(1, 0) + (i === 0 ? -12 : 12), id, goals, !!m && m.winner === id, !!m && m.winner !== id);
    }
    const cup = this.drawCup(colX[2], top + 34, st.champion ? 1.6 : 1.2);
    if (st.champion) {
      this.tweens.add({ targets: cup, y: cup.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      txt(this, colX[2], slotY(1, 0) + 40, teamById(st.champion).name.toUpperCase(), 6, '#ffd23f');
    }
    txt(this, colX[0], top - 8, 'QUARTI', 6, '#8a8fb0');
    txt(this, colX[4], top - 8, 'QUARTI', 6, '#8a8fb0');
    txt(this, colX[1], top + 30, 'SEMI', 6, '#8a8fb0');
    txt(this, colX[3], top + 30, 'SEMI', 6, '#8a8fb0');

    // prossima partita o fine coppa
    const py = 246;
    const pg = this.add.graphics();
    const pw = Math.min(W - 32, 470);
    panel(pg, W / 2 - pw / 2, py - 16, pw, 50, 0x1b1d2e, 0x2e3250, 0.95);
    const opp = userOpponent(st);
    button(this, 64, H - 28, 96, 28, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
    if (opp) {
      const p = PITCHES[st.pitches[st.round]];
      txt(this, W / 2, py - 4, `${teamById(mine).name.toUpperCase()}  VS  ${teamById(opp).name.toUpperCase()}`, 6, '#ffffff');
      txt(this, W / 2, py + 10, `Campo: ${p.name}  ·  CPU ${st.difficulty}`, 6, '#3fd0ff');
      txt(this, W / 2, py + 23, p.rule, 6, '#8a8fb0', { wordWrap: { width: pw - 16 }, align: 'center' });
      const play = button(this, W - 90, H - 30, 150, 34, 'GIOCA!', () => this.play(st, opp), { color: COLORS.good, size: 16, textColor: '#1a1222' });
      this.tweens.add({ targets: play.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const q = button(this, W / 2, H - 28, 120, 22, this.confirmQuit ? 'SICURO?' : 'ABBANDONA', () => {
        if (!this.confirmQuit) {
          this.confirmQuit = true;
          this.build();
          return;
        }
        save((s) => delete s.tournament);
        this.confirmQuit = false;
        this.build();
      }, { size: 6, color: this.confirmQuit ? 0x8a3040 : 0x3a3d55 });
      void q;
    } else {
      const won = st.champion === mine;
      txt(this, W / 2, py, won ? 'Hai alzato la Coppa Pixel! Gloria eterna.' : `Eliminati. La coppa va a ${teamById(st.champion!).name}.`, 6, won ? '#ffd23f' : '#d8dcf0');
      txt(this, W / 2, py + 16, `Coppe vinte: ${load().trophies ?? 0}`, 6, '#8a8fb0');
      if (won) sfx.fanfare();
      const again = button(this, W - 100, H - 30, 170, 34, 'NUOVA COPPA', () => {
        save((s) => delete s.tournament);
        this.build();
      }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
      void again;
    }
  }

  private play(st: TournamentState, opp: string) {
    const home = teamById(st.teamId);
    const s = load().settings;
    const launch: MatchLaunch = {
      mode: 'torneo',
      modeData: { round: st.round },
      hudGoal: st.round === 2 ? 'VINCI LA FINALE!' : undefined,
      config: {
        home,
        away: fixKits(home, teamById(opp)),
        pitch: PITCHES[st.pitches[st.round]],
        difficulty: st.difficulty,
        durationSec: s.duration,
        powerUps: s.powerUps,
        goldenGoal: true,
        humanTeam: 0,
      },
    };
    sfx.unlock();
    startMatch(this, launch);
  }
}
