// main.js — Puerto Alba: wires every system together, runs the game loop,
// cameras, shot staging (?shot=chase|steal|mission|vista), crew, save/load.
// Play with keyboard + mouse. No network, no personal data.

import { clamp, angleLerp, fmtTimeOfDay, fmtSpeedKmh, rand, pick } from './utils.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { buildCity, WORLD, collideCircle } from './city.js';
import { Car, randomCarColor } from './vehicle.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions, rankFor } from './missions.js';
import { Garage, GARAGE_UPGRADES } from './garage.js';
import { Races } from './races.js';
import { Districts } from './districts.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { Ui } from './ui.js';
import { SaveSys } from './save.js';

async function getThree() {
  if (window.THREE) return window.THREE;
  const mod = await import('../vendor/three.min.js');
  return mod.default || mod;
}

const CREW_DEFS = [
  { initials: 'KM', name: 'Kiki Maro', ability: 'Slipstream', key: 'Z', color: '#2ad8c8', cdMax: 45 },
  { initials: 'DV', name: 'Dario Voss', ability: 'Loop Feeds', key: 'X', color: '#ff8a2a', cdMax: 60 },
  { initials: 'LK', name: 'Lena Kade', ability: 'Ram', key: 'C', color: '#ff4a6a', cdMax: 50 }
];

class Game {
  constructor(THREE) {
    this.THREE = THREE;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 30, 60);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.timeOfDay = 17.6; // golden hour

    this.input = new Input();
    this.audio = new AudioSys();
    this.city = buildCity(THREE, this.scene);
    this.effects = new Effects(THREE, this.scene);
    this.traffic = new Traffic(THREE, this.scene, this.city.colliders);
    this.peds = new Pedestrians(THREE, this.scene);
    this.police = new Police(THREE, this.scene, this.city.colliders);
    this.combat = new Combat();
    this.missions = new Missions(THREE, this.scene);
    this.garage = new Garage();
    this.races = new Races(THREE, this.scene);
    this.districts = new Districts();
    this.hud = new Hud();
    this.ui = new Ui();
    this.save = new SaveSys();

    // Player state.
    this.cash = 1200;
    this.rp = 0;
    this.state = 'menu'; // menu | playing | paused | shop | busted
    this.crew = CREW_DEFS.map(c => Object.assign({}, c, { cooldown: 0 }));
    this.dialogueQueue = [];
    this.dialogueTimer = 0;
    this.dialogueCurrent = null;
    this.bustedTimer = 0;
    this.ramCooldown = 0;
    this.shotBoomAt = -1;
    this.raceResultPending = null;
    this.saveTimer = 0;
    this.camYaw = 0;
    this.shotMode = null;

    // Ria on foot + her starter car.
    this.player = new Player(THREE, this.scene, -140, 150);
    this.car = new Car(THREE, this.scene, {
      x: -128, z: 156, color: 0x2ad8c8, name: 'Alba Cruiser', isPlayer: true, topSpeed: 34
    });
    this.player.standBesideCar(this.car);
    this.traffic.spawn(12);
    this.peds.spawn(10);

    // UI wiring.
    this.ui.onPlay = () => { this.audio.ensure(); this.audio.startRadio(); this.startPlaying(false); };
    this.ui.onContinue = () => { this.audio.ensure(); this.audio.startRadio(); this.startPlaying(true); };
    this.ui.onResume = () => { this.state = 'playing'; this.ui.hideAll(); };
    this.ui.onRestart = () => { this.restartFromSave(); };
    this.hud.onShopClose = () => { this.closeShop(); };

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Shot staging (?shot=chase|steal|mission|vista).
    const params = new URLSearchParams(location.search);
    const shot = params.get('shot');
    if (shot) {
      this.shotMode = shot;
      this.applyShot(shot, parseInt(params.get('seed') || '1', 10));
      this.ui.hideAll();
      this.state = 'playing';
      this.audio.ensure();
    } else {
      this.ui.showStart(this.save.exists());
    }

    window.__gameState = () => this.snapshot();
    window.__game = this; // debug / playtest handle
    window.__gameReady = false;
    this.loop();
  }

  // ---------- state snapshot (for verification / playtesting) ----------
  snapshot() {
    const r = rankFor(this.rp);
    const effX = this.player.inCar && this.car ? this.car.x : this.player.x;
    const effZ = this.player.inCar && this.car ? this.car.z : this.player.z;
    return {
      mode: this.state, shot: this.shotMode,
      cash: this.cash, rp: this.rp, rank: r.rank.name,
      wanted: this.police.wanted,
      dispatch: this.police.dispatch.length,
      mission: this.missions.active ? this.missions.active.job.id + ' stage ' + this.missions.active.stageIndex : null,
      missionName: this.missions.active ? this.missions.active.job.name : null,
      inCar: this.player.inCar,
      player: { x: +effX.toFixed(1), z: +effZ.toFixed(1), y: +this.player.group.position.y.toFixed(2) },
      car: this.car ? { x: +this.car.x.toFixed(1), z: +this.car.z.toFixed(1), name: this.car.name, condition: Math.round(this.car.condition), speedKmh: fmtSpeedKmh(Math.abs(this.car.speed)) } : null,
      playerCarDist: this.player.inCar ? 0 : (this.car ? +Math.hypot(this.player.x - this.car.x, this.player.z - this.car.z).toFixed(1) : null),
      district: this.districts.current,
      crewReady: this.crew.map(c => c.cooldown <= 0),
      weaponsUnlocked: this.combat.weapons.filter(w => w.unlocked).map(w => w.name),
      nitroOwned: this.garage.has('nitro'),
      garageOwned: Object.keys(this.garage.owned).filter(k => this.garage.owned[k]),
      raceBest: this.races.best,
      traffic: this.traffic.count(), peds: this.peds.count(),
      policeCars: this.police.cars.length, heli: !!this.police.heli,
      roadblock: this.police.roadblock.length,
      completedJobs: this.missions.completed.slice()
    };
  }

  startPlaying(fromSave) {
    if (fromSave) this.loadGame();
    this.ui.hideAll();
    this.state = 'playing';
  }

  restartFromSave() {
    this.police.clearAll();
    this.missions.abandon();
    this.races.endRace();
    this.player.inCar = false;
    this.player.setPos(-140, 150, 0);
    this.car.setPos(-128, 156, 0);
    this.car.repair();
    this.car.speed = 0;
    this.loadGame();
    this.ui.hideAll();
    this.state = 'playing';
  }

  // ---------- save / load ----------
  saveGame() {
    this.save.save({
      cash: this.cash, rp: this.rp,
      completedJobs: this.missions.completed,
      weapons: this.combat.weapons,
      garage: this.garage.serialize(),
      raceBest: this.races.serialize(),
      districts: this.districts.serialize(),
      carCondition: this.car ? this.car.condition : 100,
      playerPos: { x: this.player.x, z: this.player.z }
    });
  }

  loadGame() {
    const d = this.save.load();
    if (!d) return;
    this.cash = d.cash || 1200;
    this.rp = d.rp || 0;
    this.missions.restore(d.completedJobs);
    if (d.weapons) {
      for (const w of d.weapons) {
        const mine = this.combat.weapons.find(m => m.name === w.name);
        if (mine) { mine.unlocked = !!w.unlocked; mine.ammo = w.ammo; }
      }
    }
    this.garage.restore(d.garage);
    this.races.restore(d.raceBest);
    this.districts.restore(d.districts);
    if (this.car) { this.car.condition = d.carCondition || 100; this.car.health = d.carCondition || 100; }
    this.garage.applyTo(this.car);
    if (d.playerPos) this.player.setPos(d.playerPos.x, d.playerPos.z, 0);
  }

  // ---------- shot staging (Tier A) ----------
  applyShot(shot, seed) {
    // Rich late-game base state, from the game's own progression.
    this.cash = 24000;
    this.rp = 1100;
    this.combat.unlockForJob('M3');
    this.combat.unlockForJob('M5');
    this.combat.unlockForJob('M7');
    this.combat.weapons[0].ammo = 120;
    this.combat.weapons[1].ammo = 240;
    this.combat.weapons[2].ammo = 48;
    this.combat.weapons[3].ammo = 180;
    this.combat.weapons[4].ammo = 12;
    this.garage.owned = { armor: true, engine: true, nitro: true };
    this.garage.applyTo(this.car);
    this.races.best = { 'strand-gp': 98.4 };
    this.districts.list.find(d => d.name === 'The Strand').standing = 62;
    this.districts.list.find(d => d.name === 'Marina Row').standing = 48;
    this.districts.list.find(d => d.name === 'Commerce Row').standing = 35;
    this.districts.list.find(d => d.name === 'Causeway').standing = 41;
    this.districts.list.find(d => d.name === 'The Island').standing = 28;
    for (const c of this.crew) c.cooldown = 0;

    if (shot === 'chase') {
      // Cover: 5-star chase, M8 escape stage, roadblock, explosion, heli.
      this.cash = 24500;
      this.traffic.spawn(20);
      this.peds.spawn(16);
      this.car.setPos(-40, 205, -Math.PI / 2);
      this.car.speed = 30;
      this.car.condition = 78; this.car.health = 78;
      this.player.inCar = true;
      this.police.setWanted(5);
      this.police.syncUnits(this.car.x, this.car.z, this.car.heading);
      this.missions.start('M8', true);
      this.missions.active.stageIndex = 1; // escape stage
      this.queueDialogue(this.missions.job('M8'), 1);
      this.audio.setSong('Golden Hour Drive');
      this.timeOfDay = 18.1;
      this.effects.explosion(-75, 212, true);
      this.audio.explosion();
      this.shotBoomAt = 4.6;
      this.police.chaseTopSpeed = 40;
    } else if (shot === 'steal') {
      // Steal: wanted 2, player BESIDE the Comet GT, traffic passing, police closing.
      this.cash = 24350;
      this.rp = 1120;
      this.traffic.spawn(14);
      this.peds.spawn(10);
      this.missions.start('M1', true);
      const stageCar = this.missions.active.stageCar;
      this.player.standBesideCar(stageCar);
      this.car = stageCar; // the target car is the focus car
      this.player.inCar = false;
      this.police.setWanted(2);
      this.police.syncUnits(this.player.x, this.player.z);
      // Put both cruisers in frame, closing in on the steal.
      if (this.police.cars.length >= 2) {
        this.police.cars[0].setPos(-130, 195, Math.atan2(-30, -33));
        this.police.cars[1].setPos(-200, 130, Math.atan2(40, 32));
      }
      this.queueDialogue(this.missions.job('M1'), 0);
      this.audio.setSong('Neon Palms');
      this.timeOfDay = 18.2;
    } else if (shot === 'mission') {
      // Mission: M8 delivery stage, wanted 3 + heli, route on the minimap.
      this.cash = 24100;
      this.rp = 1150;
      this.traffic.spawn(16);
      this.peds.spawn(12);
      this.car.setPos(-120, 200, -Math.PI / 2);
      this.car.speed = 24;
      this.car.condition = 86; this.car.health = 86;
      this.player.inCar = true;
      this.police.setWanted(3);
      this.police.syncUnits(this.car.x, this.car.z);
      this.missions.start('M8', true);
      this.queueDialogue(this.missions.job('M8'), 0);
      this.audio.setSong('Causeway Lights');
      this.timeOfDay = 18.0;
      this.police.chaseTopSpeed = 40;
    } else if (shot === 'vista') {
      // Vista: free roam, golden hour, sun + ferris wheel + casino in frame.
      this.cash = 24800;
      this.rp = 1200;
      this.traffic.spawn(14);
      this.peds.spawn(18);
      this.player.setPos(150, 268, Math.PI);
      this.player.inCar = false;
      this.car.setPos(138, 258, Math.PI / 2);
      this.car.speed = 0;
      this.police.setWanted(0);
      this.audio.setSong('Salt Air');
      this.timeOfDay = 18.4;
    }
    this.districts.updatePosition(this.player.x, this.player.z);
  }

  queueDialogue(job, lineIndex) {
    if (!job) return;
    const line = job.dialogue[lineIndex || 0];
    if (line) this.dialogueQueue.push({ name: job.giver, role: job.role, line });
  }

  // ---------- crew abilities ----------
  useCrew(i) {
    const c = this.crew[i];
    if (!c || c.cooldown > 0) { this.audio.denied(); return; }
    if (i === 0) {
      if (!this.player.inCar || !this.car) { this.hud.toast('Slipstream needs a car.'); return; }
      this.car.slipstream = 6;
      this.hud.toast('Kiki: Slipstream! Full send.');
    } else if (i === 1) {
      if (this.police.wanted === 0) { this.hud.toast('No heat to loop.'); return; }
      this.police.setWanted(this.police.wanted - 1);
      this.hud.toast('Dario: Feeds looped. One star gone.');
    } else {
      // Ram: wreck the nearest police or rival car (around the car, or the
      // player on foot).
      const ex = this.player.inCar && this.car ? this.car.x : this.player.x;
      const ez = this.player.inCar && this.car ? this.car.z : this.player.z;
      let best = null, bestD = 60;
      const all = this.police.cars.concat(this.police.roadblock);
      for (const pc of all) {
        const d = Math.hypot(pc.x - ex, pc.z - ez);
        if (d < bestD) { bestD = d; best = pc; }
      }
      if (!best) { this.hud.toast('Lena: No target in range.'); return; }
      best.damage(200);
      this.effects.explosion(best.x, best.z, false);
      this.audio.explosion();
      if (best.health <= 0) {
        // Wrecked: take it out of the chase entirely.
        best.dispose();
        this.police.cars = this.police.cars.filter(c => c !== best);
        this.police.roadblock = this.police.roadblock.filter(c => c !== best);
      }
      this.hud.toast('Lena: Target wrecked.');
    }
    c.cooldown = c.cdMax;
    this.audio.pickup();
  }

  // ---------- car enter / steal ----------
  tryEnterCar() {
    const target = this.traffic.nearestCar(this.player.x, this.player.z, 7) ||
      (this.missions.active && this.missions.active.stageCar &&
        Math.hypot(this.missions.active.stageCar.x - this.player.x, this.missions.active.stageCar.z - this.player.z) < 7
        ? this.missions.active.stageCar : null) ||
      (this.car && Math.hypot(this.car.x - this.player.x, this.car.z - this.player.z) < 7 ? this.car : null);
    if (!target) return;
    const wasStageCar = this.missions.active && this.missions.active.stageCar === target;
    const stealingNew = target !== this.car;
    this.traffic.removeCar(target);
    this.car = target;
    this.car.isPlayer = true;
    this.player.inCar = true;
    this.garage.applyTo(this.car);
    this.audio.pickup();
    if (stealingNew) {
      // Taking a car that is not yours draws heat.
      this.police.addWanted(1, 'steal');
      this.hud.toast('Car stolen — wanted level up.');
    } else if (wasStageCar) {
      this.police.addWanted(1, 'steal');
    }
  }

  exitCar() {
    if (!this.player.inCar || !this.car) return;
    this.player.exitCarBeside(this.car);
    this.car.speed = 0;
  }

  // ---------- shop ----------
  openShop() {
    this.state = 'shop';
    const buyHandler = (id) => {
      const res = this.garage.buy(id, this.cash);
      if (res.ok) {
        this.cash -= res.cost;
        if (res.repair && this.car) this.car.repair();
        if (this.car) this.garage.applyTo(this.car);
        this.hud.setShopMessage(res.message);
        this.hud.showShop(GARAGE_UPGRADES, this.garage.owned, this.cash, buyHandler);
        this.audio.pickup();
        this.saveGame();
      } else {
        this.hud.setShopMessage(res.message);
        this.audio.denied();
      }
    };
    this.hud.showShop(GARAGE_UPGRADES, this.garage.owned, this.cash, buyHandler);
  }
  closeShop() {
    this.hud.hideShop();
    this.state = 'playing';
  }

  // ---------- main loop ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    // Pause toggle works in every state (update() does not run while paused).
    if ((this.input.pressed('KeyP') || this.input.pressed('Escape')) &&
        (this.state === 'playing' || this.state === 'paused')) {
      if (this.state === 'playing') { this.state = 'paused'; this.ui.showPause(); }
      else { this.state = 'playing'; this.ui.hideAll(); }
    }
    if (this.state === 'playing' || this.state === 'shop') {
      this.update(dt);
    } else if (this.state === 'menu') {
      // Slow orbit around the beachfront behind the start screen.
      const t = this.elapsed * 0.05;
      this.camera.position.set(Math.sin(t) * 180, 90, 320 + Math.cos(t) * 60);
      this.camera.lookAt(0, 10, 220);
      this.city.ferrisWheel.rotation.z += dt * 0.1;
    }
    this.renderer.render(this.scene, this.camera);
    if (!window.__gameReady) window.__gameReady = true;
    this.input.endFrame();
  }

  update(dt) {
    const input = this.input;
    const inCar = this.player.inCar;
    // Effective position: the car when driving, the player on foot. Police,
    // missions, districts and the garage all track this, not the stale
    // on-foot position while driving.
    const effX = inCar && this.car ? this.car.x : this.player.x;
    const effZ = inCar && this.car ? this.car.z : this.player.z;
    this.timeOfDay += dt * 0.004;

    if (this.state === 'shop') {
      if (input.pressed('KeyG')) this.closeShop();
      this.effects.update(dt);
      this.updateCamera(dt);
      this.updateHud(dt);
      return;
    }
    if (this.state !== 'playing') return;

    // Shot-mode: keep the staged heat frozen so screenshots stay rich.
    if (this.shotMode) this.police.heat = 0;
    if (this.shotBoomAt > 0) {
      this.shotBoomAt -= dt;
      if (this.shotBoomAt <= 0) {
        // Fireball ahead of the car, just before the screenshot lands.
        const fx = Math.sin(this.car.heading), fz = Math.cos(this.car.heading);
        const px = Math.cos(this.car.heading), pz = -Math.sin(this.car.heading);
        this.effects.explosion(
          this.car.x + fx * 34 + px * 10,
          this.car.z + fz * 34 + pz * 10, true);
        this.audio.explosion();
      }
    }

    // Crew cooldowns + keys.
    for (const c of this.crew) c.cooldown = Math.max(0, c.cooldown - dt);
    if (input.pressed('KeyZ')) this.useCrew(0);
    if (input.pressed('KeyX')) this.useCrew(1);
    if (input.pressed('KeyC')) this.useCrew(2);

    // Mission start.
    if (input.pressed('KeyM') && !this.missions.active) {
      const next = this.missions.jobs.find(j => !this.missions.isDone(j.id));
      if (next) {
        this.missions.start(next.id);
        for (let i = 0; i < next.dialogue.length; i++) this.queueDialogue(next, i);
        this.hud.toast('Job started: ' + next.id + ' — ' + next.name);
        if (next.id === 'M8' || next.id === 'M12') this.police.setWanted(5);
        this.audio.pickup();
      }
    }

    // Garage shop.
    if (input.pressed('KeyG') && this.garage.nearGarage(effX, effZ)) {
      this.openShop();
      return;
    }

    // Weapon wheel (hold Tab) + cycle + digits.
    const wheelHeld = input.down('Tab');
    this.combat.wheelOpen = wheelHeld;
    if (wheelHeld) {
      this.hud.showWheel(this.combat.weapons, this.combat.selected);
      for (let i = 0; i < 6; i++) {
        if (input.pressed('Digit' + (i + 1))) this.combat.select(i);
      }
    } else {
      this.hud.hideWheel();
    }
    if (input.pressed('KeyF')) this.combat.cycle();

    // Enter / exit car.
    if (input.pressed('KeyE')) {
      if (inCar) this.exitCar();
      else this.tryEnterCar();
    }

    // --- Movement ---
    if (inCar && this.car) {
      const prevX = this.car.x, prevZ = this.car.z;
      // Shot autopilot: cruise the beachfront lane back and forth so the
      // chase/mission shots stay fast, on the road, and in frame.
      let driveThrottle = input.throttle, driveSteer = input.steer, driveNitro = input.nitro;
      if (this.shotMode === 'chase' || this.shotMode === 'mission') {
        const laneZ = this.shotMode === 'chase' ? 205 : 200;
        const lo = this.shotMode === 'chase' ? -220 : -220;
        const hi = this.shotMode === 'chase' ? 220 : -60;
        if (!this._shotWp) this._shotWp = { x: lo, z: laneZ };
        if (Math.hypot(this.car.x - this._shotWp.x, this.car.z - this._shotWp.z) < 18) {
          this._shotWp.x = this._shotWp.x === lo ? hi : lo;
        }
        const want = Math.atan2(this._shotWp.x - this.car.x, this._shotWp.z - this.car.z);
        const diff = ((want - this.car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        driveSteer = clamp(diff * 1.8, -1, 1);
        driveThrottle = 1;
        driveNitro = false;
      }
      this.car.update(dt, {
        throttle: driveThrottle, steer: driveSteer, nitro: driveNitro
      }, this.garage.has('nitro') || this.shotMode === 'chase');
      let [nx, nz] = collideCircle(this.city.colliders, this.car.x, this.car.z, 2.4);
      if (this.city.isWater(nx, nz)) { nx = prevX; nz = prevZ; this.car.speed *= 0.3; }
      [nx, nz] = this.city.clampToWorld(nx, nz);
      this.car.setPos(nx, nz);
      // Ram the mission wreck target.
      const a = this.missions.active;
      if (a && a.stageCar && Math.abs(this.car.speed) > 6) {
        const d = Math.hypot(this.car.x - a.stageCar.x, this.car.z - a.stageCar.z);
        if (d < 5 && this.ramCooldown <= 0) {
          a.stageCar.damage(34);
          this.ramCooldown = 0.5;
          this.effects.sparks(a.stageCar.x, a.stageCar.z, 1.4);
          this.audio.crash();
          if (a.stageCar.health <= 0) {
            this.effects.explosion(a.stageCar.x, a.stageCar.z, false);
            this.audio.explosion();
          }
        }
      }
      this.ramCooldown = Math.max(0, this.ramCooldown - dt);
      // Burning car smokes.
      if (this.car.burning && Math.random() < dt * 6) this.effects.smoke(this.car.x, this.car.z, 2);
      if (this.car.health <= 0 && this.car.condition <= 0) {
        this.hud.toast('Your car is wrecked — steal another.');
        this.exitCar();
      }
      this.audio.setEngine(Math.abs(this.car.speed) / 40, true);
    } else {
      const prevX = this.player.x, prevZ = this.player.z;
      this.player.update(dt, input, this.camYaw);
      let [nx, nz] = collideCircle(this.city.colliders, this.player.x, this.player.z, 0.8);
      if (this.city.isWater(nx, nz)) { nx = prevX; nz = prevZ; }
      [nx, nz] = this.city.clampToWorld(nx, nz);
      this.player.setPos(nx, nz);
      this.audio.setEngine(0, false);
    }

    // Shooting (mouse click).
    if (input.clickPressed() && !wheelHeld) {
      const ox = inCar && this.car ? this.car.x : this.player.x;
      const oz = inCar && this.car ? this.car.z : this.player.z;
      const heading = inCar && this.car ? this.car.heading : this.player.heading;
      const shot = this.combat.tryFire(this.elapsed, ox, oz, heading);
      if (shot) {
        this.audio.shot();
        this.effects.muzzle(ox + Math.sin(heading) * 3, oz + Math.cos(heading) * 3, 1.4);
        const targets = [];
        for (const pc of this.police.cars.concat(this.police.roadblock)) {
          targets.push({
            x: pc.x, z: pc.z, radius: 3,
            onHit: (dmg, expl, ix, iz) => {
              const dead = pc.damage(dmg);
              if (expl) this.effects.explosion(ix, iz, false);
              else this.effects.sparks(ix, iz, 1.4);
              if (dead) {
                this.effects.explosion(pc.x, pc.z, true);
                this.audio.explosion();
                pc.dispose();
                this.police.cars = this.police.cars.filter(c => c !== pc);
                this.police.roadblock = this.police.roadblock.filter(c => c !== pc);
                this.police.addWanted(1, 'shot-cop');
              }
            }
          });
        }
        const a = this.missions.active;
        if (a && a.stageCar) {
          targets.push({
            x: a.stageCar.x, z: a.stageCar.z, radius: 3,
            onHit: (dmg, expl, ix, iz) => {
              a.stageCar.damage(dmg);
              if (expl) this.effects.explosion(ix, iz, false);
              else this.effects.sparks(ix, iz, 1.4);
              if (a.stageCar.health <= 0) {
                this.effects.explosion(a.stageCar.x, a.stageCar.z, false);
                this.audio.explosion();
              }
            }
          });
        }
        for (const t of this.traffic.cars) {
          targets.push({
            x: t.car.x, z: t.car.z, radius: 3,
            onHit: (dmg, expl, ix, iz) => {
              t.car.damage(dmg);
              if (expl) this.effects.explosion(ix, iz, false);
              else this.effects.sparks(ix, iz, 1.4);
              if (t.car.health <= 0) {
                this.effects.explosion(t.car.x, t.car.z, true);
                this.audio.explosion();
              }
            }
          });
        }
        this.combat.resolveShot(shot, targets);
        if (this.police.wanted < 5 && Math.random() < 0.5) this.police.addWanted(0, 'shot');
      }
    }

    // Traffic, pedestrians, police, effects.
    this.traffic.update(dt);
    const threats = [];
    if (inCar && this.car) threats.push({ x: this.car.x, z: this.car.z, radius: 14 });
    for (const pc of this.police.cars) threats.push({ x: pc.x, z: pc.z, radius: 12 });
    this.peds.update(dt, threats);
    this.police.update(dt, effX, effZ, inCar ? this.car : null, (pc) => {
      if (inCar && this.car && this.ramCooldown <= 0) {
        this.car.damage(4);
        this.ramCooldown = 0.8;
        this.effects.sparks(this.car.x, this.car.z, 1.2);
        this.audio.crash();
      }
    });
    this.audio.setSiren(this.police.wanted >= 1);
    this.effects.update(dt);
    this.city.ferrisWheel.rotation.z += dt * 0.1;
    // Chase shot: keep the roadblock 55m ahead of the car so it stays in frame.
    if (this.shotMode === 'chase' && this.police.roadblock.length === 2 && this.car) {
      const fx = Math.sin(this.car.heading), fz = Math.cos(this.car.heading);
      const px = Math.cos(this.car.heading), pz = -Math.sin(this.car.heading);
      const ax = this.car.x + fx * 55, az = this.car.z + fz * 55;
      this.police.roadblock[0].setPos(ax + px * -4.5, az + pz * -4.5, this.car.heading + Math.PI / 2);
      this.police.roadblock[1].setPos(ax + px * 4.5, az + pz * 4.5, this.car.heading + Math.PI / 2);
    }

    // Races.
    if (this.races.active) {
      const res = this.races.update(dt, this.car);
      if (res) {
        this.raceResultPending = res;
        if (res.won) {
          this.cash += res.prize;
          this.hud.toast('Race won! +' + res.prize + ' — ' + res.time.toFixed(1) + 's' + (res.best ? ' (new best!)' : ''));
          this.audio.complete();
        } else {
          this.hud.toast('Race lost — the rivals took it.');
        }
      }
    }

    // Missions.
    const ctx = {
      px: effX, pz: effZ,
      inCar: this.player.inCar,
      wanted: this.police.wanted,
      raceResult: this.raceResultPending,
      garage: this.garage,
      enteredCar: this.player.inCar ? this.car : null
    };
    const events = this.missions.update(dt, ctx);
    this.raceResultPending = null;
    for (const ev of events) {
      if (ev.type === 'stage') {
        this.hud.toast('Stage complete — ' + (this.missions.active ? this.missions.stage().text : ''));
        this.audio.pickup();
      } else if (ev.type === 'race-start') {
        this.races.startRace(ev.raceId, this.car);
        this.hud.toast('Race started — hit every gate!');
      } else if (ev.type === 'race-lost') {
        this.hud.toast('Race lost — try the job again from M.');
        this.missions.abandon();
      } else if (ev.type === 'complete') {
        const r = ev.reward;
        this.cash += r.cash;
        this.rp += r.rp;
        if (r.unlock) this.combat.unlockForJob(r.unlock);
        const job = r.job;
        this.districts.addStanding(job.district, 12);
        this.hud.toast('Job complete: ' + job.name + ' +' + r.cash + ' · +' + r.rp + ' RP');
        this.audio.complete();
        this.saveGame();
      }
    }

    // Busted: on foot, high heat, cop right on top of you.
    if (!inCar && this.police.wanted >= 4) {
      let near = false;
      for (const pc of this.police.cars) {
        if (Math.hypot(pc.x - this.player.x, pc.z - this.player.z) < 5) { near = true; break; }
      }
      if (near) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 2.5) {
          this.state = 'busted';
          this.ui.showEnd('BUSTED', 'The Alba police caught Ria on foot. The debt still stands.');
          this.police.setWanted(0);
          this.bustedTimer = 0;
        }
      } else this.bustedTimer = 0;
    }

    // Dialogue queue.
    if (this.dialogueCurrent) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.dialogueCurrent = null;
    } else if (this.dialogueQueue.length) {
      this.dialogueCurrent = this.dialogueQueue.shift();
      this.dialogueTimer = 4.5;
    }

    // District tracking + autosave.
    this.districts.updatePosition(effX, effZ);
    this.saveTimer += dt;
    if (this.saveTimer > 30) { this.saveTimer = 0; this.saveGame(); }

    this.updateCamera(dt);
    this.updateHud(dt);
  }

  updateCamera(dt) {
    const shot = this.shotMode;
    if (shot === 'vista') {
      this.camera.position.set(340, 145, 490);
      this.camera.lookAt(-140, 20, 320);
      return;
    }
    if (shot === 'steal') {
      // Side view: player beside the car, car in frame, street behind.
      // Offset (22,6) verified clear of colliders by the city probe.
      const c = this.missions.active && this.missions.active.stageCar ? this.missions.active.stageCar : this.car;
      this.camera.position.set(c.x + 22, 7, c.z + 6);
      this.camera.lookAt(c.x, 1.5, c.z);
      return;
    }
    // Chase cam: behind the car or the player.
    const focus = this.player.inCar && this.car ? this.car : this.player;
    const heading = this.player.inCar && this.car ? this.car.heading : this.player.heading;
    this.camYaw = angleLerp(this.camYaw, heading, Math.min(1, dt * 3.5));
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const tx = focus.x, tz = focus.z;
    const dist = this.player.inCar ? 13 : 9;
    const height = this.player.inCar ? 6 : 5;
    const cx = tx - fx * dist, cz = tz - fz * dist;
    this.camera.position.x += (cx - this.camera.position.x) * Math.min(1, dt * 6);
    this.camera.position.y += (height - this.camera.position.y) * Math.min(1, dt * 6);
    this.camera.position.z += (cz - this.camera.position.z) * Math.min(1, dt * 6);
    this.camera.lookAt(tx + fx * 6, 1.6, tz + fz * 6);
  }

  updateHud(dt) {
    const r = rankFor(this.rp);
    const stage = this.missions.stage();
    const target = this.missions.stageTarget();
    let raceTarget = null;
    if (this.races.active) {
      const cp = this.races.active.def.checkpoints[this.races.active.cpIndex];
      if (cp) raceTarget = { x: cp[0], z: cp[1] };
    }
    const active = this.missions.active;
    let stageProgress = 0;
    if (stage && stage.type === 'hold') stageProgress = this.missions.holdProgress();
    else if (this.races.active) stageProgress = this.races.active.cpIndex / this.races.active.def.checkpoints.length;
    let missionTimer = '';
    if (this.races.active) {
      missionTimer = 'Gate ' + (this.races.active.cpIndex + 1) + '/' + this.races.active.def.checkpoints.length +
        ' · ' + this.races.active.time.toFixed(1) + 's · Best ' + this.races.bestTimeText(this.races.active.def.id);
    }
    let hint = '';
    const st0 = this.missions.stage();
    if (!this.player.inCar && active && st0 && st0.type === 'steal' && active.stageCar) {
      hint = 'Press E to steal the ' + active.stageCar.name;
    } else if (!this.player.inCar) {
      const near = this.traffic.nearestCar(this.player.x, this.player.z, 7) ||
        (this.car && Math.hypot(this.car.x - this.player.x, this.car.z - this.player.z) < 7 ? this.car : null);
      if (near) hint = 'Press E to steal the ' + near.name;
      else if (this.garage.nearGarage(this.player.x, this.player.z)) hint = 'Press G — Alba Garage (upgrades)';
      else if (!active) hint = 'Press M to start the next job';
    } else if (this.garage.has('nitro')) {
      hint = 'Shift — Nitro · F — weapon · Tab — wheel';
    } else {
      hint = 'F — weapon · Tab — wheel · Z/X/C — crew';
    }
    const t = target || raceTarget;
    const hx = this.player.inCar && this.car ? this.car.x : this.player.x;
    const hz = this.player.inCar && this.car ? this.car.z : this.player.z;
    this.hud.update({
      cash: this.cash, rp: this.rp,
      rankName: r.rank.name,
      rpProgress: r.next ? clamp((this.rp - r.rank.rp) / (r.next.rp - r.rank.rp), 0, 1) : 1,
      nextRank: r.next ? r.next.name : null,
      wanted: this.police.wanted,
      district: this.districts.current,
      standing: this.districts.currentStanding(),
      mission: active ? { code: active.job.id, name: active.job.name, giver: active.job.giver, role: active.job.role } : null,
      stageText: stage ? stage.text : '',
      stageProgress, missionTimer,
      inSight: this.police.wanted >= 3 && this.police.playerSpotted,
      dispatch: this.police.dispatch,
      clockText: fmtTimeOfDay(this.timeOfDay) + ' · Golden Hour',
      speedKmh: this.player.inCar && this.car ? fmtSpeedKmh(Math.abs(this.car.speed)) : 0,
      carName: this.player.inCar && this.car ? this.car.name : 'On foot',
      condition: this.car ? Math.round(this.car.condition) : 100,
      nitro: this.car ? Math.round(this.car.nitro) : 100,
      nitroOwned: this.garage.has('nitro'),
      nitroActive: this.car ? this.car.nitroActive : false,
      weapons: this.combat.weapons,
      selectedWeapon: this.combat.selected,
      crew: this.crew.map(c => ({
        initials: c.initials, name: c.name, ability: c.ability, key: c.key,
        color: c.color, ready: c.cooldown <= 0, cooldown: c.cooldown
      })),
      station: this.audio.station, song: this.audio.song,
      dialogue: this.dialogueCurrent,
      hint,
      minimap: {
        px: hx, pz: hz,
        heading: this.player.inCar && this.car ? this.car.heading : this.player.heading,
        tx: t ? t.x : null, tz: t ? t.z : null,
        target: !!t,
        police: this.police.cars.map(c => ({ x: c.x, z: c.z }))
      }
    }, dt);
  }
}

getThree().then(THREE => {
  window.__threeError = null;
  new Game(THREE);
}).catch(err => {
  window.__threeError = String(err);
  const d = document.createElement('div');
  d.textContent = 'Failed to load 3D engine: ' + err;
  d.style.cssText = 'color:#fff;background:#600;padding:20px;font:16px sans-serif';
  document.body.appendChild(d);
});
