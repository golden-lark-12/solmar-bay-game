// main.js — boot + game loop + shot mode. Wires every system together:
// city, player, cars, traffic, pedestrians, police, combat, missions, HUD,
// menus, audio, save. Shot mode (?shot=chase|steal|mission|vista) stages a
// deterministic scene with the menu hidden for screenshots.
import { mulberry32, clamp, dist2 } from './utils.js';
import { initInput, pressed, down, endFrame, mouseDX, mouseDY, mouseClicked, locked } from './input.js';
import * as audio from './audio.js';
import { buildCity, collide, ROAD_LINES } from './city.js';
import { Player } from './player.js';
import { Car, makeCarMesh } from './vehicle.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { UI } from './ui.js';
import { Effects } from './effects.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
if (SHOT) window.__SOLMAR_SHOT__ = SHOT;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

const rng = mulberry32(SEED);
const city = buildCity(scene, SEED);
const effects = new Effects(scene);
const player = new Player(scene);
const traffic = new Traffic(scene, city, rng);
const peds = new Pedestrians(scene, city, rng);
const police = new Police(scene, city);
const combat = new Combat(scene, player);
const missions = new Missions(scene, city);
const hud = new HUD();
const ui = new UI({
  onStartStory: () => startGame('story'),
  onFreeRoam: () => startGame('roam'),
  onContinue: () => startGame('continue'),
  onResume: () => resumeGame(),
  onSave: () => { doSave(); hud.toast('Game saved'); },
});

const game = {
  state: 'menu', // menu | playing | paused
  cash: 250,
  shot: SHOT,
  missionsDone: [],
  get missionIndex() { return missions.missionIndex; },
};
// Debug handle for headless verification (position checks, no personal data).
window.__SOLMAR_STATE__ = { player, police, missions, game };

let headlight = null;
let ramCooldown = 0;
let camTarget = new THREE.Vector3();
let camPos = new THREE.Vector3();
let shotCam = null;

initInput(canvas, (isLocked) => {
  if (!isLocked && game.state === 'playing' && !SHOT && !document.hidden) {
    // Esc released the mouse: pause.
    pauseGame();
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function makeHeadlight() {
  if (headlight) return;
  headlight = new THREE.SpotLight(0xffe9a0, 60, 55, 0.5, 0.45, 1.2);
  scene.add(headlight);
  scene.add(headlight.target);
}

function nearestCar(maxD) {
  const p = player.pos;
  let best = null, bestD = maxD;
  for (const car of traffic.allCars()) {
    const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  for (const cop of police.cops) {
    const d = Math.hypot(cop.pos.x - p.x, cop.pos.z - p.z);
    if (d < bestD) { best = cop; bestD = d; }
  }
  return best;
}

function enterCar(car) {
  player.inCar = car;
  player.group.visible = false;
  makeHeadlight();
  if (car.parked || traffic.cars.includes(car)) {
    // stealing: traffic cars leave the AI fleet, parked cars are taken too
    const idx = traffic.cars.indexOf(car);
    if (idx >= 0) traffic.cars.splice(idx, 1);
    const pidx = traffic.parked.indexOf(car);
    if (pidx >= 0) traffic.parked.splice(pidx, 1);
    car.parked = false;
    if (!car.owned) {
      car.owned = true;
      police.addWanted(1, car.pos.x, car.pos.z);
      hud.toast('Car stolen — the police are on their way!');
      audio.playFail();
    }
  }
  audio.resumeAudio();
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  car.speed *= 0.2;
  const side = car.pos.x + Math.cos(car.heading) * 2.2;
  const sideZ = car.pos.z - Math.sin(car.heading) * 2.2;
  player.inCar = null;
  player.group.visible = true;
  player.pos.x = side; player.pos.z = sideZ;
  collide(city, player.pos, 0.55);
  player.group.position.set(player.pos.x, 0, player.pos.z);
}

function doSave() {
  const d = missions.saveData();
  saveGame({
    cash: game.cash,
    missionsDone: d.missionsDone,
    missionIndex: d.missionIndex,
    player, stashesCollected: d.stashesCollected, bestTrial: d.bestTrial,
  });
}

function applySave(d) {
  game.cash = d.cash;
  player.respawn(d.pos ? d.pos[0] : city.spawn.x, d.pos ? d.pos[1] : city.spawn.z);
  player.health = d.health ?? 100;
  missions.applySave(d);
}

function startGame(mode) {
  audio.initAudio(); audio.resumeAudio();
  ui.hide();
  document.getElementById('hud').style.display = 'block';
  game.state = 'playing';
  if (mode === 'continue') {
    const d = loadGame();
    if (d) applySave(d);
    missions.mode = missions.done ? 'roam' : 'story';
    if (missions.mode === 'story') missions.startStory(missions.missionIndex);
    hud.toast(missions.done ? 'Welcome back — free roam' : missions.mission.name + ' — ' + missions.step.text);
  } else if (mode === 'story') {
    player.respawn(city.spawn.x, city.spawn.z);
    game.cash = 250;
    missions.startStory(0);
    hud.toast('M1 · Hot Wheels — steal a car');
  } else {
    player.respawn(city.spawn.x, city.spawn.z);
    missions.mode = 'roam';
    missions.hideMarker();
    hud.toast('Free roam — the city is yours');
  }
  try { canvas.requestPointerLock(); } catch {}
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  ui.showPause();
  document.getElementById('hud').style.display = 'none';
  if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
  ui.hide();
  document.getElementById('hud').style.display = 'block';
  game.state = 'playing';
  try { canvas.requestPointerLock(); } catch {}
}

function bustOrWaste(kind) {
  const fine = Math.min(200, game.cash);
  game.cash -= fine;
  police.clear();
  if (player.inCar) { player.inCar.speed = 0; player.inCar = null; player.group.visible = true; }
  const spot = kind === 'busted' ? { x: 60, z: 240 } : { x: -60, z: 240 };
  player.respawn(spot.x, spot.z);
  audio.playFail();
  if (kind === 'busted') ui.showBusted('$' + fine); else ui.showWasted('$' + fine);
}

const missionCtx = {
  get player() { return player; },
  get police() { return police; },
  get effects() { return effects; },
  pressedE: false,
  prompt: '',
  addCash(n) { game.cash += n; },
  toast(t) { hud.toast(t); },
  jingle() { audio.playJingle(); },
  pickupChime() { audio.playPickup(); },
  failSound() { audio.playFail(); },
  setWanted(n) { police.wanted = n; },
};

function setupShot() {
  game.state = 'playing';
  ui.hide();
  document.getElementById('hud').style.display = 'block';
  if (SHOT === 'chase') {
    const mesh = makeCarMesh(0); scene.add(mesh);
    const car = new Car(mesh, 0, 120, Math.PI);
    car.owned = true; car.speed = 22; car.maxSpeed = 24; // cruise speed cops can match
    player.inCar = car; player.group.visible = false;
    makeHeadlight();
    police.wanted = 3;
    // two cop cars behind, kept ~15m back so both cars fit the frame
    for (const [cx, cz] of [[3, 132], [-3, 142]]) {
      const cm = makeCarMesh(0, true); scene.add(cm);
      const cop = new Car(cm, cx, cz, Math.PI);
      cop.maxSpeed = 26; cop.health = 60; cop.speed = 22;
      police.cops.push(cop);
    }
    shotCam = { pos: new THREE.Vector3(6, 7, 154), look: new THREE.Vector3(0, 1, 108) };
    missions.mode = 'story'; missions.missionIndex = 2; missions.stepIndex = 1;
    missions.showMarker(0, -400);
    hud.toast('M3 · Causeway Run — cross the bridge, lose the cops');
  } else if (SHOT === 'steal') {
    const car = traffic.parked[0];
    // bright red so the car reads clearly against the dusk street
    car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xc03a3a });
    player.pos.x = car.pos.x - 3.2; player.pos.z = car.pos.z + 1.5;
    player.group.position.set(player.pos.x, 0, player.pos.z);
    player.heading = Math.atan2(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    player.camYaw = -Math.PI / 2; player.camPitch = 0.3;
    shotCam = {
      pos: new THREE.Vector3(car.pos.x - 13, 4.6, car.pos.z + 9),
      look: new THREE.Vector3(car.pos.x + 1, 1, car.pos.z),
    };
    missions.mode = 'roam';
    missionCtx.prompt = 'Press E to steal this car';
  } else if (SHOT === 'mission') {
    player.pos.x = -266; player.pos.z = 206;
    player.group.position.set(-266, 0, 206);
    player.heading = Math.atan2(-258 - -266, 200 - 206);
    player.camYaw = Math.PI * 0.82; player.camPitch = 0.28;
    missions.mode = 'story'; missions.missionIndex = 1; missions.stepIndex = 0;
    missions.showMarker(-258, 200);
    police.wanted = 2;
    const cm = makeCarMesh(0, true); scene.add(cm);
    const cop = new Car(cm, -218, 162, Math.PI * 0.72);
    cop.maxSpeed = 4; cop.health = 60; cop.speed = 4; // creeps in slowly, stays in frame
    police.cops.push(cop);
    shotCam = {
      pos: new THREE.Vector3(-282, 5, 218),
      look: new THREE.Vector3(-250, 1, 192),
    };
    hud.toast('M2 · The Drop — grab the package at the marina');
  } else if (SHOT === 'vista') {
    player.pos.x = -30; player.pos.z = 30;
    player.group.position.set(-30, 0, 30);
    player.heading = Math.PI * 0.75;
    missions.mode = 'roam';
    shotCam = { pos: new THREE.Vector3(-300, 75, 200), look: new THREE.Vector3(50, 0, -120) };
    hud.toast('Solmar Bay — free roam');
  }
  if (SHOT !== 'vista') missions.update(0.016, missionCtx);
}

if (SHOT) setupShot();
else ui.showStart(hasSave());

// ---- main loop ----
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (game.state === 'playing') {
    const input = { down, mouseDX, mouseDY };
    missionCtx.pressedE = pressed('KeyE');
    missionCtx.prompt = '';

    // --- on foot / driving ---
    if (player.inCar) {
      const car = player.inCar;
      const throttle = SHOT === 'chase' ? 1 : (down('KeyW') ? 1 : 0) + (down('KeyS') ? -1 : 0);
      const steer = SHOT === 'chase' ? 0 : (down('KeyA') ? -1 : 0) + (down('KeyD') ? 1 : 0);
      const brake = down('Space');
      car.drive(throttle, steer, brake, dt, (x, z) => effects.smoke(x, 0.3, z));
      collide(city, car.pos, 1.6);
      car.sync(dt);
      if (headlight) {
        headlight.position.set(car.pos.x, 2.2, car.pos.z);
        headlight.target.position.set(
          car.pos.x + Math.sin(car.heading) * 20, 0.5, car.pos.z + Math.cos(car.heading) * 20);
      }
      audio.setEngine(Math.abs(car.speed) / car.maxSpeed, true);
      if (pressed('KeyE')) exitCar();
    } else {
      player.update(dt, input, city, null);
      audio.setEngine(0, false);
      if (pressed('KeyE')) {
        const car = nearestCar(4.5);
        if (car) enterCar(car);
      }
      if (pressed('KeyF')) {
        if (combat.punch(peds, (ped) => {
          game.cash += 25; audio.playPunch();
          hud.toast('Pocket cash +$25');
          police.addWanted(1, ped.x, ped.z);
        })) audio.playPunch();
      }
      if (pressed('KeyR')) combat.tryReload();
      if (mouseClicked || (locked && mouseClicked)) {
        const res = combat.shoot(player.camYaw, peds, police, traffic);
        if (res) {
          if (res.empty) { audio.playClick(); hud.toast('Out of ammo — press R to reload'); }
          else {
            audio.playGunshot();
            peds.scare(player.pos.x, player.pos.z, 40);
            police.addWanted(1, player.pos.x, player.pos.z);
            if (res.hit) {
              effects.sparks(res.hx, 1.4, res.hz);
              if (res.hit.type === 'ped') {
                peds.knockDown(res.hit.ped);
                game.cash += 40; hud.toast('Pocket cash +$40');
              } else if (res.hit.type === 'cop') {
                if (police.damageCop(res.hit.cop, 34)) { hud.toast('Cop car disabled!'); audio.playJingle(); }
              } else if (res.hit.type === 'car') {
                res.hit.car.health -= 25;
                if (res.hit.car.health <= 0) effects.burst(res.hit.car.pos.x, 1, res.hit.car.pos.z, 16, 1, 0.6, 0.2, 5, 0.6, 2);
              }
            }
          }
        }
      }
    }

    if (pressed('KeyM')) { const m = audio.toggleMute(); hud.toast(m ? 'Sound muted' : 'Sound on'); }
    if (pressed('Escape')) pauseGame();

    // --- world systems ---
    traffic.update(dt, player.pos, effects);
    peds.update(dt, t);
    ramCooldown -= dt;
    police.update(dt, player, effects,
      () => bustOrWaste('busted'),
      () => {
        if (ramCooldown <= 0) {
          ramCooldown = 1.0;
          if (player.damage(player.inCar ? 4 : 14)) bustOrWaste('wasted');
        }
      });
    if (player.health <= 0) bustOrWaste('wasted');
    combat.update(dt);
    missions.update(dt, missionCtx);
    // context prompt: steal / exit when near a car (missions may set their own).
    // Only traffic/parked cars count — a cop car is not stealable.
    if (!missionCtx.prompt && SHOT !== 'chase') {
      if (player.inCar) missionCtx.prompt = 'Press E to get out';
      else {
        let near = null;
        for (const car of traffic.allCars()) {
          if (Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z) < 4.5) { near = car; break; }
        }
        if (near) missionCtx.prompt = 'Press E to steal this car';
      }
    }
    effects.update(dt);
    audio.setSiren(police.wanted > 0);

    // --- camera ---
    if (SHOT === 'chase' && player.inCar) {
      const c = player.inCar;
      shotCam.pos.set(c.pos.x + 4, 6.5, c.pos.z + 28);
      shotCam.look.set(c.pos.x, 1, c.pos.z - 8);
    }
    if (shotCam) {
      camera.position.copy(shotCam.pos);
      camera.lookAt(shotCam.look);
    } else {
      player.cameraPos(camTarget, camPos);
      camera.position.lerp(camPos, 1 - Math.exp(-10 * dt));
      camera.lookAt(camTarget);
    }

    // --- HUD ---
    hud.update(dt, {
      wanted: police.wanted,
      objective: missions.objectiveText(),
      cash: game.cash,
      health: player.health,
      ammo: combat.ammo, reserve: combat.reserve, reloading: combat.reloading,
      inCar: !!player.inCar,
      speed: player.inCar ? player.inCar.speed : 0,
      prompt: missionCtx.prompt,
      trialTime: missions.trial.active ? missions.trial.time : 0,
      roads: ROAD_LINES,
      stashes: missions.stashes,
      marker: missions.marker,
      cops: police.cops,
      trafficCars: traffic.cars,
      playerX: player.inCar ? player.inCar.pos.x : player.pos.x,
      playerZ: player.inCar ? player.inCar.pos.z : player.pos.z,
      playerHeading: player.inCar ? player.inCar.heading : player.heading,
    });
  }

  renderer.render(scene, camera);
  endFrame();
}
requestAnimationFrame(frame);
