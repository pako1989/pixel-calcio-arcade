import { sfx } from './sfx';

/**
 * Musica chiptune originale suonata da un piccolo sequencer WebAudio.
 * Ogni brano è scritto a sedicesimi: "C5" nota, "-" tiene la nota, "." pausa.
 */

export type TrackId = 'menu' | 'match' | 'rigori';

interface Track {
  bpm: number;
  /** Melodia principale (onda quadra). */
  lead: string;
  /** Accordi, uno per battuta: radice della linea di basso. */
  chords: string[];
  /** Schema del basso su 16 passi: "r" radice, "o" ottava, "f" quinta, "." pausa. */
  bass: string;
  /** Batteria su 16 passi: k cassa, s rullante, h charleston, x cassa+charleston. */
  drums: string;
  /** Arpeggio veloce di accompagnamento (facoltativo). */
  arp?: boolean;
  leadVol: number;
}

const TRACKS: Record<TrackId, Track> = {
  menu: {
    bpm: 128,
    lead: [
      'E5 - G5 - C6 - - - B5 - G5 - E5 - - -',
      'A5 - - - G5 - E5 - C5 - D5 - E5 - - -',
      'F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 -',
      'D5 - - - B4 - D5 - G5 - - - . . . .',
      'E5 - G5 - C6 - - - D6 - C6 - B5 - G5 -',
      'A5 - - - C6 - B5 - A5 - G5 - E5 - - -',
      'F5 - - - A5 - G5 - F5 - E5 - D5 - E5 -',
      'D5 - - - - - - - . . G4 . B4 . D5 .',
    ].join(' '),
    chords: ['C', 'A', 'F', 'G', 'C', 'A', 'F', 'G'],
    bass: 'r.o.r.o.r.o.r.of',
    drums: 'x.h.s.h.x.h.s.hh',
    arp: true,
    leadVol: 0.07,
  },
  match: {
    bpm: 140,
    lead: [
      'A4 . A4 . C5 . E5 - D5 . C5 . A4 - - -',
      'F4 . A4 . C5 . F5 - E5 . C5 . A4 - - -',
      'G4 . C5 . E5 . G5 - F5 . E5 . C5 - D5 -',
      'B4 - - - D5 - - - G5 - F5 - E5 - D5 -',
      'A5 - - - G5 . E5 . A5 - - - C6 - B5 -',
      'A5 - - - F5 . C5 . F5 - G5 - A5 - - -',
      'G5 - E5 - C5 - E5 - G5 - C6 - B5 - G5 -',
      'B5 - - - - - - - D6 . B5 . G5 . D5 .',
    ].join(' '),
    chords: ['A', 'F', 'C', 'G', 'A', 'F', 'C', 'G'],
    bass: 'r.ror.rorfrorfro',
    drums: 'x.hhs.hhx.xhs.hs',
    leadVol: 0.055,
  },
  rigori: {
    bpm: 96,
    lead: [
      '. . . . . . . . . . . . . . . .',
      'E5 - - - . . . . F5 - - - E5 - - -',
      '. . . . . . . . . . . . . . . .',
      'E5 - - - . . G5 - F5 - - - D#5 - - -',
    ].join(' '),
    chords: ['E', 'E', 'C', 'B'],
    bass: 'r..r..r.r..r..r.',
    drums: 'k..k....k..k....',
    leadVol: 0.05,
  },
};

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const ROOT_MIDI: Record<string, number> = { C: 36, D: 38, E: 40, F: 41, G: 43, A: 45, B: 47 };
/** Accordi minori (il resto è maggiore). */
const MINOR = new Set(['A', 'E', 'B']);

function midiOf(tok: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(tok);
  if (!m) return -1;
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface LeadNote {
  step: number;
  midi: number;
  len: number;
}

function parseLead(s: string): { notes: LeadNote[]; steps: number } {
  const toks = s.split(/\s+/).filter(Boolean);
  const notes: LeadNote[] = [];
  toks.forEach((t, i) => {
    if (t === '-' && notes.length && notes[notes.length - 1].step + notes[notes.length - 1].len === i) {
      notes[notes.length - 1].len++;
    } else if (t !== '-' && t !== '.') {
      notes.push({ step: i, midi: midiOf(t), len: 1 });
    }
  });
  return { notes, steps: toks.length };
}

class Music {
  private current: TrackId | null = null;
  private wanted: TrackId | null = null;
  private timer: number | undefined;
  private step = 0;
  private nextT = 0;
  private parsed?: { notes: LeadNote[]; steps: number };
  private gain: GainNode | null = null;

  /** Brano in riproduzione (o in attesa che l'audio si sblocchi). */
  get playing() {
    return this.wanted;
  }

  play(id: TrackId) {
    this.wanted = id;
    if (this.current === id) return;
    sfx.whenReady(() => {
      if (this.wanted === id && this.current !== id) this.start(id);
    });
  }

  stop(fadeSec = 0.6) {
    this.wanted = null;
    this.halt(fadeSec);
  }

  private halt(fadeSec: number) {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.current = null;
    if (this.gain && sfx.ctx) {
      const g = this.gain;
      g.gain.setTargetAtTime(0.0001, sfx.ctx.currentTime, fadeSec / 4);
      window.setTimeout(() => g.disconnect(), fadeSec * 1000 + 200);
    }
    this.gain = null;
  }

  private start(id: TrackId) {
    this.halt(0.4);
    const c = sfx.ctx;
    if (!c) return;
    this.current = id;
    this.parsed = parseLead(TRACKS[id].lead);
    this.step = 0;
    this.nextT = c.currentTime + 0.1;
    this.gain = c.createGain();
    this.gain.gain.value = 0.0001;
    this.gain.gain.setTargetAtTime(1, c.currentTime, 0.3);
    this.gain.connect(sfx.bus('music'));
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  private tick() {
    const c = sfx.ctx;
    if (!c || !this.current || !this.gain) return;
    const tr = TRACKS[this.current];
    const dt = 60 / tr.bpm / 4;
    // se la scheda è rimasta in pausa, si riparte senza recuperare le note perse
    if (this.nextT < c.currentTime - 0.3) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.15) {
      this.playStep(tr, this.step, this.nextT, dt);
      this.step = (this.step + 1) % this.parsed!.steps;
      this.nextT += dt;
    }
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, vol: number, out: AudioNode) {
    const c = sfx.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur * 0.7));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private playStep(tr: Track, step: number, t: number, dt: number) {
    const out = this.gain!;
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    // melodia
    for (const n of this.parsed!.notes) {
      if (n.step === step && n.midi > 0) {
        this.osc('square', hz(n.midi), t, n.len * dt * 0.95, tr.leadVol, out);
        // eco leggera un'ottava sopra per il suono "hi-bit"
        this.osc('triangle', hz(n.midi + 12), t + dt * 0.5, n.len * dt * 0.6, tr.leadVol * 0.25, out);
      }
    }
    const chord = tr.chords[bar % tr.chords.length];
    const root = ROOT_MIDI[chord];
    // basso
    const b = tr.bass[s16];
    if (b && b !== '.') {
      const m = b === 'o' ? root + 12 : b === 'f' ? root + 7 : root;
      this.osc('triangle', hz(m), t, dt * 1.6, 0.16, out);
    }
    // arpeggio
    if (tr.arp && s16 % 2 === 1) {
      const third = MINOR.has(chord) ? 3 : 4;
      const seq = [0, third, 7, 12];
      const m = root + 24 + seq[Math.floor(s16 / 2) % 4];
      this.osc('square', hz(m), t, dt * 0.8, 0.018, out);
    }
    // batteria
    const d = tr.drums[s16];
    const ctx = sfx.ctx!;
    if (d === 'k' || d === 'x') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.16);
    }
    if (d === 's') this.hit(t, 0.12, 1800, 0.13, out);
    if (d === 'h' || d === 'x') this.hit(t, 0.035, 8000, 0.05, out);
  }

  private hit(t: number, dur: number, freq: number, vol: number, out: AudioNode) {
    const c = sfx.ctx!;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = freq > 4000 ? 'highpass' : 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(out);
    s.start(t);
  }
}

export const music = new Music();
