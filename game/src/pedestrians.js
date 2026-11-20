// pedestrians.js — walkers on the sidewalks who stroll between intersections,
// scatter when a gunshot goes off or a police chase passes, and occasionally
// drop a little cash when punched. Low-poly figures, shared geometries.
import { pick, range, rangeInt } from './utils.js';

const SHIRTS = [0xe8e8e8, 0x4a8ac0, 0xe0a040, 0x7ab06a, 0xc06a8a, 0x8a6ac0];

export class Pedestrians {
  constructor(scene, city, rng) {
    this.city = city;
    this.list = [];
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.75, 0.3);
    const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const legGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
    const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x30384a });
    const shirts = SHIRTS.map(c => new THREE.MeshLambertMaterial({ color: c }));
    for (let i = 0; i < 20; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, pick(rng, shirts));
      body.position.y = 1.15; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(headGeo, skin);
      head.position.y = 1.72; g.add(head);
      const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.15, 0.4, 0); g.add(legL);
      const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
      const node = city.nodes[Math.floor(rng() * city.nodes.length)];
      const p = {
        group: g, legL, legR,
        x: node.x + range(rng, -4, 4), z: node.z + range(rng, -4, 4),
        heading: rng() * Math.PI * 2,
        speed: range(rng, 1.0, 1.8),
        target: null, flee: 0, down: false, downTimer: 0,
        phase: rng() * 6.28,
      };
      p.target = this.pickTarget(p);
      scene.add(g);
      this.list.push(p);
    }
  }

  pickTarget(p) {
    const near = this.city.nodes.filter(n => Math.hypot(n.x - p.x, n.z - p.z) < 130);
    const n = pick(Math.random, near.length ? near : this.city.nodes);
    return { x: n.x + range(Math.random, -5, 5), z: n.z + range(Math.random, -5, 5) };
  }

  // Everyone within radius runs away from (x, z) for a few seconds.
  scare(x, z, radius = 30) {
    for (const p of this.list) {
      if (p.down) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) { p.flee = 3 + Math.random() * 2; p.fleeFrom = { x, z }; }
    }
  }

  knockDown(p) { p.down = true; p.downTimer = 4; p.flee = 0; }

  update(dt, t) {
    for (const p of this.list) {
      if (p.down) {
        p.downTimer -= dt;
        p.group.rotation.x = p.downTimer > 0 ? -Math.PI / 2 + 0.15 : 0;
        if (p.downTimer <= 0) { p.down = false; p.group.rotation.x = 0; p.flee = 3; p.fleeFrom = { x: p.x, z: p.z }; }
        continue;
      }
      let tx, tz, speed = p.speed;
      if (p.flee > 0) {
        p.flee -= dt;
        const dx = p.x - p.fleeFrom.x, dz = p.z - p.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / d) * 10; tz = p.z + (dz / d) * 10;
        speed = 4.5;
      } else {
        tx = p.target.x; tz = p.target.z;
        if (Math.hypot(tx - p.x, tz - p.z) < 3) p.target = this.pickTarget(p);
      }
      const want = Math.atan2(tx - p.x, tz - p.z);
      let diff = want - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += diff * Math.min(1, 6 * dt);
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      p.x = Math.max(-260, Math.min(250, p.x));
      p.z = Math.max(-250, Math.min(250, p.z));
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.heading;
      const swing = Math.sin(t * 7 + p.phase) * 0.5 * (speed / 1.5);
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    }
  }
}
