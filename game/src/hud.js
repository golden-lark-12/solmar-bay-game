// hud.js — the in-game HUD. Same DOM structure and class names as v3 so the page CSS applies; v4 adds the AIR UNIT banner, rank ladder, dialogue portrait, briefing panel, locked wheel slots, dispatch roles/distances, and crew cards. Inline styles only where v4 adds a new element.

const ROLE_WORDS = { PURSUIT: 'Interceptor', RAMMING: 'Charger', FLANKING: 'Flanker', SPOTLIGHT: 'Air Unit', ROADBLOCK: 'Blocker', FIRING: 'Marksman', RESPONDING: 'Patrol' };

const SPEAKER_COLORS = { 'Don Rafael Alba': '#d8a24a', 'Kiki Maro': '#2ad8c8', 'Dario Voss': '#ff8a2a', 'Lena Kade': '#ff4a6a', 'Ria Solano': '#7ad8ff', 'Sable Quinn': '#b46aff', 'Marco Venn': '#8a6a3a', 'Iris Vale': '#ff7ad8', 'Rex Calder': '#ffd76a', 'Gus Ferran': '#9a9a9a' };

function initials(name) { return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }

export class Hud {
  constructor() { this.root = null; this.onShopClose = null; this._shopBuy = null; this._toastTimer = 0; }

  build() {
    const root = document.getElementById('hud');
    if (!root) return;
    this.root = root;
    root.innerHTML = '';

    // Top-left: stars, cash, rank, RP, ladder, district, standing.
    const tl = el('div', 'hud-tl', this.root);
    this.starsEl = el('div', 'hud-stars', tl);
    this.cashEl = el('div', 'hud-cash', tl);
    this.rankEl = el('div', 'hud-rank', tl);
    const rpBar = el('div', 'hud-rpbar', tl);
    this.rpFillEl = el('div', 'hud-rpfill', rpBar);
    this.rpTextEl = el('div', 'hud-rptext', tl);
    this.ladderEl = el('div', 'hud-ladder', tl);
    this.ladderEl.style.cssText = 'display:flex;gap:6px;margin-top:4px;font-size:10px;letter-spacing:0.5px;';
    this.districtEl = el('div', 'hud-district', tl);
    const standBar = el('div', 'hud-rpbar', tl);
    this.standFillEl = el('div', 'hud-rpfill stand', standBar);
    this.standTextEl = el('div', 'hud-rptext', tl);

    // Top-center: mission card, IN SIGHT, AIR UNIT banner.
    const tc = el('div', 'hud-tc', this.root);
    this.missionEl = el('div', 'hud-mission', tc);
    this.missionTitleEl = el('div', 'hud-mission-title', this.missionEl);
    this.missionGiverEl = el('div', 'hud-mission-giver', this.missionEl);
    this.missionStageEl = el('div', 'hud-mission-stage', this.missionEl);
    const missionBar = el('div', 'hud-rpbar mission', this.missionEl);
    this.missionFillEl = el('div', 'hud-rpfill', missionBar);
    this.missionTimerEl = el('div', 'hud-mission-timer', this.missionEl);
    this.insightEl = el('div', 'hud-insight', tc);
    this.insightEl.textContent = 'IN SIGHT';
    this.airEl = el('div', 'hud-air', tc);
    this.airEl.textContent = '▲ AIR UNIT DEPLOYED';
    this.airEl.style.cssText = 'display:none;background:#c81e1e;color:#fff;font-weight:800;text-align:center;padding:4px 10px;border-radius:4px;margin-top:6px;font-size:13px;letter-spacing:1px;';

    // Top-right: minimap, clock, dispatch.
    const tr = el('div', 'hud-tr', this.root);
    this.minimapEl = el('canvas', 'hud-minimap', tr);
    this.minimapEl.width = 200;
    this.minimapEl.height = 200;
    this.clockEl = el('div', 'hud-clock', tr);
    this.dispatchEl = el('div', 'hud-dispatch', tr);
    const dispatchTitle = el('div', 'hud-dispatch-title', this.dispatchEl);
    dispatchTitle.textContent = 'DISPATCH';
    this.dispatchListEl = el('div', 'hud-dispatch-list', this.dispatchEl);
    this.dispatchEmptyEl = el('div', 'hud-dispatch-empty', this.dispatchEl);
    this.dispatchEmptyEl.textContent = 'No active units — streets are quiet';

    // Bottom-left: crew cards, radio.
    const bl = el('div', 'hud-bl', this.root);
    const crew = el('div', 'hud-crew', bl);
    this.crewSlots = [];
    for (let i = 0; i < 3; i++) {
      const slot = el('div', 'hud-crew-slot', crew);
      const av = el('div', 'hud-crew-avatar', slot);
      const nm = el('div', 'hud-crew-name', slot);
      const ab = el('div', 'hud-crew-ability', slot);
      const st = el('div', 'hud-crew-state', slot);
      this.crewSlots.push({ slot, av, nm, ab, st });
    }
    this.radioEl = el('div', 'hud-radio', bl);

    // Bottom-center: dialogue, hint.
    const bc = el('div', 'hud-bc', this.root);
    this.dialogueEl = el('div', 'hud-dialogue', bc);
    this.dialogueAvatarEl = el('div', 'hud-dialogue-avatar', this.dialogueEl);
    this.dialogueAvatarEl.style.cssText = 'width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#111;flex:0 0 auto;';
    const dialogueText = el('div', 'hud-dialogue-text', this.dialogueEl);
    this.dialogueNameEl = el('div', 'hud-dialogue-name', dialogueText);
    this.dialogueLineEl = el('div', 'hud-dialogue-line', dialogueText);
    this.hintEl = el('div', 'hud-hint', bc);

    // Bottom-right: speedo, nitro, weapons.
    const br = el('div', 'hud-br', this.root);
    const speedo = el('div', 'hud-speedo', br);
    this.speedNumEl = el('div', 'hud-speed-num', speedo);
    const speedUnit = el('div', 'hud-speed-unit', speedo);
    speedUnit.textContent = 'km/h';
    this.carNameEl = el('div', 'hud-carname', speedo);
    const condBar = el('div', 'hud-rpbar cond', speedo);
    this.condFillEl = el('div', 'hud-rpfill', condBar);
    this.nitroEl = el('div', 'hud-nitro', br);
    const weapons = el('div', 'hud-weapons', br);
    this.weaponSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = el('div', 'hud-weapon-slot', weapons);
      const nm = el('div', 'hud-weapon-name', slot);
      const am = el('div', 'hud-weapon-ammo', slot);
      this.weaponSlots.push({ slot, nm, am });
    }

    // Weapon wheel (hidden until Tab).
    this.wheelEl = el('div', 'hud-wheel', this.root);
    this.wheelEl.style.display = 'none';
    const wheelTitle = el('div', 'hud-wheel-title', this.wheelEl);
    wheelTitle.textContent = 'WEAPONS — hold Tab, pick 1-6';
    this.wheelSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = el('div', 'hud-wheel-slot', this.wheelEl);
      const nm = el('div', 'hud-wheel-name', slot);
      const am = el('div', 'hud-wheel-ammo', slot);
      const lk = el('div', 'hud-wheel-lock', slot);
      lk.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2.4"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
      this.wheelSlots.push({ slot, nm, am, lk });
    }

    // Garage shop (hidden until G near the garage).
    this.shopEl = el('div', 'hud-shop', this.root);
    this.shopEl.style.display = 'none';
    const shopTitle = el('div', 'hud-shop-title', this.shopEl);
    shopTitle.textContent = 'GARAGE';
    this.shopCashEl = el('div', 'hud-shop-cash', this.shopEl);
    this.shopListEl = el('div', 'hud-shop-list', this.shopEl);
    this.shopMsgEl = el('div', 'hud-shop-msg', this.shopEl);
    const shopClose = el('button', 'hud-shop-close', this.shopEl);
    shopClose.textContent = 'Close [G]';
    shopClose.addEventListener('click', () => {
      this.hideShop();
      if (this.onShopClose) this.onShopClose();
    });

    // Mission briefing panel (left-center, shown by staged briefing shots).
    this.briefingEl = el('div', 'hud-briefing', this.root);
    this.briefingEl.style.cssText = 'display:none;position:absolute;left:24px;top:50%;transform:translateY(-50%);width:300px;background:rgba(12,10,8,0.88);border:2px solid #d8a24a;border-radius:10px;padding:14px 16px;color:#f2e8d8;z-index:30;';
    this.briefingTitleEl = el('div', 'hud-briefing-title', this.briefingEl);
    this.briefingTitleEl.style.cssText = 'font-size:13px;font-weight:800;letter-spacing:1.5px;color:#d8a24a;';
    this.briefingJobEl = el('div', 'hud-briefing-job', this.briefingEl);
    this.briefingJobEl.style.cssText = 'font-size:19px;font-weight:800;margin-top:4px;';
    this.briefingGiverEl = el('div', 'hud-briefing-giver', this.briefingEl);
    this.briefingGiverEl.style.cssText = 'font-size:12px;color:#c8b898;margin-top:2px;';
    this.briefingObjectivesEl = el('div', 'hud-briefing-objectives', this.briefingEl);
    this.briefingObjectivesEl.style.cssText = 'font-size:13px;line-height:1.7;margin-top:10px;';
    this.briefingRewardEl = el('div', 'hud-briefing-reward', this.briefingEl);
    this.briefingRewardEl.style.cssText = 'font-size:13px;font-weight:700;color:#7ad87a;margin-top:10px;';

    // Toast (transient messages, bottom-center above the hint).
    this.toastEl = el('div', 'hud-toast', this.root);
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

    // Wanted stars.
    const wanted = vm.wanted || 0;
    const stars = '★'.repeat(wanted) + '☆'.repeat(Math.max(0, 5 - wanted));
    this.setText(this.starsEl, 'stars' + stars, stars);
    this.starsEl.classList.toggle('hot', wanted > 0);

    // Cash.
    const cash = vm.cash || 0;
    this.setText(this.cashEl, 'cash' + cash, '$' + cash.toLocaleString('en-US'));

    // Rank + RP.
    this.setText(this.rankEl, 'rank' + vm.rankName, vm.rankName);
    this.rpFillEl.style.width = Math.round((vm.rpProgress || 0) * 100) + '%';
    this.setText(this.rpTextEl, 'rp' + vm.rp + vm.nextRank, vm.rp + ' RP · next: ' + (vm.nextRank || 'MAX RANK'));

    // Rank ladder: filled dots up to the current rank.
    const tiers = ['Wheelman', 'Street Hustler', 'Fixer', 'Ghost of Alba', 'King of Alba'];
    const cur = tiers.indexOf(vm.rankName);
    const lkey = 'ladder' + cur;
    if (this.ladderEl.dataset.k !== lkey) {
      this.ladderEl.dataset.k = lkey;
      this.ladderEl.innerHTML = tiers.map((t, i) => {
        const filled = i <= cur;
        return '<span style="color:' + (filled ? '#ffd76a' : '#8a7a5a') + '">' + (filled ? '●' : '○') + ' ' + t + '</span>';
      }).join('');
    }

    // District. vm.district is ALWAYS a string; never render an object.
    // Defensive normalize: if an object ever slips through, use its name.
    const distRaw = vm.district;
    const distName = (distRaw && typeof distRaw === 'object') ? (distRaw.name || 'The Strand') : (distRaw || '');
    this.setText(this.districtEl, 'dist' + distName, '▸ ' + distName);

    // District standing.
    const standing = vm.standing || 0;
    this.standFillEl.style.width = Math.round((standing / 100) * 100) + '%';
    this.setText(this.standTextEl, 'stand' + standing, 'Standing ' + standing + ' / 100');

    // Mission card.
    if (vm.mission) {
      this.missionEl.style.display = 'block';
      this.setText(this.missionTitleEl, 'mt' + vm.mission.code, vm.mission.code + ' — ' + vm.mission.name);
      this.setText(this.missionGiverEl, 'mg' + vm.mission.giver, vm.mission.giver + ' · ' + (vm.mission.role || ''));
      this.setText(this.missionStageEl, 'ms' + (vm.stageText || ''), vm.stageText || '');
      this.missionFillEl.style.width = Math.round((vm.stageProgress || 0) * 100) + '%';
      this.setText(this.missionTimerEl, 'mtm' + (vm.missionTimer || ''), vm.missionTimer || '');
    } else {
      this.missionEl.style.display = 'none';
    }

    // IN SIGHT + AIR UNIT banners.
    this.insightEl.style.display = vm.inSight ? 'block' : 'none';
    this.airEl.style.display = vm.heli ? 'block' : 'none';

    // Clock.
    const clockText = vm.clockText || '';
    this.setText(this.clockEl, 'clock' + clockText, clockText);

    // Dispatch: named units with roles, status badges, distances.
    const units = vm.dispatch || [];
    this.dispatchEmptyEl.style.display = units.length ? 'none' : '';
    const dkey = units.map((u) => u.code + u.status + Math.round(u.dist || 0)).join('|');
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
        dist.textContent = Math.round(u.dist || 0) + 'm';
      }
    }

    // Crew cards.
    for (let i = 0; i < 3; i++) {
      const s = this.crewSlots[i];
      const c = (vm.crew || [])[i];
      if (!c) {
        s.slot.style.display = 'none';
        continue;
      }
      s.slot.style.display = '';
      s.av.textContent = c.initials || initials(c.name);
      s.av.style.background = c.color || '#888';
      this.setText(s.nm, 'cn' + c.name, c.name);
      this.setText(s.ab, 'ca' + c.ability, c.ability + ' [' + c.key + ']');
      const cstate = c.ready ? 'READY' : Math.ceil(c.cooldown || 0) + 's';
      this.setText(s.st, 'cs' + cstate, cstate);
      s.st.style.color = c.ready ? '#7ad87a' : '#c8a24a';
    }

    // Radio.
    const radioText = (vm.station || '') + ' — ' + (vm.song || '');
    this.setText(this.radioEl, 'radio' + (vm.station || '') + (vm.song || ''), radioText);

    // Dialogue.
    if (vm.dialogue) {
      this.dialogueEl.style.display = 'block';
      const dName = vm.dialogue.name;
      this.dialogueAvatarEl.textContent = initials(dName);
      this.dialogueAvatarEl.style.background = SPEAKER_COLORS[dName] || '#888';
      this.setText(this.dialogueNameEl, 'dn' + dName, dName + (vm.dialogue.role ? ' · ' + vm.dialogue.role : ''));
      this.setText(this.dialogueLineEl, 'dl' + vm.dialogue.line, vm.dialogue.line);
    } else {
      this.dialogueEl.style.display = 'none';
    }

    // Hint.
    const hint = vm.hint || '';
    this.setText(this.hintEl, 'hint' + hint, hint);

    // Speedo.
    const speed = Math.round(vm.speedKmh || 0);
    this.setText(this.speedNumEl, 'sp' + speed, String(speed));
    const carName = vm.carName || '';
    this.setText(this.carNameEl, 'car' + carName, carName);
    const condition = vm.condition || 0;
    this.condFillEl.style.width = Math.round(condition) + '%';
    this.condFillEl.style.background = condition > 50 ? '#7ad87a' : condition > 25 ? '#ffd76a' : '#ff4a4a';

    // Nitro.
    if (vm.nitroOwned) {
      this.nitroEl.style.display = '';
      const nitroPct = Math.round(vm.nitro || 0);
      this.setText(this.nitroEl, 'nitro' + nitroPct + (vm.nitroActive ? 'a' : ''), 'NITRO ' + nitroPct + '%' + (vm.nitroActive ? ' — ACTIVE' : ''));
    } else {
      this.nitroEl.style.display = 'none';
    }

    // Weapon slots.
    for (let i = 0; i < 6; i++) {
      const s = this.weaponSlots[i];
      const w = (vm.weapons || [])[i];
      if (!w) {
        s.slot.style.display = 'none';
        continue;
      }
      s.slot.style.display = '';
      s.slot.classList.toggle('selected', i === vm.selectedWeapon);
      s.slot.style.opacity = w.unlocked ? '1' : '0.6';
      const wname = (i + 1) + ' ' + w.name;
      this.setText(s.nm, 'wn' + wname, wname);
      this.setText(s.am, 'wa' + wname + (w.unlocked ? w.ammo : 'lock'), w.unlocked ? w.ammo + ' ammo' : 'LOCKED · M11');
    }

    // Briefing panel.
    if (vm.briefing) {
      const b = vm.briefing;
      this.briefingEl.style.display = 'block';
      this.setText(this.briefingTitleEl, 'btMISSION BRIEFING', 'MISSION BRIEFING');
      this.setText(this.briefingJobEl, 'bj' + b.title, b.title);
      this.setText(this.briefingGiverEl, 'bg' + b.giver, b.giver + ' · ' + (b.role || ''));
      const okey = (b.objectives || []).join('|');
      if (this.briefingObjectivesEl.dataset.k !== okey) {
        this.briefingObjectivesEl.dataset.k = okey;
        this.briefingObjectivesEl.innerHTML = (b.objectives || []).map((o, i) => (i === 0 ? '▸ ' : '○ ') + o).join('<br>');
      }
      this.setText(this.briefingRewardEl, 'br' + (b.reward || ''), 'Reward ' + (b.reward || '') + ' · Cash on hand $' + (b.cash || 0).toLocaleString('en-US'));
    } else {
      this.briefingEl.style.display = 'none';
    }

    // Toast timer.
    if (this._toastTimer > 0) {
      this._toastTimer -= dt || 0;
      if (this._toastTimer <= 0) this.toastEl.style.display = 'none';
    }

    // Minimap.
    if (vm.minimap) this.drawMinimap(vm.minimap);
  }

  drawMinimap(mm) {
    const cv = this.minimapEl;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = 200;
    const H = 200;
    const mapX = (x) => ((x + 300) / 600) * W;
    const mapZ = (z) => ((z + 300) / 860) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0e1a24';
    ctx.fillRect(0, 0, W, H);
    // Water to the south.
    ctx.fillStyle = '#0e5a6a';
    ctx.fillRect(0, mapZ(300), W, H - mapZ(300));
    // Island.
    ctx.fillStyle = '#2a3a2a';
    ctx.beginPath();
    ctx.arc(mapX(0), mapZ(520), 22, 0, Math.PI * 2);
    ctx.fill();
    // Roads.
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = 2;
    const rxs = [-240, -160, -80, 0, 80, 160, 240];
    for (const rx of rxs) {
      ctx.beginPath();
      ctx.moveTo(mapX(rx), 0);
      ctx.lineTo(mapX(rx), H);
      ctx.stroke();
    }
    const rzs = [-240, -160, -80, 0, 80, 160, 200, 220, 240];
    for (const rz of rzs) {
      ctx.beginPath();
      ctx.moveTo(0, mapZ(rz));
      ctx.lineTo(W, mapZ(rz));
      ctx.stroke();
    }
    // Route to the objective.
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
    // Gold ring.
    ctx.strokeStyle = '#d8a24a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  showWheel(weapons, selected, position) {
    if (!this.wheelEl) return;
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
    // Keep the dispatch panel from overlapping the wheel (shot 3).
    if (this.dispatchEl) this.dispatchEl.style.display = 'none';
    for (let i = 0; i < 6; i++) {
      const s = this.wheelSlots[i];
      const w = (weapons || [])[i];
      if (!w) {
        s.slot.style.display = 'none';
        continue;
      }
      s.slot.style.display = '';
      s.slot.classList.toggle('selected', i === selected);
      s.slot.style.opacity = w.unlocked ? '1' : '0.6';
      const wname = (i + 1) + ' ' + w.name;
      this.setText(s.nm, 'wwn' + wname, wname);
      this.setText(s.am, 'wwa' + wname + (w.unlocked ? w.ammo : 'lock'), w.unlocked ? w.ammo + ' ammo' : 'LOCKED · M11');
      s.lk.style.display = w.unlocked ? 'none' : '';
    }
  }

  hideWheel() {
    if (this.wheelEl) this.wheelEl.style.display = 'none';
    if (this.dispatchEl) this.dispatchEl.style.display = '';
  }

  showShop(items, cash, owned, onBuy) {
    if (!this.shopEl) return;
    this.shopEl.style.display = 'block';
    this._shopBuy = onBuy;
    this.setText(this.shopCashEl, 'sc' + cash, 'Cash: $' + cash.toLocaleString('en-US'));
    const key = (items || []).map((it) => it.id + ((owned && owned[it.id]) ? '1' : '0')).join('|');
    if (this.shopListEl.dataset.k !== key) {
      this.shopListEl.dataset.k = key;
      this.shopListEl.innerHTML = '';
      for (const it of (items || [])) {
        const has = !!(owned && owned[it.id]);
        const row = el('div', 'hud-shop-row', this.shopListEl);
        const name = el('span', 'hud-shop-name', row);
        name.textContent = it.name + ' — $' + (it.price ?? it.cost ?? 0).toLocaleString('en-US');
        const btn = el('button', 'hud-shop-buy', row);
        btn.textContent = has ? 'OWNED' : 'BUY';
        btn.disabled = !!has;
        btn.addEventListener('click', () => {
          if (this._shopBuy) this._shopBuy(it.id);
        });
      }
    }
  }

  hideShop() {
    if (this.shopEl) this.shopEl.style.display = 'none';
  }

  setShopMessage(msg) {
    this.setText(this.shopMsgEl, 'sm' + msg, msg);
  }

  toast(text, dur) {
    if (!this.toastEl) return;
    this.toastEl.style.display = '';
    this.setText(this.toastEl, 'toast' + text, text);
    this._toastTimer = dur || 3;
  }
}
