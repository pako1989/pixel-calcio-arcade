import type { PitchDef, PitchId, Weather } from '../sim/types';

export const WEATHERS: Weather[] = ['sereno', 'pioggia', 'nebbia', 'neve', 'vento', 'temporale'];

export const WEATHER_INFO: Record<Weather, { name: string; rule: string }> = {
  sereno: { name: 'Sereno', rule: '' },
  pioggia: { name: 'Pioggia', rule: 'Campo bagnato: la palla frena e rimbalza poco, si scivola.' },
  nebbia: { name: 'Nebbia', rule: 'Si vede solo vicino alla palla: occhio ai compagni lontani!' },
  neve: { name: 'Neve', rule: 'Neve fresca: la palla si pianta, si corre più piano e si scivola.' },
  vento: { name: 'Vento', rule: 'Raffiche che cambiano: i palloni alti vengono spinti dal vento.' },
  temporale: { name: 'Temporale', rule: 'Pioggia, fulmini e raffiche forti: palla pazza e campo pesante.' },
};

/** Il meteo possibile su un campo: sulla neve non piove, in spiaggia e sul vulcano non nevica. */
export function weatherAllowed(pitch: PitchId, w: Weather): boolean {
  if (pitch === 'neve') return w !== 'pioggia' && w !== 'temporale';
  if (pitch === 'vulcano' || pitch === 'spiaggia') return w !== 'neve';
  // sotto il tetto non piove e non nevica (ma il vento c'è già)
  if (pitch === 'tetto') return w === 'sereno' || w === 'nebbia' || w === 'vento';
  return true;
}

/** Campi sempre in notturna. */
export function alwaysNight(pitch: PitchId): boolean {
  return pitch === 'tetto';
}

/** Fisica del campo modificata dal meteo. */
export function applyWeather(p: PitchDef, w: Weather = 'sereno'): PitchDef {
  switch (w) {
    case 'pioggia':
      // sul bagnato la palla rallenta e rimbalza meno, i giocatori scivolano un po'
      return {
        ...p,
        ballFriction: p.ballFriction * 1.35,
        ballBounce: p.ballBounce * 0.7,
        playerGrip: p.playerGrip * 0.7,
        playerSpeed: p.playerSpeed * 0.96,
      };
    case 'neve':
      // la palla si pianta nella neve fresca, si corre più piano
      return {
        ...p,
        ballFriction: p.ballFriction * 1.6,
        ballBounce: p.ballBounce * 0.55,
        playerGrip: p.playerGrip * 0.8,
        playerSpeed: p.playerSpeed * 0.93,
      };
    case 'vento':
      return { ...p, wind: true, windPower: Math.max(p.windPower ?? 1, p.wind ? 1.3 : 1) };
    case 'temporale':
      return {
        ...p,
        ballFriction: p.ballFriction * 1.3,
        ballBounce: p.ballBounce * 0.72,
        playerGrip: p.playerGrip * 0.68,
        playerSpeed: p.playerSpeed * 0.95,
        wind: true,
        windPower: 1.45,
      };
    default:
      return p;
  }
}

/**
 * Probabilità del meteo per campo: in montagna nevica spesso, al molo c'è vento,
 * allo stadio ogni tanto arriva il temporale. Pesi nell'ordine di WEATHERS.
 */
const ODDS: Partial<Record<PitchId, number[]>> = {
  //            sereno pioggia nebbia neve vento temporale
  stadio: [50, 18, 9, 6, 9, 8],
  spiaggia: [52, 10, 6, 0, 26, 6],
  neve: [38, 0, 14, 40, 8, 0],
  tetto: [62, 0, 12, 0, 26, 0],
  montagna: [34, 12, 16, 26, 8, 4],
  molo: [36, 14, 14, 4, 24, 8],
  vulcano: [64, 8, 18, 0, 10, 0],
  fango: [34, 34, 10, 0, 6, 16],
};
const DEFAULT_ODDS = [52, 18, 10, 6, 8, 6];

/** Probabilità (0..1) di ogni meteo su un campo, solo tra quelli ammessi. */
export function weatherOdds(pitch: PitchId): Record<Weather, number> {
  const w = ODDS[pitch] ?? DEFAULT_ODDS;
  const ok = WEATHERS.map((x, i) => (weatherAllowed(pitch, x) ? w[i] : 0));
  const tot = ok.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(WEATHERS.map((x, i) => [x, ok[i] / tot])) as Record<Weather, number>;
}

/** Meteo e orario casuali (deterministici con il generatore passato). */
export function randomConditions(pitch: PitchId, rnd: () => number): { weather: Weather; night: boolean } {
  const odds = weatherOdds(pitch);
  let r = rnd();
  let weather: Weather = 'sereno';
  for (const w of WEATHERS) {
    r -= odds[w];
    if (r < 0) {
      weather = w;
      break;
    }
  }
  // il temporale arriva più spesso di sera
  const night = alwaysNight(pitch) || rnd() < (weather === 'temporale' ? 0.6 : 0.35);
  return { weather, night };
}
