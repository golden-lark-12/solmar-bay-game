// effects.js — particle sprites: explosions, muzzle flashes, sparks, smoke.
// Canvas-generated radial-gradient sprites. Fire uses additive blending so it
// glows; smoke uses normal blending so it reads as dark puffs.
// v4: fireball is COMPACT and DEEP ORANGE (core yellow, mid orange, outer
// deep orange-red, faint halo) so it reads as a fireball, not a white wash.

export class Effects {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.active = [];
    this._texCache = new Map();
  }

  // Soft radial gradient texture, cached by stop list.
  _glowTexture(stops) {
    const key = stops.join('|');
    if (this._texCache.has(key)) return this._texCache.get(key);
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [pos, col] of stops) g.addColorStop(pos, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new this.THREE.CanvasTexture(c);
    this._texCache.set(key, tex);
    return tex;
  }

  _sprite(tex, color, opacity, size, blending) {
    const mat = new this.THREE.SpriteMaterial({
      map: tex,
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      blending: blending || this.THREE.AdditiveBlending,
    });
    const sp = new this.THREE.Sprite(mat);
    sp.scale.set(size, size, 1);
    sp.userData.baseOpacity = opacity;
    return sp;
  }

  _register(group, maxLife, kind, light) {
    group.userData = { kind };
    this.scene.add(group);
    this.active.push({ group, life: 0, maxLife, kind, light: light || null, lightBase: light ? light.intensity : 0 });
  }

  // Large bright fireball on the road. scale multiplies the base sizes.
  // Deep orange palette: yellow core, orange mid, red-orange outer, faint halo.
  explosion(x, z, scale) {
    const s = scale || 1;
    const g = new this.THREE.Group();
    const soft = this._glowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    // Tighter sprites: the old 44x halo filled the whole frame at chase
    // distance and washed the cover to a haze. A distinct ball, not a fog.
    // Lower opacities too: additive stacking of full-bright sprites blows
    // the fireball to white; these keep it deep orange.
    const core = this._sprite(soft, 0xffe14a, 0.65, 6 * s);
    const mid = this._sprite(soft, 0xff8a1a, 0.5, 11 * s);
    const outer = this._sprite(soft, 0xff4a00, 0.35, 18 * s);
    const halo = this._sprite(soft, 0xff2a00, 0.10, 26 * s);
    g.add(core);
    g.add(mid);
    g.add(outer);
    g.add(halo);
    // Rising embers.
    for (let i = 0; i < 5; i++) {
      const e = this._sprite(soft, 0xffc23a, 0.9, (4 + Math.random() * 4) * s);
      e.position.set((Math.random() - 0.5) * 8 * s, Math.random() * 6 * s, (Math.random() - 0.5) * 8 * s);
      g.add(e);
    }
    // Dark smoke puffs for contrast against the bright core.
    for (let i = 0; i < 4; i++) {
      const sm = this._sprite(soft, 0x2a1a12, 0.45, (10 + Math.random() * 6) * s, this.THREE.NormalBlending);
      sm.position.set((Math.random() - 0.5) * 10 * s, 4 + Math.random() * 8 * s, (Math.random() - 0.5) * 10 * s);
      g.add(sm);
    }
    const light = new this.THREE.PointLight(0xff8a2a, 15 * s, 25 * s, 1.6);
    light.position.set(0, 3, 0);
    g.add(light);
    g.position.set(x, 2.0, z);
    this._register(g, 2.6, 'explosion', light);
  }

  // Bright muzzle flash at the gun (x, y, z are world coords).
  muzzle(x, y, z) {
    const g = new this.THREE.Group();
    const soft = this._glowTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    // Small flash: the old 12-unit halo sat ~10m from the camera and
    // filled the frame, whiting out the combat shot.
    const flash = this._sprite(soft, 0xfff2a8, 1.0, 2.5);
    const halo = this._sprite(soft, 0xffc23a, 0.5, 5);
    g.add(flash);
    g.add(halo);
    const light = new this.THREE.PointLight(0xffd76a, 18, 14, 1.8);
    g.add(light);
    g.position.set(x, y, z);
    this._register(g, 0.35, 'muzzle', light);
  }

  // Small bright impact sparks.
  sparks(x, y, z) {
    const g = new this.THREE.Group();
    const soft = this._glowTexture([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
    for (let i = 0; i < 6; i++) {
      const sp = this._sprite(soft, 0xffd76a, 0.9, 3 + Math.random() * 3);
      sp.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3);
      g.add(sp);
    }
    const light = new this.THREE.PointLight(0xffc23a, 18, 16, 1.8);
    g.add(light);
    g.position.set(x, y, z);
    this._register(g, 0.45, 'sparks', light);
  }

  // Rising dark smoke puffs.
  smoke(x, y, z) {
    const g = new this.THREE.Group();
    const soft = this._glowTexture([[0, 'rgba(255,255,255,0.8)'], [0.6, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    for (let i = 0; i < 4; i++) {
      const sm = this._sprite(soft, 0x3a2a22, 0.5, 8 + Math.random() * 6, this.THREE.NormalBlending);
      sm.position.set((Math.random() - 0.5) * 4, i * 2.5, (Math.random() - 0.5) * 4);
      g.add(sm);
    }
    g.position.set(x, y, z);
    this._register(g, 2.0, 'smoke', null);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.life += dt;
      const t = e.life / e.maxLife;
      if (t >= 1) {
        this.scene.remove(e.group);
        e.group.traverse((o) => {
          if (o.material) {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
          }
        });
        this.active.splice(i, 1);
        continue;
      }
      // Grow slightly, hold full brightness for the first 25% of life, then fade.
      const grow = 1 + t * 0.9;
      e.group.scale.set(grow, grow, grow);
      const fade = t < 0.25 ? 1 : 1 - (t - 0.25) / 0.75;
      e.group.traverse((o) => {
        if (o.isSprite) o.material.opacity = (o.userData.baseOpacity ?? 1) * fade;
      });
      if (e.light) e.light.intensity = e.lightBase * fade;
      if (e.kind === 'smoke') e.group.position.y += dt * 2.5;
    }
  }
}
