import Phaser from 'phaser';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { save } from '../save/storage';
import { frameIndex, makePlayerSheet } from '../gfx/sprites';
import { teamById } from '../data/teams';
import { castFor, fillName, type CareerState } from '../modes/career';
import { proCast, standings, statusOf, type ProState } from '../modes/pro';
import { trustLabel } from '../modes/spogliatoio';
import { sfx } from '../audio/sfx';

/** Pezzi di interfaccia di "Diventa un mito": colloquio, giornale, classifica, bacheca. */

function overlay(scene: Phaser.Scene, w: number, h: number, border: number, fill = 0x1b1d2e) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const c = scene.add.container(0, 0).setDepth(100);
  const dim = scene.add.rectangle(0, 0, W, H, 0x05040a, 0.78).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  const x = Math.round(W / 2 - w / 2);
  const y = Math.round(H / 2 - h / 2) - 6;
  panel(g, x, y, w, h, fill, border, 0.98);
  c.add([dim, g]);
  return { c, g, x, y, W, H };
}

function closeBtn(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, y: number, label = 'CHIUDI', after?: () => void) {
  const b = button(scene, x, y, 110, 24, label, () => {
    c.destroy();
    after?.();
  }, { size: 6, color: 0x3a3d55 });
  c.add(b.c);
}

// ---------------------------------------------------------------- colloquio

/** Colloquio con l'allenatore dopo la partita: scegli come rispondere. */
export function talkOverlay(scene: Phaser.Scene, c: CareerState, done: () => void) {
  const t = c.talk!;
  const { c: box, g, x, y, W } = overlay(scene, Math.min(460, scene.scale.width - 24), 236, 0x3fd0ff);
  const w = Math.min(460, W - 24);
  const cast = c.pro ? proCast(c) : castFor(c, Math.min(c.step, 8));
  const who = cast[t.who];
  makePlayerSheet(scene, `talk_${t.who}`, who.team, who.def);
  const img = scene.add.image(x + 44, y + 100, `talk_${t.who}`, frameIndex('down', 'idle')).setScale(4).setOrigin(0.5, 1);
  box.add(img);
  scene.tweens.add({ targets: img, y: img.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  box.add(txt(scene, x + 14, y + 14, 'COLLOQUIO', 6, '#8a8fb0').setOrigin(0, 0.5));
  box.add(txt(scene, x + 44, y + 112, t.name.toUpperCase(), 6, '#3fd0ff'));
  // voto
  g.fillStyle(0x0d0a1a).fillRect(x + w - 64, y + 8, 54, 30);
  box.add(txt(scene, x + w - 37, y + 16, 'VOTO', 6, '#8a8fb0'));
  box.add(txt(scene, x + w - 37, y + 30, String(t.vote), 8, t.vote >= 7 ? '#5be37d' : t.vote < 6 ? '#ff9a9a' : '#ffffff'));
  const body = txt(scene, x + 92, y + 46, fillName(t.text, c.hero.name), 8, '#ffffff', { wordWrap: { width: w - 170 }, lineSpacing: 6 }).setOrigin(0, 0);
  box.add(body);

  const buttons: Phaser.GameObjects.Container[] = [];
  t.options.forEach((o, i) => {
    const b = button(scene, x + w / 2, y + 138 + i * 30, w - 40, 24, o.label, () => {
      save((s) => {
        const cc = s.career;
        if (!cc || !cc.talk) return;
        cc.trust = Math.max(0, Math.min(100, (cc.trust ?? 60) + o.trust));
        cc.points += o.points;
        cc.talk = undefined;
      });
      sfx.select();
      for (const bb of buttons) bb.destroy();
      body.setText(fillName(o.reply, c.hero.name));
      const fx: string[] = [];
      if (o.trust) fx.push(`fiducia ${o.trust > 0 ? '+' : ''}${o.trust}`);
      if (o.points) fx.push(`+${o.points} punt${o.points > 1 ? 'i' : 'o'} abilità`);
      box.add(txt(scene, x + w / 2, y + 150, fx.join('   ·   '), 6, o.trust < 0 ? '#ff9a9a' : '#5be37d'));
      closeBtn(scene, box, x + w / 2, y + 196, 'OK', done);
    }, { size: 6, color: i === 0 ? 0x2f6fd0 : i === 1 ? 0x8a3fd0 : 0x6a4a2a });
    buttons.push(b.c);
    box.add(b.c);
  });
}

// ---------------------------------------------------------------- giornale

/** Prima pagina della Gazzetta Pixel con i titoli delle ultime partite. */
export function newsOverlay(scene: Phaser.Scene, c: CareerState) {
  const news = c.news ?? [];
  const w = Math.min(420, scene.scale.width - 24);
  const { c: box, g, x, y } = overlay(scene, w, 280, 0xb8ac90, 0xf2ead8);
  // testata
  g.fillStyle(0x1a1222).fillRect(x + 10, y + 10, w - 20, 30);
  box.add(txt(scene, x + w / 2, y + 26, 'GAZZETTA PIXEL', 16, '#f2ead8'));
  g.fillStyle(0x1a1222).fillRect(x + 10, y + 46, w - 20, 2);
  box.add(txt(scene, x + 14, y + 54, `EDIZIONE N. ${c.apps}`, 6, '#5a4a3a').setOrigin(0, 0.5));
  box.add(txt(scene, x + w - 14, y + 54, 'CALCIO · CARRIERE · LEGGENDE', 6, '#5a4a3a').setOrigin(1, 0.5));
  g.fillStyle(0x1a1222).fillRect(x + 10, y + 61, w - 20, 1);
  if (!news.length) {
    box.add(txt(scene, x + w / 2, y + 130, 'Nessuna notizia... per ora.\nGioca una partita e finirai in prima pagina.', 8, '#3a2a1a', { align: 'center', lineSpacing: 6 }));
  } else {
    const [top, ...rest] = news;
    box.add(txt(scene, x + w / 2, y + 86, top.title, top.title.length > 26 ? 8 : 16, '#1a1222', { wordWrap: { width: w - 30 }, align: 'center' }));
    box.add(txt(scene, x + w / 2, y + 112, top.sub, 6, '#5a4a3a'));
    // "foto" pixel del campione
    const p = c.pro ? proCast(c).hero : castFor(c, Math.min(c.step, 8)).hero;
    makePlayerSheet(scene, 'news_hero', p.team, p.def);
    g.fillStyle(0xd8ccb0).fillRect(x + 14, y + 124, 64, 70);
    box.add(scene.add.image(x + 46, y + 190, 'news_hero', frameIndex('down', top.vote >= 7 ? 'celebrate' : 'idle')).setScale(3).setOrigin(0.5, 1).setTint(top.vote >= 6 ? 0xffffff : 0xb0a090));
    rest.slice(0, 4).forEach((n, i) => {
      const yy = y + 132 + i * 18;
      g.fillStyle(0x1a1222, 0.2).fillRect(x + 88, yy + 8, w - 102, 1);
      box.add(txt(scene, x + 90, yy, n.title, 6, '#1a1222').setOrigin(0, 0.5));
    });
  }
  closeBtn(scene, box, x + w / 2, y + 256);
}

// ---------------------------------------------------------------- classifica

export function tableOverlay(scene: Phaser.Scene, p: ProState) {
  const w = Math.min(380, scene.scale.width - 24);
  const { c: box, g, x, y } = overlay(scene, w, 276, COLORS.accent);
  box.add(shadowTxt(scene, x + w / 2, y + 18, `SERIE A PIXEL · STAGIONE ${p.season}`, 8, '#ffd23f').c);
  const cols = [x + 20, x + 46, x + w - 150, x + w - 110, x + w - 70, x + w - 30];
  ['#', 'SQUADRA', 'G', 'V', 'DR', 'PT'].forEach((h, i) => box.add(txt(scene, cols[i], y + 40, h, 6, '#8a8fb0').setOrigin(i === 1 ? 0 : 0.5, 0.5)));
  standings(p).forEach((s, i) => {
    const yy = y + 60 + i * 22;
    const me = s.id === p.club;
    const t = teamById(s.id);
    if (me) g.fillStyle(COLORS.accent, 0.25).fillRect(x + 10, yy - 9, w - 20, 18);
    g.fillStyle(t.colors.shirt).fillRect(x + 32, yy - 4, 8, 8);
    const col = me ? '#ffd23f' : '#ffffff';
    const name = t.name + (s.id === p.rocco && !me ? ' (Rocco)' : '');
    [String(i + 1), name, String(s.row.p), String(s.row.w), String(s.row.gf - s.row.ga), String(s.row.pts)].forEach((v, k) =>
      box.add(txt(scene, cols[k], yy, v, 6, col).setOrigin(k === 1 ? 0 : 0.5, 0.5)),
    );
  });
  closeBtn(scene, box, x + w / 2, y + 252);
}

// ---------------------------------------------------------------- bacheca

function cup(g: Phaser.GameObjects.Graphics, x: number, y: number, col: number) {
  g.fillStyle(0x1a1222).fillRect(x - 9, y - 15, 18, 25);
  g.fillStyle(col).fillRect(x - 7, y - 13, 14, 9);
  g.fillRect(x - 10, y - 12, 3, 5).fillRect(x + 7, y - 12, 3, 5);
  g.fillRect(x - 2, y - 4, 4, 6);
  g.fillRect(x - 6, y + 2, 12, 4);
  g.fillStyle(0xffffff, 0.5).fillRect(x - 5, y - 12, 2, 6);
}

function ball(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0x1a1222).fillRect(x - 8, y - 12, 16, 18);
  g.fillStyle(0xffd23f).fillRect(x - 6, y - 10, 12, 14);
  g.fillStyle(0xa07a10).fillRect(x - 2, y - 6, 4, 4);
}

export function cabinetOverlay(scene: Phaser.Scene, c: CareerState) {
  const p = c.pro!;
  const w = Math.min(460, scene.scale.width - 24);
  const { c: box, g, x, y } = overlay(scene, w, 286, 0xff7ab8);
  box.add(shadowTxt(scene, x + w / 2, y + 18, 'BACHECA', 16, '#ffd23f').c);
  const items: [string, number, (gx: number, gy: number) => void][] = [
    ['SCUDETTI', p.cabinet.scudetti, (gx, gy) => cup(g, gx, gy, 0xe8e8f0)],
    ['CAPOCANNONIERE', p.cabinet.cannoniere, (gx, gy) => cup(g, gx, gy, 0x3fd0ff)],
    ['PALLONI D\'ORO', p.cabinet.pallone, (gx, gy) => ball(g, gx, gy)],
    ['NAZIONI', p.cabinet.nazionale, (gx, gy) => cup(g, gx, gy, 0xffd23f)],
  ];
  items.forEach(([label, n, draw], i) => {
    const cx = x + w / 2 + (i - 1.5) * (w / 4.4);
    draw(cx, y + 56);
    box.add(txt(scene, cx, y + 76, `x${n}`, 8, n ? '#ffffff' : '#5a5f80'));
    box.add(txt(scene, cx, y + 90, label, 6, '#8a8fb0'));
  });
  box.add(txt(scene, x + 14, y + 112, 'STAGIONE', 6, '#8a8fb0').setOrigin(0, 0.5));
  box.add(txt(scene, x + 120, y + 112, 'SQUADRA', 6, '#8a8fb0').setOrigin(0, 0.5));
  box.add(txt(scene, x + w - 150, y + 112, 'POS', 6, '#8a8fb0'));
  box.add(txt(scene, x + w - 110, y + 112, 'GOL', 6, '#8a8fb0'));
  box.add(txt(scene, x + w - 66, y + 112, 'MEDIA', 6, '#8a8fb0'));
  const rows = p.log.slice(-6);
  if (!rows.length) box.add(txt(scene, x + w / 2, y + 160, 'La prima stagione è ancora in corso.', 6, '#5a5f80'));
  rows.forEach((r, i) => {
    const yy = y + 130 + i * 18;
    const t = teamById(r.club);
    g.fillStyle(t.colors.shirt).fillRect(x + 108, yy - 4, 8, 8);
    box.add(txt(scene, x + 14, yy, `${r.season} (${r.age} anni)`, 6, '#ffffff').setOrigin(0, 0.5));
    box.add(txt(scene, x + 120, yy, t.name + (r.prizes.length ? ` (${r.prizes.length} premi)` : ''), 6, r.prizes.length ? '#ffd23f' : '#ffffff').setOrigin(0, 0.5));
    box.add(txt(scene, x + w - 150, yy, `${r.pos}°`, 6, '#ffffff'));
    box.add(txt(scene, x + w - 110, yy, String(r.goals), 6, '#ffffff'));
    box.add(txt(scene, x + w - 66, yy, r.avg.toFixed(1), 6, r.avg >= 7 ? '#5be37d' : '#ffffff'));
  });
  box.add(txt(scene, x + w / 2, y + 242, `In carriera: ${c.apps} partite · ${c.goals} gol · ${p.natGoals} in Nazionale`, 6, '#d8dcf0'));
  closeBtn(scene, box, x + w / 2, y + 264);
}

// ---------------------------------------------------------------- barre

/** Barra orizzontale a quadretti (fiducia, fama). */
export function meter(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, v: number, col: number) {
  const n = 10;
  const cw = Math.floor(w / n);
  for (let k = 0; k < n; k++) {
    g.fillStyle(0x1a1222).fillRect(x + k * cw - 1, y - 5, cw - 1, 10);
    g.fillStyle(k < Math.round(v / 10) ? col : 0x2e3250).fillRect(x + k * cw, y - 4, cw - 3, 8);
  }
  void scene;
}

export function trustRow(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, c: CareerState) {
  const t = c.trust ?? 60;
  const l = trustLabel(t, !!c.pro);
  txt(scene, x, y, 'FIDUCIA', 6, '#ffffff').setOrigin(0, 0.5);
  meter(scene, g, x + 56, y, w - 150, t, Phaser.Display.Color.HexStringToColor(l.color).color);
  txt(scene, x + w, y, l.text, 6, l.color).setOrigin(1, 0.5);
}

export function fameRow(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, p: ProState) {
  const st = statusOf(p.reputation);
  txt(scene, x, y, 'FAMA', 6, '#ffffff').setOrigin(0, 0.5);
  meter(scene, g, x + 56, y, w - 150, Math.min(100, p.reputation), Phaser.Display.Color.HexStringToColor(st.color).color);
  txt(scene, x + w, y, st.name, 6, st.color).setOrigin(1, 0.5);
}
