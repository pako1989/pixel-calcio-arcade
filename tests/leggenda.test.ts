import { describe, expect, it } from 'vitest';
import {
  EpicMatch, TECHS, canLearn, episodeReward, learn, newLeggenda, objectiveMet, trainingReward,
  type AttackAction, type DefKind, type Encounter,
} from '../src/modes/leggenda';
import { EPISODES, heroTeam, rivalTeam } from '../src/modes/leggendaStory';

/** Gioca una partita intera con un giocatore "medio" che sceglie in modo semplice. */
export function playBot(ep: number, seed: number, known: string[], assist = 4) {
  const e = EPISODES[ep];
  const m = new EpicMatch(heroTeam(ep), rivalTeam(ep), { minutes: e.minutes, assist, known, injured: e.injured, seed });
  let guard = 0;
  const kinds: DefKind[] = ['contrasto', 'intercetto', 'blocco'];
  while (!m.over && guard++ < 2000) {
    m.checkHalf();
    const enc = m.nextEncounter();
    m.advanceTo(enc ? enc.x : m.shootSpot());
    if (m.over) break;
    if (m.side === 0) {
      const c = m.carrier;
      const shots = m.techsOf(c, 'tiro');
      const d = m.distance();
      let a: AttackAction;
      if (!enc || (d < 30 && m.rng.chance(0.5))) a = { kind: 'tiro', tech: shots.find((t) => d <= (TECHS[t].range ?? 22) + 5) };
      else if (m.rng.chance(0.35) && m.passTargets().length) a = { kind: 'passaggio', to: m.passTargets()[0].id, tech: m.techsOf(c, 'passaggio')[0] };
      else a = { kind: 'dribbling', tech: m.rng.chance(0.5) ? m.techsOf(c, 'dribbling')[0] : undefined };
      if (a.kind === 'tiro') {
        const def = enc ? m.aiDefense(enc) : null;
        const s = m.shoot(a, enc, def);
        if (!s.blocked) m.save(s, m.aiKeeper(s));
      } else m.duel(a, enc, enc ? m.aiDefense(enc) : { kind: 'intercetto' });
    } else {
      const a = m.aiAttack(enc);
      const mine = { kind: m.rng.pick(kinds) } as const;
      if (a.kind === 'tiro') {
        const s = m.shoot(a, enc as Encounter | null, enc ? mine : null);
        if (!s.blocked) {
          const gk = m.keeper(0);
          const tech = m.techsOf(gk.id, 'parata')[0];
          m.save(s, { kind: s.power > 85 ? 'pugno' : 'presa', tech: s.tech ? tech : undefined });
        }
      } else m.duel(a, enc, mine);
    }
  }
  return m;
}

function knownAt(ep: number): string[] {
  const k: string[] = [];
  EPISODES.slice(0, ep + 1).forEach((e) => k.push(...(e.teaches ?? [])));
  // giocatore che ha imparato le tecniche disponibili a quel punto
  for (const id of Object.keys(TECHS)) {
    const u = TECHS[id].unlock;
    if (u?.pts && ep >= u.ep) k.push(id);
  }
  if (ep === 9) k.push('aurora');
  return k;
}

describe('leggenda del pallone', () => {
  it('una partita finisce e il punteggio è coerente', () => {
    const m = playBot(0, 7, knownAt(0));
    expect(m.over).toBe(true);
    expect(m.scorers.length).toBe(m.score[0] + m.score[1]);
  });

  it('ogni episodio è vincibile ma non banale', () => {
    const rates: number[] = [];
    for (let ep = 0; ep < EPISODES.length; ep++) {
      let ok = 0;
      let gf = 0;
      let ga = 0;
      const N = 120;
      for (let s = 1; s <= N; s++) {
        const m = playBot(ep, s * 97 + ep, knownAt(ep));
        if (objectiveMet(EPISODES[ep].objective, m.score)) ok++;
        gf += m.score[0];
        ga += m.score[1];
      }
      const rate = ok / N;
      // eslint-disable-next-line no-console
      console.log(`ep ${ep + 1}: obiettivo ${Math.round(rate * 100)}%  gol ${(gf / N).toFixed(1)}-${(ga / N).toFixed(1)}`);
      rates.push(rate);
    }
    for (const r of rates) {
      expect(r).toBeGreaterThan(0.3);
      expect(r).toBeLessThan(0.97);
    }
  });

  it('tecniche, punti e premi', () => {
    const s = newLeggenda();
    expect(canLearn(s, 'vortice')).toBe(false);
    s.cleared = 1;
    s.pts = 50;
    expect(learn(s, 'vortice')).toBe(true);
    expect(s.pts).toBe(10);
    expect(learn(s, 'cometa')).toBe(false);
    const r = episodeReward(s, 1, true, { duelsWon: 5, score: [2, 1], specialGoals: 1 });
    expect(r.first).toBe(true);
    expect(s.cleared).toBe(2);
    expect(r.coins).toBeGreaterThan(0);
    const again = episodeReward(s, 1, true, { duelsWon: 0, score: [1, 0], specialGoals: 0 });
    expect(again.first).toBe(false);
    expect(trainingReward(s, 12, '2026-11-19')).toBe(12);
    trainingReward(s, 12, '2026-11-19');
    trainingReward(s, 12, '2026-11-19');
    expect(trainingReward(s, 12, '2026-11-19')).toBe(3);
  });
});
