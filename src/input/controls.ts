import type { HumanInput } from '../sim/match';

/** Stato dei comandi, scritto dai controlli touch e dalla tastiera. */
export class Controls implements HumanInput {
  mx = 0;
  my = 0;
  shoot = false;
  pass = false;
  sprint = false;
  special = false;
  // parte touch
  tMx = 0;
  tMy = 0;
  tShoot = false;
  tPass = false;
  tSprint = false;
  tSpecial = false;

  reset() {
    this.mx = this.my = this.tMx = this.tMy = 0;
    this.shoot = this.pass = this.sprint = this.special = this.tShoot = this.tPass = this.tSprint = this.tSpecial = false;
  }
}
