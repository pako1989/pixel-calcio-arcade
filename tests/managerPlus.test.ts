import { describe, expect, it } from 'vitest';
import {
  applyManagerResult, canPromote, dismissStaff, ensureManager, gazzetta, hireStaff, MAX_SQUAD, MIN_SQUAD, newManager, payroll,
  promoteCost, promoteProspect, refreshMarket, staffUpgrade, weeklyBalance, type ManagerState,
} from '../src/modes/manager';
import { potentialLabel, potentialStars, staffWage, totalStaffWages } from '../src/modes/managerStaff';

function playSeason(st: ManagerState, mine: (st: ManagerState) => [number, number]) {
  const s = st.season;
  let guard = 0;
  while (st.season === s && guard++ < 40) {
    const [a, b] = mine(st);
    applyManagerResult(st, a, b, []);
    st.event = undefined;
  }
}

describe('manager: staff', () => {
  it('assumere costa soldi, alza lo stipendio settimanale e si può licenziare', () => {
    const st = newManager('Borgo FC', 0, 'normale', 4);
    st.budget = 50000;
    const before = payroll(st);
    const up = staffUpgrade(st, 'medico')!;
    expect(up.level).toBe(1);
    expect(hireStaff(st, 'medico')).toBe(true);
    expect(st.budget).toBe(50000 - up.cost);
    expect(payroll(st)).toBe(before + up.wage);
    expect(weeklyBalance(st).salaries).toBe(payroll(st));
    expect(dismissStaff(st, 'medico')).toBe(true);
    expect(payroll(st)).toBe(before);
  });

  it('senza soldi non si assume e al livello massimo non c\'è altro', () => {
    const st = newManager('Borgo FC', 0, 'normale', 4);
    st.budget = 10;
    expect(hireStaff(st, 'allenatore')).toBe(false);
    st.budget = 1e7;
    for (let i = 0; i < 3; i++) expect(hireStaff(st, 'allenatore')).toBe(true);
    expect(staffUpgrade(st, 'allenatore')).toBeNull();
    expect(hireStaff(st, 'allenatore')).toBe(false);
  });

  it('il preparatore fa recuperare energia e l\'allenatore fa crescere di più', () => {
    const run = (lvl: number) => {
      const st = newManager('Borgo FC', 0, 'normale', 9);
      st.staff = { allenatore: lvl, preparatore: lvl, medico: 0, osservatore: 0 };
      st.training = 'tecnica';
      for (const p of st.squad) p.energy = 40;
      const ovr = st.squad.reduce((t, p) => t + p.stats.control, 0);
      applyManagerResult(st, 0, 0, []);
      return { energy: st.squad.reduce((t, p) => t + p.energy, 0), growth: st.squad.reduce((t, p) => t + p.stats.control, 0) - ovr };
    };
    const a = run(0);
    const b = run(3);
    expect(b.energy).toBeGreaterThan(a.energy);
    expect(b.growth).toBeGreaterThan(a.growth);
  });

  it('il medico riduce gli infortuni', () => {
    const count = (lvl: number) => {
      let inj = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const st = newManager('Borgo FC', 0, 'normale', seed);
        st.staff = { allenatore: 0, preparatore: 0, medico: lvl, osservatore: 0 };
        for (const p of st.squad) p.energy = 30;
        applyManagerResult(st, 1, 1, []);
        inj += st.squad.filter((p) => p.injured).length;
      }
      return inj;
    };
    expect(count(3)).toBeLessThan(count(0));
  });

  it('un osservatore alza il livello del mercato', () => {
    const avg = (lvl: number) => {
      let t = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const st = newManager('Borgo FC', 0, 'normale', seed);
        st.staff = { allenatore: 0, preparatore: 0, medico: 0, osservatore: lvl };
        refreshMarket(st);
        t += st.market.reduce((n, p) => n + p.stats.shot + p.stats.control, 0);
      }
      return t;
    };
    expect(avg(3)).toBeGreaterThan(avg(0));
  });

  it('gli stipendi dello staff pesano in proporzione alla divisione', () => {
    expect(staffWage(1, 2500)).toBeLessThan(staffWage(1, 14000));
    expect(totalStaffWages({ allenatore: 3, preparatore: 3, medico: 3, osservatore: 3 }, 2500)).toBeLessThan(2500 * 1.0);
  });

  it('le fasce di potenziale contengono sempre il valore vero', () => {
    for (let id = 0; id < 30; id++) {
      for (let pot = 0.6; pot <= 1.25; pot += 0.01) {
        const s = potentialStars(pot);
        for (const lvl of [1, 2, 3]) {
          const lab = potentialLabel(pot, lvl, id);
          const m = lab.match(/^(\d)(?:-(\d))?\/5$/)!;
          const lo = +m[1];
          const hi = m[2] ? +m[2] : lo;
          expect(lo).toBeLessThanOrEqual(s);
          expect(hi).toBeGreaterThanOrEqual(s);
        }
      }
    }
    expect(potentialLabel(1, 0, 3)).toBe('?/5');
  });
});

describe('manager: vivaio, premi e giornale', () => {
  it('a fine stagione arrivano i provini e il primo si promuove gratis', () => {
    const st = newManager('Borgo FC', 0, 'normale', 5);
    while (st.squad.length > MIN_SQUAD + 2) st.squad.pop();
    playSeason(st, () => [1, 1]);
    const ac = st.academy!;
    expect(ac.prospects.length).toBeGreaterThan(0);
    expect(st.seasonEnd?.prospects).toBe(ac.prospects.length);
    const n = st.squad.length;
    const first = ac.prospects[0];
    if (ac.promoted === 0) {
      expect(promoteCost(st, first)).toBe(0);
      expect(promoteProspect(st, first.id)).toBe(true);
      expect(st.squad.length).toBe(n + 1);
      expect(st.squad.some((p) => p.id === first.id)).toBe(true);
    }
    // dal secondo in poi si paga
    const second = ac.prospects[0];
    if (second) expect(promoteCost(st, second)).toBeGreaterThan(0);
  });

  it('con la rosa piena non si promuove nessuno', () => {
    const st = newManager('Borgo FC', 0, 'normale', 6);
    playSeason(st, () => [1, 1]);
    while (st.squad.length < MAX_SQUAD) st.squad.push({ ...st.squad[0], id: 900 + st.squad.length });
    const p = st.academy!.prospects[0];
    if (p) expect(canPromote(st, p.id)).toBe('ROSA PIENA');
  });

  it('se la rosa è corta i migliori provini entrano da soli', () => {
    const st = newManager('Borgo FC', 0, 'normale', 12);
    while (st.squad.length > 4) st.squad.pop();
    playSeason(st, () => [1, 1]);
    expect(st.squad.length).toBeGreaterThanOrEqual(Math.min(MAX_SQUAD, MIN_SQUAD + 1) - 1);
    expect(st.seasonEnd!.youth.length).toBeGreaterThan(0);
  });

  it('premi di fine stagione: capocannoniere, giocatore dell\'anno e albo', () => {
    const st = newManager('Borgo FC', 1, 'normale', 3);
    const bomber = st.squad[4];
    let g = 0;
    while (st.season === 1 && g++ < 40) {
      applyManagerResult(st, 2, 0, [bomber.name, bomber.name]);
      st.event = undefined;
    }
    const aw = st.awards![0];
    expect(aw.season).toBe(1);
    expect(aw.topScorer?.name).toBe(bomber.name);
    expect(aw.topScorer!.goals).toBeGreaterThan(10);
    expect(aw.mvp).toBeDefined();
    expect(aw.champion.length).toBeGreaterThan(0);
    expect(st.seasonEnd?.awards).toBe(aw);
  });

  it('ensureManager sistema i salvataggi vecchi', () => {
    const st = newManager('Borgo FC', 0, 'normale', 2);
    delete st.staff;
    delete st.awards;
    ensureManager(st);
    expect(st.staff).toEqual({ allenatore: 0, preparatore: 0, medico: 0, osservatore: 0 });
    expect(st.awards).toEqual([]);
  });

  it('la gazzetta ha un titolo che dipende dall\'ultima partita', () => {
    const st = newManager('Borgo FC', 0, 'normale', 2);
    expect(gazzetta(st).headline).toContain('SI PARTE');
    applyManagerResult(st, 4, 0, []);
    expect(gazzetta(st).headline).toContain('TRIONFO');
    st.event = undefined;
    applyManagerResult(st, 0, 3, []);
    expect(gazzetta(st).headline).toContain('CROLLO');
    expect(gazzetta(st).items.length).toBeGreaterThan(1);
  });
});
