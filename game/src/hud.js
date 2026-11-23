// hud.js — Puerto Alba HUD: mission + briefing panels, dispatch, rank ladder,
// crew cards with drawn-face portraits, dialogue, weapon slots + wheel,
// garage shop, minimap with streets / gold route / police dots, radio, toasts.

export class Hud {
  constructor() {
    this._textCache = {};
    this._crewSig = '';
    this._weaponSig = '';
    this._ladderSig = '';
    this._dispatchSig = null;
    this._missionSig = '';
    this._briefingSig = '';
    this._dialogueSig = '';
    this._toastTimer = null;
    this.build();
  }

  el(tag, cls, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  _faceSVG(p) {
    const accent = (p && p.color) || '#ffd76a';
    return '<svg viewBox="0 0 64 64" width="100%" height="100%">' +
      '<circle cx="32" cy="32" r="31" fill="#0c0a16"/>' +
      '<polygon points="32,9 50,19 48,40 38,54 26,54 16,40 14,19" fill="#23232e" stroke="' + accent + '" stroke-width="1.5"/>' +
      '<polygon points="16,32 48,23 48,30 16,39" fill="#0c0a16"/>' +
      '<line x1="20" y1="43" x2="44" y2="36" stroke="#ffd76a" stroke-width="1.6"/>' +
      '<line x1="18" y1="50" x2="46" y2="50" stroke="#ffd76a" stroke-width="2"/>' +
      '</svg>';
  }

  build() {
    const style = document.createElement('style');
    style.textContent = [
      '.hud-root{position:fixed;inset:0;pointer-events:none;z-index:10;font-family:Arial,Helvetica,sans-serif;color:#fff}',
      '.hud-panel{background:rgba(12,10,22,0.62);border:1px solid rgba(255,215,106,0.35);border-radius:10px;padding:7px 10px;box-shadow:0 2px 12px rgba(0,0,0,0.45)}',
      '.hud-air{position:absolute;top:10px;left:50%;transform:translateX(-50%);text-align:center}',
      '.hud-air-banner{display:inline-block;background:rgba(255,60,60,0.85);border-radius:6px;padding:3px 8px;font-weight:bold;font-size:14px;letter-spacing:1px;margin:0 4px}',
      '.hud-insight{display:inline-block;background:rgba(255,180,40,0.9);color:#1a1a1a;border-radius:6px;padding:3px 8px;font-weight:bold;font-size:14px;letter-spacing:1px;margin:0 4px}',
      '.hud-mission{position:absolute;top:12px;left:12px;width:280px}',
      '.hud-mission-title{font-size:18px;font-weight:bold;color:#ffd76a;line-height:1.15}',
      '.hud-mission-giver{font-size:13px;color:#7ad8ff;margin-top:3px}',
      '.hud-mission-stage{font-size:14px;font-weight:bold;margin-top:7px}',
      '.hud-mission-next{font-size:12px;color:#e8e8e8;margin-top:3px}',
      '.hud-mission-timer{font-size:12px;color:#ffd76a;margin-top:3px}',
      '.hud-briefing{position:absolute;top:150px;left:12px;width:280px}',
      '.hud-briefing-title{font-size:17px;font-weight:bold;color:#ffd76a}',
      '.hud-briefing-giver{font-size:13px;color:#7ad8ff;margin-top:2px}',
      '.hud-briefing-job{font-size:13px;margin-top:6px;line-height:1.4}',
      '.hud-briefing-objectives{font-size:13px;margin-top:6px;line-height:1.5}',
      '.hud-briefing-reward{font-size:15px;font-weight:bold;color:#7dff8a;margin-top:6px}',
      '.hud-dispatch{position:absolute;top:12px;right:12px;width:200px}',
      '.hud-dispatch-title{font-size:12px;font-weight:bold;letter-spacing:1px;color:#ff8a7a}',
      '.hud-dispatch-list{font-size:11px;line-height:1.3;margin-top:5px}',
      '.hud-dispatch-empty{font-size:12px;color:#c8c8c8;margin-top:5px}',
      '.hud-crew{position:absolute;top:235px;right:12px;width:190px;display:flex;flex-direction:column;gap:6px}',
      '.hud-crew-slot{width:100%;display:flex;gap:6px;align-items:center;background:rgba(12,10,22,0.62);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:3px 5px}',
      '.hud-crew-avatar{width:29px;height:29px;flex:0 0 29px;border-radius:50%;overflow:hidden;border:2px solid #fff3;margin:0}',
      '.hud-crew-name{font-size:11px;font-weight:bold;white-space:nowrap}',
      '.hud-crew-ability{font-size:10px;color:#ffd76a;white-space:nowrap}',
      '.hud-crew-state{font-size:10px;color:#c8e8c8}',
      '.hud-comms{position:absolute;top:190px;left:12px;width:280px;display:flex;gap:10px;align-items:flex-start}',
      '.hud-comms-avatar{width:48px;height:48px;flex:0 0 48px;border-radius:50%;overflow:hidden;border:2px solid #ffd76a;margin:0}',
      '.hud-comms-name{font-size:13px;font-weight:bold;color:#ffd76a}',
      '.hud-comms-line{font-size:13px;line-height:1.4;margin-top:3px}',
      '.hud-dialogue{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);width:560px;display:flex;gap:12px;align-items:flex-start}',
      '.hud-dialogue-avatar{width:64px;height:64px;flex:0 0 64px;border-radius:50%;overflow:hidden;border:3px solid #ffd76a}',
      '.hud-dialogue-name{font-size:16px;font-weight:bold;color:#ffd76a}',
      '.hud-dialogue-text{flex:1}',
      '.hud-dialogue-line{font-size:16px;line-height:1.45;margin-top:3px}',
      '.hud-bl{position:absolute;left:12px;bottom:12px;width:236px;background:rgba(8,10,18,0.58);border:1px solid rgba(255,255,255,0.22);border-radius:10px;padding:5px 8px 6px}',
      '.hud-rank{font-size:17px;font-weight:bold;color:#ffd76a;line-height:1.05;text-shadow:0 2px 6px rgba(0,0,0,0.7)}',
      '.hud-rpbar{height:5px;background:rgba(255,255,255,0.18);border-radius:6px;margin-top:4px;overflow:hidden}',
      '.hud-rpfill{height:100%;background:linear-gradient(90deg,#ff8a2a,#ffd76a);border-radius:6px}',
      '.hud-rptext{font-size:11px;font-weight:bold;margin-top:2px}',
      '.hud-ladder{font-size:13px;color:#e8e8e8;margin-top:6px;line-height:1.5}',
      '.hud-cash{font-size:14px;font-weight:bold;color:#7dff8a;margin-top:3px}',
      '.hud-debt{font-size:14px;font-weight:bold;color:#ffd76a;margin-top:1px;text-shadow:0 2px 6px rgba(0,0,0,0.7)}',
      '.hud-district{font-size:11px;font-weight:bold;margin-top:1px}',
      '.hud-clock{font-size:10px;color:#ffd76a;margin-top:1px}',
      '.hud-br{position:absolute;right:12px;bottom:12px;text-align:right}',
      '.hud-minimap{width:150px;height:150px;border-radius:50%;border:3px solid rgba(255,215,106,0.6);background:#12202e;display:block;margin-left:auto}',
      '.hud-radio{font-size:11px;color:#e8e8e8;margin-top:8px;background:rgba(12,10,22,0.62);border-radius:8px;padding:4px 8px;display:inline-block}',
      '.hud-carname{font-size:16px;font-weight:bold;margin-top:4px}',
      '.hud-nitro{font-size:13px;margin-top:2px}',
      '.hud-nitro-label{font-size:13px;font-weight:bold;color:#7ad8ff}',
      '.hud-bc{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);text-align:center;width:max-content}',
      '.hud-weapons{display:flex;gap:8px;justify-content:center;width:max-content}',
      '.hud-weapon{width:104px;background:rgba(12,10,22,0.7);border:2px solid rgba(255,255,255,0.25);border-radius:10px;padding:6px 5px;font-size:14px}',
      '.hud-weapon.sel{border-color:#ffd76a;background:rgba(80,60,10,0.8)}',
      '.hud-weapon.locked{opacity:0.55}',
      '.hud-weapon-name{font-weight:bold;font-size:14px}',
      '.hud-weapon-ammo{font-size:18px;font-weight:bold;color:#ffd76a;margin-top:3px}',
      '.hud-weapon-lock{font-size:11px;color:#ff8a7a;margin-top:3px}',
      '.hud-hint{font-size:14px;color:#ffe9a8;margin-top:10px;text-shadow:0 1px 4px rgba(0,0,0,0.8)}',
      '.hud-wheel{position:absolute;inset:auto;left:50%;top:32%;transform:translate(-50%,-50%);display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(12,10,22,0.88);border:2px solid #ffd76a;border-radius:14px;padding:16px 18px}',
      '.hud-wheel-row{display:flex;gap:10px}',
      '.hud-wheel-slot{width:110px;text-align:center}',
      '.hud-wheel-slot.sel .hud-weapon{border-color:#ffd76a}',
      '.hud-shop{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:480px;display:none;background:rgba(14,12,26,0.95);border:2px solid #7dff8a;border-radius:14px;padding:18px;pointer-events:auto}',
      '.hud-shop-title{font-size:20px;font-weight:bold;color:#7dff8a}',
      '.hud-shop-cash{font-size:16px;color:#ffd76a;margin-top:4px}',
      '.hud-shop-list{margin-top:10px}',
      '.hud-shop-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(255,255,255,0.15);font-size:15px}',
      '.hud-shop-row button{pointer-events:auto;background:#7dff8a;border:none;border-radius:6px;padding:7px 14px;font-weight:bold;cursor:pointer;font-size:14px}',
      '.hud-shop-close{pointer-events:auto;background:#444;border:none;color:#fff;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:14px;margin-top:12px}',
      '.hud-shop-msg{font-size:14px;color:#ffd76a;margin-top:8px;min-height:18px}',
      '.hud-toast{position:absolute;top:76px;left:50%;transform:translateX(-50%);background:rgba(12,10,22,0.85);border:1px solid #ffd76a;border-radius:8px;padding:8px 16px;font-size:16px;font-weight:bold;display:none}',
      '.hud-wanted{font-size:14px;color:#ff5a5a;letter-spacing:2px;margin-top:1px}',
      '.hud-speed{font-size:15px;margin-top:4px}'
    ].join('\n');
    document.head.appendChild(style);

    const root = this.el('div', 'hud-root', document.body);
    this.root = root;

    // Air banner (top centre).
    this.airEl = this.el('div', 'hud-air', root);
    this.airBanner = this.el('span', 'hud-air-banner', this.airEl);
    this.airBanner.textContent = 'AIR UNIT DEPLOYED';
    this.insightEl = this.el('span', 'hud-insight', this.airEl);
    this.insightEl.textContent = 'IN SIGHT';

    // Mission panel (top left).
    this.missionEl = this.el('div', 'hud-mission hud-panel', root);
    this.missionTitle = this.el('div', 'hud-mission-title', this.missionEl);
    this.missionGiver = this.el('div', 'hud-mission-giver', this.missionEl);
    this.missionStage = this.el('div', 'hud-mission-stage', this.missionEl);
    this.missionNext = this.el('div', 'hud-mission-next', this.missionEl);
    this.missionTimer = this.el('div', 'hud-mission-timer', this.missionEl);

    // Briefing panel (left, below mission).
    this.briefingEl = this.el('div', 'hud-briefing hud-panel', root);
    this.briefingTitle = this.el('div', 'hud-briefing-title', this.briefingEl);
    this.briefingGiver = this.el('div', 'hud-briefing-giver', this.briefingEl);
    this.briefingJob = this.el('div', 'hud-briefing-job', this.briefingEl);
    this.briefingObjectives = this.el('div', 'hud-briefing-objectives', this.briefingEl);
    this.briefingReward = this.el('div', 'hud-briefing-reward', this.briefingEl);

    this.commsEl = this.el('div', 'hud-comms hud-panel', root);
    this.commsAvatar = this.el('div', 'hud-comms-avatar', this.commsEl);
    this.commsBody = this.el('div', '', this.commsEl);
    this.commsName = this.el('div', 'hud-comms-name', this.commsBody);
    this.commsLine = this.el('div', 'hud-comms-line', this.commsBody);
    this.commsEl.style.display = 'none';

    // Dispatch (right side).
    this.dispatchEl = this.el('div', 'hud-dispatch hud-panel', root);
    this.el('div', 'hud-dispatch-title', this.dispatchEl).textContent = 'DISPATCH';
    this.dispatchList = this.el('div', 'hud-dispatch-list', this.dispatchEl);
    this.dispatchEmpty = this.el('div', 'hud-dispatch-empty', this.dispatchEl);

    // Crew cards (right side, above dispatch).
    this.crewEl = this.el('div', 'hud-crew', root);

    // Dialogue (bottom centre, above weapons).
    this.dialogueEl = this.el('div', 'hud-dialogue hud-panel', root);
    this.dialogueAvatar = this.el('div', 'hud-dialogue-avatar', this.dialogueEl);
    this.dialogueBody = this.el('div', 'hud-dialogue-text', this.dialogueEl);
    this.dialogueName = this.el('div', 'hud-dialogue-name', this.dialogueBody);
    this.dialogueLine = this.el('div', 'hud-dialogue-line', this.dialogueBody);
    this.dialogueText = this.dialogueLine;

    // Bottom left: rank, RP, ladder, cash, district, clock, wanted.
    this.blEl = this.el('div', 'hud-bl', root);
    this.rankEl = this.el('div', 'hud-rank', this.blEl);
    this.rpbarEl = this.el('div', 'hud-rpbar', this.blEl);
    this.rpfillEl = this.el('div', 'hud-rpfill', this.rpbarEl);
    this.rptextEl = this.el('div', 'hud-rptext', this.blEl);
    this.ladderEl = this.el('div', 'hud-ladder', this.blEl);
    this.cashEl = this.el('div', 'hud-cash', this.blEl);
    this.debtEl = this.el('div', 'hud-debt', this.blEl);
    this.districtEl = this.el('div', 'hud-district', this.blEl);
    this.standingEl = this.el('div', 'hud-district', this.blEl);
    this.clockEl = this.el('div', 'hud-clock', this.blEl);
    this.wantedEl = this.el('div', 'hud-wanted', this.blEl);

    // Bottom right: minimap, radio, car, nitro, speed.
    this.brEl = this.el('div', 'hud-br', root);
    this.minimapEl = this.el('canvas', 'hud-minimap', this.brEl);
    this.minimapEl.width = 150;
    this.minimapEl.height = 150;
    this.radioEl = this.el('div', 'hud-radio', this.brEl);
    this.carnameEl = this.el('div', 'hud-carname', this.brEl);
    this.nitroEl = this.el('div', 'hud-nitro', this.brEl);
    this.nitroLabel = this.el('span', 'hud-nitro-label', this.nitroEl);
    this.nitroLabel.textContent = 'NITRO ';
    this.nitroBar = this.el('span', '', this.nitroEl);
    this.speedEl = this.el('div', 'hud-speed', this.brEl);

    // Bottom centre: weapon slots + controls hint.
    this.bcEl = this.el('div', 'hud-bc', root);
    this.weaponsEl = this.el('div', 'hud-weapons', this.bcEl);
    this.hintEl = this.el('div', 'hud-hint', this.bcEl);
    this.hintEl.textContent = 'M — start job · Shift — Nitro · F — weapon · Tab — wheel';

    // Weapon wheel (centre modal).
    this.wheelEl = this.el('div', 'hud-wheel', root);

    // Garage shop (centre modal).
    this.shopEl = this.el('div', 'hud-shop', root);
    this.shopTitle = this.el('div', 'hud-shop-title', this.shopEl);
    this.shopTitle.textContent = 'ALBA GARAGE';
    this.shopCash = this.el('div', 'hud-shop-cash', this.shopEl);
    this.shopList = this.el('div', 'hud-shop-list', this.shopEl);
    this.shopMsg = this.el('div', 'hud-shop-msg', this.shopEl);
    this.shopClose = this.el('button', 'hud-shop-close', this.shopEl);
    this.shopClose.textContent = 'Close (G)';
    this.shopClose.addEventListener('click', () => this.hideShop());

    // Toast (top centre, under the air banner).
    this.toastEl = this.el('div', 'hud-toast', root);

    this.hideShop();
    this.hideWheel();
  }

  setText(node, key, text) {
    if (!node) return;
    if (this._textCache[key] !== text) {
      node.textContent = text;
      this._textCache[key] = text;
    }
  }

  toast(text, dur) {
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.toastEl.style.display = 'none'; }, dur || 2500);
  }

  showWheel(weapons, selected, position) {
    const list = weapons || [];
    this.wheelEl.innerHTML = '';
    const title = this.el('div', 'hud-wheel-title', this.wheelEl);
    title.textContent = 'WEAPONS — hold Tab, pick 1-6';
    // Docked (positioned) wheel: compact, shifted right so the 3D action
    // (helicopter, gun, muzzle) stays clear of the panel; default is the
    // large centred modal used by the interactive Tab wheel.
    const docked = !!(position && (position.left || position.top));
    if (docked) {
      if (position.left) this.wheelEl.style.left = position.left;
      if (position.top) this.wheelEl.style.top = position.top;
      this.wheelEl.style.padding = '10px 12px';
      this.wheelEl.style.gap = '4px';
      title.style.fontSize = '18px';
      title.style.fontWeight = 'bold';
      title.style.color = '#ffd76a';
    } else {
      this.wheelEl.style.left = '';
      this.wheelEl.style.top = '';
      this.wheelEl.style.padding = '';
      this.wheelEl.style.gap = '';
      title.style.fontSize = '';
      title.style.fontWeight = '';
      title.style.color = '';
    }
    const row = this.el('div', 'hud-wheel-row', this.wheelEl);
    if (docked) row.style.gap = '6px';
    list.forEach((w, i) => {
      const slot = this.el('div', 'hud-wheel-slot' + (i === selected ? ' sel' : ''), row);
      if (docked) slot.style.width = '84px';
      const boxEl = this.el('div', 'hud-weapon' + (w.locked ? ' locked' : '') + (i === selected ? ' selected' : ''), slot);
      if (docked) { boxEl.style.width = '72px'; boxEl.style.padding = '6px 4px'; }
      const name = this.el('div', 'hud-weapon-name', boxEl);
      name.textContent = (i + 1) + ' · ' + w.name;
      const ammo = this.el('div', 'hud-weapon-ammo', boxEl);
      ammo.textContent = w.locked ? '—' : (w.ammo !== undefined && w.ammo !== null ? w.ammo : '∞');
      if (w.locked) {
        const lock = this.el('div', 'hud-weapon-lock', boxEl);
        lock.textContent = w.lockText || 'LOCKED';
      }
    });
    this.wheelEl.style.display = 'flex';
  }

  hideWheel() {
    this.wheelEl.style.display = 'none';
  }

  showShop(items, cash, owned, onBuy) {
    const list = items || [];
    this._shopOnBuy = onBuy;
    this.shopCash.textContent = 'Cash: $' + (cash || 0).toLocaleString('en-US');
    this.shopList.innerHTML = '';
    for (const item of list) {
      const row = this.el('div', 'hud-shop-row', this.shopList);
      const label = this.el('span', '', row);
      label.textContent = item.name + ' — $' + (item.price || 0).toLocaleString('en-US') + (item.desc ? ' · ' + item.desc : '');
      const btn = this.el('button', '', row);
      const isOwned = owned && (typeof owned.has === 'function' ? owned.has(item.id) : !!owned[item.id]);
      btn.textContent = isOwned ? 'OWNED' : 'BUY';
      btn.disabled = !!isOwned;
      if (!isOwned) {
        btn.addEventListener('click', () => { if (this._shopOnBuy) this._shopOnBuy(item); });
      }
    }
    this.shopMsg.textContent = '';
    this.shopEl.style.display = 'block';
  }

  hideShop() {
    this.shopEl.style.display = 'none';
  }

  setShopMessage(msg) {
    this.shopMsg.textContent = msg || '';
  }

  update(vm, dt) {
    if (!vm) return;

    if (vm.titleMode) {
      this.root.style.display = 'none';
      return;
    }
    this.root.style.display = '';
    const hideVehicle = !!vm.hideVehicleHud;    this.carnameEl.style.display = hideVehicle ? 'none' : '';
    this.nitroEl.style.display = hideVehicle ? 'none' : '';
    this.speedEl.style.display = hideVehicle ? 'none' : '';

    // Cash / clock / wanted.
    this.setText(this.cashEl, 'cash', '$' + (vm.cash || 0).toLocaleString('en-US'));
    this.setText(this.debtEl, 'debt', 'ALBA HOLDINGS · $' + (vm.debt || 0).toLocaleString('en-US') + ' OWED');
    this.setText(this.clockEl, 'clock', vm.clock || '');
    const wanted = vm.wanted || 0;
    this.setText(this.wantedEl, 'wanted', '★'.repeat(wanted) + '☆'.repeat(Math.max(0, 5 - wanted)));

    // Rank: current rank LARGE and bold, RP numbers big.
    const rankName = (vm.rank || 'Wheelman').toUpperCase();
    this.setText(this.rankEl, 'rank', rankName);
    const prog = vm.rankProgress !== undefined && vm.rankProgress !== null ? vm.rankProgress : 0;
    this.rpfillEl.style.width = Math.round(Math.max(0, Math.min(1, prog)) * 100) + '%';
    this.setText(this.rptextEl, 'rptext', (vm.rp || 0) + ' RP  ·  NEXT: ' + (vm.nextRank || 'MAX'));
    this.ladderEl.style.display = 'none';

    // District: ALWAYS a string name, never an object.
    let district = vm.district;
    if (district && typeof district === 'object') district = district.name || 'The Strand';
    if (!district) district = 'The Strand';
    this.setText(this.districtEl, 'dist' + district, '▸ ' + district);
    this.setText(this.standingEl, 'standing', 'Standing ' + (vm.standing || 0) + ' / 100');

    // Car, nitro, speed, radio.
    const speedKmh = vm.speedKmh !== undefined && vm.speedKmh !== null ? Math.round(vm.speedKmh) : 0;
    this.setText(this.carnameEl, 'carname', (vm.carName || 'Alba Cruiser') + '  ·  COND ' + (vm.condition !== undefined && vm.condition !== null ? Math.round(vm.condition) : 100) + '%');
    const nitro = vm.nitro !== undefined && vm.nitro !== null ? Math.round(vm.nitro) : 0;
    this.setText(this.nitroBar, 'nitro', (vm.nitroOwned ? '' : '(not owned) ') + nitro + '%' + (vm.nitroBoost ? '  BOOST!' : ''));
    this.setText(this.speedEl, 'speed', speedKmh + ' km/h');
    const radio = vm.radio || {};
    this.setText(this.radioEl, 'radio', (radio.station || 'ALBA FM 98.1') + ' — ' + (radio.song || 'Golden Hour Drive'));

    // Air banners.
    this.airBanner.style.display = vm.airDeployed ? 'inline-block' : 'none';
    this.insightEl.style.display = vm.spotted ? 'block' : 'none';
    this.airEl.style.display = (vm.airDeployed || vm.spotted) ? 'block' : 'none';

    // Mission panel.
    const m = vm.mission;
    if (m) {
      this.missionEl.style.display = 'block';
      const sig = m.title + '|' + m.stageLabel + '|' + m.next;
      if (sig !== this._missionSig) {
        this._missionSig = sig;
        this.setText(this.missionTitle, 'mtitle', m.title || '');
        this.setText(this.missionGiver, 'mgiver', m.giver || '');
        this.setText(this.missionStage, 'mstage', (m.stageLabel ? m.stageLabel + '  ' : '') + (m.stage || ''));
        this.setText(this.missionNext, 'mnext', 'NEXT  ' + (m.next || ''));
        this.setText(this.missionTimer, 'mtimer', m.timer || '');
      }
    } else {
      this.missionEl.style.display = 'none';
    }

    // Briefing panel.
    const b = vm.briefing;
    if (b) {
      this.briefingEl.style.display = 'block';
      const sig = b.title + '|' + (b.objectives || []).join('|') + '|' + b.reward;
      if (sig !== this._briefingSig) {
        this._briefingSig = sig;
        this.setText(this.briefingTitle, 'btitle', b.title || '');
        this.setText(this.briefingGiver, 'bgiver', b.giver || '');
        this.setText(this.briefingJob, 'bjob', b.job || '');
        const obj = b.objectives || [];
        this.briefingObjectives.innerHTML = '';
        for (const line of obj) {
          const div = document.createElement('div');
          div.textContent = '• ' + line;
          this.briefingObjectives.appendChild(div);
        }
        this.setText(this.briefingReward, 'breward', 'REWARD  ' + (b.reward || '') + (b.cash !== undefined && b.cash !== null ? '   ·   CASH ' + b.cash : ''));
      }
    } else {
      this.briefingEl.style.display = 'none';
    }

    // Dialogue: drawn-face portrait, never initials.
    const d = vm.dialogue;
    if (d) {
      this.dialogueEl.style.display = 'flex';
      const sig = d.name + '|' + d.line;
      if (sig !== this._dialogueSig) {
        this._dialogueSig = sig;
        this.dialogueAvatar.innerHTML = this._faceSVG(d);
        this.setText(this.dialogueName, 'dname', d.name + (d.role ? '  ·  ' + d.role : ''));
        this.setText(this.dialogueText, 'dline', d.line || '');
        this.setText(this.dialogueLine, 'dline2', d.line || '');
      }
    } else {
      this.dialogueEl.style.display = 'none';
    }

    const cm = vm.comms;
    if (cm) {
      this.commsEl.style.display = 'flex';
      const sig = cm.name + '|' + (cm.role || '') + '|' + cm.line;
      if (sig !== this._commsSig) {
        this._commsSig = sig;
        this.commsAvatar.innerHTML = this._faceSVG(cm);
        this.setText(this.commsName, 'cname', cm.name + (cm.role ? '  ·  ' + cm.role : ''));
        this.setText(this.commsLine, 'cline', cm.line || '');
      }
    } else {
      this.commsEl.style.display = 'none';
    }

    // Controls hint: hidden on the cover shot.
    this.hintEl.style.display = vm.hideHint ? 'none' : 'block';
    if (!vm.hideHint) this.setText(this.hintEl, 'hint', vm.hint || 'M — start job · Shift — Nitro · F — weapon · Tab — wheel');

    // Dispatch: hidden while the weapon wheel is open (combat shot).
    if (vm.hideDispatch) {
      this.dispatchEl.style.display = 'none';
    } else {
      this.dispatchEl.style.display = 'block';
      const disp = vm.dispatch || [];
      const sig = disp.map((u) => (u.code || u.label || u.name || u.id || '') + ':' + (u.dist !== undefined ? Math.round(u.dist) : u.distance) + ':' + (u.role || u.status || '')).join('|');
      if (sig !== this._dispatchSig) {
        this._dispatchSig = sig;
        this.dispatchList.innerHTML = '';
        if (!disp.length) {
          this.dispatchEmpty.style.display = 'block';
          this.setText(this.dispatchEmpty, 'dempty', vm.dispatchEmptyText || 'No active units — streets are quiet');
        } else {
          this.dispatchEmpty.style.display = 'none';
          for (const u of disp) {
            const div = this.el('div', 'hud-unit', this.dispatchList);
            const code = this.el('span', 'hud-unit-code', div);
            code.textContent = u.code || u.label || u.name || u.id || 'P-??';
            if (u.color) code.style.color = u.color;
            const role = this.el('span', 'hud-unit-role', div);
            role.textContent = u.role || u.status || '';
            const dist = this.el('span', 'hud-unit-dist', div);
            const d = u.dist !== undefined ? u.dist : u.distance;
            dist.textContent = (d !== undefined && d !== null) ? Math.round(d) + 'm' : '';
          }
        }
      }
    }

    // Crew cards.
    const crew = vm.crew || [];
    const crewSig = crew.map((c) => c.name + ':' + (c.ready ? 'R' : Math.ceil(c.cooldown || 0))).join('|');
    if (crewSig !== this._crewSig) {
      this._crewSig = crewSig;
      this.crewEl.innerHTML = '';
      for (const c of crew) {
        const slot = this.el('div', 'hud-crew-slot', this.crewEl);
        const av = this.el('div', 'hud-crew-avatar', slot);
        av.innerHTML = this._faceSVG(c);
        const info = this.el('div', '', slot);
        const nm = this.el('div', 'hud-crew-name', info);
        nm.textContent = c.name + '  [' + (c.key || '') + ']';
        const ab = this.el('div', 'hud-crew-ability', info);
        ab.textContent = c.ability || '';
        const st = this.el('div', 'hud-crew-state', info);
        st.textContent = c.ready ? 'READY' : Math.ceil(c.cooldown || 0) + 's';
      }
    }

    this.weaponsEl.style.display = vm.hideWeapons ? 'none' : 'flex';
    const weapons = vm.weapons || [];
    const wSig = weapons.map((w) => w.name + ':' + w.ammo + ':' + (w.locked ? 'L' : 'U') + ':' + (w.selected ? 'S' : '')).join('|');
    if (wSig !== this._weaponSig) {
      this._weaponSig = wSig;
      this.weaponsEl.innerHTML = '';
      if (weapons.length) {
        let selIdx = weapons.findIndex((w) => w.selected);
        if (selIdx < 0) selIdx = 0;
        const w = weapons[selIdx];
        const boxEl = this.el('div', 'hud-weapon' + (w.locked ? ' locked' : '') + ' sel', this.weaponsEl);
        const nm = this.el('div', 'hud-weapon-name', boxEl);
        nm.textContent = (selIdx + 1) + ' · ' + w.name;
        const am = this.el('div', 'hud-weapon-ammo', boxEl);
        am.textContent = w.locked ? '—' : (w.ammo !== undefined && w.ammo !== null ? w.ammo : '∞');
        if (w.locked) {
          const lk = this.el('div', 'hud-weapon-lock', boxEl);
          lk.textContent = w.lockText || 'LOCKED';
        }
      }
    }

    // Minimap.
    if (vm.minimap) this.drawMinimap(vm.minimap);
  }

  drawMinimap(mm) {
    const cv = this.minimapEl;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#12202e';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    ctx.clip();

    const px = (x) => (x + 300) * (W / 600);
    const py = (z) => (z + 300) * (H / 860);
    const roads = mm.roads || [];
    const roadsZ = mm.roadsZ || [];
    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 3;
    for (const rz of roadsZ) {
      ctx.beginPath();
      ctx.moveTo(0, py(rz));
      ctx.lineTo(W, py(rz));
      ctx.stroke();
    }
    for (const rx of roads) {
      ctx.beginPath();
      ctx.moveTo(px(rx), 0);
      ctx.lineTo(px(rx), H);
      ctx.stroke();
    }
    // Water band at the bottom (south).
    ctx.fillStyle = 'rgba(42,138,154,0.55)';
    ctx.fillRect(0, py(300), W, H - py(300));

    // Mission route: gold line + destination marker.
    const route = mm.route || [];
    if (route.length >= 2) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px(route[0][0]), py(route[0][1]));
      for (let i = 1; i < route.length; i++) ctx.lineTo(px(route[i][0]), py(route[i][1]));
      ctx.stroke();
      const last = route[route.length - 1];
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(px(last[0]), py(last[1]), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Extra markers.
    for (const mk of (mm.markers || [])) {
      ctx.fillStyle = mk.color || '#ffd76a';
      ctx.beginPath();
      ctx.arc(px(mk.x), py(mk.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police dots.
    for (const p of (mm.police || [])) {
      ctx.fillStyle = '#ff3a3a';
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.z), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7ad8ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Player arrow.
    const hx = px(mm.x || 0);
    const hy = py(mm.z || 0);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(Math.PI - (mm.heading || 0));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.strokeStyle = 'rgba(255,215,106,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
