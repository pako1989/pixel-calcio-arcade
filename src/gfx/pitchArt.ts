import Phaser from 'phaser';
import type { PitchDef, PitchId } from '../sim/types';
import { hex, mix, shade } from './px';
import { Rng } from '../sim/math';
import { CROSSBAR, GOAL_DEPTH } from '../sim/match';

/** Margine disegnato attorno al campo (spalti, sponde, scenografia). */
export const MARGIN = 110;
/** Schiacciamento prospettico dell'altezza (z) sullo schermo. */
export const Z_SCALE = 0.7;
export const BAR_H = Math.round(CROSSBAR * Z_SCALE);

interface Theme {
  a: number;
  b: number;
  line: number;
  apron: number;
  board: number;
  boardHi: number;
  around: number;
  post: number;
  net: string;
  crowd: number;
  night: boolean;
}

export const THEMES: Record<PitchId, Theme> = {
  stadio: { a: 0x3d9a3a, b: 0x48a842, line: 0xeff6ea, apron: 0x2f7f30, board: 0x1d2333, boardHi: 0x2d3550, around: 0x262a37, post: 0xf4f4f4, net: 'rgba(255,255,255,0.55)', crowd: 1, night: false },
  spiaggia: { a: 0xe8cd8e, b: 0xe1c483, line: 0x2f74c8, apron: 0xd9bb78, board: 0xa86e3c, boardHi: 0xc98d55, around: 0xe3c88a, post: 0xfaf0dc, net: 'rgba(255,255,255,0.6)', crowd: 0.25, night: false },
  neve: { a: 0xe6eff9, b: 0xd9e6f4, line: 0xd8423c, apron: 0xc9d9ec, board: 0xf4f8ff, boardHi: 0xffffff, around: 0xdde8f4, post: 0xd8423c, net: 'rgba(60,70,90,0.45)', crowd: 0.2, night: false },
  tetto: { a: 0x2b6a4f, b: 0x317657, line: 0xd9f3ff, apron: 0x2a3343, board: 0x283245, boardHi: 0x3b4a66, around: 0x323744, post: 0xe8f4ff, net: 'rgba(200,240,255,0.5)', crowd: 0.15, night: true },
  quartiere: { a: 0x5a5d66, b: 0x565962, line: 0xf2d24a, apron: 0x6b6e76, board: 0x9aa0a8, boardHi: 0xc2c7cc, around: 0x7d7f84, post: 0xb8bec6, net: 'rgba(230,230,230,0.5)', crowd: 0.35, night: false },
  piazza: { a: 0x9a8e7c, b: 0x948873, line: 0xf4efe2, apron: 0x857a68, board: 0xb59a74, boardHi: 0xd2b88f, around: 0xa49276, post: 0xf4f4f4, net: 'rgba(255,255,255,0.55)', crowd: 0.45, night: false },
  montagna: { a: 0x4f9a3c, b: 0x58a644, line: 0xf4f4ea, apron: 0x3f8a32, board: 0x7a5232, boardHi: 0x9a6a42, around: 0x5f8f48, post: 0xf4f4f4, net: 'rgba(255,255,255,0.55)', crowd: 0.3, night: false },
  molo: { a: 0xa8784a, b: 0x9c6e42, line: 0xf4f0e0, apron: 0x7a5434, board: 0x5a3c24, boardHi: 0x7a5434, around: 0x1f6aa8, post: 0xf4f4f4, net: 'rgba(255,255,255,0.6)', crowd: 0.3, night: false },
  flipper: { a: 0x1d1a38, b: 0x242046, line: 0x39e6ff, apron: 0x151228, board: 0x2a2252, boardHi: 0xff3fa4, around: 0x100d20, post: 0xffd23f, net: 'rgba(57,230,255,0.55)', crowd: 0.55, night: true },
  fango: { a: 0x4c6e32, b: 0x44642c, line: 0xe6e0cc, apron: 0x564028, board: 0x5a3e24, boardHi: 0x7a5634, around: 0x3c4d2a, post: 0xe8e0d0, net: 'rgba(235,225,205,0.5)', crowd: 0.25, night: false },
  vulcano: { a: 0x3b2a2e, b: 0x453136, line: 0xff9b42, apron: 0x281c1f, board: 0x24191c, boardHi: 0xff5a1e, around: 0x1e1316, post: 0xffd28a, net: 'rgba(255,150,80,0.55)', crowd: 0.3, night: true },
};

function ctx2d(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx };
}

function fill(ctx: CanvasRenderingContext2D, c: number, x: number, y: number, w: number, h: number, a = 1) {
  ctx.globalAlpha = a;
  ctx.fillStyle = hex(c);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.globalAlpha = 1;
}

function noise(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, colors: number[], density: number) {
  const n = Math.floor(w * h * density);
  for (let i = 0; i < n; i++) {
    fill(ctx, rng.pick(colors), x + Math.floor(rng.next() * w), y + Math.floor(rng.next() * h), 1, 1);
  }
}

/** Testo pixel nitido: disegna e poi "binarizza" l'alfa. */
function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: number, size = 8) {
  const { cv, ctx: t } = ctx2d(text.length * size + 4, size + 4);
  t.font = `${size}px "Press Start 2P", monospace`;
  t.textBaseline = 'top';
  t.fillStyle = hex(color);
  t.fillText(text, 1, 1);
  const img = t.getImageData(0, 0, cv.width, cv.height);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0;
  t.putImageData(img, 0, 0);
  const w = t.measureText(text).width;
  ctx.drawImage(cv, Math.round(x - w / 2), Math.round(y));
}

function lines(ctx: CanvasRenderingContext2D, p: PitchDef, ox: number, oy: number, c: number) {
  const W = p.width;
  const H = p.height;
  const lw = 2;
  const L = (x: number, y: number, w: number, h: number) => fill(ctx, c, ox + x, oy + y, w, h, 0.9);
  // bordo
  L(0, 0, W, lw);
  L(0, H - lw, W, lw);
  L(0, 0, lw, H);
  L(W - lw, 0, lw, H);
  // metà campo
  L(W / 2 - 1, 0, lw, H);
  // cerchio
  const circ = (cx: number, cy: number, r: number, from = 0, to = Math.PI * 2) => {
    const steps = Math.ceil(r * 7);
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      L(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, lw, lw);
    }
  };
  circ(W / 2, H / 2, Math.min(56, H * 0.13));
  L(W / 2 - 2, H / 2 - 2, 4, 4);
  // aree
  const gT = H / 2 - p.goalWidth / 2;
  const gB = H / 2 + p.goalWidth / 2;
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : W - 90;
    L(x0, gT - 50, 90, lw);
    L(x0, gB + 50 - lw, 90, lw);
    L(side === 0 ? 90 - lw : W - 90, gT - 50, lw, p.goalWidth + 100);
    const x1 = side === 0 ? 0 : W - 30;
    L(x1, gT - 16, 30, lw);
    L(x1, gB + 16 - lw, 30, lw);
    L(side === 0 ? 30 - lw : W - 30, gT - 16, lw, p.goalWidth + 32);
    const px = side === 0 ? 66 : W - 66;
    L(px - 1, H / 2 - 1, 3, 3);
    // lunetta
    if (side === 0) circ(66, H / 2, 34, -0.93, 0.93);
    else circ(W - 66, H / 2, 34, Math.PI - 0.93, Math.PI + 0.93);
  }
  // angoli
  circ(0, 0, 9, 0, Math.PI / 2);
  circ(W, 0, 9, Math.PI / 2, Math.PI);
  circ(0, H, 9, -Math.PI / 2, 0);
  circ(W, H, 9, Math.PI, Math.PI * 1.5);
}

const ADS = ['PIXEL COLA', 'GOL!', 'SUPER TIRO', 'RONDINE', 'ARCADE', 'FORZA!', 'CALCIO 2D', '8 BIT TV'];
const AD_COLORS = [0xe0383e, 0x2a7de1, 0xf2b72f, 0x2bb673, 0x8a4fd8, 0xff7a1a];

/** Disegna il campo con tutto ciò che lo circonda. Le coordinate del canvas partono da (-MARGIN,-MARGIN). */
export function drawPitch(scene: Phaser.Scene, p: PitchDef, key: string) {
  const th = THEMES[p.id];
  const W = p.width;
  const H = p.height;
  const M = MARGIN;
  const { cv, ctx } = ctx2d(W + M * 2, H + M * 2);
  const rng = new Rng(1234);
  const ox = M;
  const oy = M;
  const gT = H / 2 - p.goalWidth / 2;

  // dintorni
  fill(ctx, th.around, 0, 0, cv.width, cv.height);
  drawSurroundings(ctx, p, th, rng);

  // bordo attorno al campo
  fill(ctx, th.apron, ox - 12, oy - 18, W + 24, H + 32);
  noise(ctx, rng, ox - 12, oy - 18, W + 24, H + 32, [shade(th.apron, 0.92), shade(th.apron, 1.07)], 0.06);

  // superficie
  if (p.id === 'piazza') {
    // sampietrini a file sfalsate
    fill(ctx, shade(th.a, 0.7), ox, oy, W, H);
    for (let y = 0; y < H; y += 6) {
      const off = (y / 6) % 2 ? 3 : 0;
      for (let x = -off; x < W; x += 6) {
        const c = rng.pick([th.a, th.b, shade(th.a, 1.08), shade(th.a, 0.93)]);
        fill(ctx, c, ox + Math.max(0, x), oy + y, Math.min(5, W - Math.max(0, x)), 5);
        fill(ctx, shade(c, 1.15), ox + Math.max(0, x), oy + y, Math.min(5, W - Math.max(0, x)), 1);
      }
    }
  } else if (p.id === 'molo') {
    // assi di legno con chiodi e fessure
    for (let y = 0; y < H; y += 10) {
      const c = (y / 10) % 2 ? th.a : th.b;
      fill(ctx, c, ox, oy + y, W, 9);
      fill(ctx, shade(c, 0.6), ox, oy + y + 9, W, 1);
      let x = rng.range(0, 60);
      while (x < W) {
        fill(ctx, shade(c, 0.6), ox + x, oy + y, 1, 9);
        fill(ctx, 0x4a4a52, ox + x + 3, oy + y + 2, 1, 1);
        fill(ctx, 0x4a4a52, ox + x + 3, oy + y + 6, 1, 1);
        x += rng.range(70, 140);
      }
    }
    noise(ctx, rng, ox, oy, W, H, [shade(th.a, 0.85), shade(th.a, 1.1)], 0.06);
    // pozzanghere di acqua salata
    for (let i = 0; i < 7; i++) { const px = ox + rng.range(20, W - 60); const py = oy + rng.range(20, H - 30); const pw = rng.range(16, 34); fill(ctx, 0x3a80c0, px, py, pw, 6, 0.45); fill(ctx, 0xbfe4ff, px + 3, py + 1, pw / 3, 1, 0.7); }
  } else if (p.id === 'quartiere') {
    fill(ctx, th.a, ox, oy, W, H);
    noise(ctx, rng, ox, oy, W, H, [shade(th.a, 0.85), shade(th.a, 1.12), shade(th.a, 0.95)], 0.18);
    // crepe e macchie
    for (let i = 0; i < 14; i++) {
      let x = rng.range(20, W - 20);
      let y = rng.range(20, H - 20);
      for (let k = 0; k < 18; k++) {
        fill(ctx, shade(th.a, 0.7), ox + x, oy + y, 1, 1);
        x += rng.range(-1, 2);
        y += rng.range(-1, 1.5);
      }
    }
    for (let i = 0; i < 6; i++) fill(ctx, shade(th.a, 0.9), ox + rng.range(30, W - 60), oy + rng.range(30, H - 40), rng.range(14, 30), rng.range(6, 14), 0.6);
  } else if (p.id === 'flipper') {
    // plancia arcade a scacchiera neon con frecce luminose
    const tile = 30;
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) {
        const c = ((x / tile + y / tile) | 0) % 2 === 0 ? th.a : th.b;
        fill(ctx, c, ox + x, oy + y, Math.min(tile, W - x), Math.min(tile, H - y));
      }
    }
    for (let x = 0; x < W; x += 60) fill(ctx, 0x39e6ff, ox + x, oy, 1, H, 0.14);
    for (let y = 0; y < H; y += 60) fill(ctx, 0xff3fa4, ox, oy + y, W, 1, 0.14);
    // corsie laterali illuminate e frecce verso porta
    for (const fx of [0.22, 0.78]) {
      const dir = fx < 0.5 ? -1 : 1;
      for (const fy of [0.22, 0.78]) {
        const cx = ox + W * fx;
        const cy = oy + H * fy;
        for (let k = 0; k < 3; k++) {
          const ax = cx + dir * (k - 1) * 14;
          const c = k % 2 ? 0xffd23f : 0xff3fa4;
          for (let r = 0; r < 6; r++) fill(ctx, c, ax + dir * r, cy - (5 - r), 2, (5 - r) * 2 + 1, 0.45);
        }
      }
    }
  } else if (p.id === 'fango') {
    const band = 56;
    for (let x = 0; x < W; x += band) fill(ctx, (x / band) % 2 === 0 ? th.a : th.b, ox + x, oy, Math.min(band, W - x), H);
    noise(ctx, rng, ox, oy, W, H, [shade(th.a, 0.86), 0x5c442a, shade(th.b, 1.08)], 0.16);
    // pozze di fango ellittiche con bordo scuro e riflesso umido
    for (const m of p.mud ?? []) {
      for (let dy = -m.ry; dy <= m.ry; dy++) {
        const w = Math.sqrt(Math.max(0, 1 - (dy / m.ry) ** 2)) * m.rx;
        fill(ctx, 0x4b341e, ox + m.x - w, oy + m.y + dy, w * 2, 1, 0.92);
        if (Math.abs(dy) < m.ry * 0.78) fill(ctx, 0x66482a, ox + m.x - w * 0.75, oy + m.y + dy, w * 1.5, 1, 0.88);
      }
      fill(ctx, 0x8f6b45, ox + m.x - m.rx * 0.45, oy + m.y - m.ry * 0.35, m.rx * 0.35, 2, 0.6);
      fill(ctx, 0x3b2715, ox + m.x + m.rx * 0.15, oy + m.y + m.ry * 0.2, m.rx * 0.25, 2, 0.7);
    }
  } else if (p.id === 'vulcano') {
    fill(ctx, th.a, ox, oy, W, H);
    noise(ctx, rng, ox, oy, W, H, [th.b, 0x2c1d20, 0x56393c, 0xff6a1a], 0.12);
    // crepe di magma nel basalto
    for (let i = 0; i < 18; i++) {
      let cx = rng.range(24, W - 24);
      let cy = rng.range(24, H - 24);
      for (let k = 0; k < 20; k++) {
        fill(ctx, k % 3 === 0 ? 0xff7a1a : 0xa82a18, ox + cx, oy + cy, 2, 2, 0.75);
        cx += rng.range(-3, 3);
        cy += rng.range(-2, 2);
      }
    }
  } else {
    const band = 56;
    for (let x = 0; x < W; x += band) fill(ctx, (x / band) % 2 === 0 ? th.a : th.b, ox + x, oy, Math.min(band, W - x), H);
    const dots = p.id === 'stadio' || p.id === 'tetto' ? [shade(th.a, 0.88), shade(th.b, 1.1), mix(th.a, 0x9fd36a, 0.3)] : [shade(th.a, 0.95), shade(th.a, 1.04)];
    noise(ctx, rng, ox, oy, W, H, dots, p.id === 'spiaggia' ? 0.25 : 0.12);
    if (p.id === 'spiaggia') {
      // impronte
      for (let i = 0; i < 40; i++) {
        const x = ox + rng.range(10, W - 10);
        const y = oy + rng.range(10, H - 10);
        fill(ctx, shade(th.a, 0.86), x, y, 2, 3);
        fill(ctx, shade(th.a, 0.86), x + 4, y + 2, 2, 3);
      }
    }
    if (p.id === 'montagna') {
      // ombreggiatura della pendenza: più chiaro a valle, frecce e fiorellini
      for (let y = 0; y < H; y += 4) fill(ctx, 0x000000, ox, oy + y, W, 4, 0.12 * (1 - y / H));
      for (let i = 0; i < 70; i++) fill(ctx, rng.pick([0xffffff, 0xf2d24a, 0xd86ad8]), ox + rng.range(4, W - 4), oy + rng.range(4, H - 4), 1, 1);
      for (const fx of [0.2, 0.8]) {
        for (const fy of [0.3, 0.7]) {
          const ax = ox + W * fx;
          const ay = oy + H * fy;
          fill(ctx, 0xffffff, ax - 1, ay - 8, 3, 12, 0.35);
          for (let k = 0; k < 5; k++) fill(ctx, 0xffffff, ax - k, ay + 4 - k, 3 + k * 2 - 2, 1, 0.35);
        }
      }
    }
    if (p.id === 'neve') {
      for (let i = 0; i < 26; i++) {
        let x = rng.range(10, W - 10);
        const y = rng.range(10, H - 10);
        const l = rng.range(20, 60);
        for (let k = 0; k < l; k++) fill(ctx, 0xc6d6ea, ox + x + k, oy + y + Math.sin(k / 6) * 2, 1, 1);
        x += 1;
      }
    }
  }
  lines(ctx, p, ox, oy, th.line);

  // sponde
  drawBoards(ctx, p, th, rng);

  // porte: ombra a terra
  for (const gx of [0, W]) {
    const x = gx === 0 ? ox - GOAL_DEPTH : ox + W;
    fill(ctx, 0x000000, x, oy + gT, GOAL_DEPTH, p.goalWidth, 0.18);
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
}

function drawBoards(ctx: CanvasRenderingContext2D, p: PitchDef, th: Theme, rng: Rng) {
  const W = p.width;
  const H = p.height;
  const ox = MARGIN;
  const oy = MARGIN;
  const gT = H / 2 - p.goalWidth / 2;
  const gB = H / 2 + p.goalWidth / 2;
  const bh = 14;
  if (p.id === 'quartiere') {
    // rete metallica (gabbia)
    const fence = (x: number, y: number, w: number, h: number) => {
      fill(ctx, 0x000000, x, y, w, h, 0.18);
      for (let i = -h; i < w; i += 5) {
        for (let k = 0; k < h; k++) {
          const xa = x + i + k;
          const xb = x + i + h - k;
          if (xa >= x && xa < x + w) fill(ctx, 0xc8ccd2, xa, y + k, 1, 1, 0.75);
          if (xb >= x && xb < x + w) fill(ctx, 0xc8ccd2, xb, y + k, 1, 1, 0.75);
        }
      }
      fill(ctx, 0x8a9098, x, y, w, 2);
    };
    fence(ox - 6, oy - 40, W + 12, 40);
    fill(ctx, 0x6c7078, ox - 6, oy - 4, W + 12, 4);
    for (let x = 0; x <= W; x += 80) fill(ctx, 0x50555c, ox + x - 2, oy - 44, 4, 44);
    fill(ctx, 0x6c7078, ox - 6, oy + H, W + 12, 6);
    fill(ctx, 0x6c7078, ox - 6, oy - 4, 6, gT + 4);
    fill(ctx, 0x6c7078, ox - 6, oy + gB, 6, H - gB + 6);
    fill(ctx, 0x6c7078, ox + W, oy - 4, 6, gT + 4);
    fill(ctx, 0x6c7078, ox + W, oy + gB, 6, H - gB + 6);
    return;
  }
  if (p.id === 'neve') {
    // cumuli di neve
    const bank = (x: number, y: number, w: number, h: number) => {
      for (let i = 0; i < w; i += 2) {
        const hh = h + Math.round(Math.sin(i * 0.21) * 2 + Math.sin(i * 0.07) * 2);
        fill(ctx, 0xffffff, x + i, y + h - hh, 2, hh);
        fill(ctx, 0xbfd2ea, x + i, y + h - 2, 2, 2);
      }
    };
    bank(ox - 8, oy - bh, W + 16, bh);
    bank(ox - 8, oy + H, W + 16, 8);
    bank(ox - 8, oy, 8, gT);
    bank(ox - 8, oy + gB, 8, H - gB);
    bank(ox + W, oy, 8, gT);
    bank(ox + W, oy + gB, 8, H - gB);
    return;
  }
  if (p.id === 'piazza') {
    // marciapiede di pietra con paletti
    fill(ctx, 0xc9bfae, ox - 8, oy - 10, W + 16, 10);
    fill(ctx, 0xe4dccc, ox - 8, oy - 10, W + 16, 2);
    fill(ctx, 0xc9bfae, ox - 8, oy + H, W + 16, 8);
    for (let x = 0; x <= W; x += 40) {
      fill(ctx, 0x30343f, ox + x - 2, oy - 18, 4, 10);
      fill(ctx, 0x30343f, ox + x - 2, oy + H + 8, 4, 8);
    }
    for (const [x, w] of [[ox - 8, 8], [ox + W, 8]] as const) {
      fill(ctx, 0xc9bfae, x, oy, w, gT);
      fill(ctx, 0xc9bfae, x, oy + gB, w, H - gB);
    }
    return;
  }
  if (p.id === 'montagna') {
    // staccionata di legno
    const fenceH = (x: number, y: number, w: number) => {
      fill(ctx, 0x5a3a22, x, y + 3, w, 2);
      fill(ctx, 0x5a3a22, x, y + 8, w, 2);
      for (let i = 0; i < w; i += 16) fill(ctx, 0x7a5232, x + i, y, 3, 13);
    };
    fenceH(ox - 8, oy - 14, W + 16);
    fenceH(ox - 8, oy + H + 2, W + 16);
    for (const x of [ox - 8, ox + W + 4]) {
      fill(ctx, 0x7a5232, x, oy, 4, gT);
      fill(ctx, 0x7a5232, x, oy + gB, 4, H - gB);
    }
    return;
  }
  if (p.id === 'molo') {
    // bordo del molo: travi, bitte e corde
    fill(ctx, th.board, ox - 8, oy - 8, W + 16, 8);
    fill(ctx, th.board, ox - 8, oy + H, W + 16, 8);
    for (let x = 0; x <= W; x += 70) {
      for (const y of [oy - 14, oy + H + 2]) {
        fill(ctx, 0x30343f, ox + x - 4, y, 8, 10);
        fill(ctx, 0x4a505e, ox + x - 4, y, 8, 2);
      }
    }
    for (let x = 0; x < W; x += 2) {
      const sag = Math.sin(((x % 70) / 70) * Math.PI) * 3;
      fill(ctx, 0xe2d2a8, ox + x, oy - 10 + sag, 2, 1);
      fill(ctx, 0xe2d2a8, ox + x, oy + H + 6 + sag, 2, 1);
    }
    for (const x of [ox - 8, ox + W]) {
      fill(ctx, th.board, x, oy, 8, gT);
      fill(ctx, th.board, x, oy + gB, 8, H - gB);
    }
    return;
  }
  // sponde con pubblicità
  fill(ctx, th.board, ox - 6, oy - bh, W + 12, bh);
  fill(ctx, th.boardHi, ox - 6, oy - bh, W + 12, 2);
  if (p.id === 'tetto') {
    fill(ctx, 0x39e6ff, ox - 6, oy - 4, W + 12, 1);
    fill(ctx, 0xff3fa4, ox - 6, oy + H + 6, W + 12, 1);
    for (let x = 0; x < W; x += 24) fill(ctx, 0x5a6c8c, ox + x, oy - bh + 2, 1, bh - 6);
  } else if (p.id === 'flipper') {
    fill(ctx, 0x39e6ff, ox - 6, oy - 4, W + 12, 2);
    fill(ctx, 0xffd23f, ox - 6, oy - bh + 3, W + 12, 2);
    for (let x = 16; x < W; x += 48) {
      fill(ctx, 0xff3fa4, ox + x, oy - bh + 6, 18, 4);
      fill(ctx, 0x39e6ff, ox + x + 22, oy - bh + 6, 18, 4);
    }
  } else if (p.id === 'fango') {
    for (let x = -6; x < W + 6; x += 18) fill(ctx, 0x3f2a18, ox + x, oy - bh, 2, bh);
    for (let i = 0; i < 16; i++) fill(ctx, 0x4b341e, ox + rng.range(0, W - 20), oy - 4, rng.range(10, 24), 4);
  } else if (p.id === 'vulcano') {
    for (let x = -6; x < W + 6; x += 14) {
      const h = rng.range(bh - 4, bh + 2);
      fill(ctx, 0x332226, ox + x, oy - h, 12, h);
    }
    fill(ctx, 0xff5a1e, ox - 6, oy - 3, W + 12, 2, 0.8);
  } else if (p.id === 'spiaggia') {
    for (let x = -6; x < W + 6; x += 12) fill(ctx, shade(th.board, 0.8), ox + x, oy - bh, 1, bh);
  } else {
    const pw = 120;
    let i = 0;
    for (let x = 0; x + pw <= W; x += pw + 10) {
      const c = AD_COLORS[i % AD_COLORS.length];
      fill(ctx, c, ox + x + 4, oy - bh + 3, pw, bh - 5);
      fill(ctx, shade(c, 1.25), ox + x + 4, oy - bh + 3, pw, 1);
      pixelText(ctx, ADS[i % ADS.length], ox + x + 4 + pw / 2, oy - bh + 4, 0xffffff, 8);
      i++;
    }
  }
  // sponda in basso (vista dall'alto) e laterali
  fill(ctx, th.board, ox - 6, oy + H, W + 12, 8);
  fill(ctx, th.boardHi, ox - 6, oy + H, W + 12, 2);
  fill(ctx, th.board, ox - 6, oy, 6, gT);
  fill(ctx, th.board, ox - 6, oy + gB, 6, H - gB);
  fill(ctx, th.board, ox + W, oy, 6, gT);
  fill(ctx, th.board, ox + W, oy + gB, 6, H - gB);
  fill(ctx, th.boardHi, ox - 6, oy, 2, gT);
  fill(ctx, th.boardHi, ox + W + 4, oy + gB, 2, H - gB);
  void rng;
}

function drawSurroundings(ctx: CanvasRenderingContext2D, p: PitchDef, _th: Theme, rng: Rng) {
  const W = p.width + MARGIN * 2;
  const H = p.height + MARGIN * 2;
  const M = MARGIN;
  switch (p.id) {
    case 'stadio': {
      // spalti a gradoni
      for (let y = 0; y < M - 16; y += 5) {
        fill(ctx, y % 10 === 0 ? 0x2e3445 : 0x353c50, 0, y, W, 5);
        fill(ctx, 0x1f2430, 0, y + 4, W, 1);
      }
      for (let y = M + p.height + 10; y < H; y += 5) {
        fill(ctx, y % 10 === 0 ? 0x2e3445 : 0x353c50, 0, y, W, 5);
        fill(ctx, 0x1f2430, 0, y + 4, W, 1);
      }
      for (let x = 0; x < M - 30; x += 5) {
        fill(ctx, x % 10 === 0 ? 0x2e3445 : 0x353c50, x, M - 16, 5, p.height + 26);
        fill(ctx, x % 10 === 0 ? 0x2e3445 : 0x353c50, W - x - 5, M - 16, 5, p.height + 26);
      }
      // scale
      for (const sx of [0.25, 0.5, 0.75]) {
        fill(ctx, 0x4a5168, Math.round(W * sx) - 3, 0, 6, M - 16);
        fill(ctx, 0x4a5168, Math.round(W * sx) - 3, M + p.height + 10, 6, M);
      }
      break;
    }
    case 'spiaggia': {
      // mare in alto
      const seaH = M - 30;
      for (let y = 0; y < seaH; y++) {
        const t = y / seaH;
        fill(ctx, mix(0x1c6fb8, 0x47b6e0, t), 0, y, W, 1);
      }
      for (let i = 0; i < 90; i++) fill(ctx, 0xd8f4ff, rng.range(0, W), rng.range(4, seaH - 6), rng.range(3, 8), 1, 0.7);
      // schiuma
      for (let x = 0; x < W; x += 2) fill(ctx, 0xffffff, x, seaH + Math.round(Math.sin(x * 0.08) * 2), 2, 2);
      fill(ctx, 0xd8bd7f, 0, seaH + 3, W, 4);
      noise(ctx, rng, 0, seaH, W, H - seaH, [0xd9bd7c, 0xf0d9a2, 0xc9ac6c], 0.08);
      // ombrelloni e asciugamani in basso
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * (W / 9) + rng.range(-10, 10);
        const y = M + p.height + 40 + rng.range(-6, 30);
        const c = rng.pick([0xe0383e, 0x2a7de1, 0xf2b72f, 0x2bb673, 0xff7ab8]);
        fill(ctx, shade(c, 0.8), x + 6, y + 20, 14, 6);
        fill(ctx, 0x8a6a40, x + 11, y + 4, 2, 18);
        for (let k = 0; k < 9; k++) fill(ctx, k % 2 ? c : 0xffffff, x + 12 - 12 + k * 3 - 1, y + Math.abs(k - 4) * 1.2, 3, 5 - Math.abs(k - 4) * 0.6);
      }
      // palme ai lati
      for (const px of [26, W - 40]) {
        for (const py of [M + 30, M + p.height - 60]) {
          fill(ctx, 0x9a6a3a, px + 6, py, 4, 50);
          for (let a = 0; a < 6; a++) {
            const ang = (a / 6) * Math.PI * 2;
            for (let k = 0; k < 14; k++) fill(ctx, k % 3 ? 0x2f9a45 : 0x1f7a35, px + 8 + Math.cos(ang) * k, py + Math.sin(ang) * k * 0.6 + k * k * 0.03, 3, 2);
          }
        }
      }
      break;
    }
    case 'neve': {
      noise(ctx, rng, 0, 0, W, H, [0xffffff, 0xc9d9ec], 0.08);
      const pine = (x: number, y: number, s: number) => {
        for (let k = 0; k < 3; k++) {
          const w = (14 - k * 3) * s;
          const yy = y + k * 7 * s;
          for (let r = 0; r < 9 * s; r++) {
            const ww = (w * r) / (9 * s);
            fill(ctx, r < 2 ? 0xffffff : 0x1d5a3a, x - ww, yy + r, ww * 2, 1);
          }
        }
        fill(ctx, 0x5a3a24, x - 2, y + 27 * s, 4, 5 * s);
      };
      for (let i = 0; i < 26; i++) pine(rng.range(10, W - 10), rng.range(4, M - 50), rng.range(0.8, 1.2));
      for (let i = 0; i < 26; i++) pine(rng.range(10, W - 10), M + p.height + 16 + rng.range(0, M - 60), rng.range(0.8, 1.2));
      // pupazzo di neve
      const sx = W - 70;
      const sy = H - 60;
      fill(ctx, 0xffffff, sx - 8, sy, 16, 14);
      fill(ctx, 0xffffff, sx - 6, sy - 10, 12, 11);
      fill(ctx, 0x1a1a1a, sx - 3, sy - 7, 2, 2);
      fill(ctx, 0x1a1a1a, sx + 2, sy - 7, 2, 2);
      fill(ctx, 0xff8a1a, sx, sy - 4, 4, 1);
      break;
    }
    case 'tetto': {
      // cielo notturno e skyline
      for (let y = 0; y < M - 20; y++) fill(ctx, mix(0x0b1028, 0x2a2350, y / (M - 20)), 0, y, W, 1);
      for (let i = 0; i < 60; i++) fill(ctx, 0xffffff, rng.range(0, W), rng.range(0, 30), 1, 1, rng.range(0.4, 1));
      let x = 0;
      while (x < W) {
        const bw = rng.range(24, 60);
        const bh = rng.range(30, M - 26);
        const top = M - 20 - bh;
        fill(ctx, rng.pick([0x161b33, 0x1b2140, 0x121630]), x, top, bw, bh);
        for (let wy = top + 4; wy < M - 24; wy += 6) {
          for (let wx = x + 3; wx < x + bw - 4; wx += 5) {
            if (rng.chance(0.35)) fill(ctx, rng.pick([0xffd877, 0xfff0b0, 0x8fe3ff]), wx, wy, 2, 3);
          }
        }
        x += bw + rng.range(0, 6);
      }
      // tetto: cemento e impianti
      noise(ctx, rng, 0, M - 20, W, H, [0x2c303c, 0x3a3f4d], 0.1);
      for (let i = 0; i < 5; i++) {
        const ux = 40 + i * (W / 5);
        const uy = M + p.height + 40;
        fill(ctx, 0x6a7080, ux, uy, 34, 22);
        fill(ctx, 0x8a90a0, ux, uy, 34, 3);
        fill(ctx, 0x3a3f4d, ux + 8, uy + 7, 18, 10);
        fill(ctx, 0x2a2e38, ux + 16, uy + 7, 2, 10);
      }
      // insegna al neon
      pixelText(ctx, 'NOTTE ARCADE', W / 2, 18, 0xff3fa4, 16);
      break;
    }
    case 'piazza': {
      // case colorate del paese con finestre e balconi, campanile
      const facades = [0xe2a65a, 0xd8745a, 0xf0d8a0, 0xc9a07a, 0xe8c070, 0xb86a50];
      let x = 0;
      while (x < W) {
        const bw = rng.range(50, 90);
        const c = rng.pick(facades);
        fill(ctx, c, x, 0, bw, M - 26);
        fill(ctx, shade(c, 0.8), x, 0, 2, M - 26);
        for (let wy = 10; wy < M - 40; wy += 22) {
          for (let wx = x + 8; wx < x + bw - 14; wx += 18) {
            fill(ctx, 0x3a2a24, wx, wy, 8, 12);
            fill(ctx, 0x2f7a4a, wx - 2, wy, 2, 12);
            fill(ctx, 0x2f7a4a, wx + 8, wy, 2, 12);
            if (rng.chance(0.4)) fill(ctx, rng.pick([0xe0383e, 0xff7ab8, 0xf2d24a]), wx, wy + 12, 8, 2);
          }
        }
        fill(ctx, 0x6a5444, x, M - 30, bw, 4);
        x += bw;
      }
      // campanile
      const cx = Math.round(W * 0.15);
      fill(ctx, 0xd2b48a, cx, 0, 30, M - 26);
      fill(ctx, 0x3a2a24, cx + 9, 10, 12, 16);
      fill(ctx, 0xf2d24a, cx + 12, 16, 6, 6);
      // in basso: tavolini del bar e alberelli
      noise(ctx, rng, 0, M + p.height + 8, W, M, [0xb5a68e, 0xa49276], 0.12);
      for (let i = 0; i < 12; i++) {
        const tx = 24 + i * (W / 12);
        const ty = M + p.height + 46;
        fill(ctx, 0xe0383e, tx - 10, ty - 14, 22, 4);
        fill(ctx, 0xffffff, tx - 6, ty - 14, 4, 4);
        fill(ctx, 0xffffff, tx + 4, ty - 14, 4, 4);
        fill(ctx, 0x6a5444, tx, ty - 10, 2, 14);
        fill(ctx, 0xf4f4f4, tx - 6, ty + 2, 14, 3);
      }
      break;
    }
    case 'montagna': {
      // cielo e montagne innevate
      for (let y = 0; y < M - 10; y++) fill(ctx, mix(0x6ab4f0, 0xbfe4ff, y / (M - 10)), 0, y, W, 1);
      const peak = (px: number, ph: number, pw: number, c: number) => {
        for (let k = 0; k < ph; k++) {
          const ww = (pw * k) / ph;
          fill(ctx, k < ph * 0.25 ? 0xffffff : c, px - ww, M - 20 - ph + k, ww * 2, 1);
        }
      };
      for (let i = 0; i < 7; i++) peak(rng.range(0, W), rng.range(50, 85), rng.range(50, 90), rng.pick([0x6a7a9a, 0x5a6a8a, 0x7a8aa8]));
      fill(ctx, 0x4f8a3c, 0, M - 24, W, H);
      noise(ctx, rng, 0, M - 24, W, H, [0x5f9a48, 0x3f7a30, 0xffffff], 0.05);
      // abeti e mucche
      for (let i = 0; i < 18; i++) {
        const tx = rng.range(8, W - 8);
        const ty = M + p.height + rng.range(16, M - 30);
        for (let r = 0; r < 18; r++) fill(ctx, 0x1d5a3a, tx - r * 0.4, ty + r, r * 0.8 + 1, 1);
        fill(ctx, 0x5a3a24, tx - 1, ty + 18, 3, 4);
      }
      for (let i = 0; i < 4; i++) {
        const cx = rng.range(30, W - 40);
        const cy = M + p.height + rng.range(30, 70);
        fill(ctx, 0xffffff, cx, cy, 16, 9);
        fill(ctx, 0x1a1a1a, cx + 3, cy + 2, 5, 4);
        fill(ctx, 0xffffff, cx + 14, cy - 3, 6, 6);
        fill(ctx, 0x1a1a1a, cx + 1, cy + 9, 2, 4);
        fill(ctx, 0x1a1a1a, cx + 12, cy + 9, 2, 4);
      }
      break;
    }
    case 'molo': {
      // mare tutto intorno, barche e faro
      noise(ctx, rng, 0, 0, W, H, [0x2a7ab8, 0x185a98], 0.12);
      for (let i = 0; i < 160; i++) fill(ctx, 0xd8f4ff, rng.range(0, W), rng.range(0, H), rng.range(3, 8), 1, 0.6);
      // piloni del molo
      for (let x = M - 10; x < M + p.width + 10; x += 30) {
        fill(ctx, 0x4a3422, x, M - 22, 6, 8);
        fill(ctx, 0x4a3422, x, M + p.height + 12, 6, 10);
      }
      const boat = (bx: number, by: number, c: number) => {
        fill(ctx, c, bx, by, 40, 8);
        fill(ctx, shade(c, 0.7), bx + 4, by + 8, 32, 3);
        fill(ctx, 0xffffff, bx + 10, by - 10, 14, 10);
        fill(ctx, 0x2a3a5a, bx + 13, by - 7, 3, 3);
        fill(ctx, 0x2a3a5a, bx + 18, by - 7, 3, 3);
      };
      boat(W * 0.2, 30, 0xe0383e);
      boat(W * 0.62, 50, 0xf2d24a);
      boat(W * 0.4, H - 50, 0x2bb673);
      // faro
      const fx = W - 50;
      fill(ctx, 0xffffff, fx, 6, 14, 60);
      for (let y = 6; y < 66; y += 16) fill(ctx, 0xe0383e, fx, y, 14, 8);
      fill(ctx, 0xfff3a0, fx + 2, 0, 10, 6);
      break;
    }
    case 'quartiere': {
      // palazzi e muri con graffiti
      fill(ctx, 0x9c6b52, 0, 0, W, M - 50);
      for (let y = 0; y < M - 50; y += 6) for (let x = (y / 6) % 2 ? 0 : 8; x < W; x += 16) fill(ctx, 0x8a5c45, x, y, 15, 5);
      for (let i = 0; i < 8; i++) {
        const gx = rng.range(10, W - 80);
        const c = rng.pick([0xff3fa4, 0x39e6ff, 0xf2d24a, 0x6ee05a, 0xff7a1a]);
        for (let k = 0; k < 40; k++) fill(ctx, c, gx + k * 1.6, 12 + Math.sin(k * 0.5 + i) * 6 + rng.range(0, 6), 3, 3);
      }
      pixelText(ctx, 'QUARTIERE', W * 0.3, 20, 0xffffff, 16);
      pixelText(ctx, 'GOL!', W * 0.75, 22, 0xf2d24a, 16);
      fill(ctx, 0x8f9298, 0, M - 50, W, 10);
      noise(ctx, rng, 0, M - 40, W, H, [0x74777c, 0x888b90], 0.1);
      // alberi in basso
      for (let i = 0; i < 10; i++) {
        const tx = 20 + i * (W / 10);
        const ty = M + p.height + 40;
        fill(ctx, 0x5a3a24, tx + 8, ty + 10, 4, 16);
        fill(ctx, 0x2e7a3a, tx, ty - 6, 20, 18);
        fill(ctx, 0x3e9a4a, tx + 3, ty - 4, 10, 8);
      }
      break;
    }
    case 'flipper': {
      // sala giochi retro neon con cabinati ai lati e insegna gigante
      for (let y = 0; y < M - 20; y++) fill(ctx, mix(0x0b0820, 0x26124a, y / (M - 20)), 0, y, W, 1);
      for (let x = 24; x < W - 40; x += 56) {
        const c = rng.pick([0xff3fa4, 0x39e6ff, 0xffd23f, 0x5be37d]);
        fill(ctx, 0x1e183a, x, 24, 32, 54);
        fill(ctx, c, x + 3, 27, 26, 6);
        fill(ctx, 0x101428, x + 5, 36, 22, 16);
        fill(ctx, c, x + 8, 40, 16, 8, 0.7);
      }
      pixelText(ctx, 'ARCADE FLIPPER', W / 2, 6, 0xffd23f, 12);
      for (let x = 20; x < W - 20; x += 40) {
        fill(ctx, x % 80 === 20 ? 0xff3fa4 : 0x39e6ff, x, M + p.height + 30, 20, 4, 0.7);
      }
      break;
    }
    case 'fango': {
      // campagna dopo il temporale: alberi, pozzanghere e staccionate
      noise(ctx, rng, 0, 0, W, H, [0x324222, 0x4b341e], 0.08);
      for (let i = 0; i < 16; i++) {
        const tx = rng.range(12, W - 24);
        const ty = i < 8 ? rng.range(8, M - 40) : M + p.height + rng.range(24, M - 30);
        fill(ctx, 0x4b341e, tx + 6, ty + 14, 4, 10);
        fill(ctx, 0x2b5a28, tx, ty, 16, 16);
        fill(ctx, 0x3e7834, tx + 3, ty + 2, 8, 8);
      }
      for (let i = 0; i < 8; i++) {
        fill(ctx, 0x5c4228, rng.range(20, W - 60), M + p.height + rng.range(18, M - 26), rng.range(24, 44), 8, 0.65);
      }
      break;
    }
    case 'vulcano': {
      // crateri di lava fusa attorno al campo
      for (let y = 0; y < M - 24; y++) fill(ctx, mix(0x140b0e, 0x3a1814, y / (M - 24)), 0, y, W, 1);
      // fiume di lava in alto e in basso
      for (let x = 0; x < W; x += 3) {
        const off = Math.round(Math.sin(x * 0.04) * 5);
        fill(ctx, 0xd83214, x, 28 + off, 3, 20);
        fill(ctx, 0xff9a1a, x, 33 + off, 3, 9);
        fill(ctx, 0xfff08a, x, 36 + off, 2, 3, 0.8);
        fill(ctx, 0xd83214, x, H - 46 + off, 3, 18);
        fill(ctx, 0xff7a1a, x, H - 41 + off, 3, 8);
      }
      noise(ctx, rng, 0, 0, W, H, [0x4a2626, 0xff5a1e], 0.04);
      break;
    }
  }
}

/** Porta sinistra: parte dietro (sotto i giocatori) e parte davanti (sopra). */
export function drawGoals(scene: Phaser.Scene, p: PitchDef, keyBack: string, keyFront: string) {
  const th = THEMES[p.id];
  const D = GOAL_DEPTH;
  const gw = p.goalWidth;
  const w = D + 4;
  const h = gw + BAR_H + 4;
  // origine del canvas: x = -D-2, y = goalTop - BAR_H - 2
  const back = ctx2d(w, h);
  const front = ctx2d(w, h);
  const X = (x: number) => x + D + 2;
  const Y = (y: number) => y + BAR_H + 2; // y relativo a goalTop
  // rete laterale superiore (dietro)
  const b = back.ctx;
  b.fillStyle = 'rgba(0,0,0,0.25)';
  b.fillRect(X(-D), Y(-BAR_H), D, BAR_H);
  b.strokeStyle = th.net;
  b.lineWidth = 1;
  for (let x = -D; x <= 0; x += 4) {
    b.fillStyle = th.net;
    b.fillRect(X(x), Y(-BAR_H), 1, BAR_H);
  }
  for (let y = -BAR_H; y <= 0; y += 4) b.fillRect(X(-D), Y(y), D, 1);
  // rete di fondo (vista quasi di taglio)
  b.fillStyle = 'rgba(0,0,0,0.2)';
  b.fillRect(X(-D), Y(-BAR_H), 3, gw + BAR_H);
  // pavimento della porta: rete a terra
  b.fillStyle = th.net;
  for (let y = 0; y <= gw; y += 6) b.fillRect(X(-D), Y(y), D, 1);

  const f = front.ctx;
  // tetto della rete
  for (let x = -D; x <= 0; x += 4) {
    f.fillStyle = th.net;
    f.fillRect(X(x), Y(-BAR_H), 1, gw);
  }
  for (let y = 0; y <= gw; y += 4) f.fillRect(X(-D), Y(y - BAR_H), D, 1);
  // rete laterale inferiore (davanti)
  f.fillStyle = 'rgba(255,255,255,0.08)';
  f.fillRect(X(-D), Y(gw - BAR_H), D, BAR_H);
  f.fillStyle = th.net;
  for (let x = -D; x <= 0; x += 4) f.fillRect(X(x), Y(gw - BAR_H), 1, BAR_H);
  for (let y = gw - BAR_H; y <= gw; y += 4) f.fillRect(X(-D), Y(y), D, 1);
  // pali e traversa
  const post = hex(th.post);
  const postDark = hex(shade(th.post, 0.7));
  f.fillStyle = post;
  f.fillRect(X(-1), Y(-BAR_H), 3, gw + BAR_H + 1);
  f.fillStyle = postDark;
  f.fillRect(X(1), Y(-BAR_H), 1, gw + BAR_H + 1);
  // palo vicino (in basso) più marcato
  f.fillStyle = post;
  f.fillRect(X(-1), Y(gw - BAR_H), 3, BAR_H + 1);
  // traverse posteriori
  f.fillStyle = postDark;
  f.fillRect(X(-D), Y(-BAR_H), D, 1);
  f.fillRect(X(-D), Y(gw - BAR_H), D, 1);
  f.fillRect(X(-D), Y(-BAR_H), 1, gw);
  if (scene.textures.exists(keyBack)) scene.textures.remove(keyBack);
  if (scene.textures.exists(keyFront)) scene.textures.remove(keyFront);
  scene.textures.addCanvas(keyBack, back.cv);
  scene.textures.addCanvas(keyFront, front.cv);
}

/** Pubblico: due fotogrammi per l'animazione. */
export function drawCrowd(scene: Phaser.Scene, p: PitchDef, homeColor: number, awayColor: number, keyA: string, keyB: string) {
  const th = THEMES[p.id];
  const W = p.width + MARGIN * 2;
  const H = p.height + MARGIN * 2;
  const A = ctx2d(W, H);
  const B = ctx2d(W, H);
  const rng = new Rng(99);
  const skins = [0xf3cba5, 0xe2ab83, 0xc68a5e, 0x9a6440, 0x6b4428];
  const shirts = [homeColor, homeColor, awayColor, 0xf2f2f2, 0x30343f, 0xd8423c, 0x2a7de1, 0xf2b72f];
  const areas: [number, number, number, number][] = [];
  const M = MARGIN;
  if (p.id === 'stadio') {
    areas.push([0, 4, W, M - 24]);
    areas.push([0, M + p.height + 14, W, M - 18]);
    areas.push([4, M - 10, M - 40, p.height + 12]);
    areas.push([W - M + 36, M - 10, M - 40, p.height + 12]);
  } else if (p.id === 'spiaggia') {
    areas.push([0, M + p.height + 18, W, 20]);
  } else if (p.id === 'neve') {
    areas.push([40, M - 40, W - 80, 14]);
    areas.push([40, M + p.height + 16, W - 80, 14]);
  } else if (p.id === 'tetto') {
    areas.push([60, M + p.height + 16, W - 120, 14]);
  } else if (p.id === 'piazza') {
    areas.push([20, M - 26, W - 40, 8]);
    areas.push([20, M + p.height + 14, W - 40, 16]);
  } else if (p.id === 'montagna') {
    areas.push([40, M - 34, W - 80, 10]);
  } else if (p.id === 'molo') {
    areas.push([60, M + p.height + 22, W - 120, 8]);
  } else if (p.id === 'flipper') {
    areas.push([40, M - 40, W - 80, 10]);
    areas.push([40, M + p.height + 16, W - 80, 12]);
  } else if (p.id === 'fango') {
    areas.push([50, M - 36, W - 100, 10]);
    areas.push([50, M + p.height + 14, W - 100, 12]);
  } else if (p.id === 'vulcano') {
    areas.push([50, M - 38, W - 100, 10]);
  } else {
    areas.push([20, M - 48, W - 40, 6]);
    areas.push([30, M + p.height + 14, W - 60, 12]);
  }
  for (const [x0, y0, w, h] of areas) {
    const density = th.crowd;
    for (let y = y0; y < y0 + h - 5; y += 5) {
      for (let x = x0; x < x0 + w - 4; x += 4) {
        if (!rng.chance(density * 0.92)) continue;
        const skin = rng.pick(skins);
        const shirt = rng.pick(shirts);
        const jx = Math.round(rng.range(-1, 1));
        const cheer = rng.chance(0.45);
        for (const [ctx, up] of [
          [A.ctx, 0],
          [B.ctx, cheer ? 1 : 0],
        ] as const) {
          fill(ctx, shirt, x + jx, y + 2 - up, 3, 3);
          fill(ctx, skin, x + jx, y - up, 2, 2);
          if (up && rng.chance(0.6)) {
            fill(ctx, skin, x + jx - 1, y - 2, 1, 2);
            fill(ctx, skin, x + jx + 3, y - 2, 1, 2);
          }
        }
      }
    }
  }
  // bandiere/striscioni nello stadio
  if (p.id === 'stadio') {
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * (W - 120) / 5;
      const c = i % 2 ? homeColor : awayColor;
      fill(A.ctx, c, x, 10, 40, 8);
      fill(B.ctx, c, x, 11, 40, 8);
      fill(A.ctx, shade(c, 0.7), x, 17, 40, 1);
    }
  }
  for (const k of [keyA, keyB]) if (scene.textures.exists(k)) scene.textures.remove(k);
  scene.textures.addCanvas(keyA, A.cv);
  scene.textures.addCanvas(keyB, B.cv);
}

/** Fontana e statua della piazza, disegnate in piedi (origine ai piedi). */
export function drawObstacle(scene: Phaser.Scene, kind: 'fontana' | 'statua', r: number, key: string) {
  if (scene.textures.exists(key)) return;
  if (kind === 'fontana') {
    const w = r * 2 + 4;
    const h = r + 40;
    const { cv, ctx } = ctx2d(w, h);
    const cx = w / 2;
    const by = h - r * 0.55 - 2;
    // vasca ellittica
    for (let y = -r * 0.55; y <= r * 0.55; y++) {
      const ww = Math.sqrt(1 - (y / (r * 0.55)) ** 2) * r;
      fill(ctx, 0xb8ab94, cx - ww, by + y, ww * 2, 1);
    }
    for (let y = -r * 0.4; y <= r * 0.4; y++) {
      const ww = Math.sqrt(1 - (y / (r * 0.4)) ** 2) * (r - 5);
      fill(ctx, y < 0 ? 0x5ab0e0 : 0x3a90c8, cx - ww, by + y - 2, ww * 2, 1);
    }
    fill(ctx, 0x8a7e68, cx - r, by + r * 0.3, r * 2, 3, 0.6);
    // colonna e zampillo
    fill(ctx, 0x9a8e7c, cx - 3, by - 26, 6, 26);
    fill(ctx, 0xc9bfae, cx - 6, by - 28, 12, 4);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI;
      for (let k = 0; k < 10; k++) fill(ctx, 0xbfe8ff, cx + Math.cos(a) * k * 1.3, by - 30 - Math.sin(a) * 6 + k * k * 0.12, 1, 1, 0.8);
    }
    fill(ctx, 0xffffff, cx - 1, by - 36, 2, 7, 0.9);
    scene.textures.addCanvas(key, cv);
  } else {
    const w = r * 2 + 4;
    const h = 56;
    const { cv, ctx } = ctx2d(w, h);
    const cx = w / 2;
    // piedistallo e calciatore di bronzo
    fill(ctx, 0xc9bfae, cx - r, h - 18, r * 2, 18);
    fill(ctx, 0xe4dccc, cx - r, h - 18, r * 2, 2);
    fill(ctx, 0x8a7e68, cx - r, h - 3, r * 2, 3);
    const bz = 0x6a8a6a;
    fill(ctx, bz, cx - 3, h - 46, 6, 6); // testa
    fill(ctx, bz, cx - 5, h - 40, 10, 12); // busto
    fill(ctx, bz, cx - 8, h - 40, 3, 9);
    fill(ctx, bz, cx + 5, h - 44, 3, 8); // braccio alzato
    fill(ctx, bz, cx - 4, h - 28, 3, 10);
    fill(ctx, bz, cx + 2, h - 28, 7, 3); // gamba che calcia
    fill(ctx, 0xf4f4f4, cx + 8, h - 30, 4, 4); // pallone
    fill(ctx, 0x8aaa8a, cx - 3, h - 46, 2, 18, 0.6);
    scene.textures.addCanvas(key, cv);
  }
}
