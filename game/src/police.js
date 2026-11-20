// police.js — the wanted system. Stars rise on crime (steal, hit a pedestrian,
// shoot) and decay when the player stays hidden. Police cars spawn on the road
// grid, chase and ram; on foot they close in and bust; at zero health the player
// is wasted. Either way: a fine, a respawn, wanted cleared.
//
// At wanted 3+ the Puerto Alba Police Dept sends Air One — a helicopter with a
// visible spotlight cone that tracks the player — and throws a roadblock across
// the road ahead. dispatchUnits() feeds the HUD's PAPD RESPONSE panel with
// named units, roles and live distances in metres.
import { Car, makeCarMesh, makeBarrierMesh, steerToward } from './vehicle.js';
import { clamp, dist2 } from './utils.js';

const UNIT_NAMES = ['TIDE-2', 'CORAL-48', 'TIDE-6', 'PIER-5', 'GULL-8', 'HERON-2', 'MAKO-6', 'BASTION-3'];

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.cops = [];
    this.calmTimer = 0;      // seconds since last crime
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.lastCrimePos = null;
    this.roadblock = null;   // { x, z, heading, meshes: [] }
    this.heliOffset = null;  // staged heli hover offset from the player (shots)
    this.heliY = 27;         // staged heli altitude (shots can lower it)
    this.heli = this.buildHeli(scene);
    this.heli.visible = false;
    scene.add(this.heli);
    this.heliLight = new THREE.PointLight(0xfff2c0, 0, 40);
    scene.add(this.heliLight);
  }

  // Low-poly police helicopter: body, glass nose, tail boom, skids, a spinning
  // main rotor + tail rotor, and a translucent spotlight cone under the belly.
  buildHeli(scene) {
    const g = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    const navy = new THREE.MeshLambertMaterial({ color: 0x2040a0 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x182838 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 3.6), white);
    body.castShadow = true; g.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), glass);
    nose.position.set(0, 0.1, 1.9); nose.scale.set(1, 0.8, 1); g.add(nose);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.35, 3.62), navy);
    stripe.position.y = -0.2; g.add(stripe);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 4.4, 6), white);
    boom.rotation.x = Math.PI / 2; boom.position.set(0, 0.25, -3.8); g.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.9), navy);
    fin.position.set(0, 0.7, -5.8); g.add(fin);
    for (const sx of [-0.8, 0.8]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.0),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      skid.position.set(sx, -1.0, 0.2); g.add(skid);
    }
    // main rotor (spins) + tail rotor
    const rotor = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.08, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    rotor.add(blade);
    const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x333333 }));
    mast.position.y = 0.9; g.add(mast);
    rotor.position.y = 1.3; g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    tailRotor.position.set(0.35, 0.5, -5.8); g.add(tailRotor);
    // spotlight cone: apex at the belly, opening toward the ground
    const coneGeo = new THREE.ConeGeometry(7.5, 26, 18, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff6c0, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = -13.8; cone.rotation.x = Math.PI; // apex up at the heli
    g.add(cone);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfffbe0 }));
    bulb.position.y = -0.9; g.add(bulb);
    g.userData = { rotor, tailRotor, cone };
    return g;
  }

  addWanted(n, x, z) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.calmTimer = 0; this.decayTimer = 0;
    if (x !== undefined) this.lastCrimePos = { x, z };
    return this.wanted > before;
  }

  // Spawn / despawn cop cars to match the wanted level (max 4 on screen).
  syncCops(playerPos) {
    const want = Math.min(this.wanted, 4);
    while (this.cops.length < want) {
      const mesh = makeCarMesh(0, true);
      this.scene.add(mesh);
      // spawn on a road 45-75m from the player: take the node nearest 60m out
      // (never the player's own spot — a cop spawning on the player looks broken)
      let best = null, bestScore = Infinity;
      for (const n of this.city.nodes) {
        const d = Math.sqrt(dist2(n.x, n.z, playerPos.x, playerPos.z));
        const score = Math.abs(d - 60) + (d < 30 ? 1000 : 0);
        if (score < bestScore) { bestScore = score; best = n; }
      }
      const x = best.x, z = best.z;
      const car = new Car(mesh, x, z, Math.random() * Math.PI * 2);
      car.maxSpeed = 30 + this.wanted * 1.5;
      car.health = 60;
      this.cops.push(car);
    }
    while (this.cops.length > want) {
      const c = this.cops.pop();
      this.scene.remove(c.mesh);
    }
  }

  // Roadblock: two cop cars parked across the road + a striped barrier.
  placeRoadblock(x, z, heading) {
    this.clearRoadblock();
    const meshes = [];
    const cars = [];
    for (const off of [-2.6, 2.6]) {
      const mesh = makeCarMesh(0, true);
      this.scene.add(mesh);
      const cx = x + Math.cos(heading) * off, cz = z - Math.sin(heading) * off;
      const car = new Car(mesh, cx, cz, heading + Math.PI / 2);
      car.maxSpeed = 0; car.speed = 0; car.health = 60;
      car.sync(0.016);
      cars.push(car); meshes.push(mesh);
    }
    const barrier = makeBarrierMesh();
    barrier.position.set(x, 0, z);
    barrier.rotation.y = heading;
    this.scene.add(barrier);
    meshes.push(barrier);
    this.roadblock = { x, z, heading, cars, meshes };
    return this.roadblock;
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    for (const m of this.roadblock.meshes) this.scene.remove(m);
    this.roadblock = null;
  }

  // Named dispatch units for the HUD: each cop gets a callsign + role, then
  // Air One (spotlight) and the roadblock. Distances are live, in metres.
  dispatchUnits(playerPos) {
    const units = [];
    const sorted = this.cops
      .map((c, i) => ({ c, d: Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z), i }))
      .sort((a, b) => a.d - b.d);
    sorted.forEach((entry, rank) => {
      const role = rank === 0 ? 'RAMMING' : rank === 1 ? 'FLANKING' : rank === 2 ? 'PURSUIT' : 'CLOSING IN';
      units.push({ name: UNIT_NAMES[entry.i % UNIT_NAMES.length], role, dist: Math.round(entry.d) });
    });
    if (this.heli.visible) {
      units.push({
        name: 'AIR ONE', role: 'SPOTLIGHT',
        dist: Math.round(Math.hypot(this.heli.position.x - playerPos.x, this.heli.position.z - playerPos.z)),
      });
    }
    if (this.roadblock) {
      units.push({
        name: 'BULWARK-2', role: 'ROADBLOCK',
        dist: Math.round(Math.hypot(this.roadblock.x - playerPos.x, this.roadblock.z - playerPos.z)),
      });
    }
    const total = Math.max(units.length, this.wanted > 0 ? this.wanted + 2 : 0);
    return { units: units.slice(0, 6), total, extra: Math.max(0, total - units.length) };
  }

  update(dt, player, effects, onBusted, onRam) {
    this.calmTimer += dt;
    if (this.wanted > 0 && this.calmTimer > 18) {
      this.decayTimer += dt;
      if (this.decayTimer > 8) { this.wanted--; this.decayTimer = 0; this.calmTimer = 10; }
    }
    if (!window.__PUERTO_ALBA_SHOT__) this.syncCops(player.inCar ? player.inCar.pos : player.pos);
    const target = player.inCar ? player.inCar.pos : player.pos;
    const targetSpeed = player.inCar ? Math.abs(player.inCar.speed) : Math.abs(player.speed);
    // --- helicopter: appears at 3+ stars, hovers above the player, spotlight on them
    const heliOn = this.wanted >= 3;
    this.heli.visible = heliOn;
    if (heliOn) {
      const t = performance.now() / 1000;
      const off = this.heliOffset || { x: 14, z: 18 };
      const hx = target.x + off.x, hz = target.z + off.z;
      this.heli.position.x += (hx - this.heli.position.x) * Math.min(1, 1.2 * dt);
      this.heli.position.z += (hz - this.heli.position.z) * Math.min(1, 1.2 * dt);
      this.heli.position.y = this.heliY + Math.sin(t * 0.9) * 1.2;
      this.heli.rotation.y = Math.atan2(target.x - this.heli.position.x, target.z - this.heli.position.z);
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.userData.tailRotor.rotation.z += dt * 30;
      this.heliLight.position.set(target.x, 3, target.z);
      this.heliLight.intensity = 0.9 + Math.sin(t * 7) * 0.15;
    } else {
      this.heliLight.intensity = 0;
    }
    // --- roadblock: thrown across the road ahead once the heat hits 3 stars
    if (this.wanted >= 3 && !this.roadblock && !window.__PUERTO_ALBA_SHOT__) {
      const heading = player.inCar ? player.inCar.heading : player.heading;
      const ax = target.x + Math.sin(heading) * 70;
      const az = target.z + Math.cos(heading) * 70;
      // snap onto the nearest road line so it sits on asphalt, not a building
      let bx = ax, bz = az;
      const lines = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
      let best = Infinity;
      for (const v of lines) {
        const d = Math.abs(v - ax);
        if (d < best) { best = d; bx = v; }
      }
      best = Infinity;
      for (const v of lines) {
        const d = Math.abs(v - az);
        if (d < best) { best = d; bz = v; }
      }
      this.placeRoadblock(bx, bz, heading);
    }
    if (this.wanted < 3 && this.roadblock && !window.__PUERTO_ALBA_SHOT__) this.clearRoadblock();
    let busting = false;
    for (const cop of this.cops) {
      if (cop.staged) { cop.sync(dt); continue; } // staged shot framing: hold position
      const steer = steerToward(cop, target.x, target.z, dt);
      const d = Math.hypot(target.x - cop.pos.x, target.z - cop.pos.z);
      // ram speed: full tilt when far, ease off when close, stop on the bumper
      const throttle = d > 8 ? 1 : d > 4 ? 0.3 : 0;
      cop.drive(throttle, steer, false, dt);
      cop.sync(dt);
      if (d < 3.4) {
        if (player.inCar) {
          if (onRam) onRam(cop);
          // gentle nudge only — never shove the player off the road; in shot
          // mode the cops just ride the bumper for the camera
          if (!window.__PUERTO_ALBA_SHOT__) {
            const push = 2.5;
            player.inCar.pos.x += (player.inCar.pos.x - cop.pos.x) / d * push * dt * 1.2;
            player.inCar.pos.z += (player.inCar.pos.z - cop.pos.z) / d * push * dt * 1.2;
          }
          if (effects) effects.sparks(cop.pos.x, 1, cop.pos.z);
        } else {
          busting = true;
        }
      }
    }
    if (busting && targetSpeed < 1.5) {
      this.bustTimer += dt;
      if (this.bustTimer > 1.6) { this.bustTimer = 0; onBusted(); }
    } else this.bustTimer = 0;
  }

  clear() {
    this.wanted = 0; this.calmTimer = 0; this.decayTimer = 0; this.bustTimer = 0;
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.cops = [];
    this.clearRoadblock();
    this.heli.visible = false;
    this.heliLight.intensity = 0;
  }

  damageCop(cop, amount) {
    cop.health -= amount;
    if (cop.health <= 0) {
      this.scene.remove(cop.mesh);
      this.cops.splice(this.cops.indexOf(cop), 1);
      return true;
    }
    return false;
  }
}
