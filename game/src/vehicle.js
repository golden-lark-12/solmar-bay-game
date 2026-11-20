// Puerto Alba — vehicle.js
// Arcade cars: mesh, driving physics, damage/condition, lights.
(function () {
  'use strict';
  var U = PA.utils;

  var CAR_COLORS = [0xc22a2a, 0x2a6ac2, 0xf5c542, 0x3f8f4f, 0xe8e8e8, 0x222222, 0xc22a8a, 0x8a5a2a, 0x4a90c8, 0xe86a5a];
  var CAR_NAMES = ['Vulture GT', 'Alba Cruiser', 'Marina Taxi', 'Night Runner', 'Palm Van', 'Bay Sedan', 'Sunset Coupe', 'Dock Pickup', 'Harbor Hatch', 'Coral Roadster'];

  function buildCarMesh(color, sporty) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var len = sporty ? 4.6 : 4.2;
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, len), bodyMat);
    body.position.y = 0.55;
    g.add(body);
    var cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.55, sporty ? 1.9 : 2.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 })
    );
    cabin.position.set(0, 1.1, sporty ? 0.25 : -0.1);
    g.add(cabin);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wheels = [];
    var wz = sporty ? 1.55 : 1.4;
    var wx = 0.95;
    [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.36, p[1]);
      g.add(w);
      wheels.push(w);
    });
    var headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    [-0.6, 0.6].forEach(function (x) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
      h.position.set(x, 0.62, len / 2 + 0.02);
      g.add(h);
    });
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    [-0.6, 0.6].forEach(function (x) {
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.1), tailMat);
      t.position.set(x, 0.62, -len / 2 - 0.02);
      g.add(t);
    });
    g.userData.wheels = wheels;
    g.userData.tailMat = tailMat;
    g.userData.headMat = headMat;
    return g;
  }

  function Car(scene, opts) {
    opts = opts || {};
    this.name = opts.model || U.pick(CAR_NAMES);
    this.color = opts.color !== undefined ? opts.color : U.pick(CAR_COLORS);
    this.sporty = !!opts.sporty;
    this.mesh = buildCarMesh(this.color, this.sporty);
    this.mesh.position.set(opts.x || 0, 0, opts.z || 0);
    this.heading = opts.heading || 0;
    this.mesh.rotation.y = this.heading;
    this.speed = 0;
    this.maxSpeed = this.sporty ? 42 : 30;
    this.accel = this.sporty ? 22 : 15;
    this.condition = opts.condition !== undefined ? opts.condition : 100;
    this.isPlayer = !!opts.isPlayer;
    this.isPolice = !!opts.isPolice;
    this.stolen = false;
    this.braking = false;
    this.horn = 0;
    this.alive = true;
    scene.add(this.mesh);
  }

  Car.prototype.forward = function () {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  };

  Car.prototype.drive = function (dt, throttle, steer, world) {
    // throttle: -1..1, steer: -1..1
    var accel = throttle * this.accel;
    if (throttle < 0) accel = throttle * this.accel * 0.8;
    this.speed += accel * dt;
    // Drag + rolling resistance.
    this.speed -= this.speed * 0.55 * dt;
    if (throttle === 0) this.speed -= this.speed * 0.9 * dt;
    this.speed = U.clamp(this.speed, -12, this.maxSpeed);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    var steerAmt = steer * 1.9 * dt * U.clamp(Math.abs(this.speed) / 8, 0, 1);
    if (this.speed < 0) steerAmt = -steerAmt;
    this.heading += steerAmt;
    var f = this.forward();
    var nx = this.mesh.position.x + f.x * this.speed * dt;
    var nz = this.mesh.position.z + f.z * this.speed * dt;
    if (world) {
      var hit = world.collide(nx, nz, 1.6);
      if (Math.abs(hit.x - nx) > 0.01 || Math.abs(hit.z - nz) > 0.01) {
        this.speed *= 0.45;
        this.damage(2 * dt * 60 * 0.1);
      }
      nx = hit.x;
      nz = hit.z;
    }
    this.mesh.position.x = nx;
    this.mesh.position.z = nz;
    this.mesh.rotation.y = this.heading;
    var spin = (this.speed * dt) / 0.36;
    var wheels = this.mesh.userData.wheels;
    for (var i = 0; i < wheels.length; i++) wheels[i].rotation.x += spin;
    this.mesh.rotation.z = -steer * U.clamp(Math.abs(this.speed) / 30, 0, 1) * 0.04;
    this.braking = throttle < 0 && this.speed > 1;
    return this.speed;
  };

  Car.prototype.damage = function (amount) {
    this.condition = U.clamp(this.condition - amount, 0, 100);
    if (this.condition <= 0 && this.alive) {
      this.alive = false;
      if (PA.effects) PA.effects.spawnExplosion(this.mesh.position.x, 1, this.mesh.position.z, 1.2);
      if (PA.audio) PA.audio.boom();
    }
  };

  Car.prototype.repair = function (amount) {
    this.condition = U.clamp(this.condition + amount, 0, 100);
    if (this.condition > 0) this.alive = true;
  };

  Car.prototype.remove = function (scene) {
    scene.remove(this.mesh);
  };

  function makeParkedCars(scene, spots) {
    var cars = [];
    spots.forEach(function (s) {
      var c = new Car(scene, { x: s.x, z: s.z, heading: s.heading, color: s.color, model: s.model, sporty: s.sporty });
      cars.push(c);
    });
    return cars;
  }

  function nearestCar(cars, x, z, maxDist) {
    var best = null, bestD = maxDist || 6;
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (!c.alive) continue;
      var d = U.dist2(x, z, c.mesh.position.x, c.mesh.position.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  window.PA = window.PA || {};
  PA.vehicle = { Car: Car, makeParkedCars: makeParkedCars, nearestCar: nearestCar, CAR_COLORS: CAR_COLORS, CAR_NAMES: CAR_NAMES };
})();
