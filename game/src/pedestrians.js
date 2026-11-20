// Puerto Alba — pedestrians.js
// Sidewalk crowds: walkers, strollers, and people who run when trouble starts.
(function () {
  'use strict';
  var U = PA.utils;

  var SHIRTS = [0xe86a5a, 0x4a90c8, 0xf5c542, 0x3f8f4f, 0xe8e8e8, 0x8a5a8a, 0x2a8a8a, 0xc22a2a];
  var NAMES = ['Ana', 'Luis', 'Marta', 'Diego', 'Carmen', 'Pablo', 'Lucia', 'Jorge', 'Nina', 'Rafa', 'Elena', 'Oscar'];

  function Ped(scene, path) {
    this.path = path;
    this.seg = 0;
    this.dir = 1;
    this.name = U.pick(NAMES);
    this.speed = U.rand(1.2, 2.2);
    this.fleeing = false;
    this.fleeT = 0;
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: U.pick(SHIRTS) });
    var skin = new THREE.MeshLambertMaterial({ color: U.pick([0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]) });
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
    legs.position.y = 0.4;
    g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), shirt);
    torso.position.y = 1.1;
    g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
    head.position.y = 1.62;
    g.add(head);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), shirt);
    armL.position.set(-0.32, 1.1, 0);
    g.add(armL);
    var armR = armL.clone();
    armR.position.x = 0.32;
    g.add(armR);
    this.mesh = g;
    this.armL = armL;
    this.armR = armR;
    this.legs = legs;
    var start = path[0];
    g.position.set(start.x + U.rand(-1, 1), 0, start.z + U.rand(-1, 1));
    scene.add(g);
    this.walkPhase = U.rand(0, 6);
    this.alive = true;
  }

  Ped.prototype.update = function (dt, danger, dangerPos) {
    if (!this.alive) return;
    var p = this.mesh.position;
    var speed = this.speed;
    if (danger && dangerPos) {
      var d = U.dist2(p.x, p.z, dangerPos.x, dangerPos.z);
      if (d < 26) {
        this.fleeing = true;
        this.fleeT = 2.5;
      }
    }
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      if (this.fleeT <= 0) this.fleeing = false;
    }
    if (this.fleeing && dangerPos) {
      speed = 5.2;
      var away = Math.atan2(p.x - dangerPos.x, p.z - dangerPos.z);
      p.x += Math.sin(away) * speed * dt;
      p.z += Math.cos(away) * speed * dt;
      this.mesh.rotation.y = away;
    } else {
      var target = this.path[this.seg];
      var d2 = U.dist2(p.x, p.z, target.x, target.z);
      if (d2 < 2) {
        this.seg += this.dir;
        if (this.seg >= this.path.length || this.seg < 0) {
          this.dir = -this.dir;
          this.seg = U.clamp(this.seg, 0, this.path.length - 1);
        }
        target = this.path[this.seg];
      }
      var want = Math.atan2(target.x - p.x, target.z - p.z);
      this.mesh.rotation.y = U.turnToward(this.mesh.rotation.y, want, 3 * dt);
      p.x += Math.sin(this.mesh.rotation.y) * speed * dt;
      p.z += Math.cos(this.mesh.rotation.y) * speed * dt;
    }
    this.walkPhase += dt * (this.fleeing ? 14 : 7);
    var swing = Math.sin(this.walkPhase) * 0.5;
    this.armL.rotation.x = swing;
    this.armR.rotation.x = -swing;
    this.legs.rotation.x = Math.sin(this.walkPhase) * 0.15;
  };

  function Crowd(scene, world) {
    this.peds = [];
    var paths = world.pedPaths;
    for (var i = 0; i < 26; i++) {
      var path = paths[i % paths.length];
      this.peds.push(new Ped(scene, path));
    }
    // Beach strollers.
    for (var j = 0; j < 6; j++) {
      var bp = new Ped(scene, [{ x: -160, z: 168 }, { x: 160, z: 168 }]);
      bp.speed = U.rand(0.8, 1.4);
      this.peds.push(bp);
    }
  }

  Crowd.prototype.update = function (dt, danger, dangerPos) {
    for (var i = 0; i < this.peds.length; i++) this.peds[i].update(dt, danger, dangerPos);
  };

  Crowd.prototype.nearest = function (x, z, maxDist) {
    var best = null, bd = maxDist || 3;
    for (var i = 0; i < this.peds.length; i++) {
      var p = this.peds[i];
      if (!p.alive) continue;
      var d = U.dist2(x, z, p.mesh.position.x, p.mesh.position.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  window.PA = window.PA || {};
  PA.pedestrians = { Crowd: Crowd, Ped: Ped };
})();
