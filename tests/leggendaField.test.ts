import { describe, expect, it } from 'vitest';
import { TECHS, objectiveMet, type AttackAction, type DefKind } from '../src/modes/leggenda';
import { CONTACT, CY, FieldMatch } from '../src/modes/leggendaField';
import { EPISODES, heroTeam, rivalTeam } from '../src/modes/leggendaStory';

function knownAt(ep: number): string[] {
  const k: string[] = [];
  EPISODES.slice(0, ep + 1).forEach((e) => k.push(...(e.teaches ?? [])));
  for (const id of Object.keys(TECHS)) {
    const u = TECHS[id].unlock;
    if (u?.pts && ep >= u.ep) k.push(id);
  }
  if (ep === 9) k.push('aurora');
  return k;
}

const READ = { dribbling: 'contrasto', passaggio: 'intercetto', tiro: 'blocco' } as const;

/** Un giocatore "medio": corre verso la porta col joystick e sceglie in modo semplice. */
export function playField(ep: number, seed: number, assist = 4) {
  const e = EPISODES[ep];
  const m = new FieldMatch(heroTeam(ep), rivalTeam(ep), { minutes: e.minutes, assist, known: knownAt(ep), injured: e.injured, seed });
  const kinds: DefKind[] = ['contrasto', 'intercetto', 'blocco'];
  let guard = 0;
  let stats = { contacts: 0, shots: 0, cpuShots: 0 };
  while (!m.over && guard++ < 40000) {
    m.checkHalf();
    let stick = null as null | { mx: number; my: number };
    const me = m.pos[m.ctrl];
    if (m.side === 0) stick = { mx: 1, my: (CY - me.y) * 0.05 + Math.sin(guard / 30) * 0.6 };
    else {
      const b = m.pos[m.carrier];
      stick = { mx: b.x - me.x, my: b.y - me.y };
    }
    const ev = m.step(0.1, stick);
    if (!ev) continue;
    if (ev.t === 'contact' || ev.t === 'keeper') {
      stats.contacts++;
      const enc = ev.t === 'contact' ? m.encounter(ev.def) : null;
      if (m.side === 0) {
        const c = m.carrier;
        const d = m.distance();
        const shots = m.techsOf(c, 'tiro');
        let a: AttackAction;
        if (!enc || (d < 28 && m.rng.chance(0.5))) a = { kind: 'tiro', tech: shots.find((t) => d <= (TECHS[t].range ?? 22) + 5) };
        else if (m.rng.chance(0.3) && m.passTargets().length) a = { kind: 'passaggio', to: m.passTargets()[0].id };
        else a = { kind: 'dribbling', tech: m.rng.chance(0.5) ? m.techsOf(c, 'dribbling')[0] : undefined };
        if (a.kind === 'tiro') {
          stats.shots++;
          const s = m.shoot(a, enc, enc ? m.aiDefense(enc) : null);
          if (!s.blocked) m.save(s, m.aiKeeper(s));
        } else m.duel(a, enc, enc ? m.aiDefense(enc) : { kind: 'intercetto' });
      } else {
        const a = m.aiAttack(enc);
        // come un giocatore vero: segue l'indizio (giusto 7 volte su 10)
        const guess = m.hint(a.kind === 'avanza' ? 'dribbling' : a.kind, ['dribbling', 'passaggio', 'tiro'] as const);
        const mine = { kind: m.rng.chance(0.6) ? READ[guess] : m.rng.pick(kinds) };
        if (a.kind === 'tiro') {
          stats.cpuShots++;
          const s = m.shoot(a, enc, mine);
          if (!s.blocked) m.save(s, { kind: s.power > 85 ? 'pugno' : 'presa', tech: s.tech ? m.techsOf(m.keeper(0).id, 'parata')[0] : undefined });
        } else m.duel(a, enc, mine);
      }
    } else if (ev.t === 'cpuShot') {
      stats.cpuShots++;
      const s = m.shoot({ kind: 'tiro', tech: m.techsOf(m.carrier, 'tiro').find((t) => m.distance() <= (TECHS[t].range ?? 22) + 4) }, null, null);
      if (!s.blocked) m.save(s, { kind: s.power > 85 ? 'pugno' : 'presa', tech: s.tech ? m.techsOf(m.keeper(0).id, 'parata')[0] : undefined });
    } else if (ev.t === 'cpuPass') {
      m.duel({ kind: 'passaggio', to: ev.to }, null, { kind: 'intercetto' });
    }
  }
  return { m, stats, guard };
}

describe('leggenda: campo libero', () => {
  it('ci si scontra, la partita finisce e il punteggio è coerente', () => {
    const { m, stats } = playField(0, 11);
    expect(m.over).toBe(true);
    expect(stats.contacts).toBeGreaterThan(5);
    expect(m.scorers.length).toBe(m.score[0] + m.score[1]);
  });

  it('chi ti tocca è davvero vicino', () => {
    const m = new FieldMatch(heroTeam(0), rivalTeam(0), { minutes: 30, assist: 4, known: [], seed: 3 });
    for (let i = 0; i < 400; i++) {
      const ev = m.step(0.1, m.side === 0 ? { mx: 1, my: 0 } : null);
      if (ev?.t === 'contact') {
        const a = m.pos[m.carrier];
        const b = m.pos[ev.def];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(CONTACT);
        return;
      }
    }
    throw new Error('nessuno scontro');
  });

  it('dopo un passaggio si comanda chi riceve, e si muove', () => {
    const m = new FieldMatch(heroTeam(3), rivalTeam(3), { minutes: 40, assist: 60, known: [], seed: 5 });
    expect(m.side).toBe(0);
    const to = m.passTargets()[0].id;
    m.engagers = [];
    const steps = m.duel({ kind: 'passaggio', to }, null, { kind: 'intercetto' });
    if (!steps.some((s) => s.t === 'pass')) return;
    expect(m.carrier).toBe(to);
    expect(m.ctrl).toBe(to);
    m.cooldown = 5;
    const x0 = m.pos[to].x;
    m.step(0.5, { mx: 1, my: 0 });
    expect(m.pos[to].x).toBeGreaterThan(x0 + 2);
  });

  it('ogni episodio è vincibile ma non banale', () => {
    const rates: number[] = [];
    for (let ep = 0; ep < EPISODES.length; ep++) {
      let ok = 0;
      let gf = 0;
      let ga = 0;
      let c = 0;
      const N = 60;
      for (let s = 1; s <= N; s++) {
        const { m, stats } = playField(ep, s * 131 + ep);
        if (objectiveMet(EPISODES[ep].objective, m.score)) ok++;
        gf += m.score[0];
        ga += m.score[1];
        c += stats.contacts;
      }
      const rate = ok / N;
      // eslint-disable-next-line no-console
      console.log(`campo ep ${ep + 1}: obiettivo ${Math.round(rate * 100)}%  gol ${(gf / N).toFixed(1)}-${(ga / N).toFixed(1)}  scontri ${(c / N).toFixed(0)}`);
      rates.push(rate);
    }
    for (const r of rates) {
      expect(r).toBeGreaterThan(0.2);
      expect(r).toBeLessThan(0.98);
    }
  });
});
