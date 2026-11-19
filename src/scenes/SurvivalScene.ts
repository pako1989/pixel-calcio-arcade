import Phaser from 'phaser';
import { TEAMS } from '../data/teams';
import { PITCHES } from '../data/pitches';
import { button, arrow, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load, save } from '../save/storage';
import { frameIndex, makePlayerSheet } from '../gfx/sprites';
import type { Difficulty } from '../sim/types';
import {
  newSurvival,
  pickDraftOption,
  playerOverall,
  statDiffs,
  SURVIVAL_PERKS,
  SURVIVAL_RULES,
  survivalLaunch,
  type SurvivalDraftOption,
  type SurvivalState,
} from '../modes/survival';
import { backToMenu, fixKits, startMatch } from './demo';
import { sfx } from '../audio/sfx';

const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];
const ROLE_LABEL = { GK: 'POR', DEF: 'DIF', MID: 'CEN', FWD: 'ATT' } as const;

export class SurvivalScene extends Phaser.Scene {
  private teamIdx = 0;
  private diff: Difficulty = 'normale';

  constructor() {
    super('survival');
  }

  create() {
    const s = load();
    this.teamIdx = Math.max(0, TEAMS.findIndex((t) => t.id === s.settings.homeTeam));
    this.diff = (DIFFS.includes(s.settings.difficulty as Difficulty) ? s.settings.difficulty : 'normale') as Difficulty;
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  private rebuild() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.build();
  }

  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.88).setOrigin(0).setInteractive();

    const sv = load();
    const s = sv.survival;
    const best = sv.survivalBest?.bestRound ?? 0;

    if (s?.active && s.pendingDraft?.length) {
      this.buildDraft(W, H, s);
      return;
    }
    if (s?.active) {
      this.buildHub(W, H, s, best);
      return;
    }
    if (s && !s.active && s.lastSummary) {
      this.buildGameOver(W, H, s, best);
      return;
    }
    this.buildSetup(W, H, best);
  }

  // ---------- 1. Schermata iniziale (scelta squadra e difficoltà) ----------

  private buildSetup(W: number, H: number, best: number) {
    shadowTxt(this, W / 2, 20, 'SOPRAVVIVENZA', 16, '#ff7ab8');
    txt(this, W / 2, 38, 'ROGUELITE 5V5 · REGOLE FOLLI · RUBA GIOCATORI', 6, '#3fd0ff');
    if (best > 0) {
      txt(this, W - 14, 18, `RECORD: ${best} ROUND`, 6, '#ffd23f').setOrigin(1, 0.5);
    }

    const t = TEAMS[this.teamIdx];
    const g = this.add.graphics();
    panel(g, W / 2 - 175, 54, 350, 134, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, W / 2, 68, 'SCEGLI LA SQUADRA DI PARTENZA', 6, '#ffd23f');

    for (let i = 0; i < 3; i++) {
      const idx = i === 0 ? 0 : i === 1 ? 2 : 4;
      const key = `surv_setup_${i}`;
      makePlayerSheet(this, key, t, t.players[idx]);
      this.add.image(W / 2 - 36 + i * 36, 106, key, frameIndex('down', i === 2 ? 'celebrate' : 'idle')).setScale(2);
    }
    txt(this, W / 2, 144, t.name.toUpperCase(), 12, '#ffffff');
    for (let i = 0; i < 5; i++) {
      const sx = W / 2 - 28 + i * 14;
      const sy = 166;
      g.fillStyle(i < t.stars ? 0xffd23f : 0x3a3d55).fillRect(sx - 2, sy - 2, 5, 5).fillRect(sx - 4, sy - 1, 9, 3).fillRect(sx - 1, sy - 4, 3, 9);
    }
    arrow(this, W / 2 - 148, 112, -1, () => {
      this.teamIdx = (this.teamIdx - 1 + TEAMS.length) % TEAMS.length;
      sfx.select();
      this.rebuild();
    });
    arrow(this, W / 2 + 148, 112, 1, () => {
      this.teamIdx = (this.teamIdx + 1) % TEAMS.length;
      sfx.select();
      this.rebuild();
    });

    // Difficoltà
    txt(this, W / 2, 206, 'DIFFICOLTÀ DI PARTENZA', 6, '#8a8fb0');
    DIFFS.forEach((d, i) => {
      const b = button(this, W / 2 + (i - 1) * 96, 228, 88, 22, d.toUpperCase(), () => {
        this.diff = d;
        sfx.select();
        this.rebuild();
      }, { size: 6 });
      b.setSelected(this.diff === d);
    });

    panel(g, W / 2 - 210, 250, 420, 48, 0x161828, 0x2e3250, 0.9);
    txt(
      this,
      W / 2,
      274,
      'Partite da 90s con Golden Gol. Dopo ogni vittoria scegli se rubare\nun giocatore avversario o ottenere un bonus permanente! Ogni 5 round c\'è un Boss.',
      6,
      '#d8dcf0',
      { align: 'center', lineSpacing: 5 },
    );

    button(this, 64, H - 24, 96, 26, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const go = button(this, W / 2 + 40, H - 26, 200, 32, 'INIZIA SCALATA!', () => {
      const st = newSurvival(TEAMS[this.teamIdx].id, this.diff);
      save((d) => {
        d.survival = st;
      });
      sfx.whistle();
      this.rebuild();
    }, { color: COLORS.good, size: 12, textColor: '#1a1222' });
    this.tweens.add({ targets: go.c, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- 2. Hub Round (rosa attuale + sfida successiva) ----------

  private buildHub(W: number, H: number, s: SurvivalState, best: number) {
    const n = s.next;
    const rDef = SURVIVAL_RULES[n.rule];
    shadowTxt(this, W / 2, 18, n.isBoss ? `ROUND ${s.round} · BOSS!` : `SOPRAVVIVENZA · ROUND ${s.round}`, 16, n.isBoss ? '#ff5a5a' : '#ffd23f');
    txt(this, W - 14, 18, `RECORD: ${Math.max(best, s.round - 1)}`, 6, '#8a8fb0').setOrigin(1, 0.5);

    const g = this.add.graphics();
    const pw = Math.min(256, (W - 44) / 2);
    const lx = W / 2 - pw - 6;
    const rx = W / 2 + 6;

    // Pannello sinistro: La tua rosa + Bonus attivi
    panel(g, lx, 40, pw, 258, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, lx + pw / 2, 54, `${s.team.name.toUpperCase()} (${s.stolen} RUB.)`, 7, '#3fd0ff');
    s.team.players.forEach((p, i) => {
      const py = 78 + i * 32;
      g.fillStyle(i % 2 ? 0x202338 : 0x262a42).fillRect(lx + 8, py - 12, pw - 16, 28);
      const key = `surv_my_${i}`;
      makePlayerSheet(this, key, s.team, p);
      this.add.image(lx + 24, py + 2, key, frameIndex('down', 'idle')).setScale(1.4);
      txt(this, lx + 42, py - 4, `${ROLE_LABEL[p.role]} ${p.name}`, 6, '#ffffff').setOrigin(0, 0.5);
      txt(this, lx + 42, py + 7, `VEL ${Math.round(p.stats.speed * 80)}  TIR ${Math.round(p.stats.shot * 80)}`, 6, '#8a8fb0').setOrigin(0, 0.5);
      txt(this, lx + pw - 14, py + 1, `${playerOverall(p)}`, 8, '#ffd23f').setOrigin(1, 0.5);
    });

    // Bonus raccolti nella run
    txt(this, lx + 10, 240, `BONUS ATTIVI (${s.perks.length}):`, 6, '#5be37d').setOrigin(0, 0.5);
    const perkText = s.perks.length ? s.perks.map((id) => SURVIVAL_PERKS[id].name).join(' · ') : 'Nessuno ancora (vinci per scegliere!)';
    txt(this, lx + 10, 254, perkText, 6, '#d8dcf0', { wordWrap: { width: pw - 20 }, lineSpacing: 3 }).setOrigin(0, 0);

    // Pannello destro: Prossimo avversario + Regola speciale
    panel(g, rx, 40, pw, 258, 0x1b1d2e, n.isBoss ? 0xe8443a : 0x2e3250, 0.95);
    txt(this, rx + pw / 2, 54, n.isBoss ? 'SFIDANTE BOSS!' : 'PROSSIMO AVVERSARIO', 7, n.isBoss ? '#ff5a5a' : '#ff9a9a');

    const oppShown = fixKits(s.team, n.opp);
    for (let i = 0; i < 2; i++) {
      const key = `surv_opp_${i}`;
      makePlayerSheet(this, key, oppShown, oppShown.players[i === 0 ? 4 : 0]);
      this.add.image(rx + pw / 2 - 16 + i * 32, 88, key, frameIndex('down', 'idle')).setScale(1.8);
    }
    txt(this, rx + pw / 2, 122, n.opp.name.toUpperCase(), 8, '#ffffff');
    const conds = [
      PITCHES[n.pitch].name,
      n.weather !== 'sereno' ? n.weather : '',
      n.night ? 'notte' : '',
      `${n.durationSec}s`,
      `CPU ${n.difficulty}`,
    ].filter(Boolean).join(' · ');
    txt(this, rx + pw / 2, 140, conds, 6, '#8a8fb0', { wordWrap: { width: pw - 16 }, align: 'center' });

    // Box Regola Speciale
    panel(g, rx + 10, 162, pw - 20, 86, 0x141626, 0x3fd0ff, 0.95);
    txt(this, rx + pw / 2, 178, 'REGOLA DEL ROUND', 6, '#3fd0ff');
    txt(this, rx + pw / 2, 196, rDef.name, 8, '#ffd23f');
    txt(this, rx + pw / 2, 222, rDef.desc, 6, '#d8dcf0', { wordWrap: { width: pw - 36 }, align: 'center', lineSpacing: 4 });

    txt(this, rx + pw / 2, 272, `Premio vittoria: +${(20 + s.round * 8) * (n.isBoss ? 2 : 1)} monete`, 6, '#ffd23f');
    if (s.round % 3 === 0 || n.isBoss) {
      txt(this, rx + pw / 2, 286, '+ 1 PACCHETTO FIGURINE BONUS', 6, '#5be37d');
    }

    button(this, 58, H - 22, 92, 26, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    button(this, 166, H - 22, 108, 26, 'ABBANDONA', () => {
      save((d) => {
        d.survival = undefined;
      });
      sfx.select();
      this.rebuild();
    }, { color: 0x6a2030, size: 6 });

    const play = button(this, W - 96, H - 24, 164, 30, `GIOCA ROUND ${s.round}!`, () => {
      sfx.unlock();
      startMatch(this, survivalLaunch(s, fixKits));
    }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
    this.tweens.add({ targets: play.c, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- 3. Draft Post-Vittoria (ruba giocatore o prendi bonus) ----------

  private buildDraft(W: number, H: number, s: SurvivalState) {
    const opts = s.pendingDraft ?? [];
    shadowTxt(this, W / 2, 20, `ROUND ${s.round} SUPERATO!`, 16, '#5be37d');
    txt(this, W / 2, 40, 'SCEGLI IL TUO BOTTINO PER IL PROSSIMO ROUND', 7, '#ffd23f');

    const cw = Math.min(168, (W - 44) / 3);
    const ch = 224;
    const gap = 10;
    const x0 = W / 2 - (opts.length * cw + (opts.length - 1) * gap) / 2;
    const y0 = 60;
    const g = this.add.graphics();

    opts.forEach((opt: SurvivalDraftOption, i) => {
      const x = x0 + i * (cw + gap);
      const isSteal = opt.kind === 'steal';
      panel(g, x, y0, cw, ch, 0x1b1d2e, isSteal ? 0x3fd0ff : 0xffd23f, 0.96);

      if (opt.kind === 'steal') {
        const p = opt.player;
        const cur = s.team.players[opt.roleIdx];
        txt(this, x + cw / 2, y0 + 16, 'RUBA GIOCATORE', 6, '#3fd0ff');
        txt(this, x + cw / 2, y0 + 29, `${ROLE_LABEL[p.role]} · OVR ${playerOverall(p)}`, 7, '#ffd23f');

        const key = `surv_draft_${i}`;
        makePlayerSheet(this, key, s.next.opp, p);
        this.add.image(x + cw / 2, y0 + 64, key, frameIndex('down', 'celebrate')).setScale(2);

        txt(this, x + cw / 2, y0 + 100, p.name.toUpperCase(), 8, '#ffffff');
        txt(this, x + cw / 2, y0 + 114, `vs ${cur.name} (${playerOverall(cur)})`, 6, '#8a8fb0');

        const diffs = statDiffs(p, cur);
        if (diffs.length) {
          diffs.forEach((df, di) => {
            const col = df.delta > 0 ? '#5be37d' : '#ff9a9a';
            const sign = df.delta > 0 ? '+' : '';
            txt(this, x + cw / 2, y0 + 136 + di * 14, `${df.label} ${sign}${df.delta}`, 6, col);
          });
        } else {
          txt(this, x + cw / 2, y0 + 144, 'Statistiche simili', 6, '#d8dcf0');
        }
      } else {
        const pk = SURVIVAL_PERKS[opt.perkId];
        txt(this, x + cw / 2, y0 + 16, 'BONUS SQUADRA', 6, '#ffd23f');
        g.fillStyle(0xffd23f, 0.16).fillCircle(x + cw / 2, y0 + 66, 22);
        txt(this, x + cw / 2, y0 + 66, '+', 24, '#ffd23f');
        txt(this, x + cw / 2, y0 + 106, pk.name, 7, '#ffffff', { wordWrap: { width: cw - 16 }, align: 'center' });
        txt(this, x + cw / 2, y0 + 142, pk.desc, 6, '#d8dcf0', { wordWrap: { width: cw - 18 }, align: 'center', lineSpacing: 4 });
      }

      button(this, x + cw / 2, y0 + ch - 22, cw - 20, 24, 'SCEGLI', () => {
        if (!pickDraftOption(s, i)) return;
        save((d) => {
          d.survival = s;
        });
        sfx.coin();
        this.rebuild();
      }, { color: isSteal ? 0x2f6fd0 : COLORS.good, size: 7, textColor: isSteal ? '#ffffff' : '#1a1222' });
    });

    txt(this, W / 2, H - 22, `Rosa attuale: ${s.team.name} · Bonus attivi: ${s.perks.length}`, 6, '#8a8fb0');
  }

  // ---------- 4. Fine Corsa (riepilogo sconfitta) ----------

  private buildGameOver(W: number, H: number, s: SurvivalState, best: number) {
    const sum = s.lastSummary!;
    shadowTxt(this, W / 2, 26, 'CORSA TERMINATA', 18, '#ff5a5a');
    if (sum.newRecord) {
      const rec = txt(this, W / 2, 50, 'NUOVO RECORD PERSONALE!', 8, '#ffd23f');
      this.tweens.add({ targets: rec, scale: 1.08, duration: 450, yoyo: true, repeat: -1 });
    }

    const g = this.add.graphics();
    panel(g, W / 2 - 180, 68, 360, 200, 0x1b1d2e, 0x2e3250, 0.96);

    const rows: [string, string, string?][] = [
      ['ROUND RAGGIUNTO', `ROUND ${sum.roundReached} (${sum.wins} vinti)`, '#ffd23f'],
      ['RECORD PERSONALE', `${Math.max(best, sum.wins)} ROUND SUPERATI`, '#3fd0ff'],
      ['SQUADRA FINALE', sum.teamName, '#ffffff'],
      ['GIOCATORI RUBATI', `${sum.stolen}`, '#5be37d'],
      ['GOL FATTI / SUBITI', `${s.goalsFor} - ${s.goalsAgainst}`, '#d8dcf0'],
      ['MONETE TOTALI VINTE', `+${sum.coins} MONETE`, '#ffd23f'],
    ];

    rows.forEach(([k, v, c], i) => {
      const y = 92 + i * 28;
      g.fillStyle(i % 2 ? 0x202338 : 0x262a42).fillRect(W / 2 - 166, y - 10, 332, 22);
      txt(this, W / 2 - 156, y, k, 6, '#8a8fb0').setOrigin(0, 0.5);
      txt(this, W / 2 + 156, y, v, 7, c ?? '#ffffff').setOrigin(1, 0.5);
    });

    button(this, W / 2 - 86, H - 30, 140, 28, 'MENU', () => {
      save((d) => {
        d.survival = undefined;
      });
      backToMenu(this);
    }, { color: 0x3a3d55 });

    button(this, W / 2 + 86, H - 30, 150, 28, 'NUOVA CORSA', () => {
      save((d) => {
        d.survival = undefined;
      });
      sfx.select();
      this.rebuild();
    }, { color: COLORS.good, textColor: '#1a1222' });
  }
}
