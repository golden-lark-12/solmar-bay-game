// player.js — Ria Solano on foot: walk/run, camera-facing movement, enter/exit car.
// Exiting places her BESIDE the car (never on its roof). Puerto Alba.

import { clamp } from './utils.js';

let _contactShadowTex = null;
function contactShadowTexture(THREE) {
  if (_contactShadowTex) return _contactShadowTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _contactShadowTex = new THREE.CanvasTexture(c);
  return _contactShadowTex;
}

export class Player {
  constructor(THREE, scene, x, z) {
    this.THREE = THREE;
    this.scene = scene;
    this.group = new THREE.Group();
    // Body: teal jacket, dark jeans, hair.
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2ad8c8 });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b48a });
    const hair = new THREE.MeshLambertMaterial({ color: 0x2a1a1a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), jacket);
    torso.position.y = 1.15; this.group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.78; this.group.add(head);
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), hair);
    hairTop.position.y = 1.86; hairTop.scale.set(1, 0.75, 1); this.group.add(hairTop);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), jeans);
    this.legL.position.set(-0.16, 0.38, 0); this.group.add(this.legL);
    this.legR = this.legL.clone(); this.legR.position.x = 0.16; this.group.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), jacket);
    this.armL.position.set(-0.42, 1.2, 0); this.group.add(this.armL);
    this.armR = this.armL.clone(); this.armR.position.x = 0.42; this.group.add(this.armR);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(THREE), transparent: true, opacity: 0.55, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.045;
    shadow.name = 'contact-shadow';
    this.group.add(shadow);
    this.group.position.set(x || 0, 0, z || 0);
    this.heading = 0;
    this.group.rotation.y = 0;
    this.speed = 0;
    this.inCar = false;
    this.walkPhase = 0;
    scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  setPos(x, z, heading) {
    this.group.position.x = x; this.group.position.z = z;
    if (heading !== undefined) { this.heading = heading; this.group.rotation.y = heading; }
  }

  update(dt, input, camHeading) {
    if (this.inCar) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const wx = input.walkX, wy = input.walkY;
    const moving = wx !== 0 || wy !== 0;
    const runSpeed = input.sprint ? 9 : 5;
    if (moving) {
      // Movement is relative to the camera heading.
      const sin = Math.sin(camHeading), cos = Math.cos(camHeading);
      const mx = (wx * cos + wy * sin);
      const mz = (wy * cos - wx * sin);
      const len = Math.hypot(mx, mz) || 1;
      this.group.position.x += (mx / len) * runSpeed * dt;
      this.group.position.z += (mz / len) * runSpeed * dt;
      this.heading = Math.atan2(mx / len, mz / len);
      this.group.rotation.y = this.heading;
      this.speed = runSpeed;
      this.walkPhase += dt * runSpeed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing; this.armR.rotation.x = swing;
    } else {
      this.speed = 0;
      this.legL.rotation.x *= 0.8; this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8; this.armR.rotation.x *= 0.8;
    }
  }

  // Step out of a car: stand beside the driver's door, on the ground.
  exitCarBeside(car) {
    const sideX = Math.cos(car.heading), sideZ = -Math.sin(car.heading);
    const px = car.x + sideX * 2.4;
    const pz = car.z + sideZ * 2.4;
    this.setPos(px, pz, car.heading);
    this.inCar = false;
  }

  // Stand beside a car (for the steal shot staging): same rule, explicit.
  // Camera side, so the character is visible in the steal shot.
  standBesideCar(car) {
    const sideX = -Math.cos(car.heading), sideZ = Math.sin(car.heading);
    this.setPos(car.x + sideX * 2.2, car.z + sideZ * 2.2, car.heading + Math.PI / 2);
    this.inCar = false;
  }
}
