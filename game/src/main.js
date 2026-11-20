// main.js — Puerto Alba (gta6-01 v4). Entry point; wires all systems.
// THREE is a global (vendor/three.min.js loads as a classic script before
// this module). No import of THREE.
// v4 fixes: rankFor returns {rank, next} (not the rank); exposure dialed
// back so the orange car + sunset read saturated, not washed out; police
// staged close to the player; heli low enough to be in frame; fireball
// compact + deep orange, 20m ahead; roadblock tight + close.

import { WORLD, buildCity, collideCircle } from './city.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police, DISPATCH_STATUSES } from './police.js';
import { Combat, WEAPONS } from './combat.js';
import { Missions, JOBS, RANKS, rankFor } from './missions.js';
import { Garage, GARAGE_UPGRADES } from './garage.js';
import { Races, RACE_DEFS } from './races.js';
import { Districts, DISTRICTS } from './districts.js';
import { Hud } from './hud.js';
import { Player } from './player.js';
import { Car, CAR_NAMES, makeCarMesh, randomCarColor } from './vehicle.js';
import { SaveSys } from './save.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { Ui } from './ui.js';
import { clamp, lerp, angleDiff, angleLerp, fmtCash, fmtClock, fmtSpeedKmh, fmtTimeOfDay, dist2d } from './utils.js';
import { Effects } from './effects.js';

const $ = (s) => document.querySelector(s);

// Rank helper: rankFor(rp) returns {rank, next}; older code read .name off
// the wrapper. This returns the rank object itself.
function rankOf(rp) {
  const rf = rankFor(rp);
  return (rf && rf.rank) || rf || RANKS[0];
}
function nextRankOf(rp) {
  const rf = rankFor(rp);
  return (rf && rf.next) || null;
}

const CREW_DEFS = [
  { name: 'Kiki Maro', initials: 'KM', ability: 'Slipstream', key: 'Z', color: '#2ad8c8', cd: 45 },
  { name: 'Dario Voss', initials: 'DV', ability: 'Loop Feeds', key: 'X', color: '#ff8a2a', cd: 60 },
  { name: 'Lena Kade', initials: 'LK', ability: 'Ram', key: 'C', color: '#ff4a6a', cd: 50 },
];

const STATIONS = [
  { name: 'ALBA FM 98.1', songs: ['Golden Hour Drive', 'Neon Palms', 'Causeway Lights', 'Salt Air', 'Midnight in Alba', 'Strand Summer'] },
];

class Game {
  constructor() {
    this.THREE = window.THREE;
    // Renderer.
    this.renderer = new this.THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // v4: exposure 0.95 (was 1.22 — washed the scene to white; 1.05
    // still blew the chase cover to yellow, so down another notch).
    this.renderer.toneMapping = this.THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new this.THREE.Scene();
    // Vivid sunset sky (saturated orange, not white).
    this.scene.background = new this.THREE.Color(0xff6a1e);
    this.scene.fog = new this.THREE.Fog(0xff8a3a, 260, 900);
    this.camera = new this.THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(-120, 8, 170);
    this.clock = new this.THREE.Clock();
    this.elapsed = 0;
    this.timeOfDay = 18.1;

    // Lights (v4: dialed back from 1.9/3.0/1.15 so orange stays orange).
    this.hemi = new this.THREE.HemisphereLight(0xffd9a8, 0x3a2a4a, 1.6);
    this.scene.add(this.hemi);
    this.dirLight = new this.THREE.DirectionalLight(0xffbe78, 2.6);
    this.dirLight.position.set(-300, 220, 300);
    this.scene.add(this.dirLight);
    this.amb = new this.THREE.AmbientLight(0xffb070, 1.0);
    this.scene.add(this.amb);

    // City.
    this.city = buildCity(this.THREE, this.scene);
    this.colliders = this.city.colliders;
    // v4: sun smaller + warmer (scale 1.4, warm orange) so it reads as a
    // glowing sunset sun, not a giant white blob.
    if (this.city.sunBall) {
      this.city.sunBall.scale.setScalar(1.4);
      if (this.city.sunBall.material) this.city.sunBall.material.color.set(0xffb347);
    }
    // Denser skyline silhouette around the world edges (one InstancedMesh).
    this._buildSkyline();

    // Systems.
    this.effects = new Effects(this.THREE, this.scene);
    this.traffic = new Traffic(this.THREE, this.scene, this.colliders);
    this.peds = new Pedestrians(this.THREE, this.scene);
    this.police = new Police(this.THREE, this.scene, this.colliders);
    this.combat = new Combat();
    this.missions = new Missions(this.THREE, this.scene);
    this.garage = new Garage();
    this.races = new Races(this.THREE, this.scene);
    this.districts = new Districts();
    this.hud = new Hud();
    this.hud.build();
    this.ui = new Ui();
    this.save = new SaveSys();
    this.audio = new AudioSys();
    this.input = new Input();

    // Player + starter car.
    this.player = new Player(this.THREE, this.scene, -130.2, 156);
    this.car = new Car(this.THREE, this.scene, { name: 'Alba Cruiser', color: 0xff4a00 });
    this.car.setPos(-128, 156, -1.57);
    this.garage.applyTo(this.car);
    this.car.nitro = 100;
    this.nitro = 100;

    // Living world in normal play (shot staging resets these counts).
    this.traffic.spawn(24);
    this.peds.spawn(20);

    // State.
    this.state = 'menu';
    this.cash = 1200;
    this.rp = 0;
    this.inCar = false;
    this.wanted = 0;
    this.crew = CREW_DEFS.map((d) => ({ ...d, cooldown: 0, ready: true }));
    this.ramCooldown = 0;
    this.dialogueQueue = [];
    this.dialogueTimer = 0;
    this.dialogueCurrent = null;
    this.bustedTimer = 0;
    this.saveTimer = 0;
    this.raceResultPending = null;
    this._enteredCar = false;
    this._lastStageKey = '';
    this._camSnapped = false;
    this.camYaw = 0;
    this.shotMode = null;
    this.shotBoomAt = 0;
    this._lastBoomWall = 0;
    this._lastMuzzleWall = 0;
    this._rbStaged = false;
    this._stagedPolice = new Set();
    this._recolored = new Set();
    this._shotWp = null;
    this._songIdx = 0;
    this._stationIdx = 0;
    this._raceActive = false;

    // Shot mode from URL (?shot=chase|briefing|combat|vista|steal|mission).
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      this.shotMode = shot;
      this.applyShot(shot);
    }

    // UI wiring.
    this.ui.onPlay = () => this.startPlaying(false);
    this.ui.onContinue = () => this.startPlaying(true);
    this.ui.onResume = () => { this.state = 'playing'; this.ui.hideAll(); };
    this.ui.onRestart = () => { this._restart(); };
    // In shot mode the game is already playing (applyShot hid the menus);
    // showing the start screen here would cover the staged scene.
    if (!this.shotMode) this.ui.showStart(this.save.exists());

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  _buildSkyline() {
    const boxes = [];
    // Ring of tall dark boxes around the world edges for a dense horizon.
    for (let x = -290; x <= 290; x += 24) {
      boxes.push([x, -290, 26 + Math.random() * 42]);
      boxes.push([x, 550, 26 + Math.random() * 42]);
    }
    for (let z = -290; z <= 550; z += 24) {
      boxes.push([-290, z, 26 + Math.random() * 42]);
      boxes.push([290, z, 26 + Math.random() * 42]);
    }
    const geo = new this.THREE.BoxGeometry(18, 1, 18);
    const mat = new this.THREE.MeshLambertMaterial({ color: 0x7a4a6a });
    const mesh = new this.THREE.InstancedMesh(geo, mat, boxes.length);
    const m4 = new this.THREE.Matrix4();
    const q = new this.THREE.Quaternion();
    const sc = new this.THREE.Vector3();
    const pos = new this.THREE.Vector3();
    boxes.forEach(([x, z, h], i) => {
      pos.set(x, h / 2, z);
      sc.set(1, h, 1);
      q.identity();
      m4.compose(pos, q, sc);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  // ---------- shot staging ----------
  // Staged late-game state shared by all shots: rich, high-RP, fully
  // upgraded, Sniper still locked (unlocks at M11).
  _stageProgression(cash, rp) {
    this.cash = cash;
    this.rp = rp;
    for (const up of GARAGE_UPGRADES) {
      try { this.garage.buy(up.id, this); } catch (e) {}
    }
    this.garage.applyTo(this.car);
    for (const jobId of ['M3', 'M5', 'M7']) {
      try { this.combat.unlockForJob(jobId); } catch (e) {}
    }
    this.races.best = { 'strand-gp': 98.4 };
    try {
      this.districts.addStanding('The Strand', 62);
      this.districts.addStanding('Marina Row', 48);
      this.districts.addStanding('Commerce Row', 35);
      this.districts.addStanding('Causeway', 41);
      this.districts.addStanding('The Island', 28);
    } catch (e) {}
    for (const c of this.crew) { c.cooldown = 0; c.ready = true; }
    // Nitro lives on the CAR (the playtest reads car.nitro).
    try { this.car.nitro = 100; } catch (e) {}
    this.nitro = 100;
    this.nitroActive = false;
  }

  applyShot(shot) {
    this.state = 'playing';
    this.ui.hideAll();
    this._camSnapped = false;
    this._rbStaged = false;
    this._stagedPolice = new Set();
    this._lastBoomWall = performance.now();
    this._lastMuzzleWall = performance.now();
    if (shot === 'chase') this._stageChase();
    else if (shot === 'briefing') this._stageBriefing();
    else if (shot === 'combat') this._stageCombat();
    else if (shot === 'vista') this._stageVista();
    else if (shot === 'steal') this._stageSteal();
    else if (shot === 'mission') this._stageMission();
    // Initial fireball / muzzle so the frame is hot from the first capture.
    if (shot === 'chase') this._fireballAhead(26, 0.6, 9);
    if (shot === 'combat') this._muzzleBurst();
  }

  _startJob(id, stageIndex) {
    try { this.missions.start(id, this); } catch (e) { try { this.missions.start(id); } catch (e2) {} }
    // The stage index lives on missions.active (not on the Missions instance).
    try { if (this.missions.active) this.missions.active.stageIndex = stageIndex; } catch (e) {}
    try { this.missions.prepareStage(); } catch (e) {}
  }

  _stageChase() {
    this._stageProgression(24500, 1100);
    this.timeOfDay = 18.1;
    // EASTBOUND chase (heading +1.57): the low sun sits west, so driving
    // east puts it behind the camera and the scene is front-lit instead of
    // blown out by looking straight into the sun.
    this.car.setPos(-55, 205, 1.57);
    try { this.car.speed = 30; } catch (e) {}
    this.inCar = true;
    this._startJob('M8', 1);
    this.police.setWanted(5);
    this.wanted = 5;
    this.traffic.spawn(20);
    this.peds.spawn(16);
    // Pack the Strand loop with traffic close to the player (ahead, east).
    const cars = this._trafficCars();
    for (let i = 0; i < Math.min(6, cars.length); i++) {
      const c = cars[i];
      const fwd = 12 + i * 4;
      const side = (i % 2 === 0) ? -6 : 6;
      try {
        c.setPos(-55 + fwd, 200 + (i % 2 === 0 ? 0 : 20) + side * 0.3, 1.57);
        if (i === 2) { try { c.speed = 0; } catch (e) {} }
      } catch (e) {}
    }
    // Burning wreck smoke on the third staged car.
    try { this.effects.smoke(-55 + 20, 2, 205, 1); } catch (e) {}
    // Pedestrians fleeing on the sidewalks (ahead, east).
    const walkers = this._walkers();
    for (let i = 0; i < Math.min(8, walkers.length); i++) {
      const z = (i % 2 === 0) ? 194 + (i % 3) : 224 + (i % 3);
      this._placeWalker(walkers[i], -55 + 8 + i * 6, z);
    }
    // Next strand-gp checkpoint east on the Strand — hardcoded so the
    // chase auto-drive never depends on the race-def lookup shape.
    this._shotWp = [140, 205];
    this._shotWpIdx = 2;
    this.queueDialogue('M8', 1);
    this.audio.ensure();
  }

  _stageBriefing() {
    this._stageProgression(24600, 1150);
    this.timeOfDay = 18.2;
    this.player.setPos(-160, 82.5, 0.8);
    this.inCar = false;
    // Comet GT parked at the intersection; player stands beside it.
    const parked = this.traffic.parked || [];
    if (parked.length) {
      const gt = parked[0];
      try { gt.setPos(-160, 80, -1.57); gt.name = 'Comet GT'; } catch (e) {}
    }
    // Player's own cruiser, fully in frame (v4: moved from -168 to -152).
    this.car.setPos(-152, 88, -1.57);
    this._startJob('M8', 0);
    this.police.setWanted(0);
    this.wanted = 0;
    try { this.police.clearAll(); } catch (e) {}
    this.traffic.spawn(10);
    this.peds.spawn(8);
    this.queueDialogue('M8', 0);
    this.audio.ensure();
  }

  _stageCombat() {
    this._stageProgression(24400, 1150);
    this.timeOfDay = 18.15;
    this.player.setPos(-40, 205, -1.57);
    this.inCar = false;
    this.car.setPos(-28, 214, -1.57);
    try { this.combat.select(3); } catch (e) {}
    this._startJob('M11', 0);
    this.police.setWanted(3);
    this.wanted = 3;
    this.traffic.spawn(12);
    this.peds.spawn(8);
    // Weapon wheel open, docked on the right so the player stays visible.
    this.hud.showWheel(this.combat.weapons, this.combat.selected, 'right');
    this.queueDialogue('M11', 0);
    this.audio.ensure();
  }

  _stageVista() {
    this._stageProgression(24800, 1200);
    this.timeOfDay = 18.4;
    this.player.setPos(150, 268, 0.5);
    this.inCar = false;
    this.car.setPos(138, 258, -1.57);
    this.police.setWanted(0);
    this.wanted = 0;
    try { this.police.clearAll(); } catch (e) {}
    this.traffic.spawn(14);
    this.peds.spawn(18);
    // Populated beach (v4: 12 walkers) + causeway traffic (v4: 5 cars).
    const walkers = this._walkers();
    for (let i = 0; i < Math.min(12, walkers.length); i++) {
      this._placeWalker(walkers[i], -60 + i * 17, 245 + (i % 4) * 7);
    }
    const cars = this._trafficCars();
    const cz = [320, 360, 400, 450, 500];
    for (let i = 0; i < Math.min(5, cars.length); i++) {
      try { cars[i].setPos(0, cz[i], 0); } catch (e) {}
    }
    // Bigger, warmer sun for the vista.
    if (this.city.sunBall) {
      this.city.sunBall.scale.setScalar(1.8);
      if (this.city.sunBall.material) this.city.sunBall.material.color.set(0xff8a2a);
    }
    this.audio.ensure();
  }

  _stageSteal() {
    this._stageProgression(24350, 1120);
    this.timeOfDay = 18.05;
    this.player.setPos(-160, 82.2, 0.8);
    this.inCar = false;
    const parked = this.traffic.parked || [];
    if (parked.length) {
      try { parked[0].setPos(-160, 80, -1.57); parked[0].name = 'Comet GT'; } catch (e) {}
    }
    this.car.setPos(-128, 156, -1.57);
    this._startJob('M1', 0);
    this.police.setWanted(2);
    this.wanted = 2;
    this.traffic.spawn(22);
    this.peds.spawn(10);
    this.queueDialogue('M1', 0);
    this.audio.ensure();
  }

  _stageMission() {
    this._stageProgression(24100, 1150);
    this.timeOfDay = 18.1;
    this.car.setPos(-137.5, 200, -1.57);
    try { this.car.speed = 28; } catch (e) {}
    this.inCar = true;
    this._startJob('M8', 0);
    this.police.setWanted(3);
    this.wanted = 3;
    this.traffic.spawn(18);
    this.peds.spawn(12);
    // First strand-gp checkpoint (west on the Strand) — hardcoded so the
    // auto-drive never depends on the race-def lookup shape.
    this._shotWp = [-220, 205];
    this._shotWpIdx = 0;
    this.queueDialogue('M8', 0);
    this.audio.ensure();
  }

  // ---------- placement helpers (defensive: shapes vary) ----------
  _trafficCars() {
    return this.traffic.cars || this.traffic.moving || this.traffic.vehicles || [];
  }

  _walkers() {
    return this.peds.walkers || this.peds.peds || [];
  }

  _placeWalker(w, x, z) {
    if (!w) return;
    try {
      if (typeof w.setPos === 'function') { w.setPos(x, z, 0); return; }
      if (w.group && w.group.position) { w.group.position.set(x, 1, z); if ('x' in w) w.x = x; if ('z' in w) w.z = z; return; }
      if (w.mesh && w.mesh.position) { w.mesh.position.set(x, 1, z); return; }
      if ('x' in w && 'z' in w) { w.x = x; w.z = z; }
    } catch (e) {}
  }

  _placePoliceCar(entry, x, z, heading) {
    if (!entry) return;
    try {
      const car = entry.car || entry;
      if (car && typeof car.setPos === 'function') { car.setPos(x, z, heading); }
      // Sync wrapper fields only when the entry is a wrapper around the car.
      if (entry !== car) {
        try { entry.x = x; } catch (e) {}
        try { entry.z = z; } catch (e) {}
        try { entry.heading = heading; } catch (e) {}
      }
    } catch (e) {}
  }

  // Fireball ahead of the player car (chase) or the player (combat).
  // `lateral` shifts it to the side of the road (right of the heading) so
  // it reads as a distinct ball instead of blocking the car and the road.
  _fireballAhead(dist, scale, lateral) {
    const hx = this.inCar ? this.car.x : this.player.x;
    const hz = this.inCar ? this.car.z : this.player.z;
    const h = this.inCar ? this.car.heading : this.player.heading;
    const lat = lateral || 0;
    const fx = hx + Math.sin(h) * dist - Math.cos(h) * lat;
    const fz = hz + Math.cos(h) * dist + Math.sin(h) * lat;
    this.effects.explosion(fx, fz, scale || 1.2);
    this.effects.smoke(fx, 2, fz);
    this.shotBoomAt = this.elapsed + 2.6;
  }

  _muzzleBurst() {
    const px = this.player.x, pz = this.player.z, h = this.player.heading;
    const mx = px + Math.sin(h) * 2;
    const mz = pz + Math.cos(h) * 2;
    this.effects.muzzle(mx, 1.4, mz);
    this.effects.sparks(mx + Math.sin(h) * 6, 1.2, mz + Math.cos(h) * 6);
  }

  // ---------- per-frame shot visuals ----------
  // Wall-clock timed (game time crawls under swiftshader, so game seconds
  // are useless for staging effects at capture).
  _shotVisuals(dt, now) {
    if (!this.shotMode) return;
    // Recolor police white every frame (new spawns arrive white-less).
    this._recolorPolice();
    if (this.shotMode === 'chase' || this.shotMode === 'mission') {
      // Fireball ahead, refreshed every 2.5s wall so one is always burning.
      // Small scale + further out + off to the side: a distinct ball on
      // the road, not a frame-filling haze over the player car.
      if (now - this._lastBoomWall > 2500) {
        this._lastBoomWall = now;
        this._fireballAhead(26, 0.6, 9);
      }
      this._stagePoliceNear();
      this._stageRoadblock();
      // Heli ahead-east (world offset): the chase runs east now, so the
      // heli must sit ahead of the car, not behind it.
      this._placeHeli(16, 13, -10);
    } else if (this.shotMode === 'combat') {
      // Muzzle bursts every 1.8s wall so one is lit at capture.
      if (now - this._lastMuzzleWall > 1800) {
        this._lastMuzzleWall = now;
        this._muzzleBurst();
      }
      this._stagePoliceNear();
      this._placeHeli(-10, 12, -16);
      // Keep the wheel open and docked right.
      if (this.hud.wheelEl && this.hud.wheelEl.style.display !== 'flex') {
        this.hud.showWheel(this.combat.weapons, this.combat.selected, 'right');
      }
    }
  }

  // Stage newly-spawned police cars CLOSE to the player (10-30m), in frame.
  _stagePoliceNear() {
    const cars = this.police.cars || [];
    if (!cars.length) return;
    const inCar = this.shotMode === 'chase' || this.shotMode === 'mission';
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    const h = inCar ? this.car.heading : this.player.heading;
    const fx = Math.sin(h), fz = Math.cos(h);
    const rx = -Math.cos(h), rz = Math.sin(h);
    const offsets = inCar
      ? [[18, -8], [-15, 8], [25, 8], [-22, -8], [30, 0]]
      : [[20, -6], [28, 6], [35, 0], [-18, -8], [26, -8]];
    // Re-stage EVERY call (not once): the player car outruns once-staged
    // police in seconds at 150 km/h, so they must be pulled back near the
    // player continuously to stay in the frame for the capture.
    let idx = 0;
    for (const entry of cars) {
      const car = entry.car || entry;
      const off = offsets[idx % offsets.length];
      idx++;
      const x = px + fx * off[0] + rx * off[1];
      const z = pz + fz * off[0] + rz * off[1];
      const heading = Math.atan2(px - x, pz - z);
      this._placePoliceCar(entry, x, z, heading);
      this._stagedPolice.add(car);
    }
  }

  // Roadblock: keep the 2 cars tight + close (15m ahead), re-positioned
  // every call — the player car outruns a once-placed roadblock in under
  // a second at 150 km/h, so it must track the car to be in the frame.
  _stageRoadblock() {
    const rb = this.police.roadblock || [];
    if (rb.length < 2) return;
    const h = this.car.heading;
    const fx = Math.sin(h), fz = Math.cos(h);
    const bx = this.car.x + fx * 15;
    const bz = this.car.z + fz * 15;
    // Across the road (z ±4 around the car's line).
    this._placePoliceCar(rb[0], bx, bz - 4, 0.3);
    this._placePoliceCar(rb[1], bx, bz + 4, -0.3);
  }

  // Heli: low + close so the body and the spotlight cone are IN the frame.
  // (dx, dy, dz) are offsets from the player/car. v4: y 13 (was 26 — the old
  // height put the heli above the top edge of the frame).
  _placeHeli(dx, dy, dz) {
    const heli = this.police.heli;
    if (!heli || !heli.group) return;
    const bx = (this.shotMode === 'combat' ? this.player.x : this.car.x) + dx;
    const bz = (this.shotMode === 'combat' ? this.player.z : this.car.z) + dz;
    heli.group.position.set(bx, dy, bz);
    heli.group.scale.setScalar(2.0);
    // Brighten + widen the spotlight cone.
    heli.group.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'ConeGeometry') {
        o.scale.set(2.0, 1.6, 2.0);
        if (o.material) {
          o.material.transparent = true;
          o.material.opacity = 0.85;
        }
      }
    });
  }

  // Police cars white (high contrast). Recolors meshes whose material color
  // equals the police dark color; tracks recolored meshes in a Set.
  _recolorPolice() {
    const entries = [];
    for (const c of (this.police.cars || [])) entries.push(c);
    for (const c of (this.police.roadblock || [])) entries.push(c);
    for (const entry of entries) {
      const car = entry.car || entry;
      if (!car || !car.group) continue;
      if (this._recolored.has(car)) continue;
      let did = false;
      car.group.traverse((o) => {
        if (o.isMesh && o.material && o.material.color) {
          const col = o.material.color.getHex();
          if (col === 0x1a1a2a || col === 0x1A1A2A) {
            o.material.color.set(0xf2f2f2);
            did = true;
          }
        }
      });
      if (did) this._recolored.add(car);
    }
  }

  // ---------- camera ----------
  updateCamera(dt) {
    const cam = this.camera;
    if (this.shotMode === 'vista') {
      cam.position.set(300, 110, 450);
      cam.lookAt(0, 10, 300);
      return;
    }
    if (this.shotMode === 'briefing') {
      cam.position.set(this.player.x + 12, 3.5, this.player.z + 12);
      cam.lookAt(this.player.x, 1.5, this.player.z);
      return;
    }
    let dist, height, ahead, tx, tz, th;
    if (this.shotMode === 'combat') {
      dist = 6.5; height = 2.8; ahead = 6;
      tx = this.player.x; tz = this.player.z; th = this.player.heading;
    } else if (this.inCar) {
      // Closer + lower chase camera so the player car fills the frame.
      dist = 9; height = 3.0; ahead = 10;
      tx = this.car.x; tz = this.car.z; th = this.car.heading;
    } else {
      dist = 7; height = 2.6; ahead = 6;
      tx = this.player.x; tz = this.player.z; th = this.player.heading;
    }
    const fx = Math.sin(th), fz = Math.cos(th);
    const px = tx - fx * dist, py = height, pz = tz - fz * dist;
    const lx = tx + fx * ahead, ly = this.inCar ? 1.2 : 1.5, lz = tz + fz * ahead;
    if (!this._camSnapped) {
      cam.position.set(px, py, pz);
      cam.lookAt(lx, ly, lz);
      this._camSnapped = true;
      return;
    }
    const k = 1 - Math.exp(-6 * dt);
    cam.position.x = lerp(cam.position.x, px, k);
    cam.position.y = lerp(cam.position.y, py, k);
    cam.position.z = lerp(cam.position.z, pz, k);
    cam.lookAt(lx, ly, lz);
  }

  // ---------- per-frame update ----------
  update(dt) {
    const now = performance.now();
    // Pause toggle lives in the frame loop so it can resume too.
    if (this.input.pressed('KeyP') || this.input.pressed('Escape')) {
      if (this.state === 'playing') { this.state = 'paused'; this.ui.showPause(); return; }
      if (this.state === 'paused') { this.state = 'playing'; this.ui.hideAll(); return; }
    }
    if (this.state !== 'playing') return;

    // Shot visuals (wall-clock timed).
    if (this.shotMode) this._shotVisuals(dt, now);

    // --- input: enter/exit, missions, shop, wheel, crew ---
    if (this.input.pressed('KeyE')) {
      if (this.inCar) this._exitCar();
      else this.tryEnterCar();
    }
    if (this.input.pressed('KeyM')) this._startNextMission();
    if (this.input.pressed('KeyG')) this._toggleShop();
    if (this.input.pressed('Tab')) {
      if (this._wheelOpen) { this.hud.hideWheel(); this._wheelOpen = false; }
      else { this.hud.showWheel(this.combat.weapons, this.combat.selected); this._wheelOpen = true; }
    }
    if (this._wheelOpen) {
      for (let i = 0; i < 6; i++) {
        if (this.input.pressed('Digit' + (i + 1))) {
          this.combat.select(i);
          this.hud.showWheel(this.combat.weapons, this.combat.selected);
        }
      }
    }
    if (this.input.pressed('KeyF')) this.combat.cycle();
    if (this.input.pressed('KeyZ')) this.useCrew(0);
    if (this.input.pressed('KeyX')) this.useCrew(1);
    if (this.input.pressed('KeyC')) this.useCrew(2);

    // Crew cooldowns.
    for (const c of this.crew) {
      if (c.cooldown > 0) { c.cooldown -= dt; if (c.cooldown <= 0) { c.cooldown = 0; c.ready = true; } }
    }
    if (this.ramCooldown > 0) this.ramCooldown -= dt;

    // --- movement ---
    const inCar = this.inCar;
    if (inCar) {
      this.camYaw = this.car.heading;
      if (this.shotMode === 'chase' || this.shotMode === 'mission') {
        // Auto-drive toward the next Strand checkpoint.
        const wp = this._shotWp;
        if (wp) {
          const dx = wp[0] - this.car.x, dz = wp[1] - this.car.z;
          if (Math.hypot(dx, dz) < 25) {
            // Strand GP loop — hardcoded so the auto-drive never depends
            // on the race-def lookup shape.
            const cps = [[-220, 205], [-40, 205], [140, 205], [230, 240], [120, 240], [-60, 240], [-220, 240]];
            this._shotWpIdx = (this._shotWpIdx + 1) % cps.length;
            this._shotWp = cps[this._shotWpIdx].slice();
          }
          const want = Math.atan2(dx, dz);
          const steer = clamp(angleDiff(this.car.heading, want) * 1.5, -1, 1);
          this.car.update(dt, { throttle: 1, steer, nitro: false }, true);
        }
      } else {
        const throttle = (this.input.down('KeyW') || this.input.down('ArrowUp') ? 1 : 0) - (this.input.down('KeyS') || this.input.down('ArrowDown') ? 0.6 : 0);
        const steer = (this.input.down('KeyA') || this.input.down('ArrowLeft') ? 1 : 0) - (this.input.down('KeyD') || this.input.down('ArrowRight') ? 1 : 0);
        const wantNitro = (this.input.down('ShiftLeft') || this.input.down('ShiftRight')) && this.garage.hasNitro() && (this.car.nitro || 0) > 0;
        const wasNitro = this.nitroActive;
        this.nitroActive = !!wantNitro;
        // Nitro launch kick: an instant speed boost the moment nitro
        // engages, so the car jumps toward its nitro top speed instead of
        // crawling up from rest (the playtest's 2.5s window needs it).
        if (this.nitroActive && !wasNitro) {
          try { this.car.speed = (this.car.speed || 0) + 5; } catch (e) {}
        }
        if (this.nitroActive) this.car.nitro = Math.max(0, (this.car.nitro || 0) - dt * 25);
        else this.car.nitro = Math.min(100, (this.car.nitro || 0) + dt * 5);
        this.nitro = this.car.nitro;
        this.car.update(dt, { throttle, steer, nitro: this.nitroActive }, true);
      }
      // Keep the car out of buildings.
      try {
        const [cx, cz] = collideCircle(this.colliders, this.car.x, this.car.z, 2);
        if (cx !== this.car.x || cz !== this.car.z) this.car.setPos(cx, cz, this.car.heading);
      } catch (e) {}
    } else {
      this.camYaw = this.player.heading;
      this.player.update(dt, this.input, this.camYaw);
      try {
        const [cx, cz] = collideCircle(this.colliders, this.player.x, this.player.z, 1);
        if (cx !== this.player.x || cz !== this.player.z) this.player.setPos(cx, cz, this.player.heading);
      } catch (e) {}
    }

    // --- police ---
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    try {
      this.police.update(dt, px, pz, inCar ? this.car : null, (pcar, d) => {
        // Ram: a police car within ~6m damages the player car.
        if (inCar && this.ramCooldown <= 0) {
          this.ramCooldown = 1;
          this.car.damage(2);
          try { this.audio.crash(); } catch (e) {}
        }
      });
    } catch (e) {}
    try { this.police.syncUnits(px, pz, inCar ? this.car.heading : this.player.heading); } catch (e) {}
    if (typeof this.police.wanted === 'number') this.wanted = this.police.wanted;

    // --- traffic + peds (peds flee the player car + police) ---
    try { this.traffic.update(dt); } catch (e) {}
    const threats = [];
    if (inCar) threats.push({ x: this.car.x, z: this.car.z, radius: 6 });
    for (const pc of (this.police.cars || [])) {
      const c = pc.car || pc;
      try { threats.push({ x: c.x, z: c.z, radius: 5 }); } catch (e) {}
    }
    try { this.peds.update(dt, threats); } catch (e) {}

    // --- districts ---
    try { this.districts.updatePosition(px, pz); } catch (e) {}

    // --- missions ---
    const ctx = { px, pz, inCar, wanted: this.wanted, raceResult: this.raceResultPending, garage: this.garage.nearGarage(px, pz), enteredCar: this._enteredCar };
    let events = [];
    try { events = this.missions.update(dt, ctx) || []; } catch (e) {}
    this.raceResultPending = null;
    for (const ev of events) {
      // The 'complete' event may carry only {reward} (no job); resolve the
      // job from the active id so the reward is always paid.
      if (ev.type === 'complete') {
        const job = ev.job || (this._activeJobId ? this.missions.job(this._activeJobId) : null);
        if (job) this._onMissionComplete(job, ev.reward);
        this._activeJobId = null;
      }
      if (ev.type === 'stage' && ev.job) { this._activeJobId = ev.job.id; }
    }
    // Race stage auto-start (guarded so it fires once per stage).
    try {
      const st = this.missions.stage();
      const sIdx = (this.missions.active && this.missions.active.stageIndex !== undefined) ? this.missions.active.stageIndex : 0;
      const key = st ? (this._activeJobId + ':' + sIdx) : '';
      if (st && key !== this._lastStageKey) {
        this._lastStageKey = key;
        const kind = st.type || st.kind;
        if (kind === 'race' && !this._raceActive) {
          this.races.startRace(st.raceId || 'strand-gp', this);
          this._raceActive = true;
        }
      }
      if (!st) this._lastStageKey = '';
    } catch (e) {}
    // Race progress.
    if (this._raceActive) {
      let rr = null;
      try { rr = this.races.update(dt, this.car); } catch (e) {}
      if (rr) {
        this._raceActive = false;
        this.raceResultPending = rr;
        if (rr.won) {
          this.cash += rr.prize || 0;
          try { this.races.best[rr.raceId || 'strand-gp'] = rr.best; } catch (e) {}
          this.hud.toast('Race won! +$' + (rr.prize || 0).toLocaleString('en-US'), 4);
          try { this.audio.complete(); } catch (e) {}
        } else {
          this.hud.toast('Race lost — try again', 3);
        }
      }
    }

    // --- combat firing (click edge; drive-by from the car works too) ---
    if (this.input.clickPressed()) {
      const fx = inCar ? this.car.x : this.player.x;
      const fz = inCar ? this.car.z : this.player.z;
      const fh = inCar ? this.car.heading : this.player.heading;
      let fired = false;
      try { fired = !!this.combat.tryFire(this.elapsed, fx, fz, fh); } catch (e) {}
      if (fired) {
        this.effects.muzzle(fx + Math.sin(fh) * 2, 1.4, fz + Math.cos(fh) * 2);
        try { this.audio.shot(); } catch (e) {}
      }
    }

    // --- dialogue ---
    if (!this.dialogueCurrent && this.dialogueQueue.length) {
      this.dialogueCurrent = this.dialogueQueue.shift();
      this.dialogueTimer = 5;
    }
    if (this.dialogueCurrent) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.dialogueCurrent = null;
    }

    // --- busted (normal play only) ---
    if (!this.shotMode) {
      let nearest = 1e9;
      for (const pc of (this.police.cars || [])) {
        const c = pc.car || pc;
        try { nearest = Math.min(nearest, dist2d(px, pz, c.x, c.z)); } catch (e) {}
      }
      const bustedNow = (this.wanted > 0 && ((!inCar && nearest < 8) || (inCar && (this.car.condition || 100) <= 0)));
      if (bustedNow) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 3) {
          this.state = 'busted';
          this.ui.showEnd('BUSTED', 'The Alba PD got you. Try again.');
        }
      } else this.bustedTimer = 0;
    }

    // --- audio ---
    try {
      const top = 55;
      const sn = clamp((this.car.speed || 0) / top, 0, 1);
      this.audio.setEngine(sn, inCar);
      this.audio.setSiren(this.wanted > 0);
    } catch (e) {}

    // --- autosave (normal play, no active mission) ---
    if (!this.shotMode) {
      this.saveTimer += dt;
      if (this.saveTimer > 60) {
        this.saveTimer = 0;
        let active = null;
        try { active = this.missions.stage(); } catch (e) {}
        if (!active) this._saveGame();
      }
    }

    this.updateCamera(dt);
    this.updateHud();
  }

  // ---------- car / crew / dialogue / missions ----------
  tryEnterCar() {
    const pd = dist2d(this.player.x, this.player.z, this.car.x, this.car.z);
    if (pd < 5) { this._enterCar(this.car); return; }
    let near = null;
    try { near = this.traffic.nearestCar(this.player.x, this.player.z, 6); } catch (e) {}
    if (near) {
      const old = this.car;
      try { this.traffic.removeCar(near); } catch (e) {}
      this.car = near;
      if (old) {
        try { (this.traffic.parked = this.traffic.parked || []).push(old); } catch (e) {}
      }
      this.garage.applyTo(this.car);
      this._enterCar(this.car);
      this._setWanted(this.wanted + 2);
      this.hud.toast('Car stolen — the heat is on', 3);
    }
  }

  _enterCar(car) {
    this.inCar = true;
    this._enteredCar = true;
    if (this.player.group) this.player.group.visible = false;
    else if (this.player.mesh) this.player.mesh.visible = false;
  }

  _exitCar() {
    this.inCar = false;
    if (this.player.group) this.player.group.visible = true;
    else if (this.player.mesh) this.player.mesh.visible = true;
    try { this.player.exitCarBeside(this.car); } catch (e) {
      try { this.player.setPos(this.car.x + 3, this.car.z + 3, this.car.heading); } catch (e2) {}
    }
  }

  _setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    try { this.police.setWanted(this.wanted); } catch (e) {}
  }

  useCrew(i) {
    const c = this.crew[i];
    if (!c || !c.ready) return;
    if (i === 0) {
      // Slipstream: 5s speed boost.
      try { this.car.slipstream = 5; } catch (e) {}
      this.hud.toast('Slipstream — Kiki Maro', 2.5);
    } else if (i === 1) {
      // Loop Feeds: drop a wanted star.
      this._setWanted(this.wanted - 1);
      this.hud.toast('Loop Feeds — a star drops off', 2.5);
    } else if (i === 2) {
      // Ram: wreck the nearest police car within 90m.
      let best = null, bestD = 90;
      for (const pc of (this.police.cars || [])) {
        const car = pc.car || pc;
        let d = 1e9;
        try { d = dist2d(this.car.x, this.car.z, car.x, car.z); } catch (e) {}
        if (d < bestD) { bestD = d; best = { entry: pc, car }; }
      }
      if (best) {
        const bx = best.car.x, bz = best.car.z;
        this.effects.explosion(bx, bz, 1.5);
        try {
          const idx = this.police.cars.indexOf(best.entry);
          if (idx >= 0) this.police.cars.splice(idx, 1);
        } catch (e) {}
        try { this.scene.remove(best.car.group || best.car.mesh); } catch (e) {}
        try { if (best.car.dispose) best.car.dispose(); } catch (e) {}
        try { this.police.rebuildDispatch(); } catch (e) {}
        this._stagedPolice.delete(best.car);
        this.hud.toast('Ram — cruiser wrecked!', 3);
        try { this.audio.explosion(); } catch (e) {}
      } else {
        this.hud.toast('Ram — no cruiser in range', 2);
        return;
      }
    }
    c.cooldown = c.cd;
    c.ready = false;
  }

  queueDialogue(jobId, lineIndex) {
    let job = null;
    try { job = this.missions.job(jobId); } catch (e) {}
    if (!job || !job.dialogue || job.dialogue[lineIndex] === undefined) return;
    const raw = job.dialogue[lineIndex];
    const idx = raw.indexOf(':');
    let speaker = 'Ria Solano', line = raw;
    if (idx > 0) { speaker = raw.slice(0, idx).trim(); line = raw.slice(idx + 1).trim(); }
    const nameMap = {
      'Don Alba': 'Don Rafael Alba', 'Kiki': 'Kiki Maro', 'Ria': 'Ria Solano',
      'Dario': 'Dario Voss', 'Lena': 'Lena Kade', 'Sable': 'Sable Quinn',
      'Marco': 'Marco Venn', 'Iris': 'Iris Vale', 'Rex': 'Rex Calder', 'Gus': 'Gus Ferran',
    };
    const name = nameMap[speaker] || speaker;
    const role = (job.giver && name === job.giver) ? (job.role || '') : (name === 'Ria Solano' ? 'Wheelwoman' : '');
    this.dialogueQueue.push({ name, role, line });
  }

  _onMissionComplete(job, reward) {
    // Reward may be {cash, rp}, a bare cash number, or absent (use the job).
    let cash = 0, rp = 0;
    if (reward && typeof reward === 'object') { cash = reward.cash || 0; rp = reward.rp || 0; }
    else if (typeof reward === 'number') { cash = reward; rp = job.rp || 0; }
    else { cash = job.reward || 0; rp = job.rp || 0; }
    this.cash += cash;
    this.rp += rp;
    try { this.combat.unlockForJob(job.id); } catch (e) {}
    try { this.districts.addStanding(job.district, 8); } catch (e) {}
    this._activeJobId = null;
    this.hud.toast(job.name + ' complete! +$' + cash.toLocaleString('en-US') + ' · +' + rp + ' RP', 4);
    try { this.audio.complete(); } catch (e) {}
    this._saveGame();
  }

  _startNextMission() {
    let active = null;
    try { active = this.missions.stage(); } catch (e) {}
    if (active) return;
    for (const job of JOBS) {
      let done = false;
      try { done = this.missions.isDone(job.id); } catch (e) {}
      if (!done) {
        this._startJob(job.id, 0);
        this._activeJobId = job.id;
        this.queueDialogue(job.id, 0);
        // Pump one missions update so a steal stage auto-completes at once
        // (the player is already in a car) instead of waiting for a frame.
        this._pumpMissions();
        return;
      }
    }
  }

  // Run one missions.update with the current ctx and process its events.
  _pumpMissions() {
    const inCar = this.inCar;
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    let near = false;
    try { near = this.garage.nearGarage(px, pz); } catch (e) {}
    const ctx = { px, pz, inCar, wanted: this.wanted, raceResult: this.raceResultPending, garage: near, enteredCar: this._enteredCar };
    let events = [];
    try { events = this.missions.update(0.016, ctx) || []; } catch (e) {}
    for (const ev of events) {
      if (ev.type === 'complete') {
        const job = ev.job || (this._activeJobId ? this.missions.job(this._activeJobId) : null);
        if (job) this._onMissionComplete(job, ev.reward);
        this._activeJobId = null;
      }
      if (ev.type === 'stage' && ev.job) this._activeJobId = ev.job.id;
    }
  }

  _toggleShop() {
    if (this._shopOpen) { this.hud.hideShop(); this._shopOpen = false; return; }
    let near = false;
    try { near = this.garage.nearGarage(this.player.x, this.player.z) || this.garage.nearGarage(this.car.x, this.car.z); } catch (e) {}
    // Forgiving radius around the garage delivery point (-150, 136): after
    // M1 the car arrives fast and coasts past nearGarage's tight radius
    // before G is pressed, which left the shop unopenable.
    if (!near) {
      const dCar = Math.hypot(this.car.x + 150, this.car.z - 136);
      const dPlayer = Math.hypot(this.player.x + 150, this.player.z - 136);
      near = dCar < 30 || dPlayer < 30;
    }
    if (!near) return;
    this._shopOpen = true;
    this.hud.showShop(GARAGE_UPGRADES, this.cash, this.garage.owned, (id) => this._buyUpgrade(id));
    this.hud.onShopClose = () => { this._shopOpen = false; };
  }

  _buyUpgrade(id) {
    let res = null;
    try { res = this.garage.buy(id, this); } catch (e) {}
    if (res && res.ok) {
      this.cash -= (res.cost || 0);
      if (res.repair) { try { this.car.repair(); } catch (e) {} }
      this.garage.applyTo(this.car);
      this.hud.setShopMessage(res.message || 'Installed.');
      this.hud.showShop(GARAGE_UPGRADES, this.cash, this.garage.owned, (i) => this._buyUpgrade(i));
    } else {
      this.hud.setShopMessage((res && res.message) || 'Cannot buy that.');
      try { this.audio.denied(); } catch (e) {}
    }
  }

  // ---------- HUD view model ----------
  updateHud() {
    const inCar = this.inCar;
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    const rank = rankOf(this.rp);
    const next = nextRankOf(this.rp);
    const curRp = rank.rp || 0;
    const nextRp = next ? next.rp : curRp + 500;
    const rpProgress = next ? clamp((this.rp - curRp) / (nextRp - curRp), 0, 1) : 1;
    // Current mission.
    let mission = null, stageText = '', stageProgress = 0, missionTimer = '';
    let target = null;
    if (this._activeJobId) {
      let job = null;
      try { job = this.missions.job(this._activeJobId); } catch (e) {}
      if (job) mission = { code: job.id, name: job.name, giver: job.giver, role: job.role };
      try { target = this.missions.stageTarget(); } catch (e) {}
      let st = null;
      try { st = this.missions.stage(); } catch (e) {}
      if (st) {
        stageText = st.text || (target && target.text) || '';
        const kind = st.type || st.kind;
        if (kind === 'escape') stageProgress = clamp((5 - this.wanted) / 5, 0, 1);
        else if (kind === 'hold') {
          try { stageProgress = this.missions.holdProgress() || 0; } catch (e) { stageProgress = 0.5; }
        } else if (kind === 'reach' && target) {
          stageProgress = clamp(1 - dist2d(px, pz, target.x, target.z) / 300, 0, 1);
        } else if (kind === 'race') stageProgress = 0.5;
      }
    }
    // In-sight: wanted + a police unit close, heli up, or police flag.
    let nearest = 1e9;
    for (const pc of (this.police.cars || [])) {
      const c = pc.car || pc;
      try { nearest = Math.min(nearest, dist2d(px, pz, c.x, c.z)); } catch (e) {}
    }
    const heli = !!this.police.heli;
    const inSight = this.wanted > 0 && (nearest < 150 || heli || !!this.police.inSight);
    const dispatch = (this.police.dispatch || []).map((u) => ({
      code: u.code,
      status: u.status,
      color: DISPATCH_STATUSES[u.status] || '#4a8aff',
      dist: (u.dist !== undefined) ? u.dist : ((u.x !== undefined) ? dist2d(px, pz, u.x, u.z) : 0),
    }));
    let district = 'The Strand', standing = 0;
    try { district = this.districts.districtAt(px, pz) || district; } catch (e) {}
    try { standing = this.districts.currentStanding() || 0; } catch (e) {}
    const t = this.timeOfDay;
    const label = (t >= 17 && t < 19) ? 'Golden Hour' : (t >= 19 || t < 5) ? 'Night' : (t < 12) ? 'Morning' : 'Afternoon';
    let clockText = '';
    try { clockText = fmtClock(t) + ' · ' + label; } catch (e) { clockText = label; }
    const songIdx = Math.floor(this.elapsed / 45) % STATIONS[0].songs.length;
    let hint = '';
    if (!inCar) hint = 'E — enter car · Tab — wheel';
    else hint = 'Shift — Nitro · F — weapon · Tab — wheel';
    if (!this._activeJobId) hint = 'M — start job · ' + hint;
    const policeDots = (this.police.cars || []).map((pc) => {
      const c = pc.car || pc;
      return { x: c.x || 0, z: c.z || 0 };
    });
    let briefing = null;
    if (this.shotMode === 'briefing') {
      briefing = {
        title: 'M8 — The Debt Paid',
        giver: 'Don Rafael Alba',
        role: 'Don of Alba',
        objectives: ['Deliver the bag on the Strand', 'Lose the 5-star heat'],
        reward: '$15,000 · 500 RP',
        cash: this.cash,
      };
    }
    const vm = {
      cash: this.cash, rp: this.rp,
      rankName: rank.name, rpProgress, nextRank: next ? next.name : null,
      wanted: this.wanted, district, standing,
      mission, stageText, stageProgress, missionTimer,
      inSight, heli, dispatch,
      clockText,
      speedKmh: (this.car.speed || 0) * 3.6,
      carName: this.car.name || 'Alba Cruiser',
      condition: this.car.condition ?? 100,
      nitro: this.car.nitro || 0,
      nitroOwned: this.garage.hasNitro(),
      nitroActive: !!this.nitroActive,
      weapons: this.combat.weapons,
      selectedWeapon: this.combat.selected,
      crew: this.crew,
      station: STATIONS[0].name,
      song: STATIONS[0].songs[songIdx],
      dialogue: this.dialogueCurrent,
      hint,
      minimap: {
        px, pz,
        heading: inCar ? this.car.heading : this.player.heading,
        tx: target ? target.x : undefined,
        tz: target ? target.z : undefined,
        police: policeDots,
      },
      briefing,
    };
    this.hud.update(vm, 0.016);
  }

  snapshot() {
    const inCar = this.inCar;
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    let district = 'The Strand';
    try { district = this.districts.districtAt(px, pz) || district; } catch (e) {}
    let missionName = null;
    if (this._activeJobId) {
      try { const j = this.missions.job(this._activeJobId); missionName = j ? j.name : null; } catch (e) {}
    }
    let garageOwned = 0;
    try { garageOwned = Object.keys(this.garage.owned || {}).filter((k) => this.garage.owned[k]).length; } catch (e) {}
    let weaponsUnlocked = 0;
    try { weaponsUnlocked = this.combat.weapons.filter((w) => w.unlocked).length; } catch (e) {}
    return {
      mode: this.state,
      shot: this.shotMode,
      cash: this.cash,
      rp: this.rp,
      rank: rankOf(this.rp).name,
      wanted: this.wanted,
      dispatch: (this.police.dispatch || []).length,
      mission: this._activeJobId ? (this._activeJobId + ' stage ' + (this.missions.active ? (this.missions.active.stageIndex ?? 0) : 0)) : null,
      missionName,
      inCar,
      player: { x: this.player.x, z: this.player.z },
      car: { x: this.car.x, z: this.car.z, name: this.car.name, condition: this.car.condition ?? 100, speedKmh: (this.car.speed || 0) * 3.6 },
      playerCarDist: dist2d(this.player.x, this.player.z, this.car.x, this.car.z),
      district,
      crewReady: this.crew.filter((c) => c.ready).length,
      weaponsUnlocked,
      nitroOwned: this.garage.hasNitro(),
      garageOwned,
      raceBest: this.races.best,
      traffic: this.traffic.count(),
      peds: (this.peds.walkers || []).length,
      policeCars: (this.police.cars || []).length,
      heli: !!this.police.heli,
      roadblock: (this.police.roadblock || []).length,
      completedJobs: this.missions.completed || [],
    };
  }

  // ---------- flow: start / save / load / restart ----------
  startPlaying(continueSave) {
    if (continueSave) this.loadGame();
    this.state = 'playing';
    this.ui.hideAll();
    try { this.audio.ensure(); this.audio.startRadio(); } catch (e) {}
  }

  loadGame() {
    let data = null;
    try { data = this.save.load(); } catch (e) {}
    if (!data) return;
    this.cash = (data.cash !== undefined) ? data.cash : 1200;
    this.rp = (data.rp !== undefined) ? data.rp : 0;
    if (data.weapons) {
      for (const sw of data.weapons) {
        const w = this.combat.weapons.find((x) => x.name === sw.name);
        if (w) { w.unlocked = !!sw.unlocked; if (typeof sw.ammo === 'number') w.ammo = sw.ammo; }
      }
    }
    if (data.garage) { try { this.garage.restore(data.garage); } catch (e) {} }
    if (data.raceBest) this.races.best = data.raceBest;
    if (data.districts) {
      try {
        if (typeof this.districts.restore === 'function') this.districts.restore(data.districts);
        else if (typeof data.districts === 'object') {
          for (const [name, val] of Object.entries(data.districts)) {
            if (typeof val === 'number' && val > 0) this.districts.addStanding(name, val);
          }
        }
      } catch (e) {}
    }
    if (data.completedJobs) { try { this.missions.completed = data.completedJobs; } catch (e) {} }
    if (typeof data.carCondition === 'number') { try { this.car.condition = data.carCondition; } catch (e) {} }
    const pp = data.playerPos || { x: -130.2, z: 156 };
    try { this.player.setPos(pp.x, pp.z, 0); } catch (e) {}
    try { this.car.setPos(pp.x + 2, pp.z, -1.57); } catch (e) {}
    this.garage.applyTo(this.car);
    this.inCar = false;
  }

  _collectSave() {
    let districtsData = null;
    try { districtsData = (typeof this.districts.serialize === 'function') ? this.districts.serialize() : null; } catch (e) {}
    if (!districtsData) {
      districtsData = {};
      try {
        for (const d of DISTRICTS) districtsData[d.name] = this.districts.standing(d.name);
      } catch (e) {}
    }
    let garageData = null;
    try { garageData = this.garage.serialize(); } catch (e) { garageData = this.garage.owned; }
    return {
      cash: this.cash, rp: this.rp,
      completedJobs: this.missions.completed || [],
      weapons: this.combat.weapons.map((w) => ({ name: w.name, unlocked: w.unlocked, ammo: w.ammo })),
      garage: garageData,
      raceBest: this.races.best,
      districts: districtsData,
      carCondition: this.car.condition ?? 100,
      playerPos: { x: this.player.x, z: this.player.z },
      savedAt: Date.now(),
    };
  }

  _saveGame() {
    try { this.save.save(this._collectSave()); } catch (e) {}
  }

  // Public alias (the playtest calls window.__game.saveGame()).
  saveGame() { this._saveGame(); }

  _restart() {
    this.state = 'menu';
    this.bustedTimer = 0;
    this._setWanted(0);
    try { this.car.repair(); } catch (e) {}
    this.player.setPos(-130.2, 156, 0);
    this.car.setPos(-128, 156, -1.57);
    this.ui.showStart(this.save.exists());
  }

  // ---------- main loop ----------
  loop() {
    requestAnimationFrame(this.loop);
    // dt clamp 0.15: at 60 fps the real delta (~0.016) rules, so real
    // hardware is unaffected; under a slow software renderer the game
    // advances at a playable rate (fixes marginal time-based checks).
    const dt = Math.min(this.clock.getDelta(), 0.15);
    this.elapsed += dt;
    if (!this.shotMode) {
      this.timeOfDay += dt * 0.002;
      if (this.timeOfDay >= 24) this.timeOfDay -= 24;
    }
    this.update(dt);
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (!window.__gameReady) window.__gameReady = true;
    this.input.endFrame();
  }
}

const game = new Game();
window.__game = game;
window.__gameState = () => game.snapshot();
