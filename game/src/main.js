// Puerto Alba — main.js
// Boot, game loop, third-person camera, car stealing, combat wiring,
// crew abilities, rival cars, saving, and the ?shot= staging modes.
(function () {
  'use strict';
  var U = PA.utils;

  var renderer, scene, camera;
  var world, effects, traffic, crowd, player, police, combat, missions;
  var parkedCars = [];
  var rivalCars = [];
  var state;
  var started = false;
  var paused = false;
  var camYaw = Math.PI;
  var camYawOffset = 0;
  var camLocked = false;
  var camDist = 11;
  var camHeight = 4.2;
  var gameTime = 0;
  var clockMinutes = 18 * 60 + 42;
  var saveTimer = 0;
  var shotMode = null;
  var vistaCam = null;
  var rivalWrecks = 0;
  var slipstreamT = 0;
  var shotFxLast = 0;
  var lastErrorCount = 0;

  window.__paErrors = window.__paErrors || [];
  window.addEventListener('error', function (e) {
    window.__paErrors.push(String(e.message || e.error || 'error'));
  });

  function params() {
    var out = {};
    var q = window.location.search.replace(/^\?/, '');
    q.split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  function clockString() {
    var h = Math.floor(clockMinutes / 60) % 24;
    var m = Math.floor(clockMinutes % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + '  ·  GOLDEN HOUR  ·  31°C';
  }

  function boot() {
    var p = params();
    shotMode = p.shot || null;
    state = PA.save.load();

    var container = document.getElementById('game');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.set(8, 5, 40);

    world = PA.city.build(scene);
    effects = new PA.effects.Effects(scene);
    // Bind the live effects instance onto the PA.effects namespace so every
    // module (vehicle, police, combat) can call PA.effects.spawnExplosion etc.
    ['spawnExplosion', 'spawnSmoke', 'spawnSparks', 'spawnMuzzle', 'spawnPickup', 'shake', 'shakeOffset'].forEach(function (fn) {
      PA.effects[fn] = effects[fn].bind(effects);
    });

    traffic = new PA.traffic.Traffic(scene, world);
    crowd = new PA.pedestrians.Crowd(scene, world);
    player = new PA.player.Player(scene, world.playerSpawn);
    police = new PA.police.Police(scene, world);
    combat = new PA.combat.Combat(state);
    PA.combatInstance = combat;
    missions = new PA.missions.MissionRunner(scene, state);
    parkedCars = PA.vehicle.makeParkedCars(scene, world.carSpots);

    PA.input.init(renderer.domElement);
    PA.hud.init();
    PA.ui.init({
      onStart: function (cont) { startGame(cont); },
      onResume: function () { setPaused(false); },
      onRestart: function () { restartRun(); },
      onSave: function () { doSave(true); },
      onQuit: function () { setPaused(false); PA.ui.showStart(PA.save.hasSave(), startStats()); },
      onBusted: function () { respawnAfterBusted(); }
    });
    PA.hud.onCrewUse = useCrewAbility;

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('keydown', function () { PA.audio.ensure(); });
    window.addEventListener('mousedown', function () { PA.audio.ensure(); });

    if (shotMode) {
      stageShot(shotMode);
    } else {
      PA.ui.showStart(PA.save.hasSave(), startStats());
    }
    PA.ui.hideLoading();
    window.__PA = {
      state: state, player: player, police: police, missions: missions,
      combat: combat, traffic: traffic, world: world, parkedCars: parkedCars,
      shot: shotMode, started: function () { return started; }
    };
    requestAnimationFrame(loop);
  }

  function startStats() {
    if (!PA.save.hasSave()) return 'A sun-soaked open-world crime story. Steal cars, outrun the Alba PD, clear the debt.';
    var s = PA.save.load();
    return 'Save found — ' + U.fmtCash(s.cash) + ' · ' + s.rank + ' · ' + s.respect + ' RP · ' + s.completed.length + '/8 jobs done.';
  }

  function startGame(continueSave) {
    if (!continueSave) {
      state = PA.save.blank();
      combat = new PA.combat.Combat(state);
      PA.combatInstance = combat;
      missions.state = state;
      if (window.__PA) { window.__PA.state = state; window.__PA.combat = combat; }
    }
    PA.ui.hideStart();
    PA.ui.hideBusted();
    started = true;
    paused = false;
    PA.audio.ensure();
    PA.audio.setRadio(true);
    if (!missions.mission() && missions.state.missionIndex < 8) {
      missions.start(missions.state.missionIndex);
    }
    PA.hud.toast('Welcome to Puerto Alba — press J for the next job, E to steal a car');
    window.__paReady = true;
  }

  function restartRun() {
    state = PA.save.blank();
    if (window.__PA) window.__PA.state = state;
    PA.save.save(state);
    player.heal(100);
    player.armor = 50;
    police.clearAll();
    missions.state = state;
    PA.ui.hidePause();
    PA.ui.hideBusted();
    started = true;
    paused = false;
    missions.start(0);
  }

  function respawnAfterBusted() {
    PA.ui.hideBusted();
    player.heal(100);
    player.armor = 50;
    player.dead = false;
    if (player.car) player.exitCar(world);
    player.mesh.position.set(world.playerSpawn.x, 0, world.playerSpawn.z);
    player.mesh.visible = true;
    player.onFoot = true;
    state.cash = Math.max(0, state.cash - 500);
    police.clearAll();
    started = true;
    paused = false;
    PA.hud.toast('Ria walked out of the precinct — $500 lighter. The debt remains.');
    doSave(false);
  }

  function setPaused(v) {
    paused = v;
    if (v) PA.ui.showPause();
    else PA.ui.hidePause();
  }

  function doSave(announce) {
    state.playSeconds = Math.floor(state.playSeconds + gameTime);
    var ok = PA.save.save(state);
    if (ok && announce) PA.ui.flashSaved();
    return ok;
  }

  function useCrewAbility(i, c) {
    if (i === 0) {
      slipstreamT = 10;
      PA.hud.toast('Jax — SLIPSTREAM: full speed for 10 seconds');
      if (PA.audio) PA.audio.good();
    } else if (i === 1) {
      police.setWanted(Math.max(0, police.wanted - 1));
      PA.hud.toast('Mina — FEEDS LOOPED: wanted level dropped');
      if (PA.audio) PA.audio.good();
    } else if (i === 2) {
      var pos = player.position();
      var target = PA.vehicle.nearestCar(parkedCars.concat(traffic.cars.map(function (t) { return t.car; })), pos.x, pos.z, 14);
      if (target && target !== player.car) {
        target.damage(200);
        PA.hud.toast('Tito — RAM: rival car wrecked');
        if (PA.audio) PA.audio.boom();
      } else {
        PA.hud.toast('Tito — no car in range');
      }
    }
  }

  function spawnRivals() {
    if (rivalCars.length) return;
    var spots = [{ x: 120, z: -44 }, { x: 132, z: -60 }, { x: 118, z: -62 }];
    spots.forEach(function (s) {
      var c = new PA.vehicle.Car(scene, { x: s.x, z: s.z, heading: Math.PI, color: 0x8a1a1a, sporty: true, model: 'Rival Runner' });
      rivalCars.push(c);
    });
  }

  function clearRivals() {
    rivalCars.forEach(function (c) { c.remove(scene); });
    rivalCars = [];
    rivalWrecks = 0;
  }

  function trySteal() {
    var pos = player.footPos();
    var car = PA.vehicle.nearestCar(parkedCars, pos.x, pos.z, 5);
    if (!car) {
      PA.hud.toast('No car close enough — walk up to a parked car');
      return;
    }
    if (player.enterCar(car)) {
      car.stolen = true;
      police.addHeat(1);
      if (police.wanted < 1) police.setWanted(1);
      PA.hud.toast('Stole the ' + car.name + ' — the Alba PD noticed');
    }
  }

  function combatTargets() {
    var list = [];
    crowd.peds.forEach(function (p) {
      if (!p.alive) return;
      list.push({
        alive: true, radius: 1.0,
        pos: function () { return { x: p.mesh.position.x, z: p.mesh.position.z }; },
        hurt: function (d) { p.alive = false; p.mesh.visible = false; },
        get dead() { return !p.alive; }
      });
    });
    police.cops.forEach(function (c) {
      if (!c.alive) return;
      list.push({
        alive: c.alive, radius: 1.6,
        pos: function () { return { x: c.mesh.position.x, z: c.mesh.position.z }; },
        hurt: function (d) { c.damage(d); },
        get dead() { return !c.alive; }
      });
    });
    rivalCars.forEach(function (c) {
      if (!c.alive) return;
      list.push({
        alive: c.alive, radius: 1.8,
        pos: function () { return { x: c.mesh.position.x, z: c.mesh.position.z }; },
        hurt: function (d) { c.damage(d); },
        get dead() { return !c.alive; }
      });
    });
    return list;
  }

  // ---- Screenshot staging (?shot=1..4) ----
  function stageShot(n) {
    started = true;
    camLocked = true; // staged cameras never swing; the shot is deterministic
    PA.ui.hideStart();
    PA.audio.ensure();
    PA.audio.setRadio(true);
    if (n === '1') {
      // Cover: golden-hour chase on the beach approach to the causeway.
      var car = parkedCars[0];
      car.mesh.position.set(0, 0, 118);
      car.heading = 0;
      car.mesh.rotation.y = 0;
      car.speed = 24;
      player.enterCar(car);
      player.car = car;
      police.setWanted(4);
      // Park Air One at its hover spot now (it lerps from the origin and
      // would still be behind the camera at capture time). Low and far
      // ahead so it sits inside the follow camera's frame.
      police.heliHold = { x: -14, y: 20, z: 175 };
      police.heli.position.set(-14, 20, 175);
      // Pre-spawn the pursuit cars now (headless captures happen before the
      // 1.2s spawn timer would fire); the chase then keeps them flanking.
      while (police.cops.length < 3) police.spawnCop({ x: 0, z: 118 });
      police.cops.forEach(function (c, i) {
        var a = [-1, 1, 0.4][i % 3];
        // Start 30+ m back: the chase closes the gap to a flank by capture time.
        c.mesh.position.set(a * 11, 0, 118 - 32 - i * 8);
      });
      police.roadblockCars.forEach(function (c, i) {
        c.mesh.position.set(-5 + i * 10, 0, 145);
        c.heading = Math.PI / 2;
        c.mesh.rotation.y = c.heading;
      });
      police.roadblock = { x: 0, z: 145 };
      effects.spawnExplosion(8, 1, 140, 1.5);
      effects.spawnSmoke(8, 2, 140);
      missions.start(2);
      missions.stageIndex = 1;
      missions.elapsed = 167;
      missions._placeMarker();
      PA.hud.showDialogue('Dario Font', 'No — you drive around it. Fast. The island is the finish line.');
      PA.hud.banner('M3 — Causeway Run', 'Cross the causeway to the island — Air One is overhead');
      camYaw = Math.PI;
      camDist = 15;
      camHeight = 3.6;
    } else if (n === '2') {
      // Steal: Ria on foot beside the red Vulture GT.
      var v = parkedCars[0];
      v.mesh.position.set(14, 0, 30);
      v.heading = Math.PI / 2;
      v.mesh.rotation.y = v.heading;
      player.mesh.position.set(11.5, 0, 30);
      player.heading = Math.PI / 2;
      player.mesh.rotation.y = player.heading;
      police.setWanted(0);
      missions.start(0);
      missions.elapsed = 38;
      PA.hud.showDialogue('Marco "Wrench" Vela', 'Red Vulture GT, Marina Row. Don\'t scratch it.');
      PA.hud.banner('M1 — Hot Wheels', 'Steal the red Vulture GT — press E by the car');
      PA.hud.toast('Press E to steal the Vulture GT');
      camYaw = Math.PI / 2 + 0.5;
      camDist = 9;
      camHeight = 3.4;
    } else if (n === '3') {
      // Mission: causeway approach with the route line on the minimap.
      var c3 = parkedCars[0];
      c3.mesh.position.set(0, 0, 96);
      c3.heading = 0;
      c3.mesh.rotation.y = 0;
      c3.speed = 18;
      player.enterCar(c3);
      police.setWanted(2);
      while (police.cops.length < 2) police.spawnCop({ x: 0, z: 96 });
      police.cops.forEach(function (c, i) {
        c.mesh.position.set((i === 0 ? -8 : 8), 0, 96 - 18 - i * 6);
      });
      missions.start(2);
      missions.stageIndex = 0;
      missions.elapsed = 95;
      missions._placeMarker();
      PA.hud.showDialogue('Dario Font', 'The cops set a roadblock on the causeway every Friday. Tonight is Friday.');
      PA.hud.banner('M3 — Causeway Run', 'Reach the causeway entrance — follow the gold route');
      camYaw = Math.PI;
      camDist = 12;
      camHeight = 4.6;
    } else if (n === '4') {
      // Vista: high camera over the beach, palms, city and bay.
      var c4 = parkedCars[6];
      c4.mesh.position.set(-40, 0, 148);
      c4.heading = Math.PI / 2;
      c4.mesh.rotation.y = c4.heading;
      player.mesh.position.set(-36, 0, 148);
      player.heading = Math.PI / 2;
      player.mesh.rotation.y = player.heading;
      police.setWanted(0);
      PA.hud.showDialogue('Ria Solano', 'Puerto Alba at golden hour. The whole city is mine to drive.');
      PA.hud.banner('Puerto Alba — Free Roam', 'Beach, bay and skyline — 8 jobs, 1 debt to clear');
      vistaCam = { pos: [-95, 62, 28], look: [35, 0, 185] };
      camYaw = Math.PI;
    }
    window.__paReady = true;
  }

  function updateCamera(dt) {
    if (vistaCam) {
      camera.position.set(vistaCam.pos[0], vistaCam.pos[1], vistaCam.pos[2]);
      camera.lookAt(vistaCam.look[0], vistaCam.look[1], vistaCam.look[2]);
      return;
    }
    var drag = PA.input.consumeDrag();
    camYawOffset += drag.dx * 0.004;
    camYawOffset *= 0.96;
    var focus = player.position();
    var heading = player.car ? player.car.heading : player.heading;
    var desired = heading + Math.PI + camYawOffset;
    if (!camLocked) camYaw = U.turnToward(camYaw, desired, 3.2 * dt);
    var speed = player.car ? Math.abs(player.car.speed) : 0;
    var dist = camDist + speed * 0.12;
    var tx = focus.x + Math.sin(camYaw) * dist;
    var tz = focus.z + Math.cos(camYaw) * dist;
    var ty = camHeight + speed * 0.03;
    camera.position.x = U.lerp(camera.position.x, tx, 1 - Math.pow(0.0001, dt));
    camera.position.y = U.lerp(camera.position.y, ty, 1 - Math.pow(0.0001, dt));
    camera.position.z = U.lerp(camera.position.z, tz, 1 - Math.pow(0.0001, dt));
    var shake = effects.shakeOffset();
    camera.lookAt(focus.x + shake.x, 1.6 + shake.y, focus.z);
  }

  function handleInput(dt) {
    if (PA.input.wasPressed('KeyP') || PA.input.wasPressed('Escape')) {
      if (started && !player.dead) setPaused(!paused);
    }
    if (paused) return;
    if (!started) return;
    if (PA.input.wasPressed('KeyJ')) {
      if (!missions.mission()) {
        var next = state.missionIndex;
        if (next >= PA.missions.MISSIONS.length) next = 0;
        missions.start(next);
      } else {
        PA.hud.toast('Job in progress — ' + missions.objectiveText());
      }
    }
    if (PA.input.wasPressed('KeyE')) {
      if (player.car) player.exitCar(world);
      else trySteal();
    }
    if (PA.input.wasPressed('KeyR')) combat.reload();
    if (PA.input.wasPressed('KeyV')) {
      PA.hud.toast('Radio: ' + PA.audio.nextStation());
    }
    if (PA.input.wasPressed('KeyH')) {
      PA.audio.horn();
      PA.hud.toast('Horn!');
    }
    if (PA.input.wasPressed('KeyM')) {
      PA.audio.setMuted(!PA.audio.isMuted());
      PA.hud.toast(PA.audio.isMuted() ? 'Sound muted' : 'Sound on');
    }
    for (var w = 0; w < 6; w++) {
      if (PA.input.wasPressed('Digit' + (w + 1))) combat.select(w);
    }
    if (PA.input.wasPressed('KeyZ')) PA.hud.useCrew(0);
    if (PA.input.wasPressed('KeyX')) PA.hud.useCrew(1);
    if (PA.input.wasPressed('KeyC')) PA.hud.useCrew(2);
    if (PA.input.wasPressed('KeyT')) {
      PA.audio.setRadio(true);
      PA.hud.toast('Radio: ' + PA.audio.stationName());
    }
    // Fire on click (on foot) or with left mouse held.
    if (!player.car && PA.input.mouse.down) {
      var origin = player.footPos();
      origin.y = 1.3;
      var heading = player.heading;
      var hit = combat.fire(origin, heading, combatTargets(), world);
      if (hit) police.addHeat(1);
    }
  }

  var lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (!paused) {
      gameTime += dt;
      clockMinutes += dt * 0.25;
      var m = missions.mission();
      if (m && m.num === 7 && missions.stageIndex === 1) spawnRivals();
      if (!m || m.num !== 7) {
        if (rivalCars.length && (!m || m.num !== 7)) { /* keep wrecks until next job */ }
      }
      handleInput(dt);
      // Player / car.
      if (player.car) {
        var ax = PA.input.axes();
        var boost = slipstreamT > 0 ? 1.35 : 1;
        if (slipstreamT > 0) slipstreamT -= dt;
        var throttle = ax.y;
        var steer = -ax.x;
        player.car.maxSpeed = (player.car.sporty ? 42 : 30) * boost;
        player.car.drive(dt, throttle, steer, world);
        PA.audio.setEngine(U.clamp(Math.abs(player.car.speed) / 40, 0, 1), true);
        if (Math.abs(player.car.speed) > 6 && Math.random() < 0.06) {
          effects.spawnSmoke(player.car.mesh.position.x, 0.3, player.car.mesh.position.z);
        }
      } else {
        player.update(dt, PA.input, world, camYaw + Math.PI);
        PA.audio.setEngine(0, false);
      }
      // World life.
      world.update(dt, t / 1000);
      var pp = player.position();
      traffic.update(dt, { x: pp.x, z: pp.z });
      var danger = police.wanted > 0 || combat.shotsFired > 0;
      crowd.update(dt, danger, { x: pp.x, z: pp.z });
      police.update(dt, player, { x: pp.x, z: pp.z });
      combat.update(dt);
      effects.update(dt);
      PA.audio.update(dt);
      // Rival wreck counting for M7.
      rivalCars.forEach(function (c) {
        if (!c.alive && !c.counted) {
          c.counted = true;
          rivalWrecks++;
        }
      });
      missions.update(dt, {
        player: player, police: police, world: world,
        rivalWrecks: rivalWrecks, parkedCars: parkedCars
      });
      // Busted: dead, or a cop grabs Ria on foot at max heat.
      if (player.dead) {
        PA.ui.showBusted('WASTED — Ria is down. The debt is still waiting.');
        started = false;
      }
      // Staged chase pyrotechnics for the cover shot: a burning roadblock
      // car keeps smoking and flaring so the shot reads at any capture time.
      if (shotMode === '1') {
        var nowMs = performance.now();
        if (nowMs - shotFxLast > 2200) {
          shotFxLast = nowMs;
          effects.spawnExplosion(8, 1, 140, 1.3);
          effects.spawnSmoke(8, 2, 140);
          effects.spawnSmoke(-6, 2, 145);
        }
      }
      // Auto-save.
      saveTimer += dt;
      if (saveTimer > 20) {
        saveTimer = 0;
        doSave(false);
      }
      // HUD.
      var stage = missions.stage();
      var target = stage && stage.target ? stage.target : null;
      PA.hud.update(dt, {
        cash: state.cash, health: player.health, armor: player.armor,
        respect: state.respect, rank: state.rank, wanted: police.wanted,
        speed: player.car ? player.car.speed : 0,
        carCond: player.car ? player.car.condition : 0,
        inCar: !!player.car, radio: PA.audio.stationName(),
        clock: clockString(), weather: 'CLEAR · 31°C · WIND 12 km/h',
        objective: missions.objectiveText(),
        timer: missions.mission() ? U.fmtClock(missions.elapsed) : '',
        stageIndex: missions.stageIndex,
        stageCount: missions.mission() ? missions.mission().stages.length : 0,
        progress: missions._stageProgress ? missions._stageProgress() : 0,
        weaponIndex: combat.current, reloadT: combat.reloadT,
        world: world, playerPos: { x: pp.x, z: pp.z },
        playerHeading: player.car ? player.car.heading : player.heading,
        missionTarget: target, cops: police.cops, units: police.units,
        traffic: traffic.cars, rivals: rivalCars, started: started && shotMode !== '4'
      });
    }
    updateCamera(dt);
    renderer.render(scene, camera);
    if (!window.__paReady && started) window.__paReady = true;
    PA.input.endFrame();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.PA = window.PA || {};
  PA.main = { boot: boot };
})();
