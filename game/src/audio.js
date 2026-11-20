// audio.js — WebAudio sound: engine hum, sirens, radio tunes, gunfire, explosions.
// All sounds are synthesized in code; no audio files. Puerto Alba.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioTimer = null;
    this.radioOn = false;
    this.station = 'ALBA FM 98.1';
    this.song = 'Golden Hour Drive';
    this.songs = [
      'Golden Hour Drive', 'Neon Palms', 'Causeway Lights',
      'Salt Air', 'Midnight in Alba', 'Strand Summer'
    ];
    this.songIndex = 0;
    this.muted = false;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: low sawtooth through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: triangle that wails between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  }

  setEngine(rpm01, driving) {
    if (!this.ctx || !this.engineOsc) return;
    this.engineOsc.frequency.value = 50 + rpm01 * 130;
    this.engineGain.gain.value = driving ? 0.05 + rpm01 * 0.06 : 0.02;
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenOsc) return;
    if (on) {
      const t = this.ctx.currentTime;
      this.sirenGain.gain.setValueAtTime(0.05, t);
      this.sirenOsc.frequency.setValueAtTime(660, t);
      this.sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.5);
      this.sirenOsc.frequency.linearRampToValueAtTime(660, t + 1.0);
    } else {
      this.sirenGain.gain.value = 0.0;
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq || 440;
      g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + (dur || 0.12));
    } catch (e) { /* silent */ }
  }

  shot() { this.blip(180, 0.09, 'square', 0.22); this.blip(90, 0.14, 'sawtooth', 0.14); }
  pickup() { this.blip(660, 0.1, 'sine', 0.15); this.blip(990, 0.16, 'sine', 0.15); }
  denied() { this.blip(160, 0.2, 'square', 0.12); }
  complete() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'sine', 0.16), i * 110));
  }
  crash() { this.noiseBurst(0.35, 0.5); }

  noiseBurst(dur, vol) {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.4;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start();
    } catch (e) { /* silent */ }
  }

  explosion() { this.noiseBurst(0.9, 0.6); this.blip(60, 0.7, 'sine', 0.3); }

  // Radio: a gentle looping melody on a triangle wave, one note per beat.
  startRadio() {
    if (!this.ctx || this.radioOn) return;
    this.radioOn = true;
    const scale = [262, 294, 330, 392, 440, 523, 587, 659];
    let step = 0;
    this.radioTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = scale[Math.floor(Math.random() * scale.length)];
      this.blip(f, 0.22, 'triangle', 0.045);
      step++;
      if (step % 32 === 0) this.nextSong();
    }, 260);
  }
  nextSong() {
    this.songIndex = (this.songIndex + 1) % this.songs.length;
    this.song = this.songs[this.songIndex];
  }
  setSong(title) {
    const i = this.songs.indexOf(title);
    if (i >= 0) this.songIndex = i;
    this.song = title;
  }
  stopRadio() {
    this.radioOn = false;
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
  }
}
