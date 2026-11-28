/**
 * Come le statistiche dei giocatori diventano effetti in partita.
 * Tutto il bilanciamento delle abilità passa da qui, così ogni statistica pesa
 * in modo chiaro e nessuna (prima era la velocità) schiaccia le altre.
 *
 * Convenzione: 0.93 è il giocatore "medio" (moltiplicatore 1). Sopra si migliora,
 * sotto si peggiora; lo `spread` dice quanto conta quella statistica.
 */
import type { PlayerStats } from './types';
import { clamp } from './math';

/** Statistica del giocatore medio. */
export const BASE_STAT = 0.93;

function tilt(v: number, spread: number): number {
  return 1 + (v - BASE_STAT) * spread;
}

/**
 * Velocità di corsa relativa (sostituisce la statistica "speed" grezza).
 * Al giocatore medio resta uguale a prima, ma la differenza tra lento e veloce
 * è più contenuta: correre di più aiuta, non decide da solo la partita.
 */
export function paceOf(s: PlayerStats): number {
  return BASE_STAT * tilt(s.speed, 0.6);
}

/** Moltiplicatore della potenza del tiro. */
export function shotPowerMul(s: PlayerStats): number {
  return 1.017 * tilt(s.shot, 0.5);
}

/** Errore di mira del tiro (radianti, metà ampiezza): i bomber sbagliano molto meno. */
export function shotAimErr(s: PlayerStats): number {
  return clamp(0.018 + (BASE_STAT - s.shot) * 0.16, 0.003, 0.07);
}

/** Moltiplicatore della forza del passaggio. */
export function passPowerMul(s: PlayerStats): number {
  return 1.012 * tilt(s.pass, 0.35);
}

/** Errore di mira del passaggio corto (radianti): chi passa male regala palla più spesso. */
export function passAimErr(s: PlayerStats): number {
  return clamp(0.013 + (BASE_STAT - s.pass) * 0.13, 0.002, 0.06);
}

/**
 * Forza nel contrasto contro il controllo di palla di chi difende il pallone.
 * Il valore > 1 favorisce chi contrasta.
 */
export function duelRatio(tackler: PlayerStats, carrier: PlayerStats): number {
  const t = tilt(tackler.tackle, 1.4);
  const c = tilt(carrier.control, 1.4);
  return clamp(t / Math.max(0.3, c), 0.45, 2.2);
}
