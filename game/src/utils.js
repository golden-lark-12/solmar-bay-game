// utils.js — small shared helpers: seeded random, math, formatting, respect ranks.
// Nothing here knows about the game; every other module imports from here.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, min, max) { return min + rng() * (max - min); }
export function rangeInt(rng, min, max) { return Math.floor(range(rng, min, max + 1)); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(cur, target, lambda, dt) { return lerp(target, cur, Math.exp(-lambda * dt)); }
// Shortest signed angle difference, in radians.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
// 24h clock from minutes since midnight: 1125 -> "18:45".
export function fmtClock(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
// Respect ladder: DRIVER -> FIXER -> SHOT CALLER. rpMax is the top of the band.
export function respectRank(rp) {
  if (rp >= 5000) return { rank: 'SHOT CALLER', rpMax: 5200, band: 2 };
  if (rp >= 1000) return { rank: 'FIXER', rpMax: 5200, band: 1 };
  return { rank: 'DRIVER', rpMax: 1000, band: 0 };
}
