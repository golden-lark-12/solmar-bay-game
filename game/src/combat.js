// Puerto Alba — combat.js
// Six weapon slots: fists to launcher, ammo, reload, hit tests.
(function () {
  'use strict';
  var U = PA.utils;

  var WEAPONS = [
    { name: 'Fists', key: '1', damage: 12, range: 2.6, rate: 0.45, auto: false, ammo: Infinity, maxAmmo: Infinity, locked: false, desc: 'Knuckles' },
    { name: 'Pistol', key: '2', damage: 22, range: 42, rate: 0.28, auto: false, ammo: 60, maxAmmo: 60, locked: false, desc: 'AP-9 sidearm' },
    { name: 'SMG', key: '3', damage: 14, range: 36, rate: 0.09, auto: true, ammo: 120, maxAmmo: 120, locked: false, desc: 'Buzz-9 spray' },
    { name: 'Shotgun', key: '4', damage: 16, range: 20, rate: 0.85, auto: false, ammo: 24, maxAmmo: 24, locked: true, desc: 'Boomstick', unlockAt: 2 },
    { name: 'Rifle', key: '5', damage: 38, range: 70, rate: 0.16, auto: true, ammo: 90, maxAmmo: 90, locked: true, desc: 'Longshot-7', unlockAt: 4 },
    { name: 'Launcher', key: '6', damage: 120, range: 60, rate: 1.4, auto: false, ammo: 6, maxAmmo: 6, locked: true, desc: 'Firework XL', unlockAt: 6 }
  ];

  function Combat(state) {
    this.state = state; // campaign state: weaponsUnlocked, ammo
    this.current = 1;
    this.cooldown = 0;
    this.reloadT = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.syncFromState();
  }

  Combat.prototype.syncFromState = function () {
    for (var i = 0; i < WEAPONS.length; i++) {
      WEAPONS[i].locked = !(this.state.weaponsUnlocked[i]);
      if (isFinite(WEAPONS[i].maxAmmo)) {
        WEAPONS[i].ammo = this.state.ammo[i] || 0;
      }
    }
  };

  Combat.prototype.syncToState = function () {
    for (var i = 0; i < WEAPONS.length; i++) {
      this.state.weaponsUnlocked[i] = !WEAPONS[i].locked;
      if (isFinite(WEAPONS[i].maxAmmo)) this.state.ammo[i] = WEAPONS[i].ammo;
    }
  };

  Combat.prototype.weapon = function () { return WEAPONS[this.current]; };

  Combat.prototype.select = function (index) {
    if (index < 0 || index >= WEAPONS.length) return false;
    if (WEAPONS[index].locked) {
      if (PA.hud) PA.hud.toast(WEAPONS[index].name + ' is LOCKED — finish job M' + (WEAPONS[index].unlockAt || 2) + ' to unlock it');
      if (PA.audio) PA.audio.bad();
      return false;
    }
    this.current = index;
    if (PA.audio) PA.audio.blip();
    return true;
  };

  Combat.prototype.unlockForMission = function (missionNumber) {
    var changed = [];
    for (var i = 0; i < WEAPONS.length; i++) {
      if (WEAPONS[i].unlockAt === missionNumber && WEAPONS[i].locked) {
        WEAPONS[i].locked = false;
        WEAPONS[i].ammo = WEAPONS[i].maxAmmo;
        changed.push(WEAPONS[i].name);
      }
    }
    if (changed.length) this.syncToState();
    return changed;
  };

  Combat.prototype.canFire = function () {
    var w = WEAPONS[this.current];
    if (this.cooldown > 0 || this.reloadT > 0) return false;
    if (w.ammo !== Infinity && w.ammo <= 0) return false;
    return true;
  };

  Combat.prototype.reload = function () {
    var w = WEAPONS[this.current];
    if (!isFinite(w.maxAmmo) || w.ammo >= w.maxAmmo || this.reloadT > 0) return;
    this.reloadT = 1.1;
    if (PA.audio) PA.audio.blip();
  };

  // Fires from origin along heading. Targets: { list, pos(), hurt(dmg), radius }.
  Combat.prototype.fire = function (origin, heading, targets, world) {
    var w = WEAPONS[this.current];
    if (!this.canFire()) {
      if (w.ammo === 0 && this.cooldown <= 0 && PA.hud) PA.hud.toast('Out of ammo — press R to reload');
      return false;
    }
    this.cooldown = w.rate;
    this.shotsFired++;
    if (w.ammo !== Infinity) w.ammo--;
    if (PA.audio) PA.audio.shot();
    var fx = Math.sin(heading), fz = Math.cos(heading);
    var mx = origin.x + fx * 1.2, my = (origin.y || 1.2), mz = origin.z + fz * 1.2;
    if (PA.effects) PA.effects.spawnMuzzle(mx, my, mz, heading);
    var pellets = w.name === 'Shotgun' ? 5 : 1;
    var hitAny = false;
    for (var p = 0; p < pellets; p++) {
      var spread = (w.name === 'Shotgun' ? U.rand(-0.09, 0.09) : U.rand(-0.015, 0.015));
      var hx = Math.sin(heading + spread), hz = Math.cos(heading + spread);
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (!t.alive) continue;
        var tp = t.pos();
        var dx = tp.x - mx, dz = tp.z - mz;
        var along = dx * hx + dz * hz;
        if (along < 0 || along > w.range) continue;
        var perp = Math.abs(dx * hz - dz * hx);
        if (perp < (t.radius || 1.2)) {
          t.hurt(w.damage);
          hitAny = true;
          if (PA.effects) PA.effects.spawnSparks(tp.x, 1.2, tp.z);
          if (t.dead || t.health <= 0) this.kills++;
          break;
        }
      }
    }
    if (w.name === 'Launcher' && PA.effects) {
      PA.effects.spawnExplosion(mx + fx * 14, 1, mz + fz * 14, 1.6);
      if (PA.audio) PA.audio.boom();
    }
    this.syncToState();
    return hitAny;
  };

  Combat.prototype.update = function (dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        var w = WEAPONS[this.current];
        w.ammo = w.maxAmmo;
        this.syncToState();
        if (PA.hud) PA.hud.toast(w.name + ' reloaded');
      }
    }
  };

  window.PA = window.PA || {};
  PA.combat = { Combat: Combat, WEAPONS: WEAPONS };
})();
