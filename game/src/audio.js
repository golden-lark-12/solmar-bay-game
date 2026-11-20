// audio.js — all sound is synthesised with WebAudio. No audio files, no network.
// Engine hum follows speed, sirens wail while wanted, plus gunshots, chimes and
// a quiet dusk pad. Everything is guarded so a missing AudioContext never throws.
let ctx = null, master = null, muted = false;
let engineOsc = null, engineGain = null, engineFilter = null;
let sirenOsc = null, sirenGain = null, sirenLfo = null;
let padNodes = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    startPad();
  } catch { ctx = null; }
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
export function isMuted() { return muted; }

function startPad() {
  // Warm two-oscillator dusk pad, very quiet, looping forever.
  const g = ctx.createGain(); g.gain.value = 0.045; g.connect(master);
  const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 110;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 164.81;
  const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 220.5;
  o1.connect(g); o2.connect(g); o3.connect(g);
  o1.start(); o2.start(); o3.start();
  padNodes = { g, o1, o2, o3 };
}

export function setEngine(speed01, on) {
  if (!ctx) return;
  if (on && !engineOsc) {
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 500;
    engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  if (!engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, t, 0.08);
  engineFilter.frequency.setTargetAtTime(320 + speed01 * 1400, t, 0.1);
  engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.075 : 0, t, 0.12);
}

export function setSiren(on) {
  if (!ctx) return;
  if (on && !sirenOsc) {
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 780;
    sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 150;
    sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0.035;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start(); sirenLfo.start();
  } else if (!on && sirenOsc) {
    try { sirenOsc.stop(); sirenLfo.stop(); } catch {}
    sirenOsc.disconnect(); sirenLfo.disconnect(); sirenGain.disconnect();
    sirenOsc = null; sirenLfo = null; sirenGain = null;
  }
}

function blip(freq, dur, type, vol, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export function playGunshot() {
  if (!ctx) return;
  const dur = 0.16, t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
  const g = ctx.createGain(); g.gain.value = 0.5;
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
  blip(160, 0.08, 'square', 0.2);
}

export function playChime() { blip(880, 0.18, 'sine', 0.22); blip(1318, 0.28, 'sine', 0.2, 0.09); }
export function playPickup() { blip(660, 0.12, 'triangle', 0.25); blip(990, 0.2, 'triangle', 0.22, 0.07); }
export function playJingle() {
  [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.24, 'triangle', 0.22, i * 0.11));
}
export function playFail() { blip(220, 0.3, 'sawtooth', 0.18); blip(165, 0.4, 'sawtooth', 0.16, 0.16); }
export function playPunch() { blip(120, 0.09, 'square', 0.25); }
export function playClick() { blip(1400, 0.04, 'square', 0.12); }
