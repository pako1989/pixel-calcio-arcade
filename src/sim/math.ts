export interface Vec {
  x: number;
  y: number;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const len = (x: number, y: number) => Math.sqrt(x * x + y * y);
export const dist = (a: Vec, b: Vec) => len(a.x - b.x, a.y - b.y);
export const dist2 = (a: Vec, b: Vec) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

export function norm(x: number, y: number): Vec {
  const l = len(x, y);
  return l > 1e-6 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}

export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Avvicina un angolo verso un altro di al massimo `step` radianti. */
export function turnTowards(a: number, b: number, step: number): number {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

/** Distanza di un punto da un segmento. */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 < 1e-6) return dist(p, a);
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1);
  return len(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/** Generatore pseudo-casuale con seme (mulberry32): partite riproducibili nei test. */
export class Rng {
  private s: number;
  constructor(seed = Date.now()) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
