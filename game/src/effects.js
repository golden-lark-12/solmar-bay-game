// Puerto Alba — effects.js
// Particles: explosions, smoke, sparks, muzzle flashes, skid puffs.
// Plus camera shake.
(function () {
  'use strict';
  var U = PA.utils;

  function Effects(scene) {
    this.scene = scene;
    this.parts = [];
    this.shakeAmt = 0;
    this.pool = [];
  }

  Effects.prototype._spawn = function (x, y, z, opts) {
    var mat = new THREE.MeshBasicMaterial({ color: opts.color, transparent: true, opacity: 1 });
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(opts.size || 0.3, 8, 6), mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.parts.push({
      mesh: mesh, life: opts.life || 0.7, age: 0,
      vx: opts.vx || 0, vy: opts.vy || 0, vz: opts.vz || 0,
      grow: opts.grow || 0, fade: opts.fade !== false
    });
  };

  Effects.prototype.spawnExplosion = function (x, y, z, scale) {
    scale = scale || 1;
    var cols = [0xffd23f, 0xff7a2a, 0xff3d2a, 0x555555, 0x888888];
    for (var i = 0; i < 16; i++) {
      var a = U.rand(0, Math.PI * 2);
      var r = U.rand(1, 5) * scale;
      this._spawn(x, y + U.rand(0, 2), z, {
        color: cols[i % cols.length],
        size: U.rand(0.4, 0.9) * scale,
        life: U.rand(0.5, 1.2),
        vx: Math.sin(a) * r, vy: U.rand(2, 6), vz: Math.cos(a) * r,
        grow: 1.4
      });
    }
    this.shake(0.7 * scale);
    if (PA.audio) PA.audio.boom();
  };

  Effects.prototype.spawnSmoke = function (x, y, z) {
    for (var i = 0; i < 3; i++) {
      this._spawn(x + U.rand(-0.5, 0.5), y + U.rand(0, 0.5), z + U.rand(-0.5, 0.5), {
        color: 0x666666, size: U.rand(0.5, 0.9), life: U.rand(0.8, 1.6),
        vx: U.rand(-0.4, 0.4), vy: U.rand(0.8, 1.6), vz: U.rand(-0.4, 0.4), grow: 1.8
      });
    }
  };

  Effects.prototype.spawnSparks = function (x, y, z) {
    for (var i = 0; i < 6; i++) {
      var a = U.rand(0, Math.PI * 2);
      this._spawn(x, y, z, {
        color: 0xffe066, size: 0.12, life: U.rand(0.15, 0.4),
        vx: Math.sin(a) * U.rand(3, 7), vy: U.rand(1, 4), vz: Math.cos(a) * U.rand(3, 7)
      });
    }
  };

  Effects.prototype.spawnMuzzle = function (x, y, z, heading) {
    var fx = Math.sin(heading), fz = Math.cos(heading);
    this._spawn(x + fx * 0.4, y, z + fz * 0.4, {
      color: 0xfff2b0, size: 0.35, life: 0.08, grow: 0.5
    });
  };

  Effects.prototype.spawnPickup = function (x, y, z) {
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      this._spawn(x, y, z, {
        color: 0x7dff8a, size: 0.16, life: 0.5,
        vx: Math.sin(a) * 2, vy: 2.5, vz: Math.cos(a) * 2
      });
    }
  };

  Effects.prototype.shake = function (amt) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
  };

  Effects.prototype.shakeOffset = function () {
    if (this.shakeAmt < 0.01) return { x: 0, y: 0 };
    return {
      x: U.rand(-1, 1) * this.shakeAmt * 0.5,
      y: U.rand(-1, 1) * this.shakeAmt * 0.5
    };
  };

  Effects.prototype.update = function (dt) {
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.8);
    for (var i = this.parts.length - 1; i >= 0; i--) {
      var p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        p.mesh.geometry.dispose();
        this.parts.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 4 * dt;
      if (p.grow) {
        var s = 1 + p.age * p.grow;
        p.mesh.scale.set(s, s, s);
      }
      if (p.fade) p.mesh.material.opacity = 1 - p.age / p.life;
    }
  };

  window.PA = window.PA || {};
  PA.effects = { Effects: Effects };
})();
