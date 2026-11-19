import Phaser from 'phaser';
import { shadowTxt, txt } from '../ui/ui';
import { portrait, type Expr } from '../gfx/animeArt';
import { frameIndex } from '../gfx/sprites';
import { hex } from '../gfx/px';
import type { Face } from '../modes/leggenda';
import { sfx } from '../audio/sfx';

/**
 * Scene a tutto schermo della Leggenda del Pallone: duelli, tiri speciali col nome
 * urlato, pallone che si deforma, portiere che vola, rete che si strappa.
 */

export interface Who {
  id: string;
  name: string;
  face: Face;
  shirt: number;
  /** Chiave dello sprite sheet in campo (per tuffi e corse). */
  sheet: string;
  side: 0 | 1;
}

const DEPTH = 4000;

/** Velocità delle scene (toccare lo schermo le accelera). */
export const fxSpeed = { v: 1 };

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((r) => scene.time.delayedCall(ms / fxSpeed.v, () => r()));
}

function layer(scene: Phaser.Scene) {
  const c = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH);
  const W = scene.scale.width;
  const H = scene.scale.height;
  const z = scene.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
  z.on('pointerdown', () => (fxSpeed.v = 2.5));
  c.add(z);
  return c;
}

/** Linee di velocità radiali che girano. */
function speedLines(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, y: number, color: number, n = 28) {
  const g = scene.add.graphics({ x, y });
  const R = Math.max(scene.scale.width, scene.scale.height);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.05;
    const w = 0.025 + (i % 3) * 0.012;
    const r0 = 40 + (i % 4) * 18;
    g.fillStyle(i % 3 === 0 ? 0xffffff : color, i % 3 === 0 ? 0.55 : 0.35);
    g.fillTriangle(Math.cos(a - w) * R, Math.sin(a - w) * R, Math.cos(a + w) * R, Math.sin(a + w) * R, Math.cos(a) * r0, Math.sin(a) * r0);
  }
  c.add(g);
  scene.tweens.add({ targets: g, angle: 25, duration: 1600, repeat: -1 });
  return g;
}

/** Linee orizzontali che scorrono (corsa, tiro). */
function streaks(scene: Phaser.Scene, c: Phaser.GameObjects.Container, color: number, dir = -1) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  for (let i = 0; i < 18; i++) {
    const y = Phaser.Math.Between(20, H - 20);
    const len = Phaser.Math.Between(40, 160);
    const r = scene.add.rectangle(dir < 0 ? W + len : -len, y, len, i % 3 === 0 ? 2 : 1, i % 2 ? 0xffffff : color, 0.6);
    c.add(r);
    scene.tweens.add({ targets: r, x: dir < 0 ? -len : W + len, duration: Phaser.Math.Between(220, 420) / fxSpeed.v, delay: Phaser.Math.Between(0, 400), repeat: -1 });
  }
}

function bigName(scene: Phaser.Scene, c: Phaser.GameObjects.Container, text: string, y: number, color: number) {
  const W = scene.scale.width;
  const size = text.length > 18 ? 14 : 18;
  const t = shadowTxt(scene, W / 2, y, text, size, hex(color), '#1a1222', 3);
  // contorno spesso: copie spostate
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
    const o = txt(scene, dx, dy, text, size, '#1a1222');
    t.c.addAt(o, 0);
  }
  c.add(t.c);
  t.c.setScale(2.4).setAlpha(0);
  scene.tweens.add({ targets: t.c, scale: 1, alpha: 1, duration: 260 / fxSpeed.v, ease: 'Back.easeOut' });
  scene.time.delayedCall(260 / fxSpeed.v, () => scene.cameras.main.shake(180, 0.006));
  return t.c;
}

function face(scene: Phaser.Scene, w: Who, expr: Expr) {
  return portrait(scene, w.id, w.face, w.shirt, { expr });
}

// ---------- duelli ----------

export interface DuelFxOpts {
  /** 'blocco': `a` si butta davanti al tiro di `d`. */
  kind: 'dribbling' | 'passaggio' | 'blocco';
  attTech?: { name: string; color: number };
  defTech?: { name: string; color: number };
  defKind: 'contrasto' | 'intercetto' | 'blocco';
  win: boolean;
}

const DEF_LABEL = { contrasto: 'CONTRASTO', intercetto: 'INTERCETTO', blocco: 'BLOCCO' };

export async function duelFx(scene: Phaser.Scene, a: Who, d: Who, o: DuelFxOpts) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const c = layer(scene);
  const special = !!(o.attTech || o.defTech);
  const g = scene.add.graphics();
  c.add(g);
  // due pannelli diagonali che entrano dai lati
  const colA = a.side === 0 ? 0x2a3a8a : 0x8a2a3a;
  const colD = d.side === 0 ? 0x2a3a8a : 0x8a2a3a;
  const top = H / 2 - 74;
  const bot = H / 2 + 74;
  g.fillStyle(0x000000, 0.55).fillRect(0, top - 6, W, bot - top + 12);
  const pa = scene.add.graphics();
  pa.fillStyle(colA).fillPoints([new Phaser.Geom.Point(0, top), new Phaser.Geom.Point(W / 2 + 40, top), new Phaser.Geom.Point(W / 2 - 40, bot), new Phaser.Geom.Point(0, bot)], true);
  const pd = scene.add.graphics();
  pd.fillStyle(colD).fillPoints([new Phaser.Geom.Point(W / 2 + 44, top), new Phaser.Geom.Point(W, top), new Phaser.Geom.Point(W, bot), new Phaser.Geom.Point(W / 2 - 36, bot)], true);
  c.add([pa, pd]);
  pa.x = -W / 2;
  pd.x = W / 2;
  scene.tweens.add({ targets: pa, x: 0, duration: 160 / fxSpeed.v, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: pd, x: 0, duration: 160 / fxSpeed.v, ease: 'Quad.easeOut' });
  const ia = scene.add.image(-80, bot, face(scene, a, o.attTech ? 'urlo' : 'grinta')).setScale(3).setOrigin(0.5, 1);
  const id = scene.add.image(W + 80, bot, face(scene, d, o.defTech ? 'urlo' : 'grinta')).setScale(3).setOrigin(0.5, 1).setFlipX(true);
  c.add([ia, id]);
  scene.tweens.add({ targets: ia, x: W * 0.2, duration: 200 / fxSpeed.v, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: id, x: W * 0.8, duration: 200 / fxSpeed.v, ease: 'Quad.easeOut' });
  const aLabel = o.kind === 'dribbling' ? 'DRIBBLING' : o.kind === 'passaggio' ? 'PASSAGGIO' : 'BLOCCO';
  const la = txt(scene, W * 0.06, top + 12, `${a.name.toUpperCase()}  ${aLabel}`, 7, '#ffffff').setOrigin(0, 0.5);
  const ld = txt(scene, W * 0.94, bot - 12, `${o.kind === 'blocco' ? 'TIRO' : DEF_LABEL[o.defKind]}  ${d.name.toUpperCase()}`, 7, '#ffffff').setOrigin(1, 0.5);
  c.add([la, ld]);
  const vs = shadowTxt(scene, W / 2, H / 2, 'VS', 16, '#ffd23f', '#a0381e', 2);
  c.add(vs.c);
  sfx.whistle(1);
  await wait(scene, 320);
  if (o.attTech) {
    speedLines(scene, c, W * 0.2, H / 2, o.attTech.color);
    c.bringToTop(ia);
    bigName(scene, c, o.attTech.name, top - 18, o.attTech.color);
    sfx.superShot();
    await wait(scene, 750);
  }
  if (o.defTech) {
    speedLines(scene, c, W * 0.8, H / 2, o.defTech.color);
    c.bringToTop(id);
    bigName(scene, c, o.defTech.name, bot + 18, o.defTech.color);
    sfx.superShot();
    await wait(scene, 750);
  }
  // scontro
  const flash = scene.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setAlpha(0);
  c.add(flash);
  scene.tweens.add({ targets: flash, alpha: { from: 0.9, to: 0 }, duration: 220 / fxSpeed.v });
  if (o.kind === 'dribbling') sfx.trick();
  else sfx.pass();
  if (!o.win) sfx.tackle();
  const RES = {
    dribbling: ['SUPERATO!', 'PALLA RUBATA!'],
    passaggio: ['PASSAGGIO RIUSCITO!', 'INTERCETTATO!'],
    blocco: ['RESPINTO!', 'LO TRAVOLGE!'],
  };
  const res = RES[o.kind][o.win ? 0 : 1];
  const winner = o.win ? ia : id;
  const loser = o.win ? id : ia;
  scene.tweens.add({ targets: loser, alpha: 0.35, y: loser.y + 10, duration: 200 / fxSpeed.v });
  scene.tweens.add({ targets: winner, scale: 3.3, duration: 120 / fxSpeed.v, yoyo: true });
  const rt = shadowTxt(scene, W / 2, H / 2, res, 14, o.win === (a.side === 0) ? '#5be37d' : '#ff5a5a', '#1a1222', 2);
  c.add(rt.c);
  vs.c.destroy();
  rt.c.setScale(0.4);
  scene.tweens.add({ targets: rt.c, scale: 1, duration: 200 / fxSpeed.v, ease: 'Back.easeOut' });
  await wait(scene, special ? 700 : 520);
  scene.tweens.add({ targets: c, alpha: 0, duration: 140 / fxSpeed.v });
  await wait(scene, 150);
  c.destroy();
}

// ---------- tiri ----------

/** Il tiratore urla il nome della tecnica e il pallone si deforma. */
export async function shotFx(scene: Phaser.Scene, s: Who, tech: { name: string; color: number }, partner?: Who) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const c = layer(scene);
  const bg = scene.add.rectangle(0, 0, W, H, 0x0a0614).setOrigin(0);
  c.add(bg);
  const flash = scene.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0);
  c.add(flash);
  scene.tweens.add({ targets: flash, alpha: 0, duration: 260 / fxSpeed.v });
  speedLines(scene, c, W * 0.3, H * 0.55, tech.color, 34);
  sfx.superShot();
  if (tech.name.includes('TUONO') || tech.name.includes('TEMPESTA')) sfx.thunder();
  // ritratti (in coppia per le combo)
  const p1 = scene.add.image(-60, H, face(scene, s, 'urlo')).setScale(4).setOrigin(0.5, 1);
  c.add(p1);
  scene.tweens.add({ targets: p1, x: partner ? W * 0.18 : W * 0.24, duration: 220 / fxSpeed.v, ease: 'Quad.easeOut' });
  if (partner) {
    const p2 = scene.add.image(W + 60, H, face(scene, partner, 'urlo')).setScale(4).setOrigin(0.5, 1).setFlipX(true);
    c.add(p2);
    scene.tweens.add({ targets: p2, x: W * 0.82, duration: 220 / fxSpeed.v, ease: 'Quad.easeOut' });
  }
  await wait(scene, 240);
  bigName(scene, c, tech.name, 40, tech.color);
  const sub = txt(scene, W / 2, 66, partner ? `${s.name.toUpperCase()} + ${partner.name.toUpperCase()}` : s.name.toUpperCase(), 7, '#ffffff');
  c.add(sub);
  await wait(scene, 700);
  // primo piano del pallone che si deforma
  streaks(scene, c, tech.color, -1);
  const glow = scene.add.image(W / 2, H * 0.58, 'glow').setScale(5).setTint(tech.color).setAlpha(0.9);
  const ball = scene.add.image(W / 2, H * 0.58, 'ball', 0).setScale(10);
  c.add([glow, ball]);
  scene.tweens.add({ targets: glow, scale: 6.5, alpha: 0.6, duration: 120, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: ball, scaleX: { from: 14, to: 8 }, scaleY: { from: 7, to: 12 }, duration: 90, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: ball, angle: 360, duration: 300, repeat: -1 });
  sfx.kick(1);
  scene.cameras.main.shake(400, 0.008);
  // scie di fuoco
  const em = scene.add.particles(0, 0, 'px2', {
    x: W / 2,
    y: H * 0.58,
    speedX: { min: -600, max: -250 },
    speedY: { min: -60, max: 60 },
    lifespan: 400,
    scale: { start: 3, end: 0 },
    tint: [tech.color, 0xffffff],
    frequency: 12,
  });
  c.add(em);
  await wait(scene, 900);
  scene.tweens.add({ targets: [ball, glow], x: W + 120, scale: 3, duration: 220 / fxSpeed.v, ease: 'Quad.easeIn' });
  await wait(scene, 240);
  em.stop();
  c.destroy();
}

/** Il portiere vola; poi gol (rete strappata), parata o respinta. */
export async function keeperFx(
  scene: Phaser.Scene,
  k: Who,
  result: 'goal' | 'presa' | 'pugno',
  o: { tech?: { name: string; color: number }; shotColor?: number; special: boolean; scorer: Who },
) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const c = layer(scene);
  const sky = scene.add.rectangle(0, 0, W, H, 0x101830).setOrigin(0);
  c.add(sky);
  // porta vista da davanti
  const gx = W / 2;
  const gy = H * 0.55;
  const gw = Math.min(W * 0.7, 420);
  const gh = 150;
  const net = scene.add.graphics();
  c.add(net);
  const drawNet = (bulge: number, hole: number) => {
    net.clear();
    net.fillStyle(0x0a0e1c).fillRect(gx - gw / 2, gy - gh / 2, gw, gh);
    net.lineStyle(1, 0xd8dce8, 0.55);
    const step = 12;
    for (let x = gx - gw / 2; x <= gx + gw / 2; x += step) {
      for (let y = gy - gh / 2; y < gy + gh / 2; y += step) {
        const d = Phaser.Math.Distance.Between(x, y, gx, gy);
        if (d < hole) continue;
        const push = bulge * Math.max(0, 1 - d / 150);
        const dx = ((x - gx) / Math.max(1, d)) * push;
        const dy = ((y - gy) / Math.max(1, d)) * push;
        net.lineBetween(x + dx, y + dy, x + dx, y + dy + step);
        net.lineBetween(x + dx, y + dy, x + dx + step, y + dy);
      }
    }
    if (hole > 0) {
      // bordo strappato
      net.fillStyle(0x000000);
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = hole * (i % 2 ? 0.7 : 1.05);
        pts.push(new Phaser.Geom.Point(gx + Math.cos(a) * r, gy + Math.sin(a) * r * 0.8));
      }
      net.fillPoints(pts, true);
    }
    // pali e traversa
    net.fillStyle(0xffffff).fillRect(gx - gw / 2 - 6, gy - gh / 2 - 6, gw + 12, 6);
    net.fillRect(gx - gw / 2 - 6, gy - gh / 2, 6, gh + 6);
    net.fillRect(gx + gw / 2, gy - gh / 2, 6, gh + 6);
    net.fillStyle(0x3fa046).fillRect(0, gy + gh / 2 + 6, W, H);
  };
  drawNet(0, 0);
  if (o.special) speedLines(scene, c, gx, gy, o.shotColor ?? 0xffffff, 22).setAlpha(0.6);
  // portiere (sprite del tuffo, ingrandito)
  const dir = Math.random() < 0.5 ? -1 : 1;
  const kp = scene.add.sprite(gx - dir * gw * 0.45, gy + 30, k.sheet, frameIndex('side', 'dive')).setScale(6).setFlipX(dir < 0);
  c.add(kp);
  if (o.tech) {
    const pt = scene.add.image(dir > 0 ? W - 70 : 70, H, face(scene, k, 'urlo')).setScale(2.5).setOrigin(0.5, 1).setFlipX(dir > 0);
    c.add(pt);
    bigName(scene, c, o.tech.name, 34, o.tech.color);
    sfx.superShot();
    await wait(scene, 650);
  }
  // pallone che arriva da lontano
  const ball = scene.add.image(gx + dir * 30, gy - 10, 'ball', 0).setScale(1);
  const glow = scene.add.image(ball.x, ball.y, 'glow').setScale(0.5).setTint(o.shotColor ?? 0xffffff).setAlpha(o.special ? 0.9 : 0.4);
  c.add([glow, ball]);
  const target = result === 'goal' ? { x: gx + dir * 20, y: gy - 6 } : { x: gx + dir * 60, y: gy - 20 };
  scene.tweens.add({ targets: [ball, glow], x: target.x, y: target.y, scale: o.special ? 9 : 6, duration: 420 / fxSpeed.v, ease: 'Quad.easeIn' });
  scene.tweens.add({ targets: ball, angle: 720, duration: 420 / fxSpeed.v });
  // il portiere vola
  const reach = result === 'goal' ? 0.55 : 1;
  scene.tweens.add({ targets: kp, x: gx - dir * gw * 0.45 + dir * gw * 0.5 * reach + (result === 'goal' ? 0 : dir * 10), y: gy - 30, duration: 420 / fxSpeed.v, ease: 'Quad.easeOut' });
  await wait(scene, 430);
  if (result === 'goal') {
    sfx.net();
    sfx.goal();
    scene.cameras.main.shake(500, 0.014);
    let hole = 0;
    let bulge = 0;
    const tw = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 500 / fxSpeed.v,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        bulge = 40 * Math.sin(v * Math.PI);
        hole = o.special ? v * 46 : 0;
        drawNet(bulge, hole);
      },
    });
    void tw;
    c.bringToTop(glow);
    c.bringToTop(ball);
    scene.tweens.add({ targets: [ball, glow], scale: o.special ? 1 : 3, alpha: o.special ? 0 : 1, duration: 500 / fxSpeed.v });
    if (o.special) {
      // pezzi di rete che volano via
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = scene.add.rectangle(gx, gy, Phaser.Math.Between(4, 10), 1, 0xd8dce8).setAngle(Phaser.Math.Between(0, 180));
        c.add(r);
        scene.tweens.add({ targets: r, x: gx + Math.cos(a) * 200, y: gy + Math.sin(a) * 140, angle: '+=360', alpha: 0, duration: 700 / fxSpeed.v });
      }
    }
    kp.setTint(0x8888aa);
    await wait(scene, 380);
    const tt = o.special ? 'RETE STRAPPATA!' : 'GOOOOL!';
    const gt = shadowTxt(scene, W / 2, H * 0.2, tt, 20, '#ffd23f', '#a0381e', 3);
    c.add(gt.c);
    gt.c.setScale(0.3);
    scene.tweens.add({ targets: gt.c, scale: 1, duration: 300 / fxSpeed.v, ease: 'Back.easeOut' });
    const sp = scene.add.image(dir > 0 ? 70 : W - 70, H, face(scene, o.scorer, 'urlo')).setScale(2.5).setOrigin(0.5, 1).setFlipX(dir < 0);
    c.add(sp);
    await wait(scene, 1100);
  } else {
    sfx.save();
    const fl = scene.add.image(target.x, target.y, 'glow').setScale(4).setTint(0xffffff);
    c.add(fl);
    scene.tweens.add({ targets: fl, scale: 7, alpha: 0, duration: 300 / fxSpeed.v });
    if (result === 'pugno') {
      scene.tweens.add({ targets: [ball, glow], x: target.x + dir * 300, y: target.y - 160, scale: 2, angle: 900, duration: 500 / fxSpeed.v });
    } else {
      scene.tweens.add({ targets: [ball, glow], x: kp.x + dir * 20, y: kp.y - 4, scale: 5, duration: 120 / fxSpeed.v });
      glow.setAlpha(0);
    }
    const tt = result === 'pugno' ? 'RESPINTA!' : 'PARATA!';
    const gt = shadowTxt(scene, W / 2, H * 0.2, tt, 20, '#3fd0ff', '#1a1222', 3);
    c.add(gt.c);
    gt.c.setScale(0.3);
    scene.tweens.add({ targets: gt.c, scale: 1, duration: 260 / fxSpeed.v, ease: 'Back.easeOut' });
    await wait(scene, 900);
  }
  scene.tweens.add({ targets: c, alpha: 0, duration: 160 / fxSpeed.v });
  await wait(scene, 170);
  c.destroy();
}

/** Scritta veloce al centro dello schermo. */
export async function pop(scene: Phaser.Scene, text: string, color = '#ffffff', ms = 700, size = 12) {
  const W = scene.scale.width;
  const t = shadowTxt(scene, W / 2, 96, text, size, color, '#1a1222', 2);
  t.c.setScrollFactor(0).setDepth(DEPTH - 1);
  t.c.setScale(0.4);
  scene.tweens.add({ targets: t.c, scale: 1, duration: 180, ease: 'Back.easeOut' });
  await wait(scene, ms);
  scene.tweens.add({ targets: t.c, alpha: 0, y: 86, duration: 200, onComplete: () => t.c.destroy() });
}
