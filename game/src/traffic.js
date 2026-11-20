// traffic.js — AI cars that loop the road grid: pick a route node by node,
// drive with the same arcade physics as the player car, slow for the car ahead,
// and keep a little right of the road centre so two-way streets read as traffic.
import { Car, makeCarMesh, steerToward } from './vehicle.js';
import { pick, range } from './utils.js';

export class Traffic {
  constructor(scene, city, rng) {
    this.city = city;
    this.cars = [];
    this.parked = [];
    const used = new Set();
    for (let i = 0; i < 14; i++) {
      const node = city.nodes[Math.floor(rng() * city.nodes.length)];
      const key = node.x + ',' + node.z;
      if (used.has(key)) continue;
      used.add(key);
      const mesh = makeCarMesh(Math.floor(rng() * 8));
      scene.add(mesh);
      const car = new Car(mesh, node.x + range(rng, -3, 3), node.z + range(rng, -3, 3), rng() * Math.PI * 2);
      car.cruise = range(rng, 7, 12);
      car.target = pick(rng, node.next);
      car.wait = 0;
      this.cars.push(car);
    }
    // parked cars along the roads (stealable)
    const spots = [
      [-60, 4, 0], [60, -4, 1], [120, 4, 0], [-120, -4, 1], [0, 4, 0],
      [180, -4, 1], [-180, 4, 0], [240, -4, 1], [30, -4, 1], [-30, 4, 0],
    ];
    for (const [road, off, dir] of spots) {
      const along = [-150, -90, 30, 90, 150][Math.floor(rng() * 5)];
      const mesh = makeCarMesh(Math.floor(rng() * 8));
      scene.add(mesh);
      const x = dir === 0 ? along : road + off;
      const z = dir === 0 ? road + off : along;
      const car = new Car(mesh, x, z, dir === 0 ? 0 : Math.PI / 2);
      car.parked = true;
      car.speed = 0;
      this.parked.push(car);
    }
  }

  // All drivable cars (moving + parked) for steal / enter checks.
  allCars() { return this.cars.concat(this.parked); }

  update(dt, playerPos, effects) {
    for (const car of this.cars) {
      if (!car.target) { car.target = pick(Math.random, car.target ? car.target.next : this.city.nodes[0].next); continue; }
      const tx = car.target.x, tz = car.target.z;
      const dx = tx - car.pos.x, dz = tz - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        const next = car.target.next;
        car.target = next.length ? pick(Math.random, next) : this.city.nodes[0];
        continue;
      }
      // slow down for a car ahead on the same stretch
      let throttle = 1;
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.pos.x - car.pos.x, oz = other.pos.z - car.pos.z;
        const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 3.2) { throttle = -0.6; break; }
      }
      const steer = steerToward(car, tx, tz, dt);
      car.drive(throttle, steer, false, dt);
      car.speed = Math.min(car.speed, car.cruise);
      car.sync(dt);
    }
    for (const car of this.parked) car.sync(dt);
  }
}
