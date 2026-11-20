// Puerto Alba — player.js
// Ria Solano on foot: run, sprint, enter and exit cars, health.
(function () {
  'use strict';
  var U = PA.utils;

  function buildMesh() {
    var g = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xc22a2a });
    var skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    var pants = new THREE.MeshLambertMaterial({ color: 0x1e2a3a });
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.85, 0.28), pants);
    legs.position.y = 0.43;
    g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.65, 0.32), jacket);
    torso.position.y = 1.18;
    g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
    head.position.y = 1.72;
    g.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
    hair.position.y = 1.76;
    g.add(hair);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.58, 0.13), jacket);
    armL.position.set(-0.35, 1.18, 0);
    g.add(armL);
    var armR = armL.clone();
    armR.position.x = 0.35;
    g.add(armR);
    g.userData.armL = armL;
    g.userData.armR = armR;
    g.userData.legs = legs;
    return g;
  }

  function Player(scene, spawn) {
    this.mesh = buildMesh();
    this.mesh.position.set(spawn.x, 0, spawn.z);
    this.heading = spawn.heading || 0;
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
    this.health = 100;
    this.armor = 50;
    this.car = null;
    this.onFoot = true;
    this.speed = 0;
    this.walkPhase = 0;
    this.sprinting = false;
    this.dead = false;
  }

  Player.prototype.position = function () {
    if (this.car) return this.car.mesh.position;
    return this.mesh.position;
  };

  Player.prototype.footPos = function () {
    return { x: this.mesh.position.x, z: this.mesh.position.z };
  };

  Player.prototype.enterCar = function (car) {
    if (!car || !car.alive) return false;
    this.car = car;
    this.onFoot = false;
    this.mesh.visible = false;
    if (PA.audio) PA.audio.steal();
    return true;
  };

  Player.prototype.exitCar = function (world) {
    if (!this.car) return false;
    var c = this.car;
    var f = c.forward();
    var side = { x: c.mesh.position.x - f.z * 2.4, z: c.mesh.position.z + f.x * 2.4 };
    if (world) {
      var hit = world.collide(side.x, side.z, 0.6);
      side.x = hit.x; side.z = hit.z;
    }
    this.mesh.position.set(side.x, 0, side.z);
    this.heading = c.heading;
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = true;
    this.car = null;
    this.onFoot = true;
    this.speed = 0;
    return true;
  };

  Player.prototype.hurt = function (amount) {
    if (this.dead) return;
    var left = amount;
    if (this.armor > 0) {
      var absorbed = Math.min(this.armor, left);
      this.armor -= absorbed;
      left -= absorbed;
    }
    this.health -= left;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  };

  Player.prototype.heal = function (amount) {
    this.health = U.clamp(this.health + amount, 0, 100);
    if (this.health > 0) this.dead = false;
  };

  Player.prototype.update = function (dt, input, world, cameraYaw) {
    if (this.dead) return;
    if (!this.onFoot) return; // driving is handled by the car
    var ax = input.axes();
    var sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    this.sprinting = sprint && ax.y > 0;
    var speed = this.sprinting ? 8.5 : 4.6;
    var mx = 0, mz = 0;
    if (ax.x !== 0 || ax.y !== 0) {
      // Move relative to the camera yaw so WASD feels right.
      var cy = cameraYaw || 0;
      var fx = Math.sin(cy), fz = Math.cos(cy);
      var rx = Math.cos(cy), rz = -Math.sin(cy);
      mx = fx * ax.y + rx * ax.x;
      mz = fz * ax.y + rz * ax.x;
      var len = Math.sqrt(mx * mx + mz * mz);
      mx /= len; mz /= len;
      this.heading = U.turnToward(this.heading, Math.atan2(mx, mz), 10 * dt);
      this.speed = speed;
    } else {
      this.speed = 0;
    }
    var nx = this.mesh.position.x + mx * this.speed * dt;
    var nz = this.mesh.position.z + mz * this.speed * dt;
    if (world) {
      var hit = world.collide(nx, nz, 0.6);
      nx = hit.x; nz = hit.z;
    }
    this.mesh.position.x = nx;
    this.mesh.position.z = nz;
    this.mesh.rotation.y = this.heading;
    if (this.speed > 0) {
      this.walkPhase += dt * (this.sprinting ? 13 : 9);
      var swing = Math.sin(this.walkPhase) * 0.6;
      this.mesh.userData.armL.rotation.x = swing;
      this.mesh.userData.armR.rotation.x = -swing;
      this.mesh.userData.legs.rotation.x = Math.sin(this.walkPhase) * 0.2;
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
    } else {
      this.mesh.userData.armL.rotation.x = 0;
      this.mesh.userData.armR.rotation.x = 0;
      this.mesh.position.y = 0;
    }
  };

  window.PA = window.PA || {};
  PA.player = { Player: Player };
})();
