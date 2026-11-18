import Phaser from 'phaser';
import type { MatchOutcome } from '../modes/modes';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { save } from '../save/storage';
import { backToMenu } from './demo';

export class ResultScene extends Phaser.Scene {
  private data_!: MatchOutcome;
  constructor() {
    super('result');
  }
  init(d: MatchOutcome) {
    this.data_ = d;
    const r = d.result;
    if (d.launch.config.humanTeam === 0) {
      save((s) => {
        s.record.played++;
        s.record.goalsFor += r.score[0];
        s.record.goalsAgainst += r.score[1];
        if (r.score[0] > r.score[1]) s.record.won++;
        else if (r.score[0] < r.score[1]) s.record.lost++;
        else s.record.drawn++;
      });
    }
  }
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const { launch, result } = this.data_;
    const cfg = launch.config;
    const [a, b] = result.score;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.72).setOrigin(0).setInteractive();
    const title = a > b ? 'VITTORIA!' : a < b ? 'SCONFITTA' : 'PAREGGIO';
    const col = a > b ? '#ffd23f' : a < b ? '#ff5a5a' : '#ffffff';
    const t = shadowTxt(this, W / 2, 34, title, 24, col, '#1a1222', 3);
    t.c.setScale(0.3);
    this.tweens.add({ targets: t.c, scale: 1, duration: 450, ease: 'Back.easeOut' });

    const g = this.add.graphics();
    panel(g, W / 2 - 170, 62, 340, 210, 0x1b1d2e, 0x2e3250, 0.95);
    g.fillStyle(cfg.home.colors.shirt).fillRect(W / 2 - 160, 72, 8, 24);
    g.fillStyle(cfg.away.colors.shirt).fillRect(W / 2 + 152, 72, 8, 24);
    txt(this, W / 2 - 100, 84, cfg.home.short, 8);
    txt(this, W / 2 + 100, 84, cfg.away.short, 8);
    shadowTxt(this, W / 2, 84, `${a} - ${b}`, 24, '#ffffff');
    if (result.goldenGoal) txt(this, W / 2, 106, 'GOLDEN GOL', 6, '#ffd23f');

    // marcatori
    const home = result.scorers.filter((s) => s.team === 0);
    const away = result.scorers.filter((s) => s.team === 1);
    const fmt = (s: { name: string; time: number }) => `${s.name} ${Math.max(1, Math.ceil(s.time / 60))}'`;
    home.slice(0, 4).forEach((s, i) => txt(this, W / 2 - 100, 120 + i * 11, fmt(s), 6, '#d8dcf0'));
    away.slice(0, 4).forEach((s, i) => txt(this, W / 2 + 100, 120 + i * 11, fmt(s), 6, '#d8dcf0'));

    // statistiche
    const st = result.stats;
    const rows: [string, number, number, string?][] = [
      ['TIRI', st.shots[0], st.shots[1]],
      ['PASSAGGI', st.passes[0], st.passes[1]],
      ['CONTRASTI', st.tackles[0], st.tackles[1]],
      ['POSSESSO', st.possession[0], st.possession[1], '%'],
    ];
    rows.forEach(([label, x, y, suf], i) => {
      const yy = 176 + i * 22;
      txt(this, W / 2, yy - 6, label, 6, '#8a8fb0');
      txt(this, W / 2 - 140, yy, `${x}${suf ?? ''}`, 8).setOrigin(0, 0.5);
      txt(this, W / 2 + 140, yy, `${y}${suf ?? ''}`, 8).setOrigin(1, 0.5);
      const tot = x + y || 1;
      const bw = 180;
      g.fillStyle(0x2e3250).fillRect(W / 2 - bw / 2, yy + 2, bw, 4);
      g.fillStyle(cfg.home.colors.shirt).fillRect(W / 2 - bw / 2, yy + 2, Math.round((bw * x) / tot), 4);
      g.fillStyle(cfg.away.colors.shirt).fillRect(W / 2 - bw / 2 + Math.round((bw * x) / tot), yy + 2, bw - Math.round((bw * x) / tot), 4);
    });

    button(this, W / 2 - 80, H - 34, 140, 30, 'RIVINCITA', () => {
      const match = this.scene.get('match');
      match.scene.restart(launch);
      this.scene.stop();
    }, { color: COLORS.good, textColor: '#1a1222' });
    button(this, W / 2 + 80, H - 34, 140, 30, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
  }
}
