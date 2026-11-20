import Phaser from 'phaser';
import { Px, shade, mix } from './px';
import type { PlayerDef, TeamDef } from '../sim/types';

export const OUTLINE = 0x1a1222;
export const SKIN = [0xf3cba5, 0xe2ab83, 0xc68a5e, 0x9a6440, 0x6b4428];
export const HAIR = [0x2a1c14, 0x5c3a20, 0xd2a24c, 0x151515, 0x8e3b1a, 0xe2dccd];

export const FRAME = 24;
export type Dir = 'down' | 'up' | 'side';
export const DIRS: Dir[] = ['down', 'up', 'side'];
export const POSES = ['idle', 'run0', 'run1', 'run2', 'run3', 'kick', 'slide', 'celebrate', 'sad', 'dive'] as const;
export type Pose = (typeof POSES)[number];

/** Indice del fotogramma nello sprite sheet. */
export function frameIndex(dir: Dir, pose: Pose): number {
  return DIRS.indexOf(dir) * POSES.length + POSES.indexOf(pose);
}

interface Kit {
  shirt: number;
  shirt2: number;
  shorts: number;
  socks: number;
  pattern: TeamDef['pattern'];
  gk: boolean;
}

const DIGITS: Record<number, string[]> = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

function lum(c: number) {
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
}

class Painter {
  constructor(
    private px: Px,
    private ox: number,
    private oy: number,
  ) {}
  p(x: number, y: number, c: number) {
    if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return;
    this.px.set(this.ox + x, this.oy + y, c);
  }
  r(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c);
  }
}

function shirtColor(kit: Kit, x: number, y: number, x0: number, y0: number, w: number): number {
  const lx = x - x0;
  const ly = y - y0;
  let c = kit.shirt;
  if (!kit.gk) {
    switch (kit.pattern) {
      case 'stripes':
        if (Math.floor(lx / 2) % 2 === 1) c = kit.shirt2;
        break;
      case 'hoops':
        if (Math.floor(ly / 2) % 2 === 1) c = kit.shirt2;
        break;
      case 'half':
        if (lx < w / 2) c = kit.shirt2;
        break;
      case 'sash':
        if (Math.abs(lx - ly - 1) <= 1) c = kit.shirt2;
        break;
    }
  }
  // luce dall'alto a sinistra
  if (ly === 0) c = shade(c, 1.12);
  if (lx === w - 1) c = shade(c, 0.78);
  else if (lx === 0) c = shade(c, 1.05);
  return c;
}

function drawTorso(P: Painter, kit: Kit, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P.p(x, y, shirtColor(kit, x, y, x0, y0, w));
}

function drawHead(P: Painter, dir: Dir, x0: number, y0: number, skin: number, hair: number, style: number, eyes: 'open' | 'closed' | 'shout') {
  // testa 6x7 con angoli arrotondati
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 6; x++) {
      if ((y === 0 || y === 6) && (x === 0 || x === 5)) continue;
      let c = skin;
      if (x === 5 || y === 6) c = shade(skin, 0.85);
      P.p(x0 + x, y0 + y, c);
    }
  }
  const hl = shade(hair, 1.35);
  if (dir === 'up') {
    // nuca: capelli quasi ovunque
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      if ((y === 0) && (x === 0 || x === 5)) continue;
      P.p(x0 + x, y0 + y, y === 0 && x > 1 && x < 4 ? hl : hair);
    }
    if (style === 2) P.r(x0 + 2, y0 + 6, 2, 1, hair);
    return;
  }
  if (dir === 'down') {
    // frangia
    P.r(x0 + 1, y0, 4, 1, hair);
    P.r(x0, y0 + 1, 6, 1, hair);
    P.p(x0 + 2, y0, hl);
    if (style === 0 || style === 2) P.r(x0, y0 + 2, 1, 2, hair), P.r(x0 + 5, y0 + 2, 1, 2, hair);
    if (style === 1) P.r(x0 + 1, y0 + 2, 2, 1, hair);
    if (style === 3) {
      // rasato: solo cima
      P.r(x0 + 1, y0 + 1, 4, 1, shade(hair, 1.2));
      P.r(x0, y0 + 1, 1, 1, skin);
      P.r(x0 + 5, y0 + 1, 1, 1, skin);
    }
    if (style === 2) P.r(x0 - 1, y0 + 1, 1, 4, hair), P.r(x0 + 6, y0 + 1, 1, 4, hair);
    // occhi
    if (eyes === 'closed') {
      P.r(x0 + 1, y0 + 4, 2, 1, OUTLINE);
      P.r(x0 + 3, y0 + 4, 2, 1, OUTLINE);
    } else {
      P.p(x0 + 1, y0 + 4, OUTLINE);
      P.p(x0 + 4, y0 + 4, OUTLINE);
      P.p(x0 + 1, y0 + 3, 0xffffff);
      P.p(x0 + 4, y0 + 3, 0xffffff);
    }
    if (eyes === 'shout') P.r(x0 + 2, y0 + 5, 2, 1, 0x6a1a1a);
    return;
  }
  // di lato (verso destra)
  P.r(x0, y0, 5, 1, hair);
  P.r(x0, y0 + 1, 6, 1, hair);
  P.r(x0, y0 + 2, 3, 2, hair);
  if (style !== 3) P.r(x0, y0 + 4, 2, 1, hair);
  if (style === 2) P.r(x0 - 1, y0 + 1, 1, 5, hair);
  P.p(x0 + 2, y0, hl);
  P.p(x0 + 4, y0 + 3, eyes === 'closed' ? shade(skin, 0.6) : OUTLINE);
  P.p(x0 + 6, y0 + 4, shade(skin, 0.9)); // naso
  if (eyes === 'shout') P.p(x0 + 5, y0 + 5, 0x6a1a1a);
}

const SHOE = 0x232027;
const SHOE_HI = 0x5a5560;

function legs(P: Painter, kit: Kit, skin: number, xl: number, yl: number, xr: number, yr: number, backDark = false) {
  // gamba = 2 px di larghezza: coscia (pelle), calzettone, scarpa
  const draw = (x: number, y: number, dark: boolean) => {
    const f = dark ? 0.78 : 1;
    P.r(x, y, 2, 1, shade(skin, f * 0.95));
    P.r(x, y + 1, 2, 2, shade(kit.socks, f));
    P.p(x + 1, y + 1, shade(kit.socks, f * 0.82));
    P.r(x, y + 3, 2, 1, SHOE);
    P.p(x, y + 3, SHOE_HI);
  };
  draw(xl, yl, backDark);
  draw(xr, yr, false);
}

function drawUpright(P: Painter, dir: Dir, pose: Pose, kit: Kit, look: PlayerDef['look'], number: number) {
  const skin = SKIN[look.skin % SKIN.length];
  const hair = HAIR[look.hair % HAIR.length];
  const glove = kit.gk ? 0xf4f4f4 : skin;
  const run = pose.startsWith('run') ? Number(pose[3]) : -1;
  const bob = run === 1 || run === 3 ? 1 : 0;
  const sad = pose === 'sad';
  const cel = pose === 'celebrate';
  const y0 = 2 + bob + (sad ? 1 : 0);

  if (dir === 'side') {
    // corpo di profilo: busto 6 px
    const tx = 9;
    // braccio dietro
    const swing = run === 0 ? -2 : run === 2 ? 2 : 0;
    if (pose === 'kick') {
      P.r(tx - 2, y0 + 8, 2, 2, shade(kit.shirt, 0.7));
      P.r(tx - 3, y0 + 9, 1, 2, shade(skin, 0.8));
    }
    // gambe
    const ly = 15 + bob + (sad ? 1 : 0);
    if (pose === 'kick') {
      legs(P, kit, skin, 10, ly, 10, ly, true);
      // gamba che calcia, in avanti
      P.r(12, ly, 3, 2, shade(skin, 0.95));
      P.r(15, ly, 3, 2, kit.socks);
      P.r(18, ly, 2, 2, SHOE);
      P.p(18, ly, SHOE_HI);
    } else if (run === 0 || run === 2) {
      const front = run === 0 ? 13 : 7;
      const back = run === 0 ? 7 : 13;
      legs(P, kit, skin, back, ly, front, ly - 1, true);
    } else {
      legs(P, kit, skin, 10, ly, 11, ly - (run === 1 ? 1 : 0), true);
    }
    // pantaloncini
    P.r(tx, y0 + 12, 6, 2, kit.shorts);
    P.r(tx + 5, y0 + 12, 1, 2, shade(kit.shorts, 0.75));
    drawTorso(P, kit, tx, y0 + 7, 6, 6);
    // braccio davanti
    if (pose !== 'kick') {
      const ax = tx + 2 + swing;
      P.r(ax, y0 + 7, 2, 2, shade(kit.shirt, 0.92));
      P.r(ax, y0 + 9, 2, 2, skin);
      if (kit.gk) P.r(ax, y0 + 10, 2, 1, glove);
    } else {
      P.r(tx + 5, y0 + 7, 2, 2, kit.shirt);
      P.r(tx + 7, y0 + 7, 2, 1, skin);
    }
    drawHead(P, 'side', tx, y0, skin, hair, look.hairStyle, 'open');
    return;
  }

  // fronte o schiena
  const tx = 8;
  const ty = y0 + 7;
  // gambe
  const ly = 15 + bob + (sad ? 1 : 0);
  let ll = ly;
  let lr = ly;
  if (run === 0) ll = ly - 1;
  if (run === 2) lr = ly - 1;
  if (pose === 'kick') lr = ly + 1;
  legs(P, kit, skin, 9, ll, 13, lr);
  // pantaloncini
  P.r(tx, ty + 6, 8, 2, kit.shorts);
  P.r(tx + 7, ty + 6, 1, 2, shade(kit.shorts, 0.75));
  P.p(tx + 3, ty + 7, shade(kit.shorts, 0.7));
  P.p(tx + 4, ty + 7, shade(kit.shorts, 0.7));
  drawTorso(P, kit, tx, ty, 8, 6);
  if (dir === 'down' && !kit.gk) {
    // colletto
    P.r(tx + 3, ty, 2, 1, kit.shirt2 === kit.shirt ? shade(kit.shirt, 0.7) : kit.shirt2);
  }
  if (dir === 'up') {
    // numero sulla schiena
    const d = DIGITS[number % 10];
    const nc = lum(kit.shirt) > 150 ? 0x202020 : 0xf6f6f6;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (d[j][i] === '1') P.p(tx + 3 + i, ty + 1 + j, nc);
  }
  // braccia
  const sl = shade(kit.shirt, 0.9);
  if (cel) {
    P.r(tx - 2, ty - 5, 2, 3, skin);
    P.r(tx + 8, ty - 5, 2, 3, skin);
    P.r(tx - 2, ty - 2, 2, 3, sl);
    P.r(tx + 8, ty - 2, 2, 3, sl);
    if (kit.gk) P.r(tx - 2, ty - 5, 2, 1, glove), P.r(tx + 8, ty - 5, 2, 1, glove);
  } else {
    const al = run === 0 ? 1 : run === 2 ? -1 : 0;
    const ar = -al;
    const drop = sad ? 1 : 0;
    P.r(tx - 2, ty + al + drop, 2, 2, sl);
    P.r(tx - 2, ty + 2 + al + drop, 2, 2, skin);
    P.r(tx + 8, ty + ar + drop, 2, 2, shade(sl, 0.85));
    P.r(tx + 8, ty + 2 + ar + drop, 2, 2, shade(skin, 0.85));
    if (kit.gk) {
      P.r(tx - 2, ty + 3 + al + drop, 2, 1, glove);
      P.r(tx + 8, ty + 3 + ar + drop, 2, 1, glove);
    }
  }
  drawHead(P, dir, tx + 1, y0, skin, hair, look.hairStyle, sad ? 'closed' : cel ? 'shout' : 'open');
}

function drawSlide(P: Painter, kit: Kit, look: PlayerDef['look']) {
  const skin = SKIN[look.skin % SKIN.length];
  const hair = HAIR[look.hair % HAIR.length];
  // braccio a terra dietro
  P.r(3, 17, 3, 2, skin);
  // busto inclinato all'indietro
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) P.p(6 + i, 11 + j + Math.floor(i / 2), shirtColor(kit, 6 + i, 11 + j, 6, 11, 6));
  }
  P.r(11, 16, 3, 3, kit.shorts);
  // gambe in avanti
  P.r(14, 17, 3, 2, skin);
  P.r(17, 17, 3, 2, kit.socks);
  P.r(20, 17, 2, 2, SHOE);
  P.r(13, 19, 3, 2, shade(skin, 0.8));
  P.r(16, 19, 3, 2, shade(kit.socks, 0.8));
  P.r(19, 19, 2, 2, SHOE);
  drawHead(P, 'side', 4, 6, skin, hair, look.hairStyle, 'shout');
}

function drawDive(P: Painter, kit: Kit, look: PlayerDef['look']) {
  // corpo orizzontale, testa a destra, braccia tese oltre la testa
  const skin = SKIN[look.skin % SKIN.length];
  const hair = HAIR[look.hair % HAIR.length];
  const glove = 0xf4f4f4;
  // gambe a sinistra
  P.r(1, 10, 2, 2, SHOE);
  P.r(3, 10, 3, 2, kit.socks);
  P.r(1, 13, 2, 2, SHOE);
  P.r(3, 13, 3, 2, shade(kit.socks, 0.8));
  P.r(6, 10, 2, 5, skin);
  P.r(8, 10, 2, 5, kit.shorts);
  for (let x = 10; x < 16; x++) for (let y = 9; y < 16; y++) P.p(x, y, shirtColor(kit, x, y, 10, 9, 6));
  // testa
  for (let x = 0; x < 5; x++) for (let y = 0; y < 6; y++) P.p(16 + x, 10 + y, y < 2 ? hair : skin);
  P.p(19, 13, OUTLINE);
  // braccia
  P.r(16, 8, 5, 1, kit.shirt);
  P.r(21, 8, 2, 2, glove);
  P.r(16, 16, 5, 1, kit.shirt);
  P.r(21, 15, 2, 2, glove);
}

/** Crea lo sprite sheet di un giocatore (3 direzioni x 10 pose). */
export function makePlayerSheet(scene: Phaser.Scene, key: string, team: TeamDef, pd: PlayerDef) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const cols = POSES.length;
  const px = new Px(FRAME * cols, FRAME * DIRS.length);
  const kit: Kit = {
    shirt: pd.role === 'GK' ? team.colors.gk : team.colors.shirt,
    shirt2: pd.role === 'GK' ? shade(team.colors.gk, 0.7) : team.colors.shirt2,
    shorts: pd.role === 'GK' ? shade(team.colors.gk, 0.55) : team.colors.shorts,
    socks: pd.role === 'GK' ? team.colors.gk : team.colors.socks,
    pattern: team.pattern,
    gk: pd.role === 'GK',
  };
  DIRS.forEach((dir, di) => {
    POSES.forEach((pose, pi) => {
      const ox = pi * FRAME;
      const oy = di * FRAME;
      const P = new Painter(px, ox, oy);
      if (pose === 'slide') drawSlide(P, kit, pd.look);
      else if (pose === 'dive') drawDive(P, kit, pd.look);
      else drawUpright(P, dir, pose, kit, pd.look, pd.number);
      px.outline(ox, oy, FRAME, FRAME, OUTLINE);
    });
  });
  const tex = scene.textures.addCanvas(key, px.toCanvas())!;
  let i = 0;
  for (let r = 0; r < DIRS.length; r++) for (let c = 0; c < cols; c++) tex.add(i++, 0, c * FRAME, r * FRAME, FRAME, FRAME);
}

/** Palla 8x8 con 4 fotogrammi di rotolamento. */
export function makeBall(scene: Phaser.Scene) {
  const px = new Px(8 * 4, 8);
  const patches: [number, number][][] = [
    [[3, 3], [4, 3], [3, 4], [1, 1], [5, 5], [1, 5]],
    [[2, 3], [3, 3], [2, 4], [5, 2], [4, 6], [6, 4]],
    [[3, 2], [4, 2], [4, 3], [1, 4], [6, 5], [2, 6]],
    [[4, 4], [5, 4], [4, 5], [2, 1], [1, 3], [5, 1]],
  ];
  for (let f = 0; f < 4; f++) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const dx = x - 3.5;
        const dy = y - 3.5;
        if (dx * dx + dy * dy <= 9.5) {
          let c = 0xfafafa;
          if (dx + dy > 2.5) c = 0xc9cfd8;
          else if (dx + dy < -3) c = 0xffffff;
          px.set(f * 8 + x, y, c);
        }
      }
    }
    for (const [x, y] of patches[f]) {
      const dx = x - 3.5;
      const dy = y - 3.5;
      if (dx * dx + dy * dy <= 7) px.set(f * 8 + x, y, 0x2a2a35);
    }
    px.outline(f * 8, 0, 8, 8, OUTLINE);
  }
  const tex = scene.textures.addCanvas('ball', px.toCanvas())!;
  for (let f = 0; f < 4; f++) tex.add(f, 0, f * 8, 0, 8, 8);
}

function ellipseTex(scene: Phaser.Scene, key: string, w: number, h: number, color: string, ring = false) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2);
      const dy = (y + 0.5 - h / 2) / (h / 2);
      const d = dx * dx + dy * dy;
      const inside = d <= 1;
      const on = ring ? inside && d > 0.5 : inside;
      if (on) {
        const i = (y * w + x) * 4;
        img.data[i] = parseInt(color.slice(1, 3), 16);
        img.data[i + 1] = parseInt(color.slice(3, 5), 16);
        img.data[i + 2] = parseInt(color.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, cv);
}

function iconTex(scene: Phaser.Scene, key: string, rows: string[], pal: Record<string, number>) {
  const h = rows.length;
  const w = rows[0].length;
  const px = new Px(w + 2, h + 2);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && px.set(x + 1, y + 1, pal[ch])));
  px.outline(0, 0, w + 2, h + 2, OUTLINE);
  scene.textures.addCanvas(key, px.toCanvas());
}

/** Texture generiche: ombre, indicatori, particelle, icone dei power-up. */
export function makeCommonTextures(scene: Phaser.Scene) {
  ellipseTex(scene, 'shadow', 14, 5, '#000000');
  ellipseTex(scene, 'ballShadow', 7, 3, '#000000');
  ellipseTex(scene, 'ring', 18, 7, '#ffffff', true);
  ellipseTex(scene, 'dot', 4, 4, '#ffffff');
  ellipseTex(scene, 'soft', 16, 16, '#ffffff');
  // alone morbido per luci e power-up
  const gc = document.createElement('canvas');
  gc.width = gc.height = 64;
  const gctx = gc.getContext('2d')!;
  const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 64, 64);
  scene.textures.addCanvas('glow', gc);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
  g.generateTexture('px2', 2, 2);
  g.clear().fillStyle(0xffffff).fillRect(0, 0, 3, 2);
  g.generateTexture('confetti', 3, 2);
  g.destroy();
  // freccia sopra il giocatore controllato
  iconTex(scene, 'marker', ['wwwwwww', '.wwwww.', '..www..', '...w...'], { w: 0xffffff });
  iconTex(
    scene,
    'pu_fuoco',
    ['....r.....', '...rr..r..', '...ryr.rr.', '..ryyrrr..', '.ryyyyyr..', '.ryywyyyr.', 'ryywwwyyr.', 'ryywwwyyr.', '.ryywyyr..', '..rrrrr...'],
    { r: 0xe8381e, y: 0xffb21e, w: 0xfff3a0 },
  );
  iconTex(
    scene,
    'pu_turbo',
    ['.....yyy..', '....yyy...', '...yyy....', '..yyyyyy..', '.yyyyyyy..', '.....yy...', '....yy....', '...yy.....', '..yy......', '.y........'],
    { y: 0xffe03a },
  );
  iconTex(
    scene,
    'pu_muro',
    ['bbbbbbbbbb', 'bbbbmbbbbm', 'mmmmmmmmmm', 'bbmbbbbmbb', 'bbmbbbbmbb', 'mmmmmmmmmm', 'bbbbmbbbbm', 'bbbbmbbbbm', 'mmmmmmmmmm', 'bbmbbbbmbb'],
    { b: 0xc4552e, m: 0xe9d8b5 },
  );
  iconTex(
    scene,
    'pu_ghiaccio',
    ['....cc....', '.c..cc..c.', '..ccwwcc..', '.ccwwwwcc.', 'ccwwccwwcc', 'ccwwccwwcc', '.ccwwwwcc.', '..ccwwcc..', '.c..cc..c.', '....cc....'],
    { c: 0x3fd0ff, w: 0xe6fbff },
  );
  iconTex(
    scene,
    'pu_calamita',
    ['..rr..bb..', '.rrrrbbbb.', '.rr....bb.', '.rr....bb.', '.rr....bb.', '.rr....bb.', '.ss....ss.', '.ss....ss.', '..s....s..', '..........'],
    { r: 0xe8443a, b: 0x2f8be0, s: 0xd8dce8 },
  );
  iconTex(
    scene,
    'pu_gigante',
    ['...oooo...', '.ooyyyyoo.', 'ooywwwwyoo', 'oywwyywwyo', 'oywybbywyo', 'oywybbywyo', 'oywwyywwyo', 'ooywwwwyoo', '.ooyyyyoo.', '...oooo...'],
    { o: 0xff7a1a, y: 0xffd23f, w: 0xfff5d6, b: 0x2a2a35 },
  );
}

export function teamTint(c: number): number {
  return mix(c, 0xffffff, 0.15);
}
