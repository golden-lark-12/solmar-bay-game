// missions.js — "The Debt" story arc: 8 story jobs across Puerto Alba, each with
// a named giver and a spoken line, plus free-roam activities: 10 cash stashes
// and a 5-gate checkpoint time trial. Owns the objective marker (a glowing
// beacon the player can see across the city), the mission timer, and the
// respect points (RP) that climb DRIVER -> FIXER -> SHOT CALLER as jobs pay off.
// Step types: steal, goto, loseheat, pickup, timed (survive the clock), ram
// (wreck a target car before it escapes).
import { dist2, fmtCash, respectRank } from './utils.js';
import { makeCarMesh } from './vehicle.js';

export const CREW = [
  { key: 'Z', name: 'SWAP PLATES', who: 'Mira · Driver', cd: 60 },
  { key: 'X', name: 'QUICK FIX', who: 'Lio · Mechanic', cd: 45 },
  { key: 'C', name: 'EYES OUT', who: 'Kiki · Lookout', cd: 30 },
];

const JOBS = [
  {
    name: 'JOB 1/8 · Hot Wheels', short: 'Hot Wheels',
    giver: 'Marisol "Sol" Quintana', role: 'FIXER',
    line: 'Ria, the debt clock is ticking. Lift something fast and bring it to Midtown.',
    reward: 500, wanted: 0,
    steps: [
      { text: 'Steal a car — press E near any car', type: 'steal' },
      { text: 'Drive to the drop-off in Midtown', type: 'goto', x: 120, z: 60, r: 12, inCar: true },
      { text: 'Lose the heat — get your wanted level to zero', type: 'loseheat' },
    ],
  },
  {
    name: 'JOB 2/8 · The Drop', short: 'The Drop',
    giver: 'Tía Rosa', role: 'DINER OWNER · FAMILY',
    line: 'Mijo, the package waits at the marina. Cops or no cops, it gets to Northside.',
    reward: 800, wanted: 0,
    steps: [
      { text: 'Pick up the package at the marina — press E', type: 'pickup', x: -258, z: 200, r: 5 },
      { text: 'Deliver the package to Northside — cops are on you', type: 'goto', x: 240, z: -120, r: 12 },
    ],
  },
  {
    name: 'JOB 3/8 · Causeway Run', short: 'Causeway Run',
    giver: 'Lupe', role: 'SMUGGLER',
    line: 'The bridge is the only way off the island. Drive like the tide is behind you.',
    reward: 1500, wanted: 3,
    steps: [
      { text: 'Get in a car and reach the causeway', type: 'goto', x: 0, z: -250, r: 14, inCar: true },
      { text: 'Cross the bridge — make the island', type: 'goto', x: 0, z: -400, r: 14, inCar: true },
    ],
  },
  {
    name: 'JOB 4/8 · Repo Rodeo', short: 'Repo Rodeo',
    giver: 'Tía Rosa', role: 'DINER OWNER · FAMILY',
    line: 'The valet called it in. Shake them off before Nacho closes the gate, mijo.',
    reward: 1200, wanted: 0,
    steps: [
      { text: 'Lift the valet coupe on Marina Row — press E', type: 'steal' },
      { text: 'Deliver the coupe to El Desguace', type: 'goto', x: 240, z: 180, r: 12, inCar: true },
      { text: 'Lose the heat — get your wanted level to zero', type: 'loseheat' },
    ],
  },
  {
    name: 'JOB 5/8 · Salt & Sirens', short: 'Salt & Sirens',
    giver: 'Uncle Dee', role: 'FIXER',
    line: 'Every cruiser in the bay wants that coral Vireo. Forty seconds on the parade, then you vanish.',
    reward: 1800, wanted: 3,
    steps: [
      { text: 'Stay in the parade for 40 seconds — do not get busted', type: 'timed', secs: 40 },
      { text: 'Break away and lose the heat', type: 'loseheat' },
    ],
  },
  {
    name: 'JOB 6/8 · Wreck the Regent', short: 'Wreck the Regent',
    giver: 'Mira Kesang', role: 'DRIVER · CREW',
    line: "He's making for Puerto Alba Pier! Ram the Regent before it reaches the water!",
    reward: 2200, wanted: 3,
    steps: [
      { text: 'Cut off the Regent on the Strand', type: 'goto', x: -240, z: 40, r: 16, inCar: true },
      { text: 'Wreck the Regent — ram it or shoot it out', type: 'ram', tx: -120, tz: 0, gx: -262, gz: 0 },
    ],
  },
  {
    name: 'JOB 7/8 · Golden Hour', short: 'Golden Hour',
    giver: 'Lupe', role: 'SMUGGLER',
    line: 'The boat sails in two minutes. Shake that chopper and get to the pier!',
    reward: 3000, wanted: 4,
    steps: [
      { text: 'Lose the manhunt before the boat sails', type: 'timed', secs: 120 },
      { text: 'Reach the boat at the pier', type: 'goto', x: -280, z: 0, r: 12 },
    ],
  },
  {
    name: 'JOB 8/8 · The Debt Paid', short: 'The Debt Paid',
    giver: 'Marisol "Sol" Quintana', role: 'FIXER',
    line: 'One last run, Ria. Bring the ledger home and the debt dies tonight.',
    reward: 5000, wanted: 3,
    steps: [
      { text: 'Pick up the ledger at the old depot — press E', type: 'pickup', x: 60, z: -120, r: 5 },
      { text: 'Bring the ledger to Sol’s garage', type: 'goto', x: -120, z: 120, r: 12 },
      { text: 'Lose the heat — the debt is almost paid', type: 'loseheat' },
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
    this.targetCar = null;       // the Regent, during JOB 6's ram step
    this.ramCooldown = 0;
    this.jobsDoneCount = 0;
    this.stashesTaken = 0;
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
  // Hide the 3D beacon pillar but keep the marker (minimap route still draws).
  hideBeacon() { this.beacon.visible = false; this.ring.visible = false; }
  showMarker(x, z) {
    this.beacon.visible = true; this.ring.visible = true;
    this.beacon.position.x = x; this.beacon.position.z = z;
    this.ring.position.x = x; this.ring.position.z = z;
    this.marker = { x, z };
  }

  get mission() { return JOBS[this.missionIndex]; }
  get job() { return this.mission; }
  get step() { return this.mission ? this.mission.steps[this.stepIndex] : null; }
  get stage() { return this.stepIndex + 1; }
  get stageTotal() { return this.mission ? this.mission.steps.length : 0; }

  // Respect points: 600 per finished job, 40 per stash, 100 for a trial best.
  respectRP() {
    return this.jobsDoneCount * 600 + this.stashesTaken * 40 + (this.trial.best !== null ? 100 : 0);
  }
  respectInfo() {
    const rp = this.respectRP();
    const info = respectRank(rp);
    return { rp, rank: info.rank, rpMax: info.rpMax };
  }

  startStory(index = 0) {
    this.mode = 'story'; this.missionIndex = index; this.stepIndex = 0; this.done = false;
    this.carrying = false; this.timer = 0;
    this.clearTarget();
    this.applyStep();
  }

  applyStep() {
    const s = this.step;
    if (!s) return;
    if (s.type === 'goto' || s.type === 'pickup') this.showMarker(s.x, s.z);
    else if (s.type === 'ram') { this.spawnTarget(s); this.showMarker(s.tx, s.tz); }
    else if (s.type === 'timed') { this.timer = s.secs; this.hideMarker(); }
    else this.hideMarker();
  }

  // The Regent: a gold sedan fleeing west down the Strand toward the pier.
  spawnTarget(s) {
    this.clearTarget();
    const mesh = makeCarMesh(2); // gold
    this.scene.add(mesh);
    // lightweight target: missions owns a plain object and drives it directly in update().
    this.targetCar = {
      mesh, pos: { x: s.tx, z: s.tz }, heading: Math.PI * 1.5,
      speed: 11, maxSpeed: 13, health: 100, gx: s.gx, gz: s.gz,
      sync(dt) {
        this.mesh.position.set(this.pos.x, 0, this.pos.z);
        this.mesh.rotation.y = this.heading;
        const spin = this.speed * dt / 0.38;
        for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
      },
    };
    this.targetCar.sync(0.016);
  }

  clearTarget() {
    if (this.targetCar) { this.scene.remove(this.targetCar.mesh); this.targetCar = null; }
  }

  // Extra raycast target for combat.shoot while the ram step is live.
  targetRaycast() {
    if (!this.targetCar) return [];
    return [{ x: this.targetCar.pos.x, z: this.targetCar.pos.z, r: 1.6, ref: { type: 'target', car: this.targetCar } }];
  }

  completeMission(ctx) {
    const m = this.mission;
    ctx.addCash(m.reward);
    this.jobsDoneCount++;
    ctx.toast(`${m.short} complete — ${fmtCash(m.reward)} banked`);
    ctx.jingle();
    this.clearTarget();
    this.missionIndex++;
    this.stepIndex = 0;
    if (this.missionIndex >= JOBS.length) {
      this.done = true;
      ctx.toast('THE DEBT IS PAID. Puerto Alba is yours — free roam!');
      this.hideMarker();
      return;
    }
    if (this.mission.wanted) ctx.setWanted(this.mission.wanted);
    this.applyStep();
  }

  advanceStep(ctx) {
    this.stepIndex++;
    if (this.stepIndex >= this.mission.steps.length) this.completeMission(ctx);
    else { ctx.pickupChime(); this.applyStep(); }
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
    this.ramCooldown -= dt;
    // --- target car (ram step): drives for the pier; rams hurt it
    if (this.targetCar) {
      const tc = this.targetCar;
      const dx = tc.gx - tc.pos.x, dz = tc.gz - tc.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 3) {
        tc.heading = Math.atan2(dx, dz);
        tc.pos.x += Math.sin(tc.heading) * tc.speed * dt;
        tc.pos.z += Math.cos(tc.heading) * tc.speed * dt;
      }
      tc.sync(dt);
      const p = ctx.player.inCar ? ctx.player.inCar.pos : ctx.player.pos;
      const pd = Math.hypot(p.x - tc.pos.x, p.z - tc.pos.z);
      if (ctx.player.inCar && pd < 4.2 && this.ramCooldown <= 0) {
        this.ramCooldown = 0.8;
        tc.health -= 25;
        if (ctx.effects) ctx.effects.sparks(tc.pos.x, 1.2, tc.pos.z);
        if (ctx.player.inCar) ctx.player.inCar.health = Math.max(40, ctx.player.inCar.health - 3);
        if (tc.health <= 0) {
          if (ctx.effects) ctx.effects.explode(tc.pos.x, 1, tc.pos.z);
          if (ctx.boom) ctx.boom();
          ctx.toast('The Regent is wrecked — Sol will hear about this');
          this.advanceStep(ctx);
        }
      }
      // marker follows the moving target
      if (this.step && this.step.type === 'ram') this.showMarker(tc.pos.x, tc.pos.z);
    }
    // --- story steps ---
    if (this.mode === 'story' && !this.done) {
      const s = this.step;
      const p = ctx.player.inCar ? ctx.player.inCar.pos : ctx.player.pos;
      if (s.type === 'steal' && ctx.player.inCar) this.advanceStep(ctx);
      else if (s.type === 'loseheat' && ctx.police.wanted === 0) this.advanceStep(ctx);
      else if (s.type === 'timed') {
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = 0; this.advanceStep(ctx); }
      } else if (s.type === 'pickup' && dist2(p.x, p.z, s.x, s.z) < s.r * s.r) {
        ctx.prompt = 'Press E to grab it';
        if (ctx.pressedE) {
          this.carrying = true;
          ctx.setWanted(2);
          ctx.toast('Secured — lose the cops and deliver it');
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
        s.taken = true; s.mesh.visible = false; this.stashesTaken++;
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
    this.missionIndex = Math.min(d.missionIndex || 0, JOBS.length - 1);
    this.done = (d.missionsDone || []).length >= JOBS.length;
    this.jobsDoneCount = Math.min(d.missionsDone ? d.missionsDone.length : 0, JOBS.length);
    (d.stashes || []).forEach(i => {
      if (this.stashes[i]) { this.stashes[i].taken = true; this.stashes[i].mesh.visible = false; this.stashesTaken++; }
    });
    this.trial.best = d.bestTrial ?? null;
  }
  saveData() {
    return {
      missionsDone: JOBS.slice(0, this.done ? JOBS.length : this.missionIndex).map(m => m.name),
      missionIndex: this.missionIndex,
      stashesCollected: this.stashes.map((s, i) => s.taken ? i : -1).filter(i => i >= 0),
      bestTrial: this.trial.best,
    };
  }
}
