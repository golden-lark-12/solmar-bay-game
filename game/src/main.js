// main.js — Puerto Alba game: boot, loop, driving, missions, police, combat,
// garage shop, crew abilities, races, save/load, and screenshot staging.
import { clamp, angleLerp, angleDiff } from './utils.js';
import { WORLD, buildCity, collideCircle } from './city.js';
import { Districts } from './districts.js';
import { RANKS, rankFor, JOBS, Missions } from './missions.js';
import { Races } from './races.js';
import { GARAGE_UPGRADES, Garage } from './garage.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { Car } from './vehicle.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { Ui } from './ui.js';
import { SaveSys } from './save.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';

const THREE = window.THREE;

const TIERS = [
  { name: 'Wheelman', rp: 0 },
  { name: 'Street Hustler', rp: 250 },
  { name: 'Fixer', rp: 550 },
  { name: 'Ghost of Alba', rp: 900 },
  { name: 'King of Alba', rp: 1400 },
];
const LADDER = (Array.isArray(RANKS) && RANKS.length
  ? RANKS.map((r) => (typeof r === 'string' ? r : r.name))
  : TIERS.map((t) => t.name));

const SPEAKERS = {
  'Don Alba': { name: 'Don Rafael Alba', role: 'Don of Alba', color: '#d8a24a', skin: '#e8b88a', hair: '#c8c8c8', mustache: true },
  'Kiki': { name: 'Kiki Maro', role: 'Wheelwoman', color: '#2ad8c8', skin: '#d8a878', hair: '#2ad8c8' },
  'Dario': { name: 'Dario Voss', role: 'Wheelman', color: '#ff8a2a', skin: '#c89878', hair: '#ff8a2a' },
  'Lena': { name: 'Lena Kade', role: 'Fixer', color: '#ff4a6a', skin: '#f2c8a0', hair: '#ff4a6a' },
  'Ria': { name: 'Ria Solano', role: 'Driver', color: '#7ad8ff', skin: '#e8b088', hair: '#2a1a12' },
  'Sable': { name: 'Sable Quinn', role: 'Marina Owner', color: '#b46aff', skin: '#d8b090', hair: '#b46aff' },
  'Marco': { name: 'Marco Venn', role: 'Fixer', color: '#8a6a3a', skin: '#d8b090', hair: '#3a2a1a' },
  'Iris': { name: 'Iris Vale', role: 'Club Owner', color: '#ff7ad8', skin: '#f2c8a0', hair: '#ff7ad8' },
  'Rex': { name: 'Rex Calder', role: 'Race Promoter', color: '#ffd76a', skin: '#e8b088', hair: '#ffd76a' },
  'Gus': { name: 'Gus Ferran', role: 'Garage Mechanic', color: '#9a9a9a', skin: '#d8a878', hair: '#9a9a9a' },
};

function formatClock(t) {
  const h24 = Math.floor(t) % 24;
  const m = Math.floor((t - Math.floor(t)) * 60);
  const ap = h24 >= 12 ? 'PM' : 'AM';
  let h = h24 % 12;
  if (h === 0) h = 12;
  return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
}

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(60, 45, -40);
    this.clock = new THREE.Clock();
    this.camHeading = 0;

    // Golden-hour light.
    const hemi = new THREE.HemisphereLight(0xffd8b0, 0x8a5a3a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc890, 1.25);
    sun.position.set(-300, 220, 300);
    this.scene.add(sun);

    this.city = buildCity(THREE, this.scene);
    this.colliders = this.city.colliders;
    this.hud = new Hud();
    this.hud.build();
    this.ui = new Ui();
    this.ui.onPlay = () => this.startGame(false);
    this.ui.onContinue = () => this.startGame(true);
    this.ui.onResume = () => this.resumeGame();
    this.ui.onRestart = () => { this.save.clear(); window.location.reload(); };
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

    this.cash = 1200;
    this.rp = 0;
    this.mode = 'menu';
    this.timeOfDay = 18.1;
    this.dialogue = null;
    this.dialogueT = 0;
    this.briefing = null;
    this.briefingT = 0;
    this.hint = '';
    this.crew = [
      { name: 'Kiki Maro', initials: 'KM', color: '#2ad8c8', ability: 'Slipstream', key: 'Z', cooldown: 0, cooldownMax: 25, ready: true, skin: '#d8a878', hair: '#2ad8c8' },
      { name: 'Lena Kade', initials: 'LK', color: '#ff4a6a', ability: 'Loop Feeds', key: 'X', cooldown: 0, cooldownMax: 30, ready: true, skin: '#f2c8a0', hair: '#ff4a6a' },
      { name: 'Dario Voss', initials: 'DV', color: '#ff8a2a', ability: 'Ram', key: 'C', cooldown: 0, cooldownMax: 20, ready: true, skin: '#c89878', hair: '#ff8a2a' },
    ];
    this.shopOpen = false;
    this.wheelOpen = false;
    this.enteredCar = null;
    this.ramCooldown = 0;
    this._recolored = false;
    this._lastRaceId = null;
    this._raceResult = null;
    this._raceLaunched = null;
    this._readySignalled = false;
    this.shotMode = null;
    this.shot = null;
    this.shotSeed = 7;
    this._nextBoom = 0;
    this._nextMuzzle = 0;
    this._stagedTraffic = [];
    this._stagedPolice = [];
    this._shotMission = null;
    this._shotStageText = '';
    this._shotDialogue = null;
    this._vistaFlare = [];
    this._knownDone = [];
    this._chaseSun = null;
    this._combatGun = null;
    this._briefingCar = null;
    this._shotCam = null;
    this._buyFn = null;

    this.player = new Player(THREE, this.scene, 0, -6);
    this.car = new Car(THREE, this.scene, {
      x: 0, z: 6, heading: 0, color: 0xff6a1e,
      name: 'Alba Cruiser', topSpeed: 32, isPlayer: true, driver: true, spoiler: true,
    });

    const params = new URLSearchParams(window.location.search);
    this.shot = params.get('shot');
    this.shotSeed = parseInt(params.get('seed') || '7', 10) || 7;
    this.shotMode = this.shot;
    if (this.shotMode) {
      this._applyShot(this.shotMode);
      this.mode = 'playing';
      this.ui.hideAll();
    } else {
      this.traffic.spawn(14);
      this.pedestrians.spawn(16);
      this.ui.showStart(this.save.exists());
      this.mode = 'menu';
    }

    window.__game = this;
    window.__gameState = () => this.stateSnapshot();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.15);
      if (this.mode === 'playing' || this.mode === 'paused') this.update(dt);
      else if (this.mode === 'menu') this._menuCamera(dt);
      this.renderer.render(this.scene, this.camera);
      if (!this._readySignalled) {
        this._readySignalled = true;
        window.__gameReady = true;
      }
      this.input.endFrame();
    };
    loop();
  }

  _menuCamera(dt) {
    void dt;
    const t = performance.now() * 0.00008;
    this.camera.position.set(Math.sin(t) * 150, 55, 150 + Math.cos(t) * 70);
    this.camera.lookAt(0, 5, 150);
  }

  _rankName(rp) {
    try {
      const r = rankFor(rp);
      if (r && r.name) return r.name;
      if (typeof r === 'string') return r;
    } catch (e) { /* fall through to tiers */ }
    let name = TIERS[0].name;
    for (const t of TIERS) if (rp >= t.rp) name = t.name;
    return name;
  }

  _rankProgress(rp) {
    let cur = TIERS[0];
    let next = null;
    for (let i = 0; i < TIERS.length; i++) {
      if (rp >= TIERS[i].rp) { cur = TIERS[i]; next = TIERS[i + 1] || null; }
    }
    if (!next) return 1;
    return clamp((rp - cur.rp) / (next.rp - cur.rp), 0, 1);
  }

  _nextRankName(rp) {
    for (const t of TIERS) if (rp < t.rp) return t.name;
    return 'King of Alba';
  }

  _doneIds() {
    return this.missions.jobs.filter((j) => j.done).map((j) => j.id);
  }

  _parseDialogue(line) {
    if (!line) return null;
    const idx = line.indexOf(': ');
    const who = idx >= 0 ? line.slice(0, idx) : 'Ria';
    const text = idx >= 0 ? line.slice(idx + 2) : line;
    const sp = SPEAKERS[who] || SPEAKERS['Ria'];
    return { name: sp.name, role: sp.role, line: text, color: sp.color, skin: sp.skin, hair: sp.hair, mustache: !!sp.mustache };
  }

  startGame(fromSave) {
    this.ui.hideAll();
    if (fromSave) this.loadGame();
    this.mode = 'playing';
    this.hint = 'M — start job · Shift — Nitro · F — weapon · Tab — wheel';
    try { this.audio.ensure(); this.audio.startRadio(); } catch (e) { /* audio unavailable */ }
  }

  resumeGame() {
    this.ui.hideAll();
    this.mode = 'playing';
  }

  saveGame() {
    const raceBest = {};
    for (const id of Object.keys(this.races.best || {})) raceBest[id] = this.races.best[id];
    this.save.save({
      cash: this.cash,
      rp: this.rp,
      completedJobs: this._doneIds(),
      weapons: this.combat.weapons,
      garage: this.garage.owned,
      raceBest,
      districts: this.districts.serialize(),
    });
    this.hud.toast('Game saved');
  }

  loadGame() {
    const data = this.save.load();
    if (!data) return false;
    if (typeof data.cash === 'number') this.cash = data.cash;
    if (typeof data.rp === 'number') this.rp = data.rp;
    if (data.completedJobs) this.missions.restore(data.completedJobs);
    if (data.weapons) {
      for (const w of data.weapons) {
        const cw = this.combat.weapons.find((x) => x.name === w.name);
        if (cw) { cw.unlocked = !!w.unlocked; cw.ammo = w.ammo; }
      }
    }
    if (data.garage) this.garage.restore(data.garage);
    if (data.raceBest) this.races.restore(data.raceBest);
    if (data.districts) this.districts.restore(data.districts);
    this.garage.applyTo(this.car);
    this.car.repair();
    this._knownDone = this._doneIds();
    return true;
  }

  stateSnapshot() {
    const raceBest = {};
    for (const id of Object.keys(this.races.best || {})) {
      const v = this.races.best[id];
      raceBest[id] = typeof v === 'number' ? this.races.bestTimeText(id) : String(v);
    }
    const d = this.districts.current;
    const district = typeof d === 'string' ? d : (d && d.name ? d.name : 'The Strand');
    const speedKmh = Math.round(Math.abs(this.car.speed) * 3.6);
    return {
      mode: this.mode,
      inCar: !!this.player.inCar,
      cash: this.cash,
      rp: this.rp,
      rank: this._rankName(this.rp),
      mission: this.missions.active
        ? this.missions.active.job.id + ' stage ' + this.missions.active.stageIndex
        : null,
      completedJobs: this._doneIds(),
      nitroOwned: this.garage.hasNitro(),
      heli: !!this.police.heli,
      dispatch: this.police.dispatch.length,
      policeCars: this.police.cars.length,
      wanted: this.police.wanted,
      raceBest,
      district,
      car: {
        x: this.car.x, z: this.car.z, heading: this.car.heading,
        speedKmh, nitro: Math.round(this.car.nitro), condition: Math.round(this.car.condition),
      },
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
    };
  }

  _missionVM() {
    if (this.shotMode && this._shotMission) {
      const m = this._shotMission;
      const combatShot = this.shotMode === 'combat';
      return {
        title: m.code + ' — ' + m.name,
        giver: m.giver + ' · ' + m.role,
        stage: this._shotStageText,
        stageLabel: combatShot ? 'STAGE 2/2' : 'STAGE 1/2',
        next: combatShot ? 'Collect $15,000 from the Don' : 'Lose the 5-star heat',
        progress: this.shotMode === 'chase' ? 0.45 : this.shotMode === 'combat' ? 0.6 : 0.35,
        timer: '',
      };
    }
    const active = this.missions.active;
    if (!active) return null;
    const job = active.job;
    const stage = this.missions.stage();
    const nextStage = job.stages[active.stageIndex + 1];
    let progress = 0;
    try { progress = this.missions.holdProgress() || 0; } catch (e) { progress = 0; }
    return {
      title: job.id + ' — ' + job.name,
      giver: job.giver + ' · ' + job.role,
      stage: stage ? stage.text : '',
      stageLabel: 'STAGE ' + (active.stageIndex + 1) + '/' + job.stages.length,
      next: nextStage ? nextStage.text : 'Complete the job',
      progress,
      timer: '',
    };
  }

  _routePoints() {
    let target = null;
    let px = this.player.x;
    let pz = this.player.z;
    if (this.player.inCar) { px = this.car.x; pz = this.car.z; }
    if (this.shotMode === 'chase' || this.shotMode === 'briefing') target = { x: -240, z: 200 };
    else if (this.shotMode === 'combat') target = { x: 0, z: 0 };
    else if (this.missions.active) {
      try { target = this.missions.stageTarget(); } catch (e) { target = null; }
    }
    if (!target) return null;
    return [[px, pz], [target.x, target.z]];
  }

  _vm() {
    const inCar = !!this.player.inCar;
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    const route = this._routePoints();
    const markers = route ? [{ x: route[1][0], z: route[1][1], color: '#ffd76a' }] : [];
    return {
      cash: this.cash,
      rp: this.rp,
      rank: this._rankName(this.rp),
      rankProgress: this._rankProgress(this.rp),
      nextRank: this._nextRankName(this.rp),
      ladder: LADDER,
      district: (() => {
        const d = this.districts.current;
        return typeof d === 'string' ? d : (d && d.name ? d.name : 'The Strand');
      })(),
      standing: this.districts.currentStanding(),
      wanted: this.police.wanted,
      heli: !!this.police.heli,
      spotted: !!this.police.playerSpotted,
      airDeployed: !!this.police.heli,
      clock: formatClock(this.timeOfDay),
      mission: this._missionVM(),
      briefing: this.briefing,
      dialogue: this.dialogue,
      hint: this.hint,
      hideHint: this.shotMode === 'chase',
      speedKmh: inCar ? Math.abs(this.car.speed) * 3.6 : 0,
      carName: this.car.name,
      condition: this.car.condition,
      nitro: this.car.nitro,
      nitroOwned: this.garage.hasNitro(),
      nitroBoost: !!this.car.nitroActive,
      weapons: this.combat.weapons.map((w, i) => ({
        name: w.name, ammo: w.ammo, locked: !w.unlocked,
        selected: i === this.combat.selected,
        lockText: w.unlockJob ? 'LOCKED · ' + w.unlockJob : 'LOCKED',
      })),
      crew: this.crew,
      dispatch: this.police.dispatch,
      hideDispatch: this.shotMode === 'combat',
      dispatchEmptyText: 'No active units — streets are quiet',
      radio: { station: this.audio.station || 'ALBA FM 98.1', song: this.audio.song || 'Golden Hour Drive' },
      minimap: {
        x: px, z: pz, heading: inCar ? this.car.heading : this.player.heading,
        roads: WORLD.roads, roadsZ: [-240, -160, -80, 0, 80, 160, 200],
        route, markers,
        police: this.police.cars.map((c) => ({ x: c.x, z: c.z, color: '#ff3a3a' })),
      },
    };
  }

  update(dt) {
    if (this.shotMode) {
      this._updateShot(dt);
    } else {
      this._updatePlaying(dt);
    }
    this.effects.update(dt);
    if (this.city.ferrisWheel) this.city.ferrisWheel.rotation.z += dt * 0.12;
    if (this.city.beam) this.city.beam.rotation.y += dt * 0.5;
    this.hud.update(this._vm(), dt);
  }

  _updatePlaying(dt) {
    this.timeOfDay += dt * 0.004;
    if (this.timeOfDay >= 24) this.timeOfDay -= 24;
    const input = this.input;
    const inCar = !!this.player.inCar;

    // Pause / resume (update runs while paused so KeyP can resume).
    if (input.pressed('KeyP')) {
      if (this.mode === 'playing') {
        this.mode = 'paused';
        this.ui.showPause();
        return;
      }
      if (this.mode === 'paused') {
        this.resumeGame();
        return;
      }
    }
    if (this.mode === 'paused') return;

    // Start next job.
    if (input.pressed('KeyM') && !this.missions.active && !this.shopOpen) {
      const next = JOBS.find((j) => !this.missions.isDone(j.id));
      if (next) {
        this.missions.start(next.id);
        this.dialogue = this._parseDialogue(next.dialogue[0]);
        this.dialogueT = 8;
        this.briefing = {
          title: next.name, giver: next.giver, role: next.role,
          objectives: next.stages.map((s) => s.text), reward: '$' + next.reward.toLocaleString('en-US'),
        };
        this.briefingT = 8;
        try { this.audio.blip(); } catch (e) { /* no audio */ }
      }
    }

    // Garage shop.
    const px0 = inCar ? this.car.x : this.player.x;
    const pz0 = inCar ? this.car.z : this.player.z;
    if (input.pressed('KeyG')) {
      if (this.shopOpen) {
        this.shopOpen = false;
        this.hud.hideShop();
      } else if (this.garage.nearGarage(px0, pz0)) {
        this.shopOpen = true;
        if (!this._buyFn) {
          this._buyFn = (id) => {
            const res = this.garage.buy(id, this.cash);
            if (res.ok) {
              this.cash -= res.cost;
              this.garage.applyTo(this.car);
              this.hud.setShopMessage(res.message);
              this.hud.showShop(GARAGE_UPGRADES, this.cash, this.garage.owned, this._buyFn);
              try { this.audio.pickup(); } catch (e) { /* no audio */ }
            } else {
              this.hud.setShopMessage(res.message);
              try { this.audio.denied(); } catch (e) { /* no audio */ }
            }
          };
        }
        this.hud.onShopClose = () => {
          this.shopOpen = false;
          this.hud.hideShop();
        };
        this.hud.showShop(GARAGE_UPGRADES, this.cash, this.garage.owned, this._buyFn);
      }
    }

    // Enter / exit car.
    if (input.pressed('KeyE') && !this.shopOpen) {
      if (inCar) {
        this.player.exitCarBeside(this.car);
        this.player.inCar = false;
        this.player.group.visible = true;
      } else {
        const d = Math.hypot(this.player.x - this.car.x, this.player.z - this.car.z);
        if (d < 4) {
          this.player.inCar = true;
          this.player.group.visible = false;
          this.enteredCar = this.car;
          try { this.audio.blip(); } catch (e) { /* no audio */ }
        }
      }
    }

    // Weapon wheel.
    if (input.down('Tab') && !this.wheelOpen && !this.shopOpen) {
      this.wheelOpen = true;
      this.hud.showWheel(this.combat.unlockedWeapons(), this.combat.selected);
    } else if (!input.down('Tab') && this.wheelOpen) {
      this.wheelOpen = false;
      this.hud.hideWheel();
    }
    if (this.wheelOpen) {
      for (let n = 1; n <= 6; n++) {
        if (input.pressed('Digit' + n)) {
          this.combat.select(n - 1);
          this.hud.showWheel(this.combat.unlockedWeapons(), this.combat.selected);
        }
      }
    }
    if (input.pressed('KeyF') && !this.shopOpen) this.combat.cycle();

    // Crew abilities.
    for (let i = 0; i < this.crew.length; i++) {
      const c = this.crew[i];
      if (c.cooldown > 0) {
        c.cooldown = Math.max(0, c.cooldown - dt);
        c.ready = c.cooldown <= 0;
      }
    }
    if (this.ramCooldown > 0) this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    if (input.pressed('KeyZ')) this._crewSlipstream();
    if (input.pressed('KeyX')) this._crewLoopFeeds();
    if (input.pressed('KeyC')) this._crewRam();

    // Shooting.
    if (input.clickPressed() && !this.shopOpen) this._shoot();

    // Movement.
    if (!this.shopOpen) {
      if (this.player.inCar) {
        this.car.update(dt, input, this.garage.hasNitro());
        const fix = collideCircle(this.colliders, this.car.x, this.car.z, 1.6);
        if (fix) this.car.setPos(fix.x, fix.z, this.car.heading);
        this.camHeading = angleLerp(this.camHeading, this.car.heading, Math.min(1, dt * 3));
      } else {
        this.player.update(dt, input, this.camHeading);
        const fix = collideCircle(this.colliders, this.player.x, this.player.z, 0.8);
        if (fix) this.player.setPos(fix.x, fix.z, this.player.heading);
        this.camHeading = angleLerp(this.camHeading, this.player.heading, Math.min(1, dt * 2));
      }
    }

    // Missions (+ rewards on completion). The missions system takes a small
    // context object (player position, in-car flag, wanted level, the latest
    // race result, the garage, and the last car entered) — NOT the whole game.
    // NOTE: missions.update clears the active job when its last stage is met
    // but does NOT mark the job done — main owns that: an active job that
    // disappears (and was not abandoned) has been completed.
    const mpx = this.player.inCar ? this.car.x : this.player.x;
    const mpz = this.player.inCar ? this.car.z : this.player.z;
    const prevJob = this.missions.active ? this.missions.active.job : null;
    this.missions.update(dt, {
      px: mpx, pz: mpz,
      inCar: !!this.player.inCar,
      wanted: this.police.wanted,
      raceResult: this._raceResult || null,
      garage: this.garage,
      enteredCar: this.enteredCar,
    });
    // Race stages: make sure the race is running once the mission asks for it.
    // (missions.update marks active.raceStarted itself, so track the launch
    // with our own flag instead of that field.)
    const active = this.missions.active;
    const stage = active ? this.missions.stage() : null;
    const raceId = (active && active.job.raceId) || (stage && stage.raceId) || null;
    if (active && (raceId || (stage && stage.type === 'race')) && !this.races.active && this._raceLaunched !== active.job.id) {
      try {
        this.races.startRace(raceId, this.car);
        this._raceLaunched = active.job.id;
        this._raceResult = null;
      } catch (e) { /* race start failed */ }
    }
    if (this.races.active) {
      const racingId = (this.races.active.def && this.races.active.def.id) || raceId || this._lastRaceId;
      const res = this.races.update(dt, this.car);
      if (res) {
        this._raceResult = res;
        this._lastRaceId = racingId;
        this._raceLaunched = null;
        if (res.won && typeof res.prize === 'number' && res.prize > 0) {
          this.cash += res.prize;
          this.hud.toast('Race won!  +$' + res.prize.toLocaleString('en-US'));
        } else {
          this.hud.toast(res.won ? 'Race won!' : 'Race lost — try again');
        }
      } else if (!this.races.active) {
        // Race ended without a returned result: use the recorded best time
        // (a win) to tell the mission the outcome, else report a loss.
        const bt = racingId ? this.races.bestTime(racingId) : null;
        this._raceResult = { won: typeof bt === 'number', id: racingId };
        this._lastRaceId = racingId;
        this._raceLaunched = null;
      }
    }
    if (prevJob && !this.missions.active && !prevJob.done) {
      // The active job ended: it completed (missions only clears the active
      // job on completion). Mark it done and pay the reward.
      prevJob.done = true;
      this.cash += prevJob.reward;
      this.rp += prevJob.rp;
      this.hud.toast('Job complete: ' + prevJob.name + '  +$' + prevJob.reward.toLocaleString('en-US'));
      try { this.audio.complete(); } catch (e) { /* no audio */ }
      if (prevJob.unlock) this.combat.unlockForJob(prevJob.unlock);
      if (this._raceLaunched === prevJob.id) this._raceLaunched = null;
    }
    this._knownDone = this._doneIds();

    // Police.
    const px = this.player.inCar ? this.car.x : this.player.x;
    const pz = this.player.inCar ? this.car.z : this.player.z;
    this.police.update(dt, px, pz, this.player.inCar ? this.car : null, (ramCar) => {
      void ramCar;
      this.car.damage(6);
      try { this.audio.crash(); } catch (e) { /* no audio */ }
    });
    if (this.police.wanted > 0) this._recolorPolice();

    // Traffic + pedestrians.
    this.traffic.update(dt);
    const threats = this.police.cars.map((c) => ({ x: c.x, z: c.z }));
    threats.push({ x: px, z: pz });
    this.pedestrians.update(dt, threats);

    // Districts.
    this.districts.updatePosition(px, pz);

    // Dialogue / briefing timers.
    if (this.dialogueT > 0) {
      this.dialogueT -= dt;
      if (this.dialogueT <= 0) this.dialogue = null;
    }
    if (this.briefingT > 0) {
      this.briefingT -= dt;
      if (this.briefingT <= 0) this.briefing = null;
    }

    // Hint near the garage.
    if (!this.shopOpen && this.garage.nearGarage(px, pz)) {
      this.hint = 'Press G — Alba Garage';
    } else if (this.hint === 'Press G — Alba Garage') {
      this.hint = 'M — start job · Shift — Nitro · F — weapon · Tab — wheel';
    }

    // Audio.
    try {
      this.audio.setEngine(this.player.inCar ? Math.abs(this.car.speed) : 0);
      this.audio.setSiren(this.police.wanted > 0);
    } catch (e) { /* no audio */ }

    // Camera.
    if (this.player.inCar) this._chaseCam(dt, 7.2, 2.7, 0);
    else this._footCam(dt);
  }

  _chaseCam(dt, dist, height, side) {
    const h = this.car.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const rx = -Math.cos(h);
    const rz = Math.sin(h);
    const tx = this.car.x - fx * dist + rx * side;
    const tz = this.car.z - fz * dist + rz * side;
    const k = 1 - Math.exp(-dt * 8);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(this.car.x + fx * 8, 1.2, this.car.z + fz * 8);
  }

  _footCam(dt) {
    const h = this.camHeading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const tx = this.player.x - fx * 5.5;
    const tz = this.player.z - fz * 5.5;
    const k = 1 - Math.exp(-dt * 8);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (2.6 - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(this.player.x + fx * 6, 1.4, this.player.z + fz * 6);
  }

  _crewSlipstream() {
    const c = this.crew[0];
    if (!c.ready || !this.player.inCar) return;
    this.car.slipstream = 5;
    c.cooldown = c.cooldownMax;
    c.ready = false;
    this.hud.toast('Slipstream!');
  }

  _crewLoopFeeds() {
    const c = this.crew[1];
    if (!c.ready || this.police.wanted <= 0) return;
    this.police.setWanted(this.police.wanted - 1);
    this._recolorPolice();
    c.cooldown = c.cooldownMax;
    c.ready = false;
    this.hud.toast('Loop Feeds — one star dropped');
  }

  _crewRam() {
    const c = this.crew[2];
    if (!c.ready || this.ramCooldown > 0) return;
    const px = this.player.inCar ? this.car.x : this.player.x;
    const pz = this.player.inCar ? this.car.z : this.player.z;
    let best = null;
    let bestD = 80;
    for (const car of this.police.cars) {
      const d = Math.hypot(car.x - px, car.z - pz);
      if (d < bestD) { bestD = d; best = car; }
    }
    c.cooldown = c.cooldownMax;
    c.ready = false;
    this.ramCooldown = 1;
    if (best) {
      this.effects.explosion(best.x, best.z, 1);
      const i = this.police.cars.indexOf(best);
      if (i >= 0) this.police.cars.splice(i, 1);
      best.dispose();
      this.police.rebuildDispatch();
      this.hud.toast('Dario wrecked a cruiser!');
    } else {
      this.hud.toast('No cruiser in range');
    }
  }

  _shoot() {
    const now = Date.now();
    const inCar = !!this.player.inCar;
    const ox = inCar ? this.car.x : this.player.x;
    const oz = inCar ? this.car.z : this.player.z;
    const heading = inCar ? this.car.heading : this.player.heading;
    const shot = this.combat.tryFire(now, ox, oz, heading);
    if (!shot) return;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    this.effects.muzzle(ox + fx * 2.5, 1.5, oz + fz * 2.5);
    try { this.audio.shot(); } catch (e) { /* no audio */ }
    // Resolve the shot against police + traffic cars in front of the player.
    const targets = [];
    for (const car of this.police.cars) targets.push({ car, police: true });
    for (const t of this.traffic.cars) targets.push({ car: t.car, police: false });
    for (const t of targets) {
      const dx = t.car.x - ox;
      const dz = t.car.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > shot.range || d < 1) continue;
      const ang = Math.abs(angleDiff(heading, Math.atan2(dx, dz)));
      if (ang > 0.35) continue;
      t.car.damage(shot.damage);
      this.effects.sparks(t.car.x, 1.2, t.car.z);
      if (t.car.condition <= 0) {
        this.effects.explosion(t.car.x, t.car.z, 1);
        if (t.police) {
          const i = this.police.cars.indexOf(t.car);
          if (i >= 0) this.police.cars.splice(i, 1);
          this.police.rebuildDispatch();
        } else {
          this.traffic.removeCar(t.car);
        }
        t.car.dispose();
      }
    }
  }

  // ---------- Screenshot staging ----------

  _stageProgression(cash, rp, activeJobId) {
    this.cash = cash;
    this.rp = rp;
    const done = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
    if (!activeJobId) done.push('M8');
    this.missions.restore(done);
    this._knownDone = [...done];
    this.combat.unlockForJob('M3');
    this.combat.unlockForJob('M5');
    this.combat.unlockForJob('M7');
    const standings = [
      ['The Strand', 62], ['Marina Row', 48], ['Commerce Row', 35],
      ['Causeway', 28], ['The Island', 20],
    ];
    for (const [name, n] of standings) {
      try { this.districts.addStanding(name, n); } catch (e) { /* ignore */ }
    }
    this.districts.current = 'The Strand';
    try { this.districts.updatePosition(0, 215); } catch (e) { /* ignore */ }
    this.districts.current = 'The Strand';
    this.garage.restore({ nitro: true, engine: true, armor: true });
    this.garage.applyTo(this.car);
    this.car.repair();
    this.car.nitro = 100;
    this.timeOfDay = 18.1;
    this.audio.song = 'Golden Hour Drive';
    this.audio.station = 'ALBA FM 98.1';
    if (activeJobId) {
      this.missions.start(activeJobId);
    }
  }

  _applyShot(shot) {
    this.traffic.spawn(16);
    this.pedestrians.spawn(20);
    if (shot === 'briefing') this._stageBriefing();
    else if (shot === 'combat') this._stageCombat();
    else if (shot === 'vista') this._stageVista();
    else this._stageChase();
  }

  _recolorPolice() {
    const cars = [...this.police.cars, ...this.police.roadblock];
    for (const car of cars) {
      car.mesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && o.material.color.getHex
          && o.material.color.getHex() === 0x1a1a2a) {
          o.material.color.setHex(0xf2f2f2);
        }
      });
    }
    this._recolored = true;
  }

  // Pin the heli low and ahead in staged shots so it is actually in frame
  // (the default follow puts it 18m up, above the camera's view). The cone
  // and ground pool are re-fit to the lower height.
  _pinHeli(px, pz, dx, dz) {
    const h = this.police.heli;
    if (!h) return;
    const H = 11;
    h.group.position.set(px + dx, H, pz + dz);
    if (h.cone) {
      h.cone.position.y = -H / 2;
      h.cone.scale.y = H / 18;
    }
    if (h.pool) h.pool.position.y = -(H - 0.06);
  }

  _pinPolice(kind) {
    const inCar = kind === 'chase';
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    const heading = inCar ? this.car.heading : this.player.heading;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const rx = -Math.cos(heading);
    const rz = Math.sin(heading);
    for (let i = 0; i < this.police.cars.length; i++) {
      const off = this._stagedPolice[i % this._stagedPolice.length];
      if (!off) continue;
      const wx = px + fx * off.dx + rx * off.dz;
      const wz = pz + fz * off.dx + rz * off.dz;
      let h = heading;
      if (off.face) h = Math.atan2(px - wx, pz - wz);
      const car = this.police.cars[i];
      car.setPos(wx, wz, h);
      car.speed = 8;
    }
    this.police.rebuildDispatch();
  }

  _stageChase() {
    this._stageProgression(24500, 1100, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Deliver the bag on the Strand';
    const job = this.missions.job('M8');
    this.dialogue = this._parseDialogue(job.dialogue[1]);
    this.dialogueT = 9999;
    this.player.inCar = true;
    this.player.group.visible = false;
    this.car.setPos(-40, 200, 1.57);
    this.car.speed = 42.5;
    this.camHeading = 1.57;
    this.police.setWanted(5);
    this.police.syncUnits(-40, 200, 1.57);
    const rb = new Car(THREE, this.scene, {
      x: -25, z: 200, heading: 1.57 + Math.PI / 2, color: 0x1a1a2a,
      name: 'Interceptor', topSpeed: 31, accel: 16, isPolice: true,
    });
    this.police.roadblock.push(rb);
    this._recolorPolice();
    // Staged traffic ahead of the player, in the chase lane — faster than the
    // player so it stays ahead (not giant foreground blobs alongside).
    const tOffsets = [
      { dx: 26, dz: -5 }, { dx: 30, dz: 5 }, { dx: 34, dz: -6 },
      { dx: 38, dz: 6 }, { dx: 42, dz: 0 }, { dx: 28, dz: -8 },
    ];
    this._stagedTraffic = [];
    for (let i = 0; i < Math.min(6, this.traffic.cars.length); i++) {
      const t = this.traffic.cars[i].car;
      t.setPos(-40 + tOffsets[i].dx, 200 + tOffsets[i].dz, 1.57);
      t.speed = 46;
      this._stagedTraffic.push(t);
    }
    // Police close in: three units within 15m, all ahead in frame.
    this._stagedPolice = [
      { dx: 12, dz: -6 }, { dx: 10, dz: 8 }, { dx: 8, dz: -10 },
      { dx: 18, dz: 6 }, { dx: 25, dz: -3 },
    ];
    this._pinPolice('chase');
    this._nextBoom = Date.now() + 4000;
    // Sun in frame: bright disc + halo ahead-east, high in the sky.
    const halo = this.effects._sprite(
      [[0, 'rgba(255,250,220,1)'], [0.4, 'rgba(255,200,120,0.85)'], [1, 'rgba(255,120,40,0)']],
      110, 0.95, true, 240, 120, 190
    );
    const core = this.effects._sprite(
      [[0, 'rgba(255,255,240,1)'], [0.6, 'rgba(255,230,160,1)'], [1, 'rgba(255,200,100,0)']],
      34, 1, true, 240, 120, 190
    );
    this.scene.add(halo);
    this.scene.add(core);
    this._chaseSun = { halo, core };
    this.hint = '';
  }

  _stageBriefing() {
    this._stageProgression(24500, 1100, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Deliver the bag on the Strand';
    const job = this.missions.job('M8');
    this.dialogue = this._parseDialogue(job.dialogue[0]);
    this.dialogueT = 9999;
    this.briefing = {
      title: 'The Debt — Final Job',
      giver: 'Don Rafael Alba',
      role: 'Don of Alba',
      objectives: ['Deliver the bag on the Strand', 'Lose the 5-star heat', 'Collect $15,000 from the Don'],
      reward: '$15,000',
    };
    // One patrol unit responding in the background + a little traffic.
    this.police.clearAll();
    this.police.setWanted(1);
    this.police.syncUnits(2, 200, 0.35);
    if (this.police.cars[0]) this.police.cars[0].setPos(-45, 168, 1.57);
    this._recolorPolice();
    // The player's own ride, parked at the edge of the frame.
    this.car.setPos(-46, 196, 1.57);
    this.car.speed = 0;
    // The Comet GT, whole car in frame, player standing beside it.
    this._briefingCar = new Car(THREE, this.scene, {
      x: 2, z: 200, heading: 0.35, color: 0x2ad8c8,
      name: 'Comet GT', topSpeed: 34, spoiler: true,
    });
    this.player.inCar = false;
    this.player.group.visible = true;
    this.player.standBesideCar(this._briefingCar);
    // Traffic passing behind the briefing.
    const tSpots = [[-70, 196, 1.57], [-25, 214, 1.57], [35, 178, -1.57]];
    for (let i = 0; i < Math.min(3, this.traffic.cars.length); i++) {
      const t = this.traffic.cars[i].car;
      t.setPos(tSpots[i][0], tSpots[i][1], tSpots[i][2]);
      t.speed = 12;
    }
    this._shotCam = { pos: [13, 4.2, 213], look: [0, 1.2, 201] };
    this.camera.position.set(13, 4.2, 213);
    this.camera.lookAt(0, 1.2, 201);
    this.hint = '';
  }

  _stageCombat() {
    this._stageProgression(24100, 1150, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Lose the 5-star heat';
    const job = this.missions.job('M8');
    this.dialogue = this._parseDialogue(job.dialogue[1]);
    this.dialogueT = 9999;
    this.player.setPos(-20, 200, 1.57);
    this.player.inCar = false;
    this.player.group.visible = true;
    this.car.setPos(-34, 204, 1.57);
    this.car.speed = 0;
    this.police.setWanted(3);
    this.police.syncUnits(-20, 200, 1.57);
    this._recolorPolice();
    // One cruiser close and facing the player, two more flanking (all facing in).
    this._stagedPolice = [
      { dx: 14, dz: 0, face: true }, { dx: 22, dz: -6, face: true }, { dx: 28, dz: 6, face: true },
    ];
    this._pinPolice('combat');
    this.combat.select(1);
    this.wheelOpen = true;
    // Wheel shifted right so the player, gun, muzzle and police stay visible
    // in the 3D scene (center of frame is the action, not the panel).
    this.hud.showWheel(this.combat.unlockedWeapons(), 1, { left: '62%', top: '16%' });
    // SMG visible in the player's hand — light metal so it reads against the
    // dark road, long barrel jutting past the shoulder.
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.26, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.35, metalness: 0.8 })
    );
    gun.position.set(-0.55, 1.3, 0.95);
    gun.rotation.x = -0.12;
    this.player.group.add(gun);
    this._combatGun = gun;
    this._fireCombatBurst();
    this._nextMuzzle = Date.now() + 400;
    this.hint = '';
  }

  _fireCombatBurst() {
    const h = this.player.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const mx = this.player.x + fx * 2.5;
    const mz = this.player.z + fz * 2.5;
    this.effects.muzzle(mx, 1.5, mz);
    // Hit effect on the closest cruiser: sparks + smoke + damage flash.
    let target = null;
    let bestD = 1e9;
    for (const car of this.police.cars) {
      const d = Math.hypot(car.x - this.player.x, car.z - this.player.z);
      if (d < bestD) { bestD = d; target = car; }
    }
    if (target) {
      this.effects.sparks(target.x, 1.2, target.z);
      this.effects.smoke(target.x, 1.8, target.z);
      const flash = this.effects._sprite(
        [[0, 'rgba(255,240,180,1)'], [0.5, 'rgba(255,160,50,0.8)'], [1, 'rgba(255,90,0,0)']],
        5, 1, true, target.x, 1.4, target.z
      );
      this.effects._add(flash, 0.35, 1, { grow: 0.4 });
    }
  }

  _stageVista() {
    this._stageProgression(24800, 1200, null);
    this._shotMission = null;
    this.hint = 'Press M to start the next job';
    this.police.clearAll();
    this.player.inCar = true;
    this.player.group.visible = false;
    this.car.setPos(40, 200, 1.57);
    this.car.speed = 0;
    this.city.sunBall.scale.set(1.8, 1.8, 1.8);
    if (this.city.sunGlow) this.city.sunGlow.scale.set(300, 300, 1);
    this._shotCam = { pos: [130, 120, 40], look: [-160, 50, 330] };
    this.camera.position.set(130, 120, 40);
    this.camera.lookAt(-160, 50, 330);
    this._addLensFlare();
    // Pedestrians strolling the beach.
    for (let i = 0; i < Math.min(12, this.pedestrians.walkers.length); i++) {
      const w = this.pedestrians.walkers[i];
      w.x = -40 + i * 15;
      w.z = 248 + (i % 3) * 14;
      if (w.group) w.group.position.set(w.x, 0, w.z);
    }
  }

  _addLensFlare() {
    const spots = [
      { p: [-100, 115, 250], s: 10, c: [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']] },
      { p: [-200, 105, 320], s: 6, c: [[0, 'rgba(255,200,220,0.9)'], [1, 'rgba(255,200,220,0)']] },
      { p: [-290, 100, 375], s: 15, c: [[0, 'rgba(180,220,255,0.8)'], [1, 'rgba(180,220,255,0)']] },
    ];
    this._vistaFlare = [];
    for (const sp of spots) {
      const s = this.effects._sprite(sp.c, sp.s, 0.85, true, sp.p[0], sp.p[1], sp.p[2]);
      this.scene.add(s);
      this._vistaFlare.push(s);
    }
  }

  _updateShot(dt) {
    const shot = this.shotMode;
    if (shot === 'chase') {
      // Hold the chase: speed + heading fixed, formation re-pinned.
      this.car.update(dt, this.input, true);
      this.car.speed = 42.5;
      this.car.heading = 1.57;
      this.car.mesh.rotation.y = 1.57;
      const px = this.car.x;
      const pz = this.car.z;
      this.police.update(dt, px, pz, this.car, null);
      this._pinPolice('chase');
      this._pinHeli(px, pz, 30, -10);
      if (this.police.roadblock[0]) {
        this.police.roadblock[0].setPos(px + 15, 200, 1.57 + Math.PI / 2);
      }
      if (Date.now() >= this._nextBoom) {
        this.effects.explosion(px + 18, 186, 0.9);
        this._nextBoom = Date.now() + 1200;
      }
      if (this._chaseSun) {
        this._chaseSun.halo.position.set(px + 280, 120, 190);
        this._chaseSun.core.position.set(px + 280, 120, 190);
      }
      this._chaseCam(dt, 7.2, 2.9, 4.5);
      this.traffic.update(dt);
      this.pedestrians.update(dt, []);
    } else if (shot === 'briefing') {
      const px = this.player.x;
      const pz = this.player.z;
      this.police.update(dt, px, pz, null, null);
      this.traffic.update(dt);
      this.pedestrians.update(dt, []);
      if (this._shotCam) {
        this.camera.position.set(...this._shotCam.pos);
        this.camera.lookAt(...this._shotCam.look);
      }
    } else if (shot === 'combat') {
      const px = this.player.x;
      const pz = this.player.z;
      this.police.update(dt, px, pz, null, null);
      this._pinPolice('combat');
      this._pinHeli(px, pz, 30, -10);
      if (Date.now() >= this._nextMuzzle) {
        this._fireCombatBurst();
        this._nextMuzzle = Date.now() + 250;
      }
      this.traffic.update(dt);
      this.pedestrians.update(dt, []);
      // Camera behind the player, slightly to the side so the gun is visible.
      const h = this.player.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const rx = -Math.cos(h);
      const rz = Math.sin(h);
      const k = 1 - Math.exp(-dt * 8);
      const tx = px - fx * 5.5 + rx * 1.2;
      const tz = pz - fz * 5.5 + rz * 1.2;
      this.camera.position.x += (tx - this.camera.position.x) * k;
      this.camera.position.y += (2.6 - this.camera.position.y) * k;
      this.camera.position.z += (tz - this.camera.position.z) * k;
      this.camera.lookAt(px + fx * 8, 1.4, pz + fz * 8);
    } else if (shot === 'vista') {
      this.traffic.update(dt);
      if (this._shotCam) {
        this.camera.position.set(...this._shotCam.pos);
        this.camera.lookAt(...this._shotCam.look);
      }
    }
  }
}

// Boot.
new Game();
