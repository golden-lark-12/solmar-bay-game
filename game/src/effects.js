// effects.js — Puerto Alba transient effects: explosions, muzzle flashes,
// sparks and smoke. Everything ages and fades in update(); nothing lingers.

export class Effects {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.live = [];
  }

  _texture(stops) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new this.THREE.CanvasTexture(c);
    return tex;
  }

  _sprite(stops, size, opacity, additive, x, y, z, maxLife) {
    const mat = new this.THREE.SpriteMaterial({
      map: this._texture(stops),
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      blending: additive ? this.THREE.AdditiveBlending : this.THREE.NormalBlending
    });
    const s = new this.THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    this.scene.add(s);
    if (maxLife !== undefined && maxLife !== null) {
      this._add(s, maxLife, opacity, {});
    }
    return s;
  }

  _add(obj, maxLife, baseOpacity, opts) {
    const o = opts || {};
    if (obj && obj.parent !== this.scene && !obj.isLight) this.scene.add(obj);
    if (obj && obj.isLight) this.scene.add(obj);
    this.live.push({
      obj: obj,
      life: 0,
      maxLife: maxLife,
      baseOpacity: baseOpacity,
      grow: o.grow || 0,
      rise: o.rise || 0,
      baseScale: obj.scale ? obj.scale.x : 1
    });
    return obj;
  }

  explosion(x, z, scale) {
    const s = scale || 1;
    // Solid deep-orange core: a real ball, not a white haze.
    const core = new this.THREE.Mesh(
      new this.THREE.SphereGeometry(2.2 * s, 16, 12),
      new this.THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.95 })
    );
    core.position.set(x, 2, z);
    this._add(core, 0.9, 0.95, { grow: 0.6 });
    // Tight mid glow, deep orange only — no near-white anywhere.
    this._sprite(
      [[0, 'rgba(255,120,20,0.95)'], [0.55, 'rgba(255,90,0,0.75)'], [1, 'rgba(255,60,0,0)']],
      7 * s, 0.9, true, x, 2, z, 0.9
    );
    // Wider outer glow, dimmer.
    this._sprite(
      [[0, 'rgba(255,140,40,0.7)'], [1, 'rgba(255,80,0,0)']],
      12 * s, 0.6, true, x, 2, z, 1.1
    );
    // Two smoke puffs rising off the ball.
    this.smoke(x + 1, 3, z + 0.5);
    this.smoke(x - 1, 3.5, z - 0.5);
    // Dim warm light, short-lived.
    const light = new this.THREE.PointLight(0xff8a2a, 6, 40);
    light.position.set(x, 4, z);
    this._add(light, 0.7, 6, {});
  }

  muzzle(x, y, z) {
    // Bright burst at the gun tip: tight hot core + warm halo + a short
    // light. Lives past the 250ms burst interval (and past a slow
    // headless frame), so a bright flash is visible in every frame,
    // without overlapping generations blowing the scene out.
    this._sprite(
      [[0, 'rgba(255,250,200,1)'], [0.3, 'rgba(255,210,90,0.95)'], [1, 'rgba(255,120,20,0)']],
      3.4, 1, true, x, y, z, 0.5
    );
    this._sprite(
      [[0, 'rgba(255,220,120,0.5)'], [1, 'rgba(255,120,20,0)']],
      4.0, 0.5, true, x, y, z, 0.55
    );
    const light = new this.THREE.PointLight(0xffc040, 4, 14);
    light.position.set(x, y + 0.5, z);
    this._add(light, 0.4, 4, {});
  }

  sparks(x, y, z) {
    // A handful of small bright particles that fly out and die fast.
    for (let i = 0; i < 7; i++) {
      const ox = (Math.random() - 0.5) * 1.6;
      const oy = (Math.random() - 0.5) * 1.2;
      const oz = (Math.random() - 0.5) * 1.6;
      this._sprite(
        [[0, 'rgba(255,240,180,1)'], [0.5, 'rgba(255,180,60,0.85)'], [1, 'rgba(255,120,20,0)']],
        0.9 + Math.random() * 0.7, 1, true,
        x + ox, y + oy, z + oz, 0.3 + Math.random() * 0.2
      );
    }
  }

  smoke(x, y, z) {
    // Grey puffs: slow, soft, rising.
    for (let i = 0; i < 2; i++) {
      const ox = (Math.random() - 0.5) * 1.2;
      const oz = (Math.random() - 0.5) * 1.2;
      this._sprite(
        [[0, 'rgba(120,120,120,0.55)'], [1, 'rgba(80,80,80,0)']],
        3 + Math.random() * 2, 0.5, false,
        x + ox, y + 0.5 + i * 0.6, z + oz, 1.2
      );
      const e = this.live[this.live.length - 1];
      if (e) { e.rise = 1.5; e.grow = 1.2; }
    }
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      e.life += dt;
      const k = e.life / e.maxLife;
      if (k >= 1) {
        this.scene.remove(e.obj);
        if (e.obj.material) {
          if (e.obj.material.map) e.obj.material.map.dispose();
          e.obj.material.dispose();
        }
        if (e.obj.geometry) e.obj.geometry.dispose();
        this.live.splice(i, 1);
        continue;
      }
      const fade = 1 - k;
      if (e.obj.isLight) {
        e.obj.intensity = e.baseOpacity * fade;
      } else if (e.obj.material && e.obj.material.opacity !== undefined) {
        e.obj.material.opacity = e.baseOpacity * fade;
      }
      if (e.grow && e.obj.scale) {
        const ns = e.baseScale * (1 + e.grow * k);
        e.obj.scale.set(ns, ns, e.obj.isSprite ? 1 : ns);
      }
      if (e.rise) e.obj.position.y += e.rise * dt;
    }
  }
}
