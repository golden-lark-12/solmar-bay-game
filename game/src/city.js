// city.js — builds Puerto Alba: roads, buildings, beach, bay, causeway, island,
// garage, Casino Luna, ferris wheel, palms, umbrellas. Golden-hour lighting.
// Returns colliders, district zones and landmark positions for the rest of the game.

import { rand, randi, pick, mulberry32 } from './utils.js';

// Fixed seed so the city layout is identical on every load (screenshots
// and staging stay reproducible).
const rng = mulberry32(1337);
function sr(a, b) { return a + rng() * (b - a); }
function sri(a, b) { return Math.floor(sr(a, b + 1)); }
function spick(arr) { return arr[Math.floor(rng() * arr.length)]; }

export const WORLD = {
  minX: -300, maxX: 300, minZ: -300, maxZ: 560,
  beachZ: 235, waterZ: 300,
  island: { x: 0, z: 520, r: 95 },
  garage: { x: -150, z: 110 },
  casino: { x: 190, z: 250 },
  ferris: { x: 70, z: 262 },
  roads: [-240, -160, -80, 0, 80, 160, 240]
};

const BUILDING_COLORS = [0xf2d8a7, 0xe8b48a, 0xd98c6a, 0xc96f4a, 0xf7e8c8, 0xe0a458, 0xcf8f6b, 0xb85c4a, 0xead9b0];
const ROOF_COLORS = [0x8a5a3b, 0x6b4a3a, 0xa85a4a, 0x7a6a8a];

export function buildCity(THREE, scene) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // ---- Golden-hour sky, sun, lights ----
  scene.background = new THREE.Color(0xff9e5e);
  scene.fog = new THREE.Fog(0xffb37a, 260, 900);
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x8a5a4a, 1.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc98a, 2.4);
  sun.position.set(-260, 110, 180);
  sun.castShadow = false;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffb070, 0.85);
  scene.add(amb);
  // Visible sun disc low over the bay (west).
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(26, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
  );
  sunBall.position.set(-420, 95, 420);
  scene.add(sunBall);
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(44, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.35, fog: false })
  );
  sunGlow.position.copy(sunBall.position);
  scene.add(sunGlow);

  const mat = (color, opts) => new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));

  // ---- Ground: mainland grass/concrete, beach sand, bay water ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), mat(0x9a8a6a));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0);
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(620, 70), mat(0xf0d9a0));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, 267);
  group.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 260), mat(0x2a7a9a));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, 430);
  group.add(water);
  // Island ground.
  const islandGround = new THREE.Mesh(new THREE.CylinderGeometry(100, 105, 3, 28), mat(0xa89a72));
  islandGround.position.set(0, 1, 520);
  group.add(islandGround);
  const islandSand = new THREE.Mesh(new THREE.CylinderGeometry(102, 102, 0.6, 28), mat(0xf0d9a0));
  islandSand.position.set(0, 2.4, 520);
  group.add(islandSand);

  // ---- Causeway bridge across the bay ----
  const causeway = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 180), mat(0x8a7a66));
  causeway.position.set(0, 1, 385);
  group.add(causeway);
  for (let z = 310; z <= 460; z += 18) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 6), mat(0x3a3a3a));
    lamp.position.set(-13, 5, z); group.add(lamp);
    const lamp2 = lamp.clone(); lamp2.position.x = 13; group.add(lamp2);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    bulb.position.set(-13, 9.6, z); group.add(bulb);
    const bulb2 = bulb.clone(); bulb2.position.x = 13; group.add(bulb2);
  }

  // ---- Roads (grid) + causeway road + island ring ----
  const roadMat = mat(0x3c3a3e);
  const lineMat = mat(0xffd76a);
  function road(x, z, w, l) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.1, z);
    group.add(r);
    return r;
  }
  function dashes(x, z, w, l, vertical) {
    const n = Math.floor((vertical ? l : w) / 14);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.7 : 5, vertical ? 5 : 0.7), lineMat);
      d.rotation.x = -Math.PI / 2;
      const t = -((vertical ? l : w) / 2) + 7 + i * 14;
      d.position.set(x + (vertical ? 0 : t), 0.15, z + (vertical ? t : 0));
      group.add(d);
    }
  }
  for (const c of WORLD.roads) {
    road(c, 0, 12, 600); dashes(c, 0, 12, 600, true);
    road(0, c, 600, 12); dashes(0, c, 600, 12, false);
  }
  road(0, 385, 24, 180); // causeway road
  // Beachfront roads along The Strand (the chase lane).
  road(0, 200, 600, 12); dashes(0, 200, 600, 12, false);
  road(0, 220, 600, 12); dashes(0, 220, 600, 12, false);
  // Island ring road.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(62, 2.5, 6, 40), mat(0x55555e));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 2.8, 520);
  group.add(ring);

  // ---- Buildings: blocks between roads, warm colors, lit windows ----
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const darkWindowMat = new THREE.MeshBasicMaterial({ color: 0x3a2a3a });
  function building(x, z, w, d, h) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(spick(BUILDING_COLORS)));
    b.position.set(x, h / 2, z);
    group.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1), mat(spick(ROOF_COLORS)));
    roof.position.set(x, h + 0.5, z);
    group.add(roof);
    // Lit windows on the two long faces.
    const rows = Math.max(1, Math.floor(h / 9));
    const cols = Math.max(1, Math.floor(w / 7));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.45) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3),
          rng() < 0.6 ? windowMat : darkWindowMat);
        win.position.set(x - w / 2 + 4 + c * 7, 5 + r * 9, z + d / 2 + 0.06);
        group.add(win);
      }
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return b;
  }
  // Deterministic-ish layout: blocks of 40-60 wide between roads.
  const blocks = [];
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 7; gz++) {
      const cx = -200 + gx * 80;
      const cz = -260 + gz * 80;
      if (cz > 200) continue; // beachfront handled separately
      blocks.push([cx, cz]);
    }
  }
  for (const [cx, cz] of blocks) {
    if (Math.abs(cx - WORLD.garage.x) < 45 && Math.abs(cz - WORLD.garage.z) < 45) continue;
    const n = sri(1, 2);
    for (let i = 0; i < n; i++) {
      const w = sr(22, 42), d = sr(22, 42), h = sr(14, 62);
      const ox = sr(-14, 14), oz = sr(-14, 14);
      if (Math.abs(cx + ox) < 12 || Math.abs(cz + oz) < 12) continue;
      building(cx + ox, cz + oz, w, d, h);
    }
  }
  // Beachfront towers along The Strand (taller, brighter).
  for (let x = -260; x <= 260; x += 52) {
    if (Math.abs(x - WORLD.casino.x) < 45) continue;
    if (Math.abs(x - WORLD.ferris.x) < 40) continue;
    building(x + sr(-6, 6), 182, sr(26, 36), 22, sr(38, 78));
  }
  // Island club + houses.
  building(-40, 500, 34, 26, 26);
  building(45, 545, 28, 24, 20);
  building(0, 470, 40, 24, 30); // island clubhouse

  // ---- Alba Garage (real place, M1 delivers here) ----
  const gar = new THREE.Group();
  gar.position.set(WORLD.garage.x, 0, WORLD.garage.z);
  const garBody = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 30), mat(0x2a6a8a));
  garBody.position.y = 7; gar.add(garBody);
  const garRoof = new THREE.Mesh(new THREE.BoxGeometry(48, 1.5, 32), mat(0x1a3a4a));
  garRoof.position.y = 14.5; gar.add(garRoof);
  const garDoor = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), mat(0xd8d8d8));
  garDoor.position.set(0, 5, 15.2); gar.add(garDoor);
  const garSign = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 1.5),
    new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  garSign.position.set(0, 17, 12); gar.add(garSign);
  group.add(gar);
  colliders.push({ minX: WORLD.garage.x - 23, maxX: WORLD.garage.x + 23, minZ: WORLD.garage.z - 15, maxZ: WORLD.garage.z + 15 });

  // ---- Casino Luna: neon tower on the beachfront (landmark) ----
  const cas = new THREE.Group();
  cas.position.set(WORLD.casino.x, 0, WORLD.casino.z);
  const casBody = new THREE.Mesh(new THREE.BoxGeometry(40, 46, 30), mat(0x7a2a6a));
  casBody.position.y = 23; cas.add(casBody);
  const casTop = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4ad8 }));
  casTop.position.y = 52; cas.add(casTop);
  for (const [dx, dz, c] of [[-21, 0, 0xff4ad8], [21, 0, 0x4ad8ff], [0, 16, 0xffd76a]]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(dx === 0 ? 34 : 1.5, 3, dz === 0 ? 1.5 : 26),
      new THREE.MeshBasicMaterial({ color: c }));
    strip.position.set(dx, 40, dz); cas.add(strip);
  }
  group.add(cas);
  colliders.push({ minX: WORLD.casino.x - 20, maxX: WORLD.casino.x + 20, minZ: WORLD.casino.z - 15, maxZ: WORLD.casino.z + 15 });

  // ---- Ferris wheel on the beach (landmark, slowly turns) ----
  const fer = new THREE.Group();
  fer.position.set(WORLD.ferris.x, 0, WORLD.ferris.z);
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(2, 46, 2), mat(0xeeeeee));
  leg1.position.set(-12, 23, 0); leg1.rotation.z = 0.35; fer.add(leg1);
  const leg2 = leg1.clone(); leg2.position.x = 12; leg2.rotation.z = -0.35; fer.add(leg2);
  const wheel = new THREE.Group();
  wheel.position.set(0, 48, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(26, 1.4, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(1, 52, 1), mat(0xdddddd));
    spoke.rotation.z = a; wheel.add(spoke);
    const gond = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4),
      mat(spick([0xff4a6a, 0x4ad8ff, 0xffd76a, 0x6aff8a])));
    gond.position.set(Math.cos(a) * 26, Math.sin(a) * 26, 0);
    wheel.add(gond);
  }
  fer.add(wheel);
  group.add(fer);
  colliders.push({ minX: WORLD.ferris.x - 16, maxX: WORLD.ferris.x + 16, minZ: WORLD.ferris.z - 4, maxZ: WORLD.ferris.z + 4 });

  // ---- Palms + beach umbrellas + sun loungers ----
  function palm(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 11, 6), mat(0x8a6a4a));
    trunk.position.y = 5.5; trunk.rotation.z = sr(-0.12, 0.12); g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 4), mat(0x3a8a3a));
      leaf.position.set(Math.cos(a) * 2.6, 11.4, Math.sin(a) * 2.6);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      g.add(leaf);
    }
    group.add(g);
  }
  for (let i = 0; i < 26; i++) palm(sr(-280, 280), sr(240, 292));
  for (let i = 0; i < 8; i++) palm(sr(-280, 280), sr(-280, 200));
  function umbrella(x, z, color) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 5, 6), mat(0xdddddd));
    pole.position.set(x, 2.5, z); group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2, 8), mat(color));
    top.position.set(x, 5.6, z); group.add(top);
    const lounger = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 5), mat(0xffffff));
    lounger.position.set(x + 3.5, 0.5, z); group.add(lounger);
  }
  const umbColors = [0xff4a6a, 0x4ad8ff, 0xffd76a, 0x6aff8a, 0xff8a4a];
  for (let i = 0; i < 14; i++) {
    umbrella(sr(-270, 270), sr(244, 292), spick(umbColors));
  }

  // ---- Mission marker beam (shared, repositioned by missions) ----
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.set(0, 30, 0);
  beam.visible = false;
  scene.add(beam);

  return {
    group, colliders, beam, ferrisWheel: wheel, sunBall,
    isWater(x, z) {
      if (z > WORLD.waterZ && !(Math.abs(x) < 16 && z < 470)) return true;
      if (z > 300 && Math.abs(x) > 16) return true;
      const d = Math.hypot(x - WORLD.island.x, z - WORLD.island.z);
      if (z > 300 && d > 100 && !(Math.abs(x) < 16 && z < 470)) return true;
      return false;
    },
    clampToWorld(x, z) {
      return [Math.max(WORLD.minX, Math.min(WORLD.maxX, x)), Math.max(WORLD.minZ, Math.min(WORLD.maxZ, z))];
    }
  };
}

// Circle (radius r) vs AABB colliders: push the circle out. Returns corrected [x, z].
export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 0.0001) {
        // Inside the box: push out along the smallest penetration axis.
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
      } else {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      }
    }
  }
  return [x, z];
}
