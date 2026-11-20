// hud.js — the whole HUD as DOM: stars, cash, rank + RP, district + standing,
// mission banner, IN SIGHT banner, dispatch panel with colored badges, minimap,
// big speedo + car name + condition, nitro bar, weapon slots, crew portraits,
// radio with song title, dialogue, hints, weapon wheel, garage shop, toasts.
// Puerto Alba.

import { el, fmtCash, fmtClock } from './utils.js';

const STAR = '★';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.build();
    this._cache = {};
  }

  build() {
    // Top-left: wanted stars, cash, rank, district.
    const tl = el('div', 'hud-tl', null, this.root);
    this.starsEl = el('div', 'hud-stars', '☆☆☆☆☆', tl);
    this.cashEl = el('div', 'hud-cash', '$1,200', tl);
    this.rankEl = el('div', 'hud-rank', 'Wheelman', tl);
    this.rpBar = el('div', 'hud-rpbar', null, tl);
    this.rpFill = el('div', 'hud-rpfill', null, this.rpBar);
    this.rpText = el('div', 'hud-rptext', '0 RP', tl);
    this.districtEl = el('div', 'hud-district', 'Commerce Row', tl);
    this.standBar = el('div', 'hud-rpbar', null, tl);
    this.standFill = el('div', 'hud-rpfill stand', null, this.standBar);
    this.standText = el('div', 'hud-rptext', 'Standing 0', tl);

    // Top-center: mission banner + IN SIGHT.
    const tc = el('div', 'hud-tc', null, this.root);
    this.missionEl = el('div', 'hud-mission', null, tc);
    this.missionTitle = el('div', 'hud-mission-title', '', this.missionEl);
    this.missionGiver = el('div', 'hud-mission-giver', '', this.missionEl);
    this.missionStage = el('div', 'hud-mission-stage', '', this.missionEl);
    this.missionTimer = el('div', 'hud-mission-timer', '', this.missionEl);
    this.missionBar = el('div', 'hud-rpbar mission', null, this.missionEl);
    this.missionFill = el('div', 'hud-rpfill', null, this.missionBar);
    this.insightEl = el('div', 'hud-insight', 'IN SIGHT', tc);
    this.insightEl.style.display = 'none';

    // Top-right: minimap, dispatch, clock.
    const tr = el('div', 'hud-tr', null, this.root);
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = 200; this.mapCanvas.height = 200;
    this.mapCanvas.className = 'hud-minimap';
    tr.appendChild(this.mapCanvas);
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.clockEl = el('div', 'hud-clock', '6:00 PM · Golden Hour', tr);
    this.dispatchEl = el('div', 'hud-dispatch', null, tr);
    this.dispatchTitle = el('div', 'hud-dispatch-title', 'DISPATCH', this.dispatchEl);
    this.dispatchList = el('div', 'hud-dispatch-list', null, this.dispatchEl);
    this.dispatchEmpty = el('div', 'hud-dispatch-empty', 'No active units — streets are quiet', this.dispatchEl);

    // Bottom-left: crew + radio.
    const bl = el('div', 'hud-bl', null, this.root);
    this.crewEl = el('div', 'hud-crew', null, bl);
    this.crewSlots = [];
    for (let i = 0; i < 3; i++) {
      const slot = el('div', 'hud-crew-slot', null, this.crewEl);
      const av = el('div', 'hud-crew-avatar', '??', slot);
      const nm = el('div', 'hud-crew-name', '', slot);
      const ab = el('div', 'hud-crew-ability', '', slot);
      const st = el('div', 'hud-crew-state', 'READY', slot);
      this.crewSlots.push({ slot, av, nm, ab, st });
    }
    this.radioEl = el('div', 'hud-radio', 'ALBA FM 98.1 — Golden Hour Drive', bl);

    // Bottom-center: dialogue + hint.
    const bc = el('div', 'hud-bc', null, this.root);
    this.dialogueEl = el('div', 'hud-dialogue', null, bc);
    this.dialogueName = el('div', 'hud-dialogue-name', '', this.dialogueEl);
    this.dialogueLine = el('div', 'hud-dialogue-line', '', this.dialogueEl);
    this.dialogueEl.style.display = 'none';
    this.hintEl = el('div', 'hud-hint', '', bc);

    // Bottom-right: speedo, nitro, weapons.
    const br = el('div', 'hud-br', null, this.root);
    this.speedoEl = el('div', 'hud-speedo', null, br);
    this.speedNum = el('div', 'hud-speed-num', '0', this.speedoEl);
    this.speedUnit = el('div', 'hud-speed-unit', 'km/h', this.speedoEl);
    this.carNameEl = el('div', 'hud-carname', 'On foot', this.speedoEl);
    this.condBar = el('div', 'hud-rpbar cond', null, this.speedoEl);
    this.condFill = el('div', 'hud-rpfill cond', null, this.condBar);
    this.nitroWrap = el('div', 'hud-nitro', null, br);
    el('div', 'hud-nitro-label', 'NITRO [Shift]', null, this.nitroWrap);
    this.nitroBar = el('div', 'hud-rpbar nitro', null, this.nitroWrap);
    this.nitroFill = el('div', 'hud-rpfill nitro', null, this.nitroBar);
    this.weaponsEl = el('div', 'hud-weapons', null, br);
    this.weaponSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = el('div', 'hud-weapon', null, this.weaponsEl);
      const nm = el('div', 'hud-weapon-name', '', slot);
      const am = el('div', 'hud-weapon-ammo', '', slot);
      this.weaponSlots.push({ slot, nm, am });
    }

    // Weapon wheel overlay (hold Tab).
    this.wheelEl = el('div', 'hud-wheel', null, this.root);
    this.wheelEl.style.display = 'none';
    this.wheelTitle = el('div', 'hud-wheel-title', 'WEAPONS — hold Tab, pick 1-6', this.wheelEl);
    this.wheelSlots = [];
    for (let i = 0; i < 6; i++) {
      const s = el('div', 'hud-wheel-slot', null, this.wheelEl);
      const nm = el('div', 'hud-wheel-name', '', s);
      const am = el('div', 'hud-wheel-ammo', '', s);
      this.wheelSlots.push({ s, nm, am });
    }

    // Garage shop panel.
    this.shopEl = el('div', 'hud-shop', null, this.root);
    this.shopEl.style.display = 'none';
    el('div', 'hud-shop-title', 'ALBA GARAGE — Upgrades', null, this.shopEl);
    this.shopCash = el('div', 'hud-shop-cash', '', this.shopEl);
    this.shopList = el('div', 'hud-shop-list', null, this.shopEl);
    this.shopMsg = el('div', 'hud-shop-msg', '', this.shopEl);
    const shopClose = el('button', 'hud-shop-close', 'Close [G]', this.shopEl);
    shopClose.addEventListener('click', () => { if (this.onShopClose) this.onShopClose(); });

    // Toast.
    this.toastEl = el('div', 'hud-toast', '', this.root);
    this.toastEl.style.display = 'none';
    this.toastTimer = 0;
  }

  setText(node, key, value) {
    if (this._cache[key] !== value) {
      this._cache[key] = value;
      node.textContent = value;
    }
  }

  update(s, dt) {
    // Stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? STAR : '☆';
    this.setText(this.starsEl, 'stars', stars);
    this.starsEl.classList.toggle('hot', s.wanted >= 3);
    this.setText(this.cashEl, 'cash', fmtCash(s.cash));
    this.setText(this.rankEl, 'rank', s.rankName);
    this.rpFill.style.width = Math.round(s.rpProgress * 100) + '%';
    this.setText(this.rpText, 'rp', s.rp + ' RP' + (s.nextRank ? ' · next: ' + s.nextRank : ' · MAX RANK'));
    this.setText(this.districtEl, 'district', '▸ ' + s.district);
    this.standFill.style.width = s.standing + '%';
    this.setText(this.standText, 'standing', 'Standing ' + s.standing + ' / 100');

    // Mission banner.
    if (s.mission) {
      this.missionEl.style.display = 'block';
      this.setText(this.missionTitle, 'mt', s.mission.code + ' — ' + s.mission.name);
      this.setText(this.missionGiver, 'mg', s.mission.giver + ' · ' + s.mission.role);
      this.setText(this.missionStage, 'ms', s.stageText || '');
      this.setText(this.missionTimer, 'mtimer', s.missionTimer || '');
      this.missionFill.style.width = Math.round((s.stageProgress || 0) * 100) + '%';
      this.missionBar.style.display = s.stageProgress > 0 ? 'block' : 'none';
    } else {
      this.missionEl.style.display = 'none';
    }
    this.insightEl.style.display = s.inSight ? 'block' : 'none';

    // Dispatch.
    if (s.dispatch && s.dispatch.length) {
      this.dispatchList.style.display = 'block';
      this.dispatchEmpty.style.display = 'none';
      const key = s.dispatch.map(u => u.code + u.status + Math.round(u.dist)).join('|');
      if (this._cache.dispatch !== key) {
        this._cache.dispatch = key;
        this.dispatchList.innerHTML = '';
        for (const u of s.dispatch) {
          const row = el('div', 'hud-unit', null, this.dispatchList);
          el('span', 'hud-unit-code', u.code, row);
          el('span', 'hud-unit-role', u.role, row);
          const badge = el('span', 'hud-unit-badge', u.status, row);
          badge.style.background = u.color;
          el('span', 'hud-unit-dist', Math.round(u.dist) + 'm', row);
        }
      }
    } else {
      this.dispatchList.style.display = 'none';
      this.dispatchEmpty.style.display = 'block';
    }
    this.setText(this.clockEl, 'clock', s.clockText);

    // Speedo.
    this.setText(this.speedNum, 'speed', String(s.speedKmh));
    this.setText(this.carNameEl, 'carname', s.carName || 'On foot');
    this.condFill.style.width = s.condition + '%';
    this.condFill.style.background = s.condition > 50 ? '#3ad86a' : (s.condition > 25 ? '#ffb02a' : '#ff3a3a');
    this.nitroWrap.style.display = s.nitroOwned ? 'block' : 'none';
    this.nitroFill.style.width = s.nitro + '%';
    this.nitroFill.classList.toggle('boosting', !!s.nitroActive);

    // Weapons.
    for (let i = 0; i < 6; i++) {
      const w = s.weapons[i];
      const slot = this.weaponSlots[i];
      slot.slot.classList.toggle('selected', i === s.selectedWeapon);
      slot.slot.classList.toggle('locked', !w.unlocked);
      this.setText(slot.nm, 'wn' + i, (i + 1) + ' ' + w.name);
      this.setText(slot.am, 'wa' + i, w.unlocked ? (w.ammo + ' ammo') : 'LOCKED · ' + (w.unlockJob || ''));
    }

    // Crew.
    for (let i = 0; i < 3; i++) {
      const c = s.crew[i];
      const slot = this.crewSlots[i];
      slot.av.style.background = c.color;
      this.setText(slot.av, 'ca' + i, c.initials);
      this.setText(slot.nm, 'cn' + i, c.name);
      this.setText(slot.ab, 'cb' + i, c.ability + ' [' + c.key + ']');
      this.setText(slot.st, 'cs' + i, c.ready ? 'READY' : Math.ceil(c.cooldown) + 's');
      slot.st.classList.toggle('ready', c.ready);
    }

    // Radio + dialogue + hint.
    this.setText(this.radioEl, 'radio', s.station + ' — ' + s.song);
    if (s.dialogue) {
      this.dialogueEl.style.display = 'block';
      this.setText(this.dialogueName, 'dn', s.dialogue.name + ' · ' + s.dialogue.role);
      this.setText(this.dialogueLine, 'dl', s.dialogue.line);
    } else {
      this.dialogueEl.style.display = 'none';
    }
    this.setText(this.hintEl, 'hint', s.hint || '');

    // Toast timer.
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.display = 'none';
    }

    this.drawMinimap(s.minimap);
  }

  drawMinimap(m) {
    if (!m) return;
    const ctx = this.mapCtx;
    const W = 200, H = 200;
    ctx.clearRect(0, 0, W, H);
    // World -> map: x [-300,300] -> [6,194], z [-300,560] -> [194,6].
    const mx = x => 100 + (x / 320) * 94;
    const mz = z => 100 - ((z - 130) / 430) * 94;
    // Sea + beach.
    ctx.fillStyle = '#123a4a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a6a7a'; ctx.fillRect(0, 0, W, mz(300));
    ctx.fillStyle = '#e8c878'; ctx.fillRect(0, mz(300), W, mz(235) - mz(300));
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(0, mz(235), W, H - mz(235));
    // Island.
    ctx.fillStyle = '#6a6250';
    ctx.beginPath(); ctx.arc(mx(0), mz(520), 20, 0, Math.PI * 2); ctx.fill();
    // Roads.
    ctx.strokeStyle = '#8a8a92'; ctx.lineWidth = 2;
    for (const c of [-240, -160, -80, 0, 80, 160, 240]) {
      ctx.beginPath(); ctx.moveTo(mx(c), mz(-300)); ctx.lineTo(mx(c), mz(300)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx(-300), mz(c)); ctx.lineTo(mx(300), mz(c)); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(mx(0), mz(300)); ctx.lineTo(mx(0), mz(520)); ctx.stroke();
    // Route line to the mission target.
    if (m.target) {
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(mx(m.px), mz(m.pz));
      ctx.lineTo(mx(m.tx), mz(m.tz));
      ctx.stroke();
      ctx.setLineDash([]);
      // Mission marker.
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(mx(m.tx), mz(m.tz), 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx(m.tx), mz(m.tz), 9, 0, Math.PI * 2); ctx.stroke();
    }
    // Police dots.
    ctx.fillStyle = '#ff3a3a';
    for (const p of m.police || []) {
      ctx.beginPath(); ctx.arc(mx(p.x), mz(p.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(mx(m.px), mz(m.pz));
    ctx.rotate(m.heading);
    ctx.fillStyle = '#2ad8c8';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Border.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(100, 100, 97, 0, Math.PI * 2); ctx.stroke();
  }

  showWheel(weapons, selected) {
    this.wheelEl.style.display = 'flex';
    for (let i = 0; i < 6; i++) {
      const w = weapons[i];
      const slot = this.wheelSlots[i];
      slot.s.classList.toggle('selected', i === selected);
      slot.s.classList.toggle('locked', !w.unlocked);
      slot.nm.textContent = (i + 1) + ' · ' + w.name;
      slot.am.textContent = w.unlocked ? w.ammo + ' ammo' : 'LOCKED';
    }
  }
  hideWheel() { this.wheelEl.style.display = 'none'; }

  showShop(upgrades, owned, cash, onBuy) {
    this.shopEl.style.display = 'block';
    this.shopCash.textContent = 'Cash: ' + fmtCash(cash) + ' — press G to close';
    this.shopList.innerHTML = '';
    for (const up of upgrades) {
      const row = el('div', 'hud-shop-row', null, this.shopList);
      el('div', 'hud-shop-name', up.name, row);
      el('div', 'hud-shop-desc', up.desc, row);
      const isOwned = up.id !== 'repair' && owned[up.id];
      const btn = el('button', 'hud-shop-buy', isOwned ? 'INSTALLED' : fmtCash(up.price), row);
      btn.disabled = isOwned;
      btn.addEventListener('click', () => onBuy(up.id));
    }
  }
  hideShop() { this.shopEl.style.display = 'none'; }
  setShopMessage(msg) { this.shopMsg.textContent = msg || ''; }

  toast(msg, seconds) {
    this.toastEl.textContent = msg;
    this.toastEl.style.display = 'block';
    this.toastTimer = seconds || 3;
  }
}
