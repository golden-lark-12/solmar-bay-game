// hud.js — the dense in-game HUD: mission banner (job, stage bars, timer,
// next step), PAPD dispatch panel (named units, roles, live distances),
// weapon slots, crew abilities, respect rank + RP, health + armour, speed +
// car condition, radio line, location label, dialogue box, and a 2D canvas
// minimap with roads, a route line to the objective, the player arrow, police
// dots, the helicopter, the roadblock, the mission blip and stash dots.
import { fmtCash, fmtTime } from './utils.js';
import { nearestRoadPoint } from './city.js';

const ROLE_CLASS = { RAMMING: 'role-ram', PURSUIT: 'role-pur', FLANKING: 'role-flank', SPOTLIGHT: 'role-spot', ROADBLOCK: 'role-block', 'CLOSING IN': 'role-pur' };

export class HUD {
  constructor() {
    const root = document.getElementById('hud');
    root.innerHTML = `
      <div id="hud-mission">
        <div id="hud-mission-head"><span id="hud-job"></span><span id="hud-timer-chip"></span></div>
        <div id="hud-objective"></div>
        <div id="hud-stage-row"><span id="hud-stage-label"></span><div id="hud-stage-bars"></div></div>
        <div id="hud-next"></div>
      </div>
      <div id="hud-right-top">
        <div id="hud-clock"></div>
        <div id="hud-cash">$0</div>
        <div id="hud-stars"></div>
        <div id="hud-sight"></div>
        <div id="hud-respect"><span id="hud-respect-rank"></span><div id="hud-rp-bar"><div id="hud-rp-fill"></div></div><span id="hud-rp-num"></span></div>
      </div>
      <div id="hud-dispatch"><div id="hud-dispatch-head"></div><div id="hud-dispatch-units"></div><div id="hud-dispatch-note"></div></div>
      <div id="hud-weapons"></div>
      <div id="hud-crew"></div>
      <div id="hud-location"><div id="hud-place"></div><div id="hud-street"></div></div>
      <div id="hud-vitals">
        <div class="vital"><span>HEALTH</span><div class="vital-bar"><div id="hud-health-fill"></div></div><b id="hud-health-num">100</b></div>
        <div class="vital"><span>ARMOUR</span><div class="vital-bar"><div id="hud-armour-fill"></div></div><b id="hud-armour-num">55</b></div>
      </div>
      <canvas id="minimap" width="190" height="190"></canvas>
      <div id="hud-dialogue"><div id="hud-portrait"></div><div><div id="hud-speaker"></div><div id="hud-line"></div></div></div>
      <div id="hud-speed-block">
        <div id="hud-radio"></div>
        <div id="hud-carname"></div>
        <div id="hud-speed"></div>
        <div id="hud-condition-row"><span>CONDITION</span><div id="hud-condition-bar"><div id="hud-condition-fill"></div></div><b id="hud-condition-num"></b></div>
      </div>
      <div id="hud-prompt"></div>
      <div id="hud-toast"></div>
      <div id="hud-mute">M — mute · 1-6 weapons · Z/X/C crew</div>`;
    this.jobEl = document.getElementById('hud-job');
    this.timerChip = document.getElementById('hud-timer-chip');
    this.objEl = document.getElementById('hud-objective');
    this.stageLabel = document.getElementById('hud-stage-label');
    this.stageBars = document.getElementById('hud-stage-bars');
    this.nextEl = document.getElementById('hud-next');
    this.clockEl = document.getElementById('hud-clock');
    this.cashEl = document.getElementById('hud-cash');
    this.starsEl = document.getElementById('hud-stars');
    this.sightEl = document.getElementById('hud-sight');
    this.respectRankEl = document.getElementById('hud-respect-rank');
    this.rpFill = document.getElementById('hud-rp-fill');
    this.rpNum = document.getElementById('hud-rp-num');
    this.dispatchHead = document.getElementById('hud-dispatch-head');
    this.dispatchUnits = document.getElementById('hud-dispatch-units');
    this.dispatchNote = document.getElementById('hud-dispatch-note');
    this.weaponsEl = document.getElementById('hud-weapons');
    this.crewEl = document.getElementById('hud-crew');
    this.placeEl = document.getElementById('hud-place');
    this.streetEl = document.getElementById('hud-street');
    this.healthFill = document.getElementById('hud-health-fill');
    this.healthNum = document.getElementById('hud-health-num');
    this.armourFill = document.getElementById('hud-armour-fill');
    this.armourNum = document.getElementById('hud-armour-num');
    this.portraitEl = document.getElementById('hud-portrait');
    this.speakerEl = document.getElementById('hud-speaker');
    this.lineEl = document.getElementById('hud-line');
    this.dialogueEl = document.getElementById('hud-dialogue');
    this.radioEl = document.getElementById('hud-radio');
    this.carNameEl = document.getElementById('hud-carname');
    this.speedEl = document.getElementById('hud-speed');
    this.condFill = document.getElementById('hud-condition-fill');
    this.condNum = document.getElementById('hud-condition-num');
    this.promptEl = document.getElementById('hud-prompt');
    this.toastEl = document.getElementById('hud-toast');
    this.map = document.getElementById('minimap');
    this.mctx = this.map.getContext('2d');
    this.toastTimer = 0;
    this.lastCash = -1;
    this.lastStageKey = '';
  }

  toast(text, secs = 3.5) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastTimer = secs;
  }

  setText(el, text) { if (el.textContent !== text) el.textContent = text; }

  update(dt, s) {
    // --- mission banner (the ONE objective bar — toasts never repeat it) ---
    this.setText(this.jobEl, s.jobLabel || '');
    this.setText(this.timerChip, s.timerText || '');
    this.timerChip.style.display = s.timerText ? 'inline-block' : 'none';
    this.setText(this.objEl, s.objective || '');
    this.setText(this.stageLabel, s.stageText || '');
    const stageKey = (s.stage || 0) + '/' + (s.stageTotal || 0);
    if (stageKey !== this.lastStageKey) {
      this.lastStageKey = stageKey;
      this.stageBars.innerHTML = '';
      for (let i = 0; i < (s.stageTotal || 0); i++) {
        const seg = document.createElement('span');
        seg.className = 'stage-seg' + (i < (s.stage || 0) ? ' on' : '');
        this.stageBars.appendChild(seg);
      }
    }
    this.setText(this.nextEl, s.nextText ? 'NEXT  ' + s.nextText : '');
    this.nextEl.style.display = s.nextText ? 'block' : 'none';
    // --- top right: clock, cash, stars, sight, respect ---
    this.setText(this.clockEl, s.clock || '');
    if (s.cash !== this.lastCash) { this.cashEl.textContent = fmtCash(s.cash); this.lastCash = s.cash; }
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    this.setText(this.starsEl, stars);
    this.starsEl.style.color = s.wanted > 0 ? '#ffd23a' : 'rgba(255,255,255,0.55)';
    this.setText(this.sightEl, s.sight || '');
    this.sightEl.style.display = s.sight ? 'block' : 'none';
    if (s.respect) {
      this.setText(this.respectRankEl, 'RANK ' + s.respect.rank);
      this.rpFill.style.width = Math.min(100, (s.respect.rp / s.respect.rpMax) * 100) + '%';
      this.setText(this.rpNum, s.respect.rp.toLocaleString('en-US') + ' / ' + s.respect.rpMax.toLocaleString('en-US') + ' RP');
    }
    // --- dispatch panel ---
    if (s.dispatch) {
      this.setText(this.dispatchHead, 'PAPD RESPONSE · ' + s.dispatch.total + ' UNITS');
      let html = '';
      for (const u of s.dispatch.units) {
        html += `<div class="unit"><span class="unit-name">${u.name}</span><span class="unit-dist">${u.dist} m</span><span class="unit-role ${ROLE_CLASS[u.role] || ''}">${u.role}</span></div>`;
      }
      if (this.dispatchUnits.innerHTML !== html) this.dispatchUnits.innerHTML = html;
      const bits = [];
      if (s.dispatch.extra > 0) bits.push(`+${s.dispatch.extra} more unit${s.dispatch.extra > 1 ? 's' : ''}`);
      if (s.roadblock) bits.push('roadblock ahead');
      this.setText(this.dispatchNote, bits.join(' · '));
      this.dispatchNote.style.display = this.dispatchNote.textContent ? 'block' : 'none';
    }
    // --- weapon slots ---
    if (s.weapons) {
      let html = '';
      for (const w of s.weapons) {
        html += `<div class="slot${w.active ? ' active' : ''}${w.locked ? ' locked' : ''}"><span class="slot-n">${w.n}</span><span class="slot-gun">${w.locked ? '🔒' : '▬▬▸'}</span><span class="slot-name">${w.name}</span><span class="slot-ammo">${w.locked ? 'LOCKED' : w.ammo + w.reserve}</span></div>`;
      }
      if (this.weaponsEl.innerHTML !== html) this.weaponsEl.innerHTML = html;
    }
    // --- crew abilities ---
    if (s.crew) {
      let html = '';
      for (const a of s.crew) {
        html += `<div class="ability${a.ready ? '' : ' cooling'}"><span class="ab-key">${a.key}</span><span class="ab-name">${a.name}</span><span class="ab-who">${a.who}</span><span class="ab-cd">${a.ready ? 'READY' : a.cd + 's'}</span></div>`;
      }
      if (this.crewEl.innerHTML !== html) this.crewEl.innerHTML = html;
    }
    // --- location + vitals ---
    this.setText(this.placeEl, s.location || '');
    this.setText(this.streetEl, s.street || '');
    this.healthFill.style.width = Math.max(0, s.health) + '%';
    this.healthFill.style.background = s.health > 50 ? '#58d858' : s.health > 25 ? '#e8a838' : '#e83838';
    this.healthNum.textContent = Math.round(s.health);
    const arm = s.armour ?? 0;
    this.armourFill.style.width = Math.max(0, arm) + '%';
    this.armourNum.textContent = Math.round(arm);
    // --- dialogue ---
    if (s.dialogue) {
      this.dialogueEl.style.display = 'flex';
      this.setText(this.speakerEl, s.dialogue.name + ' · ' + s.dialogue.role);
      this.setText(this.lineEl, s.dialogue.line);
      this.portraitEl.textContent = s.dialogue.initials;
      this.portraitEl.style.background = s.dialogue.color || '#4a8ac0';
    } else {
      this.dialogueEl.style.display = 'none';
    }
    // --- speed block ---
    this.setText(this.radioEl, s.radio ? '♪ ' + s.radio : '');
    this.setText(this.carNameEl, s.inCar ? (s.carName || '') : '');
    this.setText(this.speedEl, s.inCar ? Math.round(Math.abs(s.speedKmh || 0)) + ' km/h' : '');
    if (s.inCar) {
      const cond = Math.max(0, Math.round(s.condition ?? 100));
      this.condFill.style.width = cond + '%';
      this.condFill.style.background = cond > 50 ? '#58d858' : cond > 25 ? '#e8a838' : '#e83838';
      this.setText(this.condNum, cond + '%');
    } else {
      this.setText(this.condNum, '');
      this.condFill.style.width = '0%';
    }
    // --- prompt / toast / trial timer ---
    this.setText(this.promptEl, s.prompt || '');
    if (s.trialTime && !s.timerText) this.timerChip.textContent = 'TRIAL ' + fmtTime(s.trialTime);
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
    // route line: player -> road grid -> objective (yellow dashed)
    if (s.marker) {
      const pr = nearestRoadPoint(s.playerX, s.playerZ);
      const mr = nearestRoadPoint(s.marker.x, s.marker.z);
      const pts = [
        [s.playerX, s.playerZ], [pr.x, pr.z],
        [mr.x, pr.z], [mr.x, mr.z], [s.marker.x, s.marker.z],
      ].map(([x, z]) => toMap(x, z));
      c.strokeStyle = '#ffd23a'; c.lineWidth = 2.5;
      c.setLineDash([5, 4]);
      c.beginPath();
      pts.forEach(([x, z], i) => { if (i === 0) c.moveTo(x, z); else c.lineTo(x, z); });
      c.stroke();
      c.setLineDash([]);
    }
    // stashes
    c.fillStyle = '#ffc83a';
    for (const st of s.stashes) {
      if (st.taken) continue;
      const [x, z] = toMap(st.x, st.z);
      c.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    // roadblock (orange square)
    if (s.roadblock) {
      const [x, z] = toMap(s.roadblock.x, s.roadblock.z);
      c.fillStyle = '#ff8a1a';
      c.fillRect(x - 4, z - 4, 8, 8);
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
    // target car (gold dot)
    if (s.targetCar) {
      const [x, z] = toMap(s.targetCar.x, s.targetCar.z);
      c.fillStyle = '#e8c84a';
      c.beginPath(); c.arc(x, z, 4, 0, Math.PI * 2); c.fill();
    }
    // police (red dots)
    for (const cop of s.cops) {
      const [x, z] = toMap(cop.pos.x, cop.pos.z);
      c.fillStyle = '#ff4040';
      c.beginPath(); c.arc(x, z, 3.5, 0, Math.PI * 2); c.fill();
    }
    // helicopter (white ring)
    if (s.heli && s.heli.x !== undefined) {
      const [x, z] = toMap(s.heli.x, s.heli.z);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, z, 5, 0, Math.PI * 2); c.stroke();
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
    // N marker + ring border
    c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
    c.fillText('N', W / 2, 14);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); c.stroke();
  }
}
