// pedestrians.js — named walkers on the sidewalks and beach who flee from
// speeding cars and police. Names are original. Puerto Alba.

import { rand, pick, dist2d } from './utils.js';

let _contactShadowTex = null;
function contactShadowTexture(THREE) {
  if (_contactShadowTex) return _contactShadowTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _contactShadowTex = new THREE.CanvasTexture(c);
  return _contactShadowTex;
}

const FIRST = ['Mara', 'Tomas', 'Iris', 'Dario', 'Lena', 'Gus', 'Sable', 'Rex', 'Nia', 'Omar', 'Cleo', 'Vic', 'Ana', 'Leo', 'Mina', 'Rosa', 'Hugo', 'Tara'];
const LAST = ['Vega', 'Rook', 'Vale', 'Maro', 'Kade', 'Ferran', 'Quinn', 'Calder', 'Sol', 'Reyes', 'Luna', 'Costa', 'Marin', 'Diaz', 'Faro', 'Nunez'];
const SHIRT = [0xff4a6a, 0x4ad8ff, 0xffd76a, 0x6aff8a, 0xff8a4a, 0x8a4aff, 0xf0f0f0, 0x2ad8c8];

export class Pedestrians {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.walkers = []; // {group, name, x, z, heading, speed, fleeing, phase, legL, legR}
  }

  spawn(count) {
    this.clear();
    for (let i = 0; i < count; i++) {
      const name = pick(FIRST) + ' ' + pick(LAST);
      const onBeach = Math.random() < 0.35;
      const x = onBeach ? rand(-270, 270) : rand(-260, 260);
      const z = onBeach ? rand(242, 292) : rand(-260, 210);
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: pick(SHIRT) });
      const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
      const skin = new THREE.MeshLambertMaterial({ color: pick([0xe8b48a, 0xc98a5a, 0xf0c8a0, 0x8a5a3a]) });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
      torso.position.y = 1.1; g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
      head.position.y = 1.68; g.add(head);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), pants);
      legL.position.set(-0.14, 0.35, 0); g.add(legL);
      const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshBasicMaterial({ map: contactShadowTexture(THREE), transparent: true, opacity: 0.55, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.045;
      shadow.name = 'contact-shadow';
      g.add(shadow);
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.walkers.push({
        group: g, name, x, z,
        heading: rand(0, Math.PI * 2), speed: rand(1.2, 2.4),
        fleeing: false, phase: rand(0, 6), legL, legR, onBeach
      });
    }
  }

  clear() {
    for (const w of this.walkers) this.scene.remove(w.group);
    this.walkers = [];
  }

  update(dt, threats) {
    // threats: [{x, z, radius}] — cars/police that make walkers flee.
    for (const w of this.walkers) {
      let fleeX = 0, fleeZ = 0, fleeing = false;
      for (const t of threats || []) {
        const d = dist2d(w.x, w.z, t.x, t.z);
        if (d < (t.radius || 14)) {
          fleeing = true;
          fleeX += (w.x - t.x) / (d || 1);
          fleeZ += (w.z - t.z) / (d || 1);
        }
      }
      w.fleeing = fleeing;
      if (fleeing) {
        const len = Math.hypot(fleeX, fleeZ) || 1;
        w.x += (fleeX / len) * 6.5 * dt;
        w.z += (fleeZ / len) * 6.5 * dt;
        w.heading = Math.atan2(fleeX / len, fleeZ / len);
      } else {
        // Wander: mostly along sidewalks / beach, occasional turn.
        if (Math.random() < dt * 0.25) w.heading += rand(-1.2, 1.2);
        w.x += Math.sin(w.heading) * w.speed * dt;
        w.z += Math.cos(w.heading) * w.speed * dt;
        if (w.x < -285 || w.x > 285) w.heading = Math.PI - w.heading;
        if (w.z < -285 || w.z > 295) w.heading = -w.heading;
      }
      w.phase += dt * (fleeing ? 11 : 5);
      const swing = Math.sin(w.phase) * 0.5;
      w.legL.rotation.x = swing; w.legR.rotation.x = -swing;
      w.group.position.set(w.x, 0, w.z);
      w.group.rotation.y = w.heading;
    }
  }

  fleeingNames() {
    return this.walkers.filter(w => w.fleeing).map(w => w.name);
  }
  count() { return this.walkers.length; }
}
