// effects.js — explosions, muzzle flashes, sparks, smoke.
// Canvas-generated radial-gradient sprites; fire uses additive blending so
// it glows, smoke uses normal blending for dark puffs. Compact deep-orange
// fireball palette (yellow core, orange mid, red-orange outer, faint halo)
// so the fireball reads hot, never a white wash. Puerto Alba. No personal
// data, no external references.

export class Effects {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.textures = new Map();
    this.parts = []; // {obj, life, maxLife, baseOpacity, grow, vx, vy, vz, light, baseIntensity}
  }

  // Radial-gradient sprite texture, cached by its stop list.
  _texture(stops) {
    const key = stops.join('|');
    let tex = this.textures.get(key);
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    tex = new this.THREE.CanvasTexture(c);
    this.textures.set(key, tex);
    return tex;
  }

  _sprite(stops, size, opacity, additive, x, y, z) {
    const mat = new this.THREE.SpriteMaterial({
      map: this._texture(stops),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? this.THREE.AdditiveBlending : this.THREE.NormalBlending
    });
    const s = new this.THREE.Sprite(mat);
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    this.scene.add(s);
    return s;
  }

  _add(obj, maxLife, baseOpacity, opts) {
    const p = Object.assign(
      { obj, life: 0, maxLife, baseOpacity, grow: 0, vx: 0, vy: 0, vz: 0, light: null, baseIntensity: 0 },
      opts || {}
    );
    this.parts.push(p);
    return p;
  }

  // Large bright fireball: tight layered sprites at modest opacities so the
  // additive stack stays deep orange instead of blowing out to white.
  explosion(x, z, scale) {
    const s = scale || 1;
    const coreStops = [[0, 'rgba(255,246,200,1)'], [0.5, 'rgba(255,170,40,1)'], [0.8, 'rgba(255,100,10,0.95)'], [1, 'rgba(255,60,0,0)']];
    const midStops = [[0, 'rgba(255,138,26,1)'], [0.6, 'rgba(255,110,20,0.9)'], [1, 'rgba(255,80,10,0)']];
    const outerStops = [[0, 'rgba(255,74,0,1)'], [0.6, 'rgba(255,60,0,0.85)'], [1, 'rgba(200,40,0,0)']];
    const haloStops = [[0, 'rgba(255,42,0,0.9)'], [0.6, 'rgba(255,42,0,0.35)'], [1, 'rgba(255,42,0,0)']];
    const smokeStops = [[0, 'rgba(45,32,28,0.9)'], [0.6, 'rgba(40,30,28,0.55)'], [1, 'rgba(35,28,28,0)']];
    this._add(this._sprite(coreStops, 6 * s, 0.6, true, x, 1.4, z), 1.0, 0.6, { grow: 3 * s });
    this._add(this._sprite(midStops, 9 * s, 0.4, true, x, 1.9, z), 1.1, 0.4, { grow: 5 * s });
    this._add(this._sprite(outerStops, 11 * s, 0.25, true, x, 2.4, z), 1.2, 0.25, { grow: 7 * s });
    this._add(this._sprite(haloStops, 9 * s, 0.04, true, x, 2.8, z), 1.3, 0.04, { grow: 8 * s });
    this._add(this._sprite(smokeStops, 12 * s, 0.4, false, x, 4.5, z), 1.9, 0.4, { grow: 11 * s, vy: 3.5 });
    this._add(this._sprite(smokeStops, 16 * s, 0.35, false, x + 2 * s, 6, z - 1), 2.1, 0.35, { grow: 13 * s, vy: 4 });
    // Point-light flash that decays with the fireball.
    const light = new this.THREE.PointLight(0xff8a2a, 6, 30, 2);
    light.position.set(x, 3, z);
    this.scene.add(light);
    this._add(light, 0.5, 0, { light, baseIntensity: 6 });
  }

  // Muzzle flash at (x, y, z): one hot core sprite + a short light pop.
  muzzle(x, y, z) {
    const stops = [[0, 'rgba(255,242,180,1)'], [0.4, 'rgba(255,200,90,0.9)'], [1, 'rgba(255,140,20,0)']];
    this._add(this._sprite(stops, 4.0, 0.95, true, x, y, z), 0.12, 0.95, { grow: 6 });
    const light = new this.THREE.PointLight(0xffe9a0, 22, 18, 2);
    light.position.set(x, y, z);
    this.scene.add(light);
    this._add(light, 0.1, 0, { light, baseIntensity: 22 });
  }

  // Impact sparks: a burst of small hot flecks that fly out and fall.
  sparks(x, y, z) {
    const stops = [[0, 'rgba(255,240,170,1)'], [0.5, 'rgba(255,180,60,0.9)'], [1, 'rgba(255,120,20,0)']];
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 7;
      const s = this._sprite(stops, 0.9, 0.9, true, x, y, z);
      this._add(s, 0.45 + Math.random() * 0.15, 0.9, {
        vx: Math.cos(a) * sp, vy: 2 + Math.random() * 5, vz: Math.sin(a) * sp
      });
    }
  }

  // Dark smoke puffs that rise and swell.
  smoke(x, y, z) {
    const stops = [[0, 'rgba(45,32,28,0.9)'], [0.6, 'rgba(40,30,28,0.55)'], [1, 'rgba(35,28,28,0)']];
    this._add(this._sprite(stops, 8, 0.5, false, x, y, z), 1.6, 0.5, { grow: 6, vy: 3 });
    this._add(this._sprite(stops, 11, 0.45, false, x + 1.5, y + 1.5, z - 1), 1.8, 0.45, { grow: 7, vy: 3.5 });
  }

  // Advance every live part: fade, grow, drift, remove the dead, decay lights.
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        this.scene.remove(p.obj);
        if (p.obj.material) p.obj.material.dispose();
        this.parts.splice(i, 1);
        continue;
      }
      const fade = 1 - t;
      if (p.light) {
        p.obj.intensity = p.baseIntensity * fade;
        continue;
      }
      p.obj.material.opacity = p.baseOpacity * fade;
      if (p.grow) {
        p.obj.scale.x += p.grow * dt;
        p.obj.scale.y += p.grow * dt;
      }
      if (p.vx || p.vy || p.vz) {
        p.obj.position.x += p.vx * dt;
        p.obj.position.y += p.vy * dt;
        p.obj.position.z += p.vz * dt;
        // Sparks fall; smoke keeps rising.
        if (p.baseOpacity >= 0.9 && p.maxLife < 1) p.vy -= 14 * dt;
      }
    }
  }
}
