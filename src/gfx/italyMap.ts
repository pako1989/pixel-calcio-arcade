import { mix, Px, shade } from './px';

/**
 * Mappa d'Italia in pixel art, disegnata in codice da un contorno
 * semplificato (longitudine, latitudine). Ogni città ha il suo "territorio"
 * (la zona di terra più vicina a lei): quando la conquisti si colora
 * con la divisa della tua squadra.
 */

type Pt = [number, number];

const PENISOLA: Pt[] = [
  [7.53, 43.78], [8.0, 43.88], [8.4, 44.2], [8.93, 44.41], [9.5, 44.22], [9.85, 44.05], [10.22, 43.9], [10.3, 43.55],
  [10.5, 43.0], [11.1, 42.42], [11.8, 42.05], [12.25, 41.75], [12.62, 41.45], [13.05, 41.23], [13.6, 41.25], [13.95, 40.98],
  [14.08, 40.8], [14.3, 40.82], [14.42, 40.62], [14.75, 40.66], [15.0, 40.4], [15.2, 40.02], [15.65, 40.0], [15.8, 39.62],
  [16.05, 39.05], [16.2, 38.72], [15.85, 38.65], [15.92, 38.28], [15.64, 38.02], [15.75, 37.92], [16.06, 37.92], [16.55, 38.38],
  [16.6, 38.8], [17.15, 39.05], [17.12, 39.4], [16.6, 39.75], [16.88, 40.38], [17.2, 40.45], [17.9, 40.3], [18.05, 40.05],
  [18.37, 39.8], [18.52, 40.15], [18.0, 40.65], [17.4, 40.9], [16.87, 41.15], [16.2, 41.35], [15.9, 41.52], [16.18, 41.9],
  [15.6, 41.94], [15.1, 41.96], [14.7, 42.12], [14.2, 42.46], [13.9, 42.9], [13.62, 43.55], [13.0, 43.85], [12.6, 44.1],
  [12.3, 44.45], [12.42, 44.85], [12.25, 45.2], [12.35, 45.45], [12.8, 45.6], [13.1, 45.66], [13.6, 45.75], [13.78, 45.6],
  [13.9, 45.9], [13.55, 46.2], [13.7, 46.52], [12.7, 46.65], [12.2, 46.9], [11.9, 47.05], [11.2, 46.95], [10.5, 46.85],
  [10.4, 46.55], [10.1, 46.4], [9.4, 46.5], [9.0, 46.02], [8.7, 46.1], [8.45, 46.45], [8.0, 46.02], [7.85, 45.95],
  [7.0, 45.86], [6.8, 45.6], [7.1, 45.25], [6.65, 45.05], [7.0, 44.7], [6.85, 44.45], [7.7, 44.15],
];

const SICILIA: Pt[] = [
  [12.43, 37.8], [12.55, 38.08], [13.1, 38.19], [13.36, 38.13], [14.0, 38.02], [14.8, 38.16], [15.25, 38.26], [15.65, 38.27],
  [15.2, 37.75], [15.1, 37.48], [15.3, 37.1], [15.1, 36.68], [14.5, 36.78], [14.1, 37.06], [13.4, 37.26], [12.6, 37.6],
];

const SARDEGNA: Pt[] = [
  [9.2, 41.25], [9.62, 41.0], [9.82, 40.5], [9.7, 39.95], [9.65, 39.3], [9.5, 39.12], [9.05, 39.2], [8.6, 38.88],
  [8.38, 39.1], [8.45, 39.5], [8.52, 39.9], [8.4, 40.4], [8.15, 40.6], [8.2, 40.95], [8.6, 40.86], [8.9, 40.98],
];

const ELBA: Pt[] = [[10.1, 42.82], [10.45, 42.85], [10.42, 42.72], [10.12, 42.74]];

/** Area della mappa in gradi. */
const LON0 = 6.3;
const LAT0 = 47.4;
const ROWS_PER_DEG = 10.5;
const COLS_PER_DEG = ROWS_PER_DEG * Math.cos((42 * Math.PI) / 180);
export const MAP_COLS = Math.ceil((18.9 - LON0) * COLS_PER_DEG);
export const MAP_ROWS = Math.ceil((LAT0 - 36.3) * ROWS_PER_DEG);

/** Da longitudine/latitudine a cella della mappa. */
export function project(lon: number, lat: number): { x: number; y: number } {
  return { x: (lon - LON0) * COLS_PER_DEG, y: (LAT0 - lat) * ROWS_PER_DEG };
}

let maskCache: Uint8Array | null = null;

/** 1 = terra, 0 = mare. */
function landMask(): Uint8Array {
  if (maskCache) return maskCache;
  const cv = document.createElement('canvas');
  cv.width = MAP_COLS;
  cv.height = MAP_ROWS;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000';
  for (const poly of [PENISOLA, SICILIA, SARDEGNA, ELBA]) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const p = project(lon, lat);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
  }
  const d = ctx.getImageData(0, 0, MAP_COLS, MAP_ROWS).data;
  const m = new Uint8Array(MAP_COLS * MAP_ROWS);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] >= 110 ? 1 : 0;
  maskCache = m;
  return m;
}

export interface MapCity {
  lon: number;
  lat: number;
}

/** Rumore deterministico per le colline. */
function noise(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * Disegna la mappa. `owned` = numero di città conquistate (in ordine),
 * `color` = colori della squadra per i territori conquistati.
 */
export function drawItaly(cities: MapCity[], owned: number, color: number, color2: number): HTMLCanvasElement {
  const land = landMask();
  const W = MAP_COLS;
  const H = MAP_ROWS;
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && land[y * W + x] === 1;
  const pts = cities.map((c) => project(c.lon, c.lat));
  const owner = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isLand(x, y)) continue;
      let best = 0;
      let bd = Infinity;
      pts.forEach((p, i) => {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      owner[y * W + x] = best;
    }
  }
  const px = new Px(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise(x, y);
      if (!isLand(x, y)) {
        // mare con qualche onda e schiuma vicino alla costa
        const nearLand = isLand(x - 1, y) || isLand(x + 1, y) || isLand(x, y - 1) || isLand(x, y + 1);
        let c = y % 2 === 0 ? 0x1b3f78 : 0x1a3b72;
        if (!nearLand && (x * 3 + y * 7) % 29 === 0) c = 0x2f62a8;
        if (nearLand) c = 0x3a78c0;
        px.set(x, y, c);
        continue;
      }
      const own = owner[y * W + x];
      const coast = !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1);
      // montagne: Alpi a nord, Appennino lungo la penisola (dither)
      const alps = (y < 13 || (x < 10 && y < 22)) && isLand(x, y + 2);
      let c = n < 0.5 ? 0x4f9a3c : 0x468f36;
      if (alps) c = n < 0.35 ? 0xe8eef5 : n < 0.7 ? 0x9aa3a8 : 0x7d8a6a;
      else if (n > 0.93) c = 0x2f6f2a;
      if (own >= 0 && own < owned) {
        // territorio conquistato: colore della maglia con righe del secondo colore
        c = (x + y) % 6 === 0 ? mix(c, color2, 0.7) : mix(c, color, 0.72);
      }
      if (coast) c = own >= 0 && own < owned ? mix(0xe0cf8a, color, 0.3) : 0xd8c27a;
      // confine tra territori, marcato se uno dei due è conquistato
      const r = owner[y * W + x + 1];
      const b = y + 1 < H ? owner[(y + 1) * W + x] : -1;
      const border = (r >= 0 && x + 1 < W && r !== own) || (b >= 0 && b !== own);
      if (border && !coast && (own < owned || (r >= 0 && r < owned) || (b >= 0 && b < owned))) c = shade(c, 0.55);
      px.set(x, y, c);
    }
  }
  return px.toCanvas();
}
