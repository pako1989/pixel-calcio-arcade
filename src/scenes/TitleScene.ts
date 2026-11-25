import Phaser from 'phaser';
import { MODES } from '../modes/modes';
import { button, fadeIn, panel, shadowTxt, txt } from '../ui/ui';
import { goFullscreen, isTouch } from '../ui/fullscreen';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { dailyState } from '../modes/daily';
import { load } from '../save/storage';
import { CHANGELOG, VERSION_TAG } from '../ui/version';

export class TitleScene extends Phaser.Scene {
  private modal?: Phaser.GameObjects.Container;

  constructor() {
    super('title');
  }

  create() {
    fadeIn(this, 400);
    music.play('menu');
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.rebuild, this);
      this.modal = undefined;
    });
  }

  private rebuild() {
    this.modal = undefined;
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
    const logo = this.add.container(lx, 36);
    const l1 = shadowTxt(this, 0, 0, 'PIXEL', 24, '#ffffff', '#1a1222', 3);
    const l2 = shadowTxt(this, 0, 30, 'CALCIO', 32, '#ffd23f', '#a0381e', 4);
    const l3 = shadowTxt(this, 0, 58, 'A R C A D E', 8, '#3fd0ff', '#1a1222', 1);
    logo.add([l1.c, l2.c, l3.c]);
    this.tweens.add({ targets: l2.c, y: 27, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // pallone che rimbalza vicino al logo
    const ball = this.add.image(lx + 108, 56, 'ball').setScale(2);
    this.tweens.add({ targets: ball, y: 32, duration: 380, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: ball, angle: 360, duration: 1400, repeat: -1 });

    // menu
    let y = 112;
    const sv = load();
    const survBest = sv.survivalBest?.bestRound ?? 0;
    const wt = sv.worldTour;
    for (const m of MODES) {
      const b = button(
        this,
        lx,
        y,
        210,
        20,
        m.title,
        () => {
          if (!m.available) return;
          if (isTouch()) goFullscreen();
          sfx.unlock();
          this.scene.launch(m.scene, { mode: m.id });
          this.scene.stop();
        },
        {
          color: !m.available ? 0x3a3d55 : m.id === 'worldtour' ? 0x1b8f9a : m.id === 'mito' ? 0x8a3fd0 : m.id === 'conquista' ? 0x2f9a50 : m.id === 'manager' ? 0xc07a1a : m.id === 'leggenda' ? 0xe85a1a : m.id === 'sopravvivenza' ? 0xd02f6f : m.id === 'quick' ? 0xe8443a : 0x2f6fd0,
          badge: !m.available ? 'PRESTO' : m.id === 'worldtour' ? (wt?.finished ? 'VINTO' : wt ? `${wt.step}/6` : 'NUOVO') : m.id === 'mito' ? 'STORIA' : m.id === 'leggenda' ? 'NUOVO: STELLE' : m.id === 'sopravvivenza' ? (survBest > 0 ? `REC ${survBest}` : 'ROGUELITE') : undefined,
          size: m.title.length > 18 ? 7 : 8,
        },
      );
      if (!m.available) b.setEnabled(false);
      y += 24;
    }

    // record e opzioni
    const r = load().record;
    this.add.rectangle(lx, H - 16, 220, 14, 0x0d0a1a, 0.85);
    txt(this, lx, H - 16, `Partite ${r.played}  V ${r.won}  P ${r.drawn}  S ${r.lost}`, 6, '#8a8fb0');
    // minigioco dei rigori, a destra
    const pen = button(this, W - 82, H - 64, 140, 26, 'SFIDA RIGORI', () => {
      if (isTouch()) goFullscreen();
      sfx.unlock();
      this.scene.launch('setup', { mode: 'rigori' });
      this.scene.stop();
    }, { color: 0xc0306a, badge: 'MINI', size: 6 });
    void pen;
    const packs = load().album?.packs ?? 3;
    button(this, W - 82, H - 98, 140, 26, 'ALBUM', () => {
      sfx.unlock();
      this.scene.launch('album');
      this.scene.stop();
    }, { color: 0xc08a1a, badge: packs > 0 ? `${packs} PACCH.` : undefined, size: 6 });
    const prog = load().progress;
    const coins = prog?.coins ?? 100;
    const sfide = dailyState(prog?.daily).done.filter((x) => !x).length;
    button(this, W - 82, H - 166, 140, 26, 'ALLENAMENTO', () => {
      if (isTouch()) goFullscreen();
      sfx.unlock();
      this.scene.launch('training');
      this.scene.stop();
    }, { color: 0x2f6fd0, badge: 'NUOVO', size: 6 });
    button(this, W - 82, H - 132, 140, 26, 'CLUB E NEGOZIO', () => {
      sfx.unlock();
      this.scene.launch('club');
      this.scene.stop();
    }, { color: 0x2f9a8a, badge: sfide > 0 ? `${sfide} SFIDE OGGI` : `${coins} MONETE`, size: 6 });
    button(this, W - 30, H - 24, 36, 24, '♪', () => {
      this.scene.launch('settings');
      this.scene.bringToTop('settings');
    });
    if (isTouch()) {
      button(this, W - 74, H - 24, 36, 24, '[ ]', () => goFullscreen());
    }
    // badge versione cliccabile in alto a destra sincronizzato con package.json
    const vw = Math.max(58, VERSION_TAG.length * 8 + 16);
    const vx = W - 10 - vw;
    const vy = 8;
    const vBox = this.add.container(vx, vy);
    const vg = this.add.graphics();
    const drawBadge = (hover: boolean) => {
      vg.clear();
      vg.fillStyle(hover ? 0x201c38 : 0x14111f, 0.94).fillRect(0, 0, vw, 18);
      vg.lineStyle(1, hover ? 0xffd23f : 0x3fd0ff, 0.92).strokeRect(0, 0, vw, 18);
    };
    drawBadge(false);
    const vTxt = txt(this, vw / 2, 9, VERSION_TAG, 7, '#ffd23f');
    const vHit = this.add.zone(vw / 2, 9, vw, 18).setInteractive({ useHandCursor: true });
    vHit.on('pointerover', () => {
      drawBadge(true);
      vTxt.setColor('#ffffff');
    });
    vHit.on('pointerout', () => {
      drawBadge(false);
      vTxt.setColor('#ffd23f');
    });
    vHit.on('pointerdown', () => {
      sfx.click();
      this.openChangelog();
    });
    vBox.add([vg, vTxt, vHit]);
  }

  private openChangelog() {
    if (this.modal) return;
    const W = this.scale.width;
    const H = this.scale.height;
    const mw = Math.min(440, W - 36);
    const mh = Math.min(266, H - 36);
    const mx = Math.round((W - mw) / 2);
    const my = Math.round((H - mh) / 2);

    const c = this.add.container(0, 0).setDepth(50);
    this.modal = c;

    const shade = this.add.rectangle(0, 0, W, H, 0x090714, 0.78).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    panel(g, mx, my, mw, mh, 0x161426, 0x3fd0ff, 0.98);
    c.add([shade, g]);

    const head = shadowTxt(this, W / 2, my + 20, `NOVITÀ ${VERSION_TAG}`, 11, '#ffd23f');
    c.add(head.c);

    let y = my + 42;
    for (const entry of CHANGELOG) {
      if (y > my + mh - 50) break;
      const vLabel = txt(this, mx + 16, y, entry.version, 7, entry.version === VERSION_TAG ? '#3fd0ff' : '#8a8fb0').setOrigin(0, 0.5);
      c.add(vLabel);
      y += 14;
      for (const item of entry.items) {
        if (y > my + mh - 42) break;
        const line = txt(this, mx + 22, y, `• ${item}`, 6, '#e8ecff', { wordWrap: { width: mw - 38 } }).setOrigin(0, 0.5);
        c.add(line);
        y += Math.max(13, line.height + 4);
      }
      y += 6;
    }

    const closeBtn = button(this, W / 2, my + mh - 20, 108, 22, 'CHIUDI', () => close(), { color: 0xe8443a, size: 7 });
    c.add(closeBtn.c);

    const onEsc = () => close();
    this.input.keyboard?.once('keydown-ESC', onEsc);
    const close = () => {
      this.input.keyboard?.off('keydown-ESC', onEsc);
      if (this.modal === c) {
        this.modal = undefined;
        c.destroy(true);
      }
    };
    shade.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < mx || p.x > mx + mw || p.y < my || p.y > my + mh) {
        sfx.click();
        close();
      }
    });
  }
}
