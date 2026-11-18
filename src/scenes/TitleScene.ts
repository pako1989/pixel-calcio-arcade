import Phaser from 'phaser';
import { MODES } from '../modes/modes';
import { button, fadeIn, shadowTxt, txt } from '../ui/ui';
import { goFullscreen, isTouch } from '../ui/fullscreen';
import { sfx } from '../audio/sfx';
import { load, save } from '../save/storage';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    fadeIn(this, 400);
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  private rebuild() {
    this.children.removeAll(true);
    this.build();
  }

  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    // velo scuro a sinistra per leggere il menu, la partita demo resta visibile
    const key = `veil_${W}x${H}`;
    if (!this.textures.exists(key)) {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d')!;
      const gr = ctx.createLinearGradient(0, 0, W * 0.75, 0);
      gr.addColorStop(0, 'rgba(13,10,26,0.88)');
      gr.addColorStop(0.45, 'rgba(13,10,26,0.7)');
      gr.addColorStop(1, 'rgba(13,10,26,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      this.textures.addCanvas(key, cv);
    }
    this.add.image(0, 0, key).setOrigin(0);

    // logo
    const lx = Math.min(170, W * 0.28);
    const logo = this.add.container(lx, 62);
    const l1 = shadowTxt(this, 0, 0, 'PIXEL', 24, '#ffffff', '#1a1222', 3);
    const l2 = shadowTxt(this, 0, 30, 'CALCIO', 32, '#ffd23f', '#a0381e', 4);
    const l3 = shadowTxt(this, 0, 60, 'A R C A D E', 8, '#3fd0ff', '#1a1222', 1);
    logo.add([l1.c, l2.c, l3.c]);
    this.tweens.add({ targets: l2.c, y: 27, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // pallone che rimbalza vicino al logo
    const ball = this.add.image(lx + 108, 82, 'ball').setScale(2);
    this.tweens.add({ targets: ball, y: 58, duration: 380, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: ball, angle: 360, duration: 1400, repeat: -1 });

    // menu
    let y = 150;
    for (const m of MODES) {
      const b = button(
        this,
        lx,
        y,
        210,
        28,
        m.title,
        () => {
          if (!m.available) return;
          if (isTouch()) goFullscreen();
          sfx.unlock();
          this.scene.launch(m.scene, { mode: m.id });
          this.scene.stop();
        },
        {
          color: !m.available ? 0x3a3d55 : m.id === 'mito' ? 0x8a3fd0 : m.id === 'conquista' ? 0x2f9a50 : m.id === 'quick' ? 0xe8443a : 0x2f6fd0,
          badge: !m.available ? 'PRESTO' : m.id === 'mito' ? 'STORIA' : m.id === 'conquista' ? 'NUOVO' : undefined,
          size: 8,
        },
      );
      if (!m.available) b.setEnabled(false);
      y += 34;
    }

    // record e opzioni
    const r = load().record;
    this.add.rectangle(lx, H - 16, 220, 14, 0x0d0a1a, 0.85);
    txt(this, lx, H - 16, `Partite ${r.played}  V ${r.won}  P ${r.drawn}  S ${r.lost}`, 6, '#8a8fb0');
    const mute = button(this, W - 30, H - 24, 36, 24, load().settings.muted ? 'x' : '♪', () => {
      save((d) => (d.settings.muted = !d.settings.muted));
      sfx.setMuted(load().settings.muted);
      mute.setLabel(load().settings.muted ? 'x' : '♪');
    });
    if (isTouch()) {
      button(this, W - 74, H - 24, 36, 24, '[ ]', () => goFullscreen());
    }
    txt(this, W - 8, 10, 'v0.2', 6, '#8a8fb0').setOrigin(1, 0.5);
  }
}
