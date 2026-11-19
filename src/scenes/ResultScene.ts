import Phaser from 'phaser';
import type { MatchOutcome } from '../modes/modes';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load, progressOf, save } from '../save/storage';
import { addMatchXp, coinsForMatch, GROWTH_MODES, levelOf, MAX_LEVEL, recordVs } from '../modes/progress';
import { applyDaily, DAILY_ALL_BONUS, dailyState, dailyText } from '../modes/daily';
import { addMatchTotals, checkTrophies, newTotals } from '../modes/trophies';
import { bestOnPitch, teamRatings } from '../modes/ratings';
import { backToMenu, backToScene, startMatch } from './demo';
import { applyUserResult, ROUND_NAMES } from '../modes/tournament';
import { checkObjective, MISSIONS, objectiveText } from '../modes/missions';
import { applyCareerResult, PERKS, STORY } from '../modes/career';
import { applyProResult, proSeasonEnd } from '../modes/pro';
import { teamById } from '../data/teams';
import { applyMatch, cupDue, DIVISIONS, ensureManager, nextMatch } from '../modes/manager';
import { newAlbum, owned as ownedStickers, packsForMatch } from '../modes/album';
import { managerReportLines } from './ManagerScene';
import { applyConquistaResult, CITIES, CQ_GOAL_TEXT } from '../modes/conquista';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';

interface ReportLine {
  text: string;
  color?: string;
  ok?: boolean;
}

/** Riepilogo della modalità (torneo, missione, storia) mostrato al posto delle statistiche. */
interface ModeReport {
  title?: string;
  titleColor?: string;
  lines: ReportLine[];
  next: { label: string; go: (s: Phaser.Scene) => void };
  retry: boolean;
}

export class ResultScene extends Phaser.Scene {
  private data_!: MatchOutcome;
  private packs = 0;
  private coins = 0;
  /** Righe extra sotto il riquadro: livelli, abilità, rivalità. */
  private news: { text: string; color: string }[] = [];
  private trophyWon = false;
  private report?: ModeReport;
  constructor() {
    super('result');
  }
  init(d: MatchOutcome) {
    this.data_ = d;
    const r = d.result;
    if (d.launch.config.humanTeam === 0) {
      save((s) => {
        s.record.played++;
        s.record.goalsFor += r.score[0];
        s.record.goalsAgainst += r.score[1];
        if (r.score[0] > r.score[1]) s.record.won++;
        else if (r.score[0] < r.score[1]) s.record.lost++;
        else s.record.drawn++;
      });
      // pacchetti di figurine: uno per partita, uno in più se vinci
      const won = r.penalties ? r.penalties[0] > r.penalties[1] : r.score[0] > r.score[1];
      this.packs = packsForMatch(won);
      save((s) => {
        s.album = s.album ?? newAlbum();
        s.album.packs += this.packs;
      });
    } else {
      this.packs = 0;
      this.coins = 0;
      this.news = [];
    }
    this.report = this.makeReport(d);
    // dopo il resoconto della modalità (le coppe vinte contano per i trofei)
    if (d.launch.config.humanTeam === 0) this.rewards(d, r.penalties ? r.penalties[0] > r.penalties[1] : r.score[0] > r.score[1]);
  }

  /** Monete, esperienza dei giocatori e rivalità. */
  private rewards(d: MatchOutcome, won: boolean) {
    const r = d.result;
    const cfg = d.launch.config;
    // ai rigori persi conta come pareggio
    const res: 'w' | 'd' | 'l' = won ? 'w' : r.score[0] === r.score[1] ? 'd' : 'l';
    this.news = [];
    const p = progressOf();
    let rival = false;
    if (GROWTH_MODES.includes(d.launch.mode)) {
      const vs = recordVs(p, cfg.away.id, res);
      rival = vs.wasRival;
      if (vs.wasRival && !vs.nowRival) this.news.push({ text: `Rivalità chiusa: ${cfg.away.name} non fa più paura!`, color: '#5be37d' });
      else if (!vs.wasRival && vs.nowRival) this.news.push({ text: `${cfg.away.name} è ora una tua RIVALE: battila per monete doppie`, color: '#ff5a5a' });
      const mine = r.scorers.filter((s) => s.team === 0).map((s) => s.name);
      const ups = addMatchXp(p, cfg.home, mine, won);
      for (const u of ups.slice(0, 2)) {
        this.news.push({ text: `${u.name} sale al livello ${u.level}${u.skill ? ` · nuova abilità: ${u.skill}` : ''}`, color: '#3fd0ff' });
      }
      if (ups.length > 2) this.news.push({ text: `...e altri ${ups.length - 2} giocatori crescono`, color: '#3fd0ff' });
    }
    this.coins = coinsForMatch(r.score[0], res, d.style ?? 0, rival);

    // migliore in campo
    const home = teamRatings(cfg.home, 0, d.tally, r);
    const best = bestOnPitch(home, teamRatings(cfg.away, 1, d.tally, r), r);
    this.news.unshift({ text: `Migliore in campo: ${best.name} (${best.vote})`, color: best.team === 0 ? '#ffd23f' : '#d8dcf0' });

    // sfide del giorno
    const daily = (p.daily = dailyState(p.daily));
    const doneBefore = daily.done.every(Boolean);
    const fresh = applyDaily(daily, d);
    const totals = (p.totals = p.totals ?? newTotals());
    for (const c of fresh) {
      this.coins += c.reward;
      totals.sfide++;
      this.news.push({ text: `Sfida completata: ${dailyText(c)}  +${c.reward}`, color: '#5be37d' });
    }
    if (!doneBefore && daily.done.every(Boolean)) {
      this.coins += DAILY_ALL_BONUS;
      this.news.push({ text: `Tutte le sfide di oggi!  +${DAILY_ALL_BONUS}`, color: '#5be37d' });
    }

    // trofei
    addMatchTotals(totals, d, rival && res === 'w');
    const have = (p.trophies = p.trophies ?? []);
    const sv = load();
    const newT = checkTrophies(have, {
      totals,
      cups: sv.trophies ?? 0,
      stickers: sv.album ? ownedStickers(sv.album) : 0,
      maxLevelPlayers: Object.values(p.xp).flat().filter((x) => levelOf(x) >= MAX_LEVEL).length,
    });
    for (const t of newT) {
      this.coins += t.reward;
      this.news.push({ text: `TROFEO: ${t.name}  +${t.reward}`, color: '#ff7ab8' });
    }
    this.trophyWon = newT.length > 0;

    p.coins += this.coins;
    save();
  }

  /** Voti dei tuoi giocatori e migliore in campo. */
  private pagella(d: MatchOutcome): Phaser.GameObjects.Container {
    const W = this.scale.width;
    const cfg = d.launch.config;
    const side: 0 | 1 = cfg.humanTeam === 1 ? 1 : 0;
    const team = side === 0 ? cfg.home : cfg.away;
    const mine = teamRatings(team, side, d.tally, d.result);
    const other = teamRatings(side === 0 ? cfg.away : cfg.home, side === 0 ? 1 : 0, d.tally, d.result);
    const best = bestOnPitch(side === 0 ? mine : other, side === 0 ? other : mine, d.result);
    const c = this.add.container(0, 0).setDepth(8);
    const g = this.add.graphics();
    c.add(g);
    panel(g, W / 2 - 170, 62, 340, 210, 0x241a36, 0x4a3a6a, 0.98);
    c.add(txt(this, W / 2, 76, `PAGELLA · ${team.name.toUpperCase()}`, 8, '#ffd23f'));
    const role = { GK: 'POR', DEF: 'DIF', MID: 'CEN', FWD: 'ATT' } as const;
    mine.forEach((r, i) => {
      const y = 100 + i * 28;
      g.fillStyle(i % 2 ? 0x2a2040 : 0x30254a).fillRect(W / 2 - 160, y - 12, 320, 25);
      c.add(txt(this, W / 2 - 152, y - 4, `${role[r.role]} ${r.name}`, 6, '#ffffff').setOrigin(0, 0.5));
      c.add(txt(this, W / 2 - 152, y + 6, r.note || '-', 6, '#8a8fb0').setOrigin(0, 0.5));
      const col = r.vote >= 7.5 ? '#5be37d' : r.vote >= 6 ? '#ffffff' : '#ff9a9a';
      c.add(txt(this, W / 2 + 150, y, r.vote.toFixed(1).replace('.0', ''), 12, col).setOrigin(1, 0.5));
      if (best.team === side && best.idx === r.idx) c.add(txt(this, W / 2 + 84, y, 'MVP', 6, '#1a1222', { backgroundColor: '#ffd23f', padding: { x: 3, y: 2 } }));
    });
    if (best.team !== side) c.add(txt(this, W / 2, 252, `Migliore in campo: ${best.name} (${best.vote}), avversario`, 6, '#d8dcf0'));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    return c;
  }

  private makeReport(d: MatchOutcome): ModeReport | undefined {
    const [a, b] = d.result.score;
    const md = (d.launch.modeData ?? {}) as { round?: number; mission?: string; step?: number; season?: number; week?: number; cup?: number; pro?: boolean; phase?: string };
    if (d.launch.mode === 'torneo') {
      const st = load().tournament;
      if (!st || st.round !== md.round) return undefined;
      const round = st.round;
      const res = applyUserResult(st, a, b, d.result.goldenGoal, d.result.penalties);
      save((s) => {
        s.tournament = st;
        if (res === 'campione') {
          s.trophies = (s.trophies ?? 0) + 1;
          // coppa vinta: tre pacchetti in regalo
          s.album = s.album ?? newAlbum();
          s.album.packs += 3;
          this.packs += 3;
        }
      });
      const lines: ReportLine[] = [{ text: ROUND_NAMES[round], color: '#8a8fb0' }];
      let title: string | undefined;
      if (res === 'campione') {
        title = 'CAMPIONI!';
        lines.push({ text: 'Hai vinto la Coppa Pixel!', color: '#ffd23f' }, { text: `Coppe in bacheca: ${load().trophies ?? 1}`, color: '#ffffff' });
      } else if (res === 'avanti') {
        lines.push({ text: `Avanti: ${ROUND_NAMES[st.round]}!`, color: '#5be37d' });
      } else {
        lines.push({ text: 'Eliminato dalla coppa.', color: '#ff5a5a' });
        if (st.champion) lines.push({ text: `La coppa va a: ${teamById(st.champion).name}`, color: '#d8dcf0' });
      }
      return { title, titleColor: '#ffd23f', lines, retry: false, next: { label: 'TABELLONE', go: (s) => backToScene(s, 'tournament') } };
    }
    if (d.launch.mode === 'manager') {
      const m = load().manager && ensureManager(load().manager!);
      if (!m || m.season !== md.season || m.week !== md.week) return undefined;
      const isCup = cupDue(m);
      if ((md.cup ?? -1) !== (isCup ? m.cup!.round : -1)) return undefined;
      const label = `${nextMatch(m)?.label ?? ''} · ${isCup ? m.cup!.name : DIVISIONS[m.division].name}`;
      const mine = d.result.scorers.filter((s) => s.team === 0).map((s) => s.name);
      const pens = d.result.penalties ? d.result.penalties[0] > d.result.penalties[1] : undefined;
      const ap = applyMatch(m, a, b, mine, pens);
      save((s) => (s.manager = m));
      const rl = managerReportLines(m, ap, a, b);
      return {
        title: ap.cup ? rl[0].text : undefined,
        titleColor: rl[0].color,
        lines: [{ text: label, color: '#8a8fb0' }, ...rl.slice(1)],
        retry: false,
        next: { label: 'CLUB', go: (s) => backToScene(s, 'manager') },
      };
    }
    if (d.launch.mode === 'missioni') {
      const m = MISSIONS.find((x) => x.id === md.mission);
      if (!m) return undefined;
      const checks = m.goals.map((g) => ({ text: objectiveText(g), ok: checkObjective(g, d) }));
      const ok = checks.every((c) => c.ok);
      if (ok) save((s) => {
        s.missions = s.missions ?? { done: {} };
        s.missions.done[m.id] = true;
      });
      return {
        title: ok ? 'MISSIONE COMPIUTA!' : 'MISSIONE FALLITA',
        titleColor: ok ? '#5be37d' : '#ff5a5a',
        lines: [{ text: m.title, color: '#3fd0ff' }, ...checks],
        retry: true,
        next: { label: 'MISSIONI', go: (s) => backToScene(s, 'missions') },
      };
    }
    if (d.launch.mode === 'mito' && md.pro) {
      const c = load().career;
      const p = c?.pro;
      if (!c || !p || p.season !== md.season || p.round !== md.round || p.phase !== md.phase) return undefined;
      const nat = p.phase === 'nazionale';
      const rep = applyProResult(c, d);
      save((s) => {
        s.career = c;
        progressOf().coins += rep.salary;
      });
      const lines: ReportLine[] = [
        { text: nat ? 'FINALE DELLE NAZIONI' : `STAGIONE ${md.season} · GIORNATA ${md.round + 1}${rep.fromBench ? ' · DALLA PANCHINA' : ''}`, color: '#8a8fb0' },
        { text: `Voto di ${c.hero.name}: ${rep.vote}   ·   Gol: ${rep.goals}`, color: rep.vote >= 7 ? '#5be37d' : rep.vote < 6 ? '#ff9a9a' : '#ffffff' },
        { text: `Fiducia del mister ${rep.trust >= 0 ? '+' : ''}${rep.trust}   ·   Fama +${rep.rep}`, color: '#3fd0ff' },
        { text: `+${rep.points} punti abilità   ·   ingaggio +${rep.salary} monete`, color: '#ffd23f' },
      ];
      if (rep.seasonEnd) lines.push({ text: `Fine stagione: ${rep.seasonEnd.pos}° posto${rep.seasonEnd.prizes.length ? ' · ' + rep.seasonEnd.prizes.join(', ') : ''}`, color: '#ff7ab8' });
      if (nat) lines.push({ text: rep.natWon ? 'Campioni delle Nazioni!' : 'La Selezione del Mondo vince la finale', ok: !!rep.natWon });
      const after = rep.seasonEnd ? proSeasonEnd(c, rep) : nat ? [{ who: 'sara' as const, text: rep.natWon ? 'LA NAZIONALE PIXEL È CAMPIONE! {nome} alza la coppa sotto il cielo dello stadio!' : 'Finale persa, ma che orgoglio vedere {nome} con la maglia della Nazionale.' }] : [];
      return {
        title: nat ? (rep.natWon ? 'CAMPIONI!' : 'FINALE PERSA') : rep.res === 'w' ? 'VITTORIA!' : rep.res === 'l' ? 'SCONFITTA' : 'PAREGGIO',
        titleColor: rep.res === 'w' ? '#ffd23f' : rep.res === 'l' ? '#ff5a5a' : '#ffffff',
        lines,
        retry: false,
        next: {
          label: 'CONTINUA',
          go: (s) => (after.length ? backToScene(s, 'story', { lines: after, step: 0, then: 'career', saga: 'pro' }) : backToScene(s, 'career')),
        },
      };
    }
    if (d.launch.mode === 'mito') {
      const c = load().career;
      if (!c || c.step !== md.step || c.finished) return undefined;
      const step = STORY[c.step];
      const rep = applyCareerResult(c, d);
      save((s) => (s.career = c));
      const lines: ReportLine[] = [
        { text: `${step.chapter} · ${step.title}`, color: '#8a8fb0' },
        { text: rep.success ? 'Obiettivo raggiunto' : 'Obiettivo mancato', ok: rep.success },
        { text: `Gol di ${c.hero.name}: ${rep.heroGoals}   ·   Voto: ${rep.vote}`, color: rep.vote >= 7 ? '#5be37d' : rep.vote < 6 ? '#ff9a9a' : '#ffffff' },
        { text: `+${rep.points} punti abilità`, color: '#ffd23f' },
      ];
      if (rep.perk) lines.push({ text: `Nuova abilità: ${PERKS[rep.perk].name}`, color: '#ff7ab8' });
      return {
        title: rep.success ? 'OBIETTIVO RAGGIUNTO!' : 'OBIETTIVO FALLITO',
        titleColor: rep.success ? '#5be37d' : '#ff5a5a',
        lines,
        retry: false,
        next: {
          label: 'CONTINUA',
          go: (s) => backToScene(s, 'story', { lines: rep.success ? step.win : step.lose, step: md.step, then: 'career' }),
        },
      };
    }
    if (d.launch.mode === 'conquista') {
      const q = load().conquista;
      if (!q || q.step !== md.step || q.finished) return undefined;
      const idx = q.step;
      const rep = applyConquistaResult(q, d);
      save((s) => (s.conquista = q));
      const city = rep.city;
      const lines: ReportLine[] = [
        { text: `TAPPA ${idx + 1} · ${city.name}`, color: '#8a8fb0' },
        { text: CQ_GOAL_TEXT[city.goal], ok: rep.success },
        { text: `Gol del capitano: ${rep.captainGoals}`, color: '#ffffff' },
      ];
      if (rep.success && idx < CITIES.length - 1) lines.push({ text: `Ricordo: ${city.souvenir.name}`, color: '#ff7ab8' });
      return {
        title: rep.finished ? 'COPPA VINTA!' : rep.success ? `${city.name} CONQUISTATA!` : 'NON ANCORA...',
        titleColor: rep.success ? '#5be37d' : '#ff5a5a',
        lines,
        retry: false,
        next: {
          label: 'CONTINUA',
          go: (s) => backToScene(s, 'story', {
            lines: rep.success ? city.win : city.lose, step: idx, then: 'conquista', saga: 'conquista', celebrate: rep.success ? idx : undefined,
          }),
        },
      };
    }
    return undefined;
  }
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const { launch, result } = this.data_;
    const cfg = launch.config;
    const [a, b] = result.score;
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.72).setOrigin(0).setInteractive();
    const rep = this.report;
    // con i rigori conta chi ha vinto la serie
    const pa = result.penalties ? a * 100 + result.penalties[0] : a;
    const pb = result.penalties ? b * 100 + result.penalties[1] : b;
    const title = rep?.title ?? (pa > pb ? 'VITTORIA!' : pa < pb ? 'SCONFITTA' : 'PAREGGIO');
    const col = rep?.title ? rep.titleColor ?? '#ffffff' : pa > pb ? '#ffd23f' : pa < pb ? '#ff5a5a' : '#ffffff';
    if (cfg.humanTeam === 0) {
      if (pa > pb) sfx.fanfare();
      else if (pa < pb) sfx.sadJingle();
    }
    this.time.delayedCall(2600, () => music.play('menu'));
    if (this.packs > 0 || this.coins > 0) {
      const parts = [];
      if (this.coins > 0) parts.push(`+${this.coins} MONETE${(this.data_.style ?? 0) > 0 ? ` (stile +${(this.data_.style ?? 0) * 5})` : ''}`);
      if (this.packs > 0) parts.push(`+${this.packs} PACCHETT${this.packs > 1 ? 'I' : 'O'}`);
      const pk = txt(this, W / 2, 285, parts.join('  ·  '), 6, '#1a1222', { backgroundColor: '#ffd23f', padding: { x: 4, y: 3 } }).setDepth(5);
      this.tweens.add({ targets: pk, scale: 1.06, duration: 500, yoyo: true, repeat: 3 });
      if (this.coins > 0) this.time.delayedCall(700, () => sfx.coin());
    }
    // novità della crescita e delle rivalità: una alla volta, a rotazione
    if (this.news.length) {
      const nt = txt(this, W / 2, 300, this.news[0].text, 6, this.news[0].color, { backgroundColor: '#0d0a1acc', padding: { x: 4, y: 2 } }).setDepth(5);
      let i = 0;
      if (this.news.length > 1) {
        this.time.addEvent({
          delay: 2200,
          loop: true,
          callback: () => {
            i = (i + 1) % this.news.length;
            nt.setText(this.news[i].text).setColor(this.news[i].color);
          },
        });
      }
    }
    const t = shadowTxt(this, W / 2, 34, title, title.length > 12 ? 16 : 24, col, '#1a1222', 3);
    t.c.setScale(0.3);
    this.tweens.add({ targets: t.c, scale: 1, duration: 450, ease: 'Back.easeOut' });

    const g = this.add.graphics();
    panel(g, W / 2 - 170, 62, 340, 210, 0x1b1d2e, 0x2e3250, 0.95);
    g.fillStyle(cfg.home.colors.shirt).fillRect(W / 2 - 160, 72, 8, 24);
    g.fillStyle(cfg.away.colors.shirt).fillRect(W / 2 + 152, 72, 8, 24);
    txt(this, W / 2 - 100, 84, cfg.home.short, 8);
    txt(this, W / 2 + 100, 84, cfg.away.short, 8);
    shadowTxt(this, W / 2, 84, `${a} - ${b}`, 24, '#ffffff');
    if (result.goldenGoal) txt(this, W / 2, 106, 'GOLDEN GOL', 6, '#ffd23f');
    if (result.penalties) txt(this, W / 2, 106, `RIGORI ${result.penalties[0]} - ${result.penalties[1]}`, 6, '#ffd23f');

    // marcatori
    const home = result.scorers.filter((s) => s.team === 0);
    const away = result.scorers.filter((s) => s.team === 1);
    const fmt = (s: { name: string; time: number }) => `${s.name} ${Math.max(1, Math.ceil(s.time / 60))}'`;
    home.slice(0, 4).forEach((s, i) => txt(this, W / 2 - 100, 120 + i * 11, fmt(s), 6, '#d8dcf0'));
    away.slice(0, 4).forEach((s, i) => txt(this, W / 2 + 100, 120 + i * 11, fmt(s), 6, '#d8dcf0'));

    // statistiche
    const st = result.stats;
    const rows: [string, number, number, string?][] = [
      ['TIRI', st.shots[0], st.shots[1]],
      ['PASSAGGI', st.passes[0], st.passes[1]],
      ['CONTRASTI', st.tackles[0], st.tackles[1]],
      ['POSSESSO', st.possession[0], st.possession[1], '%'],
    ];
    if (rep) {
      rep.lines.forEach((l, i) => {
        const yy = 172 + i * 16;
        if (l.ok !== undefined) {
          const bx = W / 2 - 150;
          g.fillStyle(0x1a1222).fillRect(bx - 1, yy - 6, 12, 12);
          g.fillStyle(l.ok ? COLORS.good : COLORS.bad).fillRect(bx + 1, yy - 4, 8, 8);
          txt(this, bx + 18, yy, l.text, 6, l.ok ? '#5be37d' : '#ff9a9a').setOrigin(0, 0.5);
        } else {
          txt(this, W / 2, yy, l.text, 6, l.color ?? '#ffffff');
        }
      });
    }
    if (!rep) rows.forEach(([label, x, y, suf], i) => {
      const yy = 176 + i * 22;
      txt(this, W / 2, yy - 6, label, 6, '#8a8fb0');
      txt(this, W / 2 - 140, yy, `${x}${suf ?? ''}`, 8).setOrigin(0, 0.5);
      txt(this, W / 2 + 140, yy, `${y}${suf ?? ''}`, 8).setOrigin(1, 0.5);
      const tot = x + y || 1;
      const bw = 180;
      g.fillStyle(0x2e3250).fillRect(W / 2 - bw / 2, yy + 2, bw, 4);
      g.fillStyle(cfg.home.colors.shirt).fillRect(W / 2 - bw / 2, yy + 2, Math.round((bw * x) / tot), 4);
      g.fillStyle(cfg.away.colors.shirt).fillRect(W / 2 - bw / 2 + Math.round((bw * x) / tot), yy + 2, bw - Math.round((bw * x) / tot), 4);
    });

    if (this.trophyWon) this.time.delayedCall(1400, () => sfx.fanfare());
    // pagella: si apre sopra il riquadro
    let sheet: Phaser.GameObjects.Container | undefined;
    const pgb = button(this, 46, H - 34, 76, 26, 'PAGELLA', () => {
      if (sheet) {
        sheet.destroy();
        sheet = undefined;
        pgb.setSelected(false);
        return;
      }
      sheet = this.pagella(this.data_);
      pgb.setSelected(true);
    }, { size: 6, color: 0x8a3fd0 });

    if (rep) {
      if (rep.retry) button(this, W / 2 - 80, H - 34, 140, 30, 'RIPROVA', () => startMatch(this, launch), { color: 0x3a3d55 });
      button(this, rep.retry ? W / 2 + 80 : W / 2, H - 34, 140, 30, rep.next.label, () => rep.next.go(this), { color: COLORS.good, textColor: '#1a1222' });
      return;
    }
    if (launch.mode !== 'quick') {
      // partita di una modalità già registrata (non dovrebbe succedere): si torna al menu
      button(this, W / 2, H - 34, 140, 30, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
      return;
    }
    button(this, W / 2 - 80, H - 34, 140, 30, 'RIVINCITA', () => startMatch(this, launch), { color: COLORS.good, textColor: '#1a1222' });
    button(this, W / 2 + 80, H - 34, 140, 30, 'MENU', () => backToMenu(this), { color: 0x3a3d55 });
  }
}
