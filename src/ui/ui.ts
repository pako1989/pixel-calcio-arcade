import Phaser from 'phaser';
import { sfx } from '../audio/sfx';

export const FONT = '"Press Start 2P", monospace';

export const COLORS = {
  ink: 0x1a1222,
  panel: 0x22253a,
  panelHi: 0x353a5c,
  accent: 0xffd23f,
  accent2: 0x3fd0ff,
  good: 0x5be37d,
  bad: 0xff5a5a,
  white: 0xffffff,
  dim: 0x8a8fb0,
};

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size = 8,
  color = '#ffffff',
  opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(Math.round(x), Math.round(y), s, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    ...opts,
  });
  t.setOrigin(0.5);
  return t;
}

/** Testo con ombra pixel (stile titolo). */
export function shadowTxt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, color: string, shadow = '#1a1222', off = 2) {
  const c = scene.add.container(Math.round(x), Math.round(y));
  const sh = txt(scene, off, off, s, size, shadow);
  const main = txt(scene, 0, 0, s, size, color);
  c.add([sh, main]);
  return { c, main, sh };
}

/** Riquadro in stile pixel con bordo chiaro e ombra. */
export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fillC = COLORS.panel, border = COLORS.panelHi, alpha = 0.95) {
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(0x000000, 0.35).fillRect(x + 3, y + 3, w, h);
  g.fillStyle(COLORS.ink, alpha).fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(fillC, alpha).fillRect(x, y, w, h);
  g.fillStyle(border, alpha).fillRect(x, y, w, 2);
  g.fillStyle(0x000000, 0.2).fillRect(x, y + h - 2, w, 2);
}

export interface Button {
  c: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  setEnabled(v: boolean): void;
  setLabel(s: string): void;
  setSelected(v: boolean): void;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { color?: number; size?: number; textColor?: string; badge?: string } = {},
): Button {
  const color = opts.color ?? COLORS.panelHi;
  const c = scene.add.container(Math.round(x), Math.round(y));
  const g = scene.add.graphics();
  const t = txt(scene, 0, 0, label, opts.size ?? 8, opts.textColor ?? '#ffffff');
  c.add([g, t]);
  let enabled = true;
  let selected = false;
  let down = false;
  const draw = () => {
    g.clear();
    const base = !enabled ? 0x2a2c3a : selected ? COLORS.accent : color;
    const yOff = down ? 2 : 0;
    g.fillStyle(0x000000, 0.4).fillRect(-w / 2 + 2, -h / 2 + 4, w, h);
    g.fillStyle(COLORS.ink).fillRect(-w / 2 - 2, -h / 2 - 2 + yOff, w + 4, h + 4);
    g.fillStyle(Phaser.Display.Color.ValueToColor(base).darken(25).color).fillRect(-w / 2, -h / 2 + yOff, w, h);
    g.fillStyle(base).fillRect(-w / 2, -h / 2 + yOff, w, h - 3);
    g.fillStyle(0xffffff, 0.25).fillRect(-w / 2, -h / 2 + yOff, w, 2);
    t.y = yOff - 1;
    t.setColor(!enabled ? '#6a6d80' : selected ? '#1a1222' : opts.textColor ?? '#ffffff');
  };
  draw();
  if (opts.badge) {
    const bt = txt(scene, w / 2 - 4, -h / 2 - 2, opts.badge, 6, '#1a1222');
    bt.setOrigin(1, 0.5);
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.accent2).fillRect(w / 2 - bt.width - 8, -h / 2 - 7, bt.width + 8, 10);
    c.add([bg, bt]);
  }
  const zone = scene.add.zone(0, 0, w + 8, h + 8).setInteractive({ useHandCursor: true });
  c.add(zone);
  zone.on('pointerdown', () => {
    if (!enabled) return;
    down = true;
    draw();
    sfx.unlock();
    sfx.click();
  });
  zone.on('pointerout', () => {
    if (down) {
      down = false;
      draw();
    }
  });
  zone.on('pointerup', () => {
    if (!enabled || !down) return;
    down = false;
    draw();
    onClick();
  });
  return {
    c,
    label: t,
    setEnabled(v: boolean) {
      enabled = v;
      draw();
    },
    setLabel(s: string) {
      t.setText(s);
    },
    setSelected(v: boolean) {
      selected = v;
      draw();
    },
  };
}

/** Freccia < o > (per scegliere squadra, campo...). */
export function arrow(scene: Phaser.Scene, x: number, y: number, dir: -1 | 1, onClick: () => void) {
  return button(scene, x, y, 22, 22, dir < 0 ? '<' : '>', onClick, { size: 8 });
}

export function fadeIn(scene: Phaser.Scene, ms = 250) {
  scene.cameras.main.fadeIn(ms, 10, 8, 20);
}

export function goTo(scene: Phaser.Scene, key: string, data?: object) {
  scene.cameras.main.fadeOut(180, 10, 8, 20);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
