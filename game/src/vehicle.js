// vehicle.js — Puerto Alba cars. Boxy stylized cars with light glass cabins,
// headlights, taillights, wheels, optional spoiler / police light bar / driver.
import { pick } from './utils.js';

export const CAR_NAMES = [
  'Alba Cruiser', 'Comet GT', 'Marina Coupe', 'Island Cabrio',
  'Dune Buggy', 'Causeway Hauler', 'Strand Runner', 'Casino Limo',
];

const PAINT = [
  0xff6a1e, 0x2ad8c8, 0xff4a6a, 0xffd76a, 0x7ad8ff, 0xb46aff,
  0x3ad86a, 0xf2f2f2, 0x8a6a3a, 0xc96f4a, 0x2a4a8a, 0xd8d8d8,
];

export function randomCarColor() {
  return pick(PAINT);
}

function box(THREE, w, h, d, color, opts) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts && opts.roughness !== undefined ? opts.roughness : 0.55,
    metalness: opts && opts.metalness !== undefined ? opts.metalness : 0.25,
    transparent: !!(opts && opts.transparent),
    opacity: opts && opts.opacity !== undefined ? opts.opacity : 1,
    emissive: opts && opts.emissive !== undefined ? opts.emissive : 0x000000,
    emissiveIntensity: opts && opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 1,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  if (opts && opts.name) m.name = opts.name;
  return m;
}

export function makeCarMesh(THREE, color, opts) {
  opts = opts || {};
  const g = new THREE.Group();
  // Main body.
  const body = box(THREE, 2.1, 0.75, 4.6, color, { name: 'body' });
  body.position.y = 0.55;
  g.add(body);
  // Nose + tail trim.
  const nose = box(THREE, 2.0, 0.3, 0.35, color, { name: 'body' });
  nose.position.set(0, 0.42, 2.32);
  g.add(nose);
  // Cabin: LIGHT blue-grey glass, semi-transparent, so it reads as a
  // windshield / cabin instead of a black box on the roof.
  const cabin = box(THREE, 1.7, 0.62, 2.1, 0x9fc4d8, {
    name: 'cabin', transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.45,
  });
  cabin.position.set(0, 1.2, -0.25);
  g.add(cabin);
  // Roof panel (thin, body color) so the cabin reads as glass under a roof.
  const roof = box(THREE, 1.75, 0.08, 1.5, color, { name: 'body' });
  roof.position.set(0, 1.54, -0.25);
  g.add(roof);
  // Headlights.
  const hl = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), hl);
    h.position.set(sx, 0.55, 2.34);
    h.name = 'headlight';
    g.add(h);
  }
  // Taillights.
  const tl = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xaa0000, emissiveIntensity: 0.9 });
  for (const sx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), tl);
    t.position.set(sx, 0.55, -2.34);
    t.name = 'taillight';
    g.add(t);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.35, metalness: 0.7 });
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.name = 'wheel';
    g.add(w);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.42, wz);
    hub.name = 'wheel';
    g.add(hub);
  }
  // Spoiler.
  if (opts.spoiler) {
    const sp = box(THREE, 1.9, 0.08, 0.5, 0x1a1a1a, { name: 'spoiler' });
    sp.position.set(0, 1.15, -2.15);
    g.add(sp);
    for (const sx of [-0.8, 0.8]) {
      const leg = box(THREE, 0.08, 0.35, 0.08, 0x1a1a1a, { name: 'spoiler' });
      leg.position.set(sx, 0.95, -2.15);
      g.add(leg);
    }
  }
  // Police light bar: red left, blue right.
  if (opts.police) {
    const bar = box(THREE, 1.5, 0.16, 0.4, 0x222222, { name: 'lightbar' });
    bar.position.set(0, 1.62, -0.25);
    g.add(bar);
    const red = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 1.4 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2a6aff, emissive: 0x0033ff, emissiveIntensity: 1.4 });
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.42), red);
    r.position.set(-0.38, 1.62, -0.25);
    r.name = 'lightbar-red';
    g.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.42), blue);
    b.position.set(0.38, 1.62, -0.25);
    b.name = 'lightbar-blue';
    g.add(b);
  }
  // Driver silhouette in the cabin (visible from a 3/4 rear angle).
  if (opts.driver) {
    const suit = new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.35), suit);
    torso.position.set(-0.35, 1.05, -0.15);
    torso.name = 'driver';
    g.add(torso);
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8b088, roughness: 0.7 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
    head.position.set(-0.35, 1.48, -0.15);
    head.name = 'driver';
    g.add(head);
    const hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    cap.position.set(-0.35, 1.5, -0.15);
    cap.name = 'driver';
    g.add(cap);
  }
  return g;
}

export class Car {
  constructor(THREE, scene, opts) {
    opts = opts || {};
    this.THREE = THREE;
    this.scene = scene;
    this.name = opts.name || 'Alba Cruiser';
    this.color = opts.color !== undefined ? opts.color : 0xff6a1e;
    this.mesh = makeCarMesh(THREE, this.color, {
      police: !!opts.isPolice,
      spoiler: !!opts.spoiler,
      driver: !!opts.driver,
    });
    this.mesh.position.set(opts.x || 0, 0, opts.z || 0);
    this.heading = opts.heading || 0;
    this.mesh.rotation.y = this.heading;
    this.speed = 0;
    this.topSpeed = opts.topSpeed || 32;
    this.accel = opts.accel || 16;
    this.condition = 100;
    this.health = 100;
    this.isPlayer = !!opts.isPlayer;
    this.isPolice = !!opts.isPolice;
    this.isRival = !!opts.isRival;
    this.burning = false;
    this.nitro = 100;
    this.nitroActive = false;
    this.slipstream = 0;
    scene.add(this.mesh);
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  setPos(x, z, heading) {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
    if (heading !== undefined) {
      this.heading = heading;
      this.mesh.rotation.y = heading;
    }
  }

  damage(amount) {
    this.condition = Math.max(0, this.condition - amount);
    this.health = this.condition;
    if (this.condition <= 25) this.burning = true;
    return this.condition;
  }

  repair() {
    this.condition = 100;
    this.health = 100;
    this.burning = false;
  }

  update(dt, input, nitroOwned) {
    // Input exposes throttle/steer/nitro as value properties (not methods).
    const throttle = input
      ? (typeof input.throttle === 'function' ? input.throttle() : (input.throttle || 0))
      : 0;
    const steer = input
      ? (typeof input.steer === 'function' ? input.steer() : (input.steer || 0))
      : 0;
    const nitroDown = input
      ? (typeof input.nitro === 'function' ? input.nitro() : !!input.nitro)
      : false;
    const wantNitro = !!(nitroOwned && nitroDown && throttle > 0 && this.nitro > 1);
    this.nitroActive = wantNitro;
    let top = this.topSpeed;
    if (wantNitro) top *= 1.5;
    if (this.slipstream > 0) { top *= 1.25; this.slipstream = Math.max(0, this.slipstream - dt); }
    const target = throttle * top;
    let rate = throttle !== 0 ? this.accel : this.accel * 1.6;
    if (wantNitro) rate *= 1.8; // nitro punches hard off the line.
    if (this.speed < target) this.speed = Math.min(target, this.speed + rate * dt);
    else if (this.speed > target) this.speed = Math.max(target, this.speed - rate * dt);
    if (wantNitro) this.nitro = Math.max(0, this.nitro - 30 * dt);
    else this.nitro = Math.min(100, this.nitro + 8 * dt);
    const spd = Math.abs(this.speed);
    if (spd > 0.3) {
      const turn = 2.3 * Math.min(1, spd / 9) * (this.speed < 0 ? -1 : 1);
      this.heading += steer * turn * dt;
    }
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.mesh.position.x += fx * this.speed * dt;
    this.mesh.position.z += fz * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    this.mesh.position.x = Math.max(-300, Math.min(300, this.mesh.position.x));
    this.mesh.position.z = Math.max(-300, Math.min(560, this.mesh.position.z));
  }

  chase(dt, tx, tz, topSpeed) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const top = topSpeed || this.topSpeed;
    const dist = Math.hypot(dx, dz);
    const target = dist > 4 ? top : top * 0.4;
    if (this.speed < target) this.speed = Math.min(target, this.speed + this.accel * dt);
    else this.speed = Math.max(target, this.speed - this.accel * dt);
    this.mesh.position.x += Math.sin(this.heading) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.rotation.y = this.heading;
  }

  dispose() {
    if (this.scene) this.scene.remove(this.mesh);
  }
}
