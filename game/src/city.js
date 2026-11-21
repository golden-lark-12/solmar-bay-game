// city.js — Puerto Alba: golden-hour coastal city. Gradient sky, lit windows,
// readable signs, light roads with crosswalks, beach, water with boats.
import { rand, randi, pick } from './utils.js';

export const WORLD = {
  minX: -300, maxX: 300, minZ: -300, maxZ: 560,
  beachZ: 235, waterZ: 300,
  island: { x: 0, z: 520, r: 95 },
  garage: { x: -150, z: 110 },
  casino: { x: 190, z: 250 },
  ferris: { x: 70, z: 262 },
  roads: [-240, -160, -80, 0, 80, 160, 240],
};

const BUILDING_COLORS = [
  0xf2d8a7, 0xe8b48a, 0xd98c6a, 0xc96f4a, 0xf7e8c8,
  0xe0a458, 0xcf8f6b, 0xb85c4a, 0xead9b0,
];
const ROOF_COLORS = [0x8a5a3b, 0x6b4a3a, 0xa85a4a, 0x7a6a8a];
const ROAD_Z = [-240, -160, -80, 0, 80, 160, 200];

function skyTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#5a2a6e');   // deep purple-pink at the top
  g.addColorStop(0.35, '#a83a6e');  // magenta-pink
  g.addColorStop(0.62, '#e85a3a');  // warm orange
  g.addColorStop(0.82, '#ff8a3a');  // golden horizon
  g.addColorStop(1.0, '#ffb35a');   // bright horizon glow
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function glowTexture(THREE, inner, outer) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, outer);
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function signTexture(THREE, text, opts) {
  opts = opts || {};
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || 'rgba(20,12,20,0.92)';
  ctx.fillRect(0, 0, 512, 160);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 148);
  }
  ctx.font = 'bold 68px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.neon) {
    ctx.shadowColor = opts.fg;
    ctx.shadowBlur = 26;
    ctx.fillStyle = opts.fg;
    ctx.fillText(text, 256, 84);
    ctx.shadowBlur = 8;
    ctx.fillText(text, 256, 84);
  } else {
    ctx.fillStyle = opts.fg || '#ffd76a';
    ctx.fillText(text, 256, 84);
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function collideCircle(colliders, x, z, r) {
  let hit = false;
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + r;
    if (d < min && d > 0.001) {
      const push = (min - d) / d;
      x += dx * push;
      z += dz * push;
      hit = true;
    }
  }
  return hit ? { x, z } : null;
}

export function buildCity(THREE, scene) {
  const group = new THREE.Group();
  const colliders = [];
  scene.add(group);

  // Golden-hour sky: gradient, not a flat color.
  scene.background = skyTexture(THREE);
  scene.fog = new THREE.Fog(0xff9a5a, 150, 950);

  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // --- Ground ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshStandardMaterial({ color: 0xb89a6a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  add(ground, 0, -0.08, 130);

  // Beach sand.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 70),
    new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1 })
  );
  beach.rotation.x = -Math.PI / 2;
  add(beach, 0, -0.02, 265);

  // Water with a bit of shine.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 270),
    new THREE.MeshStandardMaterial({ color: 0x1f7a8a, roughness: 0.22, metalness: 0.35 })
  );
  water.rotation.x = -Math.PI / 2;
  add(water, 0, 0.0, 425);
  // Sun-glint streaks on the water.
  for (let i = 0; i < 8; i++) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(26 + rand(0, 30), 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10 + rand(0, 0.08), depthWrite: false })
    );
    streak.rotation.x = -Math.PI / 2;
    streak.rotation.z = rand(-0.3, 0.3);
    add(streak, rand(-260, 260), 0.06, rand(315, 540));
  }

  // --- Roads (lighter warm grey-brown, with edge lines) ---
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x6b5a4e, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  function roadStrip(x, z, w, l, horizontal) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontal ? l : w, horizontal ? w : l),
      roadMat
    );
    m.rotation.x = -Math.PI / 2;
    add(m, x, 0.02, z);
    // Edge lines.
    if (horizontal) {
      for (const dz of [-w / 2 + 0.4, w / 2 - 0.4]) {
        const e = new THREE.Mesh(new THREE.PlaneGeometry(l, 0.35), edgeMat);
        e.rotation.x = -Math.PI / 2;
        add(e, x, 0.035, z + dz);
      }
    } else {
      for (const dx of [-w / 2 + 0.4, w / 2 - 0.4]) {
        const e = new THREE.Mesh(new THREE.PlaneGeometry(0.35, l), edgeMat);
        e.rotation.x = -Math.PI / 2;
        add(e, x + dx, 0.035, z);
      }
    }
    // Center dashes (every 32m — keeps the draw-call count sane).
    const n = Math.floor(l / 32);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(
        new THREE.PlaneGeometry(horizontal ? 4 : 0.5, horizontal ? 0.5 : 4),
        dashMat
      );
      d.rotation.x = -Math.PI / 2;
      const t = -l / 2 + 16 + i * 32;
      add(d, horizontal ? x + t : x, 0.04, horizontal ? z : z + t);
    }
  }
  for (const x of WORLD.roads) roadStrip(x, 130, 14, 860, false);
  for (const z of ROAD_Z) roadStrip(0, z, 14, 600, true);

  // Sidewalks along the Strand beachfront road (z=200).
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 1 });
  for (const z of [191.5, 208.5]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(240, 5), walkMat);
    w.rotation.x = -Math.PI / 2;
    add(w, 20, 0.03, z);
  }
  // Curbs.
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 1 });
  for (const z of [188.8, 211.2]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(240, 0.35, 0.5), curbMat);
    add(curb, 20, 0.18, z);
  }
  // Crosswalk across the Strand road at x=20.
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 13), crossMat);
    s.rotation.x = -Math.PI / 2;
    add(s, 14 + i * 1.9, 0.045, 200);
  }
  // Green median on the x=80 road (visible in chase/combat frames).
  const medianMat = new THREE.MeshStandardMaterial({ color: 0x3a7a4a, roughness: 1 });
  const median = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 70), medianMat);
  add(median, 80, 0.25, 165);

  // --- Palms + bench along the Strand sidewalk (cover frame detail) ---
  function palm(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 6.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 })
    );
    add(trunk, x, 3.25, z);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a8a4a, roughness: 1 })
    );
    top.scale.y = 0.55;
    add(top, x, 6.8, z);
    colliders.push({ x, z, r: 1 });
  }
  for (const x of [-60, -20, 20, 60, 100]) palm(x, 190);
  for (const x of [-40, 0, 40, 80]) palm(x, 212);
  for (const [x, z] of [[-120, 248], [-40, 252], [30, 248], [110, 252], [180, 248]]) palm(x, z);
  // Bench on the north sidewalk.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 });
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 1), benchMat);
  add(benchSeat, 34, 0.6, 190);
  const benchBack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.14), benchMat);
  add(benchBack, 34, 1.1, 189.6);

  // --- Buildings with lit windows ---
  const litMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const litMat2 = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x2a2a3a });
  const winGeo = new THREE.PlaneGeometry(2.4, 3.2);
  function windows(bx, bz, w, d, h, faces) {
    const cols = Math.max(1, Math.floor(w / 7));
    const colsW = Math.max(1, Math.floor(d / 7));
    const rows = Math.max(1, Math.min(3, Math.floor(h / 6.5)));
    for (let r = 0; r < rows; r++) {
      const y = 4.5 + r * 6.5;
      if (y > h - 2) continue;
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() < 0.65;
        const mat = lit ? (Math.random() < 0.75 ? litMat : litMat2) : darkMat;
        if (faces.includes('S')) {
          const win = new THREE.Mesh(winGeo, mat);
          add(win, bx - w / 2 + 3.5 + c * 7, y, bz + d / 2 + 0.07);
        }
      }
      for (let c = 0; c < colsW; c++) {
        const lit = Math.random() < 0.65;
        const mat = lit ? (Math.random() < 0.75 ? litMat : litMat2) : darkMat;
        if (faces.includes('W')) {
          const win = new THREE.Mesh(winGeo, mat);
          win.rotation.y = -Math.PI / 2;
          add(win, bx - w / 2 - 0.07, y, bz - d / 2 + 3.5 + c * 7);
        }
      }
    }
  }
  function building(bx, bz, w, h, d, color, roofColor, faces) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    add(b, bx, h / 2, bz);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 1 })
    );
    add(roof, bx, h + 0.4, bz);
    colliders.push({ x: bx, z: bz, r: Math.max(w, d) * 0.62 });
    windows(bx, bz, w, d, h, faces || ['S']);
    return b;
  }

  // Explicit landmark buildings (signs live on these).
  building(-20, 165, 24, 16, 18, 0xe8b48a, 0x8a5a3b, ['S', 'W']);   // cafe row
  building(60, 160, 22, 34, 18, 0xf2d8a7, 0x6b4a3a, ['S', 'W']);    // billboard tower
  building(190, 250, 30, 22, 20, 0xb85c8a, 0x7a6a8a, ['S', 'W']);   // Casino Luna
  building(-150, 110, 26, 12, 20, 0xcf8f6b, 0x8a5a3b, ['S', 'W']);  // Alba Garage
  building(0, 520, 24, 14, 20, 0xf7e8c8, 0xa85a4a, ['S', 'W']);     // island clubhouse

  // Procedural blocks between the roads.
  const blockX = [-200, -120, -40, 40, 120, 200];
  const blockZ = [-200, -120, -40, 40, 120, 180];
  const keepOut = [
    { x: -20, z: 165, r: 32 }, { x: 60, z: 160, r: 32 },
    { x: 190, z: 250, r: 34 }, { x: -150, z: 110, r: 34 },
    { x: 70, z: 262, r: 30 },
  ];
  for (const gx of blockX) {
    for (const gz of blockZ) {
      const bx = gx + rand(-6, 6);
      const bz = gz + rand(-6, 6);
      if (keepOut.some((k) => Math.hypot(bx - k.x, bz - k.z) < k.r)) continue;
      if (bz > 225) continue;
      const w = rand(17, 28);
      const d = gz === 180 ? rand(14, 18) : rand(16, 26);
      const h = rand(12, 40);
      building(bx, bz, w, h, d, pick(BUILDING_COLORS), pick(ROOF_COLORS));
    }
  }

  // --- Readable signs ---
  function signPlane(tex, w, h, x, y, z, rotY) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    m.rotation.y = rotY;
    add(m, x, y, z);
    return m;
  }
  // Cafe sign on the south face of the cafe building (faces the Strand road).
  signPlane(signTexture(THREE, 'CAFÉ ALBA', { bg: '#2a1a2a', fg: '#ffd76a', border: '#ffd76a' }),
    13, 4, -20, 10, 165 + 9 + 0.12, 0);
  // Billboard on the west face of the tall tower (faces the chase camera).
  signPlane(signTexture(THREE, 'SOLMAR BAY', { bg: '#12283a', fg: '#7ad8ff', border: '#7ad8ff' }),
    15, 4.6, 60 - 11 - 0.12, 20, 160, -Math.PI / 2);
  // Casino Luna neon on the north face of the casino (faces the Strand road).
  signPlane(signTexture(THREE, 'CASINO LUNA', { bg: '#1a0a24', fg: '#ff7ad8', neon: true }),
    16, 5, 190, 13, 250 - 10 - 0.12, Math.PI);
  // Garage sign.
  signPlane(signTexture(THREE, 'ALBA GARAGE', { bg: '#1a2420', fg: '#7dff8a', border: '#7dff8a' }),
    13, 4, -150, 8, 110 + 10 + 0.12, 0);

  // --- Sun disc + glow (west, over the water) ---
  const sunBall = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false })
  );
  sunBall.position.set(-420, 95, 420);
  sunBall.lookAt(0, 40, 200);
  group.add(sunBall);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(THREE, 'rgba(255,250,220,0.95)', 'rgba(255,180,90,0.55)'),
    transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  sunGlow.scale.set(220, 220, 1);
  sunGlow.position.copy(sunBall.position);
  group.add(sunGlow);

  // --- Clouds: flat white/pink billboards, several east for the chase frame ---
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff2f2, transparent: true, opacity: 0.88, fog: false });
  const cloudMat2 = new THREE.MeshBasicMaterial({ color: 0xffd8e8, transparent: true, opacity: 0.85, fog: false });
  const cloudSpots = [
    [220, 150, 190], [300, 135, 240], [160, 165, 120], [-80, 140, 260],
    [40, 170, 320], [-220, 150, 180], [120, 145, 420], [-160, 160, 420], [260, 155, 380],
  ];
  for (const [cx, cy, cz] of cloudSpots) {
    const cl = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 + rand(0, 5), 10, 8), i % 2 ? cloudMat2 : cloudMat);
      puff.scale.y = 0.42;
      puff.position.set((i - 1) * 11, rand(-1, 1), rand(-3, 3));
      cl.add(puff);
    }
    cl.position.set(cx, cy, cz);
    group.add(cl);
  }

  // --- Ferris wheel on the pier ---
  const ferrisWheel = new THREE.Group();
  ferrisWheel.position.set(WORLD.ferris.x, 26, WORLD.ferris.z);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.7, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 })
  );
  ferrisWheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 31, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 })
    );
    spoke.position.set(Math.sin(a) * 0, 0, 0);
    spoke.rotation.z = a;
    spoke.position.set(0, 0, 0);
    ferrisWheel.add(spoke);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2.4, 2.4),
      new THREE.MeshStandardMaterial({ color: pick([0xff4a6a, 0x2ad8c8, 0xffd76a, 0x7ad8ff]), roughness: 0.6 })
    );
    cab.position.set(Math.sin(a) * 16, Math.cos(a) * 16, 0);
    ferrisWheel.add(cab);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 1.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, roughness: 0.5 })
  );
  hub.rotation.x = Math.PI / 2;
  ferrisWheel.add(hub);
  group.add(ferrisWheel);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 28, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 })
    );
    leg.position.set(WORLD.ferris.x + s * 7, 13, WORLD.ferris.z);
    leg.rotation.z = s * 0.28;
    group.add(leg);
  }
  colliders.push({ x: WORLD.ferris.x, z: WORLD.ferris.z, r: 10 });

  // --- Lighthouse on the island edge + rotating beam ---
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 22, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 })
  );
  add(light, 55, 11, 490);
  const lightTop = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 2, 10),
    new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0x880000, emissiveIntensity: 0.7 })
  );
  add(lightTop, 55, 23, 490);
  colliders.push({ x: 55, z: 490, r: 4 });
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(7, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  beam.position.set(55, 22, 490);
  beam.rotation.z = Math.PI / 2;
  group.add(beam);

  // --- Island sand + club parasols ---
  const islandSand = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD.island.r, 28),
    new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1 })
  );
  islandSand.rotation.x = -Math.PI / 2;
  add(islandSand, 0, 0.02, 520);
  for (const [ux, uz, col] of [[-30, 500, 0xff4a6a], [25, 545, 0x2ad8c8], [45, 500, 0xffd76a]]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a6a4a })
    );
    add(pole, ux, 1.5, uz);
    const umb = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 })
    );
    add(umb, ux, 3.4, uz);
  }

  // --- Boats on the water (big sails + wakes so they read from the vista) ---
  function boat(bx, bz, heading, sailColor) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(11, 1.6, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.7 })
    );
    hull.position.y = 0.4;
    b.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 13, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3a2a })
    );
    mast.position.y = 6.9;
    b.add(mast);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 12),
      new THREE.MeshStandardMaterial({ color: sailColor, side: THREE.DoubleSide, roughness: 0.8 })
    );
    sail.position.set(0, 6.6, 1.2);
    b.add(sail);
    // White wake streak behind the hull.
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(0, 0.25, -8);
    b.add(wake);
    b.position.set(bx, 0.1, bz);
    b.rotation.y = heading;
    group.add(b);
    return b;
  }
  // Sails face the vista camera (broadside) so they read from above.
  boat(10, 315, 2.7, 0xffffff);
  boat(-70, 430, 2.4, 0xffd76a);

  function isWater(x, z) {
    if (z <= WORLD.waterZ) return false;
    return Math.hypot(x - WORLD.island.x, z - WORLD.island.z) > WORLD.island.r + 5;
  }
  function clampToWorld(x, z) {
    return {
      x: Math.max(WORLD.minX, Math.min(WORLD.maxX, x)),
      z: Math.max(WORLD.minZ, Math.min(WORLD.maxZ, z)),
    };
  }

  return { group, colliders, beam, ferrisWheel, sunBall, sunGlow, isWater, clampToWorld };
}
