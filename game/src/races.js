// races.js — street races: timed checkpoint runs with 3 rival cars,
// best times, cash prizes. Races run on the Strand loop and the Causeway.
// Puerto Alba.

import { rand, randi, fmtClock } from './utils.js';
import { Car, randomCarColor } from './vehicle.js';

export const RACE_DEFS = [
  {
    id: 'strand-gp', name: 'Strand Grand Prix', district: 'The Strand',
    prize: 4000, checkpoints: [[-220, 205], [-40, 205], [140, 205], [230, 240], [120, 240], [-60, 240], [-220, 240]]
  },
  {
    id: 'causeway-dash', name: 'Causeway Dash', district: 'Causeway',
    prize: 5500, checkpoints: [[0, 160], [0, 320], [0, 470], [30, 520], [-30, 520], [0, 470], [0, 320], [0, 160]]
  }
];

export class Races {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.active = null; // {def, cpIndex, time, rivals[], markers[]}
    this.best = {}; // race id -> best seconds
    this.markerMat = null;
  }

  startRace(id, playerCar) {
    const def = RACE_DEFS.find(r => r.id === id);
    if (!def || !playerCar) return null;
    this.endRace(false);
    const rivals = [];
    for (let i = 0; i < 3; i++) {
      const c = new Car(this.THREE, this.scene, {
        x: playerCar.x + (i - 1) * 6, z: playerCar.z - 8 - i * 4,
        color: randomCarColor(), name: 'Rival ' + (i + 1), topSpeed: rand(26, 30), isRival: true
      });
      rivals.push({ car: c, cpIndex: 0, finished: false, time: 0 });
    }
    const markers = [];
    const ringGeo = new THREE.TorusGeometry(5.5, 0.55, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
    for (const [x, z] of def.checkpoints) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, 5.5, z);
      this.scene.add(ring);
      markers.push(ring);
    }
    this.active = { def, cpIndex: 0, time: 0, rivals, markers, finished: false };
    return this.active;
  }

  // Advance checkpoints when the player car passes within radius.
  update(dt, playerCar) {
    if (!this.active || this.active.finished) return null;
    const a = this.active;
    a.time += dt;
    const cp = a.def.checkpoints[a.cpIndex];
    if (playerCar && Math.hypot(playerCar.x - cp[0], playerCar.z - cp[1]) < 12) {
      a.cpIndex += 1;
      // Highlight the next ring.
      for (let i = 0; i < a.markers.length; i++) {
        a.markers[i].material = new THREE.MeshBasicMaterial({
          color: i === a.cpIndex ? 0xffd76a : (i < a.cpIndex ? 0x3ad86a : 0x888888)
        });
      }
      if (a.cpIndex >= a.def.checkpoints.length) {
        return this.finishRace(true);
      }
    }
    // Rivals chase the checkpoints.
    for (const r of a.rivals) {
      if (r.finished) continue;
      const target = a.def.checkpoints[r.cpIndex];
      if (!target) { r.finished = true; r.time = a.time; continue; }
      r.car.chase(dt, target[0], target[1], r.car.topSpeed);
      if (Math.hypot(r.car.x - target[0], r.car.z - target[1]) < 12) r.cpIndex += 1;
    }
    // Rival wins first? Only matters if all rivals finished before the player.
    if (a.rivals.every(r => r.finished)) return this.finishRace(false);
    return null;
  }

  finishRace(playerWon) {
    if (!this.active) return null;
    const a = this.active;
    a.finished = true;
    const result = {
      won: playerWon, time: a.time, prize: playerWon ? a.def.prize : 0,
      best: false, raceName: a.def.name
    };
    if (playerWon) {
      const prev = this.best[a.def.id];
      if (prev === undefined || a.time < prev) {
        this.best[a.def.id] = a.time;
        result.best = true;
      }
    }
    for (const r of a.rivals) r.car.dispose();
    for (const m of a.markers) this.scene.remove(m);
    this.active = null;
    return result;
  }

  endRace(cancelled) {
    if (!this.active) return;
    for (const r of this.active.rivals) r.car.dispose();
    for (const m of this.active.markers) this.scene.remove(m);
    this.active = null;
  }

  bestTime(id) { return this.best[id]; }
  bestTimeText(id) {
    const b = this.best[id];
    return b === undefined ? '—' : fmtClock(b);
  }

  serialize() { return Object.assign({}, this.best); }
  restore(data) {
    if (!data) return;
    for (const k of Object.keys(data)) if (typeof data[k] === 'number') this.best[k] = data[k];
  }
}
