// effects.js — cheap pooled particles: skid smoke, muzzle sparks, impact puffs,
// pickup sparkles. One THREE.Points cloud, fixed-size pool, no allocations per frame.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.max = 420;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.size = new Float32Array(this.max);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.85,
      depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -999;
  }

  spawn(x, y, z, vx, vy, vz, r, g, b, life) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.size[i] = life;
  }

  burst(x, y, z, n, r, g, b, speed, life, up = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s,
        r, g, b, life * (0.6 + Math.random() * 0.7));
    }
  }

  smoke(x, y, z) { this.burst(x, y, z, 3, 0.75, 0.72, 0.7, 1.2, 0.9, 0.7); }
  sparks(x, y, z) { this.burst(x, y, z, 8, 1.0, 0.8, 0.3, 6, 0.35, 1.2); }
  sparkle(x, y, z) { this.burst(x, y, z, 10, 1.0, 0.85, 0.3, 2.2, 0.7, 2.2); }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] += 0.6 * dt; // smoke drifts up slightly
      const f = this.life[i] / this.size[i];
      this.col[i * 3] *= (0.4 + 0.6 * f); // fade by darkening (PointsMaterial has no per-point alpha)
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
