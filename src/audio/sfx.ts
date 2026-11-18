/**
 * Audio sintetizzato con WebAudio: nessun file da scaricare.
 * Tre canali con volume separato: effetti, pubblico (cori, boati, pioggia) e musica.
 */

export interface AudioPrefs {
  muted: boolean;
  /** Volumi da 0 a 1. */
  music: number;
  sfx: number;
  crowd: number;
  /** Telecronaca a voce. */
  voice: boolean;
}

type Bus = 'sfx' | 'crowd' | 'music';

type UnlockListener = () => void;

class Sfx {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private noiseBuf: AudioBuffer | null = null;
  private crowd: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private onUnlock: UnlockListener[] = [];
  prefs: AudioPrefs = { muted: false, music: 0.6, sfx: 0.8, crowd: 0.8, voice: true };

  get muted() {
    return this.prefs.muted;
  }

  /** Va chiamata da un gesto dell'utente (tocco/clic). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      for (const b of ['sfx', 'crowd', 'music'] as Bus[]) {
        const g = this.ctx.createGain();
        g.connect(this.master);
        this.buses[b] = g;
      }
      this.applyPrefs();
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const ls = this.onUnlock;
      this.onUnlock = [];
      // aspetta che il contesto parta davvero
      const fire = () => ls.forEach((f) => f());
      if (this.ctx.state === 'running') setTimeout(fire, 0);
      else this.ctx.addEventListener('statechange', function h(this: AudioContext) {
        if (this.state === 'running') {
          this.removeEventListener('statechange', h);
          fire();
        }
      });
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Esegue f appena l'audio è sbloccato (subito se lo è già). */
  whenReady(f: UnlockListener) {
    if (this.ok) f();
    else this.onUnlock.push(f);
  }

  setPrefs(p: Partial<AudioPrefs>) {
    this.prefs = { ...this.prefs, ...p };
    this.applyPrefs();
  }

  /** Compatibilità: interruttore generale. */
  setMuted(m: boolean) {
    this.setPrefs({ muted: m });
  }

  private applyPrefs() {
    if (!this.master || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.prefs.muted ? 0 : 1, t, 0.02);
    // curva quadratica: i volumi bassi restano davvero bassi
    this.buses.sfx?.gain.setTargetAtTime(0.8 * this.prefs.sfx ** 2 * 1.5, t, 0.02);
    this.buses.crowd?.gain.setTargetAtTime(0.9 * this.prefs.crowd ** 2 * 1.4, t, 0.02);
    this.buses.music?.gain.setTargetAtTime(0.55 * this.prefs.music ** 2 * 1.6, t, 0.02);
  }

  get ok() {
    return !!this.ctx && !!this.master && this.ctx.state === 'running';
  }

  bus(b: Bus): GainNode {
    return this.buses[b]!;
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  /** Nota semplice; `at` è un tempo assoluto del contesto (per la musica). */
  tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, bus: Bus = 'sfx', at?: number) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = at ?? c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.bus(bus));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, attack = 0.005, bus: Bus = 'sfx', at?: number) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = at ?? c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, attack, vol, dur);
    s.connect(f).connect(g).connect(this.bus(bus));
    s.start(t, Math.random());
    s.stop(t + attack + dur + 0.05);
  }

  kick(power = 0.5) {
    this.tone('sine', 160 + power * 60, 45, 0.12, 0.5 + power * 0.4);
    this.noise(0.05, 0.25 + power * 0.3, 1800, 0.8, 'lowpass');
  }
  pass() {
    this.tone('sine', 140, 60, 0.08, 0.35);
    this.noise(0.03, 0.15, 1500, 0.8, 'lowpass');
  }
  bounce(p = 0.3) {
    this.tone('sine', 110, 50, 0.07, Math.min(0.4, p));
  }
  wall(p = 0.5) {
    this.noise(0.08, Math.min(0.5, 0.15 + p * 0.4), 500, 1.2);
    this.tone('triangle', 90, 50, 0.1, 0.3 * p);
  }
  post() {
    for (const [f, v] of [
      [620, 0.25],
      [1540, 0.15],
      [2330, 0.1],
    ])
      this.tone('sine', f, f * 0.98, 0.6, v);
  }
  /** Rete che si gonfia. */
  net() {
    this.noise(0.35, 0.3, 2400, 0.5, 'highpass', 0, 0.02);
    this.tone('triangle', 70, 40, 0.25, 0.25);
  }
  tackle() {
    this.noise(0.18, 0.3, 900, 0.7, 'lowpass');
  }
  whistle(times = 1, long = false) {
    if (!this.ok) return;
    for (let i = 0; i < times; i++) {
      const c = this.ctx!;
      const t = c.currentTime + i * 0.32;
      const dur = long && i === times - 1 ? 0.7 : 0.22;
      const o = c.createOscillator();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = 2900;
      lfo.frequency.value = 28;
      lg.gain.value = 120;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.setValueAtTime(0.18, t + dur - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.bus('sfx'));
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.05);
      lfo.stop(t + dur + 0.05);
    }
  }
  goal() {
    // boato del pubblico + sirena
    this.roar(1);
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone('square', f, f, 0.16, 0.12, i * 0.11));
    this.tone('sawtooth', 220, 220, 0.9, 0.12, 0.45);
    this.tone('sawtooth', 277, 277, 0.9, 0.1, 0.45);
    this.tone('sawtooth', 330, 330, 0.9, 0.1, 0.45);
  }
  /** Boato del pubblico (0..1). */
  roar(level = 1) {
    this.noise(2.6, 0.55 * level, 700, 0.6, 'bandpass', 0, 0.25, 'crowd');
    this.noise(2.2, 0.3 * level, 1600, 0.8, 'bandpass', 0.1, 0.3, 'crowd');
  }
  ooh() {
    this.noise(1.1, 0.3, 450, 0.9, 'bandpass', 0, 0.15, 'crowd');
  }
  /** Fischi di disapprovazione del pubblico. */
  boo() {
    this.noise(1.4, 0.22, 300, 1.4, 'bandpass', 0, 0.3, 'crowd');
  }
  save() {
    this.tone('sine', 120, 50, 0.12, 0.5);
    this.ooh();
  }
  powerup() {
    [660, 880, 1100, 1320].forEach((f, i) => this.tone('square', f, f, 0.08, 0.1, i * 0.06));
  }
  superReady() {
    [440, 554, 659, 880, 1108].forEach((f, i) => this.tone('triangle', f, f, 0.1, 0.18, i * 0.05));
  }
  superShot() {
    this.tone('sawtooth', 200, 1200, 0.35, 0.15);
    this.noise(0.5, 0.35, 2500, 0.6, 'bandpass');
  }
  click() {
    this.tone('square', 880, 880, 0.04, 0.08);
  }
  /** Voce "a bip" dei dialoghi. */
  blip() {
    this.tone('square', 420 + Math.random() * 120, 380, 0.035, 0.04);
  }
  /** Fanfara per titoli e trofei. */
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, i === 3 ? 0.35 : 0.12, 0.09, i * 0.12));
  }
  /** Motivetto triste (sconfitta, rigore sbagliato). */
  sadJingle() {
    [494, 440, 392, 330].forEach((f, i) => this.tone('triangle', f, f * (i === 3 ? 0.97 : 1), i === 3 ? 0.5 : 0.16, 0.16, i * 0.18));
  }
  select() {
    this.tone('square', 660, 990, 0.08, 0.1);
  }
  /** Tuono (temporale). */
  thunder() {
    this.noise(2.4, 0.5, 120, 0.7, 'lowpass', 0.15, 0.05, 'crowd');
    this.noise(1.2, 0.3, 380, 0.8, 'lowpass', 0.05, 0.01, 'crowd');
  }
  /** Onda che si infrange sul molo. */
  wave() {
    this.noise(2.2, 0.35, 500, 0.5, 'lowpass', 0, 0.6, 'crowd');
    this.noise(1.6, 0.25, 2200, 0.6, 'bandpass', 0.5, 0.2, 'crowd');
  }
  /** Battito del cuore (tensione ai rigori). */
  heartbeat() {
    this.tone('sine', 70, 40, 0.12, 0.35);
    this.tone('sine', 65, 38, 0.12, 0.25, 0.18);
  }

  // ---------- ambiente continuo ----------

  /** Brusio continuo del pubblico. */
  startCrowd(level = 1) {
    if (!this.ok || this.crowd) return;
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.5;
    const gain = c.createGain();
    gain.gain.value = 0.05 * level;
    src.connect(filter).connect(gain).connect(this.bus('crowd'));
    src.start();
    this.crowd = { src, gain, filter };
  }
  crowdLevel(v: number) {
    if (!this.crowd || !this.ctx) return;
    this.crowd.gain.gain.setTargetAtTime(0.04 + v * 0.1, this.ctx.currentTime, 0.3);
  }
  stopCrowd() {
    if (this.crowd) {
      try {
        this.crowd.src.stop();
      } catch {
        /* già fermato */
      }
      this.crowd = null;
    }
    this.stopRain();
  }

  /** Scroscio di pioggia continuo. */
  startRain() {
    if (!this.ok || this.rain) return;
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.7;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(0.09, c.currentTime, 0.8);
    src.connect(hp).connect(lp).connect(gain).connect(this.bus('crowd'));
    src.start();
    this.rain = { src, gain };
  }
  stopRain() {
    if (!this.rain) return;
    try {
      this.rain.src.stop();
    } catch {
      /* già fermato */
    }
    this.rain = null;
  }

  // ---------- cori ----------

  /**
   * Voce di folla sintetica: tanti "oh" stonati insieme, filtrati con le formanti
   * della vocale. Le note sono numeri MIDI.
   */
  private crowdVowel(midi: number, t: number, dur: number, vol: number, vowel: 'o' | 'a' = 'o') {
    const c = this.ctx!;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    out.gain.setValueAtTime(vol, t + Math.max(0.07, dur - 0.08));
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    const [f1, f2] = vowel === 'o' ? [480, 850] : [750, 1150];
    const b1 = c.createBiquadFilter();
    b1.type = 'bandpass';
    b1.frequency.value = f1;
    b1.Q.value = 3;
    const b2 = c.createBiquadFilter();
    b2.type = 'bandpass';
    b2.frequency.value = f2;
    b2.Q.value = 4;
    const mix = c.createGain();
    mix.gain.value = 1;
    b1.connect(mix);
    b2.connect(mix);
    mix.connect(out).connect(this.bus('crowd'));
    const base = 440 * 2 ** ((midi - 69) / 12);
    for (let i = 0; i < 7; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      // metà delle voci un'ottava sotto, tutte un po' stonate
      o.frequency.value = base * (i % 2 ? 0.5 : 1) * 2 ** ((Math.random() - 0.5) * 0.06);
      o.connect(b1);
      o.connect(b2);
      o.start(t + Math.random() * 0.03);
      o.stop(t + dur + 0.1);
    }
  }

  private clap(t: number, vol: number) {
    this.noise(0.07, vol, 1500, 0.9, 'bandpass', 0, 0.003, 'crowd', t);
    this.noise(0.05, vol * 0.6, 2600, 1.2, 'bandpass', 0, 0.003, 'crowd', t + 0.012);
  }

  private drum(t: number, vol: number) {
    this.tone('sine', 110, 50, 0.18, vol, 0, 'crowd', t);
  }

  /** Coro da stadio: 0 = "oh-oh-oh" con battimani, 1 = battimani a ritmo, 2 = coro lungo con tamburo. */
  chant(kind = Math.floor(Math.random() * 3), level = 1) {
    if (!this.ok) return;
    const t0 = this.ctx!.currentTime + 0.05;
    const v = 0.06 * level;
    const beat = 0.3;
    if (kind === 0) {
      // "oh! - oh! - oh-oh-oh!" (originale) ripetuto due volte
      const mel: [number, number, number][] = [
        [55, 0, 1.6], [57, 2, 1.6], [59, 4, 0.8], [57, 5, 0.8], [55, 6, 1.8],
      ];
      for (let rep = 0; rep < 2; rep++) {
        const off = t0 + rep * 8 * beat;
        for (const [n, at, d] of mel) this.crowdVowel(n, off + at * beat, d * beat, v);
        for (const at of [0, 2, 4, 5, 6]) this.clap(off + at * beat, 0.18 * level);
      }
    } else if (kind === 1) {
      // clap clap, clap-clap-clap (x3)
      for (let rep = 0; rep < 3; rep++) {
        const off = t0 + rep * 2.2;
        for (const at of [0, 0.4, 1.0, 1.25, 1.5]) this.clap(off + at, 0.22 * level);
        this.drum(off, 0.3 * level);
        this.drum(off + 1.0, 0.25 * level);
      }
    } else {
      // coro lungo "aaa-oh" con tamburo
      const mel: [number, number, number, 'o' | 'a'][] = [
        [60, 0, 2, 'a'], [62, 2, 1, 'o'], [64, 3, 1, 'o'], [62, 4, 2, 'a'], [59, 6, 2, 'o'],
        [60, 8, 2, 'a'], [62, 10, 1, 'o'], [64, 11, 1, 'o'], [67, 12, 3, 'a'],
      ];
      for (const [n, at, d, vw] of mel) this.crowdVowel(n - 12, t0 + at * beat, d * beat, v, vw);
      for (let i = 0; i < 16; i += 2) this.drum(t0 + i * beat, 0.28 * level);
    }
  }
}

export const sfx = new Sfx();
