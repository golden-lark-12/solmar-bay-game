// hud.js — the in-game HUD: health bar, cash, wanted stars, ammo, speed,
// objective line, context prompt, toast messages, and a 2D canvas minimap with
// roads, the player arrow, police dots, the mission blip and stash dots.
import { fmtCash, fmtTime } from './utils.js';

export class HUD {
  constructor() {
    const root = document.getElementById('hud');
    root.innerHTML = `
      <div id="hud-top">
        <div id="hud-stars"></div>
        <div id="hud-objective"></div>
        <div id="hud-cash">$0</div>
      </div>
      <div id="hud-bottom">
        <div id="hud-health"><div id="hud-health-fill"></div><span id="hud-health-num">100</span></div>
        <div id="hud-ammo"></div>
        <div id="hud-speed"></div>
      </div>
      <canvas id="minimap" width="190" height="190"></canvas>
      <div id="hud-prompt"></div>
      <div id="hud-toast"></div>
      <div id="hud-timer"></div>
      <div id="hud-mute">M — mute</div>`;
    this.starsEl = document.getElementById('hud-stars');
    this.objEl = document.getElementById('hud-objective');
    this.cashEl = document.getElementById('hud-cash');
    this.healthFill = document.getElementById('hud-health-fill');
    this.healthNum = document.getElementById('hud-health-num');
    this.ammoEl = document.getElementById('hud-ammo');
    this.speedEl = document.getElementById('hud-speed');
    this.promptEl = document.getElementById('hud-prompt');
    this.toastEl = document.getElementById('hud-toast');
    this.timerEl = document.getElementById('hud-timer');
    this.map = document.getElementById('minimap');
    this.mctx = this.map.getContext('2d');
    this.toastTimer = 0;
    this.lastCash = -1;
  }

  toast(text, secs = 3.5) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastTimer = secs;
  }

  update(dt, s) {
    // wanted stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    if (this.starsEl.textContent !== stars) this.starsEl.textContent = stars;
    this.starsEl.style.color = s.wanted > 0 ? '#ffd23a' : 'rgba(255,255,255,0.55)';
    if (this.objEl.textContent !== s.objective) this.objEl.textContent = s.objective;
    if (s.cash !== this.lastCash) { this.cashEl.textContent = fmtCash(s.cash); this.lastCash = s.cash; }
    this.healthFill.style.width = Math.max(0, s.health) + '%';
    this.healthFill.style.background = s.health > 50 ? '#58d858' : s.health > 25 ? '#e8a838' : '#e83838';
    this.healthNum.textContent = Math.round(s.health);
    this.ammoEl.textContent = s.inCar ? '' : `▸ ${s.ammo} / ${s.reserve}${s.reloading ? '  RELOADING…' : ''}`;
    this.speedEl.textContent = s.inCar ? `${Math.round(Math.abs(s.speed) * 3.6)} km/h` : '';
    this.promptEl.textContent = s.prompt || '';
    this.timerEl.textContent = s.trialTime ? 'TRIAL ' + fmtTime(s.trialTime) : '';
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const c = this.mctx, W = 190, R = 460; // world half-extent shown
    c.clearRect(0, 0, W, W);
    c.fillStyle = 'rgba(12, 16, 24, 0.82)';
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); c.clip();
    const toMap = (x, z) => [W / 2 + (x / R) * (W / 2), W / 2 + (z / R) * (W / 2)];
    // water edges
    c.fillStyle = '#2a6a8a';
    c.fillRect(0, 0, W / 2 + (-268 / R) * (W / 2), W); // west ocean
    c.fillRect(0, 0, W, W / 2 + (-258 / R) * (W / 2)); // north bay
    // land
    c.fillStyle = '#3a3a34';
    c.fillRect(W / 2 + (-268 / R) * (W / 2), W / 2 + (-258 / R) * (W / 2), W, W);
    // roads
    c.strokeStyle = '#6a6a60'; c.lineWidth = 2;
    for (const v of s.roads) {
      const [ax] = toMap(v, 0); c.beginPath(); c.moveTo(ax, 0); c.lineTo(ax, W); c.stroke();
      const [, bz] = toMap(0, v); c.beginPath(); c.moveTo(0, bz); c.lineTo(W, bz); c.stroke();
    }
    // island + bridge
    c.fillStyle = '#5a5a48';
    const [ix0, iz0] = toMap(-110, -430), [ix1, iz1] = toMap(110, -372);
    c.fillRect(ix0, iz0, ix1 - ix0, iz1 - iz0);
    c.strokeStyle = '#6a6a60'; c.lineWidth = 3;
    const [bx, bz0] = toMap(0, -240), [, bz1] = toMap(0, -372);
    c.beginPath(); c.moveTo(bx, bz0); c.lineTo(bx, bz1); c.stroke();
    // stashes
    c.fillStyle = '#ffc83a';
    for (const st of s.stashes) {
      if (st.taken) continue;
      const [x, z] = toMap(st.x, st.z);
      c.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    // mission marker (pulsing yellow)
    if (s.marker) {
      const [x, z] = toMap(s.marker.x, s.marker.z);
      const pulse = 4 + Math.sin(performance.now() / 180) * 1.5;
      c.fillStyle = '#ffd23a';
      c.beginPath(); c.arc(x, z, pulse, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, z, pulse + 3, 0, Math.PI * 2); c.stroke();
    }
    // police (red/blue dots)
    for (const cop of s.cops) {
      const [x, z] = toMap(cop.pos.x, cop.pos.z);
      c.fillStyle = '#ff4040';
      c.beginPath(); c.arc(x, z, 3.5, 0, Math.PI * 2); c.fill();
    }
    // traffic (grey dots)
    c.fillStyle = '#b8b8b8';
    for (const car of s.trafficCars) {
      const [x, z] = toMap(car.pos.x, car.pos.z);
      c.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    // player arrow
    const [px, pz] = toMap(s.playerX, s.playerZ);
    c.save();
    c.translate(px, pz); c.rotate(s.playerHeading);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.strokeStyle = '#111'; c.lineWidth = 1; c.stroke();
    c.restore();
    c.restore();
    // ring border
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); c.stroke();
  }
}
