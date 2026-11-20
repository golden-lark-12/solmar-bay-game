// player.js — Ria Solano on foot: WASD movement relative to camera, Shift to run,
// third-person orbit camera with pointer-lock mouse look, and a low-poly figure
// whose legs swing as she walks. Also owns health and the "busted / wasted" hooks.
import { clamp, angleDiff } from './utils.js';
import { collide } from './city.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.pos = { x: -30, z: 30 };
    this.heading = 0;      // facing
    this.camYaw = Math.PI; // camera orbit yaw
    this.camPitch = 0.32;
    this.health = 100;
    this.speed = 0;
    this.inCar = null;     // Car instance when driving
    this.punchTimer = 0;
    this.group = this.buildFigure();
    scene.add(this.group);
  }

  buildFigure() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xc0392b });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a078 });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), jacket);
    body.position.y = 1.18; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.78; head.castShadow = true; g.add(head);
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairM.position.y = 1.82; g.add(hairM);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), jacket);
    armL.position.set(-0.42, 1.2, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), jeans);
    legL.position.set(-0.17, 0.42, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
    // pistol in right hand (shown when armed)
    const gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    gun.add(barrel);
    gun.position.set(0.42, 0.92, 0.28);
    g.add(gun);
    g.userData = { armL, armR, legL, legR, gun, body };
    return g;
  }

  update(dt, input, city, walkable) {
    if (this.inCar) return; // driving is handled by vehicle code
    const { down, mouseDX, mouseDY } = input;
    this.camYaw -= mouseDX * 0.0028;
    this.camPitch = clamp(this.camPitch + mouseDY * 0.0022, 0.08, 1.1);
    let fx = 0, fz = 0;
    if (down('KeyW')) fz -= 1;
    if (down('KeyS')) fz += 1;
    if (down('KeyA')) fx -= 1;
    if (down('KeyD')) fx += 1;
    const run = down('ShiftLeft') || down('ShiftRight');
    const mag = Math.hypot(fx, fz);
    const targetSpeed = mag > 0 ? (run ? 8.5 : 4.6) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, 10 * dt);
    if (mag > 0) {
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      // forward = (-sin, -cos); right = (cos, -sin). W is fz=-1 -> forward.
      const wx = (sin * fz + cos * fx) / mag;
      const wz = (cos * fz - sin * fx) / mag;
      const want = Math.atan2(wx, wz);
      this.heading += angleDiff(this.heading, want) * Math.min(1, 14 * dt);
      this.pos.x += wx * this.speed * dt;
      this.pos.z += wz * this.speed * dt;
      collide(city, this.pos, 0.55);
    }
    if (this.punchTimer > 0) this.punchTimer -= dt;
    // walk-cycle swing
    const t = performance.now() / 1000;
    const swing = this.speed > 0.3 ? Math.sin(t * (this.speed * 1.6)) * 0.55 : 0;
    const u = this.group.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7; u.armR.rotation.x = swing * 0.7;
    if (this.punchTimer > 0) u.armR.rotation.x = -1.4;
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.heading;
  }

  // Third-person camera: behind and above the player (or behind the car).
  cameraPos(camTarget, camPos) {
    const dist = this.inCar ? 11 : 7.5;
    const h = this.inCar ? 4.2 : 3.4;
    const yaw = this.inCar ? this.inCar.heading + Math.PI : this.camYaw;
    const pitch = this.inCar ? 0.22 : this.camPitch;
    const px = this.inCar ? this.inCar.pos.x : this.pos.x;
    const pz = this.inCar ? this.inCar.pos.z : this.pos.z;
    const py = this.inCar ? 0.8 : 1.5;
    const cx = px + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = pz + Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = py + Math.sin(pitch) * dist + h - dist * 0.4;
    camTarget.set(px, py, pz);
    camPos.set(cx, Math.max(1.2, cy), cz);
  }

  damage(amount) { this.health = Math.max(0, this.health - amount); return this.health <= 0; }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
  respawn(x, z) {
    this.pos.x = x; this.pos.z = z;
    this.health = 100; this.inCar = null; this.speed = 0;
    this.group.position.set(x, 0, z);
  }
}
