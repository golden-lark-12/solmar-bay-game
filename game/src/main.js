// main.js — boot + game loop + shot mode. Wires every system together:
// city, player, cars, traffic, pedestrians, police (helicopter + roadblock),
// combat (weapon slots), missions (8 story jobs + crew), HUD, menus, audio,
// save. Shot mode (?shot=chase|steal|mission|vista) stages a deterministic
// scene with the menu hidden for screenshots.
import { mulberry32, clamp, dist2, fmtClock, fmtTime } from './utils.js';
import { initInput, pressed, down, endFrame, mouseDX, mouseDY, mouseClicked, locked } from './input.js';
import * as audio from './audio.js';
import { buildCity, collide, ROAD_LINES } from './city.js';
import { Player } from './player.js';
import { Car, makeCarMesh, makeWreckMesh } from './vehicle.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions, CREW } from './missions.js';
import { HUD } from './hud.js';
import { UI } from './ui.js';
import { Effects } from './effects.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
if (SHOT) window.__PUERTO_ALBA_SHOT__ = SHOT;

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

const RADIO = [
  'RADIO ALBA 98.6 — Guava Sunrise',
  'OMBO 98.4 — Island Pop',
  'LUMEN FM 98.6 — Neon Tideline',
];
const CAR_NAMES = {
  0xc03a3a: 'CORAL GT', 0x3a6ac0: 'BRISA S', 0xe8c84a: 'ALBA GT', 0x4aa86a: 'VERDE GT',
  0xd8d8d8: 'PLATA GT', 0x2a2a30: 'NOCHE GT', 0xe07a2a: 'PUESTA GT', 0x8a4aa8: 'VIOLETA GT',
};
const CAR_NAMES_BY_INDEX = ['CORAL GT', 'BRISA S', 'ALBA GT', 'VERDE GT', 'PLATA GT', 'NOCHE GT', 'PUESTA GT', 'VIOLETA GT'];
const GIVER_COLORS = {
  'Marisol "Sol" Quintana': '#7a4ac0', 'Tía Rosa': '#e07a2a', 'Lupe': '#4aa86a',
  'Uncle Dee': '#c0a03a', 'Mira Kesang': '#c0392b',
};

const game = {
  state: 'menu', // menu | playing | paused
  cash: 250,
  shot: SHOT,
  clockMin: 18 * 60 + 45, // 18:45 golden hour
  missionsDone: [],
  crew: CREW.map(c => ({ ...c, t: 0 })),
  get missionIndex() { return missions.missionIndex; },
};
// Debug handle for headless verification (position checks, no personal data).
window.__PUERTO_ALBA_STATE__ = { player, police, missions, combat, game };

let headlight = null;
let ramCooldown = 0;
let camTarget = new THREE.Vector3();
let camPos = new THREE.Vector3();
let shotCam = null;
let shotHud = null;   // staged HUD overrides for screenshots
let wreck = null;     // burning wreck (mission shot)
let wreckLight = null;
let wreckFlame = null;
let wreckPos = { x: 4, z: -212 };

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
  player.armour = d.armour ?? 55;
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
    hud.toast(missions.done ? 'Welcome back — free roam' : 'Welcome back to Puerto Alba');
  } else if (mode === 'story') {
    player.respawn(city.spawn.x, city.spawn.z);
    game.cash = 250;
    missions.startStory(0);
    hud.toast('Sol is waiting on that debt — get moving');
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
  boom() { audio.playExplosion(); },
  setWanted(n) { police.wanted = n; },
};

// --- crew abilities (Z / X / C), each with a cooldown ---
function crewState() {
  return game.crew.map(a => ({
    key: a.key, name: a.name, who: a.who,
    cd: Math.ceil(a.t), ready: a.t <= 0,
  }));
}

function useCrew(i) {
  const a = game.crew[i];
  if (!a) return;
  if (a.t > 0) { hud.toast(`${a.name} recharging — ${Math.ceil(a.t)}s`); return; }
  a.t = a.cd;
  if (i === 0) {
    police.wanted = Math.max(0, police.wanted - 1);
    hud.toast('Plates swapped — heat drops a star');
  } else if (i === 1) {
    if (player.inCar) {
      player.inCar.health = Math.min(100, player.inCar.health + 30);
      hud.toast('Lio patched the car up — condition +30%');
    } else {
      player.heal(25);
      hud.toast('Lio patched you up — health +25');
    }
  } else {
    const d = police.dispatchUnits(player.inCar ? player.inCar.pos : player.pos);
    hud.toast(d.total > 0
      ? `Kiki: ${d.total} units out — ${d.units[0] ? d.units[0].name + ' ' + d.units[0].dist + 'm' : ''}${police.roadblock ? ', roadblock ahead' : ''}`
      : 'Kiki: coast is clear');
  }
  audio.playChime();
}

function carNameFor(car) {
  if (!car || !car.mesh) return '';
  if (car.mesh.userData.police) return 'PAPD CRUISER';
  if (car.colorIndex !== undefined) return CAR_NAMES_BY_INDEX[car.colorIndex] || 'STREET CAR';
  const hex = car.mesh.children[0] && car.mesh.children[0].material
    ? car.mesh.children[0].material.color.getHex() : 0;
  return CAR_NAMES[hex] || 'STREET CAR';
}

function locationFor(x, z) {
  if (z < -240) return { place: 'The Causeway', street: 'Causeway Bridge' };
  if (x < -240) return { place: 'Alba Strand', street: 'Strand Boulevard' };
  if (x < -120 && z > 120) return { place: 'Marina Row', street: 'Harbour Road' };
  if (z > 180) return { place: 'Southside', street: 'Palmera Avenue' };
  if (Math.abs(x) < 130 && Math.abs(z) < 130) return { place: 'Downtown', street: 'Sol Avenue' };
  if (z < -120) return { place: 'Northside', street: 'Torre Road' };
  return { place: 'Midtown', street: 'Sol Avenue' };
}

function initialsOf(name) {
  const parts = name.replace(/["“”]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function dialogueFor(job) {
  if (!job) return null;
  return {
    name: job.giver, role: job.role, line: job.line,
    initials: initialsOf(job.giver), color: GIVER_COLORS[job.giver] || '#4a8ac0',
  };
}

function setupShot() {
  game.state = 'playing';
  ui.hide();
  document.getElementById('hud').style.display = 'block';
  if (SHOT === 'chase') {
    // Cover: golden-hour chase down the Strand — helicopter + spotlight above,
    // two cops flanking, a roadblock ahead, beach and palms to the west.
    const mesh = makeCarMesh(6); scene.add(mesh); // orange Puesta GT
    const car = new Car(mesh, -239, 88, Math.PI);
    car.colorIndex = 6;
    car.owned = true; car.speed = 31; car.maxSpeed = 34; car.health = 62;
    player.inCar = car; player.group.visible = false;
    makeHeadlight();
    police.wanted = 4;
    for (const [cx, cz] of [[-246, 78], [-232, 82]]) {
      const cm = makeCarMesh(0, true); scene.add(cm);
      const cop = new Car(cm, cx, cz, Math.PI);
      cop.maxSpeed = 30; cop.health = 60; cop.speed = 30;
      cop.staged = true; cop.sync(0.016);
      police.cops.push(cop);
    }
    police.placeRoadblock(-240, 18, Math.PI);
    // heli staged low and ahead of the player so the body + cone stay in frame
    police.heliOffset = { x: 8, z: -25 };
    police.heliY = 18;
    police.heli.position.set(-231, 18, 63);
    shotCam = { pos: new THREE.Vector3(-234, 6.5, 118), look: new THREE.Vector3(-240, 1, 55) };
    missions.mode = 'story'; missions.missionIndex = 5; missions.stepIndex = 0;
    missions.showMarker(-240, 40);
    missions.hideBeacon(); // the tall beacon pillar would fight the heli spotlight
    shotHud = {
      jobLabel: 'JOB 6/8 · WRECK THE REGENT', timerText: '2:29',
      objective: 'Wreck the Regent before it reaches the pier',
      stage: 3, stageTotal: 4, stageText: 'STAGE 3/4', nextText: 'Vanish',
      cash: 18450, clock: '16:00', wanted: 4, sight: 'IN SIGHT · AIR ONE OVERHEAD',
      respect: { rank: 'FIXER', rp: 3900, rpMax: 5200 },
      condition: 62, speedKmh: 111, carName: 'PUESTA GT',
      radio: 'OMBO 98.4 — Island Pop', location: 'Alba Strand', street: 'Strand Boulevard',
      dialogue: { name: 'Mira Kesang', role: 'DRIVER · CREW', initials: 'MK', color: '#c0392b',
        line: "He's making for Puerto Alba Pier! Ram the Regent before it reaches the water!" },
    };
  } else if (SHOT === 'steal') {
    // Car steal on Marina Row: Ria beside the valet coupe, cops already rolling.
    const car = traffic.parked[0];
    car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xc03a3a });
    car.pos.x = -236; car.pos.z = 60; car.heading = Math.PI;
    car.sync(0.016);
    // close enough (4.1 m) that the "Press E to steal this car" prompt shows
    player.pos.x = car.pos.x - 1; player.pos.z = car.pos.z + 4;
    player.group.position.set(player.pos.x, 0, player.pos.z);
    player.heading = Math.atan2(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    player.camYaw = -Math.PI / 2; player.camPitch = 0.3;
    police.wanted = 3;
    for (const [cx, cz] of [[-250, 108], [-228, 118]]) {
      const cm = makeCarMesh(0, true); scene.add(cm);
      const cop = new Car(cm, cx, cz, Math.PI);
      cop.maxSpeed = 26; cop.health = 60; cop.speed = 20;
      cop.staged = true; cop.sync(0.016);
      police.cops.push(cop);
    }
    police.heliOffset = { x: -18, z: -26 };
    police.heliY = 16;
    police.heli.position.set(-255, 16, 38);
    shotCam = {
      pos: new THREE.Vector3(-226, 4.8, 82),
      look: new THREE.Vector3(-238, 1, 58),
    };
    missions.mode = 'story'; missions.missionIndex = 3; missions.stepIndex = 0;
    missions.showMarker(-236, 60);
    missions.hideBeacon();
    shotHud = {
      jobLabel: 'JOB 4/8 · REPO RODEO', timerText: '',
      objective: 'Lift the valet coupe on Marina Row — press E',
      stage: 1, stageTotal: 3, stageText: 'STAGE 1/3', nextText: 'Deliver the coupe to El Desguace',
      cash: 6420, clock: '17:19', wanted: 3, sight: 'IN SIGHT',
      respect: { rank: 'DRIVER', rp: 340, rpMax: 1000 },
      radio: 'RADIO ALBA 98.6 — Guava Sunrise', location: 'Marina Row', street: 'Harbour Road',
      dialogue: { name: 'Tía Rosa', role: 'DINER OWNER · FAMILY', initials: 'TR', color: '#e07a2a',
        line: 'The valet called it in. Shake them off before Nacho closes the gate, mijo.' },
    };
  } else if (SHOT === 'mission') {
    // JOB 7/8 Golden Hour: the manhunt on the Causeway — burning wreck,
    // roadblock ahead, helicopter spotlight, two cops closing in.
    const mesh = makeCarMesh(0); scene.add(mesh); // red Coral GT
    const car = new Car(mesh, 0, -190, Math.PI);
    car.colorIndex = 0;
    car.owned = true; car.speed = 31; car.maxSpeed = 34; car.health = 84;
    player.inCar = car; player.group.visible = false;
    makeHeadlight();
    police.wanted = 4;
    for (const [cx, cz] of [[-4, -224], [4, -228]]) {
      const cm = makeCarMesh(0, true); scene.add(cm);
      const cop = new Car(cm, cx, cz, Math.PI);
      cop.maxSpeed = 26; cop.health = 60; cop.speed = 18;
      cop.staged = true; cop.sync(0.016);
      police.cops.push(cop);
    }
    police.placeRoadblock(0, -230, Math.PI);
    police.heliOffset = { x: -16, z: -15 };
    police.heliY = 18;
    police.heli.position.set(-16, 18, -205);
    wreckPos = { x: 4, z: -212 };
    wreck = makeWreckMesh();
    wreck.position.set(wreckPos.x, 0, wreckPos.z); wreck.rotation.y = 0.6;
    scene.add(wreck);
    // flickering flame cone on the wreck so the fire reads at a distance
    wreckFlame = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.85 }));
    wreckFlame.position.set(wreckPos.x, 2.2, wreckPos.z);
    scene.add(wreckFlame);
    wreckLight = new THREE.PointLight(0xff7a20, 2.2, 26);
    wreckLight.position.set(wreckPos.x, 2.5, wreckPos.z);
    scene.add(wreckLight);
    effects.explode(wreckPos.x, 1, wreckPos.z);
    shotCam = { pos: new THREE.Vector3(4, 4.5, -168), look: new THREE.Vector3(0, 1.5, -218) };
    missions.mode = 'story'; missions.missionIndex = 6; missions.stepIndex = 0;
    missions.timer = 107;
    missions.showMarker(-280, 0);
    missions.hideBeacon();
    shotHud = {
      jobLabel: 'JOB 7/8 · GOLDEN HOUR', timerText: '1:47',
      objective: 'Lose the manhunt before the boat sails',
      stage: 4, stageTotal: 5, stageText: 'STAGE 4/5', nextText: 'Reach the boat at the pier',
      cash: 12400, clock: '18:48', wanted: 4, sight: 'IN SIGHT · Air One has the light',
      respect: { rank: 'SHOT CALLER', rp: 4980, rpMax: 5200 },
      condition: 84, speedKmh: 113, carName: 'CORAL GT',
      radio: 'RADIO ALBA 98.6 — Guava Sunrise', location: 'The Causeway', street: 'Causeway Bridge',
      dialogue: { name: 'Lupe', role: 'SMUGGLER', initials: 'LU', color: '#4aa86a',
        line: 'The boat sails in two minutes. Shake that chopper and get to the pier!' },
    };
  } else if (SHOT === 'vista') {
    // Vista: the Strand at golden hour — beach, palms, umbrellas, hotels and
    // the downtown skyline, sun low over the ocean.
    const mesh = makeCarMesh(2); scene.add(mesh); // gold Alba GT
    const car = new Car(mesh, -240, 60, Math.PI);
    car.colorIndex = 2;
    car.owned = true; car.speed = 0; car.maxSpeed = 34;
    player.inCar = car; player.group.visible = false;
    makeHeadlight();
    // one distant unit keeps the dispatch panel alive on an otherwise calm vista
    police.wanted = 1;
    {
      const cm = makeCarMesh(0, true); scene.add(cm);
      const cop = new Car(cm, -180, -60, Math.PI);
      cop.maxSpeed = 26; cop.health = 60; cop.speed = 12;
      cop.staged = true; cop.sync(0.016);
      police.cops.push(cop);
    }
    missions.mode = 'roam';
    missions.showMarker(120, -120);
    missions.hideBeacon();
    // high over the city looking west: skyline, beach, ocean and the low sun
    shotCam = { pos: new THREE.Vector3(60, 120, 160), look: new THREE.Vector3(-260, 0, -50) };
    shotHud = {
      jobLabel: 'FREE ROAM · PUERTO ALBA', timerText: '',
      objective: 'Free roam — stashes and the time trial pay cash',
      stage: 0, stageTotal: 0, stageText: '', nextText: '',
      cash: 2750, clock: '17:41', wanted: 1, sight: '',
      respect: { rank: 'DRIVER', rp: 65, rpMax: 1000 },
      condition: 100, speedKmh: 0, carName: 'ALBA GT',
      radio: 'LUMEN FM 98.6 — Neon Tideline', location: 'Alba Strand', street: 'The Strand',
      dialogue: { name: 'Marisol "Sol" Quintana', role: 'FIXER', initials: 'MQ', color: '#7a4ac0',
        line: 'The whole bay is yours tonight, Ria. Drive like you own it.' },
    };
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
    game.clockMin += dt / 10; // one in-game minute per 10 real seconds
    for (const a of game.crew) a.t = Math.max(0, a.t - dt);
    combat.unlockForJobs(missions.jobsDoneCount);

    // --- on foot / driving ---
    if (player.inCar) {
      const car = player.inCar;
      if (!SHOT) {
        const throttle = (down('KeyW') ? 1 : 0) + (down('KeyS') ? -1 : 0);
        const steer = (down('KeyA') ? -1 : 0) + (down('KeyD') ? 1 : 0);
        const brake = down('Space');
        car.drive(throttle, steer, brake, dt, (x, z) => effects.smoke(x, 0.3, z));
        collide(city, car.pos, 1.6);
        car.sync(dt);
      } else {
        car.sync(dt); // staged: hold the frame, wheels spin from speed
      }
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
        const res = combat.shoot(player.camYaw, peds, police, traffic, missions.targetRaycast());
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
                if (police.damageCop(res.hit.cop, res.dmg)) { hud.toast('Cop car disabled!'); audio.playJingle(); }
              } else if (res.hit.type === 'car') {
                res.hit.car.health -= res.dmg;
                if (res.hit.car.health <= 0) effects.burst(res.hit.car.pos.x, 1, res.hit.car.pos.z, 16, 1, 0.6, 0.2, 5, 0.6, 2);
              } else if (res.hit.type === 'target') {
                const tc = res.hit.car;
                tc.health -= res.dmg;
                if (tc.health <= 0) {
                  effects.explode(tc.pos.x, 1, tc.pos.z);
                  audio.playExplosion();
                  hud.toast('The Regent is wrecked — Sol will hear about this');
                  missions.clearTarget();
                  missions.advanceStep(missionCtx);
                }
              }
            }
          }
        }
      }
    }

    // --- weapons + crew keys ---
    for (let i = 0; i < 6; i++) {
      if (pressed('Digit' + (i + 1))) {
        const slot = combat.slots[i];
        if (slot.locked) hud.toast(`${slot.name} is locked — earn it on later jobs`);
        else if (combat.select(i)) hud.toast(`${slot.name} ready`);
      }
    }
    if (pressed('KeyZ')) useCrew(0);
    if (pressed('KeyX')) useCrew(1);
    if (pressed('KeyC')) useCrew(2);

    if (pressed('KeyM')) { const m = audio.toggleMute(); hud.toast(m ? 'Sound muted' : 'Sound on'); }
    if (pressed('Escape')) pauseGame();

    // --- world systems ---
    traffic.update(dt, player.pos, effects);
    peds.update(dt, t);
    ramCooldown -= dt;
    police.update(dt, player, effects,
      () => bustOrWaste('busted'),
      () => {
        if (SHOT) return; // staged frames: rams are for show, no damage
        if (ramCooldown <= 0) {
          ramCooldown = 1.0;
          if (player.inCar) player.inCar.health = Math.max(0, player.inCar.health - 4);
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
    // burning wreck keeps flaming (mission shot)
    if (wreck) {
      effects.fire(wreckPos.x, 1, wreckPos.z);
      if (wreckLight) wreckLight.intensity = 1.8 + Math.sin(t * 11) * 0.5 + Math.random() * 0.3;
      if (wreckFlame) {
        wreckFlame.scale.y = 0.85 + Math.sin(t * 13) * 0.2 + Math.random() * 0.1;
        wreckFlame.rotation.y += dt * 2;
      }
    }

    // --- camera ---
    if (shotCam) {
      camera.position.copy(shotCam.pos);
      camera.lookAt(shotCam.look);
    } else {
      player.cameraPos(camTarget, camPos);
      camera.position.lerp(camPos, 1 - Math.exp(-10 * dt));
      camera.lookAt(camTarget);
    }

    // --- HUD ---
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    const job = missions.mode === 'story' && !missions.done ? missions.mission : null;
    const loc = locationFor(pPos.x, pPos.z);
    const nextStep = job && missions.stepIndex + 1 < job.steps.length
      ? job.steps[missions.stepIndex + 1].text : '';
    const base = {
      wanted: police.wanted,
      cash: game.cash,
      clock: fmtClock(game.clockMin),
      jobLabel: job ? job.name : 'FREE ROAM · PUERTO ALBA',
      objective: missions.objectiveText(),
      stage: job ? missions.stage : 0,
      stageTotal: job ? missions.stageTotal : 0,
      stageText: job ? `STAGE ${missions.stage}/${missions.stageTotal}` : '',
      timerText: missions.timer > 0 ? fmtTime(missions.timer)
        : (missions.trial.active ? 'TRIAL ' + fmtTime(missions.trial.time) : ''),
      nextText: nextStep,
      sight: police.wanted > 0
        ? (police.heli.visible ? 'IN SIGHT · AIR ONE OVERHEAD' : 'IN SIGHT') : '',
      respect: missions.respectInfo(),
      dispatch: police.dispatchUnits(pPos),
      weapons: combat.slotInfo(),
      crew: crewState(),
      location: loc.place,
      street: loc.street,
      health: player.health,
      armour: player.armour,
      dialogue: dialogueFor(job),
      inCar: !!player.inCar,
      speedKmh: player.inCar ? Math.abs(player.inCar.speed) * 3.6 : 0,
      condition: player.inCar ? player.inCar.health : 100,
      carName: player.inCar ? carNameFor(player.inCar) : '',
      radio: RADIO[Math.floor(game.clockMin / 30) % RADIO.length],
      prompt: missionCtx.prompt,
      trialTime: missions.trial.active ? missions.trial.time : 0,
      roads: ROAD_LINES,
      stashes: missions.stashes,
      marker: missions.marker,
      cops: police.cops,
      trafficCars: traffic.cars,
      roadblock: police.roadblock,
      targetCar: missions.targetCar ? { x: missions.targetCar.pos.x, z: missions.targetCar.pos.z } : null,
      heli: police.heli.visible
        ? { x: police.heli.position.x, z: police.heli.position.z } : null,
      playerX: pPos.x,
      playerZ: pPos.z,
      playerHeading: player.inCar ? player.inCar.heading : player.heading,
    };
    hud.update(dt, shotHud ? { ...base, ...shotHud } : base);
  }

  renderer.render(scene, camera);
  endFrame();
}
requestAnimationFrame(frame);
