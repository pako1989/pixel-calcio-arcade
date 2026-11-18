import type { PitchDef, PitchId } from '../sim/types';

const base = {
  width: 840,
  height: 480,
  goalWidth: 104,
  ballFriction: 1.0,
  ballBounce: 0.55,
  wallBounce: 0.72,
  playerSpeed: 1,
  playerGrip: 1,
  wind: false,
};

export const PITCHES: Record<PitchId, PitchDef> = {
  stadio: {
    ...base,
    id: 'stadio',
    name: 'Stadio Arcade',
    rule: 'Erba perfetta e pubblico caldo. Nessuna sorpresa.',
  },
  spiaggia: {
    ...base,
    id: 'spiaggia',
    name: 'Spiaggia',
    rule: 'Sabbia: si corre più piano e la palla si ferma presto. Tira forte!',
    ballFriction: 1.9,
    ballBounce: 0.35,
    playerSpeed: 0.9,
  },
  neve: {
    ...base,
    id: 'neve',
    name: 'Campo Innevato',
    rule: 'Ghiaccio e neve: si scivola e la palla corre lontano.',
    ballFriction: 0.55,
    playerGrip: 0.3,
  },
  tetto: {
    ...base,
    id: 'tetto',
    name: 'Tetto in Città',
    rule: 'Di notte sul tetto: il vento cambia e sposta la palla in aria.',
    wind: true,
  },
  quartiere: {
    ...base,
    id: 'quartiere',
    name: 'Gabbia di Quartiere',
    rule: 'Campo piccolo e muri elastici: sponde ovunque, ritmo folle.',
    width: 720,
    height: 420,
    goalWidth: 96,
    wallBounce: 0.95,
    ballFriction: 0.85,
  },
};

export const PITCH_ORDER: PitchId[] = ['stadio', 'spiaggia', 'neve', 'tetto', 'quartiere'];
