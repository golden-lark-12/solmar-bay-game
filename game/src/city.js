// Puerto Alba — city.js
// Builds the golden-hour coastal city: roads, towers, beach, palms,
// causeway over the bay, props and collision data.
(function () {
  'use strict';
  var U = PA.utils;

  var ROAD_COORDS = [-120, -60, 0, 60, 120];
  var ROAD_W = 12;
  var CITY = 180;

  function roadTexture() {
    return U.makeCanvasTexture(128, 128, function (ctx, w, h) {
      ctx.fillStyle = '#33333a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3a3a42';
      for (var i = 0; i < 300; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      ctx.fillStyle = '#e8c34a';
      ctx.fillRect(w / 2 - 2, 8, 4, 34);
      ctx.fillRect(w / 2 - 2, 86, 4, 34);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(4, 0, 2, h);
      ctx.fillRect(w - 6, 0, 2, h);
    });
  }

  function windowTexture(base, lit) {
    return U.makeCanvasTexture(128, 256, function (ctx, w, h) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (var y = 10; y < h - 10; y += 22) {
        for (var x = 10; x < w - 10; x += 20) {
          var on = Math.random() < 0.55;
          ctx.fillStyle = on ? lit : '#20242e';
          ctx.fillRect(x, y, 12, 14);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, h - 18, w, 18);
    });
  }

  function skyTexture() {
    return U.makeCanvasTexture(16, 512, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.0, '#2e1e4e');
      g.addColorStop(0.35, '#7a3a5e');
      g.addColorStop(0.55, '#d96b3f');
      g.addColorStop(0.72, '#f5a54a');
      g.addColorStop(0.85, '#ffd98a');
      g.addColorStop(1.0, '#ffe9b0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(11, h * 0.78, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function makePalm() {
    var g = new THREE.Group();
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 6.5, 6), trunkMat);
    trunk.position.y = 3.25;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    var frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f, side: THREE.DoubleSide });
    for (var i = 0; i < 7; i++) {
      var frond = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 4), frondMat);
      var a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1, 6.6, Math.sin(a) * 1.1);
      frond.rotation.z = Math.cos(a) * 1.15;
      frond.rotation.x = -Math.sin(a) * 1.15;
      frond.scale.set(1, 1, 0.22);
      g.add(frond);
    }
    var nuts = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
    );
    nuts.position.y = 6.2;
    g.add(nuts);
    return g;
  }

  function build(scene) {
    var colliders = [];
    var palms = [];
    var world = {
      colliders: colliders,
      palms: palms,
      roadCoords: ROAD_COORDS,
      bounds: CITY,
      playerSpawn: { x: 8, z: 26, heading: Math.PI },
      carSpots: [],
      trafficLoops: [],
      pedPaths: [],
      causewayEnd: { x: 0, z: 252 },
      beachCenter: { x: -40, z: 168 },
      update: null,
      collide: null
    };

    // Sky dome + warm haze.
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
    );
    scene.add(sky);
    scene.fog = new THREE.Fog(0xe8a05c, 180, 700);

    var sun = new THREE.DirectionalLight(0xffb066, 1.6);
    sun.position.set(-140, 90, -220);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xffd9a0, 0x4a3a5a, 0.85));
    var fill = new THREE.DirectionalLight(0x7a86c8, 0.35);
    fill.position.set(120, 60, 180);
    scene.add(fill);

    // Ground: city slab.
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY * 2 + 80, CITY * 2 + 80),
      new THREE.MeshLambertMaterial({ color: 0x6f6a63 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 0);
    scene.add(ground);

    // Roads.
    var rTex = roadTexture();
    rTex.wrapS = rTex.wrapT = THREE.RepeatWrapping;
    var roadMat = new THREE.MeshLambertMaterial({ map: rTex });
    ROAD_COORDS.forEach(function (c) {
      var ns = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY * 2), roadMat.clone());
      ns.material.map = rTex.clone();
      ns.material.map.repeat.set(1, 28);
      ns.material.map.needsUpdate = true;
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(c, 0.02, 0);
      scene.add(ns);
      var ew = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, ROAD_W), roadMat.clone());
      ew.material.map = rTex.clone();
      ew.material.map.repeat.set(28, 1);
      ew.material.map.needsUpdate = true;
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.02, c);
      scene.add(ew);
    });

    // Sidewalk slabs along avenues.
    var walkMat = new THREE.MeshLambertMaterial({ color: 0x9a8f80 });
    ROAD_COORDS.forEach(function (c) {
      [-8.5, 8.5].forEach(function (off) {
        var s = new THREE.Mesh(new THREE.PlaneGeometry(4, CITY * 2), walkMat);
        s.rotation.x = -Math.PI / 2;
        s.position.set(c + off, 0.04, 0);
        scene.add(s);
      });
    });

    // Beach sand + bay water.
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY * 2 + 80, 46),
      new THREE.MeshLambertMaterial({ color: 0xe8cf9a })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.06, 168);
    scene.add(sand);
    var waterTex = U.makeCanvasTexture(128, 128, function (ctx, w, h) {
      ctx.fillStyle = '#1e6f8e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2f8fb0';
      for (var i = 0; i < 60; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 14, 2);
      }
      ctx.fillStyle = '#f5a54a';
      ctx.fillRect(0, 0, w, 6);
    });
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.repeat.set(10, 4);
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 260),
      new THREE.MeshLambertMaterial({ color: 0x2e7fa8 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.7, 320);
    scene.add(water);
    world.water = water;
    world.waterTex = waterTex;

    // Causeway deck over the bay (x = 0, z 150 -> 262).
    var deck = new THREE.Mesh(
      new THREE.BoxGeometry(13, 1.2, 118),
      new THREE.MeshLambertMaterial({ color: 0x8a8578 })
    );
    deck.position.set(0, 0.35, 206);
    scene.add(deck);
    var deckRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 116),
      new THREE.MeshLambertMaterial({ color: 0x33333a })
    );
    deckRoad.rotation.x = -Math.PI / 2;
    deckRoad.position.set(0, 1.0, 206);
    scene.add(deckRoad);
    [-6.2, 6.2].forEach(function (x) {
      var rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.1, 116),
        new THREE.MeshLambertMaterial({ color: 0xd8b25a })
      );
      rail.position.set(x, 1.5, 206);
      scene.add(rail);
    });
    // Island turnaround at the end.
    var island = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 18, 1.4, 20),
      new THREE.MeshLambertMaterial({ color: 0xd8c48a })
    );
    island.position.set(0, 0.2, 262);
    scene.add(island);
    var palmI = makePalm();
    palmI.position.set(8, 0.9, 258);
    scene.add(palmI);
    palms.push(palmI);

    // Buildings: fill the blocks between roads.
    var palette = ['#c98f6a', '#d8a97a', '#b87a7a', '#7a9ab0', '#a8b08a', '#c9b18a', '#8a7ab0', '#e0c9a0'];
    var litTints = ['#ffd98a', '#ffe9b0', '#ffb066'];
    var blocks = [];
    for (var bx = 0; bx < ROAD_COORDS.length - 1; bx++) {
      for (var bz = 0; bz < ROAD_COORDS.length - 1; bz++) {
        var x0 = ROAD_COORDS[bx] + 9, x1 = ROAD_COORDS[bx + 1] - 9;
        var z0 = ROAD_COORDS[bz] + 9, z1 = ROAD_COORDS[bz + 1] - 9;
        if (z0 > 138) continue; // beach blocks stay open
        blocks.push({ x0: x0, x1: x1, z0: z0, z1: z1 });
      }
    }
    blocks.forEach(function (b, bi) {
      var n = 1 + (bi % 3);
      for (var i = 0; i < n; i++) {
        var w = U.rand(14, 26), d = U.rand(14, 26);
        var cx = U.rand(b.x0 + w / 2, b.x1 - w / 2);
        var cz = U.rand(b.z0 + d / 2, b.z1 - d / 2);
        var h = U.pick([9, 12, 16, 22, 30, 38, 48]);
        var tex = windowTexture(U.pick(palette), U.pick(litTints));
        var mat = new THREE.MeshLambertMaterial({ map: tex });
        var box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        box.position.set(cx, h / 2, cz);
        scene.add(box);
        var roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x5a4a3a })
        );
        roof.position.set(cx, h + 0.4, cz);
        scene.add(roof);
        if (h > 24) {
          var beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xff4444 })
          );
          beacon.position.set(cx, h + 1.4, cz);
          scene.add(beacon);
        }
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }
    });

    // Palms: beach row + avenue corners.
    for (var px = -170; px <= 170; px += 22) {
      var p = makePalm();
      p.position.set(px + U.rand(-3, 3), 0, 156 + U.rand(-2, 2));
      p.rotation.y = U.rand(0, Math.PI * 2);
      scene.add(p);
      palms.push(p);
      colliders.push({ minX: p.position.x - 0.5, maxX: p.position.x + 0.5, minZ: p.position.z - 0.5, maxZ: p.position.z + 0.5 });
    }
    ROAD_COORDS.forEach(function (c) {
      [-132, 132].forEach(function (z) {
        var q = makePalm();
        q.position.set(c + 9.5, 0, z);
        scene.add(q);
        palms.push(q);
      });
    });

    // Streetlights along avenues.
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
    var lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    ROAD_COORDS.forEach(function (c) {
      for (var z = -150; z <= 150; z += 30) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), poleMat);
        pole.position.set(c + 7.2, 3.5, z);
        scene.add(pole);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
        lamp.position.set(c + 7.2, 7.1, z);
        scene.add(lamp);
      }
    });

    // Beach props: umbrellas, crates, lifeguard tower.
    var umbrellaCols = [0xe86a5a, 0x4a90c8, 0xf5c542];
    for (var u = 0; u < 8; u++) {
      var ux = -150 + u * 42 + U.rand(-6, 6);
      var poleU = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), poleMat);
      poleU.position.set(ux, 1.5, 172);
      scene.add(poleU);
      var top = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 1.1, 8),
        new THREE.MeshLambertMaterial({ color: umbrellaCols[u % 3] })
      );
      top.position.set(ux, 3.4, 172);
      scene.add(top);
    }
    var tower = new THREE.Group();
    var legs = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 3), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    legs.position.y = 2.25;
    tower.add(legs);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2, 3.6), new THREE.MeshLambertMaterial({ color: 0xe86a5a }));
    cab.position.y = 5.4;
    tower.add(cab);
    tower.position.set(-60, 0, 170);
    scene.add(tower);
    colliders.push({ minX: -61.8, maxX: -58.2, minZ: 168.2, maxZ: 171.8 });

    // Parked-car spots (curbside) — vehicles are added by vehicle.js.
    world.carSpots = [
      { x: 14, z: 30, heading: Math.PI / 2, color: 0xc22a2a, model: 'Vulture GT', sporty: true },
      { x: -52, z: -8, heading: -Math.PI / 2, color: 0x2a6ac2, model: 'Alba Cruiser', sporty: false },
      { x: 68, z: 52, heading: 0, color: 0xf5c542, model: 'Marina Taxi', sporty: false },
      { x: -8, z: -68, heading: Math.PI, color: 0x222222, model: 'Night Runner', sporty: true },
      { x: 128, z: -52, heading: Math.PI / 2, color: 0x3f8f4f, model: 'Palm Van', sporty: false },
      { x: -128, z: 68, heading: 0, color: 0xe8e8e8, model: 'Bay Sedan', sporty: false },
      { x: 52, z: 128, heading: -Math.PI / 2, color: 0xc22a8a, model: 'Sunset Coupe', sporty: true },
      { x: -68, z: -128, heading: Math.PI, color: 0x8a5a2a, model: 'Dock Pickup', sporty: false }
    ];

    // Traffic loops: rectangles around blocks.
    world.trafficLoops = [
      [{ x: -60, z: -60 }, { x: 60, z: -60 }, { x: 60, z: 60 }, { x: -60, z: 60 }],
      [{ x: -120, z: -120 }, { x: 120, z: -120 }, { x: 120, z: 0 }, { x: -120, z: 0 }],
      [{ x: -120, z: 60 }, { x: 0, z: 60 }, { x: 0, z: 120 }, { x: -120, z: 120 }],
      [{ x: 0, z: -120 }, { x: 120, z: -120 }, { x: 120, z: 120 }, { x: 0, z: 120 }],
      [{ x: -60, z: 120 }, { x: 60, z: 120 }, { x: 60, z: 150 }, { x: -60, z: 150 }]
    ];

    // Pedestrian paths: sidewalk lines.
    world.pedPaths = [];
    ROAD_COORDS.forEach(function (c) {
      world.pedPaths.push([{ x: c + 8.5, z: -150 }, { x: c + 8.5, z: 140 }]);
      world.pedPaths.push([{ x: c - 8.5, z: 140 }, { x: c - 8.5, z: -150 }]);
    });

    // Collision: circle vs AABBs, water band, city edge.
    world.collide = function (x, z, r) {
      var nx = x, nz = z;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var cx = U.clamp(nx, c.minX, c.maxX);
        var cz = U.clamp(nz, c.minZ, c.maxZ);
        var dx = nx - cx, dz = nz - cz;
        var d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 0.0001) { nx = c.maxX + r; continue; }
          var d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          nz = cz + (dz / d) * r;
        }
      }
      // Bay water blocks movement except on the causeway deck.
      if (nz > 190 && Math.abs(nx) > 7.5) nz = 190;
      if (nz > 268) nz = 268;
      nx = U.clamp(nx, -CITY - 20, CITY + 20);
      nz = U.clamp(nz, -CITY - 20, 268);
      return { x: nx, z: nz };
    };

    var t0 = 0;
    world.update = function (dt, t) {
      t0 = t;
      if (world.waterTex) world.waterTex.offset.x = (t * 0.008) % 1;
      for (var i = 0; i < palms.length; i++) {
        palms[i].rotation.z = Math.sin(t * 0.7 + i) * 0.02;
      }
    };

    return world;
  }

  window.PA = window.PA || {};
  PA.city = { build: build, ROAD_COORDS: ROAD_COORDS };
})();
