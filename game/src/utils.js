// Puerto Alba — utils.js
// Small shared helpers: math, random, formatting, DOM.
(function () {
  'use strict';

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function chance(p) {
    return Math.random() < p;
  }

  function dist2(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function angDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function turnToward(current, target, maxStep) {
    var d = angDiff(target, current);
    if (Math.abs(d) <= maxStep) return target;
    return current + Math.sign(d) * maxStep;
  }

  function fmtCash(n) {
    var neg = n < 0;
    var s = String(Math.abs(Math.round(n)));
    var out = '';
    while (s.length > 3) {
      out = ',' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    out = s + out;
    return (neg ? '-$' : '$') + out;
  }

  function fmtClock(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function fmtDist(m) {
    if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
    return Math.round(m) + ' m';
  }

  function el(tag, cls, parent, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function makeCanvasTexture(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    draw(ctx, w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = clamp((n & 255) + amt, 0, 255);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  window.PA = window.PA || {};
  PA.utils = {
    clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, pick: pick,
    chance: chance, dist2: dist2, angDiff: angDiff, turnToward: turnToward,
    fmtCash: fmtCash, fmtClock: fmtClock, fmtDist: fmtDist, el: el,
    makeCanvasTexture: makeCanvasTexture, shade: shade
  };
})();
