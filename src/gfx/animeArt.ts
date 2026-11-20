import Phaser from 'phaser';
import { Px, shade, mix } from './px';
import { HAIR, OUTLINE, SKIN } from './sprites';
import type { Face, LgPlayer, LgTeam } from '../modes/leggenda';
import type { PlayerDef, TeamDef } from '../sim/types';

/**
 * Ritratti in stile anime sportivo disegnati a pixel (48x48), generati in codice:
 * occhi grandi con i riflessi, capelli a punte, fasce, occhiali, sciarpa...
 */

export const PORTRAIT = 48;
export type Expr = 'normale' | 'urlo' | 'sorriso' | 'grinta' | 'triste';

const CX = 24;

/** Mezza larghezza del viso per riga. */
function faceHalf(y: number): number {
  if (y < 12 || y > 36) return 0;
  if (y <= 13) return 9;
  if (y <= 27) return 10;
  if (y <= 30) return 9;
  return [8, 7, 6, 5, 4, 3][y - 31] ?? 0;
}

function inFace(x: number, y: number) {
  const hw = faceHalf(y);
  return hw > 0 && x >= CX - hw && x <= CX + hw - 1;
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inTri(px: number, py: number, a: [number, number], b: [number, number], c: [number, number]) {
  const s = (p1: [number, number], p2: [number, number], p3: [number, number]) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const p: [number, number] = [px + 0.5, py + 0.5];
  const d1 = s(p, a, b);
  const d2 = s(p, b, c);
  const d3 = s(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

type Tri = [[number, number], [number, number], [number, number]];

/** Capelli: parte dietro al viso e parte davanti (frangia). */
function hairMask(style: Face['style'], x: number, y: number): 'back' | 'front' | null {
  const skull = inEllipse(x, y, 24, 17, 12.5, 11.5);
  const fringeY = (fy: number) => skull && y <= fy;
  switch (style) {
    case 'punte': {
      const spikes: Tri[] = [
        [[12, 14], [6, 3], [18, 8]], [[16, 8], [15, -1], [24, 6]], [[22, 6], [27, -2], [30, 7]],
        [[28, 6], [38, 0], [35, 12]], [[34, 10], [44, 8], [36, 18]], [[13, 14], [5, 16], [12, 22]],
        [[35, 16], [42, 20], [35, 23]],
      ];
      if (spikes.some((t) => inTri(x, y, ...t))) return 'back';
      const jag = 16 + Math.abs(((x + 1) % 5) - 2) * 1.3 + (x > 26 ? 1 : 0);
      if (fringeY(jag)) return 'front';
      if (skull && (x < 15 || x > 33) && y < 24) return 'front';
      return null;
    }
    case 'ciuffo': {
      if (inTri(x, y, [12, 10], [26, 6], [16, 22])) return 'front';
      const fy = 14 + (x - 14) * 0.25;
      if (fringeY(fy)) return 'front';
      if (skull && (x < 15 || x > 33) && y < 22) return 'front';
      return null;
    }
    case 'lunghi': {
      if ((x >= 10 && x <= 16 && y >= 12 && y <= 38) || (x >= 31 && x <= 38 && y >= 12 && y <= 38)) {
        if (y > 34 && (x === 10 || x === 38)) return null;
        return 'back';
      }
      const fy = 15 + Math.abs(((x + 2) % 6) - 3) * 1.2;
      if (fringeY(fy)) return 'front';
      if (skull && (x < 15 || x > 33)) return 'front';
      return null;
    }
    case 'raccolti': {
      if (inTri(x, y, [32, 10], [44, 16], [38, 34])) return 'back';
      const part = x < 22 ? 15 + (22 - x) * 0.3 : 15 - (x - 22) * 0.15;
      if (fringeY(part)) return 'front';
      if (skull && (x < 15 || x > 33) && y < 26) return 'front';
      return null;
    }
    case 'brizzolati': {
      if (fringeY(12 + (Math.abs(x - 24) > 6 ? 2 : 0))) return 'front';
      if (skull && (x < 15 || x > 33) && y < 22) return 'front';
      return null;
    }
    case 'ricci': {
      const big = inEllipse(x, y, 24, 15, 15, 12.5);
      const bump = Math.sin(x * 1.3) * 1.2 + Math.cos(y * 1.1) * 1.2;
      const edge = inEllipse(x, y, 24, 15, 15 + bump, 12.5 + bump);
      if ((big || edge) && y <= 16 + Math.abs(((x + 1) % 4) - 2)) return 'front';
      if ((big || edge) && (x < 15 || x > 33) && y < 26) return 'front';
      return null;
    }
    case 'rasati':
      if (fringeY(13)) return 'front';
      if (skull && (x < 15 || x > 33) && y < 18) return 'front';
      return null;
    case 'cresta':
      if (inTri(x, y, [18, 10], [24, -1], [30, 10]) || (inEllipse(x, y, 24, 10, 6, 6) && y < 14)) return 'front';
      if (skull && y < 14 && (x < 15 || x > 33)) return 'front';
      return null;
    case 'corti':
    default: {
      const fy = 14 + ((x % 4) === 0 ? 2 : 0);
      if (fringeY(fy)) return 'front';
      if (skull && (x < 15 || x > 33) && y < 22) return 'front';
      return null;
    }
  }
}

export interface PortraitOpts {
  expr?: Expr;
  sepia?: boolean;
}

function drawPortrait(f: Face, shirt: number, expr: Expr): Px {
  const px = new Px(PORTRAIT, PORTRAIT);
  const skin = SKIN[Math.max(0, Math.min(SKIN.length - 1, f.skin))];
  const skinD = shade(skin, 0.82);
  const hair = f.hair;
  const hairHi = mix(hair, 0xffffff, 0.35);
  const hairD = shade(hair, 0.7);

  // capelli dietro
  for (let y = 0; y < PORTRAIT; y++) for (let x = 0; x < PORTRAIT; x++) if (hairMask(f.style, x, y) === 'back') px.set(x, y, x > 30 ? hairD : hair);
  // fascia: il nodo dietro
  if (f.band !== undefined) {
    px.rect(36, 13, 3, 2, f.band);
    px.rect(38, 15, 3, 3, shade(f.band, 0.8));
  }

  // spalle e maglia
  for (let y = 39; y < PORTRAIT; y++) {
    const hw = Math.min(20, 8 + (y - 39) * 3);
    for (let x = CX - hw; x < CX + hw; x++) {
      let c = shirt;
      if (x >= CX + hw - 3) c = shade(shirt, 0.78);
      if (y === 39) c = shade(shirt, 1.1);
      px.set(x, y, c);
    }
  }
  // colletto a V
  for (let i = 0; i < 4; i++) {
    px.set(CX - 3 + i, 39 + i, skinD);
    px.set(CX + 2 - i, 39 + i, skinD);
  }
  // collo
  px.rect(20, 34, 8, 6, skinD);
  px.rect(20, 34, 6, 3, shade(skin, 0.72));
  // orecchie
  px.rect(12, 22, 2, 5, skin);
  px.rect(34, 22, 2, 5, skinD);
  // viso
  for (let y = 12; y <= 36; y++) {
    for (let x = 0; x < PORTRAIT; x++) {
      if (!inFace(x, y)) continue;
      const hw = faceHalf(y);
      let c = skin;
      if (x >= CX + hw - 3) c = skinD;
      if (y >= 33 && x >= CX) c = skinD;
      px.set(x, y, c);
    }
  }
  // guance rosate
  if (expr === 'sorriso' || expr === 'urlo') {
    px.set(16, 29, mix(skin, 0xff6a6a, 0.35));
    px.set(17, 29, mix(skin, 0xff6a6a, 0.35));
    px.set(30, 29, mix(skin, 0xff6a6a, 0.3));
    px.set(31, 29, mix(skin, 0xff6a6a, 0.3));
  }

  // occhi (sinistro disegnato, destro specchiato)
  const eye = (mirror: boolean) => {
    const X = (x: number) => (mirror ? 47 - x : x);
    const iris = f.eyes;
    if (expr === 'triste' || (expr === 'sorriso' && f.brows === 'calmo')) {
      // occhi socchiusi
      for (let x = 17; x <= 22; x++) px.set(X(x), x === 17 || x === 22 ? 25 : 24, OUTLINE);
      return;
    }
    const top = expr === 'grinta' || expr === 'urlo' ? 23 : 22;
    for (let x = 17; x <= 22; x++) px.set(X(x), top, OUTLINE);
    px.set(X(16), top + 1, OUTLINE);
    px.set(X(22), top + 1, OUTLINE);
    for (let y = top + 1; y <= 27; y++) {
      px.set(X(18), y, 0xf4f4ff);
      for (let x = 19; x <= 22; x++) {
        let c = y === top + 1 ? shade(iris, 0.55) : y >= 26 ? mix(iris, 0xffffff, 0.3) : iris;
        if ((x === 20 || x === 21) && y >= top + 2 && y <= 26) c = 0x141020;
        px.set(X(x), y, c);
      }
    }
    // riflessi
    px.set(X(21), top + 2, 0xffffff);
    px.set(X(19), 26, 0xffffff);
    // ciglia inferiori
    for (let x = 18; x <= 21; x++) px.set(X(x), 28, shade(skin, 0.6));
  };
  eye(false);
  eye(true);

  // sopracciglia
  const browC = shade(hair, 0.8);
  if (f.brows === 'calmo') {
    for (let x = 17; x <= 22; x++) {
      px.set(x, 19, browC);
      px.set(47 - x, 19, browC);
    }
  } else {
    const yb = expr === 'urlo' || expr === 'grinta' ? 1 : 0;
    for (let x = 16; x <= 22; x++) {
      const y = 18 + Math.floor((x - 16) / 3) + yb;
      px.set(x, y, browC);
      px.set(x, y + 1, browC);
      px.set(47 - x, y, browC);
      px.set(47 - x, y + 1, browC);
    }
  }

  // naso
  px.set(25, 30, shade(skin, 0.7));
  px.set(25, 31, shade(skin, 0.75));

  // bocca
  const lip = shade(skin, 0.5);
  switch (expr) {
    case 'urlo':
      for (let y = 32; y <= 35; y++) for (let x = 21 - (y === 33 || y === 34 ? 1 : 0); x <= 27 + (y === 33 || y === 34 ? 1 : 0); x++) px.set(x, y, 0x3a1018);
      px.rect(21, 32, 7, 1, 0xffffff);
      px.rect(22, 35, 5, 1, 0xd05060);
      break;
    case 'grinta':
      px.rect(21, 33, 7, 2, 0xffffff);
      px.rect(21, 33, 7, 1, 0xf0f0f0);
      for (let x = 20; x <= 28; x++) px.set(x, 32, lip), px.set(x, 35, lip);
      px.set(24, 34, 0xc8c8d8);
      break;
    case 'sorriso':
      for (let x = 21; x <= 27; x++) px.set(x, 33, lip);
      px.set(20, 32, lip);
      px.set(28, 32, lip);
      px.rect(22, 34, 5, 1, mix(lip, 0xd05060, 0.5));
      break;
    case 'triste':
      for (let x = 22; x <= 26; x++) px.set(x, 33, lip);
      px.set(21, 34, lip);
      px.set(27, 34, lip);
      break;
    default:
      for (let x = 22; x <= 26; x++) px.set(x, 33, lip);
  }

  if (f.plaster) {
    px.rect(28, 29, 4, 2, 0xf2dcb0);
    px.set(29, 29, 0xd8b890);
  }
  if (f.beard) {
    const bc = shade(hair, 0.85);
    for (let y = 30; y <= 36; y++) {
      for (let x = 14; x <= 34; x++) {
        const mouth = x >= 20 && x <= 28 && y >= 32 && y <= 34;
        const jaw = y >= 33 || x <= 16 || x >= 31;
        if (inFace(x, y) && jaw && !mouth && (x + y) % 2 === 0) px.set(x, y, bc);
      }
    }
    for (let x = 21; x <= 27; x++) if (x % 2 === 0) px.set(x, 31, bc);
  }

  // capelli davanti
  for (let y = 0; y < PORTRAIT; y++) {
    for (let x = 0; x < PORTRAIT; x++) {
      if (hairMask(f.style, x, y) !== 'front') continue;
      let c = hair;
      // riflesso a fascia, tipico degli anime
      const arc = 8 + Math.round(((x - 21) / 6) ** 2);
      if (x >= 15 && x <= 28 && (y === arc || (y === arc + 1 && x % 3 !== 0))) c = hairHi;
      else if (x > 30) c = hairD;
      if (f.style === 'brizzolati' && (x * 3 + y) % 5 === 0) c = 0xe2e2ea;
      if (f.style === 'rasati') c = (x + y) % 2 === 0 ? shade(hair, 0.8) : mix(hair, skin, 0.35);
      px.set(x, y, c);
    }
  }
  if (f.band !== undefined) {
    for (let x = 12; x <= 36; x++) {
      if (inFace(x, 15) || hairMask(f.style, x, 15) || x <= 13 || x >= 35) {
        px.set(x, 14, f.band);
        px.set(x, 15, shade(f.band, 0.8));
      }
    }
  }
  if (f.glasses) {
    const gl = 0x1a1a28;
    for (const x0 of [16, 25]) {
      px.rect(x0, 22, 7, 5, gl);
      px.set(x0 + 1, 23, 0x5a5f80);
      px.set(x0 + 2, 23, 0x5a5f80);
    }
    px.rect(23, 23, 2, 1, gl);
    px.rect(13, 23, 3, 1, gl);
    px.rect(32, 23, 3, 1, gl);
  }
  if (f.scarf !== undefined) {
    for (let y = 34; y <= 41; y++) {
      for (let x = 14; x <= 34; x++) {
        const d = Math.abs(x - 24) / 10;
        if (y < 35 + d * 2) continue;
        px.set(x, y, (x + y * 2) % 7 === 0 ? shade(f.scarf, 0.75) : x > 29 ? shade(f.scarf, 0.85) : f.scarf);
      }
    }
    px.rect(28, 41, 4, 7, shade(f.scarf, 0.8));
  }

  px.outline(0, 0, PORTRAIT, PORTRAIT, OUTLINE);
  return px;
}

function sepiaCanvas(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!;
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
  }
  ctx.putImageData(img, 0, 0);
}

/** Texture del ritratto (creata una volta sola per combinazione). */
export function portrait(scene: Phaser.Scene, id: string, face: Face, shirt: number, opts: PortraitOpts = {}): string {
  const expr = opts.expr ?? 'normale';
  const key = `pt_${id}_${shirt.toString(16)}_${expr}${opts.sepia ? '_s' : ''}`;
  if (scene.textures.exists(key)) return key;
  const cv = drawPortrait(face, shirt, expr).toCanvas();
  if (opts.sepia) sepiaCanvas(cv);
  scene.textures.addCanvas(key, cv);
  return key;
}

// ---------- sprite in campo ----------

function nearestHair(c: number): number {
  let best = 0;
  let bd = Infinity;
  HAIR.forEach((h, i) => {
    const d = Math.abs(((h >> 16) & 255) - ((c >> 16) & 255)) + Math.abs(((h >> 8) & 255) - ((c >> 8) & 255)) + Math.abs((h & 255) - (c & 255));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

const STYLE_SPRITE: Record<Face['style'], number> = { punte: 0, ciuffo: 1, lunghi: 2, corti: 1, cresta: 3, raccolti: 2, brizzolati: 3, ricci: 0, rasati: 3 };

/** Converte i personaggi per riusare gli sprite del gioco. */
export function asTeamDef(t: LgTeam): TeamDef {
  return { id: t.id, name: t.name, short: t.short, colors: t.colors, pattern: t.pattern, stars: 3, players: t.players.map(asPlayerDef) };
}

export function asPlayerDef(p: LgPlayer): PlayerDef {
  return {
    name: p.name,
    number: p.num,
    role: p.role,
    stats: { speed: 1, shot: 1, pass: 1, tackle: 1, control: 1, keeping: 1 },
    look: { skin: p.face.skin, hair: nearestHair(p.face.hair), hairStyle: STYLE_SPRITE[p.face.style] },
  };
}
