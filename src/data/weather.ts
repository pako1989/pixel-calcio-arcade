import type { PitchDef, PitchId, Weather } from '../sim/types';

export const WEATHERS: Weather[] = ['sereno', 'pioggia', 'nebbia'];

export const WEATHER_INFO: Record<Weather, { name: string; rule: string }> = {
  sereno: { name: 'Sereno', rule: '' },
  pioggia: { name: 'Pioggia', rule: 'Campo bagnato: la palla frena e rimbalza poco, si scivola.' },
  nebbia: { name: 'Nebbia', rule: 'Si vede solo vicino alla palla: occhio ai compagni lontani!' },
};

/** Il meteo possibile su un campo: sulla neve non piove. */
export function weatherAllowed(pitch: PitchId, w: Weather): boolean {
  return !(pitch === 'neve' && w === 'pioggia');
}

/** Campi sempre in notturna. */
export function alwaysNight(pitch: PitchId): boolean {
  return pitch === 'tetto';
}

/** Fisica del campo modificata dal meteo. */
export function applyWeather(p: PitchDef, w: Weather = 'sereno'): PitchDef {
  if (w !== 'pioggia') return p;
  return {
    ...p,
    // sul bagnato la palla rallenta e rimbalza meno, i giocatori scivolano un po'
    ballFriction: p.ballFriction * 1.35,
    ballBounce: p.ballBounce * 0.7,
    playerGrip: p.playerGrip * 0.7,
    playerSpeed: p.playerSpeed * 0.96,
  };
}

/** Meteo e orario casuali (deterministici con il generatore passato). */
export function randomConditions(pitch: PitchId, rnd: () => number): { weather: Weather; night: boolean } {
  const r = rnd();
  let weather: Weather = r < 0.55 ? 'sereno' : r < 0.8 ? 'pioggia' : 'nebbia';
  if (!weatherAllowed(pitch, weather)) weather = 'sereno';
  const night = alwaysNight(pitch) || rnd() < 0.35;
  return { weather, night };
}
