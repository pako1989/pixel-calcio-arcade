import Phaser from 'phaser';
import { COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { portrait, type Expr } from '../gfx/animeArt';
import { CAST, type LgLine } from '../modes/leggendaStory';
import { sfx } from '../audio/sfx';

/** Personaggi che stanno dalla parte di Nico (ritratto a sinistra). */
const ALLIES = new Set(['nico', 'nicokid', 'dario', 'dariokid', 'gigi', 'bea', 'pippo']);

/** Espressione del ritratto indovinata dal tono della battuta. */
export function exprOf(text: string): Expr {
  if (/^(Bravi|Complimenti|Grazie|Come ai vecchi|Non male|Ci conto|Promesso|Nico!|Te l'avevo promesso)/.test(text)) return 'sorriso';
  if (/Ah\.\.\.|brucia|tremano|Non adesso|Impossibile/.test(text)) return 'triste';
  if (/[A-ZÀÈÌÒÙ']{5,}/.test(text) || /!.*!/.test(text) || /\?!/.test(text)) return 'urlo';
  if (/!/.test(text)) return 'grinta';
  return 'normale';
}

const CPS = 50;

/**
 * Dialoghi in stile anime: ritratti grandi, testo che scorre, ricordi in color seppia.
 * 'full' copre tutto lo schermo (storia), 'overlay' è una striscia sopra la partita.
 */
export class LgTalk {
  private c: Phaser.GameObjects.Container;
  private idx = 0;
  private shown = 0;
  private full = '';
  private body?: Phaser.GameObjects.Text;
  private resolve?: () => void;
  private lastBlip = 0;
  private lastOther: LgLine | null = null;

  constructor(
    private scene: Phaser.Scene,
    private lines: LgLine[],
    private mode: 'full' | 'overlay',
    private fill: (s: string) => string = (s) => s,
  ) {
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(5000);
  }

  play(): Promise<void> {
    if (!this.lines.length) return Promise.resolve();
    return new Promise((res) => {
      this.resolve = res;
      this.idx = 0;
      this.render();
      this.scene.events.on('update', this.tick, this);
    });
  }

  private tick(_t: number, dms: number) {
    if (!this.body || this.shown >= this.full.length) return;
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.full.length, this.shown + (dms / 1000) * CPS);
    const n = Math.floor(this.shown);
    if (n !== before) {
      this.body.setText(this.full.slice(0, n));
      const now = this.scene.time.now;
      if (now - this.lastBlip > 70 && this.full[n - 1] !== ' ') {
        this.lastBlip = now;
        sfx.blip();
      }
    }
  }

  private advance() {
    if (this.body && this.shown < this.full.length) {
      this.shown = this.full.length;
      this.body.setText(this.full);
      return;
    }
    this.idx++;
    if (this.idx >= this.lines.length) {
      this.scene.events.off('update', this.tick, this);
      this.c.destroy();
      this.resolve?.();
      return;
    }
    this.render();
  }

  private render() {
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    this.c.removeAll(true);
    this.body = undefined;
    const line = this.lines[this.idx];
    const fb = !!line.fb;
    const full = this.mode === 'full';

    // sfondo
    const g = s.add.graphics();
    this.c.add(g);
    if (full) {
      g.fillStyle(fb ? 0x2a1e14 : 0x120e24).fillRect(0, 0, W, H);
      // raggi di luce diagonali
      for (let i = 0; i < 9; i++) {
        const x = ((i * 131) % (W + 200)) - 100;
        g.fillStyle(fb ? 0x5a4428 : 0x2a2458, 0.35).fillPoints([
          new Phaser.Geom.Point(x, 0), new Phaser.Geom.Point(x + 40, 0), new Phaser.Geom.Point(x - 60, H), new Phaser.Geom.Point(x - 100, H),
        ], true);
      }
      if (fb) {
        // vignettatura del ricordo
        for (let i = 0; i < 6; i++) g.fillStyle(0x000000, 0.12).fillRect(0, 0, W, 6 + i * 5).fillRect(0, H - 6 - i * 5, W, 6 + i * 5);
        this.c.add(txt(s, 14, 14, '~ RICORDO ~', 6, '#e8c890').setOrigin(0, 0.5));
      }
    } else {
      g.fillStyle(0x000000, 0.35).fillRect(0, H - 98, W, 98);
    }
    const zone = s.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    zone.on('pointerup', () => this.advance());
    this.c.add(zone);
    if (fb && !full) this.c.add(txt(s, 14, H - 104, '~ RICORDO ~', 6, '#e8c890').setOrigin(0, 0.5));

    if (line.who === 'title') {
      const parts = this.fill(line.text).split('\n');
      const t1 = shadowTxt(s, W / 2, H / 2 - 26, parts[0], 8, '#3fd0ff');
      const big = (parts[1] ?? '').length > 16 ? 14 : 20;
      const t2 = shadowTxt(s, W / 2, H / 2 + 6, parts[1] ?? '', big, '#ffd23f', '#a0381e', 3);
      this.c.add([t1.c, t2.c]);
      t2.c.setScale(0.5).setAlpha(0);
      s.tweens.add({ targets: t2.c, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
      // linee di velocità
      const sl = s.add.graphics();
      for (let i = 0; i < 14; i++) {
        const y = H / 2 - 60 + i * 9;
        sl.fillStyle(0xffffff, 0.08).fillRect(0, y, W, 1);
      }
      this.c.addAt(sl, 1);
      this.c.add(txt(s, W / 2, H - 26, 'TOCCA PER CONTINUARE', 6, '#8a8fb0'));
      this.full = '';
      sfx.fanfare();
      return;
    }

    const narr = line.who === 'narr';
    const ch = CAST[line.who];
    const left = narr ? true : ALLIES.has(line.who);
    const boxH = full ? 92 : 78;
    const by = H - boxH - 10;
    const pScale = full ? 3 : 1.5;
    const portraitSize = 48 * pScale;

    // ritratti: chi parla acceso, l'interlocutore precedente in ombra
    if (!narr && ch) {
      if (full && this.lastOther && this.lastOther.who !== line.who && ALLIES.has(this.lastOther.who) !== left && CAST[this.lastOther.who]) {
        const o = CAST[this.lastOther.who];
        const k = portrait(s, this.lastOther.who, o.face, o.shirt, { sepia: !!this.lastOther.fb });
        const ox = left ? W - 20 - portraitSize / 2 : 20 + portraitSize / 2;
        const oi = s.add.image(ox, by + 4, k).setScale(pScale).setOrigin(0.5, 1).setTint(0x50506a).setFlipX(!left);
        this.c.add(oi);
      }
      const key = portrait(s, line.who, ch.face, ch.shirt, { expr: exprOf(line.text), sepia: fb });
      const px = full ? (left ? 20 + portraitSize / 2 : W - 20 - portraitSize / 2) : left ? 16 + portraitSize / 2 : W - 16 - portraitSize / 2;
      const py = full ? by + 4 : by + boxH - 4;
      const img = s.add.image(px + (left ? -30 : 30), py, key).setScale(pScale).setOrigin(0.5, 1).setFlipX(!left);
      this.c.add(img);
      s.tweens.add({ targets: img, x: px, duration: 180, ease: 'Quad.easeOut' });
      this.lastOther = line;
    }

    // riquadro
    const pg = s.add.graphics();
    this.c.add(pg);
    const inset = !full && !narr ? portraitSize + 14 : 0;
    const bx = 12 + (left ? inset : 0);
    const bw = W - 24 - inset;
    const border = narr ? 0x8a8fb0 : left ? COLORS.accent : 0x3fd0ff;
    panel(pg, bx, by, bw, boxH, fb ? 0x2e2418 : 0x1b1d2e, border, 0.96);
    if (!narr && ch) {
      const tag = txt(s, left ? bx + 10 : bx + bw - 10, by - 6, ch.name.toUpperCase(), 7, '#1a1222', {
        backgroundColor: left ? '#ffd23f' : '#3fd0ff',
        padding: { x: 5, y: 3 },
      }).setOrigin(left ? 0 : 1, 0.5);
      this.c.add(tag);
    }
    this.full = this.fill(line.text);
    this.shown = 0;
    this.body = txt(s, bx + 12, by + 14, '', full ? 8 : 7, narr ? '#ffe9a0' : '#ffffff', {
      wordWrap: { width: bw - 24 },
      lineSpacing: full ? 8 : 6,
    }).setOrigin(0, 0);
    this.c.add(this.body);
    const more = txt(s, bx + bw - 12, by + boxH - 10, '▼', 7, '#ffd23f');
    this.c.add(more);
    s.tweens.add({ targets: more, y: more.y + 3, duration: 350, yoyo: true, repeat: -1 });
  }
}
