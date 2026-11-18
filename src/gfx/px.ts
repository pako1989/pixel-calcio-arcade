/** Piccolo "foglio a pixel" per disegnare sprite in codice, con contorno automatico. */
export class Px {
  readonly data: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Int32Array(w * h).fill(-1);
  }
  set(x: number, y: number, c: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c & 0xffffff;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.data[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Contorno di 1 pixel attorno ai pixel pieni, dentro la cella indicata. */
  outline(x0: number, y0: number, w: number, h: number, c: number) {
    const add: number[] = [];
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (this.get(x, y) !== -1) continue;
        const n =
          (x > x0 && this.get(x - 1, y) !== -1 && this.get(x - 1, y) !== c) ||
          (x < x0 + w - 1 && this.get(x + 1, y) !== -1 && this.get(x + 1, y) !== c) ||
          (y > y0 && this.get(x, y - 1) !== -1 && this.get(x, y - 1) !== c) ||
          (y < y0 + h - 1 && this.get(x, y + 1) !== -1 && this.get(x, y + 1) !== c);
        if (n) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (c === -1) continue;
      img.data[i * 4] = (c >> 16) & 255;
      img.data[i * 4 + 1] = (c >> 8) & 255;
      img.data[i * 4 + 2] = c & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

export function shade(c: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
