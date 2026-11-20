// combat.js — pistol (12 rounds, R reload, hitscan with a tracer + muzzle flash)
// and the F punch. Shooting is loud: it scares pedestrians and raises wanted.
// Raycasts against pedestrians, cop cars and traffic cars only.
import { dist2 } from './utils.js';

const AMMO_MAX = 12;
const RANGE = 90;

export class Combat {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.ammo = AMMO_MAX;
    this.reserve = 60;
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

  update(dt) {
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = AMMO_MAX - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take; this.reserve -= take;
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) { this.flash.visible = false; this.tracer.visible = false; }
    }
  }

  tryReload() {
    if (this.ammo < AMMO_MAX && this.reserve > 0 && this.reloadTimer <= 0) {
      this.reloadTimer = 1.1;
      return true;
    }
    return false;
  }

  // Fire from the player's chest along the camera yaw. Returns a hit report.
  shoot(camYaw, peds, police, traffic) {
    if (this.player.inCar || this.reloadTimer > 0) return null;
    if (this.ammo <= 0) return { empty: true };
    this.ammo--;
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
    return { hit: best, hx, hz, dist: bestD };
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
