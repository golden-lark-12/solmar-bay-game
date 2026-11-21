// effects.js — Puerto Alba particle effects: explosions (solid deep-orange
// core ball), muzzle flashes, sparks, smoke. Sprite-based, pooled by life.
export class Effects {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.textures = {};
    this.parts = [];
  }

  _texture(stops) {
    const key = JSON.stringify(stops);
    if (this.textures[key]) return this.textures[key];
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    for (const [off, color] of stops) g.addColorStop(off, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new this.THREE.CanvasTexture(c);
    this.textures[key] = tex;
    return tex;
  }

  _sprite(stops, size, opacity, additive, x, y, z) {
    const mat = new this.THREE.SpriteMaterial({
      map: this._texture(stops),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? this.THREE.AdditiveBlending : this.THREE.NormalBlending,
    });
    const s = new this.THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    return s;
  }

  _add(obj, maxLife, baseOpacity, opts) {
    opts = opts || {};
    this.scene.add(obj);
    const part = {
      obj,
      life: 0,
      maxLife,
      baseOpacity,
      // grow = extra scale factor reached at end of life (1.0 = doubles).
      grow: opts.grow || 0,
      baseScale: obj.scale ? obj.scale.clone() : null,
      vx: opts.vx || 0,
      vy: opts.vy || 0,
      vz: opts.vz || 0,
      light: opts.light || null,
      baseIntensity: opts.light ? (opts.baseIntensity || 3) : 0,
    };
    this.parts.push(part);
    return part;
  }

  // A distinct deep-orange fireball: solid sphere core + hot glow + smoke.
  explosion(x, z, scale) {
    scale = scale || 1;
    const THREE = this.THREE;
    // Solid core ball — reads as a ball, not a white glow.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(2.2 * scale, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.95 })
    );
    core.position.set(x, 1.6 * scale, z);
    this._add(core, 1.6, 0.95, { grow: 0.5 });
    // Hot inner ball.
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 * scale, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.95 })
    );
    inner.position.set(x, 1.6 * scale, z);
    this._add(inner, 1.1, 0.95, { grow: 0.4 });
    // Outer glow halo — compact, so the ball reads as a ball.
    const glow = this._sprite(
      [[0, 'rgba(255,140,30,0.85)'], [0.5, 'rgba(255,90,0,0.4)'], [1, 'rgba(255,60,0,0)']],
      6 * scale, 0.75, true, x, 2.2 * scale, z
    );
    this._add(glow, 1.4, 0.75, { grow: 0.6 });
    // Smoke puffs rising.
    for (let i = 0; i < 3; i++) {
      const s = this._sprite(
        [[0, 'rgba(60,50,45,0.75)'], [1, 'rgba(60,50,45,0)']],
        2.8 * scale, 0.7, false,
        x + (i - 1) * 1.2 * scale, 2.5 * scale + i * 0.8, z
      );
      this._add(s, 2.6, 0.7, { vy: 2.2, grow: 0.6 });
    }
    // Orange point light so the blast lights the road.
    const light = new THREE.PointLight(0xff7a1a, 3, 34);
    light.position.set(x, 3, z);
    this._add(light, 1.2, 1, { light, baseIntensity: 3 });
    return core;
  }

  muzzle(x, y, z) {
    // Compact flash: visible at the gun, never a screen-wide wash.
    const flash = this._sprite(
      [[0, 'rgba(255,255,230,1)'], [0.35, 'rgba(255,210,90,0.95)'], [1, 'rgba(255,140,20,0)']],
      2.0, 1, true, x, y, z
    );
    this._add(flash, 0.28, 1, { grow: 0.3 });
    const star = this._sprite(
      [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,220,120,0)']],
      0.8, 1, true, x, y, z
    );
    this._add(star, 0.2, 1, { grow: 0.25 });
    return flash;
  }

  sparks(x, y, z) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const s = this._sprite(
        [[0, 'rgba(255,240,170,1)'], [0.5, 'rgba(255,160,40,0.8)'], [1, 'rgba(255,90,0,0)']],
        1.1, 1, true,
        x + Math.cos(a) * 0.4, y + (i % 3) * 0.25, z + Math.sin(a) * 0.4
      );
      this._add(s, 0.55, 1, { vx: Math.cos(a) * 7, vy: 2.5, vz: Math.sin(a) * 7, grow: 0.2 });
    }
    return true;
  }

  smoke(x, y, z) {
    const s = this._sprite(
      [[0, 'rgba(90,85,80,0.8)'], [1, 'rgba(90,85,80,0)']],
      3.2, 0.75, false, x, y, z
    );
    this._add(s, 2.4, 0.75, { vy: 1.8, grow: 1.0 });
    return s;
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        if (p.light) this.scene.remove(p.light);
        else this.scene.remove(p.obj);
        this.parts.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.maxLife;
      if (p.obj && p.obj.material && p.obj.material.opacity !== undefined) {
        p.obj.material.opacity = p.baseOpacity * k;
      }
      if (p.grow && p.baseScale && p.obj && p.obj.scale) {
        const f = 1 + p.grow * (p.life / p.maxLife);
        p.obj.scale.copy(p.baseScale).multiplyScalar(f);
      }
      if (p.obj && p.obj.position) {
        p.obj.position.x += p.vx * dt;
        p.obj.position.y += p.vy * dt;
        p.obj.position.z += p.vz * dt;
      }
      if (p.light) p.light.intensity = p.baseIntensity * k;
    }
  }
}
