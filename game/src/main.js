// main.js — Puerto Alba: the Game class that wires every system together.
// Ria Solano owes Don Rafael Alba $40,000. On foot + by car, 12 story jobs,
// wanted 0-5 with police chases, helicopter + roadblocks, garage shop,
// street races, weapon wheel + nitro, crew abilities, districts + standing,
// save/reload, golden-hour coastal city. Keyboard + mouse.
//
// Staged screenshots (?shot=chase|briefing|combat|vista) re-stage the game at
// a rich late-game state: $24k+, Ghost of Alba, M8 with Don Rafael Alba.
// No personal data, no external references.

import { clamp, rand, dist2d, angleLerp, angleDiff, fmtCash, fmtClock, fmtTimeOfDay, fmtSpeedKmh } from './utils.js';
import { WORLD, buildCity, collideCircle } from './city.js';
import { Car } from './vehicle.js';
import { Police } from './police.js';
import { Hud } from './hud.js';
import { rankFor, JOBS, Missions } from './missions.js';
import { Combat } from './combat.js';
import { Districts } from './districts.js';
import { GARAGE_UPGRADES, Garage } from './garage.js';
import { Races } from './races.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { SaveSys } from './save.js';
import { Ui } from './ui.js';
import { Effects } from './effects.js';

const THREE = window.THREE;

// Crew: name, initials, color, ability, keybind, cooldown seconds.
const CREW_DEFS = [
  { name: 'Kiki Maro', initials: 'KM', color: '#2ad8c8', ability: 'Slipstream', key: 'Z', cooldown: 25 },
  { name: 'Lena Kade', initials: 'LK', color: '#ff4a6a', ability: 'Loop Feeds', key: 'X', cooldown: 30 },
  { name: 'Dario Voss', initials: 'DV', color: '#ff8a2a', ability: 'Ram', key: 'C', cooldown: 20 }
];

const START_CASH = 1200;

export class Game {
  constructor() {
    // ---- renderer / scene / camera ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 4, -12);
    this.clock = new THREE.Clock();
    this.camHeading = 0;

    // ---- city + brighter golden-hour grade ----
    this.city = buildCity(THREE, this.scene);
    this.colliders = this.city.colliders;
    // Vivid sunset sky, not washed-out orange.
    this.scene.background = new THREE.Color(0xff7a30);
    this.scene.fog = new THREE.Fog(0xff8a45, 260, 900);
    // Extra fill light from the east so eastbound driving is front-lit, plus
    // ambient lift so the scene reads bright and saturated.
    const fill = new THREE.DirectionalLight(0xffe0b0, 1.1);
    fill.position.set(200, 140, -120);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0xffc890, 0.4));
    this._buildSkyline();

    // ---- systems ----
    this.hud = new Hud();
    this.hud.build();
    this.ui = new Ui();
    this.input = new Input();
    this.audio = new AudioSys();
    this.save = new SaveSys();
    this.effects = new Effects(THREE, this.scene);
    this.traffic = new Traffic(THREE, this.scene, this.colliders);
    this.pedestrians = new Pedestrians(THREE, this.scene);
    this.police = new Police(THREE, this.scene, this.colliders);
    this.missions = new Missions(THREE, this.scene);
    this.combat = new Combat();
    this.districts = new Districts();
    this.garage = new Garage();
    this.races = new Races(THREE, this.scene);

    // ---- state ----
    this.cash = START_CASH;
    this.rp = 0;
    this.mode = 'menu'; // menu | playing | paused | ended
    this.timeOfDay = 18.1; // golden hour, 6:06 PM
    this.dialogue = null;
    this.dialogueT = 0;
    this.briefing = null;
    this.hint = '';
    this.crew = CREW_DEFS.map(c => Object.assign({}, c, { cooldown: 0, ready: true }));
    this.shopOpen = false;
    this.wheelOpen = false;
    this.enteredCar = null;
    this.ramCooldown = 0;
    this._recolored = new Set();
    this._lastRaceId = null;
    this._readySignalled = false;
    this.shotMode = false;
    this.shot = null;
    this.shotSeed = 7;
    this._nextBoom = 0;
    this._nextMuzzle = 0;
    this._stagedTraffic = [];
    this._stagedPolice = [];
    this._shotMission = undefined; // undefined = derive from missions; null = no mission card
    this._shotStageText = null;
    this._shotDialogue = undefined;
    this._vistaFlare = [];

    // ---- world population ----
    this.player = new Player(THREE, this.scene, 0, -6);
    this.player.heading = 0;
    this.player.group.rotation.y = 0;
    this.car = new Car(THREE, this.scene, {
      x: 0, z: 6, heading: 0, color: 0xff5a1a, name: 'Alba Cruiser', topSpeed: 34, isPlayer: true
    });
    this.traffic.spawn(14);
    this.pedestrians.spawn(18);

    // ---- UI wiring ----
    this.ui.onPlay = () => this._startFresh();
    this.ui.onContinue = () => this._startFromSave();
    this.ui.onResume = () => this._resume();
    this.ui.onRestart = () => this._startFromSaveOrFresh();
    this.hud.onShopClose = () => { this.shopOpen = false; };
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---- staged screenshot? ----
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seed = parseInt(params.get('seed') || '7', 10);
    if (shot) {
      this.shotMode = true;
      this.shot = shot;
      this.shotSeed = Number.isFinite(seed) ? seed : 7;
      this.ui.hideAll();
      this.mode = 'playing';
      this._applyShot(shot);
    } else {
      this.ui.showStart(this.save.exists());
    }

    // ---- debug / test hooks (used by playtest.mjs + take-shots.mjs) ----
    window.__game = this;
    window.__gameState = () => this.stateSnapshot();
    this._animate();
  }

  // Denser skyline silhouette on the horizon so it never reads empty.
  _buildSkyline() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x7a3a3a });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0x5a2a3a });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const x = Math.cos(a) * 300;
      const z = 130 + Math.sin(a) * 300;
      if (z > 540 || z < -290) continue;
      if (x < -200 && z > 300) continue; // keep the sunset gap open
      const h = 35 + ((i * 37) % 40);
      const b = new THREE.Mesh(new THREE.BoxGeometry(24, h, 24), i % 2 ? mat : mat2);
      b.position.set(x, h / 2, z);
      this.scene.add(b);
    }
  }

  // ================= state / save =================

  rankInfo() { return rankFor(this.rp); }

  stateSnapshot() {
    const active = this.missions.active;
    return {
      mode: this.mode,
      inCar: this.player.inCar,
      cash: this.cash,
      rp: this.rp,
      rank: this.rankInfo().rank.name,
      mission: active ? active.job.id + ' stage ' + active.stageIndex : null,
      completedJobs: this.missions.serialize(),
      nitroOwned: this.garage.hasNitro(),
      heli: !!this.police.heli,
      dispatch: this.police.dispatch.length,
      policeCars: this.police.cars.length,
      wanted: this.police.wanted,
      raceBest: Object.assign({}, this.races.best),
      district: (typeof this.districts.current === 'string' ? this.districts.current : (this.districts.current?.name || 'The Strand')),
      car: {
        x: this.car.x, z: this.car.z, heading: this.car.heading,
        speedKmh: fmtSpeedKmh(this.car.speed), nitro: Math.round(this.car.nitro),
        condition: Math.round(this.car.condition)
      },
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading }
    };
  }

  saveGame() {
    const ok = this.save.save({
      cash: this.cash,
      rp: this.rp,
      completedJobs: this.missions.serialize(),
      weapons: this.combat.weapons,
      garage: this.garage.serialize(),
      raceBest: this.races.serialize(),
      districts: this.districts.serialize(),
      carCondition: this.car.condition,
      playerPos: {
        x: this.player.inCar ? this.car.x : this.player.x,
        z: this.player.inCar ? this.car.z : this.player.z,
        heading: this.player.inCar ? this.car.heading : this.player.heading,
        inCar: this.player.inCar
      }
    });
    if (ok) this.hud.toast('Game saved', 2);
    return ok;
  }

  _loadSave() {
    const data = this.save.load();
    if (!data) return false;
    this.cash = data.cash || 0;
    this.rp = data.rp || 0;
    this.missions.restore(data.completedJobs);
    if (data.weapons) {
      for (const w of data.weapons) {
        const mine = this.combat.weapons.find(m => m.name === w.name);
        if (mine) { mine.unlocked = !!w.unlocked; mine.ammo = w.ammo; }
      }
    }
    this.garage.restore(data.garage);
    this.races.restore(data.raceBest);
    this.districts.restore(data.districts);
    if (typeof data.carCondition === 'number') {
      this.car.condition = data.carCondition;
      this.car.health = data.carCondition;
    }
    this.garage.applyTo(this.car);
    if (data.playerPos) {
      const p = data.playerPos;
      if (p.inCar) {
        this.car.setPos(p.x, p.z, p.heading);
        this.player.inCar = true;
      } else {
        this.player.setPos(p.x, p.z, p.heading);
        this.player.inCar = false;
        this.car.setPos(p.x + 4, p.z, p.heading);
      }
      this.camHeading = p.heading || 0;
    }
    return true;
  }

  _startFresh() {
    this.audio.ensure();
    this.audio.startRadio();
    this.ui.hideAll();
    this.mode = 'playing';
    this.hud.toast('Puerto Alba — press M to start the next job', 3);
  }

  _startFromSave() {
    this.audio.ensure();
    this.audio.startRadio();
    this._loadSave();
    this.ui.hideAll();
    this.mode = 'playing';
    this.hud.toast('Welcome back, Ria', 2);
  }

  _startFromSaveOrFresh() {
    if (this.save.exists()) this._startFromSave();
    else this._startFresh();
  }

  _pause() {
    this.mode = 'paused';
    this.ui.showPause();
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
  }

  _resume() {
    this.ui.hideAll();
    this.mode = 'playing';
  }

  // ================= staged screenshots =================

  // Late-game state shared by every shot: big cash, Ghost of Alba, M1-M7
  // done, 5 weapons (Sniper still locked until M11), crew ready, garage kit.
  _stageProgression(cash, rp, activeJobId) {
    this.cash = cash;
    this.rp = rp;
    const done = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
    if (!activeJobId) done.push('M8');
    this.missions.restore(done);
    this.combat.unlockForJob('M3');
    this.combat.unlockForJob('M5');
    this.combat.unlockForJob('M7');
    for (const [name, standing] of [['The Strand', 62], ['Marina Row', 48], ['Commerce Row', 35], ['Causeway', 28], ['The Island', 20]]) {
      const d = this.districts.list.find(dd => dd.name === name);
      if (d) d.standing = standing;
    }
    this.districts.current = 'The Strand';
    this.garage.owned.nitro = true;
    this.garage.owned.engine = true;
    this.garage.owned.armor = true;
    this.garage.applyTo(this.car);
    this.car.repair();
    this.car.nitro = 100;
    this.timeOfDay = 18.1;
    this.audio.song = 'Golden Hour Drive';
    this.audio.station = 'ALBA FM 98.1';
    if (activeJobId) {
      const started = this.missions.start(activeJobId);
      if (started) {
        const job = this.missions.job(activeJobId);
        this.dialogue = { name: job.giver, role: job.role, line: job.dialogue[1] || job.dialogue[0] };
      }
    }
  }

  _applyShot(shot) {
    this.traffic.spawn(16);
    this.pedestrians.spawn(20);
    if (shot === 'chase') this._stageChase();
    else if (shot === 'briefing') this._stageBriefing();
    else if (shot === 'combat') this._stageCombat();
    else if (shot === 'vista') this._stageVista();
    else this._stageChase();
  }

  // Cover: 5-star chase, packed road, roadblock + fireball in frame, heli
  // low + close with a hard spotlight cone, eastbound into the golden hour.
  _stageChase() {
    this._stageProgression(24500, 1100, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Deliver the bag on the Strand';
    this._shotDialogue = { name: 'Don Rafael Alba', role: 'Don of Alba', line: 'Every cruiser in Alba will be looking for you. Make them work for it.' };
    this.player.inCar = true;
    this.car.setPos(-40, 200, 1.57);
    this.car.speed = 42.5; // 153 km/h
    this.camHeading = 1.57;
    this.camera.position.set(-40 - Math.sin(1.57) * 7.2, 2.7, 200 - Math.cos(1.57) * 7.2);
    // 5-star heat: 5 cruisers + heli + roadblock.
    this.police.setWanted(5);
    this.police.syncUnits(this.car.x, this.car.z, 1.57);
    // A third roadblock car so the barricade reads as a wall, not a pair.
    const rb = new Car(THREE, this.scene, {
      x: this.car.x + 15, z: 200, color: 0x1a1a2a, name: 'Roadblock', topSpeed: 0, isPolice: true
    });
    rb.heading = 1.57 + Math.PI / 2;
    rb.mesh.rotation.y = rb.heading;
    this.police.roadblock.push(rb);
    this._recolorPolice();
    // Traffic close ahead, east on the Strand loop.
    this._stagedTraffic = [
      { car: this.traffic.cars[0].car, dx: 8, dz: 0 },
      { car: this.traffic.cars[1].car, dx: 12, dz: 3 },
      { car: this.traffic.cars[2].car, dx: 18, dz: -2 },
      { car: this.traffic.cars[3].car, dx: 8, dz: -4 },
      { car: this.traffic.cars[4].car, dx: 20, dz: 2 },
      { car: this.traffic.cars[5].car, dx: 10, dz: 4 }
    ];
    // Police staged close around the player, not 45-70 m away.
    this._stagedPolice = [
      { dx: 8, dz: -5 }, { dx: 12, dz: 4 }, { dx: -4, dz: -6 }, { dx: 16, dz: 0 }, { dx: -6, dz: 5 }
    ];
    // Fireball hot from the first capture, re-fired on a wall-clock timer
    // because game seconds crawl under swiftshader.
    this._nextBoom = Date.now() + 4000;
  }

  // Shot 2: mission briefing. Don Rafael portrait + dialogue, objectives,
  // rank ladder, cash. Comet GT parked at the intersection, player standing
  // beside it, the player's own cruiser fully in frame.
  _stageBriefing() {
    this._stageProgression(24500, 1100, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Deliver the bag on the Strand';
    this._shotDialogue = { name: 'Don Rafael Alba', role: 'Don of Alba', line: 'The last of it, Ria. Forty thousand, in one bag, on the Strand.' };
    this.briefing = {
      title: 'The Debt — Final Job',
      giver: 'Don Rafael Alba',
      role: 'Don of Alba',
      objectives: ['Deliver the bag on the Strand', 'Lose the 5-star heat', 'Collect $15,000 from the Don'],
      reward: '$15,000',
      cash: 24500
    };
    this.police.setWanted(0);
    this.police.clearAll();
    // Player's own cruiser, parked fully in frame on the left.
    this.car.setPos(-14, 206, 1.57);
    this.car.speed = 0;
    // Comet GT parked at the intersection; player stands beside it.
    this._briefingCar = new Car(THREE, this.scene, {
      x: 2, z: 200, heading: 0.35, color: 0x2ad8c8, name: 'Comet GT', topSpeed: 34
    });
    this.player.inCar = false;
    this.player.standBesideCar(this._briefingCar);
    this.camHeading = 0;
    this.camera.position.set(26, 7, 228);
    this.camera.lookAt(2, 1.5, 202);
  }

  // Shot 3: on-foot combat. Weapon wheel open (docked right so the player
  // stays visible), Sniper locked, muzzle flash + sparks, white police ahead.
  _stageCombat() {
    this._stageProgression(24100, 1150, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Lose the 5-star heat';
    this._shotDialogue = { name: 'Don Rafael Alba', role: 'Don of Alba', line: 'Every cruiser in Alba will be looking for you. Make them work for it.' };
    this.player.inCar = false;
    this.player.setPos(-20, 200, 1.57);
    this.car.setPos(-34, 204, 1.57);
    this.car.speed = 0;
    this.camHeading = 1.57;
    this.camera.position.set(-20 - Math.sin(1.57) * 5.5, 2.6, 200 - Math.cos(1.57) * 5.5);
    this.police.setWanted(3);
    this.police.syncUnits(this.player.x, this.player.z, 1.57);
    this._recolorPolice();
    this._stagedPolice = [
      { dx: 16, dz: -3 }, { dx: 22, dz: 4 }, { dx: 28, dz: -1 }
    ];
    this.combat.select(1); // SMG in hand
    this._fireCombatBurst();
    this._nextMuzzle = Date.now() + 400;
  }

  _fireCombatBurst() {
    const fx = Math.sin(this.player.heading), fz = Math.cos(this.player.heading);
    const mx = this.player.x + fx * 2.5 - fz * 0.6, mz = this.player.z + fz * 2.5 + fx * 0.6;
    this.effects.muzzle(mx, 2.0, mz);
    this.effects.sparks(this.player.x + fx * 14, 1.2, this.player.z + fz * 14);
  }

  // Shot 4: landmark vista. Sun bloom + lens flare, ferris wheel, Casino
  // Luna, island + causeway, populated beach + causeway traffic.
  _stageVista() {
    this._stageProgression(24800, 1200, null);
    this._shotMission = null;
    this.hint = 'Press M to start the next job';
    this.police.setWanted(0);
    this.police.clearAll();
    this.player.inCar = true;
    this.car.setPos(40, 200, 1.57);
    this.car.speed = 0;
    // Bigger, warmer sun.
    this.city.sunBall.scale.set(1.8, 1.8, 1.8);
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(130, 120, 40);
    this.camera.lookAt(20, 8, 330);
    this._addLensFlare();
    // Populated beach: 12 walkers on the sand in view.
    for (let i = 0; i < Math.min(12, this.pedestrians.walkers.length); i++) {
      const w = this.pedestrians.walkers[i];
      w.x = -40 + i * 15;
      w.z = 248 + (i % 3) * 14;
      w.group.position.set(w.x, 0, w.z);
    }
    // Causeway traffic: 5 cars on the bridge.
    for (let i = 0; i < Math.min(5, this.traffic.cars.length); i++) {
      const t = this.traffic.cars[i];
      t.car.setPos(-6 + (i % 2) * 12, 330 + i * 28, 0);
    }
  }

  // Lens flare: warm glow sprites strung between the camera and the sun.
  _addLensFlare() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,200,1)');
    grad.addColorStop(0.35, 'rgba(255,190,110,0.55)');
    grad.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const sunPos = this.city.sunBall.position;
    const camPos = this.camera.position;
    const dir = new THREE.Vector3().subVectors(sunPos, camPos).normalize();
    for (const [dist, size, opacity, color] of [[90, 22, 0.5, 0xffe9a8], [150, 9, 0.35, 0xffc890], [230, 34, 0.18, 0xffb060]]) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const s = new THREE.Sprite(mat);
      s.position.copy(camPos).addScaledVector(dir, dist);
      s.scale.set(size, size, 1);
      this.scene.add(s);
      this._vistaFlare.push(s);
    }
  }

  // FIX (a): police cars must read WHITE. The Car class stores its Group as
  // .mesh, NOT .group — the old code read car.group (undefined) and the
  // recolor never ran. Recolor meshes whose material is 0x1a1a2a to near-white
  // 0xf2f2f2. Body + nose share one material instance per car, so one hit
  // recolors both; glass (0x1a2a3a) and wheels (0x141414) are different
  // materials and stay dark. Runs once per car (tracked in a Set).
  _recolorPolice() {
    const all = this.police.cars.concat(this.police.roadblock);
    for (const car of all) {
      if (!car || !car.mesh) continue;
      if (this._recolored.has(car)) continue;
      car.mesh.traverse((m) => {
        if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0x1a1a2a) {
          m.material.color.setHex(0xf2f2f2);
        }
      });
      this._recolored.add(car);
    }
  }

  // ================= gameplay update =================

  _effectivePos() {
    if (this.player.inCar) return { x: this.car.x, z: this.car.z, heading: this.car.heading };
    return { x: this.player.x, z: this.player.z, heading: this.player.heading };
  }

  _updatePlaying(dt) {
    const inCar = this.player.inCar;
    const eff = this._effectivePos();

    // ---- keys that act on a press edge ----
    if (!this.shopOpen) {
      if (this.input.pressed('KeyM')) this._startNextMission();
      if (this.input.pressed('KeyG')) this._toggleShop();
      if (this.input.pressed('KeyE')) this._toggleEnterCar();
      if (this.input.pressed('KeyF')) { this.combat.cycle(); this.audio.blip(660, 0.08, 'square', 0.1); }
      if (this.input.pressed('KeyZ')) this._crewAbility(0);
      if (this.input.pressed('KeyX')) this._crewAbility(1);
      if (this.input.pressed('KeyC')) this._crewAbility(2);
    } else if (this.input.pressed('KeyG')) {
      this._closeShop();
    }

    // ---- weapon wheel (hold Tab) ----
    if (this.input.down('Tab')) {
      if (!this.wheelOpen) {
        this.wheelOpen = true;
        this.combat.wheelOpen = true;
        this.hud.showWheel(this._weaponsVm(), this.combat.selected);
        this.hud.dispatchEl.style.display = 'none';
      }
      for (let i = 0; i < 6; i++) {
        if (this.input.pressed('Digit' + (i + 1))) {
          if (this.combat.select(i)) this.hud.showWheel(this._weaponsVm(), this.combat.selected);
          else this.audio.denied();
        }
      }
    } else if (this.wheelOpen) {
      this.wheelOpen = false;
      this.combat.wheelOpen = false;
      this.hud.hideWheel();
      this.hud.dispatchEl.style.display = '';
    }

    // ---- world updates (frozen while the shop is open) ----
    if (!this.shopOpen) {
      // Drive / walk.
      if (inCar) {
        const prevX = this.car.x, prevZ = this.car.z;
        const driving = !this.wheelOpen;
        this.car.update(dt, {
          throttle: driving ? this.input.throttle : 0,
          steer: driving ? this.input.steer : 0,
          nitro: driving ? this.input.nitro : false
        }, this.garage.hasNitro());
        let [nx, nz] = collideCircle(this.colliders, this.car.x, this.car.z, 2.2);
        [nx, nz] = this.city.clampToWorld(nx, nz);
        if (this.city.isWater(nx, nz)) { nx = prevX; nz = prevZ; }
        this.car.setPos(nx, nz, this.car.heading);
      } else {
        const prevX = this.player.x, prevZ = this.player.z;
        this.player.update(dt, this.input, this.camHeading);
        let [nx, nz] = collideCircle(this.colliders, this.player.x, this.player.z, 0.8);
        [nx, nz] = this.city.clampToWorld(nx, nz);
        if (this.city.isWater(nx, nz)) { nx = prevX; nz = prevZ; }
        this.player.setPos(nx, nz, this.player.heading);
      }
      this.districts.updatePosition(eff.x, eff.z);

      // Traffic + pedestrians (walkers flee the car and the police).
      this.traffic.update(dt);
      const threats = [{ x: eff.x, z: eff.z, radius: 14 }];
      for (const c of this.police.cars) threats.push({ x: c.x, z: c.z, radius: 12 });
      this.pedestrians.update(dt, threats);

      // Police chase / heli / roadblock; rams damage the player's car.
      if (this.ramCooldown > 0) this.ramCooldown -= dt;
      this.police.update(dt, eff.x, eff.z, inCar ? this.car : null, (c) => this._onRam(c));
      this._recolorPolice();

      // Races: advance checkpoints, pay the prize on a win.
      let raceResult = null;
      if (this.races.active) {
        this._lastRaceId = this.races.active.def.id;
        raceResult = this.races.update(dt, this.car);
      }
      if (raceResult) this._onRaceResult(raceResult);

      // Missions: stages, rewards, dialogue.
      const events = this.missions.update(dt, {
        px: eff.x, pz: eff.z, inCar,
        wanted: this.police.wanted, raceResult,
        garage: this.garage, enteredCar: this.enteredCar
      });
      for (const ev of events) this._handleMissionEvent(ev);

      // Mission marker beam over the current stage target.
      const target = this.missions.stageTarget();
      if (target) {
        this.city.beam.visible = true;
        this.city.beam.position.set(target.x, 30, target.z);
      } else {
        this.city.beam.visible = false;
      }

      // Ferris wheel turns; the clock creeps through golden hour.
      if (this.city.ferrisWheel) this.city.ferrisWheel.rotation.z += dt * 0.05;
      this.timeOfDay = Math.min(19.5, this.timeOfDay + dt * 0.004);

      // Dialogue lines cycle while a job is active.
      if (this.missions.active) {
        this.dialogueT += dt;
        if (this.dialogueT > 5) {
          this.dialogueT = 0;
          const job = this.missions.active.job;
          const next = Math.min((this._dialogueIdx || 0) + 1, job.dialogue.length - 1);
          this._dialogueIdx = next;
          const raw = job.dialogue[next];
          const line = raw.includes(': ') ? raw.slice(raw.indexOf(': ') + 2) : raw;
          this.dialogue = { name: job.giver, role: job.role, line };
        }
      }

      // Crew cooldowns tick down.
      for (const c of this.crew) {
        if (c.cooldown > 0) {
          c.cooldown = Math.max(0, c.cooldown - dt);
          c.ready = c.cooldown <= 0;
        }
      }

      // Shooting (mouse click), on foot or drive-by.
      if (this.input.clickPressed() && !this.wheelOpen) this._shoot();

      // Hint line.
      this._updateHint();

      // Audio follows the car + the heat.
      this.audio.setEngine(inCar ? clamp(Math.abs(this.car.speed) / this.car.topSpeed, 0, 1) : 0, inCar);
      this.audio.setSiren(this.police.wanted >= 2);

      // Autosave on the hour of play is overkill; save on mission complete.
      this.effects.update(dt);
    }

    // ---- camera + HUD ----
    this._updateChaseCamera(dt);
    this.hud.update(this._buildVm(), dt);
    this.renderer.render(this.scene, this.camera);
    this._signalReady();
  }

  _updateHint() {
    if (!this.missions.active) {
      this.hint = 'Press M to start the next job';
      return;
    }
    if (!this.player.inCar) {
      const near = this.traffic.nearestCar(this.player.x, this.player.z, 5)
        || (this.missions.active && this.missions.active.stageCar)
        || this.car;
      if (near && dist2d(this.player.x, this.player.z, near.x, near.z) < 5) {
        this.hint = 'Press E to steal the ' + near.name;
        return;
      }
    }
    if (this.garage.nearGarage(this._effectivePos().x, this._effectivePos().z)) {
      this.hint = 'Press G for the garage shop';
      return;
    }
    this.hint = '';
  }

  _startNextMission() {
    if (this.missions.active) {
      this.hud.toast('Job in progress: ' + this.missions.active.job.name, 2);
      return;
    }
    const next = JOBS.find(j => !this.missions.isDone(j.id));
    if (!next) {
      this.hud.toast('All 12 jobs done — Alba is yours, Ria', 3);
      return;
    }
    this.missions.start(next.id);
    const raw = next.dialogue[0];
    const line = raw.includes(': ') ? raw.slice(raw.indexOf(': ') + 2) : raw;
    this.dialogue = { name: next.giver, role: next.role, line };
    this._dialogueIdx = 0;
    this.dialogueT = 0;
    this.audio.pickup();
    this.hud.toast(next.id + ' — ' + next.name, 2.5);
  }

  _handleMissionEvent(ev) {
    if (ev.type === 'race-start') {
      const r = this.races.startRace(ev.raceId, this.car);
      if (!r) this.hud.toast('Get in a car to race', 2);
      else this.hud.toast('Race started — ' + r.def.name, 2);
      return;
    }
    if (ev.type === 'race-lost') {
      this.hud.toast('Race lost — the prize stays with Rex', 2.5);
      return;
    }
    if (ev.type === 'stage') {
      const job = ev.job;
      const raw = job.dialogue[Math.min(ev.stageIndex, job.dialogue.length - 1)];
      const line = raw.includes(': ') ? raw.slice(raw.indexOf(': ') + 2) : raw;
      this.dialogue = { name: job.giver, role: job.role, line };
      this._dialogueIdx = Math.min(ev.stageIndex, job.dialogue.length - 1);
      this.dialogueT = 0;
      this.audio.blip(880, 0.1, 'square', 0.12);
      return;
    }
    if (ev.type === 'complete') {
      const { cash, rp, unlock, job } = ev.reward;
      this.cash += cash;
      const before = this.rankInfo().rank.name;
      this.rp += rp;
      this.districts.addStanding(job.district, 10);
      if (unlock) this.combat.unlockForJob(unlock);
      this.dialogue = null;
      this.audio.complete();
      this.hud.toast(job.name + ' complete — +' + fmtCash(cash) + ' · +' + rp + ' RP', 3);
      const after = this.rankInfo().rank.name;
      if (after !== before) this.hud.toast('New rank: ' + after, 3);
      if (job.id === 'M12') this.hud.toast('The Debt is dust. Alba drives itself now.', 4);
      this.saveGame();
    }
  }

  // FIX (b): the race finish result's `best` is a BOOLEAN (new-best flag).
  // The best TIME is races.bestTimeText(id) — a time string like "1:23".
  // The boolean is used ONLY for the "NEW BEST!" flag, never as the time.
  _onRaceResult(result) {
    const id = this._lastRaceId || 'strand-gp';
    if (result.won) {
      this.cash += result.prize;
      const bestTime = this.races.bestTimeText(id);
      this.hud.toast(
        'Won ' + result.raceName + ' — +' + fmtCash(result.prize) + ' · Best ' + bestTime +
        (result.best ? ' — NEW BEST!' : ''), 3.5
      );
      this.audio.complete();
    } else {
      this.hud.toast('Race over — ' + result.raceName + ' slipped away', 2.5);
    }
  }

  _toggleEnterCar() {
    if (this.player.inCar) {
      this.player.exitCarBeside(this.car);
      this.audio.blip(330, 0.08, 'square', 0.1);
      return;
    }
    const px = this.player.x, pz = this.player.z;
    let target = this.traffic.nearestCar(px, pz, 5);
    if (!target && this.missions.active && this.missions.active.stageCar) {
      const sc = this.missions.active.stageCar;
      if (dist2d(px, pz, sc.x, sc.z) < 5) target = sc;
    }
    if (!target && dist2d(px, pz, this.car.x, this.car.z) < 5) target = this.car;
    if (!target) return;
    const isTheft = target !== this.car;
    this.traffic.removeCar(target);
    this.enteredCar = target;
    this.car = target;
    this.car.isPlayer = true;
    this.player.inCar = true;
    this.garage.applyTo(this.car);
    this.audio.blip(520, 0.1, 'square', 0.12);
    if (target.name === 'Comet GT' || (this.missions.active && this.missions.active.stageCar === target)) {
      this.hud.toast('Got the ' + target.name, 2);
    }
    // Stealing a stranger's car draws heat; taking back your own does not.
    if (isTheft) this.police.addWanted(1, 'stole a car');
  }

  _onRam() {
    if (this.ramCooldown > 0) return;
    this.ramCooldown = 0.9;
    this.car.damage(4);
    this.audio.crash();
    this.effects.sparks(this.car.x, 1.2, this.car.z);
    if (this.car.health <= 0) this._wreckPlayerCar();
  }

  _wreckPlayerCar() {
    this.effects.explosion(this.car.x, this.car.z, 1.6);
    this.audio.explosion();
    this.audio.setSiren(false);
    this.mode = 'ended';
    this.ui.showEnd('WRECKED', 'Your ride is scrap. The Don is not impressed.');
  }

  _crewAbility(i) {
    const c = this.crew[i];
    if (!c || !c.ready) {
      this.hud.toast('Crew on cooldown', 1.5);
      return;
    }
    if (i === 0) {
      this.car.slipstream = 6;
      c.cooldown = c.cooldownMax || 25;
      this.hud.toast('Slipstream — Kiki pushes the car', 2);
    } else if (i === 1) {
      this.police.setWanted(Math.max(0, this.police.wanted - 1));
      c.cooldown = 30;
      this.hud.toast('Loop Feeds — Lena drops a star', 2);
    } else {
      let best = null, bestD = 70;
      for (const pc of this.police.cars) {
        const d = dist2d(this.car.x, this.car.z, pc.x, pc.z);
        if (d < bestD) { bestD = d; best = pc; }
      }
      if (best) {
        this._damageCar(best, 300, false, 'police');
        this.hud.toast('Ram wrecked a cruiser', 2.5);
      } else {
        this.hud.toast('No cruiser in range', 2);
      }
      c.cooldown = 20;
    }
    c.ready = false;
    this.audio.pickup();
  }

  _damageCar(car, dmg, explosive, kind) {
    const destroyed = car.damage(dmg);
    if (explosive) this.effects.explosion(car.x, car.z, 1.2);
    if (!destroyed) return;
    this.effects.explosion(car.x, car.z, 1.5);
    this.audio.explosion();
    if (kind === 'police') {
      this.police.cars = this.police.cars.filter(c => c !== car);
      this.police.roadblock = this.police.roadblock.filter(c => c !== car);
      car.dispose();
      this.hud.toast('Cruiser wrecked — heat rising', 2.5);
      this.police.addWanted(1, 'shot police');
    } else if (kind === 'traffic') {
      this.traffic.removeCar(car);
      car.dispose();
      this.hud.toast('Civilian car wrecked', 2);
      this.police.addWanted(1, 'wrecked a car');
    } else {
      car.dispose();
      this.hud.toast('Rival wrecked', 2);
    }
  }

  _shoot() {
    const eff = this._effectivePos();
    const now = performance.now() / 1000;
    const shot = this.combat.tryFire(now, eff.x, eff.z, eff.heading);
    if (!shot) return;
    this.audio.shot();
    const fx = Math.sin(shot.heading), fz = Math.cos(shot.heading);
    this.effects.muzzle(eff.x + fx * 2, 1.4, eff.z + fz * 2);
    const targets = [];
    for (const c of this.police.cars) {
      targets.push({ x: c.x, z: c.z, radius: 3, onHit: (d, e) => this._damageCar(c, d, e, 'police') });
    }
    for (const c of this.police.roadblock) {
      targets.push({ x: c.x, z: c.z, radius: 3, onHit: (d, e) => this._damageCar(c, d, e, 'police') });
    }
    for (const t of this.traffic.cars) {
      const c = t.car;
      targets.push({ x: c.x, z: c.z, radius: 3, onHit: (d, e) => this._damageCar(c, d, e, 'traffic') });
    }
    for (const c of this.traffic.parked) {
      targets.push({ x: c.x, z: c.z, radius: 3, onHit: (d, e) => this._damageCar(c, d, e, 'traffic') });
    }
    if (this.missions.active && this.missions.active.stageCar) {
      const c = this.missions.active.stageCar;
      targets.push({ x: c.x, z: c.z, radius: 3, onHit: (d, e) => this._damageCar(c, d, e, 'rival') });
    }
    const res = this.combat.resolveShot(shot, targets);
    if (res) this.effects.sparks(res.ix, 1.2, res.iz);
  }

  // ---- garage shop ----
  _toggleShop() {
    const eff = this._effectivePos();
    if (!this.garage.nearGarage(eff.x, eff.z)) {
      this.hud.toast('Find Alba Garage on Marina Row', 2);
      return;
    }
    if (this.shopOpen) { this._closeShop(); return; }
    this.shopOpen = true;
    this.audio.ensure();
    this.hud.showShop(GARAGE_UPGRADES, this.cash, this.garage.owned, (id) => this._buyUpgrade(id));
  }

  _closeShop() {
    this.shopOpen = false;
    this.hud.hideShop();
  }

  _buyUpgrade(id) {
    const res = this.garage.buy(id, this.cash);
    if (!res.ok) {
      this.audio.denied();
      this.hud.setShopMessage(res.message);
      return;
    }
    this.cash -= res.cost;
    if (res.repair) this.car.repair();
    else this.garage.applyTo(this.car);
    this.audio.pickup();
    this.hud.setShopMessage(res.message);
    this.hud.showShop(GARAGE_UPGRADES, this.cash, this.garage.owned, (i) => this._buyUpgrade(i));
    this.hud.toast(res.message, 2);
  }

  // ---- camera ----
  _updateChaseCamera(dt) {
    const eff = this._effectivePos();
    const dist = this.player.inCar ? 6.5 : 5.5;
    const height = this.player.inCar ? 2.4 : 2.6;
    this.camHeading = angleLerp(this.camHeading, eff.heading, 1 - Math.exp(-dt * 2.5));
    const fx = Math.sin(this.camHeading), fz = Math.cos(this.camHeading);
    const k = 1 - Math.exp(-dt * 5);
    this.camera.position.x += (eff.x - fx * dist - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (eff.z - fz * dist - this.camera.position.z) * k;
    this.camera.lookAt(eff.x + fx * 8, 1.4, eff.z + fz * 8);
  }

  // ================= HUD view-model =================

  _weaponsVm() {
    return this.combat.weapons.map(w => ({
      name: w.name, ammo: w.ammo, unlocked: w.unlocked,
      locked: !w.unlocked, price: w.unlockJob ? 12000 : 0
    }));
  }

  _buildVm() {
    const rank = this.rankInfo();
    const next = rank.next;
    const rpProgress = next ? clamp((this.rp - rank.rank.rp) / (next.rp - rank.rank.rp), 0, 1) : 1;
    const eff = this._effectivePos();
    const active = this.missions.active;
    let mission = null;
    let stageText = '';
    let stageProgress = 0;
    let missionTimer = '';
    if (this.shotMode && this._shotMission !== undefined) {
      mission = this._shotMission;
      stageText = this._shotStageText || '';
      stageProgress = 0.35;
    } else if (active) {
      mission = { code: active.job.id, name: active.job.name, giver: active.job.giver, role: active.job.role };
      const st = this.missions.stage();
      const tgt = this.missions.stageTarget();
      stageText = tgt ? tgt.text : (st ? st.text : '');
      if (st && st.type === 'hold') {
        stageProgress = this.missions.holdProgress();
        missionTimer = fmtClock(Math.max(0, (st.seconds || 5) * (1 - stageProgress)));
      }
    }
    if (this.races.active) {
      const a = this.races.active;
      stageText = 'Race checkpoint ' + (a.cpIndex + 1) + '/' + a.def.checkpoints.length;
      stageProgress = a.cpIndex / a.def.checkpoints.length;
      // Best time as a TIME string (bestTimeText), never the boolean flag.
      missionTimer = fmtClock(a.time) + ' · best ' + this.races.bestTimeText(a.def.id);
    }
    const tgt = this.missions.stageTarget();
    return {
      wanted: this.police.wanted,
      cash: this.cash,
      rankName: rank.rank.name,
      rp: this.rp,
      rpProgress,
      nextRank: next ? next.name : 'MAX RANK',
      district: (typeof this.districts.current === 'string' ? this.districts.current : (this.districts.current?.name || 'The Strand')),
      standing: this.districts.currentStanding(),
      mission,
      stageText,
      stageProgress,
      missionTimer,
      inSight: this.police.playerSpotted,
      heli: !!this.police.heli,
      clockText: fmtTimeOfDay(this.timeOfDay),
      dispatch: this.police.dispatch.map(u => ({ code: u.code, role: u.role, status: u.status, color: u.color, dist: u.dist })),
      crew: this.crew.map(c => ({
        name: c.name, initials: c.initials, color: c.color,
        ability: c.ability, key: c.key, ready: c.ready, cooldown: Math.ceil(c.cooldown)
      })),
      station: this.audio.station,
      song: this.audio.song,
      dialogue: this.shotMode && this._shotDialogue !== undefined ? this._shotDialogue : this.dialogue,
      hint: this.hint,
      speedKmh: this.player.inCar ? fmtSpeedKmh(this.car.speed) : 0,
      carName: this.car.name,
      condition: Math.round(this.car.condition),
      nitroOwned: this.garage.hasNitro(),
      nitro: Math.round(this.car.nitro),
      nitroActive: this.car.nitroActive,
      weapons: this._weaponsVm(),
      selectedWeapon: this.combat.selected,
      briefing: this.briefing,
      minimap: {
        px: eff.x, pz: eff.z, heading: eff.heading,
        tx: tgt ? tgt.x : undefined, tz: tgt ? tgt.z : undefined,
        police: this.police.cars.map(c => ({ x: c.x, z: c.z }))
      }
    };
  }

  // ================= staged-shot frame update =================

  _updateShot(dt) {
    const now = Date.now();
    if (this.shot === 'chase') {
      // Auto-drive eastbound at 153 km/h; the world chases the player.
      const prevX = this.car.x, prevZ = this.car.z;
      this.car.update(dt, { throttle: 1, steer: 0, nitro: false }, true);
      let [nx, nz] = collideCircle(this.colliders, this.car.x, this.car.z, 2.2);
      [nx, nz] = this.city.clampToWorld(nx, nz);
      if (this.city.isWater(nx, nz)) { nx = prevX; nz = prevZ; }
      this.car.setPos(nx, nz, this.car.heading);
      this.police.update(dt, this.car.x, this.car.z, this.car, null);
      this.traffic.update(dt);
      this.pedestrians.update(dt, [{ x: this.car.x, z: this.car.z, radius: 14 }]);
      this._recolorPolice();
      // Traffic packed close ahead on the Strand.
      for (const s of this._stagedTraffic) {
        s.car.setPos(this.car.x + s.dx, 200 + s.dz, 1.57);
        s.car.speed = 40;
      }
      // Police staged close around the player.
      this.police.cars.forEach((c, i) => {
        const o = this._stagedPolice[i % this._stagedPolice.length];
        c.setPos(this.car.x + o.dx, 200 + o.dz, 1.57);
        c.speed = 42;
      });
      // Physical roadblock 15 m ahead, across the road.
      this.police.roadblock.forEach((c, i) => {
        const off = (i - 1) * 4.5;
        c.setPos(this.car.x + 10, 200 + off, 1.57 + Math.PI / 2);
      });
      // Helicopter low + close + large, spotlight cone hard and wide.
      if (this.police.heli) {
        const h = this.police.heli;
        h.group.position.set(this.car.x + 13, 9, this.car.z - 8);
        h.group.scale.set(2, 2, 2);
        h.cone.position.set(this.car.x + 13, 4.5, this.car.z - 8);
        h.cone.scale.set(1.4, 1.0, 1.4);
        h.cone.material.opacity = 0.3;
      }
      // One timed blast ahead of the car (game seconds crawl under
      // swiftshader, so a re-fired blast never fades and they stack into
      // a diffuse glow). Fired once, ~1-3 frames before capture: a single
      // compact deep-orange ball, centre-left, behind the roadblock.
      if (this._nextBoom && now >= this._nextBoom) {
        this.effects.explosion(this.car.x + 20, 197, 0.7);
        this.effects.smoke(this.car.x + 20, 3, 197);
        this._nextBoom = 0;
      }
      if (this.city.ferrisWheel) this.city.ferrisWheel.rotation.z += dt * 0.05;
      this._updateChaseCamera(dt);
      // Snap the camera in shot mode: the chase lerp lags metres behind a
      // car doing 153 km/h, which shrinks the player car. The cover needs
      // it big — about a third of the frame.
      this.camera.position.set(this.car.x - Math.sin(this.car.heading) * 9, 2.8, this.car.z - Math.cos(this.car.heading) * 9);
      this.camera.lookAt(this.car.x + Math.sin(this.car.heading) * 8, 1.4, this.car.z + Math.cos(this.car.heading) * 8);
    } else if (this.shot === 'briefing') {
      // Frozen tableau: static camera on the intersection.
      this.camera.position.set(26, 7, 228);
      this.camera.lookAt(2, 1.5, 202);
    } else if (this.shot === 'combat') {
      this.police.update(dt, this.player.x, this.player.z, null, null);
      this._recolorPolice();
      // White police staged close ahead of the player on foot.
      this.police.cars.forEach((c, i) => {
        const o = this._stagedPolice[i % this._stagedPolice.length];
        c.setPos(this.player.x + o.dx, 200 + o.dz, 1.57);
        c.speed = 0;
      });
      // Heli low + close with a hard cone.
      if (this.police.heli) {
        const h = this.police.heli;
        h.group.position.set(this.player.x + 14, 10, this.player.z - 8);
        h.group.scale.set(2, 2, 2);
        h.cone.position.set(this.player.x + 14, 5, this.player.z - 8);
        h.cone.scale.set(1.4, 1.0, 1.4);
        h.cone.material.opacity = 0.3;
      }
      // Muzzle flash + sparks re-fired on a wall-clock timer.
      if (now >= this._nextMuzzle) {
        this._fireCombatBurst();
        this._nextMuzzle = now + 400;
      }
      // Weapon wheel open, docked right so the player stays visible.
      this.hud.showWheel(this._weaponsVm(), this.combat.selected, 'right');
      this.hud.dispatchEl.style.display = 'none';
      this._updateChaseCamera(dt);
    } else if (this.shot === 'vista') {
      // Frozen tableau: static wide camera, sun + flare + landmarks.
      this.camera.position.set(130, 120, 40);
      this.camera.lookAt(20, 8, 330);
      if (this.city.ferrisWheel) this.city.ferrisWheel.rotation.z += dt * 0.05;
    }
    this.effects.update(dt);
    this.hud.update(this._buildVm(), dt);
    this.renderer.render(this.scene, this.camera);
    this._signalReady();
  }

  _updateMenu(dt) {
    // Slow orbit over the city behind the start screen.
    const t = performance.now() * 0.00008;
    this.camera.position.set(Math.sin(t) * 200, 70, 200 + Math.cos(t) * 130);
    this.camera.lookAt(0, 0, 200);
    if (this.city.ferrisWheel) this.city.ferrisWheel.rotation.z += dt * 0.05;
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
    this._signalReady();
  }

  _signalReady() {
    if (!this._readySignalled) {
      this._readySignalled = true;
      window.__gameReady = true;
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    // Pause toggle lives in the frame loop so it can always resume.
    if (this.input.pressed('KeyP') || this.input.pressed('Escape')) {
      if (this.mode === 'playing' && !this.shotMode) this._pause();
      else if (this.mode === 'paused') this._resume();
    }
    if (this.shotMode) {
      this._updateShot(dt);
    } else if (this.mode === 'playing') {
      this._updatePlaying(dt);
    } else if (this.mode === 'menu') {
      this._updateMenu(dt);
    } else {
      // Paused / ended: frozen frame, still rendered.
      this.renderer.render(this.scene, this.camera);
    }
    this.input.endFrame();
  }
}

// Boot the game.
new Game();
