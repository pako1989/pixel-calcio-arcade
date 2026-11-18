import { sfx } from './sfx';

/**
 * Telecronaca in italiano con la sintesi vocale del telefono (Web Speech API).
 * Frasi brevi e originali; se il dispositivo non ha una voce italiana resta in silenzio.
 */

export type CallKind =
  | 'start'
  | 'goal'
  | 'ownGoal'
  | 'save'
  | 'catch'
  | 'post'
  | 'super'
  | 'golden'
  | 'end'
  | 'fire'
  | 'turbo'
  | 'wall'
  | 'tackle'
  | 'rain'
  | 'fog'
  | 'night'
  | 'penStart'
  | 'penGoal'
  | 'penSave'
  | 'penMiss'
  | 'penPost'
  | 'penWin';

const LINES: Record<CallKind, string[]> = {
  start: ['Si parte!', "Fischio d'inizio!", 'Comincia la partita!', 'Palla al centro, si gioca!'],
  goal: ['Gooool! {n}!', 'Rete! Che gol di {n}!', 'È gol! {n} non perdona!', 'Gol! Firma di {n}!', 'In rete! Grande {n}!'],
  ownGoal: ['Autogol! Che sfortuna!', 'Oh no, autorete!'],
  save: ['Grande parata!', 'Che riflessi!', 'Para tutto!', 'Miracolo del portiere!'],
  catch: ['Presa sicura.', 'Blocca il portiere.'],
  post: ['Palo! Che sfortuna!', 'Colpisce il legno!', 'Palo pieno!'],
  super: ['Super tiro!', 'Che bordata!'],
  golden: ['Golden gol! Chi segna vince!'],
  end: ['Finisce qui!', 'Triplice fischio!', 'È finita!'],
  fire: ['Tiro di fuoco!'],
  turbo: ['Turbo!'],
  wall: ['Muro in porta!'],
  tackle: ['Che contrasto!', 'Intervento deciso!'],
  rain: ['Si gioca sotto la pioggia. Il pallone frena sul bagnato!'],
  fog: ['Nebbia fitta stasera: si vede pochissimo!'],
  night: ['Partita in notturna, accesi i riflettori!'],
  penStart: ['Si va ai rigori!', 'Calci di rigore!'],
  penGoal: ['Gol!', 'Spiazzato!', 'Rete!', 'Freddo dal dischetto!'],
  penSave: ['Parato!', 'Lo para!', 'Che intervento!'],
  penMiss: ['Fuori!', "Sbagliato! Alto sopra la traversa!", 'Fuori di poco!'],
  penPost: ['Palo!', 'Sul legno!'],
  penWin: ['Vince {n} ai rigori!', 'È finita! Passa {n}!'],
};

/** Priorità: le frasi importanti interrompono quelle in corso. */
const PRIORITY: Partial<Record<CallKind, number>> = {
  goal: 3, ownGoal: 3, penWin: 3, end: 2, golden: 2, penGoal: 2, penSave: 2, penMiss: 2, penPost: 2, penStart: 2,
};

class Commentary {
  private voice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;
  private lastAt = 0;
  private lastPrio = 0;
  private last: Partial<Record<CallKind, string>> = {};

  private get synth(): SpeechSynthesis | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  }

  get available(): boolean {
    this.pickVoice();
    return !!this.synth && !!this.voice;
  }

  private pickVoice() {
    const s = this.synth;
    if (!s || this.voicesLoaded) return;
    const vs = s.getVoices();
    if (!vs.length) {
      s.addEventListener?.('voiceschanged', () => this.pickVoice(), { once: true });
      return;
    }
    this.voicesLoaded = true;
    const it = vs.filter((v) => v.lang?.toLowerCase().startsWith('it'));
    // preferisce voci maschili/di qualità note, altrimenti la prima italiana
    this.voice = it.find((v) => /luca|diego|cosimo|giorgio|enhanced|premium/i.test(v.name)) ?? it[0] ?? null;
  }

  /** Da chiamare in un gesto dell'utente: iOS lo richiede per la prima frase. */
  unlock() {
    const s = this.synth;
    if (!s) return;
    this.pickVoice();
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      s.speak(u);
    } catch {
      /* ignora */
    }
  }

  say(kind: CallKind, name = '') {
    const s = this.synth;
    if (!s || !sfx.prefs.voice || sfx.prefs.muted) return;
    this.pickVoice();
    if (!this.voice) return;
    const now = performance.now();
    const prio = PRIORITY[kind] ?? 1;
    const busy = s.speaking && now - this.lastAt < 2600;
    if (busy && prio <= this.lastPrio) return;
    if (prio === 1 && now - this.lastAt < 3500) return;
    const pool = LINES[kind];
    let line = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && line === this.last[kind]) line = pool[(pool.indexOf(line) + 1) % pool.length];
    this.last[kind] = line;
    const text = line.replace('{n}', name.replace(/\s*\(aut\.\)/, ''));
    try {
      if (busy || s.speaking) s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice.lang;
      u.rate = prio >= 2 ? 1.15 : 1.08;
      u.pitch = kind === 'goal' || kind === 'penWin' ? 1.25 : 1.05;
      u.volume = Math.min(1, 0.4 + sfx.prefs.sfx * 0.7);
      s.speak(u);
      this.lastAt = now;
      this.lastPrio = prio;
    } catch {
      /* ignora */
    }
  }

  stop() {
    try {
      this.synth?.cancel();
    } catch {
      /* ignora */
    }
  }
}

export const commentary = new Commentary();
