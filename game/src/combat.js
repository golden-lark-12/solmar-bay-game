// combat.js — the weapon slots: fists, P9 pistol, Mako SMG (unlocks after the
// second job) and three locked slots (12G Breacher, AR-9, RPG). Keys 1-6 switch
// slots, R reloads the current gun, click fires a hitscan shot with a tracer +
// muzzle flash, F punches. Shooting is loud: it scares pedestrians and raises
// wanted. Raycasts against pedestrians, cop cars, traffic cars and mission
// target cars only.
import { dist2 } from './utils.js';

const RANGE = 90;

const SLOT_DEFS = [
  { name: 'FISTS', short: 'FISTS', mag: 0, reserve: 0, dmg: 0, locked: false },
  { name: 'P9 PISTOL', short: 'P9', mag: 12, reserve: 60, dmg: 34, locked: false },
  { name: 'MAKO SMG', short: 'MAKO', mag: 30, reserve: 150, dmg: 18, locked: true },
  { name: '12G BREACHER', short: '12G', mag: 6, reserve: 24, dmg: 60, locked: true },
  { name: 'AR-9', short: 'AR-9', mag: 24, reserve: 120, dmg: 26, locked: true },
  { name: 'RPG', short: 'RPG', mag: 1, reserve: 3, dmg: 200, locked: true },
];

export class Combat {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    // live per-slot state (ammo in the mag, ammo in reserve, locked?)
    this.slots = SLOT_DEFS.map(d => ({ ...d, ammo: d.mag, reserveAmmo: d.reserve }));
    this.selected = 1; // P9 by default
    this.reloadTimer = 0;
    this.flashTimer = 0;
    // muzzle flash: small bright plane at the gun tip
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    this.flash.visible = false;
    scene.add(this.flash);
    // tracer line
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.tracer.visible = false;
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
  }

  get reloading() { return this.reloadTimer > 0; }
  get weapon() { return this.slots[this.selected]; }
  // Back-compat accessors for the HUD's old ammo line.
  get ammo() { return this.weapon.ammo; }
  get reserve() { return this.weapon.reserveAmmo; }

  // The Mako SMG unlocks once two jobs are done; the rest stay locked.
  unlockForJobs(jobsDone) {
    if (jobsDone >= 2) this.slots[2].locked = false;
  }

  select(i) {
    if (i < 0 || i >= this.slots.length) return false;
    if (this.slots[i].locked) return false;
    if (i === this.selected) return false;
    this.selected = i;
    this.reloadTimer = 0;
    return true;
  }

  // HUD-ready snapshot of every slot.
  slotInfo() {
    return this.slots.map((s, i) => ({
      n: i + 1, name: s.short, full: s.name, locked: s.locked,
      ammo: s.mag === 0 ? '∞' : s.ammo, reserve: s.mag === 0 ? '' : '/' + s.reserveAmmo,
      active: i === this.selected,
    }));
  }

  update(dt) {
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const w = this.weapon;
        const need = w.mag - w.ammo;
        const take = Math.min(need, w.reserveAmmo);
        w.ammo += take; w.reserveAmmo -= take;
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) { this.flash.visible = false; this.tracer.visible = false; }
    }
  }

  tryReload() {
    const w = this.weapon;
    if (w.mag === 0) return false;
    if (w.ammo < w.mag && w.reserveAmmo > 0 && this.reloadTimer <= 0) {
      this.reloadTimer = 1.1;
      return true;
    }
    return false;
  }

  // Fire from the player's chest along the camera yaw. Returns a hit report.
  // extraTargets: [{x, z, r, ref}] — e.g. a mission target car.
  shoot(camYaw, peds, police, traffic, extraTargets = []) {
    if (this.player.inCar || this.reloadTimer > 0) return null;
    const w = this.weapon;
    if (w.mag === 0) return null; // fists don't shoot — F punches instead
    if (w.ammo <= 0) return { empty: true };
    w.ammo--;
    const p = this.player.pos;
    const ox = p.x, oy = 1.45, oz = p.z;
    const dx = -Math.sin(camYaw), dz = -Math.cos(camYaw);
    let best = null, bestD = RANGE;
    const test = (x, z, radius, ref) => {
      // ray vs circle in the XZ plane
      const rx = x - ox, rz = z - oz;
      const along = rx * dx + rz * dz;
      if (along < 0 || along > bestD) return;
      const perp = Math.abs(rx * dz - rz * dx);
      if (perp < radius + 0.4) { best = ref; bestD = along; }
    };
    for (const ped of peds.list) if (!ped.down) test(ped.x, ped.z, 0.5, { type: 'ped', ped });
    for (const cop of police.cops) test(cop.pos.x, cop.pos.z, 1.4, { type: 'cop', cop });
    for (const car of traffic.allCars()) test(car.pos.x, car.pos.z, 1.6, { type: 'car', car });
    for (const t of extraTargets) test(t.x, t.z, t.r || 1.6, t.ref);
    const hx = ox + dx * bestD, hz = oz + dz * bestD;
    // show flash + tracer
    const u = this.player.group.userData;
    const gunWorld = new THREE.Vector3();
    u.gun.getWorldPosition(gunWorld);
    this.flash.position.copy(gunWorld);
    this.flash.lookAt(hx, 1.4, hz);
    this.flash.visible = true;
    const pos = this.tracer.geometry.attributes.position.array;
    pos[0] = gunWorld.x; pos[1] = gunWorld.y; pos[2] = gunWorld.z;
    pos[3] = hx; pos[4] = 1.4; pos[5] = hz;
    this.tracer.geometry.attributes.position.needsUpdate = true;
    this.tracer.visible = true;
    this.flashTimer = 0.07;
    return { hit: best, hx, hz, dist: bestD, dmg: w.dmg };
  }

  punch(peds, onHit) {
    if (this.player.inCar) return false;
    this.player.punchTimer = 0.35;
    const p = this.player.pos;
    const fx = Math.sin(this.player.heading), fz = Math.cos(this.player.heading);
    for (const ped of peds.list) {
      if (ped.down) continue;
      const dx = ped.x - p.x, dz = ped.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.2 && (dx * fx + dz * fz) / (d || 1) > 0.3) {
        peds.knockDown(ped);
        if (onHit) onHit(ped);
        return true;
      }
    }
    return false;
  }
}
