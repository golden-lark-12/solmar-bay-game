// vehicle.js — car factory (low-poly, shared materials) and arcade car physics:
// acceleration, braking, steering that scales with speed, handbrake drift,
// skid smoke and headlights. One class serves player cars, traffic and police.
// Also builds the striped roadblock barrier and scorched wreck shells.
import { clamp, angleDiff } from './utils.js';

const bodyColors = [0xc03a3a, 0x3a6ac0, 0xe8c84a, 0x4aa86a, 0xd8d8d8, 0x2a2a30, 0xe07a2a, 0x8a4aa8];
const bodyGeo = new THREE.BoxGeometry(2.0, 0.62, 4.3);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2430 });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
const rimMat = new THREE.MeshLambertMaterial({ color: 0xb8b8b8 });
const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe98a, emissiveIntensity: 1.4 });
const tailMat = new THREE.MeshLambertMaterial({ color: 0xc02020, emissive: 0x880000 });
const bodyMats = bodyColors.map(c => new THREE.MeshLambertMaterial({ color: c }));

export function makeCarMesh(colorIndex = 0, police = false) {
  const g = new THREE.Group();
  const bodyMat = police
    ? new THREE.MeshLambertMaterial({ color: 0xf0f0f0 })
    : bodyMats[colorIndex % bodyMats.length];
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.05, -0.2); cabin.castShadow = true; g.add(cabin);
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 4.32),
      new THREE.MeshLambertMaterial({ color: 0x2040c0 }));
    stripe.position.y = 0.62; g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2040c0, emissive: 0x3040ff, emissiveIntensity: 0.8 }));
    bar.position.set(0, 1.42, -0.2); g.add(bar);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2 }));
    beacon.position.set(-0.3, 1.58, -0.2); g.add(beacon);
    const beacon2 = beacon.clone();
    beacon2.material = new THREE.MeshLambertMaterial({ color: 0x2020ff, emissive: 0x0000ff, emissiveIntensity: 2 });
    beacon2.position.x = 0.3; g.add(beacon2);
  }
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2; w.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), rimMat);
    rim.rotation.z = Math.PI / 2; w.add(rim);
    w.position.set(x, 0.38, z); g.add(w); wheels.push(w);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.1), lightMat);
  hl.position.set(0, 0.62, 2.16); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.1), tailMat);
  tl.position.set(0, 0.62, -2.16); g.add(tl);
  g.userData.wheels = wheels;
  g.userData.police = police;
  return g;
}

// Striped police barrier: a sawhorse bar across the road, two legs, two cones.
export function makeBarrierMesh() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf0f0e8 });
  const red = new THREE.MeshLambertMaterial({ color: 0xd82828, emissive: 0x661111 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 0.24), white);
  bar.position.y = 1.05; bar.castShadow = true; g.add(bar);
  for (let i = -2; i <= 2; i += 2) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.52, 0.26), red);
    stripe.position.set(i * 1.35, 1.05, 0); g.add(stripe);
  }
  for (const sx of [-2.4, 2.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x303030 }));
    leg.position.set(sx, 0.55, 0); g.add(leg);
  }
  const coneMat = new THREE.MeshLambertMaterial({ color: 0xff6a1a, emissive: 0x992200 });
  for (const sx of [-3.6, 3.6]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 8), coneMat);
    cone.position.set(sx, 0.5, 0.8); cone.castShadow = true; g.add(cone);
  }
  return g;
}

// Scorched wreck shell: blackened body, caved cabin, one wheel gone, tilted.
export function makeWreckMesh() {
  const g = new THREE.Group();
  const burnt = new THREE.MeshLambertMaterial({ color: 0x1c1a18 });
  const body = new THREE.Mesh(bodyGeo, burnt);
  body.position.y = 0.45; body.rotation.z = 0.06; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(cabinGeo,
    new THREE.MeshLambertMaterial({ color: 0x0c0c0c }));
  cabin.position.set(0, 0.9, -0.2); cabin.scale.y = 0.55; g.add(cabin);
  for (const [x, z] of [[-0.95, 1.35], [0.95, -1.35], [-0.95, -1.35]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2; w.add(tire);
    w.position.set(x, 0.34, z); g.add(w);
  }
  g.userData.wheels = [];
  return g;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.pos = { x, z };
    this.heading = heading;
    this.speed = 0;         // m/s, forward positive
    this.steer = 0;
    this.maxSpeed = 34;
    this.maxReverse = 10;
    this.health = 100;      // car condition % — rams and bullets wear it down
    this.skidding = false;
  }

  // Arcade drive: throttle -1..1, steer -1..1, handbrake bool.
  drive(throttle, steer, handbrake, dt, onSkid) {
    const accel = 16, brake = 26, drag = 0.6;
    if (throttle > 0) this.speed += accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed += brake * throttle * dt;
      else this.speed += accel * 0.6 * throttle * dt; // reverse
    }
    if (handbrake) this.speed *= Math.max(0, 1 - 2.2 * dt);
    this.speed -= this.speed * drag * dt * (handbrake ? 0.4 : 1);
    this.speed = clamp(this.speed, -this.maxReverse, this.maxSpeed);
    const steerTarget = clamp(steer, -1, 1) * (this.speed >= 0 ? 1 : -1);
    this.steer += (steerTarget - this.steer) * Math.min(1, 8 * dt);
    const turnRate = this.steer * (handbrake ? 2.6 : 1.7) * clamp(Math.abs(this.speed) / 8, 0, 1);
    this.heading += turnRate * dt * (this.speed >= 0 ? 1 : -1);
    const sp = this.speed * dt;
    this.pos.x += Math.sin(this.heading) * sp;
    this.pos.z += Math.cos(this.heading) * sp;
    const wasSkid = this.skidding;
    this.skidding = handbrake && Math.abs(this.speed) > 6;
    if (this.skidding && onSkid) {
      const bx = this.pos.x - Math.sin(this.heading) * 1.6;
      const bz = this.pos.z - Math.cos(this.heading) * 1.6;
      onSkid(bx, bz);
    }
    return wasSkid !== this.skidding;
  }

  sync(dt) {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt / 0.38;
    for (const w of this.mesh.userData.wheels) {
      w.rotation.x += spin;
      // front wheels steer visually
    }
    const front = this.mesh.userData.wheels;
    if (front.length >= 2) {
      front[0].rotation.y = this.steer * 0.4;
      front[1].rotation.y = this.steer * 0.4;
    }
  }
}

export function angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }
export function steerToward(car, tx, tz, dt) {
  const want = angleTo(car.pos.x, car.pos.z, tx, tz);
  const diff = angleDiff(car.heading, want);
  return clamp(diff * 1.6, -1, 1);
}
