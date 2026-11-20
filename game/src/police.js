// police.js — wanted level 0-5, police cruisers that chase and ram, helicopter
// with a spotlight cone at wanted 3+, roadblocks at wanted 4+, and the dispatch
// unit list the HUD shows with colored status badges. Puerto Alba.

import { clamp, rand, randi, pick, dist2d } from './utils.js';
import { Car } from './vehicle.js';

export const DISPATCH_STATUSES = [
  { label: 'PURSUIT', color: '#4a8aff' },
  { label: 'RAMMING', color: '#ff3a3a' },
  { label: 'FLANKING', color: '#ff8a2a' },
  { label: 'SPOTLIGHT', color: '#ffd76a' },
  { label: 'ROADBLOCK', color: '#b46aff' },
  { label: 'FIRING', color: '#ff2a6a' },
  { label: 'RESPONDING', color: '#3ad86a' }
];

const UNIT_NAMES = ['P-12', 'P-07', 'P-23', 'P-31', 'P-44', 'P-58', 'P-61', 'P-88', 'CONDOR-1'];

export class Police {
  constructor(THREE, scene, colliders) {
    this.THREE = THREE;
    this.scene = scene;
    this.colliders = colliders;
    this.wanted = 0;
    this.cars = []; // police Car objects
    this.heli = null; // {group, rotor, cone, light}
    this.roadblock = []; // police cars parked as a block
    this.heat = 0; // time since last crime
    this.calmTimer = 0;
    this.dispatch = []; // {code, role, status, dist}
    this.statusSeed = 0;
    this.playerSpotted = false;
    this.chaseTopSpeed = 30;
  }

  addWanted(n, reason) {
    if (n > 0) this.heat = 0;
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.rebuildDispatch();
  }
  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.heat = 0;
    this.rebuildDispatch();
  }

  rebuildDispatch() {
    this.dispatch = [];
    const roles = ['PURSUIT', 'RAMMING', 'FLANKING', 'RESPONDING', 'PURSUIT', 'RAMMING'];
    for (let i = 0; i < this.wanted; i++) {
      const st = DISPATCH_STATUSES.find(s => s.label === roles[i % roles.length]);
      this.dispatch.push({
        code: UNIT_NAMES[i % UNIT_NAMES.length],
        role: roles[i % roles.length],
        status: st.label, color: st.color,
        dist: randi(40, 320)
      });
    }
    if (this.wanted >= 3) {
      this.dispatch.push({ code: 'CONDOR-1', role: 'AIR UNIT', status: 'SPOTLIGHT', color: '#ffd76a', dist: randi(90, 180) });
    }
    if (this.wanted >= 4) {
      this.dispatch.push({ code: 'P-58', role: 'ROADBLOCK', status: 'ROADBLOCK', color: '#b46aff', dist: randi(60, 140) });
    }
    if (this.wanted >= 5) {
      this.dispatch.push({ code: 'P-88', role: 'INTERCEPT', status: 'FIRING', color: '#ff2a6a', dist: randi(30, 90) });
    }
  }

  // Spawn/despawn cruisers + heli to match the wanted level.
  syncUnits(playerX, playerZ, heading) {
    const wantCars = Math.min(this.wanted, 5);
    while (this.cars.length < wantCars) {
      const a = rand(0, Math.PI * 2);
      const car = new Car(this.THREE, this.scene, {
        x: playerX + Math.sin(a) * rand(45, 70),
        z: playerZ + Math.cos(a) * rand(45, 70),
        color: 0x1a1a2a, name: 'Interceptor', topSpeed: 31, isPolice: true
      });
      // Light bar.
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      bar.position.set(-0.35, 1.85, -0.2); car.mesh.add(bar);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
      bar2.position.set(0.35, 1.85, -0.2); car.mesh.add(bar2);
      this.cars.push(car);
    }
    while (this.cars.length > wantCars) {
      const c = this.cars.pop();
      c.dispose();
    }
    // Helicopter.
    if (this.wanted >= 3 && !this.heli) this.spawnHeli();
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli.group);
      this.scene.remove(this.heli.cone);
      this.heli = null;
    }
    // Roadblock.
    if (this.wanted >= 4 && this.roadblock.length === 0) this.spawnRoadblock(playerX, playerZ, heading);
    if (this.wanted < 4 && this.roadblock.length > 0) {
      for (const c of this.roadblock) c.dispose();
      this.roadblock = [];
    }
  }

  spawnHeli() {
    const g = new THREE.Group();
    // Bright light-gray body so the heli reads against the orange sky.
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6.5),
      new THREE.MeshLambertMaterial({ color: 0x9a9aa8 }));
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 6.6),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }));
    stripe.position.y = 0.2; g.add(stripe);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5),
      new THREE.MeshLambertMaterial({ color: 0x9a9aa8 }));
    tail.position.set(0, 0.3, -5); g.add(tail);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x2a6a8a }));
    glass.position.set(0, 0.2, 2.6); g.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.15, 0.7),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    rotor.position.y = 1.3; g.add(rotor);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    lamp.position.set(0, -1.1, 2.5); g.add(lamp);
    g.scale.set(1.4, 1.4, 1.4);
    // Spotlight cone (translucent) hanging below the helicopter: narrow at
    // the heli, wide at the ground.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(8, 18, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
    );
    this.scene.add(g);
    this.scene.add(cone);
    this.heli = { group: g, rotor, cone, lamp };
  }

  spawnRoadblock(px, pz, heading) {
    // Two cruisers parked across the road ahead of the player, perpendicular
    // to the player's direction of travel.
    const h = heading || 0;
    const ax = px + Math.sin(h) * 55, az = pz + Math.cos(h) * 55;
    const perpX = Math.cos(h), perpZ = -Math.sin(h);
    for (const off of [-4.5, 4.5]) {
      const car = new Car(this.THREE, this.scene, {
        x: ax + perpX * off, z: az + perpZ * off, color: 0x1a1a2a, name: 'Roadblock', topSpeed: 0, isPolice: true
      });
      car.heading = h + Math.PI / 2;
      car.mesh.rotation.y = car.heading;
      this.roadblock.push(car);
    }
  }

  update(dt, playerX, playerZ, playerCar, onRam) {
    this.heat += dt;
    // Cool down: no crime for a while and out of sight -> wanted drops.
    if (this.wanted > 0 && this.heat > 22) {
      this.calmTimer += dt;
      if (this.calmTimer > 9) {
        this.calmTimer = 0;
        this.wanted = Math.max(0, this.wanted - 1);
        this.rebuildDispatch();
      }
    } else {
      this.calmTimer = 0;
    }
    this.syncUnits(playerX, playerZ, playerCar ? playerCar.heading : 0);
    // Cruisers chase.
    this.playerSpotted = false;
    for (const c of this.cars) {
      const d = dist2d(c.x, c.z, playerX, playerZ);
      if (d < 240) this.playerSpotted = true;
      c.chase(dt, playerX, playerZ, this.chaseTopSpeed);
      if (d < 5.5 && playerCar) {
        // Ram: damage the player's car.
        if (onRam) onRam(c, d);
      }
    }
    // Helicopter hovers ahead of the player, spotlight cone follows.
    if (this.heli) {
      const h = this.heli;
      const hd = playerCar ? playerCar.heading : 0;
      const fx = Math.sin(hd), fz = Math.cos(hd);
      const px = Math.cos(hd), pz = -Math.sin(hd);
      h.group.position.set(playerX + fx * 45 + px * 18, 18, playerZ + fz * 45 + pz * 18);
      h.group.rotation.y += dt * 0.4;
      h.rotor.rotation.y += dt * 22;
      h.cone.position.set(playerX + fx * 45 + px * 18, 10, playerZ + fz * 45 + pz * 18);
      h.cone.rotation.z = Math.sin(Date.now() * 0.001) * 0.12;
    }
    // Dispatch distances drift.
    for (const u of this.dispatch) {
      u.dist = clamp(u.dist + rand(-14, 14) * dt, 25, 420);
    }
    // Rotate statuses occasionally so the panel feels alive.
    this.statusSeed += dt;
    if (this.statusSeed > 6) {
      this.statusSeed = 0;
      for (const u of this.dispatch) {
        if (u.role === 'PURSUIT' && Math.random() < 0.5) {
          u.status = Math.random() < 0.5 ? 'RAMMING' : 'FLANKING';
          const st = DISPATCH_STATUSES.find(s => s.label === u.status);
          u.color = st.color;
        }
      }
    }
  }

  clearAll() {
    for (const c of this.cars) c.dispose();
    for (const c of this.roadblock) c.dispose();
    this.cars = []; this.roadblock = [];
    if (this.heli) {
      this.scene.remove(this.heli.group);
      this.scene.remove(this.heli.cone);
      this.heli = null;
    }
    this.wanted = 0;
    this.dispatch = [];
  }
}
