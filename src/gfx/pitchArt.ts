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
  if (p.id === 'quartiere') {
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
  // sponde con pubblicità
  fill(ctx, th.board, ox - 6, oy - bh, W + 12, bh);
  fill(ctx, th.boardHi, ox - 6, oy - bh, W + 12, 2);
  if (p.id === 'tetto') {
    fill(ctx, 0x39e6ff, ox - 6, oy - 4, W + 12, 1);
    fill(ctx, 0xff3fa4, ox - 6, oy + H + 6, W + 12, 1);
    for (let x = 0; x < W; x += 24) fill(ctx, 0x5a6c8c, ox + x, oy - bh + 2, 1, bh - 6);
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
