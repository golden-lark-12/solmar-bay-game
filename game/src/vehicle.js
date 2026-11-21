// vehicle.js — Puerto Alba car factory + driving model.
// Boxy stylized cars: body, dark glass cabin, box lights, cylinder wheels,
// optional spoiler / police light bar / driver silhouette.

import { pick } from './utils.js';

export const CAR_NAMES = ['Alba Cruiser', 'Comet GT', 'Marina Coupe', 'Island Cabrio', 'Dune Buggy', 'Causeway Hauler', 'Strand Runner', 'Casino Limo'];

const PAINT = [0xff6a1e, 0x2ad8c8, 0xff4a6a, 0xffd76a, 0x7ad8ff, 0xb46aff, 0x3ad86a, 0xf2f2f2, 0x8a6a3a, 0xc96f4a, 0x2a4a8a, 0xd8d8d8];

export function randomCarColor() {
  return pick(PAINT);
}

function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function keyDown(input, code) {
  if (!input) return false;
  if (typeof input.isDown === 'function') return !!input.isDown(code);
  if (input.keys && typeof input.keys.has === 'function') return input.keys.has(code);
  if (input.keys && Array.isArray(input.keys)) return input.keys.includes(code);
  return !!input[code];
}

function inputFlag(input, codes, props) {
  for (const c of codes) if (keyDown(input, c)) return true;
  if (!input) return false;
  for (const p of props) if (input[p]) return true;
  return false;
}

function box(THREE, w, h, d, color, opts) {
  const o = opts || {};
  const mat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: o.roughness !== undefined ? o.roughness : 0.55,
    metalness: o.metalness !== undefined ? o.metalness : 0.25,
    transparent: !!o.transparent,
    opacity: o.opacity !== undefined ? o.opacity : 1,
    emissive: o.emissive || 0,
    emissiveIntensity: o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  if (o.name) mesh.name = o.name;
  return mesh;
}

export function makeCarMesh(THREE, color, opts) {
  const o = opts || {};
  const g = new THREE.Group();

  // Main body: long box, low and wide.
  const body = box(THREE, 2.1, 0.75, 4.6, color, { name: 'body' });
  body.position.set(0, 0.55, 0);
  g.add(body);

  // Dark glass cabin, set slightly back.
  const cabin = box(THREE, 1.7, 0.55, 2.0, 0x182838, { roughness: 0.25, metalness: 0.6, name: 'cabin' });
  cabin.position.set(0, 1.15, -0.3);
  g.add(cabin);

  // Headlights (front, +Z) — warm white, slightly emissive.
  for (const sx of [-0.7, 0.7]) {
    const hl = box(THREE, 0.35, 0.18, 0.1, 0xfff2c8, { emissive: 0xfff2c8, emissiveIntensity: 0.9, name: 'headlight' });
    hl.position.set(sx, 0.55, 2.32);
    g.add(hl);
  }

  // Taillights (rear, -Z) — red.
  for (const sx of [-0.7, 0.7]) {
    const tl = box(THREE, 0.35, 0.18, 0.1, 0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.8, name: 'taillight' });
    tl.position.set(sx, 0.55, -2.32);
    g.add(tl);
  }

  // Wheels: dark cylinders, axle along X.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.9, metalness: 0.1 });
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.name = 'wheel';
    g.add(w);
  }

  // Spoiler: thin blade on two struts at the rear.
  if (o.spoiler) {
    const blade = box(THREE, 1.9, 0.08, 0.5, color, { name: 'spoiler' });
    blade.position.set(0, 1.08, -2.1);
    g.add(blade);
    for (const sx of [-0.7, 0.7]) {
      const strut = box(THREE, 0.08, 0.28, 0.08, 0x222222, { name: 'spoiler-strut' });
      strut.position.set(sx, 0.9, -2.1);
      g.add(strut);
    }
  }

  // Police light bar: dark base with red / blue halves on the cabin roof.
  if (o.police) {
    const base = box(THREE, 1.2, 0.12, 0.4, 0x222222, { name: 'lightbar-base' });
    base.position.set(0, 1.5, -0.3);
    g.add(base);
    const red = box(THREE, 0.55, 0.16, 0.42, 0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 1.2, name: 'lightbar-red' });
    red.position.set(-0.3, 1.54, -0.3);
    g.add(red);
    const blue = box(THREE, 0.55, 0.16, 0.42, 0x2a6aff, { emissive: 0x2a6aff, emissiveIntensity: 1.2, name: 'lightbar-blue' });
    blue.position.set(0.3, 1.54, -0.3);
    g.add(blue);
  }

  // Driver silhouette: dark torso + skin-tone head, left seat.
  if (o.driver) {
    const torso = box(THREE, 0.5, 0.55, 0.3, 0x2a2a2a, { name: 'driver-torso' });
    torso.position.set(-0.4, 1.15, 0.1);
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.7 })
    );
    head.position.set(-0.4, 1.58, 0.1);
    head.name = 'driver-head';
    g.add(head);
  }

  return g;
}

export class Car {
  constructor(THREE, scene, opts) {
    const o = opts || {};
    this.THREE = THREE;
    this.scene = scene;
    this.name = o.name || 'Alba Cruiser';
    this.color = o.color !== undefined && o.color !== null ? o.color : 0xff6a1e;
    this.mesh = makeCarMesh(THREE, this.color, {
      police: !!o.isPolice,
      spoiler: !!o.spoiler,
      driver: !!o.driver
    });
    this.x = o.x || 0;
    this.z = o.z || 0;
    this.heading = o.heading || 0;
    this.speed = 0;
    this.topSpeed = o.topSpeed || 32;
    this.accel = o.accel || 16;
    this.condition = 100;
    this.nitro = 100;
    this.nitroActive = false;
    this.slipstream = 0;
    this.isPlayer = !!o.isPlayer;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    if (scene) scene.add(this.mesh);
  }

  setPos(x, z, heading) {
    this.x = x;
    this.z = z;
    if (heading !== undefined && heading !== null) this.heading = heading;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  damage(amount) {
    this.condition = Math.max(0, this.condition - (amount || 0));
  }

  repair() {
    this.condition = 100;
  }

  update(dt, input, nitroOwned) {
    const fwd = inputFlag(input, ['KeyW', 'ArrowUp'], ['forward', 'up']);
    const back = inputFlag(input, ['KeyS', 'ArrowDown'], ['back', 'down']);
    const left = inputFlag(input, ['KeyA', 'ArrowLeft'], ['left']);
    const right = inputFlag(input, ['KeyD', 'ArrowRight'], ['right']);
    const nitroKey = inputFlag(input, ['ShiftLeft', 'ShiftRight'], ['nitro', 'boost']);

    let top = this.topSpeed;
    this.nitroActive = false;
    if (nitroKey && nitroOwned && this.nitro > 0 && fwd) {
      top = this.topSpeed * 1.55;
      this.nitro = Math.max(0, this.nitro - dt * 28);
      this.nitroActive = true;
    } else if (!nitroKey) {
      this.nitro = Math.min(100, this.nitro + dt * 3);
    }
    if (this.slipstream > 0) {
      this.slipstream -= dt;
      top = top * 1.25;
    }

    let target = 0;
    if (fwd) target = top;
    if (back) target = -this.topSpeed * 0.45;
    // Nitro is a boost: it raises the top speed AND the acceleration, so
    // the car actually reaches the higher speed inside a short burst.
    const acc = this.nitroActive ? this.accel * 1.8 : this.accel;
    if (this.speed < target) {
      this.speed = Math.min(target, this.speed + acc * dt);
    } else if (this.speed > target) {
      this.speed = Math.max(target, this.speed - this.accel * 1.6 * dt);
    }
    if (!fwd && !back) {
      const s = Math.sign(this.speed);
      this.speed -= s * Math.min(Math.abs(this.speed), 14 * dt);
    }

    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    if (steer !== 0 && Math.abs(this.speed) > 0.5) {
      this.heading += steer * 2.0 * dt * Math.min(1, Math.abs(this.speed) / 10) * Math.sign(this.speed);
    }
    // Keep the heading wrapped so long drives don't grow it unbounded.
    while (this.heading > Math.PI) this.heading -= Math.PI * 2;
    while (this.heading < -Math.PI) this.heading += Math.PI * 2;

    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  chase(dt, tx, tz, topSpeed) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const diff = angDiff(this.heading, want);
    const turn = Math.max(-1, Math.min(1, diff * 2));
    this.heading += turn * 2.2 * dt;
    const top = topSpeed || this.topSpeed;
    if (dist > 6) {
      this.speed = Math.min(top, this.speed + this.accel * dt);
    } else {
      this.speed = Math.max(0, this.speed - this.accel * dt);
    }
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  dispose() {
    if (this.scene && this.mesh) this.scene.remove(this.mesh);
  }
}
