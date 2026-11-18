/** Effetti sonori sintetizzati con WebAudio: nessun file audio da scaricare. */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private crowd: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  muted = false;

  /** Va chiamata da un gesto dell'utente (tocco/clic). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  private get ok() {
    return !!this.ctx && !!this.master && this.ctx.state === 'running';
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, attack = 0.005) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, attack, vol, dur);
    s.connect(f).connect(g).connect(this.master!);
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
      o.connect(g).connect(this.master!);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.05);
      lfo.stop(t + dur + 0.05);
    }
  }
  goal() {
    // boato del pubblico + sirena
    this.noise(2.6, 0.55, 700, 0.6, 'bandpass', 0, 0.25);
    this.noise(2.2, 0.3, 1600, 0.8, 'bandpass', 0.1, 0.3);
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone('square', f, f, 0.16, 0.12, i * 0.11));
    this.tone('sawtooth', 220, 220, 0.9, 0.12, 0.45);
    this.tone('sawtooth', 277, 277, 0.9, 0.1, 0.45);
    this.tone('sawtooth', 330, 330, 0.9, 0.1, 0.45);
  }
  ooh() {
    this.noise(1.1, 0.3, 450, 0.9, 'bandpass', 0, 0.15);
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
  select() {
    this.tone('square', 660, 990, 0.08, 0.1);
  }

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
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    this.crowd = { src, gain, filter };
  }
  crowdLevel(v: number) {
    if (!this.crowd || !this.ctx) return;
    this.crowd.gain.gain.setTargetAtTime(0.04 + v * 0.1, this.ctx.currentTime, 0.3);
  }
  stopCrowd() {
    if (!this.crowd) return;
    try {
      this.crowd.src.stop();
    } catch {
      /* già fermato */
    }
    this.crowd = null;
  }
}

export const sfx = new Sfx();
