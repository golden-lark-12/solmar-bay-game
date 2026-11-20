// combat.js — weapons, shooting, weapon wheel (hold Tab).
// Six weapons, three unlocked by missions. Puerto Alba.

export const WEAPONS = [
  { name: 'Pistol', damage: 12, ammo: 120, maxAmmo: 120, unlockJob: null, range: 60 },
  { name: 'SMG', damage: 9, ammo: 240, maxAmmo: 240, unlockJob: null, range: 55 },
  { name: 'Pump Shotgun', damage: 34, ammo: 48, maxAmmo: 48, unlockJob: 'M3', range: 28 },
  { name: 'Carbine', damage: 22, ammo: 180, maxAmmo: 180, unlockJob: 'M5', range: 90 },
  { name: 'Grenade Launcher', damage: 90, ammo: 12, maxAmmo: 12, unlockJob: 'M7', range: 70 },
  { name: 'Sniper', damage: 80, ammo: 20, maxAmmo: 20, unlockJob: 'M11', range: 140 }
];

export class Combat {
  constructor() {
    this.weapons = WEAPONS.map(w => Object.assign({}, w, { unlocked: !w.unlockJob }));
    this.selected = 0;
    this.wheelOpen = false;
    this.cooldown = 0;
    this.lastShotAt = 0;
  }

  unlockForJob(jobId) {
    for (const w of this.weapons) {
      if (w.unlockJob === jobId) w.unlocked = true;
    }
  }
  unlockedWeapons() { return this.weapons.filter(w => w.unlocked); }

  select(i) {
    if (i >= 0 && i < this.weapons.length && this.weapons[i].unlocked) {
      this.selected = i;
      return true;
    }
    return false;
  }
  cycle() {
    const list = this.unlockedWeapons();
    if (!list.length) return;
    const idx = list.indexOf(this.weapons[this.selected]);
    const next = list[(idx + 1) % list.length];
    this.selected = this.weapons.indexOf(next);
  }

  current() { return this.weapons[this.selected]; }

  // Fire from (x,z) along heading. Returns a shot record for effects/sound,
  // or null when on cooldown / out of ammo / wheel open.
  tryFire(now, x, z, heading) {
    if (this.wheelOpen) return null;
    if (now - this.lastShotAt < 0.28) return null;
    const w = this.current();
    if (!w.unlocked || w.ammo <= 0) return null;
    this.lastShotAt = now;
    w.ammo -= 1;
    const spread = w.name === 'Pump Shotgun' ? 0.09 : 0.02;
    return {
      weapon: w.name, damage: w.damage, range: w.range,
      x, z, heading: heading + (Math.random() - 0.5) * spread,
      explosive: w.name === 'Grenade Launcher'
    };
  }

  // Resolve a shot against a list of targets {x, z, radius, onHit(damage, explosive)}.
  // Returns the hit target (or null) and the impact point.
  resolveShot(shot, targets) {
    if (!shot) return null;
    const fx = Math.sin(shot.heading), fz = Math.cos(shot.heading);
    let best = null, bestT = shot.range;
    for (const t of targets) {
      const dx = t.x - shot.x, dz = t.z - shot.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > shot.range) continue;
      const perp = Math.abs(dx * fz - dz * fx);
      if (perp > (t.radius || 3)) continue;
      if (along < bestT) { bestT = along; best = t; }
    }
    const ix = shot.x + fx * bestT, iz = shot.z + fz * bestT;
    if (best) best.onHit(shot.damage, shot.explosive, ix, iz);
    return { hit: best, ix, iz, explosive: shot.explosive };
  }
}
