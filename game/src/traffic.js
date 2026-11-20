// traffic.js — ambient traffic: cars looping the road grid, plus parked cars.
// Counts can be raised for staged shots. Puerto Alba.

import { rand, randi, pick } from './utils.js';
import { Car, randomCarColor, CAR_NAMES } from './vehicle.js';
import { WORLD } from './city.js';

// A few rectangular loops around city blocks, on the road grid.
function buildLoops() {
  const loops = [];
  const xs = [-240, -160, -80, 0, 80, 160, 240];
  const zs = [-240, -160, -80, 0, 80, 160, 200];
  for (let i = 0; i < 6; i++) {
    const x0 = pick(xs), x1 = pick(xs), z0 = pick(zs), z1 = pick(zs);
    if (x0 === x1 || z0 === z1) continue;
    loops.push([
      [Math.min(x0, x1), Math.min(z0, z1)],
      [Math.max(x0, x1), Math.min(z0, z1)],
      [Math.max(x0, x1), Math.max(z0, z1)],
      [Math.min(x0, x1), Math.max(z0, z1)]
    ]);
  }
  // Causeway loop: mainland to the island and back.
  loops.push([[0, 160], [0, 300], [0, 520], [0, 300]]);
  // Strand cruise along the beachfront.
  loops.push([[-240, 200], [240, 200], [240, 220], [-240, 220]]);
  return loops;
}

export class Traffic {
  constructor(THREE, scene, colliders) {
    this.THREE = THREE;
    this.scene = scene;
    this.colliders = colliders;
    this.loops = buildLoops();
    this.cars = []; // {car, loop, wp, speed}
    this.parked = [];
  }

  spawn(count) {
    this.clear();
    for (let i = 0; i < count; i++) {
      const loop = pick(this.loops);
      const wp = randi(0, loop.length - 1);
      const [x, z] = loop[wp];
      const car = new Car(this.THREE, this.scene, {
        x: x + rand(-4, 4), z: z + rand(-4, 4),
        color: randomCarColor(),
        name: pick(CAR_NAMES),
        topSpeed: rand(14, 22)
      });
      this.cars.push({ car, loop, wp, speed: rand(10, 16) });
    }
    // Parked cars along the beachfront and Marina Row.
    const parkedSpots = [[-120, 212], [-60, 212], [120, 212], [200, 212], [-200, 120], [-200, 160], [80, 160], [160, 80]];
    for (const [x, z] of parkedSpots) {
      const car = new Car(this.THREE, this.scene, {
        x, z, color: randomCarColor(), name: pick(CAR_NAMES), topSpeed: 20
      });
      car.heading = Math.PI / 2;
      car.mesh.rotation.y = car.heading;
      this.parked.push(car);
    }
  }

  clear() {
    for (const t of this.cars) t.car.dispose();
    for (const c of this.parked) c.dispose();
    this.cars = []; this.parked = [];
  }

  // Take a car out of traffic (player stole it). It stays in the scene.
  removeCar(car) {
    this.cars = this.cars.filter(t => t.car !== car);
    this.parked = this.parked.filter(c => c !== car);
  }

  update(dt) {
    for (const t of this.cars) {
      const target = t.loop[(t.wp + 1) % t.loop.length];
      const dx = target[0] - t.car.x, dz = target[1] - t.car.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) { t.wp = (t.wp + 1) % t.loop.length; continue; }
      t.car.chase(dt, target[0], target[1], t.speed);
    }
  }

  // Nearest drivable car to a point (traffic or parked), within radius.
  nearestCar(x, z, radius) {
    let best = null, bestD = radius;
    const all = this.cars.map(t => t.car).concat(this.parked);
    for (const c of all) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  count() { return this.cars.length + this.parked.length; }
}
