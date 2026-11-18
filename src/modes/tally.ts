import type { SimEvent } from '../sim/entities';

/** Conteggi raccolti durante la partita, usati da missioni e storia. */
export interface MatchTally {
  goals: [number, number];
  superGoals: [number, number];
  fireGoals: [number, number];
  ownGoals: [number, number];
  tacklesWon: [number, number];
  saves: [number, number];
  /** Secondi di gioco del primo gol di ciascuna squadra (-1 = nessuno). */
  firstGoalAt: [number, number];
  /** Giocate di stile (dribbling, tunnel, gol speciali). */
  tricks: [number, number];
  /** Cartellini presi. */
  yellows: [number, number];
  reds: [number, number];
}

export function newTally(): MatchTally {
  return {
    goals: [0, 0],
    superGoals: [0, 0],
    fireGoals: [0, 0],
    ownGoals: [0, 0],
    tacklesWon: [0, 0],
    saves: [0, 0],
    firstGoalAt: [-1, -1],
    tricks: [0, 0],
    yellows: [0, 0],
    reds: [0, 0],
  };
}

/** Aggiorna i conteggi con un evento della simulazione. */
export class TallyTracker {
  readonly t = newTally();
  private lastShot: { team: 0 | 1; superShot: boolean; fire: boolean } | null = null;

  feed(e: SimEvent, elapsed: number) {
    const t = this.t;
    switch (e.type) {
      case 'shot':
        this.lastShot = { team: e.team, superShot: e.superShot, fire: e.fire };
        break;
      case 'pass':
      case 'steal':
        this.lastShot = null;
        break;
      case 'tackle':
        if (e.won) t.tacklesWon[e.team]++;
        this.lastShot = null;
        break;
      case 'save':
        t.saves[e.team]++;
        this.lastShot = null;
        break;
      case 'trick':
        t.tricks[e.team]++;
        break;
      case 'foul':
        // e.team è la squadra che commette il fallo
        if (e.card === 'yellow') t.yellows[e.team]++;
        if (e.card === 'red') t.reds[e.team]++;
        break;
      case 'goal': {
        t.goals[e.team]++;
        if (t.firstGoalAt[e.team] < 0) t.firstGoalAt[e.team] = elapsed;
        if (e.own) t.ownGoals[e.team]++;
        const s = this.lastShot;
        if (!e.own && s && s.team === e.team) {
          if (s.superShot) t.superGoals[e.team]++;
          if (s.fire) t.fireGoals[e.team]++;
        }
        this.lastShot = null;
        break;
      }
    }
  }
}
