// Puerto Alba — traffic.js
// Ambient traffic: cars looping the avenues, slowing for jams.
(function () {
  'use strict';
  var U = PA.utils;

  function TrafficCar(scene, loop, offset, color) {
    this.loop = loop;
    this.wp = offset % loop.length;
    this.car = new PA.vehicle.Car(scene, {
      x: loop[this.wp].x, z: loop[this.wp].z, heading: 0, color: color, sporty: false
    });
    this.speed = U.rand(9, 13);
    this.stuck = 0;
  }

  TrafficCar.prototype.update = function (dt, world, blocker) {
    var target = this.loop[this.wp];
    var p = this.car.mesh.position;
    var d = U.dist2(p.x, p.z, target.x, target.z);
    if (d < 4) {
      this.wp = (this.wp + 1) % this.loop.length;
      target = this.loop[this.wp];
    }
    var want = Math.atan2(target.x - p.x, target.z - p.z);
    this.car.heading = U.turnToward(this.car.heading, want, 1.6 * dt);
    var slow = 1;
    if (blocker) {
      var bd = U.dist2(p.x, p.z, blocker.x, blocker.z);
      if (bd < 10) slow = 0.25;
      if (bd < 5) slow = 0;
    }
    var f = this.car.forward();
    var nx = p.x + f.x * this.speed * slow * dt;
    var nz = p.z + f.z * this.speed * slow * dt;
    if (world) {
      var hit = world.collide(nx, nz, 1.6);
      nx = hit.x; nz = hit.z;
    }
    p.x = nx; p.z = nz;
    this.car.mesh.rotation.y = this.car.heading;
    var wheels = this.car.mesh.userData.wheels;
    for (var i = 0; i < wheels.length; i++) wheels[i].rotation.x += (this.speed * slow * dt) / 0.36;
  };

  function Traffic(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    var palette = PA.vehicle.CAR_COLORS;
    var n = 0;
    world.trafficLoops.forEach(function (loop, li) {
      var count = li === 0 ? 4 : 3;
      for (var i = 0; i < count; i++) {
        var tc = new TrafficCar(scene, loop, i * 1 + li, palette[n % palette.length]);
        n++;
        this.cars.push(tc);
      }
    }, this);
  }

  Traffic.prototype.update = function (dt, playerPos) {
    for (var i = 0; i < this.cars.length; i++) {
      var blocker = null;
      if (playerPos) {
        // Only the nearest traffic car cares about the player as a blocker.
        blocker = playerPos;
      }
      this.cars[i].update(dt, this.world, blocker);
    }
  };

  Traffic.prototype.count = function () { return this.cars.length; };

  window.PA = window.PA || {};
  PA.traffic = { Traffic: Traffic };
})();
