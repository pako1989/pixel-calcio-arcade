import Phaser from 'phaser';
import { TEAMS } from '../data/teams';
import { PITCHES, PITCH_ORDER } from '../data/pitches';
import { arrow, button, COLORS, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { load, save } from '../save/storage';
import { makePlayerSheet, frameIndex } from '../gfx/sprites';
import type { Difficulty, PitchId, TeamDef } from '../sim/types';
import type { MatchLaunch } from '../modes/modes';
import { fixKits, backToMenu } from './demo';
import { sfx } from '../audio/sfx';

const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];
const DURS = [120, 150, 180, 300];

export class SetupScene extends Phaser.Scene {
  private home = 0;
  private away = 1;
  private pitch = 0;
  private diff: Difficulty = 'normale';
  private dur = 150;
  private pu = true;

  constructor() {
    super('setup');
  }

  create() {
    const s = load().settings;
    this.home = Math.max(0, TEAMS.findIndex((t) => t.id === s.homeTeam));
    this.away = Math.max(0, TEAMS.findIndex((t) => t.id === s.awayTeam));
    if (this.away === this.home) this.away = (this.home + 1) % TEAMS.length;
    this.pitch = Math.max(0, PITCH_ORDER.indexOf(s.pitch as PitchId));
    this.diff = (DIFFS.includes(s.difficulty as Difficulty) ? s.difficulty : 'normale') as Difficulty;
    this.dur = DURS.includes(s.duration) ? s.duration : 150;
    this.pu = s.powerUps;
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  private rebuild() {
    this.children.removeAll(true);
    this.build();
  }

  private teamCard(cx: number, cy: number, label: string, idx: number, onChange: (d: -1 | 1) => void) {
    const t = TEAMS[idx];
    const g = this.add.graphics();
    panel(g, cx - 92, cy - 52, 184, 104, 0x1b1d2e, 0x2e3250, 0.92);
    txt(this, cx, cy - 42, label, 6, label === 'TU' ? '#ffd23f' : '#ff9a9a');
    // maglia di anteprima: due giocatori
    const shown: TeamDef = label === 'CPU' ? fixKits(TEAMS[this.home], t) : t;
    for (let i = 0; i < 2; i++) {
      const key = `prev_${label}_${i}`;
      makePlayerSheet(this, key, shown, shown.players[i + 3]);
      this.add.image(cx - 14 + i * 28, cy - 6, key, frameIndex('down', i === 0 ? 'idle' : 'celebrate')).setScale(2);
    }
    txt(this, cx, cy + 26, t.name.toUpperCase(), 8, '#ffffff');
    // stelle di forza
    for (let i = 0; i < 5; i++) {
      const sx = cx - 28 + i * 14;
      const sy = cy + 40;
      const on = i < t.stars;
      g.fillStyle(on ? 0xffd23f : 0x3a3d55);
      g.fillRect(sx - 1, sy - 4, 3, 9);
      g.fillRect(sx - 4, sy - 1, 9, 3);
      g.fillRect(sx - 2, sy - 2, 5, 5);
    }
    arrow(this, cx - 76, cy - 6, -1, () => onChange(-1));
    arrow(this, cx + 76, cy - 6, 1, () => onChange(1));
  }

  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.78).setOrigin(0).setInteractive();
    shadowTxt(this, W / 2, 18, 'PARTITA VELOCE', 16, '#ffd23f');

    const cy = 92;
    const gap = Math.min(110, W * 0.17);
    this.teamCard(W / 2 - gap, cy, 'TU', this.home, (d) => {
      this.home = (this.home + d + TEAMS.length) % TEAMS.length;
      if (this.home === this.away) this.home = (this.home + d + TEAMS.length) % TEAMS.length;
      sfx.select();
      this.rebuild();
    });
    shadowTxt(this, W / 2, cy - 6, 'VS', 16, '#ffffff');
    this.teamCard(W / 2 + gap, cy, 'CPU', this.away, (d) => {
      this.away = (this.away + d + TEAMS.length) % TEAMS.length;
      if (this.home === this.away) this.away = (this.away + d + TEAMS.length) % TEAMS.length;
      sfx.select();
      this.rebuild();
    });

    // campo
    const p = PITCHES[PITCH_ORDER[this.pitch]];
    const g = this.add.graphics();
    panel(g, W / 2 - 200, 156, 400, 46, 0x1b1d2e, 0x2e3250, 0.92);
    txt(this, W / 2, 168, 'CAMPO: ' + p.name.toUpperCase(), 8, '#3fd0ff');
    txt(this, W / 2, 186, p.rule, 6, '#d8dcf0', { wordWrap: { width: 330 }, align: 'center' });
    arrow(this, W / 2 - 184, 179, -1, () => {
      this.pitch = (this.pitch - 1 + PITCH_ORDER.length) % PITCH_ORDER.length;
      sfx.select();
      this.rebuild();
    });
    arrow(this, W / 2 + 184, 179, 1, () => {
      this.pitch = (this.pitch + 1) % PITCH_ORDER.length;
      sfx.select();
      this.rebuild();
    });

    // opzioni
    const row = (y: number, label: string, items: string[], sel: number, onPick: (i: number) => void) => {
      txt(this, W / 2 - 150, y, label, 6, '#8a8fb0').setOrigin(1, 0.5);
      const bw = Math.min(84, 300 / items.length - 6);
      const bs: Button[] = [];
      items.forEach((it, i) => {
        const b = button(this, W / 2 - 140 + bw / 2 + i * (bw + 6), y, bw, 20, it, () => {
          onPick(i);
          bs.forEach((x, j) => x.setSelected(j === i));
        }, { size: 6 });
        b.setSelected(i === sel);
        bs.push(b);
      });
    };
    row(222, 'CPU', ['FACILE', 'NORMALE', 'DIFFICILE'], DIFFS.indexOf(this.diff), (i) => (this.diff = DIFFS[i]));
    row(248, 'DURATA', DURS.map((d) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`), DURS.indexOf(this.dur), (i) => (this.dur = DURS[i]));
    row(274, 'POWER-UP', ['SÌ', 'NO'], this.pu ? 0 : 1, (i) => (this.pu = i === 0));

    button(this, 64, H - 28, 96, 28, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const play = button(this, W - 90, H - 30, 150, 34, 'GIOCA!', () => this.start(), { color: COLORS.good, size: 16, textColor: '#1a1222' });
    this.tweens.add({ targets: play.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private start() {
    const home = TEAMS[this.home];
    const away = fixKits(home, TEAMS[this.away]);
    const pitch = PITCHES[PITCH_ORDER[this.pitch]];
    save((d) => {
      d.settings.homeTeam = home.id;
      d.settings.awayTeam = TEAMS[this.away].id;
      d.settings.pitch = pitch.id;
      d.settings.difficulty = this.diff;
      d.settings.duration = this.dur;
      d.settings.powerUps = this.pu;
    });
    const launch: MatchLaunch = {
      mode: 'quick',
      config: {
        home,
        away,
        pitch,
        difficulty: this.diff,
        durationSec: this.dur,
        powerUps: this.pu,
        goldenGoal: true,
        humanTeam: 0,
      },
    };
    sfx.unlock();
    const match = this.scene.get('match');
    match.scene.restart(launch);
    this.scene.stop();
  }
}
