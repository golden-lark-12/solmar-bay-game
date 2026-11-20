// missions.js — "The Debt" story arc (3 missions) plus free-roam activities:
// 10 cash stashes and a 5-gate checkpoint time trial. Owns the objective marker
// (a glowing beacon the player can see across the city) and the mission timer.
import { dist2, fmtCash } from './utils.js';

const MISSIONS = [
  {
    name: 'M1 · Hot Wheels',
    reward: 500,
    steps: [
      { text: 'Steal a car — press E near any car', type: 'steal' },
      { text: 'Drive to the drop-off in Midtown', type: 'goto', x: 120, z: 60, r: 12, inCar: true },
      { text: 'Lose the heat — get your wanted level to zero', type: 'loseheat' },
    ],
  },
  {
    name: 'M2 · The Drop',
    reward: 800,
    steps: [
      { text: 'Pick up the package at the marina — press E', type: 'pickup', x: -258, z: 200, r: 5 },
      { text: 'Deliver the package to Northside — cops are on you', type: 'goto', x: 240, z: -120, r: 12 },
    ],
  },
  {
    name: 'M3 · Causeway Run',
    reward: 1500,
    steps: [
      { text: 'Get in a car and reach the causeway', type: 'goto', x: 0, z: -250, r: 14, inCar: true },
      { text: 'Cross the bridge — make the island', type: 'goto', x: 0, z: -400, r: 14, inCar: true },
    ],
  },
];

export class Missions {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mode = 'roam';          // 'story' | 'roam'
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.done = false;           // whole story done
    this.timer = 0;              // mission timer (0 = none)
    this.carrying = false;
    this.trial = { active: false, gate: 0, time: 0, best: null };
    // objective beacon: glowing pillar + ground ring
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.55, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), mat);
    this.beacon.position.y = 30;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.3;
    scene.add(this.beacon); scene.add(this.ring);
    this.hideMarker();
    // cash stashes: small spinning gold crates
    this.stashes = city.stashSpots.map((s, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshLambertMaterial({ color: 0xffc83a, emissive: 0xaa7700, emissiveIntensity: 0.7 }));
      m.position.set(s.x, 1.4, s.z);
      m.castShadow = true;
      scene.add(m);
      return { x: s.x, z: s.z, mesh: m, taken: false, i };
    });
    // time-trial start pad + gates
    this.trialPad = this.makeGateMesh(0x4ad8ff);
    this.trialPad.position.set(-30, 0, -30);
    scene.add(this.trialPad);
    this.gateMeshes = city.trialGates.map(g => {
      const m = this.makeGateMesh(0x4ad8ff);
      m.position.set(g.x, 0, g.z);
      m.visible = false;
      scene.add(m);
      return m;
    });
  }

  makeGateMesh(color) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.3, 8, 24),
      new THREE.MeshBasicMaterial({ color }));
    ring.position.y = 3.4;
    g.add(ring);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.4, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    post.position.set(-3.4, 1.7, 0); g.add(post);
    const post2 = post.clone(); post2.position.x = 3.4; g.add(post2);
    return g;
  }

  hideMarker() { this.beacon.visible = false; this.ring.visible = false; this.marker = null; }
  showMarker(x, z) {
    this.beacon.visible = true; this.ring.visible = true;
    this.beacon.position.x = x; this.beacon.position.z = z;
    this.ring.position.x = x; this.ring.position.z = z;
    this.marker = { x, z };
  }

  get mission() { return MISSIONS[this.missionIndex]; }
  get step() { return this.mission ? this.mission.steps[this.stepIndex] : null; }

  startStory(index = 0) {
    this.mode = 'story'; this.missionIndex = index; this.stepIndex = 0; this.done = false;
    this.carrying = false; this.timer = 0;
    if (index === 2) return; // M3 heat is set by main when the mission begins
    this.applyStep();
  }

  applyStep() {
    const s = this.step;
    if (!s) return;
    if (s.type === 'goto' || s.type === 'pickup') this.showMarker(s.x, s.z);
    else this.hideMarker();
  }

  completeMission(ctx) {
    const m = this.mission;
    ctx.addCash(m.reward);
    ctx.toast(`${m.name} complete — ${fmtCash(m.reward)}`);
    ctx.jingle();
    this.missionIndex++;
    this.stepIndex = 0;
    if (this.missionIndex >= MISSIONS.length) {
      this.done = true;
      ctx.toast('THE DEBT IS PAID. Solmar Bay is yours — free roam!');
      this.hideMarker();
      return;
    }
    ctx.toast(`${this.mission.name} — ${this.mission.steps[0].text}`);
    if (this.missionIndex === 2) ctx.setWanted(3);
    this.applyStep();
  }

  advanceStep(ctx) {
    this.stepIndex++;
    if (this.stepIndex >= this.mission.steps.length) this.completeMission(ctx);
    else { ctx.toast(this.step.text); this.applyStep(); }
  }

  // Called every frame while playing (story or roam).
  update(dt, ctx) {
    const t = performance.now() / 1000;
    this.beacon.rotation.y = t * 0.8;
    this.ring.rotation.z = t * 0.5;
    for (const s of this.stashes) {
      if (s.taken) continue;
      s.mesh.rotation.y = t * 1.4;
      s.mesh.position.y = 1.4 + Math.sin(t * 2 + s.i) * 0.25;
    }
    // --- story steps ---
    if (this.mode === 'story' && !this.done) {
      const s = this.step;
      const p = ctx.player.inCar ? ctx.player.inCar.pos : ctx.player.pos;
      if (s.type === 'steal' && ctx.player.inCar) this.advanceStep(ctx);
      else if (s.type === 'loseheat' && ctx.police.wanted === 0) this.advanceStep(ctx);
      else if (s.type === 'pickup' && dist2(p.x, p.z, s.x, s.z) < s.r * s.r) {
        ctx.prompt = 'Press E to grab the package';
        if (ctx.pressedE) {
          this.carrying = true;
          ctx.setWanted(2);
          ctx.toast('Package secured — lose the cops and deliver it');
          this.advanceStep(ctx);
        }
      } else if (s.type === 'goto') {
        if (s.inCar && !ctx.player.inCar) ctx.prompt = 'Get in a car';
        else if (dist2(p.x, p.z, s.x, s.z) < s.r * s.r) this.advanceStep(ctx);
      }
    }
    // --- stashes (any mode) ---
    const p = ctx.player.inCar ? ctx.player.inCar.pos : ctx.player.pos;
    for (const s of this.stashes) {
      if (s.taken) continue;
      if (dist2(p.x, p.z, s.x, s.z) < 9) {
        s.taken = true; s.mesh.visible = false;
        ctx.addCash(100); ctx.pickupChime();
        ctx.toast('Cash stash +$100');
        if (ctx.effects) ctx.effects.sparkle(s.x, 1.6, s.z);
      }
    }
    // --- time trial ---
    const tr = this.trial;
    if (!tr.active) {
      if (dist2(p.x, p.z, -30, -30) < 16 && ctx.player.inCar) {
        ctx.prompt = 'Press E to start the checkpoint time trial (90s)';
        if (ctx.pressedE) {
          tr.active = true; tr.gate = 0; tr.time = 90;
          this.gateMeshes.forEach((g, i) => { g.visible = i === 0; });
          ctx.toast('Time trial! Hit all 5 gates before the clock runs out');
        }
      }
    } else {
      tr.time -= dt;
      if (tr.time <= 0) {
        tr.active = false; this.gateMeshes.forEach(g => { g.visible = false; });
        ctx.toast('Time trial failed — out of time'); ctx.failSound();
      } else {
        const g = this.city.trialGates[tr.gate];
        if (dist2(p.x, p.z, g.x, g.z) < 25) {
          tr.gate++;
          ctx.pickupChime();
          if (tr.gate >= this.city.trialGates.length) {
            tr.active = false;
            this.gateMeshes.forEach(m => { m.visible = false; });
            const used = 90 - tr.time;
            ctx.addCash(300);
            if (tr.best === null || used < tr.best) tr.best = Math.round(used * 10) / 10;
            ctx.toast(`Time trial complete in ${used.toFixed(1)}s — +$300`);
            ctx.jingle();
          } else {
            this.gateMeshes.forEach((m, i) => { m.visible = i === tr.gate; });
            ctx.toast(`Gate ${tr.gate} of 5 — keep going`);
          }
        }
      }
    }
  }

  objectiveText() {
    if (this.mode === 'story' && !this.done) {
      return `${this.mission.name} — ${this.step.text}`;
    }
    if (this.trial.active) return `TIME TRIAL — gate ${this.trial.gate + 1} of 5 · ${Math.ceil(this.trial.time)}s left`;
    if (this.done) return 'Free roam — stashes and the time trial pay cash';
    return 'Free roam — press E near a car to steal it';
  }

  applySave(d) {
    if (!d) return;
    this.missionIndex = Math.min(d.missionIndex || 0, MISSIONS.length - 1);
    this.done = (d.missionsDone || []).length >= MISSIONS.length;
    (d.stashes || []).forEach(i => { if (this.stashes[i]) { this.stashes[i].taken = true; this.stashes[i].mesh.visible = false; } });
    this.trial.best = d.bestTrial ?? null;
  }
  saveData() {
    return {
      missionsDone: MISSIONS.slice(0, this.done ? MISSIONS.length : this.missionIndex).map(m => m.name),
      missionIndex: this.missionIndex,
      stashesCollected: this.stashes.map((s, i) => s.taken ? i : -1).filter(i => i >= 0),
      bestTrial: this.trial.best,
    };
  }
}
