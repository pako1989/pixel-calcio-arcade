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
  tunnels: [number, number];
  /** Numeri di ogni giocatore (per indice nella squadra), per la pagella. */
  players: [PlayerTally[], PlayerTally[]];
}

export interface PlayerTally {
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  tackles: number;
  saves: number;
  tricks: number;
  fouls: number;
  reds: number;
}

const newPT = (): PlayerTally => ({ goals: 0, assists: 0, shots: 0, passes: 0, tackles: 0, saves: 0, tricks: 0, fouls: 0, reds: 0 });

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
    tunnels: [0, 0],
    players: [[], []],
  };
}

/** Aggiorna i conteggi con un evento della simulazione. */
export class TallyTracker {
  readonly t = newTally();
  private lastShot: { team: 0 | 1; superShot: boolean; fire: boolean } | null = null;
  private lastPass: { team: 0 | 1; idx: number } | null = null;

  private pl(team: 0 | 1, idx: number | undefined): PlayerTally {
    const arr = this.t.players[team];
    if (idx === undefined || idx < 0) return newPT(); // conteggio buttato
    while (arr.length <= idx) arr.push(newPT());
    return arr[idx];
  }

  feed(e: SimEvent, elapsed: number) {
    const t = this.t;
    switch (e.type) {
      case 'shot':
        this.pl(e.team, e.idx).shots++;
        this.lastShot = { team: e.team, superShot: e.superShot, fire: e.fire };
        break;
      case 'pass':
        this.pl(e.team, e.idx).passes++;
        this.lastPass = e.idx !== undefined ? { team: e.team, idx: e.idx } : null;
        this.lastShot = null;
        break;
      case 'steal':
        this.pl(e.team, e.idx).tackles++;
        this.lastShot = null;
        this.lastPass = null;
        break;
      case 'tackle':
        if (e.won) {
          t.tacklesWon[e.team]++;
          this.pl(e.team, e.idx).tackles++;
          this.lastPass = null;
        }
        this.lastShot = null;
        break;
      case 'save':
        t.saves[e.team]++;
        this.pl(e.team, e.idx).saves++;
        this.lastShot = null;
        this.lastPass = null;
        break;
      case 'trick':
        t.tricks[e.team]++;
        if (e.kind === 'tunnel') t.tunnels[e.team]++;
        this.pl(e.team, e.idx).tricks++;
        break;
      case 'foul': {
        // e.team è la squadra che commette il fallo
        const f = this.pl(e.team, e.byIdx);
        f.fouls++;
        if (e.card === 'yellow') t.yellows[e.team]++;
        if (e.card === 'red') {
          t.reds[e.team]++;
          f.reds++;
        }
        break;
      }
      case 'goal': {
        t.goals[e.team]++;
        if (t.firstGoalAt[e.team] < 0) t.firstGoalAt[e.team] = elapsed;
        if (e.own) t.ownGoals[e.team]++;
        else {
          this.pl(e.team, e.idx).goals++;
          const lp = this.lastPass;
          if (lp && lp.team === e.team && lp.idx !== e.idx) this.pl(e.team, lp.idx).assists++;
        }
        this.lastPass = null;
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
