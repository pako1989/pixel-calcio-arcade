import type { PlayerDef, Role, TeamDef } from '../sim/types';

/**
 * Progressi del giocatore fuori dalla partita: monete e negozio, crescita dei giocatori
 * della squadra che usi, rivalità con le squadre che ti battono.
 */

export type ShopCat = 'pallone' | 'maglia' | 'esultanza';

export interface ShopItem {
  id: string;
  cat: ShopCat;
  name: string;
  price: number;
  desc: string;
}

export const SHOP: ShopItem[] = [
  { id: 'pallone:classico', cat: 'pallone', name: 'Classico', price: 0, desc: 'Bianco e nero, come una volta.' },
  { id: 'pallone:fragola', cat: 'pallone', name: 'Fragola', price: 120, desc: 'Rosa acceso: si vede da lontano.' },
  { id: 'pallone:lime', cat: 'pallone', name: 'Lime', price: 120, desc: 'Verde fluo per le notti in notturna.' },
  { id: 'pallone:notte', cat: 'pallone', name: 'Notte', price: 150, desc: 'Blu elettrico.' },
  { id: 'pallone:oro', cat: 'pallone', name: 'Oro', price: 350, desc: 'Per chi ha vinto tutto.' },
  { id: 'pallone:arcobaleno', cat: 'pallone', name: 'Arcobaleno', price: 500, desc: 'Cambia colore mentre rotola.' },
  { id: 'maglia:normale', cat: 'maglia', name: 'Normale', price: 0, desc: 'I colori della tua squadra.' },
  { id: 'maglia:nera', cat: 'maglia', name: 'Nera', price: 250, desc: 'Terza maglia total black.' },
  { id: 'maglia:retro', cat: 'maglia', name: 'Retrò', price: 250, desc: 'Righe e colori anni 80.' },
  { id: 'maglia:neon', cat: 'maglia', name: 'Neon', price: 350, desc: 'Fucsia e azzurro fluo.' },
  { id: 'maglia:dorata', cat: 'maglia', name: 'Dorata', price: 600, desc: 'La maglia dei campioni.' },
  { id: 'esultanza:salto', cat: 'esultanza', name: 'Salto', price: 0, desc: 'Salti di gioia.' },
  { id: 'esultanza:capriola', cat: 'esultanza', name: 'Capriola', price: 200, desc: 'Una capriola in aria dopo il gol.' },
  { id: 'esultanza:scivolata', cat: 'esultanza', name: 'Scivolata', price: 200, desc: 'In ginocchio sull\'erba verso il pubblico.' },
  { id: 'esultanza:aeroplano', cat: 'esultanza', name: 'Aeroplano', price: 200, desc: 'A braccia aperte come un aereo.' },
  { id: 'esultanza:trottola', cat: 'esultanza', name: 'Trottola', price: 300, desc: 'Gira su se stesso come una trottola.' },
];

/** Pacchetto di figurine in vendita. */
export const PACK_PRICE = 80;

export interface ProgressSave {
  coins: number;
  owned: string[];
  equip: Record<ShopCat, string>;
  /** Esperienza dei giocatori per squadra: xp[teamId][indice]. */
  xp: Record<string, number[]>;
  /** Bilancio contro ogni squadra. */
  vs: Record<string, { w: number; d: number; l: number }>;
}

export function newProgress(): ProgressSave {
  return {
    coins: 100,
    owned: SHOP.filter((i) => i.price === 0).map((i) => i.id),
    equip: { pallone: 'pallone:classico', maglia: 'maglia:normale', esultanza: 'esultanza:salto' },
    xp: {},
    vs: {},
  };
}

export function buy(p: ProgressSave, id: string): boolean {
  const it = SHOP.find((i) => i.id === id);
  if (!it || p.owned.includes(id) || p.coins < it.price) return false;
  p.coins -= it.price;
  p.owned.push(id);
  p.equip[it.cat] = id;
  return true;
}

export function equip(p: ProgressSave, id: string): boolean {
  const it = SHOP.find((i) => i.id === id);
  if (!it || !p.owned.includes(id)) return false;
  p.equip[it.cat] = id;
  return true;
}

export const equipped = (p: ProgressSave | undefined, cat: ShopCat) => (p?.equip[cat] ?? newProgress().equip[cat]).split(':')[1];

// ---------- crescita ----------

/** Esperienza necessaria per ogni livello (1..5). */
export const LEVEL_XP = [0, 60, 160, 320, 550];
export const MAX_LEVEL = LEVEL_XP.length;

export function levelOf(xp: number): number {
  let l = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) l = i + 1;
  return l;
}

interface Skill {
  id: string;
  name: string;
  desc: string;
}

/** Abilità per ruolo: la prima al livello 3, la seconda al livello 5. */
export const SKILLS: Record<Role, [Skill, Skill]> = {
  FWD: [
    { id: 'bomber', name: 'Bomber', desc: 'Tiro più potente e preciso.' },
    { id: 'giro', name: 'Tiro a giro', desc: 'I tiri curvano verso il palo lontano.' },
  ],
  MID: [
    { id: 'regista', name: 'Regista', desc: 'Passaggi più precisi.' },
    { id: 'motore', name: 'Motore', desc: 'Si stanca molto meno quando scatta.' },
  ],
  DEF: [
    { id: 'roccia', name: 'Roccia', desc: 'Contrasti più efficaci.' },
    { id: 'motore', name: 'Motore', desc: 'Si stanca molto meno quando scatta.' },
  ],
  GK: [
    { id: 'riflessi', name: 'Riflessi', desc: 'Para di più.' },
    { id: 'gattone', name: 'Gattone', desc: 'Tuffi ancora più lunghi.' },
  ],
};

export function skillsAt(role: Role, level: number): Skill[] {
  const [a, b] = SKILLS[role];
  return [...(level >= 3 ? [a] : []), ...(level >= 5 ? [b] : [])];
}

/** Il giocatore con i bonus della sua crescita. */
export function grownPlayer(pd: PlayerDef, xp: number): PlayerDef {
  const lv = levelOf(xp);
  if (lv <= 1) return pd;
  const k = (lv - 1) * 0.025;
  const sk = skillsAt(pd.role, lv).map((s) => s.id);
  const st = { ...pd.stats };
  for (const key of Object.keys(st) as (keyof typeof st)[]) st[key] = Math.min(1.25, st[key] + k);
  if (sk.includes('bomber')) st.shot += 0.08;
  if (sk.includes('regista')) st.pass += 0.1;
  if (sk.includes('roccia')) st.tackle += 0.1;
  if (sk.includes('riflessi')) st.keeping += 0.08;
  if (sk.includes('gattone')) st.keeping += 0.08;
  return { ...pd, stats: st, skills: sk };
}

export function grownTeam(t: TeamDef, p: ProgressSave | undefined): TeamDef {
  const xp = p?.xp[t.id];
  if (!xp) return t;
  return { ...t, players: t.players.map((pd, i) => grownPlayer(pd, xp[i] ?? 0)) };
}

export interface LevelUp {
  name: string;
  level: number;
  skill?: string;
}

/** Esperienza dopo una partita: presenza, gol e vittoria. */
export function addMatchXp(p: ProgressSave, team: TeamDef, scorers: string[], won: boolean): LevelUp[] {
  const xp = (p.xp[team.id] = p.xp[team.id] ?? team.players.map(() => 0));
  const ups: LevelUp[] = [];
  team.players.forEach((pd, i) => {
    const before = levelOf(xp[i] ?? 0);
    xp[i] = (xp[i] ?? 0) + 12 + (won ? 15 : 0) + scorers.filter((n) => n === pd.name).length * 25;
    const after = levelOf(xp[i]);
    if (after > before) {
      const sk = skillsAt(pd.role, after).filter((s) => !skillsAt(pd.role, before).includes(s));
      ups.push({ name: pd.name, level: after, skill: sk[0]?.name });
    }
  });
  return ups;
}

// ---------- rivalità ----------

/** Una squadra è rivale se ti ha battuto almeno due volte più di quante l'hai battuta tu. */
export function isRival(p: ProgressSave | undefined, teamId: string): boolean {
  const r = p?.vs[teamId];
  return !!r && r.l - r.w >= 2;
}

export function recordVs(p: ProgressSave, teamId: string, result: 'w' | 'd' | 'l'): { wasRival: boolean; nowRival: boolean } {
  const wasRival = isRival(p, teamId);
  const r = (p.vs[teamId] = p.vs[teamId] ?? { w: 0, d: 0, l: 0 });
  r[result]++;
  return { wasRival, nowRival: isRival(p, teamId) };
}

/** Monete guadagnate con una partita. */
export function coinsForMatch(myGoals: number, result: 'w' | 'd' | 'l', style: number, rival: boolean): number {
  const base = 20 + myGoals * 10 + (result === 'w' ? 30 : result === 'd' ? 10 : 0) + style * 5;
  return rival && result === 'w' ? base * 2 : base;
}

// ---------- aspetto ----------

/** La maglia scelta nel negozio applicata alla squadra (il portiere resta com'è). */
export function kitVariant(t: TeamDef, kit: string): TeamDef {
  const c = t.colors;
  switch (kit) {
    case 'nera':
      return { ...t, pattern: 'sash', colors: { ...c, shirt: 0x1c1c26, shirt2: c.shirt, shorts: 0x1c1c26, socks: 0x1c1c26 } };
    case 'retro':
      return { ...t, pattern: 'hoops', colors: { ...c, shirt2: 0xf2e6c8, shorts: 0xf2e6c8, socks: c.shirt } };
    case 'neon':
      return { ...t, pattern: 'half', colors: { ...c, shirt: 0xff3fa4, shirt2: 0x3fd0ff, shorts: 0x1a1a2a, socks: 0x3fd0ff } };
    case 'dorata':
      return { ...t, pattern: 'sash', colors: { ...c, shirt: 0xffc83a, shirt2: 0xfff2a0, shorts: 0xffffff, socks: 0xffc83a } };
    default:
      return t;
  }
}

/** Tinta del pallone (null = nessuna; l'arcobaleno cambia colore da solo). */
export function ballTint(skin: string, t: number): number | null {
  switch (skin) {
    case 'fragola':
      return 0xff7ab8;
    case 'lime':
      return 0xb8ff5a;
    case 'notte':
      return 0x6aa8ff;
    case 'oro':
      return 0xffd040;
    case 'arcobaleno': {
      const h = (t * 0.35) % 1;
      const f = (n: number) => {
        const k = (n + h * 6) % 6;
        return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)) * 0.6));
      };
      return (f(5) << 16) | (f(3) << 8) | f(1);
    }
    default:
      return null;
  }
}

/** Le modalità in cui usi una squadra vera: lì crescono i giocatori e contano le rivalità. */
export const GROWTH_MODES = ['quick', 'torneo', 'missioni'];
