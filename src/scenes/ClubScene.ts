import Phaser from 'phaser';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load, progressOf, save } from '../save/storage';
import { TEAMS } from '../data/teams';
import { FRAME, frameIndex, makePlayerSheet, type Dir, type Pose } from '../gfx/sprites';
import { sfx } from '../audio/sfx';
import { backToMenu } from './demo';
import { newAlbum, owned as ownedStickers } from '../modes/album';
import { DAILY_ALL_BONUS, dailyState, dailyText } from '../modes/daily';
import { newTotals, TROPHIES, trophyValue } from '../modes/trophies';
import {
  ballTint,
  buy,
  equip,
  equipped,
  isRival,
  kitVariant,
  LEVEL_XP,
  levelOf,
  MAX_LEVEL,
  PACK_PRICE,
  SHOP,
  SKILLS,
  type ShopCat,
  type ShopItem,
} from '../modes/progress';

type Tab = 'giocatori' | 'negozio' | 'sfide' | 'trofei' | 'rivali';

const ROLE_NAME = { GK: 'POR', DEF: 'DIF', MID: 'CEN', FWD: 'ATT' } as const;
const CAT_NAME: Record<ShopCat, string> = { pallone: 'PALLONI', maglia: 'MAGLIE', esultanza: 'ESULTANZE' };

/** Il tuo club: crescita dei giocatori, negozio con le monete, rivalità. */
export class ClubScene extends Phaser.Scene {
  private tab: Tab = 'giocatori';
  private cat: ShopCat = 'pallone';
  private teamIdx = 0;

  constructor() {
    super('club');
  }

  init(d?: { tab?: Tab }) {
    if (d?.tab) this.tab = d.tab;
    const id = load().settings.homeTeam;
    this.teamIdx = Math.max(0, TEAMS.findIndex((t) => t.id === id));
  }

  create() {
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  private rebuild() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    this.build();
  }

  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    const p = progressOf();
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.9).setOrigin(0).setInteractive();
    shadowTxt(this, W / 2, 16, 'IL TUO CLUB', 16, '#ffd23f');
    // monete
    const cg = this.add.graphics();
    panel(cg, W - 112, 6, 104, 20, 0x1b1d2e, 0x2e3250, 0.95);
    this.coinIcon(cg, W - 100, 16);
    txt(this, W - 16, 16, `${p.coins}`, 8, '#ffd23f').setOrigin(1, 0.5);

    const tabs: [Tab, string][] = [
      ['giocatori', 'GIOCATORI'],
      ['negozio', 'NEGOZIO'],
      ['sfide', 'SFIDE'],
      ['trofei', 'TROFEI'],
      ['rivali', 'RIVALI'],
    ];
    const daily = dailyState(p.daily);
    const left = daily.done.filter((x) => !x).length;
    tabs.forEach(([id, label], i) => {
      const b = button(this, W / 2 + (i - 2) * 104, 44, 98, 20, label, () => {
        this.tab = id;
        sfx.select();
        this.rebuild();
      }, { size: 6, badge: id === 'sfide' && left > 0 ? `${left}` : undefined });
      b.setSelected(this.tab === id);
    });

    if (this.tab === 'giocatori') this.buildPlayers();
    else if (this.tab === 'negozio') this.buildShop();
    else if (this.tab === 'sfide') this.buildDaily();
    else if (this.tab === 'trofei') this.buildTrophies();
    else this.buildRivals();

    button(this, 64, H - 24, 96, 26, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
  }

  private coinIcon(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x1a1222).fillRect(x - 5, y - 4, 10, 8).fillRect(x - 4, y - 5, 8, 10);
    g.fillStyle(0xffd23f).fillRect(x - 4, y - 3, 8, 6).fillRect(x - 3, y - 4, 6, 8);
    g.fillStyle(0xfff2a0).fillRect(x - 2, y - 2, 2, 3);
  }

  // ---------- giocatori ----------

  private buildPlayers() {
    const W = this.scale.width;
    const p = progressOf();
    const team = TEAMS[this.teamIdx];
    const shown = kitVariant(team, equipped(p, 'maglia'));
    const xp = p.xp[team.id] ?? [];
    const g = this.add.graphics();
    const pw = Math.min(W - 40, 600);
    const x0 = W / 2 - pw / 2;
    panel(g, x0, 60, pw, 252, 0x1b1d2e, 0x2e3250, 0.96);
    // squadra
    button(this, x0 + 18, 76, 20, 20, '<', () => this.pickTeam(-1), { size: 6 });
    button(this, x0 + pw - 18, 76, 20, 20, '>', () => this.pickTeam(1), { size: 6 });
    g.fillStyle(team.colors.shirt).fillRect(W / 2 - 80, 70, 8, 12);
    g.fillStyle(team.colors.shirt2).fillRect(W / 2 - 72, 70, 4, 12);
    txt(this, W / 2, 76, team.name.toUpperCase(), 8);
    txt(this, W / 2, 90, 'Crescono giocando: presenza, gol e vittorie', 6, '#8a8fb0');

    team.players.forEach((pd, i) => {
      const y = 112 + i * 39;
      const v = xp[i] ?? 0;
      const lv = levelOf(v);
      g.fillStyle(i % 2 ? 0x22253a : 0x262a42).fillRect(x0 + 6, y - 17, pw - 12, 36);
      const key = `club_${team.id}_${i}`;
      makePlayerSheet(this, key, shown, pd);
      this.add.sprite(x0 + 24, y + 4, key, frameIndex('down', 'idle')).setOrigin(0.5, 22 / FRAME).setScale(1.3);
      txt(this, x0 + 44, y - 8, `${ROLE_NAME[pd.role]}  ${pd.name}`, 6, '#ffffff').setOrigin(0, 0.5);
      // livello: quadratini pieni
      for (let k = 0; k < MAX_LEVEL; k++) {
        g.fillStyle(0x1a1222).fillRect(x0 + 44 + k * 10, y + 1, 8, 8);
        g.fillStyle(k < lv ? 0xffd23f : 0x3a3d55).fillRect(x0 + 45 + k * 10, y + 2, 6, 6);
      }
      // barra verso il prossimo livello
      const bx = x0 + 100;
      const bw = 70;
      g.fillStyle(0x1a1222).fillRect(bx, y + 2, bw, 6);
      if (lv < MAX_LEVEL) {
        const k = (v - LEVEL_XP[lv - 1]) / (LEVEL_XP[lv] - LEVEL_XP[lv - 1]);
        g.fillStyle(0x3fd0ff).fillRect(bx + 1, y + 3, Math.round((bw - 2) * k), 4);
        txt(this, bx + bw + 4, y + 5, `LV ${lv}`, 6, '#8a8fb0').setOrigin(0, 0.5);
      } else {
        g.fillStyle(0xffd23f).fillRect(bx + 1, y + 3, bw - 2, 4);
        txt(this, bx + bw + 4, y + 5, 'MAX', 6, '#ffd23f').setOrigin(0, 0.5);
      }
      // abilità
      const sx = x0 + pw - 6 - 160;
      SKILLS[pd.role].forEach((s, j) => {
        const need = j === 0 ? 3 : 5;
        const on = lv >= need;
        const yy = y - 8 + j * 15;
        txt(this, sx, yy, on ? `+ ${s.name}` : `LV${need} ${s.name}`, 6, on ? '#ff7ab8' : '#4a4e6a').setOrigin(0, 0.5);
      });
    });
  }

  private pickTeam(d: number) {
    this.teamIdx = (this.teamIdx + d + TEAMS.length) % TEAMS.length;
    sfx.select();
    this.rebuild();
  }

  // ---------- negozio ----------

  private buildShop() {
    const W = this.scale.width;
    const H = this.scale.height;
    const p = progressOf();
    (Object.keys(CAT_NAME) as ShopCat[]).forEach((c, i) => {
      const b = button(this, W / 2 + (i - 1) * 110, 72, 100, 18, CAT_NAME[c], () => {
        this.cat = c;
        sfx.select();
        this.rebuild();
      }, { size: 6, color: 0x2e3250 });
      b.setSelected(this.cat === c);
    });
    const items = SHOP.filter((it) => it.cat === this.cat);
    const cols = 3;
    const cw = Math.min(176, (W - 40) / cols - 8);
    const ch = 96;
    items.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = W / 2 + (col - 1) * (cw + 8);
      const y = 140 + row * (ch + 8);
      this.shopCard(it, x, y, cw, ch, p.owned.includes(it.id), p.equip[it.cat] === it.id, p.coins);
    });
    // pacchetto di figurine
    const canPack = p.coins >= PACK_PRICE;
    button(this, W - 108, H - 24, 190, 26, `PACCHETTO FIGURINE · ${PACK_PRICE}`, () => {
      if (progressOf().coins < PACK_PRICE) return;
      save((s) => {
        s.progress!.coins -= PACK_PRICE;
        s.album = s.album ?? newAlbum();
        s.album.packs++;
      });
      sfx.coin();
      this.rebuild();
      this.toast('+1 pacchetto: aprilo dall\'ALBUM');
    }, { size: 6, color: canPack ? 0xc08a1a : 0x3a3d55 }).setEnabled(canPack);
  }

  private shopCard(it: ShopItem, x: number, y: number, w: number, h: number, owned: boolean, inUse: boolean, coins: number) {
    const g = this.add.graphics();
    panel(g, x - w / 2, y - h / 2, w, h, inUse ? 0x2a3a2e : 0x1b1d2e, inUse ? 0x5be37d : 0x2e3250, 0.97);
    this.preview(it, x - w / 2 + 28, y - 12);
    txt(this, x - w / 2 + 54, y - h / 2 + 12, it.name.toUpperCase(), 6, '#ffffff').setOrigin(0, 0.5);
    txt(this, x - w / 2 + 54, y - h / 2 + 24, it.desc, 6, '#8a8fb0', { wordWrap: { width: w - 60 }, lineSpacing: 3 }).setOrigin(0, 0);
    let label: string;
    let color: number;
    let enabled = true;
    if (inUse) {
      label = 'IN USO';
      color = 0x2f6a40;
      enabled = false;
    } else if (owned) {
      label = 'USA';
      color = 0x2f6fd0;
    } else {
      label = `COMPRA · ${it.price}`;
      color = coins >= it.price ? COLORS.good : 0x3a3d55;
      enabled = coins >= it.price;
    }
    const b = button(this, x, y + h / 2 - 16, w - 20, 18, label, () => {
      let ok = false;
      save((s) => {
        const pr = s.progress!;
        ok = owned ? equip(pr, it.id) : buy(pr, it.id);
      });
      if (!ok) return;
      if (owned) sfx.select();
      else sfx.coin();
      this.rebuild();
    }, { size: 6, color, textColor: color === COLORS.good ? '#1a1222' : '#ffffff' });
    b.setEnabled(enabled);
    if (inUse) b.label.setColor('#5be37d');
  }

  /** Anteprima animata dell'oggetto. */
  private preview(it: ShopItem, x: number, y: number) {
    const skin = it.id.split(':')[1];
    if (it.cat === 'pallone') {
      const b = this.add.sprite(x, y + 6, 'ball', 0).setScale(3);
      const t0 = this.time.now;
      const tint = () => {
        const c = ballTint(skin, (this.time.now - t0) / 1000);
        if (c === null) b.clearTint();
        else b.setTint(c);
      };
      tint();
      let f = 0;
      this.time.addEvent({ delay: 90, loop: true, callback: () => {
        b.setFrame((f = (f + 1) % 4));
        tint();
      } });
      return;
    }
    const team = TEAMS[this.teamIdx];
    const pd = team.players[team.players.length - 1];
    const kit = it.cat === 'maglia' ? skin : equipped(progressOf(), 'maglia');
    const key = `shop_${team.id}_${kit}`;
    if (!this.textures.exists(key)) makePlayerSheet(this, key, kitVariant(team, kit), pd);
    const spr = this.add.sprite(x, y + 14, key, frameIndex('down', it.cat === 'maglia' ? 'idle' : 'celebrate')).setOrigin(0.5, 22 / FRAME).setScale(2);
    if (it.cat === 'maglia') return;
    const set = (d: Dir, pose: Pose, flip = false) => spr.setFrame(frameIndex(d, pose)).setFlipX(flip);
    switch (skin) {
      case 'salto':
        this.tweens.add({ targets: spr, y: y + 4, duration: 220, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
        break;
      case 'capriola':
        spr.setOrigin(0.5, 0.5).setY(y);
        this.tweens.add({ targets: spr, angle: 360, duration: 900, repeat: -1, repeatDelay: 500 });
        this.tweens.add({ targets: spr, y: y - 10, duration: 450, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Sine.easeOut' });
        break;
      case 'scivolata': {
        let on = false;
        this.time.addEvent({ delay: 900, loop: true, callback: () => {
          on = !on;
          set(on ? 'side' : 'down', on ? 'slide' : 'celebrate');
        } });
        break;
      }
      case 'aeroplano': {
        set('side', 'celebrate');
        this.tweens.add({ targets: spr, angle: { from: -18, to: 18 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'trottola': {
        const seq: [Dir, boolean][] = [['down', false], ['side', false], ['up', false], ['side', true]];
        let k = 0;
        this.time.addEvent({ delay: 80, loop: true, callback: () => {
          const [d, fl] = seq[(k = (k + 1) % 4)];
          set(d, 'celebrate', fl);
        } });
        break;
      }
    }
  }

  private toast(s: string) {
    const W = this.scale.width;
    const t = txt(this, W / 2, 300, s, 6, '#1a1222', { backgroundColor: '#ffd23f', padding: { x: 4, y: 3 } }).setDepth(10);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }

  // ---------- sfide del giorno ----------

  private buildDaily() {
    const W = this.scale.width;
    const p = progressOf();
    const d = dailyState(p.daily);
    const g = this.add.graphics();
    const pw = Math.min(W - 40, 520);
    const x0 = W / 2 - pw / 2;
    panel(g, x0, 60, pw, 252, 0x1b1d2e, 0x2e3250, 0.96);
    txt(this, W / 2, 78, 'SFIDE DI OGGI', 8, '#ffd23f');
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const h = Math.max(1, Math.ceil((mid.getTime() - now.getTime()) / 3600000));
    txt(this, W / 2, 94, `Valgono tutte le modalità · nuove sfide tra ${h} or${h === 1 ? 'a' : 'e'}`, 6, '#8a8fb0');
    d.list.forEach((c, i) => {
      const y = 128 + i * 46;
      const done = d.done[i];
      g.fillStyle(done ? 0x24402e : 0x262a42).fillRect(x0 + 12, y - 18, pw - 24, 38);
      // casella
      g.fillStyle(0x1a1222).fillRect(x0 + 24, y - 7, 14, 14);
      g.fillStyle(done ? 0x5be37d : 0x3a3d55).fillRect(x0 + 26, y - 5, 10, 10);
      txt(this, x0 + 50, y - 6, dailyText(c), 8, done ? '#5be37d' : '#ffffff').setOrigin(0, 0.5);
      const bw = 160;
      g.fillStyle(0x1a1222).fillRect(x0 + 50, y + 6, bw, 6);
      g.fillStyle(done ? 0x5be37d : 0x3fd0ff).fillRect(x0 + 51, y + 7, Math.round((bw - 2) * (d.got[i] / c.n)), 4);
      txt(this, x0 + 56 + bw, y + 9, `${d.got[i]}/${c.n}`, 6, '#8a8fb0').setOrigin(0, 0.5);
      this.coinIcon(g, x0 + pw - 70, y);
      txt(this, x0 + pw - 58, y, done ? 'PRESO' : `+${c.reward}`, 6, done ? '#5be37d' : '#ffd23f').setOrigin(0, 0.5);
    });
    const all = d.done.every(Boolean);
    txt(this, W / 2, 280, all ? 'Tutte fatte! Torna domani per le nuove.' : `Completale tutte e tre: +${DAILY_ALL_BONUS} monete in più`, 6, all ? '#5be37d' : '#ffd23f');
  }

  // ---------- trofei ----------

  private buildTrophies() {
    const W = this.scale.width;
    const p = progressOf();
    const sv = load();
    const have = p.trophies ?? [];
    const ctx = {
      totals: p.totals ?? newTotals(),
      cups: sv.trophies ?? 0,
      stickers: sv.album ? ownedStickers(sv.album) : 0,
      maxLevelPlayers: Object.values(p.xp).flat().filter((x) => levelOf(x) >= MAX_LEVEL).length,
    };
    const g = this.add.graphics();
    const pw = Math.min(W - 20, 640);
    const x0 = W / 2 - pw / 2;
    panel(g, x0, 60, pw, 252, 0x1b1d2e, 0x2e3250, 0.96);
    txt(this, W / 2, 72, `BACHECA  ${have.length}/${TROPHIES.length}`, 8, '#ffd23f');
    const cols = 3;
    const cw = (pw - 16) / cols;
    const rows = Math.ceil(TROPHIES.length / cols);
    const rh = Math.min(26, (252 - 32) / rows);
    TROPHIES.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = x0 + 8 + col * cw;
      const y = 86 + row * rh + rh / 2;
      const got = have.includes(t.id);
      g.fillStyle(got ? 0x3a2a14 : (row + col) % 2 ? 0x22253a : 0x262a42).fillRect(x + 1, y - rh / 2 + 1, cw - 2, rh - 2);
      // coppetta
      const c = got ? 0xffd23f : 0x3a3d55;
      g.fillStyle(c).fillRect(x + 6, y - 5, 8, 5).fillRect(x + 9, y, 2, 3).fillRect(x + 7, y + 3, 6, 2);
      txt(this, x + 20, y - 4, t.name, 6, got ? '#ffd23f' : '#d8dcf0').setOrigin(0, 0.5);
      const v = Math.min(t.n, trophyValue(t, ctx));
      txt(this, x + 20, y + 5, t.desc, 6, got ? '#a08a50' : '#6a6e90', { fontSize: '5px' }).setOrigin(0, 0.5);
      if (!got) {
        txt(this, x + cw - 6, y - 4, `+${t.reward}`, 6, '#8a7a40').setOrigin(1, 0.5);
        txt(this, x + cw - 6, y + 5, `${v}/${t.n}`, 6, '#6a6e90', { fontSize: '5px' }).setOrigin(1, 0.5);
      }
    });
  }

  // ---------- rivali ----------

  private buildRivals() {
    const W = this.scale.width;
    const p = progressOf();
    const g = this.add.graphics();
    const pw = Math.min(W - 40, 520);
    const x0 = W / 2 - pw / 2;
    panel(g, x0, 60, pw, 252, 0x1b1d2e, 0x2e3250, 0.96);
    txt(this, W / 2, 74, 'Chi ti batte due volte più di quante lo batti diventa RIVALE.', 6, '#8a8fb0');
    txt(this, W / 2, 86, 'Contro una rivale le monete della vittoria sono doppie.', 6, '#8a8fb0');
    const cols = ['V', 'P', 'S'];
    cols.forEach((c, i) => txt(this, x0 + pw - 150 + i * 34, 102, c, 6, '#8a8fb0'));
    const list = TEAMS.map((t) => ({ t, r: p.vs[t.id] ?? { w: 0, d: 0, l: 0 } }))
      .sort((a, b) => b.r.l - b.r.w - (a.r.l - a.r.w));
    list.forEach(({ t, r }, i) => {
      const y = 118 + i * 23;
      const rival = isRival(p, t.id);
      g.fillStyle(rival ? 0x3a1a24 : i % 2 ? 0x22253a : 0x262a42).fillRect(x0 + 6, y - 10, pw - 12, 21);
      g.fillStyle(t.colors.shirt).fillRect(x0 + 14, y - 5, 8, 10);
      g.fillStyle(t.colors.shirt2).fillRect(x0 + 22, y - 5, 3, 10);
      txt(this, x0 + 34, y, t.name, 6, '#ffffff').setOrigin(0, 0.5);
      if (rival) txt(this, x0 + pw - 200, y, 'RIVALE', 6, '#1a1222', { backgroundColor: '#ff5a5a', padding: { x: 3, y: 2 } });
      [r.w, r.d, r.l].forEach((v, j) => txt(this, x0 + pw - 150 + j * 34, y, `${v}`, 6, j === 0 ? '#5be37d' : j === 2 ? '#ff9a9a' : '#d8dcf0'));
    });
  }
}
