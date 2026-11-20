// police.js — the wanted system. Stars rise on crime (steal, hit a pedestrian,
// shoot) and decay when the player stays hidden. Police cars spawn on the road
// grid, chase and ram; on foot they close in and bust; at zero health the player
// is wasted. Either way: a fine, a respawn, wanted cleared.
import { Car, makeCarMesh, steerToward } from './vehicle.js';
import { clamp, dist2 } from './utils.js';

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

  update(dt, player, effects, onBusted, onRam) {
    this.calmTimer += dt;
    if (this.wanted > 0 && this.calmTimer > 18) {
      this.decayTimer += dt;
      if (this.decayTimer > 8) { this.wanted--; this.decayTimer = 0; this.calmTimer = 10; }
    }
    this.syncCops(player.inCar ? player.inCar.pos : player.pos);
    const target = player.inCar ? player.inCar.pos : player.pos;
    const targetSpeed = player.inCar ? Math.abs(player.inCar.speed) : Math.abs(player.speed);
    let busting = false;
    for (const cop of this.cops) {
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
          if (!window.__SOLMAR_SHOT__) {
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
