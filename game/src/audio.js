// Puerto Alba — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, booms, radio jingles and UI blips.
(function () {
  'use strict';
  var U = PA.utils;

  var ctx = null;
  var master = null;
  var engineOsc = null, engineOsc2 = null, engineGain = null;
  var sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
  var radioTimer = 0, radioStep = 0, radioOn = false, radioGain = null;
  var muted = false;
  var stations = ['ALBA FM 98.1', 'PALM RADIO 104.7', 'CAUSEWAY ROCK 91.3', 'MARINA WAVE 88.5'];
  var stationIndex = 0;
  var started = false;

  function ensure() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc.connect(engineGain);
      engineOsc.start();
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      var g2 = ctx.createGain();
      g2.gain.value = 0.4;
      engineOsc2.connect(g2);
      g2.connect(engineGain);
      engineOsc2.start();
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      radioGain = ctx.createGain();
      radioGain.gain.value = 0;
      radioGain.connect(master);
      started = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  function isMuted() { return muted; }

  function tone(freq, dur, type, vol, slideTo) {
    if (!started || !ctx) return;
    try {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!started || !ctx) return;
    try {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1200;
      var g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
    } catch (e) { /* ignore */ }
  }

  function shot() { noise(0.14, 0.5, 2600); tone(160, 0.08, 'square', 0.18, 60); }
  function boom() { noise(0.9, 0.8, 320); tone(70, 0.7, 'sine', 0.5, 28); }
  function blip() { tone(880, 0.09, 'sine', 0.18); }
  function good() { tone(523, 0.12, 'triangle', 0.2); setTimeout(function () { tone(784, 0.2, 'triangle', 0.2); }, 110); }
  function bad() { tone(220, 0.25, 'sawtooth', 0.2, 110); }
  function horn() { tone(370, 0.25, 'square', 0.16); tone(466, 0.25, 'square', 0.12); }
  function sting() {
    var notes = [392, 523, 659, 784];
    for (var i = 0; i < notes.length; i++) {
      (function (f, t) { setTimeout(function () { tone(f, 0.22, 'triangle', 0.22); }, t); })(notes[i], i * 120);
    }
  }
  function steal() { tone(660, 0.08, 'square', 0.15); setTimeout(function () { tone(990, 0.14, 'square', 0.15); }, 90); }
  function cashSound() {
    for (var i = 0; i < 3; i++) {
      (function (t) { setTimeout(function () { tone(1200, 0.07, 'sine', 0.16); }, t); })(i * 70);
    }
  }

  function setEngine(speed01, on) {
    if (!started) return;
    var target = on ? 0.05 + speed01 * 0.12 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, ctx.currentTime, 0.08);
    engineOsc2.frequency.setTargetAtTime(28 + speed01 * 84, ctx.currentTime, 0.08);
  }

  function setSiren(on) {
    if (!started) return;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
  }

  function setRadio(on) {
    radioOn = !!on;
    if (radioGain) radioGain.gain.setTargetAtTime(radioOn ? 0.06 : 0, ctx.currentTime, 0.3);
  }

  function nextStation() {
    stationIndex = (stationIndex + 1) % stations.length;
    radioStep = 0;
    blip();
    return stations[stationIndex];
  }

  function stationName() { return stations[stationIndex]; }

  // Tiny golden-hour radio jingle: a looping 8-step bass + pluck line.
  var bassLine = [110, 0, 131, 0, 98, 0, 147, 0];
  var pluckLine = [440, 554, 659, 554, 440, 392, 494, 587];

  function update(dt) {
    if (!started || !ctx) return;
    if (sirenGain && sirenGain.gain.value > 0.01) {
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 720, ctx.currentTime, 0.05);
      }
    }
    if (radioOn) {
      radioTimer += dt;
      if (radioTimer > 0.24) {
        radioTimer = 0;
        var b = bassLine[radioStep % bassLine.length];
        var p = pluckLine[radioStep % pluckLine.length];
        if (b) tone(b, 0.22, 'triangle', 0.10);
        if (radioStep % 2 === 0) tone(p, 0.16, 'sine', 0.05);
        radioStep++;
      }
    }
  }

  window.PA = window.PA || {};
  PA.audio = {
    ensure: ensure, setMuted: setMuted, isMuted: isMuted,
    shot: shot, boom: boom, blip: blip, good: good, bad: bad, horn: horn,
    sting: sting, steal: steal, cashSound: cashSound,
    setEngine: setEngine, setSiren: setSiren, setRadio: setRadio,
    nextStation: nextStation, stationName: stationName, update: update
  };
})();
