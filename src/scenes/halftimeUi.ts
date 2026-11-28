import Phaser from 'phaser';
import type { MatchSim } from '../sim/match';
import { MAX_SUBS } from '../sim/match';
import { overall } from '../sim/bench';
import { FORMATIONS_11, FORMATIONS_5, type Tactic } from '../sim/types';
import { button, panel, shadowTxt, txt } from '../ui/ui';

const TACTICS: Tactic[] = ['difesa', 'equilibrio', 'attacco'];
const TACTIC_NAME: Record<Tactic, string> = { difesa: 'DIFESA', equilibrio: 'EQUILIBRIO', attacco: 'ATTACCO' };

/** Schermata dell'intervallo: statistiche del primo tempo, cambi, modulo e tattica. */
export class HalftimeUi {
  readonly c: Phaser.GameObjects.Container;
  private sel: number | null = null;
  private note = '';

  constructor(
    private scene: Phaser.Scene,
    private sim: MatchSim,
    private onResume: () => void,
  ) {
    this.c = scene.add.container(0, 0).setDepth(900);
    this.build();
  }

  destroy() {
    this.c.destroy();
  }

  /** Ricostruisce la schermata (dopo un cambio di larghezza o una scelta). */
  build() {
    const sc = this.scene;
    const sim = this.sim;
    const W = sc.scale.width;
    const H = sc.scale.height;
    const t = (sim.humanTeam ?? 0) as 0 | 1;
    const c = this.c;
    c.removeAll(true);

    c.add(sc.add.rectangle(0, 0, W, H, 0x0a0816, 0.82).setOrigin(0).setInteractive());
    const g = sc.add.graphics();
    c.add(g);
    panel(g, 12, 8, W - 24, H - 16, 0x1b1d2e, 0x2e3250, 0.97);
    c.add(shadowTxt(sc, W / 2, 26, 'INTERVALLO', 16, '#ffd23f').c);
    const { home, away } = sim.cfg;
    c.add(txt(sc, W / 2, 50, `${home.short}  ${sim.score[0]} - ${sim.score[1]}  ${away.short}`, 10, '#ffffff'));

    // --- statistiche del primo tempo ---
    const lx = 28;
    const lw = Math.min(200, Math.round(W * 0.34));
    c.add(txt(sc, lx + lw / 2, 76, 'PRIMO TEMPO', 6, '#8a8fb0'));
    const tot = sim.stats.possession[0] + sim.stats.possession[1] || 1;
    const rows: [string, number, number][] = [
      ['TIRI', sim.stats.shots[0], sim.stats.shots[1]],
      ['PASSAGGI', sim.stats.passes[0], sim.stats.passes[1]],
      ['CONTRASTI', sim.stats.tackles[0], sim.stats.tackles[1]],
      ['POSSESSO %', Math.round((sim.stats.possession[0] / tot) * 100), Math.round((sim.stats.possession[1] / tot) * 100)],
    ];
    rows.forEach(([label, a, b], i) => {
      const y = 100 + i * 42;
      c.add(txt(sc, lx + lw / 2, y, label, 6, '#d8dcf0'));
      c.add(txt(sc, lx, y + 14, String(a), 8, '#ffffff').setOrigin(0, 0.5));
      c.add(txt(sc, lx + lw, y + 14, String(b), 8, '#ffffff').setOrigin(1, 0.5));
      const bw = lw - 64;
      const bx = lx + 32;
      const share = a + b > 0 ? a / (a + b) : 0.5;
      g.fillStyle(0x1a1222).fillRect(bx, y + 10, bw, 8);
      g.fillStyle(t === 0 ? 0x3fd0ff : 0x5be37d).fillRect(bx + 1, y + 11, Math.round((bw - 2) * share), 6);
      g.fillStyle(t === 0 ? 0x5be37d : 0x3fd0ff, 0.55).fillRect(bx + 1 + Math.round((bw - 2) * share), y + 11, bw - 2 - Math.round((bw - 2) * share), 6);
    });

    // --- cambi ---
    const rx = lx + lw + 24;
    const rw = W - 28 - rx;
    const left = sim.subsLeft[t];
    c.add(txt(sc, rx, 76, `CAMBI: ${left} su ${MAX_SUBS}`, 6, left > 0 ? '#ffd23f' : '#8a8fb0').setOrigin(0, 0.5));
    c.add(txt(sc, rx + rw, 76, this.note || (this.sel === null ? 'Tocca chi esce' : 'Ora tocca la riserva'), 6, '#8a8fb0').setOrigin(1, 0.5));
    const slots = sim.teams[t].filter((p) => !p.isGK);
    // con 11 giocatori i titolari stanno su due colonne più compatte
    const two = slots.length > 5;
    const rowH = two ? 21 : 26;
    const bh = two ? 18 : 22;
    slots.forEach((p, i) => {
      const col = two ? i % 2 : 0;
      const row = two ? Math.floor(i / 2) : i;
      const cw = two ? (rw - 4) / 2 : rw;
      const cx = rx + cw / 2 + col * (cw + 4);
      const y = 94 + row * rowH;
      const fit = Math.round(p.fitness * 100);
      const label = two
        ? `${p.def.number} ${p.def.name.toUpperCase().slice(0, 7)} ${fit}%`
        : `${p.def.number} ${p.def.name.toUpperCase()}  ${p.def.role}  OVR ${overall(p.def)}  FIATO ${fit}%`;
      const b = button(sc, cx, y, cw, bh, label, () => {
        this.sel = this.sel === p.idx ? null : p.idx;
        this.note = '';
        this.build();
      }, { size: 6, color: fit < 70 ? 0x7a3a2a : 0x353a5c });
      b.setSelected(this.sel === p.idx);
      c.add(b.c);
    });
    const slotRows = two ? Math.ceil(slots.length / 2) : slots.length;
    const benchTop = 94 + slotRows * rowH + 4;
    c.add(txt(sc, rx, benchTop, 'PANCHINA', 6, '#8a8fb0').setOrigin(0, 0.5));
    sim.bench[t].forEach((r, i) => {
      const y = benchTop + 18 + i * rowH;
      const b = button(sc, rx + rw / 2, y, rw, bh, `${r.def.number} ${r.def.name.toUpperCase()}  ${r.def.role}  OVR ${overall(r.def)}  FIATO ${Math.round(r.fitness * 100)}%`, () => {
        if (this.sel === null) {
          this.note = 'Prima scegli chi esce';
          this.build();
          return;
        }
        const ok = sim.substitute(t, this.sel, i);
        this.note = ok ? 'Cambio fatto!' : 'Cambi finiti';
        this.sel = null;
        this.build();
      }, { size: 6, color: 0x2a5a4a });
      b.setEnabled(left > 0);
      c.add(b.c);
    });

    // --- modulo, tattica, secondo tempo ---
    const fy = H - 44;
    const bwid = Math.min(150, Math.floor((W - 56) / 3) - 6);
    const list = sim.teamSize > 5 ? FORMATIONS_11 : FORMATIONS_5;
    const cur = t === 0 ? sim.cfg.formation : sim.cfg.awayFormation;
    const fNow = cur && list.includes(cur) ? cur : list[0];
    const bf = button(sc, W / 2 - bwid - 10, fy, bwid, 26, `MODULO ${fNow}`, () => {
      sim.setFormation(t, list[(list.indexOf(fNow) + 1) % list.length]);
      this.build();
    }, { size: 6, color: 0x2a5a7a });
    const bt = button(sc, W / 2, fy, bwid, 26, TACTIC_NAME[sim.tactic[t]], () => {
      sim.setTactic(t, TACTICS[(TACTICS.indexOf(sim.tactic[t]) + 1) % 3]);
      this.build();
    }, { size: 6, color: 0x2a7a5a });
    const bgo = button(sc, W / 2 + bwid + 10, fy, bwid, 26, 'SECONDO TEMPO', () => this.onResume(), { size: 7, color: 0x2f8be0 });
    c.add([bf.c, bt.c, bgo.c]);
  }
}
