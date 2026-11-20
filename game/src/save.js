// Puerto Alba — save.js
// localStorage save/load for campaign progress. No personal data stored.
(function () {
  'use strict';

  var KEY = 'puerto-alba-save-v2';

  function blank() {
    return {
      version: 2,
      cash: 1200,
      respect: 0,
      rank: 'Wheelman',
      missionIndex: 0,
      completed: [],
      weaponsUnlocked: [true, true, true, false, false, false],
      ammo: [0, 60, 120, 0, 0, 0],
      bestTime: null,
      playSeconds: 0,
      savedAt: null
    };
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return blank();
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return blank();
      var out = blank();
      for (var k in out) {
        if (Object.prototype.hasOwnProperty.call(data, k)) out[k] = data[k];
      }
      return out;
    } catch (e) {
      return blank();
    }
  }

  function save(state) {
    try {
      var snap = {
        version: 2,
        cash: state.cash | 0,
        respect: state.respect | 0,
        rank: state.rank || 'Wheelman',
        missionIndex: state.missionIndex | 0,
        completed: (state.completed || []).slice(),
        weaponsUnlocked: (state.weaponsUnlocked || []).slice(),
        ammo: (state.ammo || []).slice(),
        bestTime: state.bestTime,
        playSeconds: Math.floor(state.playSeconds || 0),
        savedAt: new Date().toISOString()
      };
      window.localStorage.setItem(KEY, JSON.stringify(snap));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  function hasSave() {
    try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
  }

  window.PA = window.PA || {};
  PA.save = { blank: blank, load: load, save: save, clear: clear, hasSave: hasSave, KEY: KEY };
})();
