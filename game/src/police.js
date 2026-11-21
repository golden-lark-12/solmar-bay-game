// Police dispatch and helicopter air support module.
// police.js — Puerto Alba police: wanted levels, pursuit cruisers, dispatch
// board, helicopter with a wide spotlight cone + bright ground pool.
import { Car } from './vehicle.js';

export const DISPATCH_STATUSES = {
  PURSUIT: '#4a8aff',
  RAMMING: '#ff3a3a',
  FLANKING: '#ff8a2a',
  SPOTLIGHT: '#ffd76a',
  ROADBLOCK: '#b46aff',
  FIRING: '#ff2a6a',
};

const UNIT_CODES = ['P-12', 'P-07', 'P-23', 'P-31', 'P-44', 'P-58', 'P-88'];
const UNIT_ROLES = ['PURSUIT', 'RAMMING', 'FLANKING', 'RESPONDING', 'PURSUIT', 'ROADBLOCK', 'INTERCEPT'];
const ROLE_STATUS = {
  PURSUIT: 'PURSUIT', RAMMING: 'RAMMING', FLANKING: 'FLANKING',
  RESPONDING: 'RESPONDING', ROADBLOCK: 'ROADBLOCK', INTERCEPT: 'FIRING',
};
const ROLE_COLOR = {
  PURSUIT: '#4a8aff', RAMMING: '#ff3a3a', FLANKING: '#ff8a2a',
  RESPONDING: '#3ad86a', ROADBLOCK: '#b46aff', INTERCEPT: '#ff2a6a',
};

function box(THREE, w, h, d, color, opts) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts && opts.roughness !== undefined ? opts.roughness : 0.5,
    metalness: opts && opts.metalness !== undefined ? opts.metalness : 0.3,
    transparent: !!(opts && opts.transparent),
    opacity: opts && opts.opacity !== undefined ? opts.opacity : 1,
    emissive: opts && opts.emissive !== undefined ? opts.emissive : 0x000000,
    emissiveIntensity: opts && opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 1,
    side: opts && opts.side !== undefined ? opts.side : THREE.FrontSide,
    depthWrite: opts && opts.depthWrite !== undefined ? opts.depthWrite : true,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  if (opts && opts.name) m.name = opts.name;
  return m;
}

export class Police {
  constructor(THREE, scene, colliders) {
    this.THREE = THREE;
    this.scene = scene;
    this.colliders = colliders || [];
    this.wanted = 0;
    this.cars = [];
    this.heli = null;
    this.roadblock = [];
    this.heat = 0;
    this.calmTimer = 0;
    this.dispatch = [];
    this.statusSeed = 0;
    this.playerSpotted = false;
    this.chaseTopSpeed = 31;
    this._px = 0;
    this._pz = 0;
    this._heliT = 0;
  }

  _spawnCar(x, z, heading) {
    const car = new Car(this.THREE, this.scene, {
      x, z, heading,
      color: 0x1a1a2a,
      name: 'Interceptor',
      topSpeed: this.chaseTopSpeed,
      accel: 16,
      isPolice: true,
    });
    this.cars.push(car);
    return car;
  }

  _removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    car.dispose();
  }

  _syncCarCount() {
    while (this.cars.length < this.wanted) {
      const a = (this.cars.length / Math.max(1, this.wanted)) * Math.PI * 2 + 0.7;
      const r = 48 + this.cars.length * 9;
      this._spawnCar(this._px + Math.sin(a) * r, this._pz + Math.cos(a) * r, Math.atan2(-Math.sin(a), -Math.cos(a)));
    }
    while (this.cars.length > this.wanted) {
      this._removeCar(this.cars[this.cars.length - 1]);
    }
    if (this.wanted >= 3 && !this.heli) this.spawnHeli();
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli.group);
      this.heli = null;
    }
  }

  addWanted(n, reason) {
    void reason;
    this.setWanted(Math.min(5, this.wanted + (n || 1)));
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n | 0));
    this._syncCarCount();
    this.rebuildDispatch();
  }

  rebuildDispatch() {
    const list = [];
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const role = UNIT_ROLES[i % UNIT_ROLES.length];
      const status = ROLE_STATUS[role] || role;
      list.push({
        code: UNIT_CODES[i % UNIT_CODES.length],
        role,
        status,
        color: ROLE_COLOR[role] || DISPATCH_STATUSES[status] || '#4a8aff',
        dist: Math.hypot(car.x - this._px, car.z - this._pz),
      });
    }
    if (this.heli) {
      list.push({
        code: 'CONDOR-1',
        role: 'AIR UNIT',
        status: 'SPOTLIGHT',
        color: DISPATCH_STATUSES.SPOTLIGHT,
        dist: Math.hypot(this.heli.group.position.x - this._px, this.heli.group.position.z - this._pz),
      });
    }
    this.dispatch = list;
  }

  // Place units around the player at a spread of angles / distances.
  syncUnits(playerX, playerZ, heading) {
    this._px = playerX;
    this._pz = playerZ;
    for (let i = 0; i < this.cars.length; i++) {
      const a = (i / Math.max(1, this.cars.length)) * Math.PI * 2 + 0.7;
      const r = 48 + i * 9;
      const car = this.cars[i];
      car.setPos(playerX + Math.sin(a) * r, playerZ + Math.cos(a) * r, heading);
      car.speed = 6;
    }
    if (this.heli) {
      this.heli.group.position.set(playerX + 12, 18, playerZ - 8);
    }
    this.rebuildDispatch();
  }

  spawnHeli() {
    if (this.heli) return this.heli;
    const THREE = this.THREE;
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    // Dark-navy body.
    const body = box(THREE, 2.0, 1.3, 4.4, 0x1a2a4a, { name: 'heli-body' });
    body.position.y = 0;
    inner.add(body);
    // Pale-cream stripe along the body.
    const stripe = box(THREE, 2.06, 0.34, 4.0, 0xf2e8c8, { name: 'heli-stripe' });
    stripe.position.y = 0.1;
    inner.add(stripe);
    // Nose + cockpit glass.
    const nose = box(THREE, 1.7, 0.9, 0.9, 0x1a2a4a, { name: 'heli-body' });
    nose.position.set(0, -0.1, 2.3);
    inner.add(nose);
    const glass = box(THREE, 1.5, 0.7, 0.5, 0x9fc4d8, {
      name: 'heli-glass', transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.5,
    });
    glass.position.set(0, 0.05, 2.75);
    inner.add(glass);
    // Tail boom + vertical fin.
    const boom = box(THREE, 0.5, 0.5, 3.6, 0x1a2a4a, { name: 'heli-body' });
    boom.position.set(0, 0.25, -3.8);
    inner.add(boom);
    const fin = box(THREE, 0.18, 1.5, 1.1, 0x1a2a4a, { name: 'heli-body' });
    fin.position.set(0, 0.9, -5.2);
    inner.add(fin);
    const tailRotor = box(THREE, 0.1, 1.3, 0.18, 0x222222, { name: 'heli-rotor' });
    tailRotor.position.set(0.35, 0.4, -5.2);
    inner.add(tailRotor);
    // Skids.
    for (const sx of [-0.85, 0.85]) {
      const skid = box(THREE, 0.14, 0.14, 3.4, 0x222222, { name: 'heli-skid' });
      skid.position.set(sx, -0.95, 0.2);
      inner.add(skid);
    }
    // Main rotor: two thick black blades in an X + translucent disc.
    const rotor = new THREE.Group();
    rotor.position.y = 0.95;
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    for (const rot of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.09, 0.55), bladeMat);
      blade.rotation.y = rot;
      blade.name = 'heli-rotor';
      rotor.add(blade);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.name = 'heli-disc';
    rotor.add(disc);
    inner.add(rotor);
    // White lamp sphere below the nose.
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 1.6 })
    );
    lamp.position.set(0, -0.85, 2.2);
    lamp.name = 'heli-lamp';
    inner.add(lamp);
    // WIDE spotlight cone: heli to ground, translucent warm white.
    const coneH = 18;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7.5, coneH, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.30,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    // ConeGeometry already has its apex at the top (+y) and wide base at
    // the bottom: apex sits at the heli, wide end on the ground.
    cone.position.y = -coneH / 2;
    cone.name = 'heli-cone';
    inner.add(cone);
    // Bright pool of light on the road below.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.34, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = -17.4;
    pool.name = 'heli-pool';
    inner.add(pool);
    group.position.set(this._px + 12, 18, this._pz - 8);
    this.scene.add(group);
    this.heli = { group, rotor, cone, lamp, pool };
    return this.heli;
  }

  spawnRoadblock(px, pz, heading) {
    const cars = [];
    for (const off of [-4, 4]) {
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);
      const car = new Car(this.THREE, this.scene, {
        x: px + rx * off, z: pz + rz * off,
        heading: heading + Math.PI / 2,
        color: 0x1a1a2a, name: 'Interceptor',
        topSpeed: this.chaseTopSpeed, accel: 16, isPolice: true,
      });
      this.roadblock.push(car);
      cars.push(car);
    }
    return cars;
  }

  update(dt, playerX, playerZ, playerCar, onRam) {
    this._px = playerX;
    this._pz = playerZ;
    let nearest = 1e9;
    for (const car of this.cars) {
      car.chase(dt, playerX, playerZ, this.chaseTopSpeed);
      const d = Math.hypot(car.x - playerX, car.z - playerZ);
      if (d < nearest) nearest = d;
      if (d < 3.2 && onRam) onRam(car);
    }
    this.playerSpotted = this.wanted > 0 && nearest < 130;
    // Lose the heat: if every unit is far away for a while, drop a star.
    if (this.wanted > 0 && nearest > 120) {
      this._escapeT = (this._escapeT || 0) + dt;
      if (this._escapeT > 8) {
        this._escapeT = 0;
        this.setWanted(this.wanted - 1);
      }
    } else {
      this._escapeT = 0;
    }
    if (this.wanted === 0) {
      this.calmTimer += dt;
      if (this.calmTimer > 6 && this.cars.length) this._syncCarCount();
    } else {
      this.calmTimer = 0;
    }
    if (this.heli) {
      this._heliT += dt;
      const g = this.heli.group;
      const tx = playerX + 12;
      const tz = playerZ - 8;
      g.position.x += (tx - g.position.x) * Math.min(1, dt * 1.5);
      g.position.z += (tz - g.position.z) * Math.min(1, dt * 1.5);
      g.position.y = 18 + Math.sin(this._heliT * 1.4) * 0.8;
      g.rotation.y += dt * 0.1;
      this.heli.rotor.rotation.y += dt * 14;
      // Keep the light pool pinned just above the road as the heli bobs.
      if (this.heli.pool) this.heli.pool.position.y = -g.position.y + 0.06;
    }
    this.rebuildDispatch();
  }

  clearAll() {
    for (const car of this.cars) car.dispose();
    this.cars = [];
    for (const car of this.roadblock) car.dispose();
    this.roadblock = [];
    if (this.heli) {
      this.scene.remove(this.heli.group);
      this.heli = null;
    }
    this.wanted = 0;
    this.dispatch = [];
    this.playerSpotted = false;
  }
}
