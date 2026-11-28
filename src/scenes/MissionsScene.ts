import Phaser from 'phaser';
import { teamById } from '../data/teams';
import { PITCHES } from '../data/pitches';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load } from '../save/storage';
import type { MatchLaunch } from '../modes/modes';
import { isUnlocked, missionReward, MISSIONS, objectiveText, type MissionDef } from '../modes/missions';
import { backToMenu, fixKits, startMatch } from './demo';
import { sfx } from '../audio/sfx';

/** Elenco delle missioni a griglia, con dettaglio della missione scelta. */
export class MissionsScene extends Phaser.Scene {
  private sel = 0;

  constructor() {
    super('missions');
  }

  create() {
    const done = load().missions?.done ?? {};
    // si parte dalla prima missione non ancora completata
    const first = MISSIONS.findIndex((m, i) => !done[m.id] && isUnlocked(i, done));
    this.sel = first < 0 ? 0 : first;
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
    const done = load().missions?.done ?? {};
    const nDone = MISSIONS.filter((m) => done[m.id]).length;
    shadowTxt(this, W / 2, 18, 'MISSIONI', 16, '#3fd0ff');
    txt(this, W - 14, 18, `${nDone}/${MISSIONS.length}`, 8, nDone === MISSIONS.length ? '#ffd23f' : '#8a8fb0').setOrigin(1, 0.5);

    const cols = 6;
    const rows = Math.ceil(MISSIONS.length / cols);
    const gap = 4;
    const cw = Math.min(84, (W - 32 - gap * (cols - 1)) / cols);
    const ch = 30;
    const x0 = W / 2 - (cols * cw + (cols - 1) * gap) / 2;
    const y0 = 32;
    const g = this.add.graphics();
    MISSIONS.forEach((m, i) => {
      const x = x0 + (i % cols) * (cw + gap);
      const y = y0 + Math.floor(i / cols) * (ch + gap);
      const unlocked = isUnlocked(i, done);
      const isSel = i === this.sel;
      const fill = !unlocked ? 0x16172a : done[m.id] ? 0x1f4a33 : 0x22253a;
      g.fillStyle(0x1a1222).fillRect(x - 2, y - 2, cw + 4, ch + 4);
      g.fillStyle(fill).fillRect(x, y, cw, ch);
      if (isSel) g.lineStyle(2, COLORS.accent).strokeRect(x - 1, y - 1, cw + 2, ch + 2);
      txt(this, x + 5, y + 7, String(i + 1), 7, unlocked ? '#ffd23f' : '#3a3d55').setOrigin(0, 0.5);
      if (!unlocked) {
        g.fillStyle(0x3a3d55).fillRect(x + cw / 2 - 5, y + 14, 10, 7);
        g.lineStyle(2, 0x3a3d55).strokeRect(x + cw / 2 - 3, y + 10, 6, 6);
      } else {
        const t = teamById(m.team);
        g.fillStyle(t.colors.shirt).fillRect(x + cw - 13, y + 3, 7, 8);
        g.fillStyle(t.colors.shirt2).fillRect(x + cw - 9, y + 3, 2, 8);
        txt(this, x + cw / 2, y + 21, m.title, 5, '#ffffff', { wordWrap: { width: cw - 6 }, align: 'center' });
        if (done[m.id]) {
          g.fillStyle(COLORS.good).fillRect(x + cw - 24, y + 4, 7, 3).fillRect(x + cw - 22, y + 7, 3, 3);
        }
      }
      const z = this.add.zone(x + cw / 2, y + ch / 2, cw + 4, ch + 4).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (!unlocked) return;
        this.sel = i;
        sfx.select();
        this.build();
      });
    });

    // dettaglio
    const m = MISSIONS[this.sel];
    const dy = y0 + rows * (ch + gap) + 4;
    const pg = this.add.graphics();
    const pw = Math.min(W - 32, 520);
    const ph = H - 44 - dy;
    panel(pg, W / 2 - pw / 2, dy, pw, ph, 0x1b1d2e, 0x2e3250, 0.95);
    const lx = W / 2 - pw / 2 + 12;
    const rx = W / 2 + pw / 2 - 12;
    txt(this, lx, dy + 12, `${this.sel + 1}. ${m.title}`, 8, '#ffd23f').setOrigin(0, 0.5);
    const rw = missionReward(m);
    txt(
      this,
      rx,
      dy + 12,
      done[m.id] ? 'COMPLETATA' : `PREMIO +${rw} MONETE`,
      6,
      done[m.id] ? '#5be37d' : '#ffd23f',
    ).setOrigin(1, 0.5);
    txt(this, lx, dy + 24, m.brief, 6, '#d8dcf0', { wordWrap: { width: pw - 24 }, lineSpacing: 3 }).setOrigin(0, 0);
    m.goals.forEach((o, i) => {
      const yy = dy + 52 + i * 12;
      pg.fillStyle(COLORS.accent2).fillRect(lx, yy - 3, 6, 6);
      txt(this, lx + 12, yy, objectiveText(o), 6, '#ffffff').setOrigin(0, 0.5);
    });
    const extras = [
      m.weather ? m.weather : '',
      m.night ? 'notte' : '',
      m.mods?.alwaysFire ? 'tiro fuoco' : '',
      m.mods?.superMult && m.mods.superMult > 1 ? `super ${m.mods.superMult}x` : '',
      m.startScore ? `si parte ${m.startScore[0]}-${m.startScore[1]}` : '',
      m.powerUps ? '' : 'no power-up',
    ].filter(Boolean);
    const info = `${teamById(m.team).short} vs ${teamById(m.opp).short} · ${PITCHES[m.pitch].name} · CPU ${m.difficulty} · ${Math.floor(m.duration / 60)}:${String(m.duration % 60).padStart(2, '0')}${extras.length ? ' · ' + extras.join(' · ') : ''}`;
    txt(this, lx, dy + ph - 11, info, 6, '#8a8fb0').setOrigin(0, 0.5);

    button(this, 64, H - 22, 96, 26, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const play = button(this, W - 90, H - 24, 150, 30, 'GIOCA!', () => this.play(m), { color: COLORS.good, size: 16, textColor: '#1a1222' });
    this.tweens.add({ targets: play.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private play(m: MissionDef) {
    const home = teamById(m.team);
    const launch: MatchLaunch = {
      mode: 'missioni',
      modeData: { mission: m.id },
      startScore: m.startScore,
      superStart: m.superStart,
      forceSpecials: m.goals.some((o) => o.kind === 'special'),
      hudGoal: m.goals.map(objectiveText).join(' + ').toUpperCase(),
      config: {
        home,
        away: fixKits(home, teamById(m.opp)),
        pitch: PITCHES[m.pitch],
        difficulty: m.difficulty,
        durationSec: m.duration,
        powerUps: m.powerUps,
        formation: load().settings.formation,
        goldenGoal: m.goldenGoal,
        humanTeam: 0,
        weather: m.weather,
        night: m.night,
        mods: m.mods,
      },
    };
    sfx.unlock();
    startMatch(this, launch);
  }
}
