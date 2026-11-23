// city.js — Puerto Alba: golden-hour coastal city.
// Sky gradient, sun + glow, beach + water + island, road grid with sidewalks,
// palms and benches, buildings with lit windows and readable signs,
// ferris wheel, Casino Luna, Alba Garage, boats on the water.

import { rand, randi, pick } from './utils.js';

export const WORLD = {
  minX: -300, maxX: 300, minZ: -300, maxZ: 560,
  beachZ: 235, waterZ: 300,
  island: { x: 0, z: 520, r: 95 },
  garage: { x: -150, z: 110 },
  casino: { x: 190, z: 250 },
  ferris: { x: 70, z: 262 },
  roads: [-240, -160, -80, 0, 80, 160, 240]
};

const ROAD_Z = [-240, -160, -80, 0, 80, 160, 200];

export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = c.r + r;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  return false;
}

function skyTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#5a2a6e');
  g.addColorStop(0.35, '#a83a6e');
  g.addColorStop(0.62, '#e85a3a');
  g.addColorStop(0.82, '#ff8a3a');
  g.addColorStop(1.0, '#ffb35a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  return new THREE.CanvasTexture(c);
}

function signTexture(text, bg, fg, border) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = fg;
  ctx.font = 'bold 58px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  return new THREE.CanvasTexture(c);
}

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,190,1)');
  g.addColorStop(0.4, 'rgba(255,200,120,0.7)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildCity(THREE, scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];

  // Sky: warm gradient, purple-pink top to golden horizon. Fog warm orange.
  scene.background = skyTexture(THREE);
  scene.fog = new THREE.Fog(0xff8a3a, 150, 1000);

  function std(color, roughness, metalness) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: roughness !== undefined ? roughness : 0.85,
      metalness: metalness !== undefined ? metalness : 0.05
    });
  }
  function addBox(w, h, d, color, x, y, z, opts) {
    const o = opts || {};
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.material || std(color, o.roughness, o.metalness));
    m.position.set(x, y, z);
    if (o.ry) m.rotation.y = o.ry;
    group.add(m);
    return m;
  }
  function addCollider(x, z, r) {
    colliders.push({ x: x, z: z, r: r });
  }

  // --- Ground, beach, water -------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 900), std(0x9a8a68, 0.95, 0));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 130);
  group.add(ground);

  const beach = new THREE.Mesh(new THREE.PlaneGeometry(640, 72), std(0xe8d8a8, 0.95, 0));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, 270);
  group.add(beach);

  const waterTexCanvas = document.createElement('canvas');
  waterTexCanvas.width = 256;
  waterTexCanvas.height = 256;
  const waterTexCtx = waterTexCanvas.getContext('2d');
  const waveImg = waterTexCtx.createImageData(256, 256);
  for (let wy = 0; wy < 256; wy++) {
    for (let wx = 0; wx < 256; wx++) {
      const wi = (wy * 256 + wx) * 4;
      waveImg.data[wi] = 128 + 90 * Math.sin(wx * 0.11 + Math.sin(wy * 0.07) * 2.2) * Math.cos(wy * 0.05);
      waveImg.data[wi + 1] = 128 + 90 * Math.sin(wy * 0.13 + Math.sin(wx * 0.06) * 2.0) * Math.cos(wx * 0.04);
      waveImg.data[wi + 2] = 255;
      waveImg.data[wi + 3] = 255;
    }
  }
  waterTexCtx.putImageData(waveImg, 0, 0);
  const waveTex = new THREE.CanvasTexture(waterTexCanvas);
  waveTex.wrapS = THREE.RepeatWrapping;
  waveTex.wrapT = THREE.RepeatWrapping;
  waveTex.repeat.set(24, 10);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 280),
    new THREE.MeshStandardMaterial({ color: 0x12333f, roughness: 0.14, metalness: 0.85, normalMap: waveTex, normalScale: new THREE.Vector2(0.9, 0.9) })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.04, 440);
  group.add(water);
  const glintCanvas = document.createElement('canvas');
  glintCanvas.width = 128;
  glintCanvas.height = 512;
  const glintCtx = glintCanvas.getContext('2d');
  const glintGrad = glintCtx.createRadialGradient(64, 256, 0, 64, 256, 256);
  glintGrad.addColorStop(0, 'rgba(255,215,106,0.9)');
  glintGrad.addColorStop(0.5, 'rgba(255,180,80,0.4)');
  glintGrad.addColorStop(1, 'rgba(255,150,50,0)');
  glintCtx.fillStyle = glintGrad;
  glintCtx.fillRect(0, 0, 128, 512);
  const glintTex = new THREE.CanvasTexture(glintCanvas);
  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 26),
    new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glint.rotation.set(-Math.PI / 2, 0, -0.033);
  glint.position.set(-120, 0.06, 430);
  group.add(glint);
  // Two more sunlit bands so the glitter reads across the whole bay.
  for (const [gx, gz, go] of [[40, 425, 0.42], [190, 438, 0.36]]) {
    const extra = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 20),
      new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: go, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    extra.rotation.set(-Math.PI / 2, 0, -0.033);
    extra.position.set(gx, 0.06, gz);
    group.add(extra);
  }

  // --- Roads: lighter grey, dashes, edge lines, crosswalks ------------------
  const roadMat = std(0x6f6f78, 0.9, 0);
  const dashMat = std(0xffd76a, 0.8, 0);
  const edgeMat = std(0xf2f2f2, 0.8, 0);
  function roadStrip(x, z, w, d) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.03, z);
    group.add(r);
  }
  function dashes(x0, x1, z, horizontal) {
    for (let x = x0; x <= x1; x += 9) {
      if (horizontal) addBox(2.6, 0.04, 0.35, 0, x, 0.05, z, { material: dashMat });
      else addBox(0.35, 0.04, 2.6, 0, x, 0.05, z, { material: dashMat });
    }
  }
  for (const rz of ROAD_Z) {
    roadStrip(0, rz, 620, 14);
    dashes(-300, 300, rz, true);
    addBox(620, 0.04, 0.3, 0, 0, 0.05, rz - 6.4, { material: edgeMat });
    addBox(620, 0.04, 0.3, 0, 0, 0.05, rz + 6.4, { material: edgeMat });
    // Sidewalks flanking the road, with palms + benches.
    addBox(620, 0.14, 4, 0xc8b898, 0, 0.07, rz - 9.2);
    addBox(620, 0.14, 4, 0xc8b898, 0, 0.07, rz + 9.2);
  }
  function dashesNS(rx) {
    for (let z = -290; z <= 550; z += 9) {
      addBox(0.35, 0.04, 2.6, 0, rx, 0.05, z, { material: dashMat });
    }
  }
  for (const rx of WORLD.roads) {
    roadStrip(rx, 130, 14, 860);
    dashesNS(rx);
  }
  // Crosswalk across the Strand road at x = 0, z = 200.
  for (let i = -4; i <= 4; i++) {
    addBox(1.6, 0.04, 12, 0, i * 4, 0.06, 200, { material: edgeMat });
  }
  // Green median on the z = 0 road.
  addBox(620, 0.18, 2.2, 0x3a7a4a, 0, 0.09, 0);

  // Palms + benches along the Strand sidewalks.
  const trunkMat = std(0x8a6a3a, 0.9, 0);
  const palmMat = std(0x3a8a4a, 0.8, 0);
  const frondGeo = new THREE.PlaneGeometry(0.55, 3.4, 1, 3);
  frondGeo.translate(0, 1.7, 0);
  {
    const pos = frondGeo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const vy = pos.getY(vi);
      const t = vy / 3.4;
      pos.setZ(vi, pos.getZ(vi) + 1.2 * t * t);
    }
    frondGeo.computeVertexNormals();
  }
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x1d3d2a, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 5, 8), trunkMat);
    trunk.position.set(x, 2.5, z);
    trunk.rotation.z = 0.12;
    group.add(trunk);
    for (let i = 0; i < 7; i++) {
      const holder = new THREE.Group();
      holder.position.set(x - 0.3, 5.0, z);
      holder.rotation.y = (i * Math.PI * 2) / 7;
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.rotation.x = 1.30 + (i % 3) * 0.18;
      holder.add(frond);
      group.add(holder);
    }
  }
  function bench(x, z) {
    addBox(2.2, 0.18, 0.8, 0x8a6a3a, x, 0.5, z);
    addBox(0.18, 0.5, 0.8, 0x6a4a2a, x - 0.9, 0.25, z);
    addBox(0.18, 0.5, 0.8, 0x6a4a2a, x + 0.9, 0.25, z);
  }
  for (let x = -280; x <= 280; x += 56) {
    palm(x, 190.8);
    palm(x + 28, 209.2);
    if ((x / 56) % 2 === 0) bench(x + 14, 191.5);
  }
  for (let x = -260; x <= 260; x += 80) palm(x, -9.2);

  // --- Buildings: lit windows + readable signs ------------------------------
  const litMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  const litMat2 = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const darkWinMat = new THREE.MeshBasicMaterial({ color: 0x2a3444 });
  const winGeo = new THREE.PlaneGeometry(1.1, 1.4);
  const BUILDING_COLORS = [0xe8b48a, 0xf2d8a7, 0xb85c8a, 0xcf8f6b, 0xf7e8c8];
  const ROOF_COLORS = [0x8a5a3b, 0x6b4a3a, 0xa85a4a, 0x7a6a8a];

  function windows(bx, bz, w, h, d) {
    // Lit window rectangles on the +Z and -Z faces.
    const cols = Math.max(2, Math.floor(w / 4));
    const rows = Math.max(1, Math.floor(h / 5));
    for (const face of [1, -1]) {
      for (let ci = 0; ci < cols; ci++) {
        for (let ri = 0; ri < rows; ri++) {
          const lit = Math.random() < 0.62;
          const m = new THREE.Mesh(winGeo, lit ? (Math.random() < 0.5 ? litMat : litMat2) : darkWinMat);
          const wx = bx - w / 2 + (ci + 0.5) * (w / cols);
          const wy = 2.2 + ri * ((h - 3) / Math.max(1, rows));
          m.position.set(wx, wy, bz + face * (d / 2 + 0.06));
          if (face < 0) m.rotation.y = Math.PI;
          group.add(m);
        }
      }
    }
  }
  function building(x, z, w, h, d, color, roofColor, sign) {
    const b = addBox(w, h, d, color, x, h / 2, z);
    addBox(w + 0.8, 0.7, d + 0.8, roofColor, x, h + 0.35, z);
    windows(x, z, w, h, d);
    addCollider(x, z, Math.max(w, d) * 0.62);
    if (sign) {
      const tex = signTexture(sign.text, sign.bg, sign.fg, sign.border);
      const sm = new THREE.Mesh(
        new THREE.PlaneGeometry(sign.w || 9, sign.h || 2.2),
        new THREE.MeshBasicMaterial({ map: tex, transparent: false })
      );
      if (sign.face === 'west') {
        sm.position.set(x - w / 2 - 0.12, (sign.y || h * 0.72), z);
        sm.rotation.y = -Math.PI / 2;
      } else {
        sm.position.set(x, (sign.y || h * 0.72), z + d / 2 + 0.12);
      }
      group.add(sm);
    }
    return b;
  }

  // City blocks between the roads (skip road corridors + landmarks).
  const skip = [
    { x: -150, z: 110, r: 30 }, { x: 190, z: 250, r: 34 }, { x: 70, z: 262, r: 30 },
    { x: -20, z: 165, r: 26 }, { x: 60, z: 160, r: 18 }, { x: 0, z: 520, r: 100 }
  ];
  function nearSkip(x, z) {
    for (const s of skip) if (Math.hypot(x - s.x, z - s.z) < s.r) return true;
    return false;
  }
  const blockZ = [-200, -120, -40, 40, 120, 180];
  for (const bz of blockZ) {
    for (let bx = -270; bx <= 270; bx += 58) {
      const jx = bx + rand(-8, 8);
      const jz = bz + rand(-6, 6);
      if (nearSkip(jx, jz)) continue;
      if (Math.abs(jx) < 24 && bz === 180) continue; // keep the briefing street open
      const w = rand(16, 26);
      const h = rand(9, 24);
      const d = rand(14, 20);
      building(jx, jz, w, h, d, pick(BUILDING_COLORS), pick(ROOF_COLORS), null);
    }
  }

  // Landmark buildings.
  // Cafe row on the Strand.
  building(-32, 165, 14, 9, 12, 0xf2d8a7, 0x8a5a3b, null);
  building(-20, 165, 16, 10, 12, 0xe8b48a, 0x6b4a3a, {
    text: 'CAFÉ ALBA', bg: '#2a1a2a', fg: '#ffd76a', border: '#ffd76a', w: 11, h: 2.4
  });
  building(-8, 165, 14, 8, 12, 0xcf8f6b, 0xa85a4a, null);
  // Billboard tower.
  building(60, 160, 11, 26, 11, 0x7a6a8a, 0x6b4a3a, {
    text: 'ALBA BAY', bg: '#12283a', fg: '#7ad8ff', border: '#7ad8ff', w: 13, h: 3, y: 20
  });
  // Casino Luna — magenta, neon sign, light beam.
  building(190, 250, 30, 22, 24, 0xc82a8a, 0x8a2a6a, {
    text: 'CASINO LUNA', bg: '#1a0a24', fg: '#ff7ad8', border: '#ff7ad8', w: 20, h: 3.4, y: 17, face: 'west'
  });
  addBox(30.5, 0.5, 24.5, 0xff7ad8, 190, 12.5, 250, {
    material: new THREE.MeshBasicMaterial({ color: 0xff7ad8 })
  });
  // Alba Garage.
  building(-150, 110, 24, 10, 18, 0x6a7a72, 0x4a5a52, {
    text: 'ALBA GARAGE', bg: '#1a2420', fg: '#7dff8a', border: '#7dff8a', w: 14, h: 2.6
  });
  addBox(10, 6, 0.4, 0x1a1a1a, -150, 3, 110 + 9.2);

  // --- Ferris wheel at (70, 262) --------------------------------------------
  const ferrisWheel = new THREE.Group();
  ferrisWheel.position.set(70, 16, 262);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(14, 0.5, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0xff7ad8, roughness: 0.5, metalness: 0.3, emissive: 0xff7ad8, emissiveIntensity: 0.25 })
  );
  ferrisWheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 27.5, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 })
    );
    // Diameter bar through the centre, rotated in the wheel plane.
    spoke.rotation.z = a;
    ferrisWheel.add(spoke);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: pick([0xffd76a, 0x7ad8ff, 0xff4a6a, 0x2ad8c8]), roughness: 0.5 })
    );
    cabin.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0);
    ferrisWheel.add(cabin);
  }
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, roughness: 0.4, emissive: 0xffd76a, emissiveIntensity: 0.4 })
  );
  ferrisWheel.add(hub);
  group.add(ferrisWheel);
  // Support legs.
  for (const sx of [-8, 8]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 18, 8),
      std(0x8a8a92, 0.6, 0.4)
    );
    leg.position.set(70 + sx, 8, 262);
    leg.rotation.z = sx > 0 ? 0.42 : -0.42;
    group.add(leg);
  }
  addCollider(70, 262, 10);

  // --- Casino light beam ------------------------------------------------------
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff7ad8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.set(190, 52, 250);
  group.add(beam);

  // --- Island, causeway, clubhouse -------------------------------------------
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(95, 95, 2, 40),
    std(0xe8d8a8, 0.95, 0)
  );
  island.position.set(0, 0.5, 520);
  group.add(island);
  addBox(10, 1.2, 225, 0xc8b898, 0, 0.6, 410);
  building(0, 520, 20, 10, 14, 0xf7e8c8, 0x8a5a3b, null);
  palm(-14, 505);
  palm(16, 535);
  palm(-20, 540);

  // --- Boats on the water ------------------------------------------------------
  function boat(x, z, s, color) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3 * s, 1 * s, 7 * s), std(color, 0.5, 0.2));
    hull.position.set(0, 0.5, 0);
    b.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8 * s, 1 * s, 2.5 * s), std(0x2a4a5a, 0.5, 0.2));
    cab.position.set(0, 1.4, -0.5 * s);
    b.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 4 * s, 6), std(0x8a6a3a, 0.8, 0));
    mast.position.set(0, 3 * s, 0.5 * s);
    b.add(mast);
    b.position.set(x, 0.1, z);
    b.rotation.y = rand(-0.4, 0.4);
    group.add(b);
    return b;
  }
  boat(10, 315, 2.7, 0xf2f2f2);
  boat(-70, 430, 2.4, 0xffd76a);

  // --- ALBA sign: standalone double-sided panel on two posts, beside the
  // Strand road at the north edge, gold on dark like the garage sign.
  // Panel 11 x 2.6, top at ~8 units; faces the road (south).
  {
    const signTex = signTexture('ALBA', '#1a2420', '#ffd76a', '#ffd76a');
    const signPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 2.6),
      new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    signPanel.position.set(-72, 6.7, 194);
    group.add(signPanel);
    addBox(0.35, 5.4, 0.35, 0x3a3a3a, -76.5, 2.7, 194);
    addBox(0.35, 5.4, 0.35, 0x3a3a3a, -67.5, 2.7, 194);
    addCollider(-72, 194, 5.5);
  }

  // --- Pier + lighthouse: timber deck from the beach into the water, with
  // a striped lighthouse at the pier end, reading with the ferris wheel.
  {
    addBox(5, 0.6, 78, 0x8a6a4a, 30, 1.0, 316, { roughness: 0.9 });
    for (let z = 284; z <= 352; z += 9) {
      addBox(0.5, 2.4, 0.5, 0x6a4a2a, 28.2, 0.4, z);
      addBox(0.5, 2.4, 0.5, 0x6a4a2a, 31.8, 0.4, z);
    }
    addBox(5.4, 0.3, 1.2, 0x6a4a2a, 30, 1.45, 278);
    addBox(5.4, 0.3, 1.2, 0x6a4a2a, 30, 1.45, 354);
    // Lighthouse: white tower with a red band, gallery, and a gold lamp.
    const towerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.5, 3, 12),
      std(0xf2f2f2, 0.7, 0.05)
    );
    towerBase.position.set(30, 2.8, 352);
    group.add(towerBase);
    const towerMid = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.0, 5, 12),
      std(0xd83a3a, 0.7, 0.05)
    );
    towerMid.position.set(30, 6.8, 352);
    group.add(towerMid);
    const towerTop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.55, 5, 12),
      std(0xf2f2f2, 0.7, 0.05)
    );
    towerTop.position.set(30, 11.8, 352);
    group.add(towerTop);
    const gallery = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 1.9, 1.1, 12),
      std(0x2a2a2a, 0.6, 0.3)
    );
    gallery.position.set(30, 14.8, 352);
    group.add(gallery);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd76a })
    );
    lamp.position.set(30, 15.9, 352);
    group.add(lamp);
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(THREE), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    lampGlow.scale.set(14, 14, 1);
    lampGlow.position.set(30, 15.9, 352);
    group.add(lampGlow);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 1.6, 12),
      std(0xd83a3a, 0.7, 0.05)
    );
    roof.position.set(30, 17.4, 352);
    group.add(roof);
    addCollider(30, 352, 3);
  }

  // --- Sun: disc + big glow sprite ---------------------------------------------
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(12, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd76a })
  );
  sunBall.position.set(-420, 95, 420);
  group.add(sunBall);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(THREE), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  sunGlow.scale.set(110, 110, 1);
  sunGlow.position.set(-420, 95, 420);
  group.add(sunGlow);

  // --- Clouds: flat white/pink puffs -------------------------------------------
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffe8e8, transparent: true, opacity: 0.85 });
  const cloudMat2 = new THREE.MeshBasicMaterial({ color: 0xffd8e8, transparent: true, opacity: 0.8 });
  for (const [cx, cy, cz, cs] of [
    [-180, 150, 120, 1.4], [60, 170, -80, 1.8], [220, 140, 200, 1.2],
    [-60, 180, 320, 1.6], [140, 160, 420, 1.3], [-260, 155, -160, 1.5]
  ]) {
    const cl = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 * cs, 10, 8), i % 2 ? cloudMat : cloudMat2);
      puff.scale.set(1.6, 0.42, 1);
      puff.position.set((i - 1) * 11 * cs, (i % 2) * 2, (i - 1) * 3);
      cl.add(puff);
    }
    cl.position.set(cx, cy, cz);
    group.add(cl);
  }

  function isWater(x, z) {
    if (z <= WORLD.waterZ) return false;
    if (Math.hypot(x - WORLD.island.x, z - WORLD.island.z) <= WORLD.island.r + 4) return false;
    if (Math.abs(x) < 8 && z > WORLD.waterZ && z < 520) return false; // causeway
    return true;
  }

  function clampToWorld(x, z) {
    return [
      Math.max(WORLD.minX, Math.min(WORLD.maxX, x)),
      Math.max(WORLD.minZ, Math.min(WORLD.maxZ, z))
    ];
  }

  function setSun(x, y, z, scale) {
    const s = scale !== undefined && scale !== null ? scale : 1;
    sunBall.position.set(x, y, z);
    sunGlow.position.set(x, y, z);
    sunBall.scale.set(s, s, s);
    sunGlow.scale.set(110 * s, 110 * s, 1);
  }

  return { group, colliders, beam, ferrisWheel, sunBall, sunGlow, setSun, isWater, clampToWorld };
}
