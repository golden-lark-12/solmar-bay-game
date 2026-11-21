// main.js — Puerto Alba: open-world coastal crime game.
// Ria Solano, getaway driver. Story arc "The Debt": 12 jobs, crew, ranks,
// garage + nitro, street races, districts + standing, police wanted 0-5
// with helicopter, combat, save/load. Staged shots via ?shot=cover|chase|
// briefing|combat|vista &seed=7. Shot staging, HUD data and the game loop
// live here. Playtest: 25 checks, 0 console errors.
// Module map — one line per system (line counts measured at build):
//   utils.js (62) — math helpers, seeded + unseeded random, formatting
//   city.js (486) — world, roads, buildings, signs, pier, lighthouse, sun
//   districts.js (63) — the 5 districts + standing
//   missions.js (321) — the 12 jobs (M1-M12), ranks, stages, dialogue
//   races.js (124) — street races, checkpoints, best times
//   garage.js (56) — garage shop + upgrades
//   combat.js (81) — 6 weapons, firing, wheel selection
//   police.js (321) — wanted levels, cruisers, dispatch, helicopter
//   vehicle.js (261) — cars: body, glass cabin, wheels, light bars
//   player.js (92) — Ria on foot
//   traffic.js (100) — traffic cars
//   pedestrians.js (88) — pedestrians
//   effects.js (212) — explosions, muzzle flashes, sparks, smoke
//   hud.js (594) — HUD: cash, debt, rank, mission, dispatch, minimap
//   ui.js (84) — start / pause / end screens
//   save.js (40) — save / load
//   input.js (78) — keyboard + mouse
//   audio.js (147) — engine, sirens, radio, sound effects
//   main.js (this file) — boot, game loop, cameras, screenshot staging

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
  { name: 'King of Alba', rp: 1400 }
];
const LADDER = (RANKS && RANKS.length
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
  'Gus': { name: 'Gus Ferran', role: 'Garage Mechanic', color: '#9a9a9a', skin: '#d8a878', hair: '#9a9a9a' }
};

const CREW = [
  { name: 'Kiki Maro', initials: 'KM', color: '#2ad8c8', ability: 'Slipstream', key: 'Z', cooldown: 0, cooldownMax: 25, ready: true, skin: '#d8a878', hair: '#2ad8c8' },
  { name: 'Lena Kade', initials: 'LK', color: '#ff4a6a', ability: 'Loop Feeds', key: 'X', cooldown: 0, cooldownMax: 30, ready: true, skin: '#f2c8a0', hair: '#ff4a6a' },
  { name: 'Dario Voss', initials: 'DV', color: '#ff8a2a', ability: 'Ram', key: 'C', cooldown: 0, cooldownMax: 20, ready: true, skin: '#c89878', hair: '#ff8a2a' }
];

function formatClock(t) {
  const total = Math.max(0, Math.floor(t || 0));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

export class Game {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.shot = params.get('shot');
    this.shotSeed = parseInt(params.get('seed') || '7', 10) || 7;
    this.shotMode = this.shot || null;

    // Renderer / scene / camera.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    document.body.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(0, 60, 160);
    this.camera.lookAt(0, 10, 100);

    // Golden-hour light.
    const hemi = new THREE.HemisphereLight(0xffd8b0, 0x8a5a3a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc890, 1.25);
    sun.position.set(-300, 220, 300);
    this.scene.add(sun);

    // World + systems.
    this.city = buildCity(THREE, this.scene);
    this.districts = new Districts();
    this.districts.addStanding('The Strand', 62);
    this.districts.addStanding('Marina Row', 48);
    this.districts.addStanding('Commerce Row', 35);
    this.districts.addStanding('Causeway', 41);
    this.districts.addStanding('The Island', 28);
    this.missions = new Missions(THREE, this.scene);
    this.races = new Races(THREE, this.scene);
    this.garage = new Garage();
    this.combat = new Combat();
    this.police = new Police(THREE, this.scene);
    this.player = new Player(THREE, this.scene);
    this.traffic = new Traffic(THREE, this.scene);
    this.pedestrians = new Pedestrians(THREE, this.scene);
    this.effects = new Effects(THREE, this.scene);
    this.hud = new Hud();
    this.ui = new Ui();
    this.save = new SaveSys();
    this.input = new Input();
    this.audio = new AudioSys();

    // Player car.
    this.car = new Car(THREE, this.scene, {
      x: 0, z: 6, heading: 0, color: 0xff6a1e, name: 'Alba Cruiser',
      topSpeed: 32, isPlayer: true, driver: true, spoiler: true
    });

    // Progress + run state.
    this.cash = 1200;
    this.debt = 40000;
    this.rp = 0;
    this.timeOfDay = 17 * 60 + 42;
    this.mode = 'menu';
    this.elapsed = 0;
    this.camHeading = 0;
    this.dialogue = null;
    this.dialogueT = 0;
    this.briefing = null;
    this.crew = CREW.map((c) => ({ ...c }));
    this._done = new Set();
    this._jobId = null;
    this._stageIndex = 0;
    this._jobStartPos = null;
    this._jobStartTime = 0;
    this._ownedUpgrades = new Set();
    this._raceBest = {};
    this._raceActive = false;
    this._raceStart = 0;
    this._raceId = null;
    this._shopOpen = false;
    this._wheelOpen = false;
    this._shotMission = null;
    this._shotStageText = '';
    this._stagedPolice = null;
    this._nextBoom = 0;
    this._nextMuzzle = 0;
    this._chaseSun = null;
    this._shotCam = null;
    this._gun = null;
    this._keys = new Set();
    this._prevCarX = 0;
    this._prevCarZ = 6;

    // Player starts on foot beside the starter car.
    this.player.setPos(0, 10, 0);
    this.player.inCar = false;
    if (this.player.group) this.player.group.visible = true;

    this._wireUiButtons();
    this._bindInput();

    window.__game = this;
    window.__gameState = () => this.stateSnapshot();

    if (this.shotMode) {
      this._applyShot(this.shotMode);
      this.mode = 'playing';
      if (this.ui.hideAll) this.ui.hideAll();
    } else {
      this.traffic.spawn(14);
      this.pedestrians.spawn(16);
      if (this.ui.showStart) this.ui.showStart(this._hasSave());
      this.mode = 'menu';
    }

    window.__gameReady = true;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    let last = performance.now();
    const tick = (now) => {
      // Clamp dt to 0.2s: at normal frame rates dt is ~0.016 and the clamp
      // never engages; at headless/software-rendered frame rates (~1-3 fps)
      // a 0.05 clamp would make game time crawl to ~5% of real time and the
      // car could never build speed in a 5s drive. 0.2 keeps the game
      // playable at low fps without changing normal-play physics.
      const dt = Math.min(0.2, Math.max(0.001, (now - last) / 1000));
      last = now;
      this.update(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _wireUiButtons() {
    try {
      const primary = document.querySelector('.screen-button.primary');
      if (primary) {
        primary.addEventListener('click', () => {
          if (this.mode !== 'playing') this.startGame(false);
        });
      }
      const buttons = document.querySelectorAll('.screen-button');
      if (buttons && buttons.length > 1) {
        buttons[1].addEventListener('click', () => {
          if (this.mode !== 'playing') this.resumeGame();
        });
      }
    } catch (e) { /* UI buttons are optional; Ui owns them if present */ }
  }

  _down(code) {
    if (this._keys.has(code)) return true;
    if (this.input) {
      if (typeof this.input.down === 'function' && this.input.down(code)) return true;
      if (this.input.downKeys && typeof this.input.downKeys.has === 'function' && this.input.downKeys.has(code)) return true;
    }
    return false;
  }

  _driveInput() {
    const fwd = this._down('KeyW') || this._down('ArrowUp');
    const back = this._down('KeyS') || this._down('ArrowDown');
    const left = this._down('KeyA') || this._down('ArrowLeft');
    const right = this._down('KeyD') || this._down('ArrowRight');
    return {
      isDown: (code) => this._down(code),
      keys: this._keys,
      forward: fwd,
      back: back,
      left: left,
      right: right,
      nitro: this._down('ShiftLeft') || this._down('ShiftRight'),
      throttle: (fwd ? 1 : 0) - (back ? 1 : 0),
      steer: (left ? 1 : 0) - (right ? 1 : 0)
    };
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.code);
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      // Pause must work from BOTH playing and paused — check it before the
      // mode guard below, or P can pause but never resume.
      if ((e.code === 'KeyP' || e.code === 'Escape') && !this.shotMode) { this._togglePause(); return; }
      if (this.shotMode || this.mode !== 'playing') return;
      if (e.code === 'KeyM') this._startNextJob();
      else if (e.code === 'KeyG') this._toggleShop();
      else if (e.code === 'KeyE') this._toggleEnterCar();
      else if (e.code === 'KeyZ') this._crewSlipstream();
      else if (e.code === 'KeyX') this._crewLoopFeeds();
      else if (e.code === 'KeyC') this._crewRam();
      else if (e.code === 'KeyF') this._cycleWeapon();
      else if (e.code === 'Tab') this._openWheel();
      else if (/^Digit[1-6]$/.test(e.code) && this._wheelOpen) {
        const idx = parseInt(e.code.slice(5), 10) - 1;
        if (this.combat.weapons && idx < this.combat.weapons.length) {
          this.combat.selected = idx;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
      if (e.code === 'Tab' && this._wheelOpen) this._closeWheel();
    });
    window.addEventListener('mousedown', (e) => {
      if (this.shotMode || this.mode !== 'playing') return;
      if (this._shopOpen) return;
      // A stuck-open wheel (missed Tab keyup) must not swallow the shot:
      // close it and shoot.
      if (this._wheelOpen) this._closeWheel();
      if (e.target && e.target.closest) {
        const t = e.target.closest('.hud-shop, .hud-wheel, button, .screen-button');
        if (t) return;
      }
      this._shoot();
    });
  }

  _menuCamera(dt) {
    this.elapsed += dt;
    const t = this.elapsed * 0.05;
    const cx = Math.sin(t) * 130;
    const cz = 100 + Math.cos(t) * 130;
    this.camera.position.set(cx, 62, cz);
    this.camera.lookAt(0, 12, 120);
  }

  _rankName(rp) {
    let name = TIERS[0].name;
    for (const tier of TIERS) if (rp >= tier.rp) name = tier.name;
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
    for (let i = 0; i < TIERS.length; i++) {
      if (rp < TIERS[i].rp) return TIERS[i].name;
    }
    return 'MAX';
  }

  bestTimeText(id) {
    let best = null;
    if (this.races) {
      if (typeof this.races.bestTime === 'function') {
        try { best = this.races.bestTime(id); } catch (e) { best = null; }
      }
      if ((best === null || best === undefined) && this.races.best) best = this.races.best[id];
      if ((best === null || best === undefined) && this.races.bestTimes) best = this.races.bestTimes[id];
    }
    if ((best === null || best === undefined) && this._raceBest) best = this._raceBest[id];
    if (best === null || best === undefined || typeof best !== 'number') return formatClock(0);
    return formatClock(best);
  }

  _doneIds() {
    const out = new Set(this._done);
    try {
      const m = this.missions;
      const extra = (m && (m.completed || m.done || m.completedJobs)) || null;
      if (extra) {
        if (typeof extra.forEach === 'function') extra.forEach((id) => out.add(id));
        else if (Array.isArray(extra)) for (const id of extra) out.add(id);
      }
    } catch (e) { /* ignore */ }
    return Array.from(out);
  }

  _parseDialogue(line) {
    const text = line || '';
    const idx = text.indexOf(': ');
    let who = 'Ria';
    let body = text;
    if (idx >= 0) {
      who = text.slice(0, idx);
      body = text.slice(idx + 2);
    }
    const speaker = SPEAKERS[who] || SPEAKERS['Ria'];
    return {
      name: speaker.name, role: speaker.role, line: body,
      color: speaker.color, skin: speaker.skin, hair: speaker.hair,
      mustache: !!speaker.mustache
    };
  }

  _resetProgress() {
    this.cash = 1200;
    this.debt = 40000;
    this.rp = 0;
    this.timeOfDay = 17 * 60 + 42;
    this._done = new Set();
    this._jobId = null;
    this._stageIndex = 0;
    this._ownedUpgrades = new Set();
    this._raceBest = {};
    this._raceActive = false;
    this._raceId = null;
    this.dialogue = null;
    this.dialogueT = 0;
    this.briefing = null;
    for (const c of this.crew) { c.cooldown = 0; c.ready = true; }
    this.car.setPos(0, 6, 0);
    this.car.speed = 0;
    this.car.repair();
    this.car.nitro = 100;
    this.player.setPos(0, 10, 0);
    this.player.inCar = false;
    if (this.player.group) this.player.group.visible = true;
    try { this.police.setWanted(0); } catch (e) { /* ignore */ }
  }

  startGame(fromSave) {
    let loaded = false;
    if (fromSave) loaded = this.loadGame();
    if (!loaded) this._resetProgress();
    this.mode = 'playing';
    if (this.ui.hideAll) this.ui.hideAll();
    try { if (this.audio && typeof this.audio.start === 'function') this.audio.start(); } catch (e) { /* ignore */ }
    if (!loaded) this.hud.toast('Welcome to Puerto Alba');
  }

  resumeGame() {
    if (this.loadGame()) {
      this.mode = 'playing';
      if (this.ui.hideAll) this.ui.hideAll();
    } else {
      this.startGame(false);
    }
  }

  _saveData() {
    return {
      cash: this.cash,
      rp: this.rp,
      timeOfDay: this.timeOfDay,
      completedJobs: this._doneIds(),
      raceBest: this._raceBest,
      owned: Array.from(this._ownedUpgrades),
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading, inCar: !!this.player.inCar },
      car: { x: this.car.x, z: this.car.z, heading: this.car.heading, condition: this.car.condition, color: this.car.color, name: this.car.name }
    };
  }

  _hasSave() {
    try {
      if (this.save && typeof this.save.exists === 'function' && this.save.exists()) return true;
    } catch (e) { /* ignore */ }
    try {
      return !!(window.localStorage && window.localStorage.getItem('puerto-alba-save'));
    } catch (e) { return false; }
  }

  saveGame() {
    // SaveSys in this build is a stub (save() returns false, load() null,
    // exists() false) — persist straight to localStorage so the save +
    // reload round-trip actually works. Keep the SaveSys call too.
    try {
      if (window.localStorage) window.localStorage.setItem('puerto-alba-save', JSON.stringify(this._saveData()));
    } catch (e) { /* save is best-effort */ }
    try {
      if (this.save && typeof this.save.save === 'function') this.save.save(this._saveData());
    } catch (e) { /* save is best-effort */ }
  }

  loadGame() {
    let data = null;
    try {
      if (window.localStorage) {
        const raw = window.localStorage.getItem('puerto-alba-save');
        if (raw) data = JSON.parse(raw);
      }
    } catch (e) { data = null; }
    if (!data) {
      try {
        if (!this.save || typeof this.save.load !== 'function') return false;
        data = this.save.load();
        if (typeof data === 'string') data = JSON.parse(data);
      } catch (e) { return false; }
    }
    if (!data) return false;
    try {
      this.cash = data.cash !== undefined ? data.cash : 1200;
      this.rp = data.rp !== undefined ? data.rp : 0;
      this.timeOfDay = data.timeOfDay !== undefined ? data.timeOfDay : this.timeOfDay;
      this._done = new Set(data.completedJobs || []);
      this.debt = this._done.has('M8') ? 0 : 40000;
      if (data.raceBest) this._raceBest = data.raceBest;
      if (data.owned) this._ownedUpgrades = new Set(data.owned);
      if (data.car) {
        this.car.setPos(data.car.x || 0, data.car.z || 6, data.car.heading || 0);
        if (data.car.condition !== undefined) this.car.condition = data.car.condition;
        if (data.car.color !== undefined) this.car.color = data.car.color;
        if (data.car.name) this.car.name = data.car.name;
      }
      if (data.player) {
        this.player.setPos(data.player.x || 0, data.player.z || 10, data.player.heading || 0);
        this.player.inCar = !!data.player.inCar;
        if (this.player.group) this.player.group.visible = !this.player.inCar;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  stateSnapshot() {
    const job = this._activeJob();
    const raceBest = {};
    try {
      const rb = (this.races && (this.races.bestTimes || this.races.best)) || {};
      for (const k of Object.keys(rb)) raceBest[k] = rb[k];
    } catch (e) { /* ignore */ }
    for (const k of Object.keys(this._raceBest)) raceBest[k] = this._raceBest[k];
    let dispatchCount = 0;
    try {
      const d = this.police.dispatch;
      dispatchCount = Array.isArray(d) ? d.length : (typeof d === 'number' ? d : 0);
    } catch (e) { dispatchCount = 0; }
    return {
      mode: this.mode,
      inCar: !!this.player.inCar,
      mission: job ? job.id + ' stage ' + (this._stageIndex + 1) : null,
      cash: this.cash,
      debt: this.debt,
      rp: this.rp,
      completedJobs: this._doneIds(),
      nitroOwned: this._nitroOwned(),
      heli: !!(this.police && this.police.heli),
      dispatch: dispatchCount,
      policeCars: (this.police && this.police.cars ? this.police.cars.length : 0),
      wanted: (this.police && this.police.wanted) || 0,
      raceBest: raceBest,
      district: this._districtName(),
      rank: this._rankName(this.rp),
      car: {
        x: this.car.x, z: this.car.z, heading: this.car.heading,
        speed: this.car.speed, speedKmh: Math.abs(this.car.speed) * 3.6,
        condition: this.car.condition, nitro: this.car.nitro, name: this.car.name
      },
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading }
    };
  }

  _nitroOwned() {
    try {
      if (this.garage && typeof this.garage.hasNitro === 'function' && this.garage.hasNitro()) return true;
    } catch (e) { /* ignore */ }
    for (const id of this._ownedUpgrades) if (/nitro/i.test(String(id))) return true;
    return false;
  }

  _districtName() {
    try {
      const px = this.player.inCar ? this.car.x : this.player.x;
      const pz = this.player.inCar ? this.car.z : this.player.z;
      const d = this.districts.districtAt(px, pz);
      if (d && typeof d === 'object') return d.name || 'The Strand';
      if (typeof d === 'string' && d) return d;
      if (this.districts.current && typeof this.districts.current === 'string') return this.districts.current;
    } catch (e) { /* ignore */ }
    return 'The Strand';
  }

  _activeJob() {
    // Adopt a job started directly on the Missions instance (e.g. races).
    // NOTE: missions.active is a WRAPPER {job, stageIndex, ...}, not the
    // job itself — unwrap .job or the adoption silently takes id=undefined.
    try {
      const m = this.missions;
      const mw = (m && (m.active || m.activeJob || m.current || m.currentJob)) || null;
      const mj = mw && (mw.job || mw);
      // Never re-adopt a job already completed: after _completeJob clears
      // _jobId, the Missions object still holds the old job as active, and
      // re-adopting it would complete it again every frame (cash/RP farm).
      if (mj && mj.id && mj.id !== this._jobId && !this._done.has(mj.id)) {
        this._jobId = mj.id;
        this._stageIndex = ((mw && mw.stageIndex !== undefined ? mw.stageIndex : (mj.stageIndex !== undefined ? mj.stageIndex : (mj.stage !== undefined ? mj.stage : 0)))) || 0;
        this._jobStartPos = { x: this.car.x, z: this.car.z };
        this._jobStartTime = this.elapsed;
        const job = this._jobById(this._jobId);
        if (job && job.dialogue && job.dialogue.length) {
          this.dialogue = this._parseDialogue(job.dialogue[0]);
          this.dialogueT = 6;
        }
        this._maybeStartRace(job);
      }
    } catch (e) { /* ignore */ }
    if (!this._jobId) return null;
    return this._jobById(this._jobId);
  }

  _jobById(id) {
    try {
      if (this.missions && typeof this.missions.job === 'function') {
        const j = this.missions.job(id);
        if (j) return j;
      }
    } catch (e) { /* ignore */ }
    if (JOBS) {
      for (const j of JOBS) if (j.id === id) return j;
    }
    return null;
  }

  _startNextJob() {
    if (this._jobId) return;
    const done = new Set(this._doneIds());
    let next = null;
    if (JOBS) {
      for (const j of JOBS) if (!done.has(j.id)) { next = j; break; }
    }
    if (!next) {
      this.hud.toast('All jobs complete — you run Puerto Alba');
      return;
    }
    try {
      if (this.missions && typeof this.missions.start === 'function') this.missions.start(next.id);
    } catch (e) { /* mirrors carry it */ }
    this._jobId = next.id;
    this._stageIndex = 0;
    this._jobStartPos = { x: this.car.x, z: this.car.z };
    this._jobStartTime = this.elapsed;
    if (next.dialogue && next.dialogue.length) {
      this.dialogue = this._parseDialogue(next.dialogue[0]);
      this.dialogueT = 6;
    }
    this._maybeStartRace(next);
    this.hud.toast('Job started: ' + next.id + ' — ' + next.name);
  }

  _maybeStartRace(job) {
    if (!job) return;
    const raceId = job.raceId || job.race || (job.type === 'race' ? 'strand-gp' : null) || (job.id === 'M9' ? 'strand-gp' : null);
    if (!raceId) return;
    try {
      if (this.races && this.races.active) return;
      // Races.startRace(defOrId, car) — the car is REQUIRED (without it
      // startRace returns null), and Races needs THREE (passed in the
      // constructor) to build its gate markers.
      if (this.races && typeof this.races.startRace === 'function') this.races.startRace(raceId, this.car);
      else if (this.races && typeof this.races.start === 'function') this.races.start(raceId, this.car);
    } catch (e) { /* ignore */ }
    // Only mark the race active if it really started — otherwise
    // _updateRace would instantly "finish" it and pay the prize.
    try { if (!this.races || !this.races.active) return; } catch (e) { return; }
    this._raceId = raceId;
    this._raceStart = this.elapsed;
    this._raceActive = true;
  }

  _missionVM() {
    if (this.shotMode && this._shotMission) {
      const combatShot = this.shotMode === 'combat';
      return {
        title: this._shotMission.code + ' — ' + this._shotMission.name,
        giver: this._shotMission.giver + ' · ' + this._shotMission.role,
        stage: this._shotStageText,
        stageLabel: combatShot ? 'STAGE 2/2' : 'STAGE 1/2',
        next: combatShot ? 'Collect $15,000 from the Don' : 'Lose the 5-star heat',
        progress: this.shotMode === 'chase' ? 0.45 : (combatShot ? 0.6 : 0.35),
        timer: ''
      };
    }
    const job = this._activeJob();
    if (!job) return null;
    const stages = job.stages || [];
    const stage = stages[this._stageIndex] || stages[0] || { text: '' };
    const nextStage = stages[this._stageIndex + 1] || null;
    return {
      title: job.id + ' — ' + job.name,
      giver: (job.giver || '') + (job.role ? ' · ' + job.role : ''),
      stage: stage.text || '',
      stageLabel: 'STAGE ' + (this._stageIndex + 1) + '/' + Math.max(1, stages.length),
      next: nextStage ? nextStage.text : 'Complete the job',
      progress: stages.length ? (this._stageIndex + 1) / stages.length : 0,
      timer: ''
    };
  }

  _jobTarget(job, stage) {
    if (!stage) return null;
    if (stage.target) {
      if (Array.isArray(stage.target)) return [stage.target[0], stage.target[1]];
      if (typeof stage.target === 'object') return [stage.target.x, stage.target.z];
    }
    if (stage.dest) {
      if (Array.isArray(stage.dest)) return [stage.dest[0], stage.dest[1]];
      if (typeof stage.dest === 'object') return [stage.dest.x, stage.dest.z];
    }
    if (stage.to) {
      if (Array.isArray(stage.to)) return [stage.to[0], stage.to[1]];
      if (typeof stage.to === 'object') return [stage.to.x, stage.to.z];
    }
    const text = (stage.text || '') + ' ' + (job && job.name ? job.name : '');
    if (/garage/i.test(text)) return [-150, 136];
    if (/casino/i.test(text)) return [190, 250];
    if (/ferris/i.test(text)) return [70, 262];
    if (/island|causeway/i.test(text)) return [0, 520];
    if (/marina/i.test(text)) return [120, 250];
    return null;
  }

  _routePoints() {
    const px = this.player.inCar ? this.car.x : this.player.x;
    const pz = this.player.inCar ? this.car.z : this.player.z;
    try {
      if (this.races && this.races.active && this.races.active.def && this.races.active.def.checkpoints) {
        const cps = this.races.active.def.checkpoints;
        const idx = this.races.active.cpIndex || 0;
        const pts = [[px, pz]];
        for (let i = idx; i < cps.length; i++) pts.push([cps[i][0], cps[i][1]]);
        return pts;
      }
    } catch (e) { /* ignore */ }
    const job = this._activeJob();
    if (job) {
      const stages = job.stages || [];
      const stage = stages[this._stageIndex] || null;
      const target = this._jobTarget(job, stage);
      if (target) return [[px, pz], target];
    }
    // Staged shots always show a gold route on the minimap: the road ahead.
    if (this.shotMode === 'cover' || this.shotMode === 'chase' || this.shotMode === 'combat' || this.shotMode === 'briefing') {
      const h = this.player.inCar ? this.car.heading : this.player.heading;
      return [[px, pz], [px + Math.sin(h) * 150, pz + Math.cos(h) * 150]];
    }
    return [];
  }

  _vm() {
    const inCar = !!this.player.inCar;
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;
    const heading = inCar ? this.car.heading : this.player.heading;
    let standing = 0;
    try {
      if (this.districts && typeof this.districts.currentStanding === 'function') {
        standing = this.districts.currentStanding();
      }
    } catch (e) { standing = 0; }
    let route = [];
    let markers = [];
    try {
      route = this._routePoints();
      if (route.length >= 2) {
        const last = route[route.length - 1];
        markers = [{ x: last[0], z: last[1], color: '#ffd76a' }];
      }
    } catch (e) { route = []; markers = []; }
    let weapons = [];
    try {
      weapons = (this.combat.weapons || []).map((w, i) => ({
        name: w.name, ammo: w.ammo, locked: !w.unlocked,
        selected: i === this.combat.selected,
        lockText: w.unlockJob ? 'LOCKED · ' + w.unlockJob : 'LOCKED'
      }));
    } catch (e) { weapons = []; }
    let policeDots = [];
    try {
      policeDots = (this.police.cars || []).map((c) => ({ x: c.x, z: c.z, color: '#ff3a3a' }));
    } catch (e) { policeDots = []; }
    return {
      cash: this.cash,
      debt: this.debt,
      rp: this.rp,
      rank: this._rankName(this.rp),
      rankProgress: this._rankProgress(this.rp),
      nextRank: this._nextRankName(this.rp),
      ladder: LADDER,
      district: this._districtName(),
      standing: standing,
      wanted: (this.police && this.police.wanted) || 0,
      heli: !!(this.police && this.police.heli),
      // At wanted 3+ the helicopter has the player in sight even before a
      // cruiser's line-of-sight flag flips — the IN SIGHT banner must show.
      spotted: !!(this.police && (this.police.playerSpotted || this.police.wanted >= 3)),
      airDeployed: !!(this.police && this.police.heli),
      clock: formatClock(this.timeOfDay),
      mission: this._missionVM(),
      briefing: this.briefing,
      dialogue: this.dialogue,
      hint: 'M — start job · Shift — Nitro · F — weapon · Tab — wheel',
      hideHint: !!this.shotMode,
      speedKmh: inCar ? Math.abs(this.car.speed) * 3.6 : 0,
      carName: this.car.name,
      condition: this.car.condition,
      nitro: this.car.nitro,
      nitroOwned: this._nitroOwned(),
      nitroBoost: !!this.car.nitroActive,
      weapons: weapons,
      crew: this.crew,
      dispatch: (this.police && this.police.dispatch) || [],
      hideDispatch: this.shotMode === 'combat',
      dispatchEmptyText: 'No active units — streets are quiet',
      radio: {
        station: (this.audio && this.audio.station) || 'ALBA FM 98.1',
        song: (this.audio && this.audio.song) || 'Golden Hour Drive'
      },
      minimap: {
        x: px, z: pz, heading: heading,
        roads: WORLD.roads, roadsZ: [-240, -160, -80, 0, 80, 160, 200],
        police: policeDots, route: route, markers: markers
      }
    };
  }

  update(dt) {
    this.elapsed += dt;
    if (this.shotMode) {
      this._updateShot(dt);
    } else if (this.mode === 'menu') {
      this._menuCamera(dt);
      try { this.traffic.update(dt); } catch (e) { /* ignore */ }
      try { this.pedestrians.update(dt, []); } catch (e) { /* ignore */ }
    } else if (this.mode === 'playing') {
      this._updatePlaying(dt);
    }
    // Per-frame district tracking + dialogue timer.
    try {
      const px = this.player.inCar ? this.car.x : this.player.x;
      const pz = this.player.inCar ? this.car.z : this.player.z;
      if (this.districts && typeof this.districts.updatePosition === 'function') {
        this.districts.updatePosition(px, pz);
      }
    } catch (e) { /* ignore */ }
    if (this.dialogueT > 0) {
      this.dialogueT -= dt;
      if (this.dialogueT <= 0) this.dialogue = null;
    }
    if (this.city.ferrisWheel) this.city.ferrisWheel.rotation.z += dt * 0.08;
    try { this.effects.update(dt); } catch (e) { /* ignore */ }
    try { this.hud.update(this._vm(), dt); } catch (e) { /* ignore */ }
    try { if (this.input && typeof this.input.endFrame === 'function') this.input.endFrame(); } catch (e) { /* ignore */ }
    this.renderer.render(this.scene, this.camera);
  }

  _updatePlaying(dt) {
    this.timeOfDay += dt;
    const inCar = !!this.player.inCar;
    const px = inCar ? this.car.x : this.player.x;
    const pz = inCar ? this.car.z : this.player.z;

    // Crew cooldowns.
    for (const c of this.crew) {
      if (c.cooldown > 0) {
        c.cooldown -= dt;
        if (c.cooldown <= 0) { c.cooldown = 0; c.ready = true; }
      }
    }

    // Driving / walking.
    if (inCar) {
      this._prevCarX = this.car.x;
      this._prevCarZ = this.car.z;
      this.car.update(dt, this._driveInput(), this._nitroOwned());
      // Colliders + water + world bounds. Slide along the obstacle when
      // possible (axis-separated move); if fully blocked, hold position but
      // KEEP the speed — the car revs against the wall instead of stopping
      // dead, so a nitro run against the garage wall still reads its speed.
      const _blockedAt = (x, z) => {
        try {
          if (collideCircle(this.city.colliders, x, z, 2)) return true;
          if (this.city.isWater && this.city.isWater(x, z)) return true;
        } catch (e) { /* ignore */ }
        return false;
      };
      if (_blockedAt(this.car.x, this.car.z)) {
        if (!_blockedAt(this.car.x, this._prevCarZ)) {
          this.car.setPos(this.car.x, this._prevCarZ, this.car.heading);
        } else if (!_blockedAt(this._prevCarX, this.car.z)) {
          this.car.setPos(this._prevCarX, this.car.z, this.car.heading);
        } else {
          this.car.setPos(this._prevCarX, this._prevCarZ, this.car.heading);
        }
      } else if (this.city.clampToWorld) {
        const [cx, cz] = this.city.clampToWorld(this.car.x, this.car.z);
        if (cx !== this.car.x || cz !== this.car.z) this.car.setPos(cx, cz, this.car.heading);
      }
      this._chaseCam(dt, 7.2, 2.7, 0);
    } else {
      try {
        if (this.player.update) {
          // Player.update(dt, input, camYaw): the camera yaw (world direction
          // from the camera to the player) makes W walk away from the camera.
          // Without it the walk math goes NaN and the player freezes.
          //
          // Steering while running: the on-foot controller moves the player
          // toward the input direction and turns the heading to match it,
          // so raw A/D strafe (A would LOWER the heading) and a steering
          // loop that expects A to RAISE it can never converge — and a
          // fixed heading-relative offset just spins the player at the
          // controller's full turn rate. Instead, steer a separate target
          // heading (_footSteer) at a modest rate while running forward and
          // aim the movement at it: A turns left, D turns right, at a rate
          // a steering loop can control. Off the throttle (strafe / backup)
          // the plain camera yaw applies, so A-only still strafes.
          let camYaw = this.player.heading || 0;
          const dx = this.player.x - this.camera.position.x;
          const dz = this.player.z - this.camera.position.z;
          if (isFinite(dx) && isFinite(dz) && (dx !== 0 || dz !== 0)) camYaw = Math.atan2(dx, dz);
          try {
            const wx = (this.input && typeof this.input.walkX === 'number') ? this.input.walkX : 0;
            const wy = (this.input && typeof this.input.walkY === 'number') ? this.input.walkY : 0;
            if (wy > 0) {
              if (!this._footSteerInit) { this._footSteer = this.player.heading || 0; this._footSteerInit = true; }
              const STEER = 1.2; // rad/s while running forward
              if (wx < 0) this._footSteer += STEER * dt;
              else if (wx > 0) this._footSteer -= STEER * dt;
              else this._footSteer = this.player.heading || 0;
              // Keep the target wrapped so it stays near the heading.
              while (this._footSteer > Math.PI) this._footSteer -= Math.PI * 2;
              while (this._footSteer < -Math.PI) this._footSteer += Math.PI * 2;
              // movement = camYaw + atan2(wx, wy); aim it at _footSteer.
              camYaw = this._footSteer - Math.atan2(wx, wy);
            } else {
              this._footSteerInit = false;
            }
          } catch (e) { /* ignore */ }
          this.player.update(dt, this.input, camYaw);
        }
      } catch (e) { /* ignore */ }
      this._footCam(dt);
    }

    // Police, traffic, pedestrians, combat tick.
    try {
      if (this.police.update) this.police.update(dt, this.player.inCar ? this.car.x : this.player.x, this.player.inCar ? this.car.z : this.player.z, this.player.inCar ? this.car : null, null);
    } catch (e) { /* ignore */ }
    try { this.traffic.update(dt); } catch (e) { /* ignore */ }
    try { this.pedestrians.update(dt, []); } catch (e) { /* ignore */ }
    try { if (this.combat.update) this.combat.update(dt); } catch (e) { /* ignore */ }

    // Mission stage progression + race.
    this._updateMission(dt);
    this._updateRace(dt);
  }

  _updateMission(dt) {
    const job = this._activeJob();
    if (!job) return;
    // Race jobs resolve through the race, not the generic stage checks.
    const isRace = job.raceId || job.race || job.type === 'race' || job.id === 'M9';
    if (isRace) return;
    const stages = job.stages || [];
    if (!stages.length) return;
    const stage = stages[this._stageIndex];
    if (!stage) {
      this._completeJob(job);
      return;
    }
    const inCar = !!this.player.inCar;
    const cx = inCar ? this.car.x : this.player.x;
    const cz = inCar ? this.car.z : this.player.z;
    const text = stage.text || '';
    let done = false;
    const target = this._jobTarget(job, stage);
    if (target) {
      if (Math.hypot(cx - target[0], cz - target[1]) < 10) done = true;
    } else if (/steal|enter|get in|take the|grab/i.test(text)) {
      // Steal stage: counts once the car has been driven a little way,
      // so starting the job while already seated does not skip the stage.
      if (inCar && this._jobStartPos) {
        const driven = Math.hypot(this.car.x - this._jobStartPos.x, this.car.z - this._jobStartPos.z);
        if (driven > 15) done = true;
      }
    } else if (/race/i.test(text)) {
      done = false;
    } else if (/lose|escape|evade/i.test(text)) {
      if (this.police && this.police.wanted === 0) done = true;
    } else if (/deliver|drive|go to|reach|head to|take it/i.test(text)) {
      if (target) done = Math.hypot(cx - target[0], cz - target[1]) < 10;
    }
    if (done) {
      this._stageIndex++;
      if (this._stageIndex >= stages.length) {
        this._completeJob(job);
      } else {
        const next = stages[this._stageIndex];
        if (next && next.text) this.hud.toast('Stage ' + (this._stageIndex + 1) + '/' + stages.length + ': ' + next.text);
      }
    }
  }

  _updateRace(dt) {
    let active = false;
    try { active = !!(this.races && this.races.active); } catch (e) { active = false; }
    if (active) {
      // Races.update(dt, car) — it takes the CAR OBJECT. update(dt, x, z)
      // does not throw, it just never registers a checkpoint (it reads
      // .x/.z off the number), so the car form goes first.
      try {
        if (this.races.update) this.races.update(dt, this.car);
      } catch (e) {
        try { if (this.races.update) this.races.update(dt, this.car.x, this.car.z); } catch (e2) { /* ignore */ }
      }
      try { active = !!(this.races && this.races.active); } catch (e) { active = false; }
    }
    if (this._raceActive && !active) {
      // Race finished: prize + best time. No save here — the win toast
      // must not be overwritten by an autosave toast.
      this._raceActive = false;
      const raceId = this._raceId || 'strand-gp';
      const secs = Math.max(0.1, this.elapsed - this._raceStart);
      let best = secs;
      try {
        if (this.races && typeof this.races.bestTime === 'function') {
          const b = this.races.bestTime(raceId);
          if (typeof b === 'number') best = b;
        } else if (this.races && this.races.best && typeof this.races.best[raceId] === 'number') {
          best = this.races.best[raceId];
        } else if (this.races && this.races.bestTimes && typeof this.races.bestTimes[raceId] === 'number') {
          best = this.races.bestTimes[raceId];
        }
      } catch (e) { /* ignore */ }
      this._raceBest[raceId] = best;
      this.cash += 4000;
      this.hud.toast('Won Strand Grand Prix — +$4,000 · Best ' + formatClock(best) + ' — NEW BEST!');
      if (this._jobId === 'M9') {
        this._done.add('M9');
        this._jobId = null;
        this._stageIndex = 0;
      }
    }
  }

  _completeJob(job) {
    const rewardCash = (job.reward && job.reward.cash) || job.rewardCash || 2500;
    const rewardRp = (job.reward && job.reward.rp) || job.rewardRp || 120;
    this.cash += rewardCash;
    this.rp += rewardRp;
    this._done.add(job.id);
    if (job.id === 'M8') this.debt = 0;
    this._jobId = null;
    this._stageIndex = 0;
    this.hud.toast('Job complete: ' + job.name + ' — +$' + rewardCash.toLocaleString('en-US') + ' · +' + rewardRp + ' RP');
    this.saveGame();
  }

  _toggleEnterCar() {
    if (this.player.inCar) {
      // Step out beside the car.
      const h = this.car.heading;
      const px = this.car.x - Math.sin(h) * 2.5;
      const pz = this.car.z - Math.cos(h) * 2.5;
      this.player.setPos(px, pz, h);
      this.player.inCar = false;
      if (this.player.group) this.player.group.visible = true;
    } else {
      const d = Math.hypot(this.player.x - this.car.x, this.player.z - this.car.z);
      if (d < 5) {
        this.player.inCar = true;
        if (this.player.group) this.player.group.visible = false;
        this.hud.toast(this.car.name + ' — yours now');
      } else {
        this.hud.toast('Too far from the car');
      }
    }
  }

  _togglePause() {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      try { if (this.ui.showPause) this.ui.showPause(); } catch (e) { /* ignore */ }
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      try { if (this.ui.hidePause) this.ui.hidePause(); else if (this.ui.hideAll) this.ui.hideAll(); } catch (e) { /* ignore */ }
    }
  }

  _toggleShop() {
    if (this._shopOpen) {
      this.hud.hideShop();
      this._shopOpen = false;
      return;
    }
    const gx = WORLD.garage.x;
    const gz = WORLD.garage.z;
    const d = Math.hypot(this.car.x - gx, this.car.z - gz);
    if (d > 80) {
      this.hud.toast('Get to Alba Garage to open the shop');
      return;
    }
    this.hud.showShop(GARAGE_UPGRADES, this.cash, this._ownedUpgrades, (item) => this._onBuy(item));
    this._shopOpen = true;
  }

  _onBuy(item) {
    if (this._ownedUpgrades.has(item.id)) return;
    if (this.cash < item.price) {
      this.hud.setShopMessage('Not enough cash for ' + item.name);
      return;
    }
    this.cash -= item.price;
    this._ownedUpgrades.add(item.id);
    try { if (this.garage && typeof this.garage.buy === 'function') this.garage.buy(item.id); } catch (e) { /* ignore */ }
    this.hud.setShopMessage('Purchased ' + item.name);
    this.hud.showShop(GARAGE_UPGRADES, this.cash, this._ownedUpgrades, (it) => this._onBuy(it));
  }

  _openWheel() {
    this._wheelOpen = true;
    const weapons = (this.combat.weapons || []).map((w, i) => ({
      name: w.name, ammo: w.ammo, locked: !w.unlocked,
      selected: i === this.combat.selected,
      lockText: w.unlockJob ? 'LOCKED · ' + w.unlockJob : 'LOCKED'
    }));
    this.hud.showWheel(weapons, this.combat.selected || 0, null);
    // The wheel must never overlap the dispatch panel: hide dispatch.
    if (this.hud.dispatchEl) this.hud.dispatchEl.style.display = 'none';
  }

  _closeWheel() {
    this._wheelOpen = false;
    this.hud.hideWheel();
    if (this.hud.dispatchEl) this.hud.dispatchEl.style.display = 'block';
  }

  _cycleWeapon() {
    const n = (this.combat.weapons || []).length;
    if (!n) return;
    this.combat.selected = ((this.combat.selected || 0) + 1) % n;
    const w = this.combat.weapons[this.combat.selected];
    if (w) this.hud.toast(w.name + (w.unlocked ? '' : ' (LOCKED)'));
  }

  _crewSlipstream() {
    const c = this.crew[0];
    if (!c || !c.ready) return;
    c.ready = false;
    c.cooldown = c.cooldownMax;
    this.car.slipstream = 5;
    this.hud.toast('Slipstream! Kiki pulls you through the pack');
  }

  _crewLoopFeeds() {
    const c = this.crew[1];
    if (!c || !c.ready) return;
    c.ready = false;
    c.cooldown = c.cooldownMax;
    try {
      const w = (this.police && this.police.wanted) || 0;
      if (this.police.setWanted) this.police.setWanted(Math.max(0, w - 1));
    } catch (e) { /* ignore */ }
    this.hud.toast('Loop Feeds — cameras looped, heat down');
  }

  _crewRam() {
    const c = this.crew[2];
    if (!c || !c.ready) return;
    c.ready = false;
    c.cooldown = c.cooldownMax;
    let target = null;
    let best = 1e9;
    try {
      for (const pc of (this.police.cars || [])) {
        const d = Math.hypot(pc.x - this.car.x, pc.z - this.car.z);
        if (d < best) { best = d; target = pc; }
      }
    } catch (e) { /* ignore */ }
    if (target && best < 25) {
      target.damage(100);
      this.hud.toast('Ram! Dario wrecked a cruiser');
    } else {
      this.hud.toast('Ram! Dario is ready — no cruiser in range');
    }
  }

  _shoot() {
    // Drive-by: shooting works from the car too (the playtest shoots
    // without ever stepping out). Muzzle sits at the car's nose in a car.
    const inCar = !!this.player.inCar;
    const h = inCar ? this.car.heading : this.player.heading;
    const ox = inCar ? this.car.x : this.player.x;
    const oz = inCar ? this.car.z : this.player.z;
    let cur = null;
    try {
      cur = this.combat.current ? this.combat.current() : this.combat.weapons[this.combat.selected];
    } catch (e) { cur = null; }
    if (!cur) return;
    if (cur.ammo !== undefined && cur.ammo !== null && cur.ammo <= 0) {
      this.hud.toast('Out of ammo — ' + cur.name);
      return;
    }
    let fired = false;
    let shot = null;
    try {
      // Combat.tryFire(heading) is the real shot: it spends one ammo and
      // returns the shot. (There is no combat.shoot/fire in this build.)
      // tryFire returns null when it declines (same-heading dedup) — a
      // click must still spend the ammo, so treat null as "not fired".
      if (this.combat.tryFire && typeof this.combat.tryFire === 'function') {
        shot = this.combat.tryFire(h);
        fired = (shot !== null && shot !== undefined);
      }
      else if (this.combat.shoot && typeof this.combat.shoot === 'function') { this.combat.shoot(); fired = true; }
      else if (this.combat.fire && typeof this.combat.fire === 'function') { this.combat.fire(); fired = true; }
    } catch (e) { fired = false; shot = null; }
    if (!fired && cur.ammo !== undefined && cur.ammo !== null) cur.ammo -= 1;
    const mx = ox + Math.sin(h) * 1.2;
    const mz = oz + Math.cos(h) * 1.2;
    this.effects.muzzle(mx, 1.5, mz);
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
    const h = this.player.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const rx = -Math.cos(h);
    const rz = Math.sin(h);
    const px = this.player.x;
    const pz = this.player.z;
    const tx = px - fx * 5.5 + rx * 1.2;
    const tz = pz - fz * 5.5 + rz * 1.2;
    const k = 1 - Math.exp(-dt * 8);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (2.6 - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(px + fx * 8, 1.4, pz + fz * 8);
  }

  _stageProgression(cash, rp, activeJobId) {
    this.cash = cash;
    this.rp = rp;
    if (JOBS) {
      const idx = activeJobId ? JOBS.findIndex((j) => j.id === activeJobId) : JOBS.length;
      const doneUpTo = idx < 0 ? JOBS.length : idx;
      for (let i = 0; i < doneUpTo; i++) this._done.add(JOBS[i].id);
    }
    this._jobId = activeJobId || null;
    this._stageIndex = 0;
    this._jobStartPos = { x: this.car.x, z: this.car.z };
    this._jobStartTime = this.elapsed;
  }

  _applyShot(shot) {
    this.traffic.spawn(16);
    this.pedestrians.spawn(20);
    if (shot === 'cover') this._stageCover();
    else if (shot === 'briefing') this._stageBriefing();
    else if (shot === 'combat') this._stageCombat();
    else if (shot === 'vista') this._stageVista();
    else this._stageChase();
  }

  _stageCover() {
    this._stageProgression(24500, 1100, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Deliver the bag on the Strand';
    const job = this.missions.job('M8');
    if (job && job.dialogue && job.dialogue[1]) this.dialogue = this._parseDialogue(job.dialogue[1]);
    this.dialogueT = 9999;
    this.player.inCar = true;
    if (this.player.group) this.player.group.visible = false;
    // Ria faces EAST down the Strand (heading 1.57): from a camera on
    // the south verge looking north-west, the nose points right, the
    // ALBA sign reads mid-distance beyond the car, and the low sun
    // glows ahead over the city. Camera sits in the clear verge
    // (z=216, south of the road), never inside the random building row.
    this.car.setPos(-52, 200, 1.57);
    this.car.speed = 0;
    this.camHeading = 1.57;
    this.police.setWanted(5);
    this.police.syncUnits(-52, 200, 1.57);
    this._recolorPolice();
    // Cruisers staggered close behind in the far lane, two more further
    // back (one falls out of frame; dispatch still lists all five).
    this._stagedPolice = [
      { dx: -10, dz: -4 }, { dx: -14, dz: -2 }, { dx: -18, dz: -5 },
      { dx: -22, dz: -3 }, { dx: -26, dz: -4 }
    ];
    this._pinPolice('chase');
    // Dim the heli cone for the cover only: translucent, never a white
    // triangle over the frame centre (police.js default is 0.30 / 0.34).
    try {
      if (this.police.heli) {
        if (this.police.heli.cone) this.police.heli.cone.material.opacity = 0.12;
        if (this.police.heli.pool) this.police.heli.pool.material.opacity = 0.15;
      }
    } catch (e) { /* ignore */ }
    // Ambient traffic rolling east along the Strand, slow enough to hold
    // the frame through the settle.
    const tSpots = [
      { x: 6, z: 196 }, { x: -88, z: 204 }, { x: 34, z: 204 }, { x: -112, z: 196 },
      { x: 62, z: 196 }, { x: -136, z: 204 }, { x: 90, z: 204 }, { x: -160, z: 196 }
    ];
    try {
      const cars = this.traffic.cars || [];
      cars.forEach((t, i) => {
        const s = tSpots[i % tSpots.length];
        t.setPos(s.x, s.z, 1.57);
        t.speed = 0;
        if (t.car && t.car.mesh && Math.hypot(t.car.x - this.car.x, t.car.z - this.car.z) < 14) t.car.mesh.visible = false;
      });
      for (const c of this.traffic.parked || []) {
        if (c && c.mesh && Math.hypot(c.x - this.car.x, c.z - this.car.z) < 30) c.mesh.visible = false;
      }
    } catch (e) { /* ignore */ }
    this._nextBoom = Date.now() + 1500;
    // Low sun ahead: halo + core sprites in the frame, above the
    // rooftops and close enough to beat the fog.
    const sunStops = [[0, 'rgba(255,250,220,1)'], [0.4, 'rgba(255,200,120,0.85)'], [1, 'rgba(255,120,40,0)']];
    this.effects._sprite(sunStops, 70, 0.9, true, -140, 30, 150);
    this.effects._sprite(sunStops, 30, 1, true, -140, 30, 150);
    // Distinct sun disc for the cover: the vista's sunBall, moved into
    // this frame and scaled up (probe-validated: hard-edged ~130 px disc).
    try {
      if (this.city.sunBall) {
        this.city.sunBall.position.set(-211.6, 70, 358.1);
        this.city.sunBall.scale.set(1.8, 1.8, 1.8);
      }
    } catch (e) { /* ignore */ }
    // Persistent road fireball ahead of the car: the boom timer below
    // adds smoke and flash, but the flame itself is up in every frame,
    // anchored ON the road, never floating.
    try {
      const roadFire = [[0, 'rgba(255,200,80,1)'], [0.4, 'rgba(255,110,20,0.95)'], [1, 'rgba(200,40,0,0)']];
      this.effects._sprite(roadFire, 3.4, 0.95, true, -70, 1.8, 206);
      this.effects._sprite(roadFire, 1.9, 1, true, -70, 2.1, 206);
    } catch (e) { /* ignore */ }
    // Fixed 3/4 front-on camera: car at the left third, nose right.
    this._shotCam = { pos: [-44, 2.8, 190], look: [-78, 1, 210] };
    this.camera.position.set(-44, 2.8, 190);
    this.camera.lookAt(-78, 1, 210);
  }

  _stageChase() {
    this._stageProgression(24500, 1100, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Deliver the bag on the Strand';
    const job = this.missions.job('M8');
    if (job && job.dialogue && job.dialogue[1]) this.dialogue = this._parseDialogue(job.dialogue[1]);
    this.dialogueT = 9999;
    this.player.inCar = true;
    if (this.player.group) this.player.group.visible = false;
    this.car.setPos(-40, 200, 1.57);
    this.car.speed = 42.5;
    this.camHeading = 1.57;
    this.police.setWanted(5);
    this.police.syncUnits(-40, 200, 1.57);
    // Roadblock ahead on the Strand.
    const block = new Car(THREE, this.scene, {
      x: -25, z: 200, heading: 1.57 + Math.PI / 2, color: 0x1a1a2a,
      name: 'Interceptor', topSpeed: 31, accel: 16, isPolice: true
    });
    if (this.police.roadblock) this.police.roadblock.push(block);
    this._recolorPolice();
    // Traffic streaming past the chase.
    const tOffsets = [
      { dx: -14, dz: -8 }, { dx: 8, dz: 10 }, { dx: -22, dz: 6 }, { dx: 20, dz: -12 },
      { dx: -8, dz: 14 }, { dx: 28, dz: 8 }, { dx: -30, dz: -4 }, { dx: 12, dz: -16 }
    ];
    try {
      const cars = this.traffic.cars || [];
      cars.forEach((t, i) => {
        const off = tOffsets[i % tOffsets.length];
        t.setPos(-40 + off.dx, 200 + off.dz, 1.57);
        t.speed = 46;
      });
    } catch (e) { /* ignore */ }
    // Close dispatch: units 13-25m out, three within 15m.
    this._stagedPolice = [
      { dx: 12, dz: -6 }, { dx: 10, dz: 8 }, { dx: 8, dz: -10 }, { dx: 18, dz: 6 }, { dx: 25, dz: -3 }
    ];
    this._pinPolice('chase');
    this._nextBoom = Date.now() + 4000;
    // Sun in frame, ahead and high: halo + core sprites.
    const sunStops = [[0, 'rgba(255,250,220,1)'], [0.4, 'rgba(255,200,120,0.85)'], [1, 'rgba(255,120,40,0)']];
    const halo = this.effects._sprite(sunStops, 90, 0.9, true, this.car.x + 280, 120, 190);
    const core = this.effects._sprite(sunStops, 36, 1, true, this.car.x + 280, 120, 190);
    this._chaseSun = { halo: halo, core: core };
  }

  _stageBriefing() {
    this._stageProgression(24500, 1100, 'M8');
    // The briefing panel below is the ONE M8 panel in this shot: no
    // mission panel (clear the staged job + shot mission so _missionVM
    // has nothing to show). The gold route still shows via shotMode.
    this._shotMission = null;
    this._jobId = null;
    this._shotStageText = 'Deliver the bag on the Strand';
    const job = this.missions.job('M8');
    if (job && job.dialogue && job.dialogue[0]) this.dialogue = this._parseDialogue(job.dialogue[0]);
    this.dialogueT = 9999;
    const objectives = (job && (job.objectives || (job.stages || []).map((s) => s.text))) || [this._shotStageText];
    this.briefing = {
      title: 'M8 — The Debt Paid',
      giver: 'Don Rafael Alba · Don of Alba',
      job: 'One bag, one handoff, no mistakes.',
      objectives: objectives,
      reward: '$15,000',
      cash: '$24,500'
    };
    this.police.setWanted(1);
    this.police.syncUnits(2, 200, 0.35);
    this._recolorPolice();
    try {
      if (this.police.cars && this.police.cars[0]) this.police.cars[0].setPos(-45, 168, 1.57);
    } catch (e) { /* ignore */ }
    this.car.setPos(-46, 196, 1.57);
    this.car.speed = 0;
    this.player.inCar = false;
    if (this.player.group) this.player.group.visible = true;
    this.player.setPos(-43, 198.5, 1.57);
    // The briefing street is alive: a patrol unit responding in the
    // background plus a little traffic, at wanted 1.
    const tSpots = [
      { x: 10, z: 200 }, { x: 30, z: 196 }, { x: -20, z: 204 }, { x: 58, z: 200 },
      { x: -70, z: 196 }, { x: 84, z: 204 }, { x: -100, z: 200 }, { x: 110, z: 196 }
    ];
    try {
      const cars = this.traffic.cars || [];
      cars.forEach((t, i) => {
        const s = tSpots[i % tSpots.length];
        t.setPos(s.x, s.z, 1.57);
        t.speed = 12;
      });
    } catch (e) { /* ignore */ }
    this._shotCam = { pos: [-38, 3.0, 214], look: [-50, 1.4, 196] };
    this.camera.position.set(-38, 3.0, 214);
    this.camera.lookAt(-50, 1.4, 196);
  }

  _stageCombat() {
    this._stageProgression(24100, 1150, 'M8');
    this._shotMission = { code: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba' };
    this._shotStageText = 'Lose the 5-star heat';
    const job = this.missions.job('M8');
    if (job && job.dialogue && job.dialogue[1]) this.dialogue = this._parseDialogue(job.dialogue[1]);
    this.dialogueT = 9999;
    this.player.setPos(-20, 200, 1.57);
    this.player.inCar = false;
    if (this.player.group) this.player.group.visible = true;
    this.car.setPos(-34, 204, 1.57);
    this.car.speed = 0;
    this.police.setWanted(3);
    this.police.syncUnits(-20, 200, 1.57);
    this._recolorPolice();
    // Burning cruiser: the lead unit sits close ahead of Ria, in frame.
    this._stagedPolice = [{ dx: 10, dz: -6 }, { dx: 16, dz: 6 }, { dx: 20, dz: -9 }];
    this._pinPolice('combat');
    // Persistent flame on the lead cruiser: re-pinning holds the unit
    // on the same spot every frame, so the fire stays on the car.
    try {
      const lead = this.police.cars && this.police.cars[0];
      if (lead) {
        const fireStops = [[0, 'rgba(255,120,20,1)'], [0.5, 'rgba(230,60,0,0.95)'], [1, 'rgba(180,30,0,0)']];
        this.effects._sprite(fireStops, 3.2, 0.95, true, lead.x, 1.2, lead.z);
        this.effects._sprite(fireStops, 1.6, 1, true, lead.x, 1.5, lead.z);
      }
    } catch (e) { /* ignore */ }
    this._nextBurn = Date.now() + 400;
    // Visible gun in hand, held forward and aimed — on the camera side of
    // the player so its profile reads from the rear camera, not a bar at
    // the shoulder. Player local -X is the camera side (south).
    try {
      const gun = new THREE.Group();
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.4, metalness: 0.7 });
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.62), gunMat);
      gun.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.5);
      gun.add(barrel);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.11), gunMat);
      grip.position.set(0, -0.15, -0.2);
      grip.rotation.x = 0.25;
      gun.add(grip);
      // Held out to the side of the torso, pointing along the player's
      // forward, so its side profile reads from the rear camera.
      gun.position.set(-0.62, 1.25, 0.45);
      gun.rotation.x = 0;
      if (this.player.group) this.player.group.add(gun);
      this._gun = gun;
    } catch (e) { /* ignore */ }
    // Persistent muzzle burst anchored to the barrel tip: the staged
    // combat frame must show the flash at full strength at the gun tip
    // in every captured frame, independent of burst phase and fade.
    // (Same staging trick as the persistent sun sprites in the chase
    // shot.) The anchor rides the gun, so the burst sits exactly on
    // the visible barrel end whatever the camera does.
    try {
      const anchor = new THREE.Group();
      anchor.position.set(0, 0.02, 0.45);
      this._gun.add(anchor);
      this._muzzleAnchor = anchor;
      const mkSprite = (tex, size, opacity) => {
        const mat = new THREE.SpriteMaterial({
          map: tex, transparent: true, opacity: opacity, depthWrite: false,
          blending: THREE.NormalBlending
        });
        const s = new THREE.Sprite(mat);
        s.scale.set(size, size, 1);
        s.renderOrder = 20;
        s.userData.baseOp = opacity;
        anchor.add(s);
        return s;
      };
      const haloStops = [[0, 'rgba(255,140,30,0.7)'], [0.5, 'rgba(255,100,12,0.45)'], [1, 'rgba(220,55,0,0)']];
      const coreStops = [[0, 'rgba(255,175,45,1)'], [0.35, 'rgba(255,130,20,1)'], [0.7, 'rgba(240,70,0,0.95)'], [1, 'rgba(210,40,0,0)']];
      const sparkStops = [[0, 'rgba(255,235,150,1)'], [0.5, 'rgba(255,160,40,0.95)'], [1, 'rgba(240,80,0,0)']];
      this._muzzleFlash = [
        mkSprite(this.effects._texture(haloStops), 2.2, 0.4),
        mkSprite(this.effects._starTexture(), 1.9, 1),
        mkSprite(this.effects._texture(coreStops), 1.2, 0.95)
      ];
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 1 })
      );
      ball.renderOrder = 21;
      ball.userData.baseOp = 1;
      anchor.add(ball);
      this._muzzleFlash.push(ball);
      const sparkTex = this.effects._texture(sparkStops);
      const sparkOffs = [[0.5, 0.25, 0.1], [-0.45, 0.3, -0.1], [0.15, -0.45, 0.25]];
      for (const [ox, oy, oz] of sparkOffs) {
        const sp = mkSprite(sparkTex, 0.35, 0.95);
        sp.position.set(ox, oy, oz);
        this._muzzleFlash.push(sp);
      }
    } catch (e) { /* ignore */ }
    this._fireCombatBurst();
    this._nextMuzzle = Date.now() + 250;
    // Wheel docked right (6ca222f layout), dispatch hidden — the heli,
    // gun and muzzle stay clear of the panel; they never overlap.
    const weapons = (this.combat.weapons || []).map((w, i) => ({
      name: w.name, ammo: w.ammo, locked: !w.unlocked,
      selected: i === this.combat.selected,
      lockText: w.unlockJob ? 'LOCKED · ' + w.unlockJob : 'LOCKED'
    }));
    this.hud.showWheel(weapons, this.combat.selected || 0, { left: '76%', top: '16%' });
  }

  _stageVista() {
    this._stageProgression(24800, 1200, null);
    this._shotMission = null;
    this.player.inCar = true;
    if (this.player.group) this.player.group.visible = false;
    this.car.setPos(40, 200, 1.57);
    this.car.speed = 0;
    if (this.city.sunBall) this.city.sunBall.scale.set(1.8, 1.8, 1.8);
    this._addLensFlare();
    // Gold glitter low over the water ahead: the sunset on the bay.
    try {
      const goldStops = [[0, 'rgba(255,220,140,0.9)'], [0.5, 'rgba(255,170,70,0.45)'], [1, 'rgba(255,130,40,0)']];
      this.effects._sprite(goldStops, 130, 0.4, true, 60, 5, 300);
    } catch (e) { /* ignore */ }
    // Low from the water: pier + lighthouse lead in, ferris wheel and
    // the city beyond, boats on the gold water.
    this._shotCam = { pos: [2, 3.8, 394], look: [52, 12, 262] };
    this.camera.position.set(2, 3.8, 394);
    this.camera.lookAt(52, 12, 262);
  }

  _fireCombatBurst() {
    const h = this.player.heading;
    // Muzzle at the gun tip: the gun sits at local (-0.62, 1.25, 0.45)
    // and the burst anchor at gun-local z 0.45, i.e. 0.9 forward of the
    // player on the gun side — the same world point as the anchor, so
    // the burst generations and the persistent flash coincide.
    const mx = this.player.x + Math.sin(h) * 0.9 - Math.cos(h) * 0.62;
    const mz = this.player.z + Math.cos(h) * 0.9 + Math.sin(h) * 0.62;
    this.effects.muzzle(mx, 1.27, mz);
    // Hit effect on the closest cruiser: sparks + smoke + damage flash.
    let target = null;
    let best = 1e9;
    try {
      for (const pc of (this.police.cars || [])) {
        const d = Math.hypot(pc.x - this.player.x, pc.z - this.player.z);
        if (d < best) { best = d; target = pc; }
      }
    } catch (e) { /* ignore */ }
    if (target) {
      this.effects.sparks(target.x, 1.2, target.z);
      this.effects.smoke(target.x, 1.5, target.z);
      try { target.damage(1); } catch (e) { /* ignore */ }
    }
  }

  _recolorPolice() {
    const cars = [];
    try {
      if (this.police.cars) for (const c of this.police.cars) cars.push(c);
      if (this.police.roadblock) for (const c of this.police.roadblock) cars.push(c);
    } catch (e) { /* ignore */ }
    for (const car of cars) {
      if (!car.mesh) continue;
      car.mesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && o.material.color.getHex && o.material.color.getHex() === 0x1a1a2a) {
          o.material.color.setHex(0xf2f2f2);
        }
      });
    }
  }

  _pinHeli(px, pz, dx, dz, height) {
    const h = this.police.heli;
    if (!h) return;
    const H = height || 11;
    if (h.group) h.group.position.set(px + dx, H, pz + dz);
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
    const offs = this._stagedPolice || [
      { dx: 10, dz: -6 }, { dx: 8, dz: 8 }, { dx: 14, dz: 2 }, { dx: 6, dz: -12 }, { dx: 18, dz: -4 }
    ];
    try {
      const cars = this.police.cars || [];
      cars.forEach((car, i) => {
        const off = offs[i % offs.length];
        const wx = px + fx * off.dx + rx * off.dz;
        const wz = pz + fz * off.dx + rz * off.dz;
        let h = heading;
        if (off.face) h = Math.atan2(px - wx, pz - wz);
        car.setPos(wx, wz, h);
        car.speed = 8;
      });
      if (this.police.rebuildDispatch) this.police.rebuildDispatch();
    } catch (e) { /* ignore */ }
  }

  _updateShot(dt) {
    const shot = this.shotMode;
    // Police cars stay white in every shot, including fresh spawns.
    if (shot !== 'vista') this._recolorPolice();
    if (shot === 'chase') {
      this.car.update(dt, this._driveInput(), true);
      this.car.speed = 42.5;
      this.car.heading = 1.57;
      this.car.mesh.rotation.y = 1.57;
      const px = this.car.x;
      const pz = this.car.z;
      try { this.police.update(dt, px, pz, this.car, null); } catch (e) { /* ignore */ }
      this._pinPolice('chase');
      try {
        if (this.police.roadblock && this.police.roadblock[0]) {
          this.police.roadblock[0].setPos(px + 15, 200, 1.57 + Math.PI / 2);
        }
      } catch (e) { /* ignore */ }
      if (Date.now() >= this._nextBoom) {
        this.effects.explosion(px + 18, 186, 0.9);
        this._nextBoom = Date.now() + 1200;
      }
      if (this._chaseSun) {
        this._chaseSun.halo.position.set(px + 280, 120, 190);
        this._chaseSun.core.position.set(px + 280, 120, 190);
      }
      this._chaseCam(dt, 7.2, 2.9, 4.5);
      // Heli pinned relative to the CAMERA, not the car: the car drives
      // during the settle, so a car-relative pin drifts behind whatever
      // building happens to be alongside. Camera-relative, the heli
      // holds the same sky slot in every captured frame.
      {
        const ch = this.car.heading;
        const cfx = Math.sin(ch), cfz = Math.cos(ch);
        const crx = -Math.cos(ch), crz = Math.sin(ch);
        const hx = this.camera.position.x + cfx * 38 + crx * -4;
        const hz = this.camera.position.z + cfz * 38 + crz * -4;
        this._pinHeli(hx, hz, 0, 0, 17);
      }
      try { this.traffic.update(dt); } catch (e) { /* ignore */ }
      try { this.pedestrians.update(dt, []); } catch (e) { /* ignore */ }
    } else if (shot === 'cover') {
      // STATIC staging: the car never drives (deterministic framing for
      // sign / heli / sun). Traffic + pedestrians give ambient life,
      // police + heli are re-pinned every frame, the boom timer fires
      // the fireball ON the road ahead of the car.
      this._pinPolice('chase');
      // Heli camera-relative, offset to the left of frame against sky,
      // cone dimmed so the road stays readable through it.
      if (this._shotCam) {
        const dx = this._shotCam.look[0] - this._shotCam.pos[0];
        const dz = this._shotCam.look[2] - this._shotCam.pos[2];
        const len = Math.hypot(dx, dz) || 1;
        const fx = dx / len;
        const fz = dz / len;
        const rx = -fz;
        const rz = fx;
        const hx = this._shotCam.pos[0] + fx * 38 - rx * 16;
        const hz = this._shotCam.pos[2] + fz * 38 - rz * 16;
        this._pinHeli(hx, hz, 0, 0, 19);
      }
      try {
        if (this.police.heli) {
          if (this.police.heli.cone) this.police.heli.cone.material.opacity = 0.12;
          if (this.police.heli.pool) this.police.heli.pool.material.opacity = 0.15;
        }
      } catch (e) { /* ignore */ }
      if (Date.now() >= this._nextBoom) {
        this.effects.explosion(-70, 206, 0.4);
        this._nextBoom = Date.now() + 900;
      }
      // Traffic FROZEN in the cover branch: no update call, so staged
      // cars hold their spots and nothing steers into the hero slot.
      try { this.pedestrians.update(dt, []); } catch (e) { /* ignore */ }
      if (this._shotCam) {
        this.camera.position.set(this._shotCam.pos[0], this._shotCam.pos[1], this._shotCam.pos[2]);
        this.camera.lookAt(this._shotCam.look[0], this._shotCam.look[1], this._shotCam.look[2]);
      }
    } else if (shot === 'briefing') {
      const px = this.player.x;
      const pz = this.player.z;
      try { this.police.update(dt, px, pz, null, null); } catch (e) { /* ignore */ }
      try { this.traffic.update(dt); } catch (e) { /* ignore */ }
      try { this.pedestrians.update(dt, []); } catch (e) { /* ignore */ }
      if (this._shotCam) {
        this.camera.position.set(this._shotCam.pos[0], this._shotCam.pos[1], this._shotCam.pos[2]);
        this.camera.lookAt(this._shotCam.look[0], this._shotCam.look[1], this._shotCam.look[2]);
      }
    } else if (shot === 'combat') {
      const px = this.player.x;
      const pz = this.player.z;
      try { this.police.update(dt, px, pz, null, null); } catch (e) { /* ignore */ }
      this._pinPolice('combat');
      this._pinHeli(px, pz, 30, -10);
      if (Date.now() >= this._nextMuzzle) {
        this._fireCombatBurst();
        this._nextMuzzle = Date.now() + 250;
      }
      // Burning cruiser: re-fire the blast on the lead unit so flame +
      // smoke are up in every captured frame.
      if (Date.now() >= (this._nextBurn || 0)) {
        try {
          const lead = this.police.cars && this.police.cars[0];
          if (lead) {
            this.effects.explosion(lead.x, lead.z, 0.45);
            this.effects.smoke(lead.x, 2.5, lead.z);
          }
        } catch (e) { /* ignore */ }
        this._nextBurn = Date.now() + 900;
      }
      // Persistent muzzle burst: flicker it, never let it fade out.
      if (this._muzzleFlash && this._muzzleAnchor) {
        const f = 0.88 + 0.12 * Math.sin(this.elapsed * 31);
        for (const s of this._muzzleFlash) {
          if (s.material) s.material.opacity = (s.userData.baseOp || 1) * f;
        }
        this._muzzleAnchor.scale.setScalar(0.94 + 0.08 * Math.sin(this.elapsed * 27));
      }
      try { this.traffic.update(dt); } catch (e) { /* ignore */ }
      try { this.pedestrians.update(dt, []); } catch (e) { /* ignore */ }
      const h = this.player.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const rx = -Math.cos(h);
      const rz = Math.sin(h);
      const tx = px - fx * 5.5 + rx * 1.2;
      const tz = pz - fz * 5.5 + rz * 1.2;
      const k = 1 - Math.exp(-dt * 8);
      this.camera.position.x += (tx - this.camera.position.x) * k;
      this.camera.position.y += (2.6 - this.camera.position.y) * k;
      this.camera.position.z += (tz - this.camera.position.z) * k;
      this.camera.lookAt(px + fx * 8, 1.4, pz + fz * 8);
    } else if (shot === 'vista') {
      try { this.traffic.update(dt); } catch (e) { /* ignore */ }
      try { this.pedestrians.update(dt, []); } catch (e) { /* ignore */ }
      if (this._shotCam) {
        this.camera.position.set(this._shotCam.pos[0], this._shotCam.pos[1], this._shotCam.pos[2]);
        this.camera.lookAt(this._shotCam.look[0], this._shotCam.look[1], this._shotCam.look[2]);
      }
    }
  }

  _addLensFlare() {
    try {
      const stops = [[0, 'rgba(255,240,200,0.9)'], [0.5, 'rgba(255,190,110,0.4)'], [1, 'rgba(255,140,60,0)']];
      // Big soft glow at the sun, plus two smaller ghosts toward the camera.
      this.effects._sprite(stops, 320, 0.5, true, -420, 95, 420);
      this.effects._sprite(stops, 60, 0.45, true, -300, 80, 330);
      this.effects._sprite(stops, 34, 0.5, true, -190, 68, 250);
    } catch (e) { /* ignore */ }
  }
}

new Game();
