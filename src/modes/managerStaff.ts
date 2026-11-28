/**
 * Staff tecnico e vivaio del Manager. Funzioni pure, senza dipendenze dal resto
 * del manager (così `manager.ts` le può usare senza giri strani).
 * Idea ripresa, riscritta da zero, dallo staff e dall'academy di "open-football"
 * (ZOXEXIVO/open-football, licenza Apache 2.0): non c'è codice copiato.
 */

export type StaffRole = 'allenatore' | 'preparatore' | 'medico' | 'osservatore';
export type Staff = Record<StaffRole, number>;

export const STAFF_ROLES: StaffRole[] = ['allenatore', 'preparatore', 'medico', 'osservatore'];
export const STAFF_MAX = 3;

export const STAFF_INFO: Record<StaffRole, { name: string; desc: string; levels: [string, string, string] }> = {
  allenatore: {
    name: 'ALLENATORE IN SECONDA',
    desc: 'Più crescita in allenamento',
    levels: ['+15% crescita', '+30% crescita', '+45% crescita'],
  },
  preparatore: {
    name: 'PREPARATORE ATLETICO',
    desc: 'Più fiato, meno stanchezza',
    levels: ['+3 energia a settimana', '+6 energia a settimana', '+9 energia a settimana'],
  },
  medico: {
    name: 'MEDICO SOCIALE',
    desc: 'Meno infortuni, rientri più veloci',
    levels: ['-20% infortuni', '-40% infortuni, -1 settimana', '-60% infortuni, -1 settimana'],
  },
  osservatore: {
    name: 'CAPO OSSERVATORE',
    desc: 'Mercato migliore, vivaio più chiaro',
    levels: ['Mercato +, potenziale a fasce', 'Più provini, fasce strette', 'Mercato ++, potenziale esatto'],
  },
};

export function newStaff(): Staff {
  return { allenatore: 0, preparatore: 0, medico: 0, osservatore: 0 };
}

const WAGE_K = [0, 0.06, 0.12, 0.22];

/** Stipendio settimanale di uno staff di quel livello: pesa sull'incasso base della divisione (sponsor). */
export function staffWage(level: number, divSponsor: number): number {
  return Math.round((divSponsor * WAGE_K[Math.min(STAFF_MAX, Math.max(0, level))]) / 10) * 10;
}

/** Costo una tantum per portare lo staff a `level` (14 settimane di stipendio). */
export function staffHireCost(level: number, divSponsor: number): number {
  return Math.round((staffWage(level, divSponsor) * 14) / 100) * 100;
}

export function totalStaffWages(staff: Staff | undefined, divSponsor: number): number {
  if (!staff) return 0;
  return STAFF_ROLES.reduce((t, r) => t + staffWage(staff[r], divSponsor), 0);
}

// ---- effetti

/** Bonus alla crescita in allenamento. */
export const coachBoost = (l: number) => 0.15 * l;
/** Energia in più recuperata ogni settimana. */
export const recoveryBonus = (l: number) => 3 * l;
/** Moltiplicatore del rischio di infortunio. */
export const injuryRiskMult = (l: number) => 1 - 0.2 * l;
/** Settimane tolte a un infortunio (minimo resta 1). */
export const injuryShorten = (l: number) => (l >= 2 ? 1 : 0);
/** Livello in più per i giocatori sul mercato. */
export const scoutMarketBonus = (l: number) => 0.12 * l;
/** Provini del vivaio ogni stagione. */
export const prospectCount = (l: number) => 3 + (l >= 2 ? 1 : 0);

// ---- potenziale

/** Stelle di potenziale 1..5 a partire dal tetto di crescita (media statistiche 0.7..1.2). */
export function potentialStars(pot: number): number {
  return Math.max(1, Math.min(5, Math.round((pot - 0.7) / 0.1) + 1));
}

/**
 * Potenziale visto dall'osservatore: senza osservatore è un mistero, poi una fascia
 * (larga 4, 3, esatta a livello massimo) che contiene sempre il valore vero.
 */
export function potentialLabel(pot: number, scoutLevel: number, id: number): string {
  const s = potentialStars(pot);
  if (scoutLevel >= STAFF_MAX) return `${s}/5`;
  const width = scoutLevel <= 0 ? 0 : scoutLevel === 1 ? 4 : 3;
  if (!width) return '?/5';
  const offset = id % width;
  let lo = s - offset;
  lo = Math.max(1, Math.min(lo, 5 - width + 1));
  const hi = Math.min(5, lo + width - 1);
  return `${lo}-${hi}/5`;
}
