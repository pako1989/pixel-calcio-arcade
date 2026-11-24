import Phaser from 'phaser';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { portrait } from '../gfx/animeArt';
import { hex, shade } from '../gfx/px';
import { progressOf, save } from '../save/storage';
import { sfx } from '../audio/sfx';
import { goFullscreen, isTouch } from '../ui/fullscreen';
import { TECHS, type LeggendaSave } from '../modes/leggenda';
import { CAST, rivalTeam } from '../modes/leggendaStory';
import {
  autoLineup, canUpgrade, cardById, cardPlayer, castShirt, chemistry, levelOfCard, lineupComplete, MAX_STAR, openStarPack, owns,
  PACKS, PITY, place, RARITIES, RARITY_COLOR, RARITY_NAME, rating, roundOpen, SLOTS, spare, STAR_CARDS, STAR_ROUNDS, stelleOf,
  teamRating, techLevel, TECH_KIND_NAME, upgrade, upgradeCost, type PackId, type PackPull, type StarCard, type StarRarity, type StelleSave,
} from '../modes/leggendaStelle';

export type StelleView = 'squadra' | 'album' | 'buste' | 'torneo';

const ROLE_NAME = { GK: 'POR', DEF: 'DIF', MID: 'CEN', FWD: 'ATT' } as const;

/** Nome completo del personaggio (il cast ha nome e cognome). */
export const fullName = (c: StarCard) => (CAST[c.id]?.name ?? c.base.name).replace(/ \(.*\)$/, '');

/**
 * Disegna una carta della Squadra delle Stelle centrata in (x, y).
 * `state`: posseduta, incontrata ma mancante, oppure ancora da scoprire nella storia.
 */
export function drawStarCard(
  scene: Phaser.Scene,
  card: StarCard,
  lv: number,
  x: number,
  y: number,
  w: number,
  h: number,
  state: 'owned' | 'missing' | 'locked',
  slotRole?: string,
): Phaser.GameObjects.Container {
  const c = scene.add.container(Math.round(x), Math.round(y));
  const g = scene.add.graphics();
  c.add(g);
  const L = -w / 2;
  const T = -h / 2;
  const rc = RARITY_COLOR[card.rarity];
  g.fillStyle(0x000000, 0.35).fillRect(L + 2, T + 3, w, h);
  g.fillStyle(0x1a1222).fillRect(L - 1, T - 1, w + 2, h + 2);
  if (state === 'locked') {
    g.fillStyle(0x262940).fillRect(L, T, w, h);
    g.lineStyle(1, 0x3a3d55).strokeRect(L + 3, T + 3, w - 6, h - 6);
    c.add(txt(scene, 0, -6, '?', 16, '#4a4e6a'));
    c.add(txt(scene, 0, h / 2 - 10, `EP.${card.ep + 1}`, 6, '#4a4e6a'));
    return c;
  }
  const owned = state === 'owned';
  g.fillStyle(owned ? rc : shade(rc, 0.4)).fillRect(L, T, w, h);
  g.fillStyle(shade(card.shirt, owned ? 0.45 : 0.2)).fillRect(L + 3, T + 3, w - 6, h - 6);
  g.fillStyle(owned ? shade(card.shirt, 0.75) : 0x20223a).fillRect(L + 3, T + 3, w - 6, (h - 6) * 0.6);
  if (card.rarity === 'leggenda' && owned) {
    // riflesso olografico
    const shine = scene.add.rectangle(0, 0, w - 6, h - 6, 0xffffff, 0);
    c.add(shine);
    scene.tweens.add({ targets: shine, fillAlpha: 0.18, duration: 700, yoyo: true, repeat: -1, repeatDelay: 900 });
  }
  const pk = portrait(scene, card.id, card.base.face, castShirt(card));
  const scale = Math.min(1.25, (h - 34) / 48);
  const img = scene.add.image(0, T + 5 + 48 * scale, pk).setOrigin(0.5, 1).setScale(scale);
  if (!owned) img.setTintFill(0x14111f).setAlpha(0.85);
  c.add(img);
  const p = owned ? cardPlayer(card, lv) : card.base;
  const role = (slotRole ?? p.role) as keyof typeof ROLE_NAME;
  c.add(txt(scene, L + 5, T + 9, owned ? String(rating(p, role)) : '?', 8, '#ffffff', { stroke: '#1a1222', strokeThickness: 3 }).setOrigin(0, 0.5));
  const offRole = slotRole && slotRole !== card.base.role;
  c.add(txt(scene, L + w - 4, T + 8, ROLE_NAME[card.base.role], 5, offRole ? '#ff5a5a' : '#ffffff', { stroke: '#1a1222', strokeThickness: 2 }).setOrigin(1, 0.5));
  const max = Math.floor((w - 4) / 5);
  const full = card.base.name.toUpperCase();
  const nm = (full.length > max ? full.split(' ').pop()! : full).slice(0, max);
  c.add(txt(scene, 0, h / 2 - 17, owned ? nm : '???', 5, owned ? '#ffffff' : '#6a6d88'));
  if (owned) {
    for (let i = 0; i < MAX_STAR; i++) {
      const sx = -((MAX_STAR - 1) * 7) / 2 + i * 7;
      g.fillStyle(i < lv ? 0xffd23f : 0x3a3d55).fillRect(sx - 2, h / 2 - 9, 5, 5);
    }
  }
  return c;
}

/** Schermata STELLE dentro Leggenda del Pallone. */
export class StellePanel {
  private modal?: Phaser.GameObjects.Container;
  private st: StelleSave;
  private joined: string[];

  constructor(
    private scene: Phaser.Scene,
    private sv: LeggendaSave,
    private state: { view: StelleView; page: number; filter: StarRarity | 'tutte' },
    private rebuild: () => void,
  ) {
    const r = stelleOf(sv);
    this.st = r.st;
    this.joined = r.joined;
    if (r.joined.length) save();
  }

  build() {
    const s = this.scene;
    const W = s.scale.width;
    const g = s.add.graphics();
    panel(g, 10, 80, W - 20, 272, 0x1b1d2e, 0x2e3250, 0.94);
    const views: [StelleView, string][] = [['squadra', 'SQUADRA'], ['album', 'ALBUM'], ['buste', 'BUSTE'], ['torneo', 'TORNEO']];
    views.forEach(([v, l], i) => {
      const b = button(s, 56 + i * 82, 96, 76, 16, l, () => {
        this.state.view = v;
        this.state.page = 0;
        this.rebuild();
      }, { size: 6, color: 0x8a3fd0 });
      b.setSelected(this.state.view === v);
    });
    const owned = STAR_CARDS.filter((c) => owns(this.st, c.id)).length;
    txt(s, W - 22, 96, `CARTE ${owned}/${STAR_CARDS.length}`, 6, '#c06aff').setOrigin(1, 0.5);
    if (this.joined.length) {
      const names = this.joined.map((id) => fullName(cardById(id)!)).join(', ');
      this.joined = [];
      const W = s.scale.width;
      const H = s.scale.height;
      const c = s.add.container(0, 0).setDepth(90);
      const body = txt(s, W / 2, H / 2 + 8, names, 7, '#ffffff', { wordWrap: { width: W - 80 }, align: 'center', lineSpacing: 6 });
      const bh = body.height + 50;
      c.add(s.add.rectangle(0, H / 2 - bh / 2 + 4, W, bh, 0x0d0a1a, 0.94).setOrigin(0));
      c.add(shadowTxt(s, W / 2, H / 2 - bh / 2 + 22, 'SI UNISCONO ALLE STELLE!', 10, '#ffd23f').c);
      c.add(body);
      s.tweens.add({ targets: c, alpha: 0, delay: 3200, duration: 500, onComplete: () => c.destroy() });
      sfx.fanfare();
    }
    if (this.state.view === 'squadra') this.buildSquad();
    else if (this.state.view === 'album') this.buildAlbum();
    else if (this.state.view === 'buste') this.buildPacks();
    else this.buildTournament();
  }

  private persist() {
    save();
  }

  // ---------- squadra ----------

  private buildSquad() {
    const s = this.scene;
    const W = s.scale.width;
    const pw = Math.round((W - 40) * 0.62);
    const g = s.add.graphics();
    // mini campo
    const fx = 20;
    const fy = 110;
    const fh = 236;
    for (let i = 0; i < 8; i++) g.fillStyle(i % 2 ? 0x2a7a3a : 0x2f8a42).fillRect(fx + (i * pw) / 8, fy, pw / 8 + 1, fh);
    g.lineStyle(1, 0xffffff, 0.35).strokeRect(fx, fy, pw, fh);
    g.lineBetween(fx + pw / 2, fy, fx + pw / 2, fy + fh);
    g.strokeCircle(fx + pw / 2, fy + fh / 2, 24);
    g.strokeRect(fx, fy + fh / 2 - 40, 26, 80);
    const col = [0.1, 0.33, 0.33, 0.6, 0.6, 0.86, 0.86];
    const row = [0.5, 0.27, 0.73, 0.27, 0.73, 0.27, 0.73];
    const cw = 56;
    const ch = 78;
    SLOTS.forEach((role, i) => {
      const x = fx + Math.max(cw / 2 + 4, Math.min(pw - cw / 2 - 4, col[i] * pw));
      const y = fy + row[i] * fh;
      const id = this.st.lineup[i];
      const card = id ? cardById(id) : undefined;
      if (card) drawStarCard(s, card, levelOfCard(this.st, card.id), x, y, cw, ch, 'owned', role);
      else {
        g.fillStyle(0x1a1222, 0.6).fillRect(x - cw / 2, y - ch / 2, cw, ch);
        g.lineStyle(1, 0xffffff, 0.6).strokeRect(x - cw / 2, y - ch / 2, cw, ch);
        txt(s, x, y - 6, '+', 16, '#ffffff');
        txt(s, x, y + 22, ROLE_NAME[role], 6, '#ffffff');
      }
      const z = s.add.zone(x, y, cw, ch).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (this.modal) return;
        sfx.click();
        this.picker(i);
      });
    });
    // dati della squadra
    const rx = fx + pw + 14;
    const rw = W - 20 - rx;
    const cx = rx + rw / 2;
    const ch2 = chemistry(this.st);
    txt(s, cx, 120, 'FORZA', 6, '#8a8fb0');
    shadowTxt(s, cx, 140, String(teamRating(this.st)), 16, '#ffd23f');
    txt(s, rx, 166, 'INTESA', 6, '#8a8fb0').setOrigin(0, 0.5);
    txt(s, rx + rw, 166, `${ch2.value}`, 7, ch2.value >= 60 ? '#5be37d' : ch2.value >= 40 ? '#ffffff' : '#ff5a5a').setOrigin(1, 0.5);
    g.fillStyle(0x2e3250).fillRect(rx, 174, rw, 6);
    g.fillStyle(ch2.value >= 60 ? COLORS.good : ch2.value >= 40 ? 0xffd23f : COLORS.bad).fillRect(rx, 174, Math.round((rw * ch2.value) / 100), 6);
    let y = 192;
    for (const l of ch2.links.slice(0, 4)) {
      txt(s, rx, y, `+ ${l}`, 5, '#5be37d').setOrigin(0, 0.5);
      y += 11;
    }
    for (const n of ch2.notes.slice(0, 2)) {
      txt(s, rx, y, `· ${n}`, 5, n.includes('fuori') ? '#ff9a9a' : '#3fd0ff').setOrigin(0, 0.5);
      y += 11;
    }
    if (!ch2.links.length) txt(s, rx, y, 'Metti insieme le coppie della\nstoria per alzare l\'intesa.', 5, '#8a8fb0', { lineSpacing: 4 }).setOrigin(0, 0);
    button(s, cx, 300, Math.min(130, rw), 18, 'SQUADRA MIGLIORE', () => {
      autoLineup(this.st);
      this.persist();
      sfx.select();
      this.rebuild();
    }, { size: 6, color: 0x2f6fd0 });
    const ok = lineupComplete(this.st);
    button(s, cx, 326, Math.min(130, rw), 20, 'TORNEO', () => {
      this.state.view = 'torneo';
      this.rebuild();
    }, { size: 7, color: ok ? 0xe85a1a : 0x3a3d55 }).setEnabled(ok);
  }

  /** Scelta del giocatore per un posto della squadra. */
  private picker(slot: number) {
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    const role = SLOTS[slot];
    const pool = STAR_CARDS.filter((c) => owns(this.st, c.id))
      .map((c) => ({ c, r: rating(cardPlayer(c, levelOfCard(this.st, c.id)), role) - (c.base.role !== role ? 10 : 0) }))
      .sort((a, b) => Number(b.c.base.role === role) - Number(a.c.base.role === role) || b.r - a.r);
    let page = 0;
    const cw = 54;
    const ch = 76;
    const cols = Math.max(4, Math.floor((W - 60) / (cw + 8)));
    const per = cols * 3;
    const draw = () => {
      this.closeModal();
      const c = s.add.container(0, 0).setDepth(60);
      this.modal = c;
      c.add(s.add.rectangle(0, 0, W, H, 0x090714, 0.92).setOrigin(0).setInteractive());
      c.add(txt(s, W / 2, 14, `SCEGLI ${ROLE_NAME[role]} · in rosso chi gioca fuori ruolo`, 7, '#ffd23f'));
      pool.slice(page * per, page * per + per).forEach(({ c: card }, i) => {
        const x = W / 2 - ((cols - 1) * (cw + 8)) / 2 + (i % cols) * (cw + 8);
        const y = 74 + Math.floor(i / cols) * (ch + 10);
        const k = drawStarCard(s, card, levelOfCard(this.st, card.id), x, y, cw, ch, 'owned', role);
        c.add(k);
        if (this.st.lineup.includes(card.id)) c.add(txt(s, x, y + ch / 2 - 1, 'IN CAMPO', 5, '#1a1222', { backgroundColor: '#5be37d', padding: { x: 2, y: 1 } }));
        const z = s.add.zone(x, y, cw, ch).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => {
          place(this.st, slot, card.id);
          this.persist();
          sfx.select();
          this.closeModal();
          this.rebuild();
        });
        c.add(z);
      });
      const pages = Math.max(1, Math.ceil(pool.length / per));
      if (pages > 1) {
        c.add(button(s, W / 2 - 70, H - 20, 40, 20, '<', () => { page = (page - 1 + pages) % pages; draw(); }).c);
        c.add(txt(s, W / 2, H - 20, `${page + 1}/${pages}`, 6, '#8a8fb0'));
        c.add(button(s, W / 2 + 70, H - 20, 40, 20, '>', () => { page = (page + 1) % pages; draw(); }).c);
      }
      c.add(button(s, 50, H - 20, 76, 20, 'CHIUDI', () => this.closeModal(), { size: 6, color: 0x3a3d55 }).c);
    };
    draw();
  }

  private closeModal() {
    this.modal?.destroy(true);
    this.modal = undefined;
  }

  // ---------- album ----------

  private buildAlbum() {
    const s = this.scene;
    const W = s.scale.width;
    const filters: (StarRarity | 'tutte')[] = ['tutte', ...RARITIES];
    filters.forEach((f, i) => {
      const b = button(s, 56 + i * 64, 118, 58, 14, f === 'tutte' ? 'TUTTE' : RARITY_NAME[f], () => {
        this.state.filter = f;
        this.state.page = 0;
        this.rebuild();
      }, { size: 5, color: f === 'tutte' ? 0x3a3d55 : shade(RARITY_COLOR[f], 0.6) });
      b.setSelected(this.state.filter === f);
    });
    const list = STAR_CARDS.filter((c) => this.state.filter === 'tutte' || c.rarity === this.state.filter);
    const have = list.filter((c) => owns(this.st, c.id)).length;
    txt(s, W - 22, 118, `${have}/${list.length}`, 6, '#8a8fb0').setOrigin(1, 0.5);
    const cw = 58;
    const ch = 82;
    const cols = Math.max(4, Math.floor((W - 70) / (cw + 8)));
    const per = cols * 2;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const page = Math.min(this.state.page, pages - 1);
    list.slice(page * per, page * per + per).forEach((card, i) => {
      const x = W / 2 - ((cols - 1) * (cw + 8)) / 2 + (i % cols) * (cw + 8);
      const y = 184 + Math.floor(i / cols) * (ch + 8);
      const state = owns(this.st, card.id) ? 'owned' : card.ep <= this.sv.cleared ? 'missing' : 'locked';
      const k = drawStarCard(s, card, levelOfCard(this.st, card.id), x, y, cw, ch, state);
      if (state === 'owned') {
        if (spare(this.st, card.id) > 0) k.add(txt(s, cw / 2 - 1, -ch / 2 + 16, `+${spare(this.st, card.id)}`, 5, '#1a1222', { backgroundColor: '#3fd0ff', padding: { x: 2, y: 1 } }).setOrigin(1, 0));
        if (canUpgrade(this.st, card.id)) {
          const up = txt(s, 0, -ch / 2 - 2, 'POTENZIA!', 5, '#1a1222', { backgroundColor: '#5be37d', padding: { x: 2, y: 1 } });
          k.add(up);
          s.tweens.add({ targets: up, y: up.y - 2, duration: 400, yoyo: true, repeat: -1 });
        }
      }
      if (state !== 'locked') {
        const z = s.add.zone(x, y, cw, ch).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => {
          if (this.modal) return;
          sfx.click();
          this.detail(card);
        });
      }
    });
    if (pages > 1) {
      button(s, W / 2 - 70, 336, 40, 16, '<', () => { this.state.page = (page - 1 + pages) % pages; this.rebuild(); }, { size: 6 });
      txt(s, W / 2, 336, `${page + 1}/${pages}`, 6, '#8a8fb0');
      button(s, W / 2 + 70, 336, 40, 16, '>', () => { this.state.page = (page + 1) % pages; this.rebuild(); }, { size: 6 });
    }
  }

  /** Scheda della carta: statistiche, tecniche e potenziamento. */
  private detail(card: StarCard) {
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    this.closeModal();
    const c = s.add.container(0, 0).setDepth(60);
    this.modal = c;
    const shadeR = s.add.rectangle(0, 0, W, H, 0x090714, 0.85).setOrigin(0).setInteractive();
    c.add(shadeR);
    const mw = Math.min(W - 30, 470);
    const mh = 300;
    const mx = (W - mw) / 2;
    const my = (H - mh) / 2;
    const g = s.add.graphics();
    panel(g, mx, my, mw, mh, 0x161426, RARITY_COLOR[card.rarity], 0.98);
    c.add(g);
    const has = owns(this.st, card.id);
    const lv = levelOfCard(this.st, card.id);
    c.add(drawStarCard(s, card, lv, mx + 66, my + 92, 100, 140, has ? 'owned' : 'missing'));
    c.add(txt(s, mx + 66, my + 176, RARITY_NAME[card.rarity], 7, hex(RARITY_COLOR[card.rarity])));
    c.add(txt(s, mx + 66, my + 190, card.team, 5, '#8a8fb0', { wordWrap: { width: 120 }, align: 'center' }));
    const x0 = mx + 130;
    c.add(txt(s, x0, my + 18, has ? fullName(card).toUpperCase() : '???', 9, '#ffd23f').setOrigin(0, 0.5));
    c.add(txt(s, x0, my + 34, has ? `LIVELLO ${lv}/${MAX_STAR}` : `Lo incontri nell'episodio ${card.ep + 1}: cercalo nelle buste`, 6, has ? '#ffffff' : '#8a8fb0').setOrigin(0, 0.5));
    if (has) {
      const p = cardPlayer(card, lv);
      const stats: [string, number][] = card.base.role === 'GK'
        ? [['PARATA', p.gk], ['BLOCCO', p.blk], ['PASSAGGIO', p.pas], ['DRIBBLING', p.drb]]
        : [['DRIBBLING', p.drb], ['PASSAGGIO', p.pas], ['TIRO', p.sht], ['CONTRASTO', p.tck], ['BLOCCO', p.blk]];
      stats.push(['ENERGIA', p.sta / 15]);
      const bw = mw - 130 - 80;
      stats.forEach(([label, v], i) => {
        const y = my + 52 + i * 14;
        c.add(txt(s, x0, y, label, 5, '#8a8fb0').setOrigin(0, 0.5));
        g.fillStyle(0x2e3250).fillRect(x0 + 62, y - 3, bw, 6);
        g.fillStyle(v >= 9 ? 0xffd23f : v >= 7 ? COLORS.good : 0x3fd0ff).fillRect(x0 + 62, y - 3, Math.round((bw * Math.min(11, v)) / 11), 6);
        c.add(txt(s, x0 + 66 + bw, y, label === 'ENERGIA' ? String(p.sta) : v.toFixed(1), 5, '#ffffff').setOrigin(0, 0.5));
      });
      // tecniche
      let y = my + 62 + stats.length * 14;
      c.add(txt(s, x0, y, card.base.techs.length ? 'TECNICHE' : 'Nessuna tecnica speciale: un giocatore solido.', 6, '#3fd0ff').setOrigin(0, 0.5));
      y += 13;
      card.base.techs.slice(0, 7).forEach((id, k) => {
        const t = TECHS[id];
        const ok = lv >= techLevel(k);
        c.add(txt(s, x0, y, `${t.name}`, 5, ok ? hex(t.color) : '#5a5f80').setOrigin(0, 0.5));
        c.add(txt(s, mx + mw - 12, y, ok ? `${TECH_KIND_NAME(id)} +${t.power}${t.partner ? ' · COMBO' : ''}` : `LIVELLO ${techLevel(k)}`, 5, ok ? '#c8cce8' : '#5a5f80').setOrigin(1, 0.5));
        y += 11;
      });
      // potenziamento
      const need = upgradeCost(lv);
      const sp = spare(this.st, card.id);
      const by = my + mh - 22;
      c.add(txt(s, x0, by - 22, lv >= MAX_STAR ? 'Livello massimo!' : `Doppioni: ${sp}/${need} per il livello ${lv + 1}`, 6, lv >= MAX_STAR ? '#ffd23f' : sp >= need ? '#5be37d' : '#8a8fb0').setOrigin(0, 0.5));
      const ub = button(s, x0 + 70, by, 140, 20, 'POTENZIA', () => {
        if (upgrade(this.st, card.id)) {
          this.persist();
          sfx.powerup();
          this.detail(card);
          this.flash(`${card.base.name.toUpperCase()} SALE AL LIVELLO ${levelOfCard(this.st, card.id)}!`);
        }
      }, { size: 7, color: canUpgrade(this.st, card.id) ? COLORS.good : 0x3a3d55, textColor: canUpgrade(this.st, card.id) ? '#1a1222' : '#8a8fb0' });
      ub.setEnabled(canUpgrade(this.st, card.id));
      c.add(ub.c);
    }
    c.add(button(s, mx + mw - 50, my + mh - 22, 76, 20, 'CHIUDI', () => {
      this.closeModal();
      this.rebuild();
    }, { size: 6, color: 0x3a3d55 }).c);
  }

  private flash(msg: string) {
    const s = this.scene;
    const W = s.scale.width;
    const t = shadowTxt(s, W / 2, 60, msg, msg.length > 40 ? 6 : 9, '#5be37d');
    t.c.setDepth(80);
    s.tweens.add({ targets: t.c, y: 48, alpha: 0, delay: 900, duration: 500, onComplete: () => t.c.destroy() });
  }

  // ---------- buste ----------

  private buildPacks() {
    const s = this.scene;
    const W = s.scale.width;
    const coins = progressOf().coins;
    txt(s, 22, 120, `Monete: ${coins}   ·   Punti Leggenda: ${this.sv.pts}`, 6, '#ffd23f').setOrigin(0, 0.5);
    txt(s, W - 22, 120, `Leggenda sicura entro ${Math.max(1, PITY - this.st.dry)} buste`, 6, '#c06aff').setOrigin(1, 0.5);
    const n = PACKS.length;
    const bw = Math.min(170, (W - 60) / n - 10);
    PACKS.forEach((p, i) => {
      const cx = W / 2 - ((n - 1) * (bw + 12)) / 2 + i * (bw + 12);
      const top = 134;
      const g = s.add.graphics();
      const col = p.id === 'mito' ? RARITY_COLOR.leggenda : p.id === 'oro' ? RARITY_COLOR.oro : RARITY_COLOR.bronzo;
      panel(g, cx - bw / 2, top, bw, 210, 0x22253a, col, 0.95);
      // la busta
      g.fillStyle(0x1a1222).fillRect(cx - 27, top + 14, 54, 70);
      g.fillStyle(shade(col, 0.7)).fillRect(cx - 25, top + 16, 50, 66);
      g.fillStyle(col).fillRect(cx - 25, top + 16, 50, 12);
      g.fillStyle(0xffffff, 0.25).fillTriangle(cx - 25, top + 82, cx + 25, top + 30, cx + 25, top + 50);
      txt(s, cx, top + 54, '★', 16, '#ffffff');
      txt(s, cx, top + 96, p.name, 7, hex(col));
      txt(s, cx, top + 110, p.desc, 5, '#c8cce8');
      const odds = RARITIES.map((r) => `${RARITY_NAME[r].slice(0, 3)} ${Math.round(p.odds[r] * 100)}%`).join(' ');
      txt(s, cx, top + 124, odds, 5, '#8a8fb0', { wordWrap: { width: bw - 10 }, align: 'center' });
      const afford = p.currency === 'monete' ? coins >= p.price : this.sv.pts >= p.price;
      const buy = button(s, cx, top + 158, bw - 20, 20, `${p.price} ${p.currency === 'monete' ? 'MONETE' : 'PL'}`, () => {
        if (p.currency === 'monete') {
          const pr = progressOf();
          if (pr.coins < p.price) return;
          pr.coins -= p.price;
        } else {
          if (this.sv.pts < p.price) return;
          this.sv.pts -= p.price;
        }
        sfx.coin();
        this.open(p.id);
      }, { size: 6, color: afford ? COLORS.good : 0x3a3d55, textColor: afford ? '#1a1222' : '#8a8fb0' });
      buy.setEnabled(afford);
      const owned = this.st.packs[p.id] ?? 0;
      const ob = button(s, cx, top + 186, bw - 20, 18, owned ? `APRI IN REGALO (${owned})` : 'NESSUNA IN REGALO', () => {
        if ((this.st.packs[p.id] ?? 0) <= 0) return;
        this.st.packs[p.id]--;
        this.open(p.id);
      }, { size: 5, color: owned ? 0xe85a1a : 0x3a3d55 });
      ob.setEnabled(owned > 0);
      if (owned) s.tweens.add({ targets: ob.c, scale: 1.05, duration: 500, yoyo: true, repeat: -1 });
    });
  }

  /** Apre una busta con le carte che si girano una alla volta. */
  private open(id: PackId) {
    const pulls = openStarPack(this.sv, this.st, id);
    this.persist();
    this.reveal(pulls);
  }

  private reveal(pulls: PackPull[]) {
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    this.closeModal();
    const c = s.add.container(0, 0).setDepth(70);
    this.modal = c;
    c.add(s.add.rectangle(0, 0, W, H, 0x090714, 0.92).setOrigin(0).setInteractive());
    c.add(shadowTxt(s, W / 2, 30, 'BUSTA APERTA!', 14, '#ffd23f').c);
    const cw = 92;
    const ch = 130;
    const gap = 14;
    let shown = 0;
    pulls.forEach((pl, i) => {
      const x = W / 2 - ((pulls.length - 1) * (cw + gap)) / 2 + i * (cw + gap);
      const y = H / 2 + 4;
      // il retro della carta
      const back = s.add.container(x, y);
      const bg = s.add.graphics();
      bg.fillStyle(0x1a1222).fillRect(-cw / 2 - 1, -ch / 2 - 1, cw + 2, ch + 2);
      bg.fillStyle(0x2a2050).fillRect(-cw / 2, -ch / 2, cw, ch);
      bg.lineStyle(2, 0x8a3fd0).strokeRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10);
      back.add([bg, txt(s, 0, 0, '★', 24, '#8a3fd0')]);
      c.add(back);
      s.time.delayedCall(350 + i * 650, () => {
        s.tweens.add({
          targets: back,
          scaleX: 0,
          duration: 140,
          onComplete: () => {
            back.destroy();
            const card = drawStarCard(s, pl.card, levelOfCard(this.st, pl.card.id), x, y, cw, ch, 'owned');
            card.scaleX = 0;
            c.add(card);
            s.tweens.add({ targets: card, scaleX: 1, duration: 160 });
            const r = pl.card.rarity;
            if (r === 'leggenda' || r === 'oro') {
              sfx.fanfare();
              const glow = s.add.rectangle(x, y, cw + 16, ch + 16, RARITY_COLOR[r], 0.35);
              c.addAt(glow, 1);
              s.tweens.add({ targets: glow, alpha: 0.05, duration: 500, yoyo: true, repeat: -1 });
            } else sfx.select();
            c.add(txt(s, x, y + ch / 2 + 10, pl.isNew ? 'NUOVA!' : 'DOPPIONE', 6, pl.isNew ? '#5be37d' : '#3fd0ff'));
            c.add(txt(s, x, y - ch / 2 - 10, RARITY_NAME[r], 6, hex(RARITY_COLOR[r])));
            shown++;
            if (shown === pulls.length) {
              c.add(button(s, W / 2, H - 22, 150, 22, 'CONTINUA', () => {
                this.closeModal();
                this.rebuild();
              }, { size: 7, color: COLORS.good, textColor: '#1a1222' }).c);
            }
          },
        });
      });
    });
  }

  // ---------- torneo ----------

  private buildTournament() {
    const s = this.scene;
    const W = s.scale.width;
    const ok = lineupComplete(this.st);
    txt(s, 22, 118, ok ? `La tua squadra: forza ${teamRating(this.st)} · intesa ${chemistry(this.st).value}` : 'Completa la squadra (7 giocatori) per giocare.', 6, ok ? '#ffffff' : '#ff9a9a').setOrigin(0, 0.5);
    txt(s, W - 22, 118, `Turni vinti: ${this.st.rounds}/${STAR_ROUNDS.length}`, 6, '#ffd23f').setOrigin(1, 0.5);
    const g = s.add.graphics();
    STAR_ROUNDS.forEach((r, i) => {
      const y = 136 + i * 24;
      const done = i < this.st.rounds;
      const open = roundOpen(this.sv, this.st, i);
      const final = i === STAR_ROUNDS.length - 1;
      g.fillStyle(i % 2 ? 0x22253a : 0x262a42).fillRect(18, y - 11, W - 36, 22);
      g.fillStyle(done ? 0x5be37d : open ? COLORS.accent : 0x3a3d55).fillCircle(32, y, 8);
      txt(s, 32, y, String(i + 1), 6, done || open ? '#1a1222' : '#8a8fb0');
      const opp = final ? 'All Stars del Mondo' : rivalTeam(r.ep).name;
      txt(s, 48, y - 4, r.name.toUpperCase(), 6, final ? '#c06aff' : open || done ? '#ffffff' : '#6a6d88').setOrigin(0, 0.5);
      txt(s, 48, y + 6, `contro ${opp}`, 5, '#8a8fb0').setOrigin(0, 0.5);
      const rw = r.reward;
      const prize = `${rw.coins} monete · ${rw.pts} PL${rw.pack ? ` · ${PACKS.find((p) => p.id === rw.pack)!.name}` : ''}`;
      txt(s, W - 120, y, done ? 'VINTO (premio ridotto)' : prize, 5, done ? '#5be37d' : '#ffd23f').setOrigin(1, 0.5);
      if (open && ok) {
        button(s, W - 66, y, 76, 16, done ? 'RIGIOCA' : 'GIOCA', () => this.play(i), { size: 6, color: done ? 0x2f6fd0 : 0xe85a1a });
      } else {
        const why = this.sv.cleared < r.needs ? `STORIA EP.${r.needs}` : !open ? 'BLOCCATO' : 'SQUADRA?';
        txt(s, W - 66, y, why, 5, '#6a6d88');
      }
    });
  }

  private play(r: number) {
    const s = this.scene;
    if (isTouch()) goFullscreen();
    sfx.unlock();
    s.cameras.main.fadeOut(250, 10, 8, 20);
    s.cameras.main.once('camerafadeoutcomplete', () => s.scene.start('epic', { ep: STAR_ROUNDS[r].ep, stelle: r }));
  }
}

/** Battute prima di una partita del Torneo delle Stelle. */
export function starIntro(r: number): { who: string; text: string }[] {
  const def = STAR_ROUNDS[r];
  const final = r === STAR_ROUNDS.length - 1;
  return [
    { who: 'title', text: `TORNEO DELLE STELLE\n${def.name.toUpperCase()}` },
    final
      ? { who: 'telecronista', text: 'La finale! Da una parte la Squadra delle Stelle, dall\'altra i migliori rivali del mondo tutti insieme!' }
      : { who: 'telecronista', text: `Si torna in campo contro ${rivalTeam(def.ep).name}: stavolta sono ancora più forti!` },
    { who: 'maestro', text: 'Ricorda: le coppie che si conoscono si capiscono al volo. Usa l\'intesa e le tecniche dei tuoi campioni.' },
  ];
}

