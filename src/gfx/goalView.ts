import type Phaser from 'phaser';
import { Rng } from '../sim/math';

/** Vista della porta da dietro il dischetto (rigori, allenamento). */
export const GOAL_HW = 150;
export const GOAL_H = 100;
export const GROUND_Y = 196;
export const SPOT_Y = 300;

/** Tribune, cartelloni e prato in prospettiva; `cols` = colori delle due curve. */
export function drawGoalBackground(scene: Phaser.Scene, W: number, H: number, cols0: [number, number], key: string) {
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    // tribune con il pubblico
    g.fillStyle(0x1d2333).fillRect(0, 0, W, 76);
    const r = new Rng(7);
    const cols = [cols0[0], cols0[1], 0xd8d8d8, 0x3a4060, 0xf3cba5, 0x9a6440];
    for (let y = 4; y < 70; y += 5) {
      for (let x = (y / 5) % 2 ? 2 : 0; x < W; x += 5) {
        const c = x < W / 2 ? (r.chance(0.45) ? cols[0] : r.pick(cols.slice(2))) : r.chance(0.45) ? cols[1] : r.pick(cols.slice(2));
        g.fillStyle(c, 0.9).fillRect(x, y, 3, 3);
      }
    }
    g.fillStyle(0x000000, 0.25).fillRect(0, 0, W, 76);
    // cartelloni
    const bc = [0xe8443a, 0x2f6fd0, 0xffd23f, 0x2f9a50];
    for (let i = 0; i * 80 < W; i++) {
      g.fillStyle(bc[i % bc.length]).fillRect(i * 80, 76, 80, 14);
      g.fillStyle(0xffffff, 0.25).fillRect(i * 80, 76, 80, 2);
      g.fillStyle(0x1a1222).fillRect(i * 80 + 79, 76, 1, 14);
    }
    // prato a strisce in prospettiva
    let y = 90;
    let k = 0;
    while (y < H) {
      const h = 8 + k * 3;
      g.fillStyle(k % 2 ? 0x48a842 : 0x3d9a3a).fillRect(0, y, W, h);
      y += h;
      k++;
    }
    // linee
    const cx = Math.round(W / 2);
    g.fillStyle(0xeff6ea);
    g.fillRect(0, GROUND_Y, W, 3);
    // area piccola
    g.lineStyle(3, 0xeff6ea);
    g.beginPath();
    g.moveTo(cx - 210, GROUND_Y + 1);
    g.lineTo(cx - 240, GROUND_Y + 34);
    g.lineTo(cx + 240, GROUND_Y + 34);
    g.lineTo(cx + 210, GROUND_Y + 1);
    g.strokePath();
    // area grande
    g.beginPath();
    g.moveTo(cx - 330, GROUND_Y + 1);
    g.lineTo(cx - 420, H - 8);
    g.moveTo(cx + 330, GROUND_Y + 1);
    g.lineTo(cx + 420, H - 8);
    g.strokePath();
    g.fillStyle(0xeff6ea).fillEllipse(cx, SPOT_Y + 3, 14, 5);
    g.generateTexture(key, W, H);
    g.destroy();
  }
}

/** Rete e pali; `bulge` gonfia la rete dopo un gol. */
export function drawGoalNet(g: Phaser.GameObjects.Graphics, cx: number, bulge: number, bx = 0) {
  g.clear();
  const top = GROUND_Y - GOAL_H;
  const backTop = top + 10 - bulge * 4;
  const backHW = GOAL_HW - 14;
  g.fillStyle(0x0d1a10, 0.35).fillRect(cx - backHW, backTop, backHW * 2, GROUND_Y - 10 - backTop);
  g.lineStyle(1, 0xffffff, 0.45);
  const bxOff = bx * bulge * 6;
  for (let i = 0; i <= 24; i++) {
    const x = cx - backHW + (i * backHW * 2) / 24 + bxOff * Math.sin((i / 24) * Math.PI);
    g.lineBetween(x, backTop, x, GROUND_Y - 10);
  }
  for (let j = 0; j <= 8; j++) {
    const y = backTop + (j * (GROUND_Y - 10 - backTop)) / 8;
    g.lineBetween(cx - backHW, y, cx + backHW, y);
  }
  // reti laterali e superiore
  g.lineStyle(1, 0xffffff, 0.35);
  for (let j = 0; j <= 6; j++) {
    const t = j / 6;
    g.lineBetween(cx - GOAL_HW, top + t * GOAL_H, cx - backHW, backTop + t * (GROUND_Y - 10 - backTop));
    g.lineBetween(cx + GOAL_HW, top + t * GOAL_H, cx + backHW, backTop + t * (GROUND_Y - 10 - backTop));
    g.lineBetween(cx - GOAL_HW + t * GOAL_HW * 2, top, cx - backHW + t * backHW * 2, backTop);
  }
  // pali e traversa
  g.fillStyle(0x000000, 0.3).fillRect(cx + GOAL_HW + 3, top + 3, 4, GOAL_H);
  g.fillStyle(0x1a1222).fillRect(cx - GOAL_HW - 4, top - 4, 8, GOAL_H + 6);
  g.fillRect(cx + GOAL_HW - 4, top - 4, 8, GOAL_H + 6);
  g.fillRect(cx - GOAL_HW - 4, top - 4, GOAL_HW * 2 + 8, 8);
  g.fillStyle(0xf4f4f4).fillRect(cx - GOAL_HW - 3, top - 3, 6, GOAL_H + 4);
  g.fillRect(cx + GOAL_HW - 3, top - 3, 6, GOAL_H + 4);
  g.fillRect(cx - GOAL_HW - 3, top - 3, GOAL_HW * 2 + 6, 6);
  g.fillStyle(0xbfc6cc).fillRect(cx - GOAL_HW + 1, top - 3, 2, GOAL_H + 4);
  g.fillRect(cx + GOAL_HW + 1, top - 3, 2, GOAL_H + 4);
}
