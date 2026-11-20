// Puerto Alba — missions.js
// "The Debt": eight story jobs with named givers, dialogue, stages,
// rewards, respect progression and weapon unlocks.
(function () {
  'use strict';
  var U = PA.utils;

  var MISSIONS = [
    {
      num: 1, title: 'Hot Wheels', giver: 'Marco "Wrench" Vela', giverRole: 'Chop-shop boss',
      briefing: 'Steal the red Vulture GT parked on Marina Row and bring it to the garage.',
      dialogue: [
        { who: 'Marco "Wrench" Vela', line: 'Ria. You owe the Don forty grand. Tonight you start paying it back.' },
        { who: 'Ria Solano', line: 'Forty grand? I drove one job, Marco. One.' },
        { who: 'Marco "Wrench" Vela', line: 'Then drive another. Red Vulture GT, Marina Row. Don\'t scratch it.' }
      ],
      stages: [
        { text: 'Steal the red Vulture GT', type: 'steal', carModel: 'Vulture GT' },
        { text: 'Deliver it to the garage', type: 'reach', target: { x: -52, z: -8 }, radius: 8, needCar: true }
      ],
      rewardCash: 2500, rewardRP: 120
    },
    {
      num: 2, title: 'The Drop', giver: 'Lena Cruz', giverRole: 'Fixer',
      briefing: 'Pick up the package at the marina and drop it at the palms — no cops, no questions.',
      dialogue: [
        { who: 'Lena Cruz', line: 'Package is at the marina kiosk. You take it, you do not open it.' },
        { who: 'Ria Solano', line: 'And if the cops get curious?' },
        { who: 'Lena Cruz', line: 'Then you drive like the wheelwoman you claim to be.' }
      ],
      stages: [
        { text: 'Pick up the package at the marina', type: 'reach', target: { x: -60, z: 160 }, radius: 7 },
        { text: 'Drop it at the palm row', type: 'reach', target: { x: 120, z: 150 }, radius: 7 }
      ],
      rewardCash: 3200, rewardRP: 140
    },
    {
      num: 3, title: 'Causeway Run', giver: 'Dario Font', giverRole: 'Street racer',
      briefing: 'Outrun the Alba PD across the causeway to the island. Lose them or outrun them — your call.',
      dialogue: [
        { who: 'Dario Font', line: 'The cops set a roadblock on the causeway every Friday. Tonight is Friday.' },
        { who: 'Ria Solano', line: 'So I drive straight through it. Great plan, Dario.' },
        { who: 'Dario Font', line: 'No — you drive around it. Fast. The island is the finish line.' }
      ],
      stages: [
        { text: 'Reach the causeway entrance', type: 'reach', target: { x: 0, z: 140 }, radius: 9, needCar: true },
        { text: 'Cross the causeway to the island', type: 'reach', target: { x: 0, z: 252 }, radius: 10, needCar: true },
        { text: 'Lose the heat — get wanted to 0', type: 'escape' }
      ],
      rewardCash: 5000, rewardRP: 200
    },
    {
      num: 4, title: 'Harbor Lights', giver: 'Sofia Marin', giverRole: 'Smuggler',
      briefing: 'Meet Sofia\'s boat crew at the docks after dark and cover the unload while the harbor patrol circles.',
      dialogue: [
        { who: 'Sofia Marin', line: 'My boat docks at midnight. Harbor patrol does a sweep every ten minutes.' },
        { who: 'Ria Solano', line: 'What do you need me for, then?' },
        { who: 'Sofia Marin', line: 'A fast car parked the wrong way, and a driver who does not panic.' }
      ],
      stages: [
        { text: 'Meet the boat at the docks', type: 'reach', target: { x: -128, z: 68 }, radius: 8 },
        { text: 'Hold the dock for 45 seconds', type: 'hold', seconds: 45, target: { x: -128, z: 68 }, radius: 12 }
      ],
      rewardCash: 4200, rewardRP: 180
    },
    {
      num: 5, title: 'The Vault Job', giver: 'Elias "Ledger" Prado', giverRole: 'Inside man',
      briefing: 'Drive the crew to the bank on Commerce Row, wait out the alarm, then get everyone clear.',
      dialogue: [
        { who: 'Elias "Ledger" Prado', line: 'The vault timer is ninety seconds. The alarm is instant.' },
        { who: 'Jax', line: 'Ninety seconds of cops. Ria, you better have the car running.' },
        { who: 'Ria Solano', line: 'I always have the car running.' }
      ],
      stages: [
        { text: 'Drive the crew to the bank', type: 'reach', target: { x: 60, z: -60 }, radius: 8, needCar: true },
        { text: 'Wait out the vault timer', type: 'hold', seconds: 30, target: { x: 60, z: -60 }, radius: 14 },
        { text: 'Escape to the garage', type: 'reach', target: { x: -52, z: -8 }, radius: 8, needCar: true }
      ],
      rewardCash: 9000, rewardRP: 320
    },
    {
      num: 6, title: 'Ghost in the Machine', giver: 'Mina Okafor', giverRole: 'Crew hacker',
      briefing: 'Mina needs the car parked under the traffic camera grid while she loops the feeds. Stay in the zone.',
      dialogue: [
        { who: 'Mina Okafor', line: 'Park under the camera pole on Meridian and do not move for sixty seconds.' },
        { who: 'Ria Solano', line: 'Sixty seconds under a police camera. You are the worst.' },
        { who: 'Mina Okafor', line: 'I am the best. That is why the feed loops instead of watching you.' }
      ],
      stages: [
        { text: 'Park under the camera grid', type: 'reach', target: { x: 60, z: 60 }, radius: 8, needCar: true },
        { text: 'Hold position while Mina loops the feeds', type: 'hold', seconds: 60, target: { x: 60, z: 60 }, radius: 10 }
      ],
      rewardCash: 6500, rewardRP: 260
    },
    {
      num: 7, title: 'Payback at the Docks', giver: 'Tito Rivas', giverRole: 'Crew muscle',
      briefing: 'The crew that set Ria up is moving a shipment at the docks. Take their cars out and walk away.',
      dialogue: [
        { who: 'Tito Rivas', line: 'Three of their cars, Ria. You do not have to be gentle.' },
        { who: 'Ria Solano', line: 'Finally a job that speaks my language.' },
        { who: 'Tito Rivas', line: 'I will be right behind you. Try not to get us both killed.' }
      ],
      stages: [
        { text: 'Reach the docks', type: 'reach', target: { x: 128, z: -52 }, radius: 9 },
        { text: 'Wreck 3 rival cars', type: 'wreck', count: 3, target: { x: 128, z: -52 }, radius: 16 }
      ],
      rewardCash: 8000, rewardRP: 300
    },
    {
      num: 8, title: 'The Debt Paid', giver: 'Don Rafael Alba', giverRole: 'The Don',
      briefing: 'One last run for the Don himself: deliver his car to the island at golden hour and the debt is cleared.',
      dialogue: [
        { who: 'Don Rafael Alba', line: 'You have driven well, Ria Solano. One last run and we are square.' },
        { who: 'Ria Solano', line: 'The island. Golden hour. No cops?' },
        { who: 'Don Rafael Alba', line: 'There will be cops. That is why I asked for you.' }
      ],
      stages: [
        { text: 'Take the Don\'s car from the garage', type: 'steal', carModel: 'Night Runner' },
        { text: 'Deliver it to the island at golden hour', type: 'reach', target: { x: 0, z: 252 }, radius: 10, needCar: true },
        { text: 'Lose the heat — get wanted to 0', type: 'escape' }
      ],
      rewardCash: 15000, rewardRP: 500
    }
  ];

  var RANKS = [
    { rp: 0, name: 'Wheelman' },
    { rp: 200, name: 'Getaway Driver' },
    { rp: 500, name: 'Street Legend' },
    { rp: 900, name: 'Ghost of Alba' },
    { rp: 1400, name: 'Queen of the Causeway' }
  ];

  function rankFor(rp) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) if (rp >= RANKS[i].rp) r = RANKS[i];
    return r.name;
  }

  function nextRankAt(rp) {
    for (var i = 0; i < RANKS.length; i++) if (rp < RANKS[i].rp) return RANKS[i].rp;
    return null;
  }

  function MissionRunner(scene, state) {
    this.scene = scene;
    this.state = state;
    this.active = null;
    this.stageIndex = 0;
    this.stageT = 0;
    this.holdT = 0;
    this.wrecked = 0;
    this.marker = null;
    this.markerRing = null;
    this.finished = false;
    this.failed = false;
    this.failReason = '';
    this.elapsed = 0;
    this._makeMarker();
  }

  MissionRunner.prototype._makeMarker = function () {
    var mat = new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.55 });
    this.marker = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.35, 24), mat);
    this.marker.position.y = 0.25;
    this.marker.visible = false;
    this.scene.add(this.marker);
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 13;
    this.marker.add(beam);
    this.markerRing = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 3.8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    this.markerRing.rotation.x = -Math.PI / 2;
    this.markerRing.position.y = 0.3;
    this.markerRing.visible = false;
    this.scene.add(this.markerRing);
  };

  MissionRunner.prototype.mission = function () {
    return this.active;
  };

  MissionRunner.prototype.stage = function () {
    if (!this.active) return null;
    return this.active.stages[this.stageIndex] || null;
  };

  MissionRunner.prototype.start = function (index) {
    if (index < 0 || index >= MISSIONS.length) return false;
    this.active = MISSIONS[index];
    this.stageIndex = 0;
    this.stageT = 0;
    this.holdT = 0;
    this.wrecked = 0;
    this.elapsed = 0;
    this.finished = false;
    this.failed = false;
    this.state.missionIndex = index;
    if (PA.hud) {
      PA.hud.showDialogue(this.active.giver, this.active.dialogue[0].line);
      PA.hud.banner('M' + this.active.num + ' — ' + this.active.title, this.active.briefing);
    }
    if (PA.audio) PA.audio.sting();
    this._placeMarker();
    return true;
  };

  MissionRunner.prototype._placeMarker = function () {
    var s = this.stage();
    if (s && s.target) {
      this.marker.position.set(s.target.x, 0.25, s.target.z);
      this.marker.visible = true;
      this.markerRing.position.set(s.target.x, 0.3, s.target.z);
      this.markerRing.visible = true;
    } else {
      this.marker.visible = false;
      this.markerRing.visible = false;
    }
  };

  MissionRunner.prototype.objectiveText = function () {
    if (!this.active) return 'Free roam — press J to start the next job';
    var s = this.stage();
    if (!s) return this.active.title + ' — done';
    var extra = '';
    if (s.type === 'hold') extra = '  (' + Math.ceil(s.seconds - this.holdT) + 's left)';
    if (s.type === 'wreck') extra = '  (' + this.wrecked + '/' + s.count + ')';
    return 'M' + this.active.num + ' ' + this.active.title + ' — ' + s.text + extra;
  };

  MissionRunner.prototype.progress01 = function () {
    if (!this.active) return 0;
    return (this.stageIndex + this._stageProgress()) / this.active.stages.length;
  };

  MissionRunner.prototype._stageProgress = function () {
    var s = this.stage();
    if (!s) return 1;
    if (s.type === 'hold') return U.clamp(this.holdT / s.seconds, 0, 1);
    if (s.type === 'wreck') return U.clamp(this.wrecked / s.count, 0, 1);
    return 0;
  };

  MissionRunner.prototype.advance = function () {
    this.stageIndex++;
    this.stageT = 0;
    this.holdT = 0;
    if (PA.audio) PA.audio.good();
    if (this.stageIndex >= this.active.stages.length) {
      this.completeMission();
    } else {
      var s = this.stage();
      if (PA.hud) PA.hud.toast('Stage complete — ' + s.text);
      this._placeMarker();
    }
  };

  MissionRunner.prototype.completeMission = function () {
    var m = this.active;
    this.state.cash += m.rewardCash;
    this.state.respect += m.rewardRP;
    this.state.rank = rankFor(this.state.respect);
    if (this.state.completed.indexOf(m.num) < 0) this.state.completed.push(m.num);
    this.state.missionIndex = Math.min(m.num, MISSIONS.length - 1);
    this.finished = true;
    this.marker.visible = false;
    this.markerRing.visible = false;
    var unlocked = [];
    if (PA.combatInstance) unlocked = PA.combatInstance.unlockForMission(m.num);
    if (PA.hud) {
      PA.hud.banner('JOB COMPLETE — ' + m.title, '+' + U.fmtCash(m.rewardCash) + '  +' + m.rewardRP + ' RP  ' + (unlocked.length ? 'UNLOCKED: ' + unlocked.join(', ') : ''));
      PA.hud.showDialogue(m.giver, 'Job done. The Don will hear about this.');
    }
    if (PA.audio) { PA.audio.cashSound(); PA.audio.sting(); }
    if (PA.save) PA.save.save(this.state);
    this.active = null;
    this.stageIndex = 0;
  };

  MissionRunner.prototype.fail = function (reason) {
    this.failed = true;
    this.failReason = reason;
    this.marker.visible = false;
    this.markerRing.visible = false;
    if (PA.hud) PA.hud.banner('JOB FAILED', reason + ' — press J to retry');
    if (PA.audio) PA.audio.bad();
    this.active = null;
    this.stageIndex = 0;
  };

  MissionRunner.prototype.update = function (dt, ctx) {
    this.elapsed += dt;
    if (this.marker.visible) {
      var t = performance.now() / 1000;
      this.marker.rotation.y = t * 0.8;
      var s = 1 + Math.sin(t * 3) * 0.12;
      this.marker.scale.set(s, 1, s);
    }
    if (!this.active) return;
    var stage = this.stage();
    if (!stage) return;
    this.stageT += dt;
    var player = ctx.player;
    var pos = player.position();
    var police = ctx.police;
    if (stage.type === 'reach') {
      var d = U.dist2(pos.x, pos.z, stage.target.x, stage.target.z);
      if (d < stage.radius) {
        if (stage.needCar && !player.car) {
          if (PA.hud && this.stageT > 2) PA.hud.toast('You need a car for this stage');
        } else {
          this.advance();
        }
      }
    } else if (stage.type === 'steal') {
      if (player.car && player.car.name === stage.carModel) {
        if (PA.hud) PA.hud.toast('Car stolen — ' + stage.carModel);
        this.advance();
      }
    } else if (stage.type === 'hold') {
      var hd = U.dist2(pos.x, pos.z, stage.target.x, stage.target.z);
      if (hd < stage.radius) {
        this.holdT += dt;
        if (this.holdT >= stage.seconds) this.advance();
      } else {
        this.holdT = Math.max(0, this.holdT - dt * 0.5);
      }
    } else if (stage.type === 'escape') {
      if (police && police.wanted <= 0) this.advance();
    } else if (stage.type === 'wreck') {
      var wd = U.dist2(pos.x, pos.z, stage.target.x, stage.target.z);
      if (wd < stage.radius + 10 && ctx.rivalWrecks !== undefined && ctx.rivalWrecks > this.wrecked) {
        this.wrecked = ctx.rivalWrecks;
        if (PA.hud) PA.hud.toast('Rival car wrecked! (' + this.wrecked + '/' + stage.count + ')');
        if (this.wrecked >= stage.count) this.advance();
      }
    }
    // Failing: player dead.
    if (player.dead) this.fail('Ria is down');
  };

  window.PA = window.PA || {};
  PA.missions = { MISSIONS: MISSIONS, MissionRunner: MissionRunner, rankFor: rankFor, nextRankAt: nextRankAt, RANKS: RANKS };
})();
