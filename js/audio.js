// Pixel Calcio Arcade - Effetti Audio Procedurali (Web Audio API)
// 100% sintetico, zero campioni audio esterni, compatibile offline
(function (global) {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  const Audio = {
    enabled: true,

    init() {
      // Sblocca contesto audio al primo tocco
      const unlock = () => {
        getCtx();
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      };
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    },

    click() {
      if (!this.enabled) return;
      const c = getCtx(); if (!c) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.05);
      g.gain.setValueAtTime(0.15, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.05);
    },

    kick(power = 1) {
      if (!this.enabled) return;
      const c = getCtx(); if (!c) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "triangle";
      const startF = 180 * power;
      osc.frequency.setValueAtTime(startF, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.12);
      g.gain.setValueAtTime(0.35 * Math.min(1.5, power), c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.12);
    },

    whistle(double = false) {
      if (!this.enabled) return;
      const c = getCtx(); if (!c) return;
      const playPip = (delay) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(2600, c.currentTime + delay);
        osc.frequency.linearRampToValueAtTime(2400, c.currentTime + delay + 0.12);
        g.gain.setValueAtTime(0.2, c.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.12);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(c.currentTime + delay);
        osc.stop(c.currentTime + delay + 0.12);
      };
      playPip(0);
      if (double) playPip(0.15);
    },

    goal() {
      if (!this.enabled) return;
      const c = getCtx(); if (!c) return;
      // Fanfara trionfale in arpeggio
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, idx) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, c.currentTime + idx * 0.1);
        g.gain.setValueAtTime(0.12, c.currentTime + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + idx * 0.1 + 0.35);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(c.currentTime + idx * 0.1);
        osc.stop(c.currentTime + idx * 0.1 + 0.35);
      });
      // Boato della folla (rumore bianco filtrato)
      const bufferSize = c.sampleRate * 1.5;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = c.createBufferSource();
      noise.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, c.currentTime);
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.05, c.currentTime);
      ng.gain.linearRampToValueAtTime(0.25, c.currentTime + 0.3);
      ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.5);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(c.destination);
      noise.start(c.currentTime);
    },

    post() {
      if (!this.enabled) return;
      const c = getCtx(); if (!c) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(950, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(820, c.currentTime + 0.25);
      g.gain.setValueAtTime(0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.25);
    }
  };

  global.PCA_Audio = Audio;
})(window);
