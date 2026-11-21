// hud.js — Puerto Alba HUD: cash/rank/district, mission panel with stage +
// next step, dispatch board, crew with drawn faces, minimap with streets +
// route, weapon wheel, garage shop, briefing, dialogue, toasts.
export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.onShopClose = null;
    this._shopBuy = null;
    this._toastTimer = 0;
    this._lastDispatch = '';
    this._lastLadder = '';
    this._wheelPinned = false;
  }

  el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  // Simple drawn face: skin circle, hair cap in the character's color,
  // two eyes, mouth. Reads as a portrait at contact-sheet size.
  _faceSVG(p) {
    const skin = p.skin || '#e8b088';
    const hair = p.hair || p.color || '#2a2a2a';
    const mustache = p.mustache
      ? '<path d="M17 30 Q22 33 27 30" stroke="#d8d8d8" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : '';
    return '<svg viewBox="0 0 44 44" width="100%" height="100%">'
      + '<circle cx="22" cy="17" r="13" fill="' + hair + '"/>'
      + '<circle cx="22" cy="25" r="12.5" fill="' + skin + '"/>'
      + '<path d="M10 22 A12 12 0 0 1 34 22 L34 19 A12 10 0 0 0 10 19 Z" fill="' + hair + '"/>'
      + '<circle cx="17" cy="25" r="1.8" fill="#1a1210"/>'
      + '<circle cx="27" cy="25" r="1.8" fill="#1a1210"/>'
      + '<path d="M18 31 Q22 34 26 31" stroke="#7a3a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + mustache
      + '</svg>';
  }

  build() {
    const root = this.root;
    root.innerHTML = '';

    // Top-left: stars, cash, rank, RP, ladder, district, standing.
    const tl = this.el('div', 'hud-tl', root);
    this.starsEl = this.el('div', 'hud-stars', tl);
    this.cashEl = this.el('div', 'hud-cash', tl);
    this.rankEl = this.el('div', 'hud-rank', tl);
    this.rankEl.style.fontSize = '30px';
    this.rankEl.style.fontWeight = '800';
    const rpbar = this.el('div', 'hud-rpbar', tl);
    this.rpFillEl = this.el('div', 'hud-rpfill', rpbar);
    this.rpTextEl = this.el('div', 'hud-rptext', tl);
    this.rpTextEl.style.fontSize = '18px';
    this.rpTextEl.style.fontWeight = '800';
    this.ladderEl = this.el('div', 'hud-ladder', tl);
    this.ladderEl.style.fontSize = '15px';
    this.ladderEl.style.background = 'rgba(10,10,18,0.8)';
    this.ladderEl.style.padding = '4px 8px';
    this.ladderEl.style.borderRadius = '6px';
    this.ladderEl.style.marginTop = '4px';
    this.ladderEl.style.display = 'inline-block';
    this.districtEl = this.el('div', 'hud-district', tl);
    const standBar = this.el('div', 'hud-rpbar', tl);
    this.standFillEl = this.el('div', 'hud-rpfill stand', standBar);
    this.standTextEl = this.el('div', 'hud-rptext', tl);

    // Top-center: mission panel, IN SIGHT, air unit.
    const tc = this.el('div', 'hud-tc', root);
    this.missionEl = this.el('div', 'hud-mission', tc);
    this.missionTitleEl = this.el('div', 'hud-mission-title', this.missionEl);
    this.missionGiverEl = this.el('div', 'hud-mission-giver', this.missionEl);
    this.missionStageEl = this.el('div', 'hud-mission-stage', this.missionEl);
    this.missionNextEl = this.el('div', 'hud-mission-next', this.missionEl);
    this.missionNextEl.style.fontSize = '15px';
    this.missionNextEl.style.color = '#ffd76a';
    this.missionNextEl.style.marginTop = '3px';
    const mBar = this.el('div', 'hud-rpbar mission', this.missionEl);
    this.missionFillEl = this.el('div', 'hud-rpfill', mBar);
    this.missionTimerEl = this.el('div', 'hud-mission-timer', this.missionEl);
    this.insightEl = this.el('div', 'hud-insight', tc);
    this.insightEl.textContent = 'IN SIGHT';
    this.insightEl.style.display = 'none';
    this.airEl = this.el('div', 'hud-air', tc);
    this.airEl.textContent = '▲ AIR UNIT DEPLOYED';
    this.airEl.style.display = 'none';
    this.airEl.style.background = '#a31212';
    this.airEl.style.color = '#fff';
    this.airEl.style.fontSize = '17px';
    this.airEl.style.letterSpacing = '2px';
    this.airEl.style.padding = '5px 18px';
    this.airEl.style.borderRadius = '8px';
    this.airEl.style.border = '2px solid rgba(255,255,255,0.7)';
    this.airEl.style.marginTop = '8px';
    this.airEl.style.textAlign = 'center';

    // Top-right: minimap, clock, dispatch.
    const tr = this.el('div', 'hud-tr', root);
    this.minimapEl = this.el('canvas', 'hud-minimap', tr);
    this.minimapEl.width = 200;
    this.minimapEl.height = 200;
    this.clockEl = this.el('div', 'hud-clock', tr);
    this.dispatchEl = this.el('div', 'hud-dispatch', tr);
    this.el('div', 'hud-dispatch-title', this.dispatchEl).textContent = 'DISPATCH';
    this.dispatchListEl = this.el('div', 'hud-dispatch-list', this.dispatchEl);
    this.dispatchEmptyEl = this.el('div', 'hud-dispatch-empty', this.dispatchEl);
    this.dispatchEmptyEl.textContent = 'No active units — streets are quiet';

    // Bottom-left: crew + radio.
    const bl = this.el('div', 'hud-bl', root);
    const crewEl = this.el('div', 'hud-crew', bl);
    this.crewSlots = [];
    for (let i = 0; i < 3; i++) {
      const slot = this.el('div', 'hud-crew-slot', crewEl);
      const avatar = this.el('div', 'hud-crew-avatar', slot);
      avatar.style.overflow = 'hidden';
      avatar.style.padding = '0';
      const name = this.el('div', 'hud-crew-name', slot);
      const ability = this.el('div', 'hud-crew-ability', slot);
      const state = this.el('div', 'hud-crew-state', slot);
      this.crewSlots.push({ slot, avatar, name, ability, state });
    }
    this.radioEl = this.el('div', 'hud-radio', bl);

    // Bottom-center: dialogue + hint.
    const bc = this.el('div', 'hud-bc', root);
    this.dialogueEl = this.el('div', 'hud-dialogue', bc);
    this.dialogueEl.style.display = 'none';
    this.dialogueAvatarEl = this.el('div', 'hud-dialogue-avatar', this.dialogueEl);
    this.dialogueAvatarEl.style.width = '44px';
    this.dialogueAvatarEl.style.height = '44px';
    this.dialogueAvatarEl.style.borderRadius = '50%';
    this.dialogueAvatarEl.style.border = '2px solid #fff';
    this.dialogueAvatarEl.style.overflow = 'hidden';
    this.dialogueAvatarEl.style.cssFloat = 'left';
    this.dialogueAvatarEl.style.marginRight = '12px';
    const dText = this.el('div', 'hud-dialogue-text', this.dialogueEl);
    this.dialogueNameEl = this.el('div', 'hud-dialogue-name', dText);
    this.dialogueLineEl = this.el('div', 'hud-dialogue-line', dText);
    this.hintEl = this.el('div', 'hud-hint', bc);

    // Bottom-right: speedo, nitro, weapons.
    const br = this.el('div', 'hud-br', root);
    const speedo = this.el('div', 'hud-speedo', br);
    this.speedNumEl = this.el('span', 'hud-speed-num', speedo);
    this.el('span', 'hud-speed-unit', speedo).textContent = 'km/h';
    this.carNameEl = this.el('div', 'hud-carname', speedo);
    const condBar = this.el('div', 'hud-rpbar cond', speedo);
    this.condFillEl = this.el('div', 'hud-rpfill cond', condBar);
    this.nitroEl = this.el('div', 'hud-nitro', br);
    this.nitroLabelEl = this.el('div', 'hud-nitro-label', this.nitroEl);
    const nBar = this.el('div', 'hud-rpbar nitro', this.nitroEl);
    this.nitroFillEl = this.el('div', 'hud-rpfill nitro', nBar);
    this.weaponsEl = this.el('div', 'hud-weapons', br);
    this.weaponSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = this.el('div', 'hud-weapon', this.weaponsEl);
      slot.style.width = '120px';
      const name = this.el('div', 'hud-weapon-name', slot);
      name.style.fontSize = '16px';
      const ammo = this.el('div', 'hud-weapon-ammo', slot);
      ammo.style.fontSize = '15px';
      this.weaponSlots.push({ slot, name, ammo });
    }

    // Weapon wheel (center overlay).
    this.wheelEl = this.el('div', 'hud-wheel', root);
    this.wheelEl.style.display = 'none';
    this.el('div', 'hud-wheel-title', this.wheelEl).textContent = 'WEAPONS — hold Tab, pick 1-6';
    this.wheelSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = this.el('div', 'hud-wheel-slot', this.wheelEl);
      const name = this.el('div', 'hud-wheel-name', slot);
      const ammo = this.el('div', 'hud-wheel-ammo', slot);
      const lock = this.el('div', 'hud-wheel-lock', slot);
      this.wheelSlots.push({ slot, name, ammo, lock });
    }

    // Garage shop (center overlay).
    this.shopEl = this.el('div', 'hud-shop', root);
    this.shopEl.style.display = 'none';
    this.el('div', 'hud-shop-title', this.shopEl).textContent = 'ALBA GARAGE';
    this.shopCashEl = this.el('div', 'hud-shop-cash', this.shopEl);
    this.shopListEl = this.el('div', 'hud-shop-list', this.shopEl);
    this.shopMsgEl = this.el('div', 'hud-shop-msg', this.shopEl);
    const closeBtn = this.el('button', 'hud-shop-close', this.shopEl);
    closeBtn.textContent = 'CLOSE  [G]';
    closeBtn.addEventListener('click', () => {
      if (this.onShopClose) this.onShopClose();
    });

    // Mission briefing panel.
    this.briefingEl = this.el('div', 'hud-briefing', root);
    this.briefingEl.style.display = 'none';
    this.briefingEl.style.position = 'absolute';
    this.briefingEl.style.left = '16px';
    this.briefingEl.style.top = '330px';
    this.briefingEl.style.width = '330px';
    this.briefingEl.style.background = 'rgba(10,10,18,0.85)';
    this.briefingEl.style.border = '2px solid #ffd76a';
    this.briefingEl.style.borderRadius = '10px';
    this.briefingEl.style.padding = '12px 16px';
    this.briefingTitleEl = this.el('div', 'hud-briefing-title', this.briefingEl);
    this.briefingTitleEl.style.fontSize = '15px';
    this.briefingTitleEl.style.letterSpacing = '3px';
    this.briefingTitleEl.style.color = '#ffd76a';
    this.briefingJobEl = this.el('div', 'hud-briefing-job', this.briefingEl);
    this.briefingJobEl.style.fontSize = '22px';
    this.briefingJobEl.style.color = '#fff';
    this.briefingJobEl.style.marginTop = '4px';
    this.briefingGiverEl = this.el('div', 'hud-briefing-giver', this.briefingEl);
    this.briefingGiverEl.style.fontSize = '15px';
    this.briefingGiverEl.style.color = '#cfe8ff';
    this.briefingObjectivesEl = this.el('div', 'hud-briefing-objectives', this.briefingEl);
    this.briefingObjectivesEl.style.fontSize = '16px';
    this.briefingObjectivesEl.style.marginTop = '8px';
    this.briefingObjectivesEl.style.lineHeight = '1.6';
    this.briefingRewardEl = this.el('div', 'hud-briefing-reward', this.briefingEl);
    this.briefingRewardEl.style.fontSize = '15px';
    this.briefingRewardEl.style.color = '#7dff8a';
    this.briefingRewardEl.style.marginTop = '8px';

    // Toast (center).
    this.toastEl = this.el('div', 'hud-toast', root);
    this.toastEl.style.display = 'none';
  }

  setText(node, key, text) {
    if (!node) return;
    if (node._k !== text) {
      node.textContent = text;
      node._k = text;
    }
  }

  update(vm, dt) {
    void dt;
    if (!vm) return;
    // Stars.
    const stars = '★'.repeat(Math.max(0, vm.wanted || 0)) + '☆'.repeat(Math.max(0, 5 - (vm.wanted || 0)));
    this.setText(this.starsEl, 'stars', stars);
    this.starsEl.classList.toggle('hot', (vm.wanted || 0) >= 3);
    this.setText(this.cashEl, 'cash', '$' + Math.round(vm.cash || 0).toLocaleString('en-US'));
    this.setText(this.rankEl, 'rank', (vm.rank || 'Wheelman').toUpperCase());
    if (this.rpFillEl) this.rpFillEl.style.width = Math.round((vm.rankProgress || 0) * 100) + '%';
    this.setText(this.rpTextEl, 'rp', Math.round(vm.rp || 0) + ' RP · next: ' + (vm.nextRank || '—'));
    // Rank ladder, current rank highlighted.
    if (vm.ladder) {
      const html = vm.ladder.map((r) =>
        r === vm.rank ? '<b style="color:#ffd76a">' + r + '</b>' : r
      ).join(' • ');
      if (this._lastLadder !== html) {
        this.ladderEl.innerHTML = html;
        this._lastLadder = html;
      }
    }
    this.setText(this.districtEl, 'district', '▸ ' + (vm.district || ''));
    if (this.standFillEl) this.standFillEl.style.width = Math.round(vm.standing || 0) + '%';
    this.setText(this.standTextEl, 'stand', 'Standing ' + Math.round(vm.standing || 0) + ' / 100');

    // Mission panel: job, giver, stage + STAGE x/y, NEXT step, progress.
    if (vm.mission) {
      this.missionEl.style.display = 'block';
      this.setText(this.missionTitleEl, 'mt', vm.mission.title || '');
      this.setText(this.missionGiverEl, 'mg', vm.mission.giver || '');
      const stageLine = (vm.mission.stageLabel ? vm.mission.stageLabel + ' · ' : '') + (vm.mission.stage || '');
      this.setText(this.missionStageEl, 'ms', stageLine);
      if (vm.mission.next) {
        this.missionNextEl.style.display = 'block';
        this.setText(this.missionNextEl, 'mn', 'NEXT › ' + vm.mission.next);
      } else {
        this.missionNextEl.style.display = 'none';
      }
      if (this.missionFillEl) this.missionFillEl.style.width = Math.round((vm.mission.progress || 0) * 100) + '%';
      this.setText(this.missionTimerEl, 'mtimer', vm.mission.timer || '');
    } else {
      this.missionEl.style.display = 'none';
    }
    this.insightEl.style.display = vm.spotted ? 'block' : 'none';
    this.airEl.style.display = vm.airDeployed ? 'block' : 'none';

    // Clock.
    this.setText(this.clockEl, 'clock', vm.clock || '');

    // Dispatch board.
    if (vm.hideDispatch) {
      this.dispatchEl.style.display = 'none';
    } else {
      this.dispatchEl.style.display = 'block';
      const list = vm.dispatch || [];
      if (!list.length) {
        this.dispatchListEl.innerHTML = '';
        this._lastDispatch = '';
        this.dispatchEmptyEl.style.display = 'block';
        this.setText(this.dispatchEmptyEl, 'de', vm.dispatchEmptyText || 'No active units — streets are quiet');
      } else {
        this.dispatchEmptyEl.style.display = 'none';
        const key = JSON.stringify(list.map((u) => [u.code, u.status, Math.round(u.dist)]));
        if (key !== this._lastDispatch) {
          this._lastDispatch = key;
          this.dispatchListEl.innerHTML = list.map((u) =>
            '<div class="hud-unit"><span class="hud-unit-code">' + u.code + '</span>'
            + '<span class="hud-unit-role">' + u.role + '</span>'
            + '<span class="hud-unit-badge" style="background:' + u.color + ';">' + u.status + '</span>'
            + '<span class="hud-unit-dist">' + Math.round(u.dist) + 'm</span></div>'
          ).join('');
        }
      }
    }

    // Crew slots with drawn faces.
    const crew = vm.crew || [];
    for (let i = 0; i < this.crewSlots.length; i++) {
      const s = this.crewSlots[i];
      const c = crew[i];
      if (!c) { s.slot.style.display = 'none'; continue; }
      s.slot.style.display = 'block';
      s.slot.style.borderColor = c.color || 'rgba(255,255,255,0.4)';
      const faceKey = (c.initials || '') + (c.color || '');
      if (s.avatar._k !== faceKey) {
        s.avatar.innerHTML = this._faceSVG(c);
        s.avatar._k = faceKey;
      }
      this.setText(s.name, 'n', c.name || '');
      this.setText(s.ability, 'a', (c.ability || '') + ' [' + (c.key || '') + ']');
      const stateTxt = c.ready ? 'READY' : Math.ceil(c.cooldown || 0) + 's';
      this.setText(s.state, 's', stateTxt);
      s.state.classList.toggle('ready', !!c.ready);
    }

    // Radio.
    if (vm.radio) this.setText(this.radioEl, 'radio', vm.radio.station + ' — ' + vm.radio.song);

    // Dialogue with drawn face.
    if (vm.dialogue) {
      this.dialogueEl.style.display = 'block';
      const d = vm.dialogue;
      const faceKey = 'dlg' + (d.name || '') + (d.color || '');
      if (this.dialogueAvatarEl._k !== faceKey) {
        this.dialogueAvatarEl.innerHTML = this._faceSVG({
          color: d.color, skin: d.skin, hair: d.hair, mustache: d.mustache,
        });
        this.dialogueAvatarEl._k = faceKey;
      }
      this.setText(this.dialogueNameEl, 'dn', d.name + ' · ' + d.role);
      this.dialogueNameEl.style.color = d.color || '#2ad8c8';
      this.setText(this.dialogueLineEl, 'dl', d.line || '');
    } else {
      this.dialogueEl.style.display = 'none';
    }

    // Controls hint — hidden on the staged cover.
    if (vm.hideHint || !vm.hint) {
      this.hintEl.style.display = 'none';
    } else {
      this.hintEl.style.display = 'block';
      this.setText(this.hintEl, 'hint', vm.hint);
    }

    // Speedo / condition / nitro.
    this.setText(this.speedNumEl, 'spd', String(Math.round(vm.speedKmh || 0)));
    this.setText(this.carNameEl, 'car', vm.carName || '');
    if (this.condFillEl) this.condFillEl.style.width = Math.round(vm.condition || 0) + '%';
    if (vm.nitroOwned) {
      this.nitroEl.style.display = 'block';
      this.setText(this.nitroLabelEl, 'nl', 'NITRO ' + Math.round(vm.nitro || 0) + '%');
      if (this.nitroFillEl) {
        this.nitroFillEl.style.width = Math.round(vm.nitro || 0) + '%';
        this.nitroFillEl.classList.toggle('boosting', !!vm.nitroBoost);
      }
    } else {
      this.nitroEl.style.display = 'none';
    }

    // Weapon slots: large boxes with big names + ammo numbers.
    const weapons = vm.weapons || [];
    for (let i = 0; i < this.weaponSlots.length; i++) {
      const s = this.weaponSlots[i];
      const w = weapons[i];
      if (!w) { s.slot.style.display = 'none'; continue; }
      s.slot.style.display = 'block';
      s.slot.classList.toggle('selected', !!w.selected);
      s.slot.classList.toggle('locked', !!w.locked);
      this.setText(s.name, 'wn', (i + 1) + ' ' + w.name);
      this.setText(s.ammo, 'wa', w.locked ? (w.lockText || 'LOCKED') : (w.ammo + ' ammo'));
    }

    // Briefing panel.
    if (vm.briefing) {
      this.briefingEl.style.display = 'block';
      const b = vm.briefing;
      this.setText(this.briefingTitleEl, 'bt', 'MISSION BRIEFING');
      this.setText(this.briefingJobEl, 'bj', b.title || '');
      this.setText(this.briefingGiverEl, 'bg', (b.giver || '') + ' · ' + (b.role || ''));
      const objKey = JSON.stringify(b.objectives || []);
      if (this.briefingObjectivesEl._k !== objKey) {
        this.briefingObjectivesEl.innerHTML = (b.objectives || []).map((o, i) =>
          '<div>' + (i === 0 ? '▸ ' : '○ ') + o + '</div>').join('');
        this.briefingObjectivesEl._k = objKey;
      }
      this.setText(this.briefingRewardEl, 'br', 'Reward ' + (b.reward || '') + ' · Cash on hand $' + Math.round(vm.cash || 0).toLocaleString('en-US'));
    } else {
      this.briefingEl.style.display = 'none';
    }

    // Minimap.
    if (vm.minimap) this.drawMinimap(vm.minimap);
  }

  drawMinimap(mm) {
    const cv = this.minimapEl;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = 200;
    const H = 200;
    const scale = 200 / 380; // ~380m across the map
    const px = mm.x || 0;
    const pz = mm.z || 0;
    const toX = (x) => 100 + (x - px) * scale;
    const toY = (z) => 100 + (z - pz) * scale;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(100, 100, 98, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#123a4a';
    ctx.fillRect(0, 0, W, H);
    // Water (south of the beach).
    if (pz + 190 > 300) {
      ctx.fillStyle = '#1a6a72';
      ctx.fillRect(0, toY(300), W, H);
    }
    // Streets as lines.
    const roads = mm.roads || [-240, -160, -80, 0, 80, 160, 240];
    const roadsZ = mm.roadsZ || [-240, -160, -80, 0, 80, 160, 200];
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 3;
    for (const x of roads) {
      ctx.beginPath();
      ctx.moveTo(toX(x), toY(pz - 190));
      ctx.lineTo(toX(x), toY(pz + 190));
      ctx.stroke();
    }
    for (const z of roadsZ) {
      ctx.beginPath();
      ctx.moveTo(toX(px - 190), toY(z));
      ctx.lineTo(toX(px + 190), toY(z));
      ctx.stroke();
    }
    // Mission route: gold dashed line + destination marker.
    if (mm.route && mm.route.length > 1) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(toX(mm.route[0][0]), toY(mm.route[0][1]));
      for (let i = 1; i < mm.route.length; i++) ctx.lineTo(toX(mm.route[i][0]), toY(mm.route[i][1]));
      ctx.stroke();
      ctx.setLineDash([]);
      const last = mm.route[mm.route.length - 1];
      const dx = toX(last[0]);
      const dy = toY(last[1]);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(dx, dy - 8);
      ctx.lineTo(dx + 7, dy);
      ctx.lineTo(dx, dy + 8);
      ctx.lineTo(dx - 7, dy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#201404';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Extra markers (gold dots).
    for (const m of (mm.markers || [])) {
      ctx.fillStyle = m.color || '#ffd76a';
      ctx.beginPath();
      ctx.arc(toX(m.x), toY(m.z), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Police units as red/blue dots.
    for (const u of (mm.police || [])) {
      ctx.fillStyle = u.color || '#ff3a3a';
      ctx.beginPath();
      ctx.arc(toX(u.x), toY(u.z), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Player arrow.
    const h = mm.heading || 0;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#201404';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(100 + Math.sin(h) * 9, 100 + Math.cos(h) * 9);
    ctx.lineTo(100 + Math.sin(h + 2.6) * 7, 100 + Math.cos(h + 2.6) * 7);
    ctx.lineTo(100 + Math.sin(h - 2.6) * 7, 100 + Math.cos(h - 2.6) * 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Ring.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(100, 100, 98, 0, Math.PI * 2);
    ctx.stroke();
  }

  showWheel(weapons, selected, position) {
    // position (optional) shifts the wheel so staged shots keep the 3D
    // action clear of the panel; default is centered (CSS).
    if (position && position.left) this.wheelEl.style.left = position.left;
    if (position && position.top) this.wheelEl.style.top = position.top;
    this._wheelPinned = true;
    this.wheelEl.style.display = 'flex';
    for (let i = 0; i < this.wheelSlots.length; i++) {
      const s = this.wheelSlots[i];
      const w = weapons[i];
      if (!w) { s.slot.style.display = 'none'; continue; }
      s.slot.style.display = 'flex';
      s.slot.classList.toggle('selected', i === selected);
      s.slot.classList.toggle('locked', !!w.locked);
      this.setText(s.name, 'wn', (i + 1) + ' ' + w.name);
      this.setText(s.ammo, 'wa', w.locked ? (w.lockText || 'LOCKED') : (w.ammo + ' ammo'));
      s.lock.innerHTML = w.locked
        ? '<svg width="18" height="18" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" fill="#aaa"/><path d="M8 10 V7 a4 4 0 0 1 8 0 v3" stroke="#aaa" stroke-width="2" fill="none"/></svg>'
        : '';
    }
  }

  hideWheel() {
    this._wheelPinned = false;
    this.wheelEl.style.display = 'none';
  }

  showShop(items, cash, owned, onBuy) {
    this._shopBuy = onBuy;
    this.shopEl.style.display = 'block';
    this.setText(this.shopCashEl, 'sc', 'Cash: $' + Math.round(cash).toLocaleString('en-US'));
    this.shopListEl.innerHTML = '';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'hud-shop-row';
      const name = document.createElement('div');
      name.className = 'hud-shop-name';
      name.textContent = item.name || item.id;
      row.appendChild(name);
      const desc = document.createElement('div');
      desc.className = 'hud-shop-desc';
      desc.textContent = item.desc || '';
      row.appendChild(desc);
      const btn = document.createElement('button');
      btn.className = 'hud-shop-buy';
      const isOwned = owned && owned[item.id];
      btn.disabled = !!isOwned;
      btn.textContent = isOwned ? 'OWNED' : '$' + (item.price || 0).toLocaleString('en-US');
      btn.addEventListener('click', () => {
        if (this._shopBuy) this._shopBuy(item.id);
      });
      row.appendChild(btn);
      this.shopListEl.appendChild(row);
    }
  }

  hideShop() {
    this.shopEl.style.display = 'none';
  }

  setShopMessage(msg) {
    this.setText(this.shopMsgEl, 'sm', msg || '');
  }

  toast(text, dur) {
    if (!text) {
      this.toastEl.style.display = 'none';
      return;
    }
    this.setText(this.toastEl, 'toast', text);
    this.toastEl.style.display = 'block';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.style.display = 'none';
    }, dur || 3000);
  }
}
