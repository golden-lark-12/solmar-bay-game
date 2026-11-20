// save.js — localStorage save: cash, respect, jobs, weapons, garage, races,
// districts, car condition. Puerto Alba.

const KEY = 'puerto-alba-save-v3';

export class SaveSys {
  exists() {
    try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
  }

  save(state) {
    try {
      const data = {
        cash: state.cash, rp: state.rp,
        completedJobs: state.completedJobs,
        weapons: state.weapons.map(w => ({ name: w.name, unlocked: w.unlocked, ammo: w.ammo })),
        garage: state.garage,
        raceBest: state.raceBest,
        districts: state.districts,
        carCondition: state.carCondition,
        playerPos: state.playerPos,
        savedAt: Date.now()
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  clear() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
}
