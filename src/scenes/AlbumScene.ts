import Phaser from 'phaser';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load, save } from '../save/storage';
import { sfx } from '../audio/sfx';
import { backToMenu } from './demo';
import { teamById } from '../data/teams';
import { PITCHES } from '../data/pitches';
import { THEMES } from '../gfx/pitchArt';
import { frameIndex, makePlayerSheet } from '../gfx/sprites';
import { shade } from '../gfx/px';
import {
  ALBUM_PAGES,
  ALL_STICKERS,
  duplicates,
  newAlbum,
  openPack,
  owned,
  pageComplete,
  PAGE_BONUS,
  swapDuplicates,
  SWAP_COST,
  type AlbumSave,
  type StickerDef,
} from '../modes/album';

const RARITY_BORDER = { comune: 0xc8ccd8, rara: 0x3fd0ff, leggendaria: 0xffd23f };

export function albumOf(): AlbumSave {
  const d = load();
  if (!d.album) save((s) => (s.album = newAlbum()));
  return load().album!;
}

/** Disegna una figurina (posseduta o mancante) centrata in (x, y). */
export function drawSticker(scene: Phaser.Scene, def: StickerDef, x: number, y: number, w: number, h: number, have: boolean): Phaser.GameObjects.Container {
  const c = scene.add.container(Math.round(x), Math.round(y));
  const g = scene.add.graphics();
  c.add(g);
  const L = -w / 2;
  const T = -h / 2;
  g.fillStyle(0x000000, 0.35).fillRect(L + 2, T + 3, w, h);
  if (!have) {
    g.fillStyle(0x1a1222).fillRect(L - 1, T - 1, w + 2, h + 2);
    g.fillStyle(0x262940).fillRect(L, T, w, h);
    g.lineStyle(1, 0x3a3d55).strokeRect(L + 3, T + 3, w - 6, h - 6);
    c.add(txt(scene, 0, -4, String(def.n), 12, '#4a4e6a'));
    c.add(txt(scene, 0, h / 2 - 10, def.kind === 'giocatore' ? '?' : '', 6, '#4a4e6a'));
    return c;
  }
  const border = RARITY_BORDER[def.rarity];
  g.fillStyle(0x1a1222).fillRect(L - 1, T - 1, w + 2, h + 2);
  g.fillStyle(border).fillRect(L, T, w, h);
  let bg = 0x2a2d48;
  if (def.kind === 'giocatore' || def.kind === 'stemma') bg = teamById(def.team).colors.shirt;
  if (def.kind === 'campo') bg = THEMES[def.pitch].a;
  if (def.kind === 'speciale') bg = 0x5a3fa0;
  g.fillStyle(shade(bg, 0.55)).fillRect(L + 3, T + 3, w - 6, h - 6);
  g.fillStyle(bg).fillRect(L + 3, T + 3, w - 6, (h - 6) * 0.62);
  g.fillStyle(0xffffff, 0.18).fillRect(L + 3, T + 3, w - 6, 3);
  // numero
  c.add(txt(scene, L + 7, T + 9, String(def.n), 6, '#ffffff').setOrigin(0, 0.5));
  const nameY = h / 2 - 12;
  if (def.kind === 'giocatore') {
    const t = teamById(def.team);
    const p = t.players[def.idx];
    const key = `stk_${def.team}_${def.idx}`;
    if (!scene.textures.exists(key)) makePlayerSheet(scene, key, t, p);
    c.add(scene.add.image(0, -4, key, frameIndex('down', 'idle')).setScale(Math.min(3, (h - 30) / 24)));
    c.add(txt(scene, L + w - 7, T + 9, p.role === 'GK' ? 'POR' : p.role === 'DEF' ? 'DIF' : p.role === 'MID' ? 'CEN' : 'ATT', 6, '#ffffff').setOrigin(1, 0.5));
    c.add(txt(scene, 0, nameY, p.name.toUpperCase(), 6, '#ffffff'));
  } else if (def.kind === 'stemma') {
    const t = teamById(def.team);
    const s = Math.min(w, h) * 0.32;
    g.fillStyle(0x1a1222).fillRect(-s - 2, -s - 8, s * 2 + 4, s * 2 + 4);
    g.fillStyle(t.colors.shirt).fillRect(-s, -s - 6, s * 2, s * 2);
    g.fillStyle(t.colors.shirt2).fillRect(-s, -s - 6, s, s * 2);
    g.fillStyle(0x1a1222).fillTriangle(-s - 2, s - 6, s + 2, s - 6, 0, s + 8);
    g.fillStyle(t.colors.shirt).fillTriangle(-s, s - 6, s, s - 6, 0, s + 5);
    c.add(txt(scene, 0, -8, t.short, 8, '#ffffff', { stroke: '#1a1222', strokeThickness: 3 }));
    c.add(txt(scene, 0, nameY, 'STEMMA', 6, '#ffffff'));
  } else if (def.kind === 'campo') {
    const th = THEMES[def.pitch];
    const pw = w - 16;
    const ph = Math.max(16, (h - 36) * 0.72);
    const px = -pw / 2;
    const py = -ph / 2 - 2;
    for (let i = 0; i < 6; i++) g.fillStyle(i % 2 ? th.a : th.b).fillRect(px + (i * pw) / 6, py, pw / 6 + 1, ph);
    g.lineStyle(1, th.line).strokeRect(px, py, pw, ph);
    g.lineBetween(0, py, 0, py + ph);
    g.strokeCircle(0, py + ph / 2, ph * 0.18);
    const pdef = PITCHES[def.pitch];
    for (const o of pdef.obstacles ?? []) g.fillStyle(0xd8d0c0).fillCircle(px + (o.x / pdef.width) * pw, py + (o.y / pdef.height) * ph, 2);
    for (const bm of pdef.bumpers ?? []) g.fillStyle(0xff3fa4).fillCircle(px + (bm.x / pdef.width) * pw, py + (bm.y / pdef.height) * ph, 2);
    for (const m of pdef.mud ?? []) g.fillStyle(0x5c3e22).fillCircle(px + (m.x / pdef.width) * pw, py + (m.y / pdef.height) * ph, 2);
    for (const gy of pdef.geysers ?? []) g.fillStyle(0xff9a1a).fillCircle(px + (gy.x / pdef.width) * pw, py + (gy.y / pdef.height) * ph, 2);
    c.add(txt(scene, 0, nameY, def.name.toUpperCase().replace(/^(CAMPO|STADIO|PRATO|MOLO|PIAZZA|TETTO|GABBIA|ARENA|CRATERE) (IN |DEL |DI |DEL )?/, '').slice(0, Math.floor((w - 6) / 6)), 6, '#ffffff'));
  } else {
    const iconKey = def.icon === 'fuoco' || def.icon === 'turbo' || def.icon === 'muro' ? `pu_${def.icon}` : def.icon === 'pallone' ? 'ball' : null;
    if (iconKey) c.add(scene.add.image(0, -6, iconKey).setScale(def.icon === 'pallone' ? 4 : 3));
    else if (def.icon === 'coppa') {
      g.fillStyle(0xffd23f).fillRect(-10, -22, 20, 14).fillRect(-3, -8, 6, 8).fillRect(-8, 0, 16, 4);
      g.fillStyle(0xffd23f).fillRect(-15, -20, 4, 8).fillRect(11, -20, 4, 8);
      g.fillStyle(0xffffff, 0.5).fillRect(-7, -20, 3, 9);
    } else {
      // fischietto
      g.fillStyle(0xd8dce8).fillCircle(-2, -6, 8).fillRect(-2, -14, 16, 6);
      g.fillStyle(0x1a1222).fillCircle(-2, -6, 3);
    }
    c.add(txt(scene, 0, nameY, def.name.toUpperCase().slice(0, Math.floor((w - 6) / 6)), 6, '#ffd23f'));
  }
  return c;
}

/** Album delle figurine: pagine, pacchetti da aprire e scambio dei doppioni. */
export class AlbumScene extends Phaser.Scene {
  private page = 0;
  private opening?: Phaser.GameObjects.Container;

  constructor() {
    super('album');
  }

  create() {
    this.opening = undefined;
    albumOf();
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  private rebuild() {
    this.children.removeAll(true);
    this.opening = undefined;
    this.build();
  }

  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    const a = albumOf();
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.9).setOrigin(0).setInteractive();
    shadowTxt(this, W / 2, 16, 'ALBUM FIGURINE', 16, '#ffd23f');
    txt(this, W / 2, 36, `${owned(a)} / ${ALL_STICKERS.length}  ·  doppioni ${duplicates(a)}`, 6, '#8a8fb0');

    // pagina
    const p = ALBUM_PAGES[this.page];
    const g = this.add.graphics();
    const pw = Math.min(W - 70, 520);
    const top = 50;
    const ph = 232;
    panel(g, W / 2 - pw / 2, top, pw, ph, 0xe9dfc6, 0xfff6dc, 1);
    g.fillStyle(0xd8ccb0).fillRect(W / 2 - pw / 2, top + 22, pw, 1);
    const done = pageComplete(a, p);
    if (p.team) {
      const t = teamById(p.team);
      g.fillStyle(t.colors.shirt).fillRect(W / 2 - pw / 2 + 8, top + 6, 10, 10);
      g.fillStyle(t.colors.shirt2).fillRect(W / 2 - pw / 2 + 18, top + 6, 4, 10);
    }
    txt(this, W / 2, top + 12, p.title, 8, '#3a2a1a');
    txt(this, W / 2 + pw / 2 - 8, top + 12, done ? 'COMPLETA!' : `${p.stickers.filter((s) => (a.have[s.id] ?? 0) > 0).length}/${p.stickers.length}`, 6, done ? '#2f9a50' : '#8a7a5a').setOrigin(1, 0.5);
    txt(this, W / 2 - pw / 2 + 8 + (p.team ? 18 : 0), top + 12, `${this.page + 1}/${ALBUM_PAGES.length}`, 6, '#8a7a5a').setOrigin(0, 0.5);
    const cols = p.stickers.length > 6 ? 4 : 3;
    const rows = Math.ceil(p.stickers.length / cols);
    const cw = cols === 4 ? 78 : 86;
    const ch = rows >= 3 ? 58 : 96;
    const gx = (pw - cols * cw) / (cols + 1);
    p.stickers.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = W / 2 - pw / 2 + gx + col * (cw + gx) + cw / 2;
      const y = top + 30 + (ph - 30 - rows * ch) / (rows + 1) * (row + 1) + row * ch + ch / 2;
      const have = (a.have[s.id] ?? 0) > 0;
      const card = drawSticker(this, s, x, y, cw, ch, have);
      if ((a.have[s.id] ?? 0) > 1) card.add(txt(this, cw / 2 - 2, -ch / 2 + 2, `x${a.have[s.id]}`, 6, '#1a1222', { backgroundColor: '#ffd23f', padding: { x: 2, y: 1 } }).setOrigin(1, 0));
      if (have) {
        const z = this.add.zone(x, y, cw, ch).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => this.zoom(s));
      }
    });
    button(this, W / 2 - pw / 2 - 16, top + ph / 2, 24, 40, '<', () => this.turn(-1), { size: 8 });
    button(this, W / 2 + pw / 2 + 16, top + ph / 2, 24, 40, '>', () => this.turn(1), { size: 8 });

    // comandi
    button(this, 64, H - 28, 96, 28, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
    const open = button(this, W - 100, H - 30, 170, 32, `APRI PACCHETTO (${a.packs})`, () => this.openPack(), {
      color: a.packs > 0 ? COLORS.good : 0x3a3d55,
      textColor: a.packs > 0 ? '#1a1222' : '#8a8fb0',
      size: 6,
    });
    if (a.packs > 0) this.tweens.add({ targets: open.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const dup = duplicates(a);
    button(this, W / 2, H - 28, 170, 24, `SCAMBIA ${SWAP_COST} DOPPIONI`, () => {
      save((s) => swapDuplicates(s.album!));
      sfx.select();
      this.rebuild();
    }, { size: 6, color: dup >= SWAP_COST ? 0x2f6fd0 : 0x3a3d55 }).setEnabled(dup >= SWAP_COST);
  }

  private turn(d: number) {
    this.page = (this.page + d + ALBUM_PAGES.length) % ALBUM_PAGES.length;
    sfx.select();
    this.rebuild();
  }

  /** Figurina ingrandita con qualche informazione. */
  private zoom(s: StickerDef) {
    if (this.opening) return;
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0).setDepth(50);
    const bg = this.add.rectangle(0, 0, W, H, 0x0a0816, 0.8).setOrigin(0).setInteractive();
    bg.on('pointerup', () => c.destroy());
    c.add(bg);
    const card = drawSticker(this, s, W / 2 - 80, H / 2, 130, 170, true);
    c.add(card);
    const info: string[] = [];
    if (s.kind === 'giocatore') {
      const p = teamById(s.team).players[s.idx];
      const st = p.stats;
      const v = (x: number) => Math.round(x * 80);
      info.push(`${p.name}  n.${p.number}`, teamById(s.team).name, '', `VELOCITÀ ${v(st.speed)}`, `TIRO     ${v(st.shot)}`, `PASSAGGI ${v(st.pass)}`, `CONTRASTI ${v(st.tackle)}`, `CONTROLLO ${v(st.control)}`);
      if (p.role === 'GK') info.push(`PARATE   ${v(st.keeping)}`);
    } else if (s.kind === 'stemma') {
      const t = teamById(s.team);
      info.push(t.name, `Forza: ${'*'.repeat(t.stars)}`);
    } else if (s.kind === 'campo') {
      info.push(PITCHES[s.pitch].name, '', ...wrap(PITCHES[s.pitch].rule, 26));
    } else {
      info.push(s.name, '', ...wrap(s.desc, 26));
    }
    info.push('', s.rarity === 'leggendaria' ? 'LEGGENDARIA' : s.rarity === 'rara' ? 'RARA' : 'COMUNE');
    info.forEach((l, i) => c.add(txt(this, W / 2 + 10, H / 2 - 70 + i * 14, l, 6, i === info.length - 1 ? '#ffd23f' : '#ffffff').setOrigin(0, 0.5)));
    c.add(txt(this, W / 2, H - 16, 'tocca per chiudere', 6, '#8a8fb0'));
  }

  private openPack() {
    if (this.opening) return;
    let res: ReturnType<typeof openPack> = null;
    save((s) => {
      res = openPack(s.album!);
    });
    if (!res) return;
    const r = res as NonNullable<ReturnType<typeof openPack>>;
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0).setDepth(60);
    this.opening = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x0a0816, 0.88).setOrigin(0).setInteractive());
    c.add(shadowTxt(this, W / 2, 28, 'PACCHETTO!', 16, '#ffd23f').c);
    const n = r.stickers.length;
    const cw = 96;
    const ch = 124;
    const gap = Math.min(24, (W - n * cw) / (n + 1));
    const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2 + cw / 2;
    r.stickers.forEach(({ def, isNew }, i) => {
      const x = x0 + i * (cw + gap);
      const y = H / 2 + 4;
      // dorso della figurina, poi si gira
      const back = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1222).fillRect(-cw / 2 - 1, -ch / 2 - 1, cw + 2, ch + 2);
      bg.fillStyle(0xc0306a).fillRect(-cw / 2, -ch / 2, cw, ch);
      bg.fillStyle(0xe8508a).fillRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, ch - 12);
      back.add([bg, txt(this, 0, 0, 'PIXEL\nCALCIO', 8, '#ffffff', { align: 'center' })]);
      c.add(back);
      const front = drawSticker(this, def, x, y, cw, ch, true);
      front.setScale(0, 1);
      c.add(front);
      if (isNew) {
        const tag = txt(this, x, y - ch / 2 - 10, 'NUOVA!', 6, '#1a1222', { backgroundColor: '#5be37d', padding: { x: 3, y: 2 } }).setAlpha(0);
        c.add(tag);
        this.tweens.add({ targets: tag, alpha: 1, delay: 700 + i * 450, duration: 200 });
      } else {
        const tag = txt(this, x, y - ch / 2 - 10, 'DOPPIONE', 6, '#ffffff', { backgroundColor: '#3a3d55', padding: { x: 3, y: 2 } }).setAlpha(0);
        c.add(tag);
        this.tweens.add({ targets: tag, alpha: 1, delay: 700 + i * 450, duration: 200 });
      }
      this.tweens.add({
        targets: back,
        scaleX: 0,
        delay: 400 + i * 450,
        duration: 150,
        onComplete: () => {
          back.destroy();
          if (isNew && def.rarity !== 'comune') sfx.fanfare();
          else sfx.select();
          this.tweens.add({ targets: front, scaleX: 1, duration: 150 });
        },
      });
    });
    const after = 600 + n * 450;
    this.time.delayedCall(after, () => {
      if (r.completed.length) {
        sfx.fanfare();
        c.add(txt(this, W / 2, H - 58, `Pagina completata: ${r.completed.map((p) => p.title).join(', ')}!  +${PAGE_BONUS * r.completed.length} pacchetti`, 6, '#ffd23f'));
      }
      const b = button(this, W / 2, H - 28, 160, 28, 'CONTINUA', () => {
        // salta alla pagina della prima figurina nuova
        const first = r.stickers.find((s) => s.isNew)?.def;
        if (first) this.page = ALBUM_PAGES.findIndex((p) => p.stickers.some((s) => s.id === first.id));
        this.rebuild();
      }, { color: COLORS.good, textColor: '#1a1222' });
      c.add(b.c);
    });
  }
}

function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    if ((line + ' ' + w).trim().length > n) {
      out.push(line.trim());
      line = w;
    } else line += ' ' + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}
