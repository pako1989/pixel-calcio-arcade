import Phaser from 'phaser';
import { arrow, button, COLORS, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { load, save } from '../save/storage';
import { frameIndex, makePlayerSheet } from '../gfx/sprites';
import { PITCHES } from '../data/pitches';
import type { Difficulty, MatchResult, PlayerDef, TeamDef } from '../sim/types';
import type { MatchLaunch } from '../modes/modes';
import { askName } from '../ui/nameInput';
import { backToMenu, fixKits, startMatch } from './demo';
import { sfx } from '../audio/sfx';
import {
  autoLineup, buy, buyPrice, canBuy, canSell, CLUB_KITS, clubOf, clubRating, clubTeamDef, DIVISIONS,
  FORMATION_ORDER, FORMATIONS, matchConditions, matchPitch, ME, minuteOf, money, myTeamDef, newManager,
  opponentOf, playerOvr, playerValue, potOvr, ROLE_LABEL, sell, sellPrice, SIM_DURATION, simulateMyMatch, STADIUM_LEVELS,
  STAT_KEYS, STAT_LABEL, swapPlayers, table, teamRating, TRAINING_LEVELS, TRAINING_ORDER, TRAININGS, upgrade, upgradeCost,
  weeklyBalance, boardLabel, canSignSponsor, renewContract, renewCost, signSponsor, sponsorWeekly, SPONSOR_OFFERS,
  type ManagerState, type MPlayer,
  applyMatch, CUP_ROUNDS, cupTeams, ensureManager, nextMatch, resolveEvent, type MatchApplied,
  canPromote, dismissStaff, gazzetta, hireStaff, promoteCost, promoteProspect, staffUpgrade,
} from '../modes/manager';
import { potentialLabel, STAFF_INFO, STAFF_MAX, STAFF_ROLES, staffWage } from '../modes/managerStaff';
import { WEATHER_INFO } from '../data/weather';

const DIFFS: Difficulty[] = ['facile', 'normale', 'difficile'];
type Tab = 'club' | 'rosa' | 'mercato' | 'allena' | 'classifica' | 'societa' | 'dirigenza' | 'staff' | 'stampa';
const TABS: { id: Tab; label: string }[] = [
  { id: 'club', label: 'CLUB' },
  { id: 'rosa', label: 'ROSA' },
  { id: 'mercato', label: 'MERCATO' },
  { id: 'allena', label: 'ALLENA' },
  { id: 'classifica', label: 'CLASSIFICA' },
  { id: 'societa', label: 'SOCIETÀ' },
  { id: 'dirigenza', label: 'DIRIGENZA' },
  { id: 'staff', label: 'STAFF' },
  { id: 'stampa', label: 'GIORNALE' },
];

/** Esito di una partita simulata, mostrato con la "cronaca" animata. */
interface SimShow {
  result: MatchResult;
  applied: MatchApplied;
  label: string;
  /** Occasioni mancate (cronaca). */
  chances: { min: number; text: string; mine: boolean }[];
  home: boolean;
  oppName: string;
  oppColor: number;
  t: number;
  done: boolean;
}

/** Modalità MANAGER: il club, la rosa, il mercato, la classifica e le partite. */
export class ManagerScene extends Phaser.Scene {
  private tab: Tab = 'club';
  private sel: number | null = null;
  private mktSel: number | null = null;
  private confirm: string | null = null;
  // creazione del club
  private draftName = 'Sporting Borgo';
  private draftKit = 0;
  private draftDiff: Difficulty = 'normale';
  private sim: SimShow | null = null;
  private simLayer?: Phaser.GameObjects.Container;
  /** Pulsante della cronaca (creato una volta per fase, così il tocco non si perde). */
  private simBtn?: { c: Phaser.GameObjects.Container; done: boolean };
  private simTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('manager');
  }

  create() {
    const d = load().settings.difficulty as Difficulty;
    this.draftDiff = DIFFS.includes(d) ? d : 'normale';
    this.tab = 'club';
    this.sel = null;
    this.mktSel = null;
    this.confirm = null;
    this.sim = null;
    this.cameras.main.fadeIn(200, 10, 8, 20);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.build, this);
      this.simTimer?.remove();
    });
  }

  private st(): ManagerState | undefined {
    const m = load().manager;
    return m && ensureManager(m);
  }

  private commit(mut?: (st: ManagerState) => void) {
    save((s) => {
      if (s.manager && mut) mut(s.manager);
    });
    this.build();
  }

  private build() {
    this.children.removeAll(true);
    this.simLayer = undefined;
    this.simBtn = undefined;
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.9).setOrigin(0).setInteractive();
    const st = this.st();
    if (!st) {
      this.buildCreate(W, H);
      return;
    }
    if (this.sim) {
      this.drawSim();
      return;
    }
    this.buildHeader(st, W);
    switch (this.tab) {
      case 'club':
        this.buildClub(st, W, H);
        break;
      case 'rosa':
        this.buildSquad(st, W, H);
        break;
      case 'mercato':
        this.buildMarket(st, W, H);
        break;
      case 'allena':
        this.buildTraining(st, W, H);
        break;
      case 'classifica':
        this.buildTable(st, W, H);
        break;
      case 'societa':
        this.buildSociety(st, W, H);
        break;
      case 'dirigenza':
        this.buildBoard(st, W, H);
        break;
      case 'staff':
        this.buildStaff(st, W, H);
        break;
      case 'stampa':
        this.buildStampa(st, W, H);
        break;
    }
    this.buildFooter(st, W, H);
    if (st.seasonEnd) this.buildSeasonEnd(st, W, H);
    else if (st.event) this.buildEvent(st, W, H);
    if (this.toast) {
      const t = txt(this, W / 2, H - 52, this.toast, 6, '#1a1222', { backgroundColor: '#ffd23f', padding: { x: 6, y: 4 } }).setDepth(40);
      this.toast = null;
      this.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 400 });
    }
  }

  private toast: string | null = null;

  // ------------------------------------------------------------ eventi
  private buildEvent(st: ManagerState, W: number, H: number) {
    const ev = st.event!;
    const c = this.add.container(0, 0).setDepth(20);
    const g = this.add.graphics();
    c.add([this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.85).setOrigin(0).setInteractive(), g]);
    const pw = Math.min(W - 40, 420);
    panel(g, W / 2 - pw / 2, 50, pw, 250, 0x1b1d2e, COLORS.accent2, 0.98);
    c.add(txt(this, W / 2, 68, 'NOTIZIA DAL CLUB', 6, '#3fd0ff'));
    c.add(shadowTxt(this, W / 2, 90, ev.title, 16, '#ffd23f').c);
    c.add(txt(this, W / 2, 132, ev.text, 8, '#ffffff', { wordWrap: { width: pw - 40 }, align: 'center', lineSpacing: 6 }));
    ev.options.forEach((o, i) => {
      const x = W / 2 + (i === 0 ? -pw / 4 : pw / 4);
      const b = button(this, x, 230, pw / 2 - 30, 30, o.label, () => {
        let out = '';
        save((s) => {
          if (s.manager) out = resolveEvent(s.manager, i);
        });
        sfx.select();
        this.toast = out || null;
        this.build();
      }, { color: i === 0 ? COLORS.good : 0x3a3d55, textColor: i === 0 ? '#1a1222' : '#ffffff' });
      c.add(b.c);
      c.add(txt(this, x, 258, o.desc, 6, '#8a8fb0', { wordWrap: { width: pw / 2 - 30 }, align: 'center' }));
    });
  }

  // ------------------------------------------------------------ creazione
  private buildCreate(W: number, H: number) {
    shadowTxt(this, W / 2, 20, 'FONDA IL TUO CLUB', 16, '#ffd23f');
    txt(this, W / 2, 40, 'Dal campetto di quartiere alla Serie Pixel: rosa, mercato, soldi e partite.', 6, '#d8dcf0');
    const g = this.add.graphics();
    const px = W / 2 - 140;
    panel(g, px - 80, 58, 160, 200, 0x1b1d2e, 0x2e3250, 0.92);
    const kit = CLUB_KITS[this.draftKit];
    const team: TeamDef = { id: 'prev', name: this.draftName, short: 'PRE', colors: kit.colors, pattern: kit.pattern, players: [], stars: 1 };
    const looks = [
      { skin: 1, hair: 0, hairStyle: 0 },
      { skin: 3, hair: 3, hairStyle: 1 },
      { skin: 0, hair: 2, hairStyle: 2 },
    ];
    looks.forEach((look, i) => {
      const pd: PlayerDef = { name: '', number: [8, 9, 4][i], role: 'MID', stats: { speed: 1, shot: 1, pass: 1, tackle: 1, control: 1, keeping: 1 }, look };
      makePlayerSheet(this, `mgr_kit_${i}`, team, pd);
      const img = this.add.image(px - 40 + i * 40, 190 - (i === 1 ? 8 : 0), `mgr_kit_${i}`, frameIndex('down', i === 1 ? 'celebrate' : 'idle')).setScale(3).setOrigin(0.5, 1);
      if (i === 1) this.tweens.add({ targets: img, y: img.y - 4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    txt(this, px, 214, this.draftName.toUpperCase(), 8, '#ffffff');
    txt(this, px, 232, 'LEGA DI QUARTIERE', 6, '#8a8fb0');

    const rx = W / 2 + 80;
    txt(this, rx - 120, 80, 'NOME', 6, '#8a8fb0').setOrigin(0, 0.5);
    button(this, rx + 30, 80, 150, 24, this.draftName.toUpperCase().slice(0, 16), () => {
      askName(this.draftName, 16, 'NOME DEL CLUB').then((n) => {
        if (n) this.draftName = n;
        this.build();
      });
    }, { size: 6 });
    txt(this, rx - 120, 124, 'COLORI', 6, '#8a8fb0').setOrigin(0, 0.5);
    arrow(this, rx - 30, 124, -1, () => this.cycleKit(-1));
    arrow(this, rx + 90, 124, 1, () => this.cycleKit(1));
    g.fillStyle(0x1a1222).fillRect(rx + 2, 112, 56, 24);
    g.fillStyle(kit.colors.shirt).fillRect(rx + 4, 114, 26, 20);
    g.fillStyle(kit.colors.shirt2).fillRect(rx + 30, 114, 26, 20);
    txt(this, rx - 120, 168, 'CPU', 6, '#8a8fb0').setOrigin(0, 0.5);
    const bs: Button[] = [];
    DIFFS.forEach((d, i) => {
      const b = button(this, rx - 48 + i * 66, 168, 60, 22, d.toUpperCase(), () => {
        this.draftDiff = d;
        bs.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(d === this.draftDiff);
      bs.push(b);
    });
    txt(this, rx + 30, 196, 'La CPU conta solo nelle partite giocate.', 6, '#8a8fb0');
    txt(this, rx + 30, 212, 'Le simulate dipendono dalla tua rosa.', 6, '#8a8fb0');

    button(this, 64, H - 28, 96, 28, 'INDIETRO', () => backToMenu(this), { color: 0x3a3d55 });
    const go = button(this, W - 100, H - 30, 170, 34, 'FONDA IL CLUB', () => {
      const st = newManager(this.draftName, this.draftKit, this.draftDiff);
      save((s) => {
        s.manager = st;
        s.settings.difficulty = this.draftDiff;
      });
      sfx.fanfare();
      this.build();
    }, { color: COLORS.good, size: 8, textColor: '#1a1222' });
    this.tweens.add({ targets: go.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private cycleKit(d: number) {
    this.draftKit = (this.draftKit + d + CLUB_KITS.length) % CLUB_KITS.length;
    sfx.select();
    this.build();
  }

  // ------------------------------------------------------------ cornice
  private buildHeader(st: ManagerState, W: number) {
    const g = this.add.graphics();
    g.fillStyle(0x1b1d2e, 1).fillRect(0, 0, W, 24);
    g.fillStyle(st.club.colors.shirt).fillRect(6, 5, 6, 14);
    g.fillStyle(st.club.colors.shirt2).fillRect(12, 5, 3, 14);
    txt(this, 22, 12, st.club.name.toUpperCase(), 8, '#ffffff').setOrigin(0, 0.5);
    txt(this, W / 2 + 40, 12, `${DIVISIONS[st.division].name} · STAGIONE ${st.season}`, 6, '#3fd0ff');
    txt(this, W - 8, 12, money(st.budget), 8, st.budget < 0 ? '#ff5a5a' : '#ffd23f').setOrigin(1, 0.5);
    const tw = Math.floor((W - 12) / TABS.length);
    TABS.forEach((t, i) => {
      const b = button(this, 6 + tw * i + tw / 2, 38, tw - 6, 18, t.label, () => {
        this.tab = t.id;
        this.confirm = null;
        sfx.select();
        this.build();
      }, { size: tw < 70 ? 5 : 6, color: 0x2a2d48 });
      b.setSelected(this.tab === t.id);
    });
  }

  private buildFooter(st: ManagerState, W: number, H: number) {
    button(this, 40, H - 20, 64, 26, 'MENU', () => backToMenu(this), { color: 0x3a3d55, size: 6 });
    const nm = nextMatch(st);
    if (!nm) return;
    const opp = nm.opp;
    const home = nm.home;
    txt(this, W / 2 - 52, H - 26, nm.cup ? nm.label : `GIORNATA ${st.week + 1}/${st.fixtures.length}`, 6, nm.cup ? '#ffd23f' : '#8a8fb0');
    txt(this, W / 2 - 52, H - 13, `${home ? 'IN CASA' : 'FUORI'} vs ${opp.short}`, 6, '#ffffff');
    button(this, W - 178, H - 20, 92, 26, 'SIMULA', () => this.simulate(), { color: 0x2f6fd0, size: 8 });
    const play = button(this, W - 60, H - 20, 104, 26, 'GIOCA!', () => this.play(), { color: COLORS.good, size: 8, textColor: '#1a1222' });
    if (this.tab === 'club') this.tweens.add({ targets: play.c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, v: number, color: number) {
    g.fillStyle(0x0d0a1a).fillRect(x, y, w, h);
    g.fillStyle(color).fillRect(x, y, Math.round(w * Phaser.Math.Clamp(v, 0, 1)), h);
  }

  private ovrColor(o: number): string {
    return o >= 75 ? '#ffd23f' : o >= 62 ? '#5be37d' : o >= 50 ? '#3fd0ff' : o >= 40 ? '#d8dcf0' : '#8a8fb0';
  }

  // ------------------------------------------------------------ CLUB
  private buildClub(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(300, W * 0.48);
    panel(g, 8, top, lw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    const opp = opponentOf(st);
    const cx = 8 + lw / 2;
    if (opp) {
      const nm = nextMatch(st)!;
      const home = nm.home;
      if (nm.cup) {
        g.fillStyle(0x4a3a10).fillRect(10, top + 4, lw - 4, 16);
        txt(this, cx, top + 12, `${st.cup!.name} · ${CUP_ROUNDS[st.cup!.round]}`, 6, '#ffd23f');
      } else txt(this, cx, top + 12, `PROSSIMA PARTITA · ${home ? 'IN CASA' : 'IN TRASFERTA'}`, 6, '#ffd23f');
      const me = myTeamDef(st);
      const ot = clubTeamDef(st, opp);
      const p1 = me.players[me.players.length - 1];
      const p2 = ot.players[4];
      if (p1) {
        makePlayerSheet(this, 'mgr_me', me, p1);
        this.add.image(cx - 70, top + 92, 'mgr_me', frameIndex('side', 'idle')).setScale(3).setOrigin(0.5, 1);
      }
      makePlayerSheet(this, 'mgr_opp', fixKits(me, ot), p2);
      this.add.image(cx + 70, top + 92, 'mgr_opp', frameIndex('side', 'idle')).setScale(3).setOrigin(0.5, 1).setFlipX(true);
      shadowTxt(this, cx, top + 66, 'VS', 16, '#ffffff');
      txt(this, cx - 70, top + 100, st.club.short, 8, '#ffffff');
      txt(this, cx + 70, top + 100, opp.short, 8, '#ffffff');
      txt(this, cx, top + 114, opp.name.toUpperCase(), 6, '#d8dcf0');
      const mr = teamRating(st);
      const or = clubRating(st, opp);
      txt(this, cx - 70, top + 130, `FORZA ${mr}`, 6, mr >= or ? '#5be37d' : '#ff9a9a');
      txt(this, cx + 70, top + 130, `FORZA ${or}`, 6, '#d8dcf0');
      this.bar(g, cx - 100, top + 138, 60, 4, mr / 99, COLORS.good);
      this.bar(g, cx + 40, top + 138, 60, 4, or / 99, COLORS.bad);
      const row = table(st).findIndex((r) => r.id === opp.id) + 1;
      txt(this, cx, top + 152, nm.cup ? (row > 0 ? `Avversario ${row}° nel tuo campionato` : 'Eliminazione diretta: pari = rigori!') : `Avversario ${row}° in classifica`, 6, nm.cup ? '#ffd23f' : '#8a8fb0');
      const pitch = PITCHES[matchPitch(st)];
      const cond = matchConditions(st);
      const extra = [cond.weather !== 'sereno' ? WEATHER_INFO[cond.weather].name : '', cond.night && pitch.id !== 'tetto' ? 'Notte' : ''].filter(Boolean).join(', ');
      txt(this, cx, top + 166, `Campo: ${pitch.name}${extra ? ` (${extra})` : ''}`, 6, '#3fd0ff');
      const tired = st.lineup.map((id) => st.squad.find((p) => p.id === id)).filter((p) => p && p.energy < 50);
      const injured = st.squad.filter((p) => p.injured).length;
      if (injured) txt(this, cx, top + 182, `${injured} infortunat${injured === 1 ? 'o' : 'i'} · ${tired.length} stanchi`, 6, '#ff9a9a');
      else if (tired.length) txt(this, cx, top + 182, `${tired.length} titolari stanchi: guarda la ROSA`, 6, '#ff9a9a');
      else txt(this, cx, top + 182, 'Squadra in forma.', 6, '#5be37d');
      txt(this, cx, top + 198, 'GIOCA: la partita la giochi tu.', 6, '#8a8fb0');
      txt(this, cx, top + 210, 'SIMULA: decide la tua rosa.', 6, '#8a8fb0');
    }
    // notizie
    const nx = 16 + lw;
    const nw = W - nx - 8;
    panel(g, nx, top, nw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    const pos = table(st).findIndex((r) => r.id === ME) + 1;
    txt(this, nx + 10, top + 12, st.week === 0 ? 'CLASSIFICA: -' : `CLASSIFICA: ${pos}°`, 8, pos <= 2 ? '#5be37d' : pos >= 7 && st.division > 0 ? '#ff5a5a' : '#ffffff').setOrigin(0, 0.5);
    txt(this, nx + nw - 10, top + 12, `TIFOSI ${st.fans}`, 6, '#8a8fb0').setOrigin(1, 0.5);
    if (st.objective) {
      txt(this, nx + 10, top + 28, `OBIETTIVO: ${st.objective.label}`, 6, st.week > 0 && pos <= st.objective.pos ? '#5be37d' : '#ff9a9a').setOrigin(0, 0.5);
    }
    txt(this, nx + 10, top + 46, 'NOTIZIE', 6, '#ffd23f').setOrigin(0, 0.5);
    let y = top + 58;
    for (const n of st.news.slice(0, 9)) {
      const t = txt(this, nx + 10, y, `· ${n}`, 6, '#d8dcf0', { wordWrap: { width: nw - 20 }, lineSpacing: 3 }).setOrigin(0, 0);
      y += t.height + 6;
      if (y > H - 60) {
        t.destroy();
        break;
      }
    }
  }

  // ------------------------------------------------------------ ROSA e MERCATO
  private playerRow(
    g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, p: MPlayer, opts: { slot?: string; selected: boolean; price?: number; dim?: boolean },
    onTap: () => void,
  ) {
    const h = 20;
    g.fillStyle(opts.selected ? 0x4a3f80 : opts.slot ? 0x262a44 : 0x1e2034).fillRect(x, y, w, h - 2);
    if (opts.selected) g.lineStyle(1, COLORS.accent).strokeRect(x, y, w, h - 2);
    const cy = y + h / 2 - 1;
    const slot = opts.slot ?? (opts.price !== undefined ? ROLE_LABEL[p.role] : '');
    if (slot) {
      g.fillStyle(slot === 'POR' ? 0xc08a1a : slot === 'DIF' ? 0x2f6fd0 : slot === 'CEN' ? 0x2f9a50 : 0xc8302a).fillRect(x + 2, y + 2, 26, h - 6);
      txt(this, x + 15, cy, slot, 6, '#ffffff');
    } else if (opts.price === undefined) txt(this, x + 15, cy, 'RIS', 6, '#5a5f80');
    const mkt = opts.price !== undefined;
    if (!mkt) txt(this, x + 34, cy, `${p.number}`, 6, '#8a8fb0').setOrigin(0, 0.5);
    const off = mkt ? 30 : 0;
    txt(this, x + (mkt ? 36 : 54), cy, p.name.toUpperCase().slice(0, 11), 6, opts.dim ? '#6a6d80' : '#ffffff').setOrigin(0, 0.5);
    if (opts.price === undefined) txt(this, x + 132, cy, ROLE_LABEL[p.role], 6, slot && slot !== ROLE_LABEL[p.role] ? '#ff9a9a' : '#8a8fb0').setOrigin(0, 0.5);
    txt(this, x + 162 - off + 30, cy, `${p.age}`, 6, '#d8dcf0').setOrigin(0, 0.5);
    const o = playerOvr(p);
    txt(this, x + 194 - off + 30, cy, `${o}`, 8, this.ovrColor(o)).setOrigin(0, 0.5);
    if (opts.price !== undefined) {
      txt(this, x + w - 6, cy, money(opts.price), 6, opts.dim ? '#ff9a9a' : '#ffd23f').setOrigin(1, 0.5);
      if (p.loan) txt(this, x + w - 74, cy, 'PREST.', 6, '#3fd0ff').setOrigin(1, 0.5);
    } else {
      // energia e morale (o infortunio)
      const ex = x + w - 56;
      if (p.injured) {
        g.fillStyle(0xc8302a).fillRect(ex - 2, cy - 6, 50, 11);
        txt(this, ex + 23, cy, `INF ${p.injured}s`, 6, '#ffffff');
      } else {
      this.bar(g, ex, cy - 4, 30, 3, p.energy / 100, p.energy < 45 ? COLORS.bad : p.energy < 70 ? COLORS.accent : COLORS.good);
      this.bar(g, ex, cy + 1, 30, 3, p.morale / 100, 0xff7ab8);
      txt(this, x + w - 12, cy, p.morale >= 70 ? ':)' : p.morale >= 40 ? ':|' : ':(', 6, p.morale >= 70 ? '#5be37d' : p.morale >= 40 ? '#d8dcf0' : '#ff9a9a');
      }
    }
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      sfx.click();
      onTap();
    });
  }

  private buildSquad(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(W - 230, 340);
    txt(this, 12, top + 4, 'POSTO', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 52, top + 4, 'NOME', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 170, top + 4, 'ETÀ', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 200, top + 4, 'VAL', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 8 + lw - 56, top + 4, 'EN/MOR', 6, '#5a5f80').setOrigin(0, 0.5);
    const roles = FORMATIONS[st.formation].roles;
    const starters = st.lineup.map((id) => st.squad.find((p) => p.id === id)!).filter(Boolean);
    const bench = st.squad.filter((p) => !st.lineup.includes(p.id));
    let y = top + 12;
    starters.forEach((p, i) => {
      this.playerRow(g, 8, y, lw, p, { slot: ROLE_LABEL[roles[i]], selected: this.sel === p.id }, () => this.tapSquad(p.id));
      y += 20;
    });
    g.fillStyle(0x3a3d55).fillRect(8, y + 1, lw, 1);
    y += 4;
    bench.forEach((p) => {
      this.playerRow(g, 8, y, lw, p, { selected: this.sel === p.id }, () => this.tapSquad(p.id));
      y += 20;
    });
    if (y < H - 60) txt(this, 8 + lw / 2, y + 10, 'Tocca due giocatori per scambiarli', 6, '#5a5f80');

    // pannello destro: modulo + giocatore scelto
    const rx = 16 + lw;
    const rw = W - rx - 8;
    panel(g, rx, top, rw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    const f = FORMATIONS[st.formation];
    txt(this, rx + rw / 2, top + 12, f.name, 6, '#ffd23f');
    arrow(this, rx + 14, top + 12, -1, () => this.cycleFormation(-1));
    arrow(this, rx + rw - 14, top + 12, 1, () => this.cycleFormation(1));
    const p = st.squad.find((x) => x.id === this.sel);
    if (!p) {
      txt(this, rx + rw / 2, top + 34, f.desc, 6, '#d8dcf0', { wordWrap: { width: rw - 16 }, align: 'center', lineSpacing: 3 });
      this.drawFormation(g, st, rx + 10, top + 52, rw - 20, 110);
      button(this, rx + rw / 2, top + 184, Math.min(rw - 20, 160), 22, 'FORMAZIONE AUTO', () => {
        sfx.select();
        this.commit((s) => autoLineup(s));
      }, { size: 6, color: 0x2f6fd0 });
      txt(this, rx + rw / 2, top + 206, 'Sceglie i migliori in forma', 6, '#8a8fb0');
      return;
    }
    this.playerDetail(g, st, p, rx, top + 34, rw, false);
  }

  private drawFormation(g: Phaser.GameObjects.Graphics, st: ManagerState, x: number, y: number, w: number, h: number) {
    g.fillStyle(0x2d7a3a).fillRect(x, y, w, h);
    g.fillStyle(0x338a42);
    for (let i = 0; i < 6; i += 2) g.fillRect(x + (w / 6) * i, y, w / 6, h);
    g.lineStyle(1, 0xffffff, 0.5).strokeRect(x + 2, y + 2, w - 4, h - 4);
    g.lineBetween(x + w / 2, y + 2, x + w / 2, y + h - 2);
    g.strokeRect(x + 2, y + h / 2 - 18, 14, 36);
    const roles = FORMATIONS[st.formation].roles;
    const pos: [number, number][] = [
      [0.06, 0.5],
      [0.28, 0.5],
      [0.5, 0.22],
      [0.5, 0.78],
      [0.78, 0.5],
    ];
    const xs: Record<string, number> = { GK: 0.06, DEF: 0.28, MID: 0.5, FWD: 0.78 };
    const starters = st.lineup.map((id) => st.squad.find((p) => p.id === id));
    roles.forEach((r, i) => {
      const nx = xs[r];
      const ny = pos[i][1];
      const px = x + nx * w;
      const py = y + ny * h;
      g.fillStyle(0x1a1222).fillCircle(px, py, 7);
      g.fillStyle(r === 'GK' ? st.club.colors.gk : st.club.colors.shirt).fillCircle(px, py, 6);
      const p = starters[i];
      if (p) txt(this, px, py + 13, p.name.toUpperCase().slice(0, 8), 6, '#ffffff');
    });
  }

  private playerDetail(g: Phaser.GameObjects.Graphics, st: ManagerState, p: MPlayer, rx: number, y: number, rw: number, market: boolean) {
    const team: TeamDef = { ...myTeamDef(st), players: [] };
    makePlayerSheet(this, 'mgr_sel', team, { name: p.name, number: p.number, role: p.role, stats: p.stats, look: p.look });
    this.add.image(rx + 24, y + 30, 'mgr_sel', frameIndex('down', 'idle')).setScale(2).setOrigin(0.5, 1);
    txt(this, rx + 46, y + 6, p.name.toUpperCase(), 8, '#ffffff').setOrigin(0, 0.5);
    txt(this, rx + 46, y + 20, `${ROLE_LABEL[p.role]} · ${p.age} anni${market ? '' : ` · N.${p.number}`}`, 6, '#8a8fb0').setOrigin(0, 0.5);
    const o = playerOvr(p);
    txt(this, rx + rw - 8, y + 6, `${o}`, 16, this.ovrColor(o)).setOrigin(1, 0.5);
    const po = potOvr(p);
    txt(this, rx + rw - 8, y + 22, po > o + 2 ? `POT ${po}` : 'AL TOP', 6, po > o + 8 ? '#ff7ab8' : '#8a8fb0').setOrigin(1, 0.5);
    let yy = y + 40;
    for (const k of STAT_KEYS) {
      if (k === 'keeping' && p.role !== 'GK') continue;
      txt(this, rx + 8, yy, STAT_LABEL[k], 6, '#8a8fb0').setOrigin(0, 0.5);
      const v = (p.stats[k] - 0.5) / 0.7;
      this.bar(g, rx + 84, yy - 2, rw - 100, 5, v, v > 0.7 ? COLORS.accent : v > 0.45 ? COLORS.good : COLORS.accent2);
      yy += 12;
    }
    yy += 2;
    if (!market) {
      txt(this, rx + 8, yy, `ENERGIA ${p.energy}  MORALE ${p.morale}`, 6, '#d8dcf0').setOrigin(0, 0.5);
      yy += 12;
      txt(this, rx + 8, yy, `GOL ${p.goals}  PRESENZE ${p.apps}`, 6, '#d8dcf0').setOrigin(0, 0.5);
      yy += 12;
    }
    txt(this, rx + 8, yy, `STIPENDIO ${money(p.salary)}/sett.`, 6, '#d8dcf0').setOrigin(0, 0.5);
    yy += 12;
    txt(this, rx + 8, yy, `VALORE ${money(playerValue(p))}`, 6, '#d8dcf0').setOrigin(0, 0.5);
    if (market && p.loan) txt(this, rx + 8, yy + 12, 'PRESTITO: riscatto, stipendio -40%', 6, '#3fd0ff').setOrigin(0, 0.5);
    const by = Math.max(yy + 22, this.scale.height - 66);
    if (market) {
      const why = canBuy(st, p);
      const b = button(this, rx + rw / 2, by, rw - 24, 22, why ?? `COMPRA ${money(buyPrice(p))}`, () => {
        const id = p.id;
        let ok = false;
        save((s) => {
          if (s.manager) ok = buy(s.manager, id);
        });
        if (ok) sfx.fanfare();
        this.mktSel = null;
        this.build();
      }, { size: 6, color: COLORS.good, textColor: '#1a1222' });
      b.setEnabled(!why);
    } else {
      const why = canSell(st, p.id);
      const key = `sell_${p.id}`;
      const b = button(this, rx + rw / 2, by, rw - 24, 22, why ?? (this.confirm === key ? `SICURO? ${money(sellPrice(p))}` : `VENDI ${money(sellPrice(p))}`), () => {
        if (this.confirm !== key) {
          this.confirm = key;
          this.build();
          return;
        }
        this.confirm = null;
        this.sel = null;
        sfx.select();
        this.commit((s) => sell(s, p.id));
      }, { size: 6, color: this.confirm === key ? 0x8a3040 : 0x3a3d55 });
      b.setEnabled(!why);
    }
  }

  private tapSquad(id: number) {
    this.confirm = null;
    if (this.sel === null || this.sel === id) {
      this.sel = this.sel === id ? null : id;
      this.build();
      return;
    }
    const a = this.sel;
    this.sel = null;
    sfx.select();
    let ok = true;
    save((s) => {
      if (s.manager) ok = swapPlayers(s.manager, a, id);
    });
    if (!ok) this.toast = 'Infortunato: non può giocare!';
    this.build();
  }

  private cycleFormation(d: number) {
    sfx.select();
    this.commit((s) => {
      const i = FORMATION_ORDER.indexOf(s.formation);
      s.formation = FORMATION_ORDER[(i + d + FORMATION_ORDER.length) % FORMATION_ORDER.length];
    });
  }

  private buildMarket(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(W - 230, 340);
    txt(this, 12, top + 4, 'RUOLO', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 44, top + 4, 'NOME', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 140, top + 4, 'ETÀ', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 172, top + 4, 'VAL', 6, '#5a5f80').setOrigin(0, 0.5);
    txt(this, 8 + lw - 6, top + 4, 'PREZZO', 6, '#5a5f80').setOrigin(1, 0.5);
    let y = top + 12;
    for (const p of st.market) {
      this.playerRow(g, 8, y, lw, p, { selected: this.mktSel === p.id, price: buyPrice(p), dim: buyPrice(p) > st.budget }, () => {
        this.mktSel = this.mktSel === p.id ? null : p.id;
        this.build();
      });
      y += 20;
    }
    if (!st.market.length) txt(this, 8 + lw / 2, y + 20, 'Mercato vuoto: torna la prossima settimana', 6, '#8a8fb0');
    txt(this, 8 + lw / 2, y + 12, `Rosa: ${st.squad.length}/10 · nuovi giocatori ogni settimana`, 6, '#5a5f80');
    const rx = 16 + lw;
    const rw = W - rx - 8;
    panel(g, rx, top, rw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    const p = st.market.find((x) => x.id === this.mktSel);
    if (!p) {
      txt(this, rx + rw / 2, top + 16, 'MERCATO', 8, '#ffd23f');
      const lines = [
        'Tocca un giocatore per vederlo.',
        'I giovani costano di più ma',
        'crescono in fretta (POT).',
        '',
        'PREST. = in prestito: il prezzo',
        'è il riscatto, stipendio -40%.',
        'Vendi dalla ROSA, rinnova da',
        'DIRIGENZA.',
        '',
        `Budget: ${money(st.budget)}`,
      ];
      lines.forEach((l, i) => txt(this, rx + rw / 2, top + 40 + i * 14, l, 6, l.startsWith('Budget') ? '#ffd23f' : '#d8dcf0'));
      return;
    }
    this.playerDetail(g, st, p, rx, top + 10, rw, true);
  }

  // ------------------------------------------------------------ ALLENAMENTO
  private buildTraining(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(W * 0.5, 300);
    txt(this, 8 + lw / 2, top + 6, 'ALLENAMENTO DELLA SETTIMANA', 6, '#ffd23f');
    TRAINING_ORDER.forEach((id, i) => {
      const t = TRAININGS[id];
      const y = top + 30 + i * 46;
      const b = button(this, 8 + lw / 2, y, lw - 8, 24, t.name, () => {
        sfx.select();
        this.commit((s) => (s.training = id));
      }, { size: 8, color: id === 'riposo' ? 0x2f6fd0 : 0x2a2d48 });
      b.setSelected(st.training === id);
      txt(this, 8 + lw / 2, y + 18, t.desc, 6, '#8a8fb0');
    });
    const rx = 16 + lw;
    const rw = W - rx - 8;
    panel(g, rx, top, rw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, rx + rw / 2, top + 14, TRAINING_LEVELS[st.trainingCenter].toUpperCase(), 8, '#3fd0ff');
    txt(this, rx + rw / 2, top + 30, `Bonus crescita +${st.trainingCenter * 30}%`, 6, '#d8dcf0');
    const lines = [
      'Si allenano tutti, ogni settimana.',
      'Chi ha meno di 23 anni cresce',
      'molto più in fretta.',
      'Dopo i 30 anni si cresce poco',
      'e d\'estate si cala un po\'.',
      'Allenarsi stanca: il RIPOSO',
      'ricarica energia e morale.',
    ];
    lines.forEach((l, i) => txt(this, rx + rw / 2, top + 54 + i * 14, l, 6, '#8a8fb0'));
    // i più promettenti
    const young = [...st.squad].sort((a, b) => potOvr(b) - playerOvr(b) - (potOvr(a) - playerOvr(a))).slice(0, 3);
    txt(this, rx + rw / 2, top + 162, 'MARGINE DI CRESCITA', 6, '#ffd23f');
    young.forEach((p, i) => {
      txt(this, rx + 12, top + 178 + i * 14, `${p.name.toUpperCase().slice(0, 11)} (${p.age})`, 6, '#ffffff').setOrigin(0, 0.5);
      txt(this, rx + rw - 12, top + 178 + i * 14, `${playerOvr(p)} > ${potOvr(p)}`, 6, '#ff7ab8').setOrigin(1, 0.5);
    });
  }

  // ------------------------------------------------------------ CLASSIFICA
  private buildTable(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(W * 0.58, 360);
    const rows = table(st);
    const cols = [
      { k: 'G', x: lw - 150 },
      { k: 'V', x: lw - 126 },
      { k: 'N', x: lw - 104 },
      { k: 'P', x: lw - 82 },
      { k: 'GOL', x: lw - 48 },
      { k: 'PT', x: lw - 12 },
    ];
    txt(this, 14, top + 4, DIVISIONS[st.division].name, 6, '#3fd0ff').setOrigin(0, 0.5);
    cols.forEach((c) => txt(this, 8 + c.x, top + 4, c.k, 6, '#5a5f80').setOrigin(1, 0.5));
    rows.forEach((r, i) => {
      const y = top + 12 + i * 22;
      const me = r.id === ME;
      const zone = i < 2 && st.division < 3 ? 0x1f4a30 : i >= 6 && st.division > 0 ? 0x4a1f28 : 0x1e2034;
      g.fillStyle(me ? 0x4a3f80 : zone).fillRect(8, y, lw, 20);
      if (me) g.lineStyle(1, COLORS.accent).strokeRect(8, y, lw, 20);
      const c = clubOf(st, r.id);
      txt(this, 20, y + 10, `${i + 1}`, 6, '#8a8fb0');
      g.fillStyle(c.colors.shirt).fillRect(30, y + 5, 5, 10);
      g.fillStyle(c.colors.shirt2).fillRect(35, y + 5, 2, 10);
      txt(this, 42, y + 10, c.name.toUpperCase().slice(0, 18), 6, me ? '#ffd23f' : '#ffffff').setOrigin(0, 0.5);
      const v = [r.p, r.w, r.d, r.l, `${r.gf}:${r.ga}`, r.pts];
      cols.forEach((col, j) => txt(this, 8 + col.x, y + 10, String(v[j]), j === 5 ? 8 : 6, j === 5 ? '#ffffff' : '#d8dcf0').setOrigin(1, 0.5));
    });
    const ly = top + 12 + 8 * 22 + 8;
    if (st.division < 3) txt(this, 14, ly, '■ promozione', 6, '#5be37d').setOrigin(0, 0.5);
    if (st.division > 0) txt(this, 110, ly, '■ retrocessione', 6, '#ff5a5a').setOrigin(0, 0.5);
    if (st.division === 3) txt(this, 14, ly, 'Il primo posto vince la Serie Pixel!', 6, '#ffd23f').setOrigin(0, 0.5);

    // calendario
    const rx = 16 + lw;
    const rw = W - rx - 8;
    panel(g, rx, top, rw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    const views: ['cal' | 'coppa' | 'giornata', string][] = [['cal', 'CALENDARIO'], ['giornata', 'GIORNATA'], ['coppa', 'COPPA']];
    const bw = (rw - 16) / 3;
    views.forEach(([id, label], i) => {
      const b = button(this, rx + 8 + bw * i + bw / 2, top + 12, bw - 4, 16, label, () => {
        this.tableView = id;
        sfx.select();
        this.build();
      }, { size: 6, color: 0x2a2d48 });
      b.setSelected(this.tableView === id);
    });
    if (this.tableView === 'coppa') return this.drawCup(g, st, rx, top + 26, rw);
    if (this.tableView === 'giornata') return this.drawRound(g, st, rx, top + 26, rw);
    const from = Phaser.Math.Clamp(st.week - 3, 0, Math.max(0, st.fixtures.length - 10));
    for (let w = from; w < Math.min(st.fixtures.length, from + 10); w++) {
      const f = st.fixtures[w].find((x) => x.h === ME || x.a === ME)!;
      const home = f.h === ME;
      const opp = clubOf(st, home ? f.a : f.h);
      const y = top + 36 + (w - from) * 17;
      const cur = w === st.week;
      if (cur) g.fillStyle(0x4a3f80).fillRect(rx + 4, y - 8, rw - 8, 16);
      txt(this, rx + 10, y, `G${w + 1}`, 6, '#8a8fb0').setOrigin(0, 0.5);
      txt(this, rx + 40, y, `${home ? 'C' : 'F'} ${opp.short}`, 6, '#ffffff').setOrigin(0, 0.5);
      if (f.gh !== undefined && f.ga !== undefined) {
        const my = home ? f.gh : f.ga;
        const ot = home ? f.ga : f.gh;
        txt(this, rx + rw - 10, y, `${my}-${ot}`, 6, my > ot ? '#5be37d' : my < ot ? '#ff5a5a' : '#d8dcf0').setOrigin(1, 0.5);
      } else if (cur) txt(this, rx + rw - 10, y, 'PROSSIMA', 6, '#ffd23f').setOrigin(1, 0.5);
    }
  }

  private tableView: 'cal' | 'coppa' | 'giornata' = 'cal';

  /** Tabellone della coppa: quarti, semifinali, finale. */
  private drawCup(g: Phaser.GameObjects.Graphics, st: ManagerState, rx: number, y0: number, rw: number) {
    const c = st.cup;
    if (!c) return;
    txt(this, rx + rw / 2, y0 + 8, c.name, 6, '#ffd23f');
    if (c.late) {
      txt(this, rx + rw / 2, y0 + 40, 'Iscrizione dalla prossima stagione.', 6, '#8a8fb0');
      return;
    }
    let y = y0 + 22;
    for (let r = 0; r < 3; r++) {
      const teams = cupTeams(c, r);
      const res = c.results[r];
      txt(this, rx + 10, y, `${CUP_ROUNDS[r]}${r === c.round && !c.out ? '  (prossimo)' : ''}`, 6, r === c.round ? '#3fd0ff' : '#5a5f80').setOrigin(0, 0.5);
      y += 11;
      if (!teams.length) {
        txt(this, rx + 16, y, '?', 6, '#5a5f80').setOrigin(0, 0.5);
        y += 11;
        continue;
      }
      for (let i = 0; i < teams.length; i += 2) {
        const a = teams[i];
        const b = teams[i + 1];
        const m = res?.[i / 2];
        const mine = a === ME || b === ME;
        if (mine) g.fillStyle(0x3a3060).fillRect(rx + 6, y - 6, rw - 12, 12);
        const name = (id: string) => clubOf(st, id).short;
        const won = (id: string) => m && m.winner === id;
        txt(this, rx + 12, y, name(a), 6, won(a) ? '#5be37d' : m ? '#8a8fb0' : '#ffffff').setOrigin(0, 0.5);
        txt(this, rx + 50, y, 'vs', 6, '#5a5f80').setOrigin(0, 0.5);
        txt(this, rx + 70, y, name(b), 6, won(b) ? '#5be37d' : m ? '#8a8fb0' : '#ffffff').setOrigin(0, 0.5);
        if (m) txt(this, rx + rw - 10, y, `${m.ga}-${m.gb}${m.pens ? ' rig.' : ''}`, 6, '#d8dcf0').setOrigin(1, 0.5);
        y += 12;
      }
      y += 2;
    }
    if (c.champion) txt(this, rx + rw / 2, y + 4, c.champion === ME ? 'COPPA VINTA!' : `Vince: ${clubOf(st, c.champion).name}`, 6, c.champion === ME ? '#ffd23f' : '#d8dcf0');
  }

  /** Risultati dell'ultima giornata giocata. */
  private drawRound(g: Phaser.GameObjects.Graphics, st: ManagerState, rx: number, y0: number, rw: number) {
    const w = st.week - 1;
    if (w < 0) {
      txt(this, rx + rw / 2, y0 + 30, 'Nessuna giornata giocata.', 6, '#8a8fb0');
      return;
    }
    txt(this, rx + rw / 2, y0 + 8, `GIORNATA ${w + 1}`, 6, '#ffd23f');
    st.fixtures[w].forEach((f, i) => {
      const y = y0 + 26 + i * 20;
      const mine = f.h === ME || f.a === ME;
      if (mine) g.fillStyle(0x3a3060).fillRect(rx + 6, y - 8, rw - 12, 16);
      const h = clubOf(st, f.h);
      const a = clubOf(st, f.a);
      g.fillStyle(h.colors.shirt).fillRect(rx + 10, y - 4, 4, 8);
      txt(this, rx + 18, y, h.short, 6, '#ffffff').setOrigin(0, 0.5);
      txt(this, rx + rw / 2, y, `${f.gh ?? '-'} - ${f.ga ?? '-'}`, 8, '#ffffff');
      txt(this, rx + rw - 18, y, a.short, 6, '#ffffff').setOrigin(1, 0.5);
      g.fillStyle(a.colors.shirt).fillRect(rx + rw - 14, y - 4, 4, 8);
    });
  }

  // ------------------------------------------------------------ DIRIGENZA
  private buildBoard(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(W * 0.5, 300);
    panel(g, 8, top, lw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, 8 + lw / 2, top + 12, 'FIDUCIA DELLA DIRIGENZA', 6, '#ffd23f');
    const c = st.boardConfidence;
    this.bar(g, 18, top + 24, lw - 20, 8, c / 100, c >= 55 ? COLORS.good : c >= 30 ? COLORS.accent : COLORS.bad);
    txt(this, 18, top + 42, `${boardLabel(c)} (${c})`, 6, '#ffffff').setOrigin(0, 0.5);
    txt(this, 18, top + 55, 'Vittoria +3 · pari +1 · sconfitta -4', 6, '#8a8fb0').setOrigin(0, 0.5);
    txt(this, 18, top + 67, 'Da 80: rinnovi contratto -20%', 6, '#8a8fb0').setOrigin(0, 0.5);
    txt(this, 8 + lw / 2, top + 88, `SPONSOR: ${st.sponsor.name.toUpperCase()}`, 6, '#ffd23f');
    txt(this, 8 + lw / 2, top + 100, `+${money(sponsorWeekly(st))} a settimana`, 6, '#5be37d');
    SPONSOR_OFFERS.forEach((o, i) => {
      const y = top + 120 + i * 40;
      const why = canSignSponsor(st, i);
      const rate = Math.round((o.weekly / SPONSOR_OFFERS[0].weekly) * 100);
      txt(this, 18, y, o.name.toUpperCase().slice(0, 18), 6, '#ffffff').setOrigin(0, 0.5);
      txt(this, 18, y + 11, `${rate}% incasso · bonus ${money(o.bonus)}`, 6, '#8a8fb0').setOrigin(0, 0.5);
      const b = button(this, 8 + lw - 52, y + 6, 88, 22, why ?? 'FIRMA', () => {
        sfx.fanfare();
        this.commit((s) => signSponsor(s, i));
      }, { size: 6, color: COLORS.good, textColor: '#1a1222' });
      b.setEnabled(!why);
    });

    const rx = 16 + lw;
    const rw = W - rx - 8;
    panel(g, rx, top, rw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, rx + rw / 2, top + 12, 'RINNOVA CONTRATTO (+15 MORALE)', 6, '#ffd23f');
    st.squad.forEach((p, i) => {
      const y = top + 34 + i * 21;
      txt(this, rx + 8, y, p.name.toUpperCase().slice(0, 11), 6, '#ffffff').setOrigin(0, 0.5);
      txt(this, rx + 98, y, p.morale >= 70 ? ':)' : p.morale >= 40 ? ':|' : ':(', 6, p.morale >= 70 ? '#5be37d' : p.morale >= 40 ? '#d8dcf0' : '#ff9a9a').setOrigin(0, 0.5);
      const cost = renewCost(st, p);
      const b = button(this, rx + rw - 46, y, 84, 17, `+ ${money(cost)}`, () => {
        sfx.select();
        this.commit((s) => renewContract(s, p.id));
      }, { size: 6, color: 0x2f6fd0 });
      b.setEnabled(st.budget >= cost && p.morale < 100);
    });
  }

  // ------------------------------------------------------------ STAFF e VIVAIO
  private buildStaff(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(W * 0.5, 300);
    const ph = H - top - 44;
    panel(g, 8, top, lw, ph, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, 8 + lw / 2, top + 11, 'STAFF TECNICO', 6, '#ffd23f');
    const base = DIVISIONS[st.division].sponsor;
    const rowH = (ph - 22) / STAFF_ROLES.length;
    STAFF_ROLES.forEach((role, i) => {
      const y = top + 22 + i * rowH;
      const lvl = st.staff?.[role] ?? 0;
      const info = STAFF_INFO[role];
      g.fillStyle(0x23263d).fillRect(12, y, lw - 8, rowH - 3);
      txt(this, 18, y + 8, info.name, 6, '#ffffff').setOrigin(0, 0.5);
      for (let k = 0; k < STAFF_MAX; k++) g.fillStyle(k < lvl ? COLORS.accent : 0x0d0a1a).fillRect(lw - 44 + k * 11, y + 4, 9, 8);
      txt(this, 18, y + 21, lvl ? info.levels[lvl - 1] : info.desc, 6, lvl ? '#5be37d' : '#8a8fb0', { wordWrap: { width: lw - 30 } }).setOrigin(0, 0.5);
      if (lvl) txt(this, 18, y + 34, `Stipendio ${money(staffWage(lvl, base))} a settimana`, 6, '#ff9a9a').setOrigin(0, 0.5);
      const up = staffUpgrade(st, role);
      const bw = 92;
      const b = button(this, lw - bw / 2 - 2, y + rowH - 18, bw, 16, up ? `${lvl ? 'POTENZIA' : 'ASSUMI'} ${money(up.cost)}` : 'AL MASSIMO', () => {
        sfx.fanfare();
        this.commit((s) => hireStaff(s, role));
      }, { size: 5, color: 0x2f6fd0 });
      b.setEnabled(!!up && st.budget >= up.cost);
      if (lvl) {
        button(this, lw - bw - 26, y + rowH - 18, 30, 16, 'VIA', () => this.commit((s) => dismissStaff(s, role)), { size: 5, color: 0x8a3040 });
      }
    });

    const rx = 16 + lw;
    const rw = W - rx - 8;
    panel(g, rx, top, rw, ph, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, rx + rw / 2, top + 11, 'VIVAIO', 6, '#ff7ab8');
    const ac = st.academy;
    const scout = st.staff?.osservatore ?? 0;
    if (!ac || !ac.prospects.length) {
      txt(this, rx + rw / 2, top + 60, 'Nessun provino in attesa.', 6, '#8a8fb0');
      txt(this, rx + rw / 2, top + 76, 'A fine stagione arrivano nuovi ragazzi:', 6, '#5a5f80');
      txt(this, rx + rw / 2, top + 88, 'più provini con un buon osservatore.', 6, '#5a5f80');
      return;
    }
    txt(this, rx + rw / 2, top + 24, ac.promoted === 0 ? 'La prima promozione è GRATIS' : 'Altre promozioni: contratto a pagamento', 6, '#8a8fb0');
    ac.prospects.forEach((p, i) => {
      const y = top + 36 + i * 42;
      g.fillStyle(0x23263d).fillRect(rx + 4, y, rw - 8, 38);
      txt(this, rx + 10, y + 9, `${p.name.toUpperCase().slice(0, 12)}  ${ROLE_LABEL[p.role]}  ${p.age}a`, 6, '#ffffff').setOrigin(0, 0.5);
      txt(this, rx + rw - 10, y + 9, `FORZA ${playerOvr(p)}`, 6, this.ovrColor(playerOvr(p))).setOrigin(1, 0.5);
      txt(this, rx + 10, y + 23, `POTENZIALE ${potentialLabel(p.pot, scout, p.id)}`, 6, '#ffd23f').setOrigin(0, 0.5);
      const cost = promoteCost(st, p);
      const why = canPromote(st, p.id);
      const b = button(this, rx + rw - 48, y + 24, 86, 15, why ?? (cost ? `PROMUOVI ${money(cost)}` : 'PROMUOVI GRATIS'), () => {
        sfx.select();
        this.commit((s) => promoteProspect(s, p.id));
      }, { size: 5, color: 0x2f9a50 });
      b.setEnabled(!why);
    });
    if (!scout) txt(this, rx + rw / 2, top + ph - 12, 'Senza osservatore il potenziale è un mistero.', 6, '#5a5f80');
  }

  // ------------------------------------------------------------ GIORNALE
  private buildStampa(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const pw = Math.min(W - 16, 560);
    const x0 = (W - pw) / 2;
    const ph = H - top - 44;
    const paper = 0xe6dfc8;
    g.fillStyle(0x000000, 0.35).fillRect(x0 + 3, top + 3, pw, ph);
    g.fillStyle(paper).fillRect(x0, top, pw, ph);
    g.fillStyle(0x2a2018).fillRect(x0 + 8, top + 26, pw - 16, 2).fillRect(x0 + 8, top + 30, pw - 16, 1);
    const ink = '#2a2018';
    const gz = gazzetta(st);
    txt(this, x0 + pw / 2, top + 13, 'LA GAZZETTA PIXEL', 12, ink);
    txt(this, x0 + 12, top + 38, `STAGIONE ${st.season}`, 5, ink).setOrigin(0, 0.5);
    txt(this, x0 + pw - 12, top + 38, `${DIVISIONS[st.division].name} · GIORNATA ${Math.min(st.week + 1, st.fixtures.length)}`, 5, ink).setOrigin(1, 0.5);
    const head = txt(this, x0 + pw / 2, top + 62, gz.headline, 11, '#8a1a1a', { wordWrap: { width: pw - 30 }, align: 'center' });
    txt(this, x0 + pw / 2, top + 62 + head.height / 2 + 10, gz.sub, 6, '#4a3f30', { wordWrap: { width: pw - 30 }, align: 'center' });
    let y = top + 62 + head.height / 2 + 28;
    g.fillStyle(0x2a2018).fillRect(x0 + 8, y - 6, pw - 16, 1);
    const colW = (pw - 36) / 2;
    gz.items.forEach((it, i) => {
      const cx = x0 + 12 + (i % 2) * (colW + 12);
      const cy = y + Math.floor(i / 2) * 40;
      txt(this, cx, cy + 4, it.tag, 5, '#8a1a1a').setOrigin(0, 0.5);
      txt(this, cx, cy + 12, it.text, 6, ink, { wordWrap: { width: colW } }).setOrigin(0, 0);
    });
  }

  // ------------------------------------------------------------ SOCIETÀ
  private buildSociety(st: ManagerState, W: number, H: number) {
    const g = this.add.graphics();
    const top = 56;
    const lw = Math.min(W * 0.5, 300);
    panel(g, 8, top, lw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, 8 + lw / 2, top + 12, 'FINANZE (A SETTIMANA)', 6, '#ffd23f');
    const wb = weeklyBalance(st);
    const rows: [string, string, string][] = [
      ['Sponsor', `+${money(wb.sponsor)}`, '#5be37d'],
      ['Biglietti (in casa)', `+${money(wb.tickets)}`, '#5be37d'],
      ['Stipendi', `-${money(wb.salaries)}`, '#ff9a9a'],
    ];
    rows.forEach(([a, b, c], i) => {
      txt(this, 18, top + 32 + i * 14, a, 6, '#d8dcf0').setOrigin(0, 0.5);
      txt(this, lw - 2, top + 32 + i * 14, b, 6, c).setOrigin(1, 0.5);
    });
    if (st.lastWeek) {
      const net = st.lastWeek.tickets + st.lastWeek.sponsor - st.lastWeek.salaries;
      txt(this, 18, top + 80, 'Ultima settimana', 6, '#8a8fb0').setOrigin(0, 0.5);
      txt(this, lw - 2, top + 80, `${net >= 0 ? '+' : ''}${money(net)}`, 6, net >= 0 ? '#5be37d' : '#ff5a5a').setOrigin(1, 0.5);
    }
    txt(this, 18, top + 96, `Tifosi: ${st.fans}  ·  posti: ${STADIUM_LEVELS[st.stadium].seats}`, 6, '#8a8fb0').setOrigin(0, 0.5);
    txt(this, 18, top + 110, `Premio fine stagione: fino a ${money(DIVISIONS[st.division].prize)}`, 6, '#8a8fb0').setOrigin(0, 0.5);
    if (st.budget < 0) txt(this, 8 + lw / 2, top + 126, 'In rosso! Vendi qualcuno o fai salire i tifosi.', 6, '#ff5a5a');
    // albo d'oro
    txt(this, 8 + lw / 2, top + 146, `ALBO · TITOLI ${st.titles} · COPPE ${st.cups ?? 0}`, 6, '#ffd23f');
    st.history.slice(-5).reverse().forEach((h, i) => {
      txt(this, 18, top + 162 + i * 12, `Stagione ${h.season} · ${DIVISIONS[h.division].short}`, 6, '#d8dcf0').setOrigin(0, 0.5);
      txt(this, lw - 2, top + 162 + i * 12, `${h.pos}°`, 6, h.pos === 1 ? '#ffd23f' : '#d8dcf0').setOrigin(1, 0.5);
    });
    if (!st.history.length) txt(this, 8 + lw / 2, top + 162, 'Nessuna stagione conclusa', 6, '#5a5f80');

    // strutture
    const rx = 16 + lw;
    const rw = W - rx - 8;
    panel(g, rx, top, rw, H - top - 44, 0x1b1d2e, 0x2e3250, 0.95);
    txt(this, rx + rw / 2, top + 12, 'STRUTTURE', 6, '#ffd23f');
    const fac = (y: number, label: string, level: string, what: 'stadium' | 'training', info: string) => {
      txt(this, rx + 10, y, label, 6, '#8a8fb0').setOrigin(0, 0.5);
      txt(this, rx + 10, y + 14, level.toUpperCase(), 8, '#ffffff').setOrigin(0, 0.5);
      txt(this, rx + 10, y + 28, info, 6, '#8a8fb0').setOrigin(0, 0.5);
      const cost = upgradeCost(st, what);
      const key = `up_${what}`;
      const b = button(this, rx + rw / 2, y + 48, rw - 24, 22, cost === null ? 'AL MASSIMO' : this.confirm === key ? `CONFERMI? ${money(cost)}` : `AMPLIA ${money(cost)}`, () => {
        if (this.confirm !== key) {
          this.confirm = key;
          this.build();
          return;
        }
        this.confirm = null;
        sfx.fanfare();
        this.commit((s) => upgrade(s, what));
      }, { size: 6, color: this.confirm === key ? COLORS.good : 0x2f6fd0, textColor: this.confirm === key ? '#1a1222' : '#ffffff' });
      b.setEnabled(cost !== null && st.budget >= cost);
    };
    fac(top + 32, 'STADIO', STADIUM_LEVELS[st.stadium].name, 'stadium', `${STADIUM_LEVELS[st.stadium].seats} posti`);
    fac(top + 112, 'ALLENAMENTO', TRAINING_LEVELS[st.trainingCenter], 'training', 'Più crescita e giovani migliori');
    const key = 'reset';
    button(this, rx + rw / 2, top + 196, rw - 24, 18, this.confirm === key ? 'CANCELLO TUTTO?' : 'RICOMINCIA DA ZERO', () => {
      if (this.confirm !== key) {
        this.confirm = key;
        this.build();
        return;
      }
      this.confirm = null;
      save((s) => delete s.manager);
      this.tab = 'club';
      this.build();
    }, { size: 6, color: this.confirm === key ? 0x8a3040 : 0x3a3d55 });
  }

  // ------------------------------------------------------------ fine stagione
  private buildSeasonEnd(st: ManagerState, W: number, H: number) {
    const se = st.seasonEnd!;
    const c = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.9).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    panel(g, W / 2 - 180, 24, 360, 308, 0x1b1d2e, COLORS.accent, 0.98);
    c.add([bg, g]);
    const title = se.outcome === 'campione' ? 'CAMPIONI!' : se.outcome === 'promosso' ? 'PROMOSSI!' : se.outcome === 'retrocesso' ? 'RETROCESSI' : 'FINE STAGIONE';
    const col = se.outcome === 'retrocesso' ? '#ff5a5a' : se.outcome === 'salvo' ? '#ffffff' : '#ffd23f';
    const t = shadowTxt(this, W / 2, 46, title, 16, col);
    c.add(t.c);
    const lines: [string, string][] = [
      [`Stagione ${se.season} · ${DIVISIONS[se.division].name}`, '#8a8fb0'],
      [`Posizione finale: ${se.pos}°`, '#ffffff'],
      [
        se.outcome === 'campione' && se.division === 3 ? 'Avete vinto la Serie Pixel! Leggenda.'
          : se.outcome === 'campione' || se.outcome === 'promosso' ? `Si sale: ${DIVISIONS[st.division].name}!`
          : se.outcome === 'retrocesso' ? `Si scende: ${DIVISIONS[st.division].name}.` : `Si resta in ${DIVISIONS[st.division].name}.`,
        col,
      ],
      [`Premio: +${money(se.prize)}`, '#5be37d'],
      [se.objective ? `Obiettivo "${se.objective.label}": ${se.objective.met ? `centrato! +${money(se.objective.bonus)}` : 'mancato. Il presidente sbuffa.'}` : '', se.objective?.met ? '#5be37d' : '#ff9a9a'],
      [se.retired.length ? `Si ritirano: ${se.retired.join(', ')}` : 'Nessun ritiro', '#d8dcf0'],
      [se.awards?.topScorer ? `Capocannoniere: ${se.awards.topScorer.name} (${se.awards.topScorer.goals} gol)` : '', '#ffd23f'],
      [se.awards?.mvp ? `Giocatore dell'anno: ${se.awards.mvp.name}${se.awards.young ? ` · Giovane: ${se.awards.young.name}` : ''}` : '', '#ffd23f'],
      [se.youth.length ? `Dal vivaio in prima squadra: ${se.youth.join(', ')}` : se.prospects ? `${se.prospects} provini nel vivaio: scheda STAFF` : '', '#ff7ab8'],
      ['Tutti un anno più vecchi: i giovani crescono, i veterani calano.', '#8a8fb0'],
    ];
    lines.filter(([s]) => s).forEach(([s, cl], i) => c.add(txt(this, W / 2, 76 + i * 18, s, 6, cl, { wordWrap: { width: 330 }, align: 'center' })));
    if (se.outcome !== 'retrocesso' && se.outcome !== 'salvo') sfx.fanfare();
    const b = button(this, W / 2, 308, 160, 26, 'AVANTI', () => this.commit((s) => delete s.seasonEnd), { color: COLORS.good, textColor: '#1a1222' });
    c.add(b.c);
    c.setDepth(20);
  }

  // ------------------------------------------------------------ partite
  private play() {
    const st = this.st();
    const nm = st && nextMatch(st);
    if (!st || !nm) return;
    const opp = nm.opp;
    const me = myTeamDef(st);
    const launch: MatchLaunch = {
      mode: 'manager',
      // in coppa il pareggio va ai supplementari e poi ai rigori
      penalties: nm.cup,
      modeData: { season: st.season, week: st.week, cup: nm.cup ? st.cup!.round : -1 },
      hudGoal: nm.cup ? `${st.cup!.europe ? 'EUROPA' : 'COPPA'}: ${CUP_ROUNDS[st.cup!.round]}` : undefined,
      config: {
        home: me,
        away: fixKits(me, clubTeamDef(st, opp)),
        pitch: PITCHES[matchPitch(st)],
        ...matchConditions(st),
        difficulty: st.difficulty,
        durationSec: load().settings.duration,
        powerUps: load().settings.powerUps,
        goldenGoal: false,
        extraTime: nm.cup,
        humanTeam: 0,
      },
    };
    sfx.unlock();
    startMatch(this, launch);
  }

  private simulate() {
    const st = this.st();
    const nm = st && nextMatch(st);
    if (!st || !nm || this.sim) return;
    const opp = nm.opp;
    sfx.whistle();
    const home = nm.home;
    const result = simulateMyMatch(st);
    const mine = result.scorers.filter((s) => s.team === 0).map((s) => s.name);
    const chances = this.makeChances(st, result);
    let applied: MatchApplied = {};
    save((s) => {
      if (s.manager) applied = applyMatch(s.manager, result.score[0], result.score[1], mine);
    });
    this.sim = { result, applied, label: nm.label, chances, home, oppName: opp.short, oppColor: opp.colors.shirt, t: 0, done: false };
    this.build();
    let lastGoals = 0;
    this.simTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const sm = this.sim;
        if (!sm) return;
        sm.t = Math.min(90, sm.t + 0.9);
        const goals = sm.result.scorers.filter((s) => minuteOf(s.time, SIM_DURATION) <= sm.t).length;
        if (goals > lastGoals) {
          lastGoals = goals;
          sfx.goal();
          this.cameras.main.shake(120, 0.004);
        }
        if (sm.t >= 90) {
          sm.done = true;
          sfx.whistle(3, true);
          this.simTimer?.remove();
        }
        this.drawSim();
      },
    });
  }

  private drawSim() {
    const sm = this.sim;
    if (!sm) return;
    this.simLayer?.destroy();
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(0, 0).setDepth(30);
    this.simLayer = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.94).setOrigin(0).setInteractive());
    const g = this.add.graphics();
    c.add(g);
    const st = this.st()!;
    const shown = sm.result.scorers.filter((s) => minuteOf(s.time, SIM_DURATION) <= sm.t);
    const my = shown.filter((s) => s.team === 0).length;
    const ot = shown.length - my;
    const homeName = sm.home ? st.club.short : sm.oppName;
    const awayName = sm.home ? sm.oppName : st.club.short;
    const hs = sm.home ? my : ot;
    const as = sm.home ? ot : my;
    panel(g, W / 2 - 150, 16, 300, 56, 0x1b1d2e, 0x2e3250, 0.98);
    g.fillStyle(sm.home ? st.club.colors.shirt : sm.oppColor).fillRect(W / 2 - 140, 28, 8, 30);
    g.fillStyle(sm.home ? sm.oppColor : st.club.colors.shirt).fillRect(W / 2 + 132, 28, 8, 30);
    c.add(txt(this, W / 2 - 92, 44, homeName, 8));
    c.add(txt(this, W / 2 + 92, 44, awayName, 8));
    c.add(shadowTxt(this, W / 2, 40, `${hs} - ${as}`, 24, '#ffffff').c);
    c.add(txt(this, W / 2, 62, sm.done ? 'FINALE' : `${Math.floor(sm.t)}'`, 6, sm.done ? '#ffd23f' : '#5be37d'));
    // barra del tempo
    this.bar(g, W / 2 - 150, 76, 300, 3, sm.t / 90, COLORS.accent2);
    // cronaca: gol e occasioni
    let y = 96;
    c.add(txt(this, W / 2, y - 6, `CRONACA · ${sm.label}`, 6, '#8a8fb0'));
    y += 6;
    const feed = [
      ...shown.map((s) => ({ min: minuteOf(s.time, SIM_DURATION), text: `GOL! ${s.name}  (${s.team === 0 ? st.club.short : sm.oppName})`, col: s.team === 0 ? '#5be37d' : '#ff9a9a' })),
      ...sm.chances.filter((ch) => ch.min <= sm.t).map((ch) => ({ min: ch.min, text: ch.text, col: ch.mine ? '#9ad8b0' : '#c8a0a8' })),
    ].sort((a, b) => a.min - b.min).slice(-8);
    if (!feed.length) c.add(txt(this, W / 2, y + 8, sm.t < 3 ? 'Fischio d\'inizio!' : 'Squadre che si studiano...', 6, '#8a8fb0'));
    for (const f of feed) {
      c.add(txt(this, W / 2, y + 8, `${f.min}'  ${f.text}`, 6, f.col));
      y += 13;
    }
    if (!sm.done) {
      this.simButton(sm.done, () => button(this, W / 2, H - 26, 120, 24, 'SALTA', () => {
        sm.t = 90;
        sm.done = true;
        this.simTimer?.remove();
        this.time.delayedCall(0, () => this.drawSim());
      }, { size: 6, color: 0x3a3d55 }));
      return;
    }
    const [a, b] = sm.result.score;
    const lines = managerReportLines(st, sm.applied, a, b);
    const by = Math.max(y + 14, 212);
    lines.slice(0, 4).forEach((l, i) => c.add(txt(this, W / 2, by + i * 14, l.text, i === 0 ? 8 : 6, l.color ?? '#d8dcf0')));
    this.simButton(sm.done, () => button(this, W / 2, H - 26, 160, 26, 'CONTINUA', () => {
      this.sim = null;
      this.simTimer?.remove();
      this.time.delayedCall(0, () => this.build());
    }, { color: COLORS.good, textColor: '#1a1222' }));
  }

  /** Occasioni da gol "di contorno" per la cronaca simulata, coerenti con i tiri. */
  private makeChances(st: ManagerState, r: MatchResult): SimShow['chances'] {
    const out: SimShow['chances'] = [];
    const me = myTeamDef(st);
    const opp = clubTeamDef(st, opponentOf(st)!);
    let seed = r.stats.shots[0] * 31 + r.stats.shots[1] * 7 + st.week;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const lines = ['Tiro di {n}: parata!', 'Palo di {n}!', '{n} calcia alto di poco.', 'Contropiede di {n}, salva il portiere.', '{n} ci prova da lontano: fuori.'];
    [0, 1].forEach((team) => {
      const goals = r.scorers.filter((s) => s.team === team).length;
      const n = Math.min(3, Math.max(0, r.stats.shots[team] - goals));
      const roster = (team === 0 ? me : opp).players.filter((p) => p.role !== 'GK');
      for (let i = 0; i < n && roster.length; i++) {
        const who = roster[Math.floor(rnd() * roster.length)].name;
        out.push({ min: 2 + Math.floor(rnd() * 86), text: lines[Math.floor(rnd() * lines.length)].replace('{n}', who), mine: team === 0 });
      }
    });
    return out;
  }

  private simButton(done: boolean, make: () => Button) {
    if (this.simBtn && this.simBtn.done === done) return;
    this.simBtn?.c.destroy();
    const b = make();
    b.c.setDepth(31);
    this.simBtn = { c: b.c, done };
  }
}

/** Resoconto di una partita del manager (coppa o campionato), per cronaca e schermata del risultato. */
export function managerReportLines(_st: ManagerState, ap: MatchApplied, a: number, b: number): { text: string; color?: string }[] {
  const lines: { text: string; color?: string }[] = [];
  if (ap.cup) {
    const c = ap.cup;
    lines.push({
      text: c.champion ? 'COPPA VINTA!' : c.won ? `PASSAGGIO DEL TURNO${c.pens ? ' AI RIGORI' : ''}!` : `ELIMINATI${c.pens ? ' AI RIGORI' : ''}`,
      color: c.won ? '#ffd23f' : '#ff5a5a',
    });
    if (c.prize) lines.push({ text: `Premio coppa: +${money(c.prize)}`, color: '#5be37d' });
    if (c.notes[0]) lines.push({ text: c.notes[0], color: '#ff9a9a' });
    return lines;
  }
  const rep = ap.week;
  if (!rep) return lines;
  lines.push({ text: a > b ? 'VITTORIA!' : a < b ? 'SCONFITTA' : 'PAREGGIO', color: a > b ? '#ffd23f' : a < b ? '#ff5a5a' : '#ffffff' });
  lines.push({ text: `Classifica: ${rep.pos}°  ·  settimana ${rep.income >= 0 ? '+' : ''}${money(rep.income)}`, color: '#d8dcf0' });
  if (rep.notes[0]) lines.push({ text: rep.notes[0], color: rep.notes[0].startsWith('Infortunio') ? '#ff9a9a' : '#8a8fb0' });
  if (rep.seasonEnd) lines.push({ text: 'Stagione finita! Guarda il resoconto.', color: '#ffd23f' });
  return lines;
}
