// hud.js — the in-game HUD. Same DOM structure and class names as v3 so the
// page CSS applies; v4 adds the AIR UNIT banner, rank ladder, dialogue
// portrait, briefing panel, locked wheel slots, dispatch roles/distances,
// and crew cards. Inline styles only where v4 adds a new element.

const ROLE_WORDS = {
  PURSUIT: 'Interceptor',
  RAMMING: 'Charger',
  FLANKING: 'Flanker',
  SPOTLIGHT: 'Air Unit',
  ROADBLOCK: 'Blocker',
  FIRING: 'Marksman',
  RESPONDING: 'Patrol',
};

const SPEAKER_COLORS = {
  'Don Rafael Alba': '#d8a24a',
  'Kiki Maro': '#2ad8c8',
  'Dario Voss': '#ff8a2a',
  'Lena Kade': '#ff4a6a',
  'Ria Solano': '#7ad8ff',
  'Sable Quinn': '#b46aff',
  'Marco Venn': '#8a6a3a',
  'Iris Vale': '#ff7ad8',
  'Rex Calder': '#ffd76a',
  'Gus Ferran': '#9a9a9a',
};

function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export class Hud {
  constructor() {
    this.root = null;
    this.onShopClose = null;
    this._shopBuy = null;
    this._toastTimer = 0;
  }

  build() {
    const root = document.getElementById('hud');
    this.root = root;
    root.innerHTML = '';

    // ---- top-left: stars, cash, rank, ladder, district ----
    const tl = el('div', 'hud-tl', root);
    this.starsEl = el('div', 'hud-stars', tl);
    this.cashEl = el('div', 'hud-cash', tl);
    this.rankEl = el('div', 'hud-rank', tl);
    const rpbar = el('div', 'hud-rpbar', tl);
    this.rpFillEl = el('div', 'hud-rpfill', rpbar);
    this.rpTextEl = el('div', 'hud-rptext', tl);
    // Rank ladder: named tiers, filled pips + one empty.
    this.ladderEl = el('div', 'hud-ladder', tl);
    this.ladderEl.style.cssText = 'display:flex;gap:6px;margin-top:4px;font-size:10px;letter-spacing:0.5px;';
    this.districtEl = el('div', 'hud-district', tl);
    const standbar = el('div', 'hud-rpbar', tl);
    this.standFillEl = el('div', 'hud-rpfill stand', standbar);
    this.standTextEl = el('div', 'hud-rptext', tl);

    // ---- top-center: mission card, IN SIGHT, AIR UNIT ----
    const tc = el('div', 'hud-tc', root);
    this.missionEl = el('div', 'hud-mission', tc);
    this.missionTitleEl = el('div', 'hud-mission-title', this.missionEl);
    this.missionGiverEl = el('div', 'hud-mission-giver', this.missionEl);
    this.missionStageEl = el('div', 'hud-mission-stage', this.missionEl);
    const mbar = el('div', 'hud-rpbar mission', this.missionEl);
    this.missionFillEl = el('div', 'hud-rpfill', mbar);
    this.missionTimerEl = el('div', 'hud-mission-timer', this.missionEl);
    this.insightEl = el('div', 'hud-insight', tc);
    this.insightEl.textContent = 'IN SIGHT';
    // Red AIR UNIT DEPLOYED banner (v4).
    this.airEl = el('div', 'hud-air', tc);
    this.airEl.textContent = '▲ AIR UNIT DEPLOYED';
    this.airEl.style.cssText = 'display:none;background:#c81e1e;color:#fff;font-weight:800;text-align:center;padding:4px 10px;border-radius:4px;margin-top:6px;font-size:13px;letter-spacing:1px;';

    // ---- top-right: minimap, clock, dispatch ----
    const tr = el('div', 'hud-tr', root);
    this.minimapEl = el('canvas', 'hud-minimap', tr);
    this.minimapEl.width = 200;
    this.minimapEl.height = 200;
    this.clockEl = el('div', 'hud-clock', tr);
    this.dispatchEl = el('div', 'hud-dispatch', tr);
    el('div', 'hud-dispatch-title', this.dispatchEl).textContent = 'DISPATCH';
    this.dispatchListEl = el('div', 'hud-dispatch-list', this.dispatchEl);
    this.dispatchEmptyEl = el('div', 'hud-dispatch-empty', this.dispatchEl);
    this.dispatchEmptyEl.textContent = 'No active units — streets are quiet';

    // ---- bottom-left: crew cards, radio ----
    const bl = el('div', 'hud-bl', root);
    this.crewEl = el('div', 'hud-crew', bl);
    this.crewSlots = [];
    for (let i = 0; i < 3; i++) {
      const slot = el('div', 'hud-crew-slot', this.crewEl);
      const av = el('div', 'hud-crew-avatar', slot);
      const nm = el('div', 'hud-crew-name', slot);
      const ab = el('div', 'hud-crew-ability', slot);
      const st = el('div', 'hud-crew-state', slot);
      this.crewSlots.push({ slot, av, nm, ab, st });
    }
    this.radioEl = el('div', 'hud-radio', bl);

    // ---- bottom-center: dialogue, hint ----
    const bc = el('div', 'hud-bc', root);
    this.dialogueEl = el('div', 'hud-dialogue', bc);
    this.dialogueAvatarEl = el('div', 'hud-dialogue-avatar', this.dialogueEl);
    this.dialogueAvatarEl.style.cssText = 'width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#111;flex:0 0 auto;';
    const dtext = el('div', 'hud-dialogue-text', this.dialogueEl);
    this.dialogueNameEl = el('div', 'hud-dialogue-name', dtext);
    this.dialogueLineEl = el('div', 'hud-dialogue-line', dtext);
    this.hintEl = el('div', 'hud-hint', bc);

    // ---- bottom-right: speedo, nitro, weapons ----
    const br = el('div', 'hud-br', root);
    this.speedoEl = el('div', 'hud-speedo', br);
    this.speedNumEl = el('div', 'hud-speed-num', this.speedoEl);
    this.speedUnitEl = el('div', 'hud-speed-unit', this.speedoEl);
    this.speedUnitEl.textContent = 'km/h';
    this.carNameEl = el('div', 'hud-carname', this.speedoEl);
    const cbar = el('div', 'hud-rpbar cond', this.speedoEl);
    this.condFillEl = el('div', 'hud-rpfill', cbar);
    this.nitroEl = el('div', 'hud-nitro', br);
    this.weaponsEl = el('div', 'hud-weapons', br);
    this.weaponSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = el('div', 'hud-weapon-slot', this.weaponsEl);
      const nm = el('div', 'hud-weapon-name', slot);
      const am = el('div', 'hud-weapon-ammo', slot);
      this.weaponSlots.push({ slot, nm, am });
    }

    // ---- weapon wheel (center overlay, hidden by default) ----
    this.wheelEl = el('div', 'hud-wheel', root);
    this.wheelEl.style.display = 'none';
    const wtitle = el('div', 'hud-wheel-title', this.wheelEl);
    wtitle.textContent = 'WEAPONS — hold Tab, pick 1-6';
    this.wheelSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = el('div', 'hud-wheel-slot', this.wheelEl);
      const nm = el('div', 'hud-wheel-name', slot);
      const am = el('div', 'hud-wheel-ammo', slot);
      const lk = el('div', 'hud-wheel-lock', slot);
      lk.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2.4"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
      this.wheelSlots.push({ slot, nm, am, lk });
    }

    // ---- garage shop (center overlay, hidden by default) ----
    this.shopEl = el('div', 'hud-shop', root);
    this.shopEl.style.display = 'none';
    const stitle = el('div', 'hud-shop-title', this.shopEl);
    stitle.textContent = 'GARAGE';
    this.shopCashEl = el('div', 'hud-shop-cash', this.shopEl);
    this.shopListEl = el('div', 'hud-shop-list', this.shopEl);
    this.shopMsgEl = el('div', 'hud-shop-msg', this.shopEl);
    const sclose = el('button', 'hud-shop-close', this.shopEl);
    sclose.textContent = 'Close [G]';
    sclose.addEventListener('click', () => {
      this.hideShop();
      if (this.onShopClose) this.onShopClose();
    });

    // ---- mission briefing panel (left-middle overlay, hidden by default) ----
    this.briefingEl = el('div', 'hud-briefing', root);
    this.briefingEl.style.cssText = 'display:none;position:absolute;left:24px;top:50%;transform:translateY(-50%);width:300px;background:rgba(12,10,8,0.88);border:2px solid #d8a24a;border-radius:10px;padding:14px 16px;color:#f2e8d8;z-index:30;';
    this.briefingTitleEl = el('div', 'hud-briefing-title', this.briefingEl);
    this.briefingTitleEl.style.cssText = 'font-size:13px;font-weight:800;letter-spacing:1.5px;color:#d8a24a;';
    this.briefingJobEl = el('div', 'hud-briefing-job', this.briefingEl);
    this.briefingJobEl.style.cssText = 'font-size:19px;font-weight:800;margin-top:4px;';
    this.briefingGiverEl = el('div', 'hud-briefing-giver', this.briefingEl);
    this.briefingGiverEl.style.cssText = 'font-size:12px;color:#c8b898;margin-top:2px;';
    this.briefingObjEl = el('div', 'hud-briefing-objectives', this.briefingEl);
    this.briefingObjEl.style.cssText = 'font-size:13px;line-height:1.7;margin-top:10px;';
    this.briefingRewardEl = el('div', 'hud-briefing-reward', this.briefingEl);
    this.briefingRewardEl.style.cssText = 'font-size:13px;font-weight:700;color:#7ad87a;margin-top:10px;';

    // ---- toast ----
    this.toastEl = el('div', 'hud-toast', root);
    this.toastEl.style.display = 'none';
  }

  setText(node, key, text) {
    if (!node) return;
    if (node.dataset.k !== key) {
      node.dataset.k = key;
      node.textContent = text;
    }
  }

  update(vm, dt) {
    if (!this.root) return;
    // Stars (5 = max wanted).
    const stars = '★'.repeat(vm.wanted) + '☆'.repeat(Math.max(0, 5 - vm.wanted));
    this.setText(this.starsEl, 'stars' + stars, stars);
    this.starsEl.classList.toggle('hot', vm.wanted > 0);
    this.setText(this.cashEl, 'cash' + vm.cash, '$' + vm.cash.toLocaleString('en-US'));
    this.setText(this.rankEl, 'rank' + vm.rankName, vm.rankName);
    this.rpFillEl.style.width = Math.round((vm.rpProgress || 0) * 100) + '%';
    this.setText(this.rpTextEl, 'rp' + vm.rp + vm.nextRank, vm.rp + ' RP · next: ' + (vm.nextRank || 'MAX RANK'));
    // Rank ladder: named tiers, filled pips + one empty.
    const tiers = ['Wheelman', 'Street Hustler', 'Fixer', 'Ghost of Alba', 'King of Alba'];
    const cur = tiers.indexOf(vm.rankName);
    let ladder = '';
    for (let i = 0; i < tiers.length; i++) {
      const filled = i <= cur;
      ladder += '<span style="color:' + (filled ? '#ffd76a' : '#8a7a5a') + '">' + (filled ? '●' : '○') + ' ' + tiers[i] + '</span>';
    }
    if (this.ladderEl.dataset.k !== ladder) {
      this.ladderEl.dataset.k = ladder;
      this.ladderEl.innerHTML = ladder;
    }
    this.setText(this.districtEl, 'dist' + vm.district, '▸ ' + vm.district);
    this.standFillEl.style.width = Math.round(((vm.standing || 0) / 100) * 100) + '%';
    this.setText(this.standTextEl, 'stand' + vm.standing, 'Standing ' + (vm.standing || 0) + ' / 100');

    // Mission card.
    if (vm.mission) {
      this.missionEl.style.display = 'block';
      this.setText(this.missionTitleEl, 'mt' + vm.mission.code, vm.mission.code + ' — ' + vm.mission.name);
      this.setText(this.missionGiverEl, 'mg' + vm.mission.giver, vm.mission.giver + ' · ' + (vm.mission.role || ''));
      this.setText(this.missionStageEl, 'ms' + vm.stageText, vm.stageText || '');
      this.missionFillEl.style.width = Math.round((vm.stageProgress || 0) * 100) + '%';
      this.setText(this.missionTimerEl, 'mtm' + (vm.missionTimer || ''), vm.missionTimer || '');
    } else {
      this.missionEl.style.display = 'none';
    }
    this.insightEl.style.display = vm.inSight ? 'block' : 'none';
    this.airEl.style.display = vm.heli ? 'block' : 'none';

    // Clock + dispatch.
    this.setText(this.clockEl, 'clock' + vm.clockText, vm.clockText || '');
    const units = vm.dispatch || [];
    this.dispatchEmptyEl.style.display = units.length ? 'none' : '';
    const dkey = units.map((u) => u.code + u.status + Math.round(u.dist)).join('|');
    if (this.dispatchListEl.dataset.k !== dkey) {
      this.dispatchListEl.dataset.k = dkey;
      this.dispatchListEl.innerHTML = '';
      for (const u of units) {
        const row = el('div', 'hud-unit', this.dispatchListEl);
        const code = el('span', 'hud-unit-code', row);
        code.textContent = u.code;
        const role = el('span', 'hud-unit-role', row);
        role.textContent = u.role || ROLE_WORDS[u.status] || u.status;
        const badge = el('span', 'hud-unit-badge', row);
        badge.textContent = u.status;
        badge.style.background = u.color || '#4a8aff';
        const dist = el('span', 'hud-unit-dist', row);
        dist.textContent = Math.round(u.dist) + 'm';
      }
    }

    // Crew cards.
    for (let i = 0; i < 3; i++) {
      const c = (vm.crew || [])[i];
      const slot = this.crewSlots[i];
      if (!c) { slot.slot.style.display = 'none'; continue; }
      slot.slot.style.display = '';
      slot.av.textContent = c.initials || initials(c.name);
      slot.av.style.background = c.color || '#888';
      this.setText(slot.nm, 'cn' + c.name, c.name);
      this.setText(slot.ab, 'ca' + c.ability, c.ability + ' [' + c.key + ']');
      const state = c.ready ? 'READY' : Math.ceil(c.cooldown || 0) + 's';
      this.setText(slot.st, 'cs' + state, state);
      slot.st.style.color = c.ready ? '#7ad87a' : '#c8a24a';
    }

    this.setText(this.radioEl, 'radio' + vm.station + vm.song, (vm.station || '') + ' — ' + (vm.song || ''));
    // Dialogue with portrait avatar.
    if (vm.dialogue) {
      this.dialogueEl.style.display = 'block';
      this.dialogueAvatarEl.textContent = initials(vm.dialogue.name);
      this.dialogueAvatarEl.style.background = SPEAKER_COLORS[vm.dialogue.name] || '#888';
      this.setText(this.dialogueNameEl, 'dn' + vm.dialogue.name, vm.dialogue.name + (vm.dialogue.role ? ' · ' + vm.dialogue.role : ''));
      this.setText(this.dialogueLineEl, 'dl' + vm.dialogue.line, vm.dialogue.line);
    } else {
      this.dialogueEl.style.display = 'none';
    }
    this.setText(this.hintEl, 'hint' + (vm.hint || ''), vm.hint || '');

    // Speedo + car + condition + nitro.
    this.setText(this.speedNumEl, 'sp' + Math.round(vm.speedKmh || 0), String(Math.round(vm.speedKmh || 0)));
    this.setText(this.carNameEl, 'car' + (vm.carName || ''), vm.carName || '');
    this.condFillEl.style.width = Math.round(vm.condition || 0) + '%';
    this.condFillEl.style.background = (vm.condition || 0) > 50 ? '#7ad87a' : (vm.condition || 0) > 25 ? '#ffd76a' : '#ff4a4a';
    if (vm.nitroOwned) {
      this.nitroEl.style.display = '';
      this.setText(this.nitroEl, 'nitro' + Math.round(vm.nitro || 0) + (vm.nitroActive ? 'a' : ''), 'NITRO ' + Math.round(vm.nitro || 0) + '%' + (vm.nitroActive ? ' — ACTIVE' : ''));
    } else {
      this.nitroEl.style.display = 'none';
    }

    // Weapon slots (bottom-right).
    for (let i = 0; i < 6; i++) {
      const w = (vm.weapons || [])[i];
      const slot = this.weaponSlots[i];
      if (!w) { slot.slot.style.display = 'none'; continue; }
      slot.slot.style.display = '';
      slot.slot.classList.toggle('selected', i === vm.selectedWeapon);
      slot.slot.style.opacity = w.unlocked ? '1' : '0.6';
      this.setText(slot.nm, 'wn' + w.name, (i + 1) + ' ' + w.name);
      this.setText(slot.am, 'wa' + w.name + (w.unlocked ? w.ammo : 'lock'), w.unlocked ? w.ammo + ' ammo' : 'LOCKED · M11');
    }

    // Briefing panel (shot 2 only).
    if (vm.briefing) {
      this.briefingEl.style.display = 'block';
      this.setText(this.briefingTitleEl, 'bt' + vm.briefing.title, 'MISSION BRIEFING');
      this.setText(this.briefingJobEl, 'bj' + vm.briefing.title, vm.briefing.title);
      this.setText(this.briefingGiverEl, 'bg' + vm.briefing.giver, vm.briefing.giver + ' · ' + (vm.briefing.role || ''));
      const objs = vm.briefing.objectives || [];
      const okey = objs.join('|');
      if (this.briefingObjEl.dataset.k !== okey) {
        this.briefingObjEl.dataset.k = okey;
        this.briefingObjEl.innerHTML = objs.map((o, i) => (i === 0 ? '▸ ' : '○ ') + o).join('<br>');
      }
      this.setText(this.briefingRewardEl, 'br' + vm.briefing.reward, 'Reward ' + (vm.briefing.reward || '') + ' · Cash on hand $' + (vm.briefing.cash || 0).toLocaleString('en-US'));
    } else {
      this.briefingEl.style.display = 'none';
    }

    if (this._toastTimer > 0) {
      this._toastTimer -= dt || 0;
      if (this._toastTimer <= 0) this.toastEl.style.display = 'none';
    }
    if (vm.minimap) this.drawMinimap(vm.minimap);
  }

  drawMinimap(mm) {
    const cv = this.minimapEl;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    // Circular mask.
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0e1a24';
    ctx.fillRect(0, 0, W, H);
    const mapX = (x) => ((x + 300) / 600) * W;
    const mapZ = (z) => ((z + 300) / 860) * H;
    // Water (south).
    ctx.fillStyle = '#0e5a6a';
    ctx.fillRect(0, mapZ(300), W, H - mapZ(300));
    // Island.
    ctx.fillStyle = '#2a3a2a';
    ctx.beginPath();
    ctx.arc(mapX(0), mapZ(520), 22, 0, Math.PI * 2);
    ctx.fill();
    // Roads (grid).
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = 2;
    for (const rx of [-240, -160, -80, 0, 80, 160, 240]) {
      ctx.beginPath(); ctx.moveTo(mapX(rx), 0); ctx.lineTo(mapX(rx), H); ctx.stroke();
    }
    for (const rz of [-240, -160, -80, 0, 80, 160, 200, 220, 240]) {
      ctx.beginPath(); ctx.moveTo(0, mapZ(rz)); ctx.lineTo(W, mapZ(rz)); ctx.stroke();
    }
    // Route to target.
    if (mm.tx !== undefined && mm.tz !== undefined) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(mapX(mm.px), mapZ(mm.pz));
      ctx.lineTo(mapX(mm.tx), mapZ(mm.tz));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(mapX(mm.tx), mapZ(mm.tz), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police dots.
    ctx.fillStyle = '#ff4a4a';
    for (const p of (mm.police || [])) {
      ctx.beginPath();
      ctx.arc(mapX(p.x), mapZ(p.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(mapX(mm.px), mapZ(mm.pz));
    ctx.rotate(-(mm.heading || 0));
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring.
    ctx.strokeStyle = '#d8a24a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // position: 'right' docks the wheel on the right edge (combat shot, so the
  // player stays visible); anything else leaves it centered (page CSS).
  showWheel(weapons, selected, position) {
    this.wheelEl.style.display = 'flex';
    if (position === 'right') {
      this.wheelEl.style.left = 'auto';
      this.wheelEl.style.right = '24px';
      this.wheelEl.style.top = '50%';
      this.wheelEl.style.transform = 'translateY(-50%)';
    } else {
      this.wheelEl.style.left = '';
      this.wheelEl.style.right = '';
      this.wheelEl.style.top = '';
      this.wheelEl.style.transform = '';
    }
    for (let i = 0; i < 6; i++) {
      const w = (weapons || [])[i];
      const slot = this.wheelSlots[i];
      if (!w) { slot.slot.style.display = 'none'; continue; }
      slot.slot.style.display = '';
      slot.slot.classList.toggle('selected', i === selected);
      slot.slot.style.opacity = w.unlocked ? '1' : '0.6';
      this.setText(slot.nm, 'wwn' + w.name, (i + 1) + ' ' + w.name);
      this.setText(slot.am, 'wwa' + w.name + (w.unlocked ? w.ammo : 'lock'), w.unlocked ? w.ammo + ' ammo' : 'LOCKED · M11');
      slot.lk.style.display = w.unlocked ? 'none' : '';
    }
  }

  hideWheel() {
    this.wheelEl.style.display = 'none';
  }

  showShop(items, cash, owned, onBuy) {
    this.shopEl.style.display = 'block';
    this._shopBuy = onBuy;
    this.setText(this.shopCashEl, 'sc' + cash, 'Cash: $' + cash.toLocaleString('en-US'));
    const key = items.map((it) => it.id + (owned && owned[it.id] ? '1' : '0')).join('|');
    if (this.shopListEl.dataset.k !== key) {
      this.shopListEl.dataset.k = key;
      this.shopListEl.innerHTML = '';
      for (const it of items) {
        const row = el('div', 'hud-shop-row', this.shopListEl);
        const nm = el('span', 'hud-shop-name', row);
        const price = it.price ?? it.cost ?? 0;
        nm.textContent = it.name + ' — $' + price.toLocaleString('en-US');
        const btn = el('button', 'hud-shop-buy', row);
        const has = owned && owned[it.id];
        btn.textContent = has ? 'OWNED' : 'BUY';
        btn.disabled = !!has;
        btn.addEventListener('click', () => {
          if (this._shopBuy) this._shopBuy(it.id);
        });
      }
    }
  }

  hideShop() {
    this.shopEl.style.display = 'none';
  }

  setShopMessage(msg) {
    this.setText(this.shopMsgEl, 'sm' + msg, msg);
  }

  toast(text, dur) {
    this.toastEl.style.display = '';
    this.setText(this.toastEl, 'toast' + text, text);
    this._toastTimer = dur || 3;
  }
}
