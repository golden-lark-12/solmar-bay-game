// vehicle.js — car meshes + arcade driving: accel, brake, steering, nitro,
// condition (damage), headlights, taillights. Puerto Alba.

import { clamp, angleDiff } from './utils.js';

export const CAR_NAMES = [
  'Comet GT', 'Alba Cruiser', 'Strand Runner', 'Marina Coupe',
  'Causeway Hauler', 'Island Cabrio', 'Dune Buggy', 'Luna Limo'
];

const CAR_COLORS = [0x2ad8c8, 0xffd76a, 0xff4a6a, 0x4a8aff, 0xf0f0f0, 0x8a4aff, 0xff8a4a, 0x3a3a3a];

// Build a boxy stylized car. Returns a THREE.Group with userData.wheels.
export function makeCarMesh(THREE, color, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
  body.position.y = 0.75;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.3), glassMat);
  cabin.position.set(0, 1.4, -0.2);
  g.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.7), bodyMat);
  nose.position.set(0, 0.6, 2.5);
  g.add(nose);
  // Headlights (front = +z) and taillights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.1), hl);
    h.position.set(sx, 0.7, 2.86); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.1), tl);
    t.position.set(sx, 0.75, -2.32); g.add(t);
  }
  if (o.spoiler) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5), bodyMat);
    sp.position.set(0, 1.35, -2.2); g.add(sp);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export function randomCarColor() {
  return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
}

export class Car {
  constructor(THREE, scene, opts) {
    const o = opts || {};
    this.THREE = THREE;
    this.name = o.name || CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)];
    this.color = o.color !== undefined ? o.color : randomCarColor();
    this.mesh = makeCarMesh(THREE, this.color, o);
    this.mesh.position.set(o.x || 0, 0, o.z || 0);
    this.heading = o.heading || 0;
    this.mesh.rotation.y = this.heading;
    this.speed = 0; // m/s, forward positive
    this.topSpeed = o.topSpeed || 34;
    this.accel = o.accel || 16;
    this.condition = o.condition !== undefined ? o.condition : 100;
    this.health = o.health !== undefined ? o.health : 100;
    this.isPlayer = !!o.isPlayer;
    this.isPolice = !!o.isPolice;
    this.isRival = !!o.isRival;
    this.burning = false;
    this.nitro = o.nitro !== undefined ? o.nitro : 100;
    this.nitroActive = false;
    this.slipstream = 0; // seconds of crew speed boost left
    scene.add(this.mesh);
    this.scene = scene;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  setPos(x, z, heading) {
    this.mesh.position.x = x; this.mesh.position.z = z;
    if (heading !== undefined) { this.heading = heading; this.mesh.rotation.y = heading; }
  }

  damage(amount) {
    this.condition = clamp(this.condition - amount, 0, 100);
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0 && !this.burning) this.burning = true;
    return this.health <= 0;
  }
  repair() { this.condition = 100; this.health = 100; this.burning = false; }

  // Arcade update. input: {throttle, steer, nitro} — nitro only if kit owned.
  update(dt, input, nitroOwned) {
    const top = this.topSpeed * (this.slipstream > 0 ? 1.25 : 1);
    if (this.slipstream > 0) this.slipstream -= dt;
    let boosting = false;
    if (input && input.nitro && nitroOwned && this.nitro > 0 && input.throttle > 0) {
      boosting = true;
      this.nitro = clamp(this.nitro - dt * 34, 0, 100);
    } else {
      this.nitro = clamp(this.nitro + dt * 7, 0, 100);
    }
    this.nitroActive = boosting;
    const topNow = boosting ? top * 1.45 : top;
    if (input) {
      const th = input.throttle || 0;
      if (th > 0) this.speed += this.accel * (boosting ? 1.9 : 1) * dt;
      else if (th < 0) {
        if (this.speed > 0.5) this.speed -= this.accel * 1.6 * dt; // brake
        else this.speed -= this.accel * 0.55 * dt; // reverse
      } else {
        this.speed -= this.speed * 1.4 * dt; // drag
      }
      const maxRev = -12;
      this.speed = clamp(this.speed, maxRev, topNow);
      if (Math.abs(this.speed) < 0.05 && th === 0) this.speed = 0;
      const steerAmt = (input.steer || 0) * clamp(Math.abs(this.speed) / 10, 0, 1) * 1.9 * dt;
      // Steering turns the car in the direction of travel.
      this.heading += steerAmt * (this.speed >= 0 ? 1 : -1);
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      this.mesh.position.x += fx * this.speed * dt;
      this.mesh.position.z += fz * this.speed * dt;
      this.mesh.rotation.y = this.heading;
      // Wheel spin.
      const spin = this.speed * dt * 2.2;
      for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
      // Body lean.
      this.mesh.rotation.z = -steerAmt * 2.2;
    }
  }

  // Simple chase steering toward a target point. Returns nothing.
  chase(dt, tx, tz, topSpeed) {
    const dx = tx - this.x, dz = tz - this.z;
    const want = Math.atan2(dx, dz);
    const diff = angleDiff(this.heading, want);
    this.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
    this.speed = clamp(this.speed + 12 * dt, 0, topSpeed || 30);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.mesh.position.x += fx * this.speed * dt;
    this.mesh.position.z += fz * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt * 2.2;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}
