import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/data/teams';
import { newProgress } from '../src/modes/progress';
import { DRILLS, finishTraining, targetPoints, targetsFor, TRAIN_SESSIONS, trainingState } from '../src/modes/training';

describe('allenamento', () => {
  it('punti sui bersagli', () => {
    const t = [{ u: 0.5, v: 0.5, r: 0.2 }];
    expect(targetPoints({ u: 0.5, v: 0.5 }, t)).toBe(5);
    expect(targetPoints({ u: 0.5, v: 0.65 }, t)).toBe(3);
    expect(targetPoints({ u: -0.5, v: 0.3 }, t)).toBe(1);
    expect(targetPoints({ u: 1.2, v: 0.3 }, t)).toBe(0);
  });
  it('i bersagli stanno nella porta e si rimpiccioliscono', () => {
    let s = 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const a = targetsFor(0, rnd);
    const b = targetsFor(9, rnd);
    expect(a).toHaveLength(2);
    expect(b[0].r).toBeLessThan(a[0].r);
    for (const t of [...a, ...b]) expect(Math.abs(t.u) < 0.8 && t.v > 0.1 && t.v < 0.85).toBe(true);
  });
  it('esperienza solo ai ruoli allenati e solo per le prime sessioni del giorno', () => {
    const p = newProgress();
    const team = TEAMS[0];
    const gkIdx = team.players.findIndex((x) => x.role === 'GK');
    const drill = DRILLS.find((d) => d.id === 'portiere')!;
    let t = trainingState(undefined, '2026-11-18');
    const r = finishTraining(p, t, team, drill, 10);
    expect(r.xp).toBe(40);
    expect(r.record).toBe(true);
    expect(p.xp[team.id][gkIdx]).toBe(40);
    expect(p.xp[team.id].filter((x) => x > 0)).toHaveLength(1);
    for (let i = 1; i < TRAIN_SESSIONS; i++) finishTraining(p, t, team, drill, 1);
    const tired = finishTraining(p, t, team, drill, 12);
    expect(tired.tired).toBe(true);
    expect(tired.xp).toBe(0);
    expect(tired.record).toBe(true);
    t = trainingState(t, '2026-11-19');
    expect(t.sessions).toBe(0);
    expect(t.best.portiere).toBe(12);
  });
});
