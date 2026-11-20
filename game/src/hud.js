// Puerto Alba — hud.js
// The dense HUD: wanted stars, cash, health, respect, dispatch panel,
// minimap with route line, weapon slots, dialogue, crew, mission banner.
(function () {
  'use strict';
  var U = PA.utils;

  var refs = {};
  var weaponSlots = [];
  var dialogueTimer = 0;
  var bannerTimer = 0;
  var toastTimer = 0;
  var crew = [
    { key: 'Z', name: 'Jax', role: 'Getaway driver', ability: 'Slipstream — +speed 10s', cd: 0, cdMax: 45 },
    { key: 'X', name: 'Mina', role: 'Hacker', ability: 'Loop Feeds — minus 1 star', cd: 0, cdMax: 90 },
    { key: 'C', name: 'Tito', role: 'Muscle', ability: 'Ram — wreck nearest rival', cd: 0, cdMax: 60 }
  ];
  var onCrewUse = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    refs.wanted = $('wanted-stars');
    refs.cash = $('cash');
    refs.healthFill = $('health-fill');
    refs.armorFill = $('armor-fill');
    refs.rankName = $('rank-name');
    refs.respectLine = $('respect-line');
    refs.rpFill = $('rp-fill');
    refs.dispatchList = $('dispatch-list');
    refs.radio = $('radio-line');
    refs.clock = $('clock-line');
    refs.weather = $('weather-line');
    refs.missionTitle = $('mission-title');
    refs.missionSub = $('mission-sub');
    refs.missionBanner = $('mission-banner');
    refs.missionTimer = $('mission-timer');
    refs.stageBars = $('stage-bars');
    refs.crewPanel = $('crew-panel');
    refs.minimap = $('minimap');
    refs.speedo = $('speedo');
    refs.carCond = $('car-cond');
    refs.weaponSlots = $('weapon-slots');
    refs.dialogue = $('dialogue-box');
    refs.dialogueName = $('dialogue-name');
    refs.dialogueLine = $('dialogue-line');
    refs.objective = $('objective-line');
    refs.toast = $('toast');
    refs.hint = $('hint-line');
    refs.crosshair = $('crosshair');
    buildWeaponSlots();
    buildStageBars();
    buildCrewPanel();
  }

  function buildWeaponSlots() {
    if (!refs.weaponSlots) return;
    refs.weaponSlots.innerHTML = '';
    weaponSlots = [];
    PA.combat.WEAPONS.forEach(function (w, i) {
      var slot = U.el('div', 'wslot', refs.weaponSlots);
      var num = U.el('div', 'wslot-num', slot, (i + 1) + '');
      var name = U.el('div', 'wslot-name', slot, w.name);
      var ammo = U.el('div', 'wslot-ammo', slot, '');
      var lock = U.el('div', 'wslot-lock', slot, '');
      weaponSlots.push({ root: slot, name: name, ammo: ammo, lock: lock });
    });
  }

  function buildStageBars() {
    if (!refs.stageBars) return;
    refs.stageBars.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var bar = U.el('div', 'stage-bar', refs.stageBars);
      U.el('div', 'stage-fill', bar);
    }
  }

  function buildCrewPanel() {
    if (!refs.crewPanel) return;
    refs.crewPanel.innerHTML = '';
    crew.forEach(function (c, i) {
      var row = U.el('div', 'crew-row', refs.crewPanel);
      U.el('div', 'crew-key', row, '[' + c.key + ']');
      var mid = U.el('div', 'crew-mid', row);
      U.el('div', 'crew-name', mid, c.name + ' — ' + c.role);
      U.el('div', 'crew-ability', mid, c.ability);
      var cd = U.el('div', 'crew-cd', row, 'READY');
      c.el = row;
      c.cdEl = cd;
    });
  }

  function showDialogue(name, line) {
    if (!refs.dialogue) return;
    refs.dialogueName.textContent = name;
    refs.dialogueLine.textContent = '“' + line + '”';
    refs.dialogue.classList.add('show');
    dialogueTimer = 7;
  }

  function hideDialogue() {
    if (!refs.dialogue) return;
    refs.dialogue.classList.remove('show');
  }

  function banner(title, sub) {
    if (!refs.missionBanner) return;
    refs.missionTitle.textContent = title;
    refs.missionSub.textContent = sub || '';
    refs.missionBanner.classList.add('show');
    bannerTimer = 6;
  }

  function toast(msg) {
    if (!refs.toast) return;
    refs.toast.textContent = msg;
    refs.toast.classList.add('show');
    toastTimer = 3;
  }

  function useCrew(i) {
    var c = crew[i];
    if (!c || c.cd > 0) return false;
    c.cd = c.cdMax;
    if (onCrewUse) onCrewUse(i, c);
    return true;
  }

  function updateCrew(dt) {
    for (var i = 0; i < crew.length; i++) {
      var c = crew[i];
      if (c.cd > 0) c.cd -= dt;
      if (c.cdEl) {
        if (c.cd > 0) {
          c.cdEl.textContent = Math.ceil(c.cd) + 's';
          c.cdEl.classList.add('cooling');
          c.el.classList.add('cooling');
        } else {
          c.cdEl.textContent = 'READY';
          c.cdEl.classList.remove('cooling');
          c.el.classList.remove('cooling');
        }
      }
    }
  }

  function drawMinimap(world, playerPos, playerHeading, missionTarget, cops, trafficCars, rivalCars) {
    var cv = refs.minimap;
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var S = W / 420; // world -210..210 -> canvas
    function toX(x) { return (x + 210) * S; }
    function toY(z) { return (z + 210) * S; }
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1c1a24';
    ctx.fillRect(0, 0, W, H);
    // Water + sand.
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(0, toY(190), W, H - toY(190));
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(0, toY(150), W, toY(190) - toY(150));
    // Roads.
    ctx.strokeStyle = '#55555e';
    ctx.lineWidth = 5;
    PA.city.ROAD_COORDS.forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(toX(c), 0); ctx.lineTo(toX(c), toY(190)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(c)); ctx.lineTo(W, toY(c)); ctx.stroke();
    });
    // Causeway.
    ctx.strokeStyle = '#8a8578';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(toX(0), toY(150)); ctx.lineTo(toX(0), toY(262)); ctx.stroke();
    // Route line to the mission target.
    if (missionTarget && playerPos) {
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(playerPos.x), toY(playerPos.z));
      ctx.lineTo(toX(missionTarget.x), toY(missionTarget.z));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.arc(toX(missionTarget.x), toY(missionTarget.z), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('M', toX(missionTarget.x), toY(missionTarget.z) + 2.5);
    }
    // Traffic dots.
    ctx.fillStyle = '#c8c8d8';
    if (trafficCars) {
      trafficCars.forEach(function (t) {
        var p = t.car.mesh.position;
        ctx.fillRect(toX(p.x) - 1.5, toY(p.z) - 1.5, 3, 3);
      });
    }
    // Rival cars.
    if (rivalCars) {
      ctx.fillStyle = '#ff5a3c';
      rivalCars.forEach(function (r) {
        ctx.fillRect(toX(r.mesh.position.x) - 2, toY(r.mesh.position.z) - 2, 4, 4);
      });
    }
    // Cop dots.
    ctx.fillStyle = '#4a90ff';
    if (cops) {
      cops.forEach(function (c) {
        var p = c.mesh.position;
        ctx.beginPath();
        ctx.arc(toX(p.x), toY(p.z), 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // Player arrow.
    if (playerPos) {
      ctx.save();
      ctx.translate(toX(playerPos.x), toY(playerPos.z));
      ctx.rotate(-playerHeading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  function update(dt, s) {
    // s: { cash, health, armor, respect, rank, wanted, speed, carCond, inCar,
    //   radio, clock, weather, objective, timer, stageIndex, stageCount, progress,
    //   weaponIndex, reloadT, world, playerPos, playerHeading, missionTarget, cops, traffic, rivals }
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) hideDialogue();
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0 && refs.missionBanner) refs.missionBanner.classList.remove('show');
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0 && refs.toast) refs.toast.classList.remove('show');
    }
    updateCrew(dt);
    if (refs.wanted) {
      var stars = '';
      for (var i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
      refs.wanted.textContent = stars;
      refs.wanted.className = 'wanted-' + s.wanted;
    }
    if (refs.cash) refs.cash.textContent = U.fmtCash(s.cash);
    if (refs.healthFill) refs.healthFill.style.width = U.clamp(s.health, 0, 100) + '%';
    if (refs.armorFill) refs.armorFill.style.width = U.clamp(s.armor, 0, 100) + '%';
    if (refs.rankName) refs.rankName.textContent = s.rank;
    if (refs.respectLine) refs.respectLine.textContent = 'RESPECT ' + s.respect + ' RP';
    if (refs.rpFill) {
      var next = PA.missions.nextRankAt(s.respect);
      var pct = next === null ? 100 : U.clamp((s.respect / next) * 100, 0, 100);
      refs.rpFill.style.width = pct + '%';
    }
    if (refs.dispatchList) {
      var html = '';
      if (!s.units || s.units.length === 0) {
        html = '<div class="dispatch-row"><span class="dispatch-quiet">No active units — streets are quiet.</span></div>';
      } else {
        s.units.forEach(function (u) {
          html += '<div class="dispatch-row"><span class="dispatch-name">' + u.name + '</span>' +
            '<span class="dispatch-role">' + u.role + '</span>' +
            '<span class="dispatch-dist">' + U.fmtDist(u.dist) + '</span></div>';
        });
      }
      refs.dispatchList.innerHTML = html;
    }
    if (refs.radio) refs.radio.textContent = '♪ ' + s.radio;
    if (refs.clock) refs.clock.textContent = s.clock;
    if (refs.weather) refs.weather.textContent = s.weather;
    if (refs.objective) refs.objective.textContent = s.objective || '';
    if (refs.missionTimer) refs.missionTimer.textContent = s.timer || '';
    if (refs.stageBars) {
      var bars = refs.stageBars.children;
      for (var b = 0; b < bars.length; b++) {
        var fill = bars[b].firstChild;
        var val = 0;
        if (s.stageCount > 0) {
          if (b < s.stageIndex) val = 100;
          else if (b === s.stageIndex) val = Math.round(s.progress * 100);
        }
        fill.style.width = val + '%';
        bars[b].classList.toggle('done', b < s.stageIndex);
        bars[b].classList.toggle('active', b === s.stageIndex);
      }
    }
    if (refs.speedo) {
      refs.speedo.style.display = s.inCar ? 'block' : 'none';
      refs.speedo.textContent = Math.round(Math.abs(s.speed || 0) * 2.2) + ' mph';
    }
    if (refs.carCond) {
      refs.carCond.style.display = s.inCar ? 'block' : 'none';
      refs.carCond.textContent = 'CAR ' + Math.round(s.carCond || 0) + '%';
      refs.carCond.className = 'car-cond ' + ((s.carCond || 0) < 30 ? 'bad' : (s.carCond || 0) < 60 ? 'warn' : 'good');
    }
    if (refs.crosshair) refs.crosshair.style.display = (!s.inCar && s.started) ? 'block' : 'none';
    // Weapon slots.
    for (var wi = 0; wi < weaponSlots.length; wi++) {
      var w = PA.combat.WEAPONS[wi];
      var slot = weaponSlots[wi];
      slot.root.classList.toggle('active', wi === s.weaponIndex);
      slot.root.classList.toggle('locked', !!w.locked);
      slot.ammo.textContent = w.locked ? '—' : (w.ammo === Infinity ? '∞' : (s.reloadT > 0 && wi === s.weaponIndex ? 'RELOADING' : w.ammo + ''));
      slot.lock.textContent = w.locked ? 'LOCKED · M' + (w.unlockAt || 2) : '';
    }
    drawMinimap(s.world, s.playerPos, s.playerHeading || 0, s.missionTarget, s.cops, s.traffic, s.rivals);
  }

  window.PA = window.PA || {};
  PA.hud = {
    init: init, update: update, showDialogue: showDialogue, banner: banner,
    toast: toast, useCrew: useCrew, crew: crew,
    set onCrewUse(fn) { onCrewUse = fn; },
    get onCrewUse() { return onCrewUse; }
  };
})();
