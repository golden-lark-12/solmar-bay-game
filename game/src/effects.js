// effects.js — real fireball explosions (layered core + smoke + light flash),
// muzzle flashes, sparks, smoke puffs. Canvas-generated sprite textures only.
// Puerto Alba.

function makeGlowTexture(colorStops) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  for (const [t, col] of colorStops) grad.addColorStop(t, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export class Effects {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.active = []; // {group, life, maxLife, kind, vel, light}
    // Sprite textures, made once.
    this.fireTex = new THREE.CanvasTexture(makeGlowTexture([
      [0, 'rgba(255,255,200,1)'], [0.35, 'rgba(255,200,60,0.9)'],
      [0.65, 'rgba(255,110,20,0.55)'], [1, 'rgba(255,60,0,0)']
    ]));
    this.smokeTex = new THREE.CanvasTexture(makeGlowTexture([
      [0, 'rgba(60,55,55,0.85)'], [0.6, 'rgba(50,45,45,0.45)'], [1, 'rgba(40,40,40,0)']
    ]));
    this.sparkTex = new THREE.CanvasTexture(makeGlowTexture([
      [0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,220,120,0.9)'], [1, 'rgba(255,160,0,0)']
    ]));
  }

  // Layered fireball: bright core + orange mid + red outer + smoke + light flash.
  explosion(x, z, big) {
    const THREE = this.THREE;
    const g = new THREE.Group();
    g.position.set(x, 2, z);
    const s = big ? 1.6 : 1;
    const layers = [
      { size: 14 * s, color: 0xff3a00, op: 0.55 },
      { size: 10 * s, color: 0xff8a1a, op: 0.8 },
      { size: 6 * s, color: 0xffd76a, op: 0.95 },
      { size: 3.2 * s, color: 0xfff6c0, op: 1 }
    ];
    for (const L of layers) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.fireTex, color: L.color, transparent: true, opacity: L.op, depthWrite: false
      }));
      m.scale.set(L.size, L.size, 1);
      m.position.y = (Math.random() - 0.5) * 2;
      g.add(m);
    }
    // Smoke puffs rising.
    for (let i = 0; i < 5; i++) {
      const sm = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.smokeTex, transparent: true, opacity: 0.7, depthWrite: false
      }));
      const sz = (5 + Math.random() * 5) * s;
      sm.scale.set(sz, sz, 1);
      sm.position.set((Math.random() - 0.5) * 6, 3 + Math.random() * 6, (Math.random() - 0.5) * 6);
      sm.userData.rise = 4 + Math.random() * 3;
      g.add(sm);
    }
    const light = new THREE.PointLight(0xff8a2a, 60, 60);
    light.position.y = 3;
    g.add(light);
    this.scene.add(g);
    this.active.push({ group: g, life: 0, maxLife: 2.2, kind: 'explosion', light });
  }

  muzzle(x, z, y) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTex, transparent: true, opacity: 0.95, depthWrite: false
    }));
    m.position.set(x, y || 1.4, z);
    m.scale.set(3.2, 3.2, 1);
    this.scene.add(m);
    this.active.push({ group: m, life: 0, maxLife: 0.12, kind: 'muzzle' });
  }

  sparks(x, z, y) {
    const g = new THREE.Group();
    g.position.set(x, y || 1.2, z);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.sparkTex, transparent: true, opacity: 0.9, depthWrite: false
      }));
      const sz = 1 + Math.random() * 1.6;
      s.scale.set(sz, sz, 1);
      s.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3);
      g.add(s);
    }
    this.scene.add(g);
    this.active.push({ group: g, life: 0, maxLife: 0.4, kind: 'sparks' });
  }

  smoke(x, z, y) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.smokeTex, transparent: true, opacity: 0.55, depthWrite: false
    }));
    s.position.set(x, y || 2, z);
    s.scale.set(4, 4, 1);
    this.scene.add(s);
    this.active.push({ group: s, life: 0, maxLife: 1.1, kind: 'smoke' });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.life += dt;
      const t = a.life / a.maxLife;
      if (t >= 1) {
        this.scene.remove(a.group);
        this.active.splice(i, 1);
        continue;
      }
      if (a.kind === 'explosion') {
        const grow = 1 + t * 1.1;
        a.group.scale.set(grow, grow, grow);
        for (const child of a.group.children) {
          if (child.isSprite && child.userData.rise) {
            child.position.y += child.userData.rise * dt;
            child.material.opacity = Math.max(0, 0.7 * (1 - t));
          } else if (child.isSprite) {
            child.material.opacity = Math.max(0, child.material.opacity * (1 - dt * 0.9));
          }
        }
        if (a.light) a.light.intensity = 60 * (1 - t);
      } else if (a.kind === 'muzzle') {
        a.group.material.opacity = 0.95 * (1 - t);
      } else if (a.kind === 'sparks') {
        a.group.position.y += dt * 2;
        for (const child of a.group.children) child.material.opacity = 0.9 * (1 - t);
      } else if (a.kind === 'smoke') {
        a.group.position.y += dt * 2.5;
        const sc = 4 + t * 6;
        a.group.scale.set(sc, sc, 1);
        a.group.material.opacity = 0.55 * (1 - t);
      }
    }
  }
}
