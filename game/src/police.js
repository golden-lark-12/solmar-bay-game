// Puerto Alba — police.js
// Wanted level 0-5, Alba PD pursuit cars, roadblocks, and Air One,
// the police helicopter with its searchlight.
(function () {
  'use strict';
  var U = PA.utils;

  var UNIT_NAMES = [
    { name: 'Unit 7 — Vega', role: 'Interceptor' },
    { name: 'Unit 12 — Ramos', role: 'Pursuit' },
    { name: 'Unit 4 — Cole', role: 'Roadblock' },
    { name: 'Unit 21 — Okafor', role: 'Pursuit' },
    { name: 'Unit 9 — Silva', role: 'Interceptor' },
    { name: 'Unit 16 — Marsh', role: 'K-9 Backup' }
  ];

  function buildCopCar(scene, x, z) {
    var car = new PA.vehicle.Car(scene, { x: x, z: z, heading: 0, color: 0x1a1a22, sporty: true });
    // PD livery: white doors + light bar.
    var door = new THREE.Mesh(
      new THREE.BoxGeometry(2.06, 0.3, 2.4),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })
    );
    door.position.y = 0.62;
    car.mesh.add(door);
    var bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2266ff })
    );
    bar.position.set(0, 1.45, 0.2);
    car.mesh.add(bar);
    car.lightBar = bar;
    car.lightPhase = U.rand(0, 1);
    return car;
  }

  function buildHeli(scene) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0x223344 })
    );
    body.scale.set(1, 0.8, 1.9);
    g.add(body);
    var tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.5, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x223344 })
    );
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -3.4;
    g.add(tail);
    var rotor = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    rotor.position.y = 1.5;
    g.add(rotor);
    var rotor2 = rotor.clone();
    rotor2.rotation.y = Math.PI / 2;
    g.add(rotor2);
    var glass = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x9ad8e8 })
    );
    glass.scale.set(1, 0.7, 0.9);
    glass.position.set(0, 0.2, 1.1);
    g.add(glass);
    // Searchlight cone + ground spot.
    var spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.32, 0.5, 1.2);
    spot.position.set(0, -1, 0.5);
    var spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -40, 0);
    g.add(spotTarget);
    spot.target = spotTarget;
    g.add(spot);
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
    );
    cone.rotation.x = Math.PI;
    cone.position.y = -17;
    g.add(cone);
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -33;
    g.add(disc);
    g.userData.rotor = rotor;
    g.userData.rotor2 = rotor2;
    g.userData.spot = spot;
    g.userData.spotTarget = spotTarget;
    g.userData.cone = cone;
    g.userData.disc = disc;
    g.visible = false;
    scene.add(g);
    return g;
  }

  function Police(scene, world) {
    this.scene = scene;
    this.world = world;
    this.wanted = 0;
    this.heat = 0;
    this.cops = [];
    this.heli = buildHeli(scene);
    this.heliActive = false;
    this.roadblock = null;
    this.roadblockCars = [];
    this.decayT = 0;
    this.spawnT = 0;
    this.bustedT = 0;
    this.units = [];
    this.maxCops = 0;
    this.heliHold = null;
  }

  Police.prototype.setWanted = function (n, silent) {
    var before = this.wanted;
    this.wanted = U.clamp(n | 0, 0, 5);
    if (this.wanted > before && !silent) {
      if (PA.audio) PA.audio.bad();
    }
    this.maxCops = this.wanted >= 5 ? 5 : this.wanted >= 3 ? 3 : this.wanted >= 1 ? 2 : 0;
    if (this.wanted >= 3) this.activateHeli();
    else this.deactivateHeli();
    if (this.wanted >= 4) this.placeRoadblock();
    else this.clearRoadblock();
    this.refreshUnits();
  };

  Police.prototype.addHeat = function (n) {
    this.heat += n;
    if (this.heat >= 3 && this.wanted < 5) this.setWanted(this.wanted + 1);
    if (this.heat >= 3) this.heat = 0;
  };

  Police.prototype.activateHeli = function () {
    if (!this.heliActive) {
      this.heliActive = true;
      this.heli.visible = true;
      if (PA.audio) PA.audio.setSiren(true);
    }
  };

  Police.prototype.deactivateHeli = function () {
    this.heliActive = false;
    this.heli.visible = false;
    if (PA.audio && this.wanted < 3) PA.audio.setSiren(this.wanted > 0);
  };

  Police.prototype.placeRoadblock = function () {
    if (this.roadblock) return;
    var p = this.playerPos || { x: 0, z: 0 };
    var ahead = { x: p.x, z: p.z - 46 };
    this.roadblock = ahead;
    for (var i = 0; i < 2; i++) {
      var c = buildCopCar(this.scene, ahead.x - 4 + i * 8, ahead.z);
      c.heading = Math.PI / 2;
      c.mesh.rotation.y = c.heading;
      this.roadblockCars.push(c);
    }
  };

  Police.prototype.clearRoadblock = function () {
    if (!this.roadblock) return;
    for (var i = 0; i < this.roadblockCars.length; i++) this.roadblockCars[i].remove(this.scene);
    this.roadblockCars = [];
    this.roadblock = null;
  };

  Police.prototype.refreshUnits = function () {
    this.units = [];
    var pp = this.playerPos || { x: 0, z: 0 };
    for (var i = 0; i < Math.min(this.cops.length, UNIT_NAMES.length); i++) {
      var u = UNIT_NAMES[i];
      var c = this.cops[i];
      var d = c ? U.dist2(c.mesh.position.x, c.mesh.position.z, pp.x, pp.z) : 999;
      this.units.push({ name: u.name, role: u.role, dist: d });
    }
    if (this.heliActive) {
      var hd = U.dist2(this.heli.position.x, this.heli.position.z, pp.x, pp.z);
      this.units.push({ name: 'Air One — Reyes', role: 'Helicopter', dist: hd });
    }
  };

  Police.prototype.spawnCop = function (playerPos) {
    var a = U.rand(0, Math.PI * 2);
    var x = playerPos.x + Math.sin(a) * U.rand(38, 55);
    var z = playerPos.z + Math.cos(a) * U.rand(38, 55);
    x = U.clamp(x, -170, 170);
    z = U.clamp(z, -170, 165);
    var c = buildCopCar(this.scene, x, z);
    this.cops.push(c);
    this.refreshUnits();
  };

  Police.prototype.update = function (dt, player, playerPos) {
    this.playerPos = playerPos;
    var t = performance.now() / 1000;
    // Wanted decay when the player stays out of sight and slow.
    this.decayT += dt;
    if (this.decayT > 6 && this.wanted > 0) {
      this.decayT = 0;
      var speed = player.car ? Math.abs(player.car.speed) : 0;
      if (speed < 3 && this.cops.length === 0) {
        this.setWanted(this.wanted - 1);
      }
    }
    // Spawn / remove pursuit cars.
    this.spawnT += dt;
    if (this.spawnT > 1.2) {
      this.spawnT = 0;
      while (this.cops.length < this.maxCops) this.spawnCop(playerPos);
      while (this.cops.length > this.maxCops) {
        var dead = this.cops.pop();
        dead.remove(this.scene);
      }
    }
    // Chase: steer toward the player, ram speed scales with wanted level.
    for (var i = 0; i < this.cops.length; i++) {
      var c = this.cops[i];
      var p = c.mesh.position;
      var want = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
      c.heading = U.turnToward(c.heading, want, 2.4 * dt);
      var chaseSpeed = 16 + this.wanted * 3.5;
      var f = c.forward();
      var nx = p.x + f.x * chaseSpeed * dt;
      var nz = p.z + f.z * chaseSpeed * dt;
      var hit = this.world.collide(nx, nz, 1.6);
      p.x = hit.x; p.z = hit.z;
      c.mesh.rotation.y = c.heading;
      c.lightPhase += dt * 6;
      c.lightBar.material.color.setHex(Math.sin(c.lightPhase) > 0 ? 0x2266ff : 0xff2222);
      var wheels = c.mesh.userData.wheels;
      for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += (chaseSpeed * dt) / 0.36;
      // Ram the player.
      var d = U.dist2(p.x, p.z, playerPos.x, playerPos.z);
      if (d < 3.2) {
        if (player.car) {
          player.car.damage(6 * dt * 10);
          player.car.speed *= 0.94;
        } else {
          player.hurt(14 * dt);
        }
        if (PA.effects) PA.effects.spawnSparks(p.x, 1, p.z);
      }
    }
    // Helicopter: hover ahead and to the side of the player, spotlight on them.
    if (this.heliActive) {
      var h = this.heli;
      var heading = player.car ? player.car.heading : player.heading;
      var fx = Math.sin(heading), fz = Math.cos(heading);
      var hover = this.heliHold || {
        x: playerPos.x + fx * 22 - fz * 12,
        y: 34,
        z: playerPos.z + fz * 22 + fx * 12
      };
      var tx = hover.x, tz = hover.z;
      h.position.x = U.lerp(h.position.x, tx, 1.2 * dt);
      h.position.z = U.lerp(h.position.z, tz, 1.2 * dt);
      h.position.y = U.lerp(h.position.y, hover.y, 1.2 * dt);
      h.rotation.y = Math.atan2(playerPos.x - h.position.x, playerPos.z - h.position.z);
      h.userData.rotor.rotation.y += dt * 22;
      h.userData.rotor2.rotation.y += dt * 22;
      h.userData.spotTarget.position.set(playerPos.x - h.position.x, -h.position.y, playerPos.z - h.position.z);
      h.userData.disc.position.set(playerPos.x - h.position.x, -h.position.y + 0.4, playerPos.z - h.position.z);
      // Scale the beam so it runs exactly from the helicopter to the street.
      var hy = Math.max(6, h.position.y);
      h.userData.cone.scale.y = hy / 34;
      h.userData.cone.position.y = -hy / 2;
      // The beam cone stays vertical under the helicopter, aimed at the street below.
    }
    if (this.cops.length > 0 || this.heliActive) this.refreshUnits();
  };

  Police.prototype.clearAll = function () {
    for (var i = 0; i < this.cops.length; i++) this.cops[i].remove(this.scene);
    this.cops = [];
    this.clearRoadblock();
    this.deactivateHeli();
    this.wanted = 0;
    this.heat = 0;
    this.units = [];
  };

  window.PA = window.PA || {};
  PA.police = { Police: Police, UNIT_NAMES: UNIT_NAMES };
})();
