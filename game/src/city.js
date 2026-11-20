// city.js — builds Solmar Bay: road grid, downtown glass towers, suburbs,
// beach + pier + marina on the west, a bay with a causeway bridge and an island
// to the north. Also owns the road graph traffic drives on, building colliders
// and the spawn / stash spots missions use.
import { mulberry32, pick, range, rangeInt } from './utils.js';

export const ROAD_LINES = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const ROAD_W = 10;
export const WORLD = 320;          // half-extent of the playable land
export const BEACH_X = -268;       // ocean starts west of here
export const BAY_Z = -258;         // bay starts north of here
export const BRIDGE_X = 0;         // causeway runs along x = 0, z -240..-360
export const ISLAND = { minX: -110, maxX: 110, minZ: -430, maxZ: -372 };

function windowTexture(rng, litRatio, rows, cols) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b3442'; g.fillRect(0, 0, 64, 128);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd27a' : '#9fd8ff') : '#141a24';
      g.fillRect(4 + col * (56 / cols), 6 + r * (116 / rows), 56 / cols - 3, 116 / rows - 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#43464d'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e8c85a'; g.fillRect(30, 6, 4, 22); g.fillRect(30, 38, 4, 22);
  g.fillStyle = '#55585f';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---- light, sky, fog: warm dusk over the ocean ----
  scene.background = new THREE.Color(0xff9a5c);
  scene.fog = new THREE.Fog(0xf2a06b, 320, 1100);
  const sun = new THREE.DirectionalLight(0xffb37a, 2.1);
  sun.position.set(-260, 120, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -340; sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340; sun.shadow.camera.bottom = -340;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8a6a9a, 1.05));
  const hemi = new THREE.HemisphereLight(0xffc49a, 0x3a2f45, 0.65);
  scene.add(hemi);
  // low sun disc over the water
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sunDisc.position.set(-420, 42, -60); sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  // ---- ground, water, beach ----
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x5c584a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2 + 260, WORLD * 2 + 260), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, -60);
  ground.receiveShadow = true; group.add(ground);

  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2a6a8a });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(300, 900), waterMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-420, -1.6, -60); group.add(ocean);
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(900, 220), waterMat);
  bay.rotation.x = -Math.PI / 2; bay.position.set(0, -1.6, -368); group.add(bay);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(34, 640),
    new THREE.MeshLambertMaterial({ color: 0xd9b380 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-252, 0.02, -60);
  sand.receiveShadow = true; group.add(sand);

  // ---- roads (textured strips along every grid line) ----
  const rTex = roadTexture();
  const roadGeoX = new THREE.PlaneGeometry(560, ROAD_W);
  const roadGeoZ = new THREE.PlaneGeometry(ROAD_W, 560);
  for (const z of ROAD_LINES) {
    const t = rTex.clone(); t.needsUpdate = true; t.repeat.set(9, 1);
    const r = new THREE.Mesh(roadGeoX, new THREE.MeshLambertMaterial({ map: t }));
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.04, z);
    r.receiveShadow = true; group.add(r);
  }
  for (const x of ROAD_LINES) {
    const t = rTex.clone(); t.needsUpdate = true; t.repeat.set(1, 9);
    const r = new THREE.Mesh(roadGeoZ, new THREE.MeshLambertMaterial({ map: t }));
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.05, 0);
    r.receiveShadow = true; group.add(r);
  }

  // ---- buildings ----
  const towerTex = windowTexture(rng, 0.42, 14, 6);
  const towerTex2 = windowTexture(rng, 0.3, 10, 5);
  const towerMats = [
    new THREE.MeshLambertMaterial({ map: towerTex, emissive: 0x553311, emissiveMap: towerTex }),
    new THREE.MeshLambertMaterial({ map: towerTex2, emissive: 0x332211, emissiveMap: towerTex2 }),
    new THREE.MeshLambertMaterial({ color: 0x8a7f72 }),
    new THREE.MeshLambertMaterial({ color: 0x6a7a8a }),
  ];
  const houseColors = [0xd8a06a, 0xe8d8b0, 0xb0c8d8, 0xd8b0a0, 0xc0d0a0, 0xe0c090];
  const houseMats = houseColors.map(c => new THREE.MeshLambertMaterial({ color: c }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const mids = [-210, -150, -90, -30, 30, 90, 150, 210];
  const parkBlocks = new Set();
  for (const bx of mids) for (const bz of mids) {
    if (rng() < 0.12) { parkBlocks.add(bx + ',' + bz); continue; }
    const downtown = Math.abs(bx) < 130 && Math.abs(bz) < 130;
    if (downtown) {
      const w = range(rng, 26, 40), d = range(rng, 26, 40), h = range(rng, 34, 88);
      const m = new THREE.Mesh(boxGeo, pick(rng, towerMats));
      m.scale.set(w, h, d); m.position.set(bx, h / 2, bz);
      m.castShadow = true; m.receiveShadow = true; group.add(m);
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      if (rng() < 0.45) { // rooftop annex
        const a = new THREE.Mesh(boxGeo, towerMats[2]);
        a.scale.set(w * 0.4, 5, d * 0.4); a.position.set(bx + w * 0.2, h + 2.5, bz);
        group.add(a);
      }
    } else {
      const n = rangeInt(rng, 2, 3);
      for (let i = 0; i < n; i++) {
        const w = range(rng, 10, 16), d = range(rng, 10, 16), h = range(rng, 4, 9);
        const ox = bx + (i % 2 ? 12 : -12), oz = bz + (i < 2 ? -10 : 12);
        const m = new THREE.Mesh(boxGeo, pick(rng, houseMats));
        m.scale.set(w, h, d); m.position.set(ox, h / 2, oz);
        m.castShadow = true; m.receiveShadow = true; group.add(m);
        colliders.push({ minX: ox - w / 2, maxX: ox + w / 2, minZ: oz - d / 2, maxZ: oz + d / 2 });
      }
    }
  }

  // ---- parks: palms + benches on empty blocks ----
  const palmTrunk = new THREE.CylinderGeometry(0.22, 0.35, 7, 6);
  const palmLeaf = new THREE.ConeGeometry(2.6, 3.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a8a4a });
  const palmSpots = [];
  for (const key of parkBlocks) {
    const [bx, bz] = key.split(',').map(Number);
    for (let i = 0; i < 5; i++) palmSpots.push([bx + range(rng, -18, 18), bz + range(rng, -18, 18)]);
  }
  // beach palms + a few along the main drag
  for (let i = 0; i < 14; i++) palmSpots.push([-258 + range(rng, -6, 6), -220 + i * 34 + range(rng, -6, 6)]);
  for (let i = 0; i < 8; i++) palmSpots.push([-220 + i * 60 + range(rng, -8, 8), 66]);
  const trunkMesh = new THREE.InstancedMesh(palmTrunk, trunkMat, palmSpots.length);
  const leafMesh = new THREE.InstancedMesh(palmLeaf, leafMat, palmSpots.length);
  const dummy = new THREE.Object3D();
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.5, z); dummy.rotation.set(0, rng() * 6.28, 0); dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 8.2, z); dummy.rotation.set(0.15, rng() * 6.28, 0.1); dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
  });
  trunkMesh.castShadow = true; group.add(trunkMesh); group.add(leafMesh);

  // ---- streetlights along the roads ----
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 5);
  const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc85a, emissiveIntensity: 1 });
  const lampSpots = [];
  for (const x of ROAD_LINES) for (const z of ROAD_LINES) {
    if (rng() < 0.5) lampSpots.push([x + 7, z + 7]);
  }
  const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.25, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 6.6, z); dummy.updateMatrix();
    headMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(poleMesh); group.add(headMesh);

  // ---- pier (west, at z = 0) + marina boats (south-west) ----
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(58, 0.8, 10), pierMat);
  pier.position.set(-296, 0.4, 0); pier.castShadow = true; group.add(pier);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), pierMat);
    post.position.set(-276 - i * 9, -0.8, i % 2 ? 4 : -4); group.add(post);
  }
  const ferris = new THREE.Mesh(new THREE.TorusGeometry(7, 0.5, 6, 18),
    new THREE.MeshLambertMaterial({ color: 0xff7a9a, emissive: 0x992244 }));
  ferris.position.set(-318, 10, -14); ferris.rotation.y = Math.PI / 2; group.add(ferris);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf0f0e8 });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0x4a8ab0 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 3.4), i % 2 ? boatMat : boatMat2);
    hull.position.y = -0.4; b.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 5), poleMat);
    mast.position.y = 3.2; b.add(mast);
    b.position.set(-296 + range(rng, -8, 8), -1.2, 190 + i * 14);
    b.rotation.y = range(rng, -0.3, 0.3);
    group.add(b);
  }

  // ---- causeway bridge + island ----
  const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x6a6a66 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 130), bridgeMat);
  deck.position.set(0, 0.6, -305); deck.receiveShadow = true; group.add(deck);
  for (const sx of [-7.5, 7.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 130),
      new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
    rail.position.set(sx, 1.7, -305); group.add(rail);
  }
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 4, 8), bridgeMat);
    p.position.set(i % 2 ? 5 : -5, -1.5, -268 - i * 15); group.add(p);
  }
  const islandGround = new THREE.Mesh(new THREE.PlaneGeometry(240, 70),
    new THREE.MeshLambertMaterial({ color: 0x5a5a48 }));
  islandGround.rotation.x = -Math.PI / 2; islandGround.position.set(0, 0.02, -400);
  islandGround.receiveShadow = true; group.add(islandGround);
  // lighthouse
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }));
  tower.position.y = 13; tower.castShadow = true; lh.add(tower);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0xc03a3a, emissive: 0x661111 }));
  cap.position.y = 27; lh.add(cap);
  const beam = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe98a, emissiveIntensity: 2 }));
  beam.position.y = 29; lh.add(beam);
  lh.position.set(-80, 0, -400); group.add(lh);
  colliders.push({ minX: -85, maxX: -75, minZ: -405, maxZ: -395 });
  for (let i = 0; i < 3; i++) {
    const w = range(rng, 14, 20), d = range(rng, 12, 18), h = range(rng, 6, 12);
    const x = 40 + i * 32, z = -392 - (i % 2) * 14;
    const m = new THREE.Mesh(boxGeo, pick(rng, houseMats));
    m.scale.set(w, h, d); m.position.set(x, h / 2, z); m.castShadow = true; group.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // ---- road graph: intersections + neighbours ----
  const nodes = [];
  for (const x of ROAD_LINES) for (const z of ROAD_LINES) nodes.push({ x, z });
  const nodeAt = (x, z) => nodes.find(n => n.x === x && n.z === z);
  for (const n of nodes) {
    n.next = [];
    for (const [dx, dz] of [[60, 0], [-60, 0], [0, 60], [0, -60]]) {
      const m = nodeAt(n.x + dx, n.z + dz);
      if (m) n.next.push(m);
    }
  }
  // island road stubs connect through the bridge node (0,-240)
  const bridgeNode = nodeAt(0, -240);
  bridgeNode.next.push({ x: 0, z: -300, next: [] });
  const islandNode = { x: 0, z: -400, next: [] };
  bridgeNode.next[bridgeNode.next.length - 1].next = [islandNode];
  islandNode.next = [bridgeNode.next[bridgeNode.next.length - 1]];

  return {
    group, colliders, nodes, nodeAt,
    // fixed gameplay spots
    spawn: { x: -30, z: 30 },
    stashSpots: [
      { x: -258, z: -40 }, { x: -120, z: 180 }, { x: 60, z: -120 }, { x: 180, z: 60 },
      { x: -60, z: -180 }, { x: 120, z: 240 }, { x: -180, z: -60 }, { x: 240, z: -180 },
      { x: 30, z: 120 }, { x: -90, z: 210 },
    ],
    trialGates: [
      { x: -60, z: 0 }, { x: -60, z: -180 }, { x: 120, z: -180 }, { x: 120, z: 120 }, { x: -180, z: 120 },
    ],
  };
}

// Circle vs building colliders + land bounds. Mutates pos {x,z} in place.
export function collide(city, pos, r) {
  for (const c of city.colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
    } else if (d2 <= 0.0001) {
      pos.x += r; // centre inside a box: shove out east
    }
  }
  // stay on land: beach west edge, bay north edge (bridge + island are exceptions)
  const onBridge = Math.abs(pos.x) < 6.5 && pos.z > -372 && pos.z < -240;
  const onIsland = pos.x > ISLAND.minX && pos.x < ISLAND.maxX && pos.z > ISLAND.minZ && pos.z < ISLAND.maxZ;
  const onPier = pos.x > -326 && pos.x < -268 && Math.abs(pos.z) < 5;
  if (pos.x < BEACH_X - 4 && !onPier) pos.x = BEACH_X - 4;
  if (pos.z < BAY_Z && !onBridge && !onIsland) pos.z = BAY_Z;
  pos.x = Math.max(-326, Math.min(WORLD, pos.x));
  pos.z = Math.max(ISLAND.minZ, Math.min(WORLD, pos.z));
}

export function nearestRoadPoint(x, z) {
  let bx = ROAD_LINES[0], bz = ROAD_LINES[0];
  for (const v of ROAD_LINES) { if (Math.abs(v - x) < Math.abs(bx - x)) bx = v; }
  for (const v of ROAD_LINES) { if (Math.abs(v - z) < Math.abs(bz - z)) bz = v; }
  return { x: bx, z: bz };
}
