import Phaser from 'phaser';
import { TEAMS } from '../data/teams';
import { button, arrow, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load, save } from '../save/storage';
import { newProgress } from '../modes/progress';
import {
  MAX_FIELD,
  WIN_ROUNDS,
  canPlace,
  cpuPlay,
  duelCoins,
  endTurn,
  newDuel,
  place,
  recordDuel,
  type Card,
  type DuelEvent,
  type DuelState,
} from '../modes/duello';
import { backToMenu } from './demo';
import { sfx } from '../audio/sfx';
import type { Difficulty } from '../sim/types';

const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];
const ROLE_COL = { GK: 0xd9a400, DEF: 0x2f6fd0, MID: 0x2f9a50, FWD: 0xd0402f } as const;
const ROLE_TXT = { GK: 'POR', DEF: 'DIF', MID: 'CEN', FWD: 'ATT' } as const;

export class DuelloScene extends Phaser.Scene {
  private teamIdx = 0;
  private diff: Difficulty = 'normale';
  private st: DuelState | null = null;
  private busy = false;
  private rewarded = false;
  private banner?: Phaser.GameObjects.Container;

  constructor() {
    super('duello');
  }

  create() {
    const s = load();
    this.teamIdx = Math.max(0, TEAMS.findIndex((t) => t.id === s.settings.homeTeam));
    this.diff = (DIFFS.includes(s.settings.difficulty as Difficulty) ? s.settings.difficulty : 'normale') as Difficulty;
    this.st = null;
    this.busy = false;
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.draw();
    this.scale.on('resize', this.draw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.draw, this));
  }

  private draw() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.banner = undefined;
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.92).setOrigin(0).setInteractive();
    if (!this.st) this.drawSetup(W, H);
    else this.drawBattle(W, H, this.st);
  }

  // ---------- scelta squadra ----------
  private drawSetup(W: number, H: number) {
    shadowTxt(this, W / 2, 26, 'DUELLO A CARTE', 16, '#ffd23f');
    txt(this, W / 2, 50, 'Ogni giocatore è una carta. Schiera, attacca, svuota il campo avversario.', 6, '#8a8fb0');
    const rec = load().duello;
    if (rec) txt(this, W / 2, 64, `Duelli ${rec.played}  Vinti ${rec.won}  Serie ${rec.streak} (record ${rec.bestStreak})`, 6, '#8a8fb0');
    const team = TEAMS[this.teamIdx];
    arrow(this, W / 2 - 110, 100, -1, () => {
      this.teamIdx = (this.teamIdx + TEAMS.length - 1) % TEAMS.length;
      this.draw();
    });
    arrow(this, W / 2 + 110, 100, 1, () => {
      this.teamIdx = (this.teamIdx + 1) % TEAMS.length;
      this.draw();
    });
    txt(this, W / 2, 92, team.name.toUpperCase(), 10, '#ffffff');
    txt(this, W / 2, 108, 'LA TUA SQUADRA', 6, '#3fd0ff');
    const diffBtn = button(this, W / 2, 140, 200, 22, `CPU: ${this.diff.toUpperCase()}`, () => {
      this.diff = DIFFS[(DIFFS.indexOf(this.diff) + 1) % 3];
      diffBtn.setLabel(`CPU: ${this.diff.toUpperCase()}`);
    }, { size: 7 });
    // regole in breve
    const rules = [
      'REGOLE',
      '• Ogni carta ha DRIBBLING (D) e DIFESA (F). Costa energia (E).',
      '• Le carte schierate entrano in campo al turno dopo. Max 4.',
      '• A fine turno attaccano: D maggiore salta il difensore,',
      '  D uguale si annulla, D minore viene fermato (e fuori se -2).',
      '• Campo avversario vuoto = GOL. Vince chi fa 2 round.',
      '• Al primo turno si schiera soltanto. Il capitano (*) è più forte.',
    ];
    rules.forEach((l, i) => txt(this, W / 2, 178 + i * 14, l, i === 0 ? 7 : 6, i === 0 ? '#ffd23f' : '#ffffff'));
    button(this, W / 2, H - 52, 200, 26, 'GIOCA', () => this.start(), { color: 0x2f9a50 });
    button(this, W / 2, H - 20, 120, 20, 'INDIETRO', () => backToMenu(this), { size: 6 });
  }

  private start() {
    const home = TEAMS[this.teamIdx];
    let oi = Math.floor(Math.random() * TEAMS.length);
    if (oi === this.teamIdx) oi = (oi + 1) % TEAMS.length;
    this.rewarded = false;
    this.st = newDuel(home, TEAMS[oi], TEAMS, Math.floor(Math.random() * 1e9));
    this.busy = false;
    this.maybeCpuOpen();
    this.draw();
  }

  /** Se il round comincia con la CPU, gioca subito il suo turno. */
  private maybeCpuOpen() {
    const st = this.st;
    if (!st || st.over || st.turn !== 1) return;
    cpuPlay(st, 1, this.diff);
    const ev = endTurn(st);
    this.pendingBanner = ev;
  }
  private pendingBanner: DuelEvent[] = [];

  // ---------- partita ----------
  private card(x: number, y: number, c: Card, w: number, h: number, o: { dim?: boolean; tag?: string; onTap?: () => void; hidden?: boolean } = {}) {
    const g = this.add.graphics();
    const col = ROLE_COL[c.role];
    g.fillStyle(0x000000, 0.4).fillRect(x - w / 2 + 2, y - h / 2 + 3, w, h);
    g.fillStyle(COLORS.ink).fillRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
    g.fillStyle(o.dim ? 0x2a2c3a : col).fillRect(x - w / 2, y - h / 2, w, h);
    g.fillStyle(0xffffff, o.dim ? 0.06 : 0.22).fillRect(x - w / 2, y - h / 2, w, 3);
    g.fillStyle(0x14111f, 0.7).fillRect(x - w / 2 + 3, y - h / 2 + 14, w - 6, h - 30);
    const a = o.dim ? 0.5 : 1;
    const nm = txt(this, x, y - h / 2 + 8, (c.captain ? '*' : '') + c.name.slice(0, 8).toUpperCase(), 5, '#ffffff').setAlpha(a);
    const role = txt(this, x, y - h / 2 + 22, ROLE_TXT[c.role], 5, '#8a8fb0').setAlpha(a);
    const d = txt(this, x - w / 4, y + 4, `${c.dribble}`, 12, '#ffb03a').setAlpha(a);
    const f = txt(this, x + w / 4, y + 4, `${c.defense}`, 12, '#6ae6ff').setAlpha(a);
    const dl = txt(this, x - w / 4, y + 17, 'DRIB', 4, '#ffb03a').setAlpha(a);
    const fl = txt(this, x + w / 4, y + 17, 'DIF', 4, '#6ae6ff').setAlpha(a);
    const cost = txt(this, x, y + h / 2 - 7, `E${c.cost}`, 6, '#ffd23f').setAlpha(a);
    void [nm, role, d, f, dl, fl, cost];
    if (o.tag) txt(this, x, y - h / 2 - 7, o.tag, 5, '#ffd23f');
    if (o.onTap) {
      const z = this.add.zone(x, y, w + 4, h + 4).setInteractive({ useHandCursor: true });
      z.on('pointerup', o.onTap);
    }
  }

  private drawBattle(W: number, H: number, st: DuelState) {
    const me = st.sides[0];
    const op = st.sides[1];
    // intestazione
    const g = this.add.graphics();
    panel(g, W / 2 - 120, 4, 240, 20, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, W / 2, 14, `ROUND ${st.round}   ${st.wins[0]} - ${st.wins[1]}   (primo a ${WIN_ROUNDS})`, 7, '#ffd23f');
    txt(this, 70, 12, op.name.toUpperCase().slice(0, 14), 6, '#ff8a8a');
    txt(this, W - 70, 12, `TURNO ${st.turnNo}`, 6, '#8a8fb0');
    button(this, 36, H - 16, 62, 18, 'ESCI', () => {
      this.st = null;
      backToMenu(this);
    }, { size: 6, color: 0x8a3040 });

    const cw = 62;
    const ch = 70;
    const gap = 10;
    const rowX = (i: number, n: number) => W / 2 + (i - (n - 1) / 2) * (cw + gap);
    // campo avversario
    txt(this, 30, 60, 'CPU', 6, '#ff8a8a');
    op.field.forEach((c, i) => this.card(rowX(i, Math.max(op.field.length, 1)), 62, c, cw, ch));
    if (!op.field.length) txt(this, W / 2, 62, 'CAMPO VUOTO!', 10, '#ff5a5a');
    if (op.pending.length) txt(this, W - 50, 62, `+${op.pending.length} in arrivo`, 6, '#8a8fb0');
    // riga di mezzo
    const line = st.log[st.log.length - 1] ?? 'Schiera le tue carte e premi FINE TURNO';
    txt(this, W / 2, 108, line, 6, '#ffffff');
    // mio campo
    txt(this, 30, 168, 'TU', 6, '#6ae6ff');
    me.field.forEach((c, i) => this.card(rowX(i, Math.max(me.field.length + me.pending.length, 1)), 160, c, cw, ch));
    me.pending.forEach((c, i) => this.card(rowX(me.field.length + i, me.field.length + me.pending.length), 160, c, cw, ch, { dim: true, tag: 'ARRIVA' }));
    if (!me.field.length && !me.pending.length) txt(this, W / 2, 160, 'CAMPO VUOTO!', 10, '#ff5a5a');
    // energia
    const free = MAX_FIELD - me.field.length - me.pending.length;
    txt(this, W / 2, 205, `ENERGIA ${'●'.repeat(me.energy)}${'○'.repeat(Math.max(0, 7 - me.energy))}   posti liberi ${free}`, 6, '#ffd23f');
    // panchina
    const bw = 54;
    const bh = 62;
    const n = me.bench.length;
    const step = Math.min(bw + 8, (W - 130) / Math.max(1, n));
    me.bench.forEach((c, i) => {
      const x = W / 2 - 40 + (i - (n - 1) / 2) * step;
      const ok = canPlace(st, 0, c) && !this.busy;
      this.card(x, 254, c, bw, bh, {
        dim: !ok,
        onTap: () => {
          if (this.busy || !place(st, 0, c.id)) return;
          sfx.click();
          this.draw();
        },
      });
    });
    if (!n) txt(this, W / 2, 254, 'panchina vuota', 6, '#8a8fb0');
    txt(this, W / 2 - 40, 296, 'PANCHINA: tocca una carta per schierarla', 5, '#8a8fb0');
    // fine turno
    if (!st.over) {
      const b = button(this, W - 62, 254, 100, 34, 'FINE TURNO', () => this.finish(), { color: 0x2f9a50, size: 7 });
      b.setEnabled(!this.busy);
    }
    if (this.pendingBanner.length) {
      const ev = this.pendingBanner;
      this.pendingBanner = [];
      this.busy = true;
      this.playEvents(ev, 'CPU', () => {
        this.busy = false;
        this.afterTurn();
      });
    } else if (st.over) this.drawResult(W, H, st);
  }

  private finish() {
    const st = this.st;
    if (!st || this.busy || st.over) return;
    this.busy = true;
    const ev = endTurn(st);
    this.playEvents(ev, 'TU', () => {
      if (st.over) {
        this.busy = false;
        this.draw();
        return;
      }
      if (st.turn === 1) {
        cpuPlay(st, 1, this.diff);
        const ev2 = endTurn(st);
        this.playEvents(ev2, 'CPU', () => {
          this.busy = false;
          this.afterTurn();
        });
      } else {
        this.busy = false;
        this.draw();
      }
    });
  }

  /** Dopo la mossa della CPU: se il round è ripartito con lei, tocca di nuovo a lei finché non è il mio turno. */
  private afterTurn() {
    const st = this.st;
    if (!st) return;
    if (!st.over && st.turn === 1) {
      cpuPlay(st, 1, this.diff);
      const ev = endTurn(st);
      this.busy = true;
      this.playEvents(ev, 'CPU', () => {
        this.busy = false;
        this.afterTurn();
      });
      return;
    }
    this.draw();
  }

  /** Mostra gli eventi uno alla volta con una scritta al centro. */
  private playEvents(events: DuelEvent[], who: 'TU' | 'CPU', done: () => void) {
    if (!events.length) {
      done();
      return;
    }
    const W = this.scale.width;
    const H = this.scale.height;
    let i = 0;
    const next = () => {
      this.banner?.destroy();
      if (i >= events.length) {
        done();
        return;
      }
      const e = events[i++];
      let text = '';
      let color = '#ffffff';
      let sub = '';
      if (e.kind === 'beat') {
        text = 'DRIBBLING!';
        color = who === 'TU' ? '#5be37d' : '#ff5a5a';
        sub = `${e.att.name} salta ${e.def.name}`;
        sfx.pass();
      } else if (e.kind === 'stop') {
        text = e.out ? 'FERMATO!' : 'RESPINTO!';
        color = who === 'TU' ? '#ff5a5a' : '#5be37d';
        sub = `${e.def.name} ferma ${e.att.name}`;
        sfx.click();
      } else if (e.kind === 'clash') {
        text = 'SCONTRO!';
        color = '#ffd23f';
        sub = `${e.att.name} e ${e.def.name} si annullano`;
        sfx.click();
      } else {
        text = 'GOL!';
        color = e.side === 0 ? '#5be37d' : '#ff5a5a';
        sub = e.side === 0 ? 'Punto per te' : 'Punto per la CPU';
        sfx.pass();
      }
      const c = this.add.container(0, 0).setDepth(50);
      c.add(this.add.rectangle(W / 2, H / 2 - 20, W, 60, 0x0d0a1a, 0.88));
      c.add(shadowTxt(this, W / 2, H / 2 - 28, text, 18, color).c);
      c.add(txt(this, W / 2, H / 2 - 4, sub, 6, '#ffffff'));
      c.setScale(0.6);
      this.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.easeOut' });
      this.banner = c;
      this.time.delayedCall(e.kind === 'goal' ? 1100 : 700, next);
    };
    next();
  }

  private drawResult(W: number, H: number, st: DuelState) {
    if (!this.rewarded) {
      this.rewarded = true;
      const coins = duelCoins(st);
      save((d) => {
        d.duello = recordDuel(d.duello, st);
        d.progress ??= newProgress();
        d.progress.coins += coins;
      });
    }
    const coins = duelCoins(st);
    this.add.rectangle(W / 2, H / 2, W - 80, 170, 0x0d0a1a, 0.95).setStrokeStyle(2, 0xffd23f).setDepth(40);
    const win = st.winner === 0;
    shadowTxt(this, W / 2, H / 2 - 56, win ? 'DUELLO VINTO!' : st.winner === null ? 'PAREGGIO' : 'DUELLO PERSO', 18, win ? '#5be37d' : st.winner === null ? '#ffd23f' : '#ff5a5a').c.setDepth(41);
    txt(this, W / 2, H / 2 - 28, `${st.wins[0]} - ${st.wins[1]} contro ${st.sides[1].name}`, 8, '#ffffff').setDepth(41);
    txt(this, W / 2, H / 2 - 10, `+${coins} monete`, 8, '#ffd23f').setDepth(41);
    const r = load().duello;
    if (r) txt(this, W / 2, H / 2 + 6, `Serie vinte: ${r.streak}  (record ${r.bestStreak})`, 6, '#8a8fb0').setDepth(41);
    button(this, W / 2 - 70, H / 2 + 44, 120, 24, 'RIVINCITA', () => {
      this.st = null;
      this.start();
    }, { color: 0x2f9a50, size: 7 }).c.setDepth(41);
    button(this, W / 2 + 70, H / 2 + 44, 120, 24, 'MENU', () => backToMenu(this), { size: 7 }).c.setDepth(41);
  }
}
