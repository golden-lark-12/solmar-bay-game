// save.js — localStorage save/load. Only numbers, strings and mission flags;
// nothing personal, no identifiers of any kind.
const KEY = 'solmar-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: Math.round(state.cash),
      missionsDone: state.missionsDone.slice(),
      missionIndex: state.missionIndex,
      pos: [Math.round(state.player.pos.x * 10) / 10, Math.round(state.player.pos.z * 10) / 10],
      health: Math.round(state.player.health),
      stashes: state.stashesCollected.slice(),
      bestTrial: state.bestTrial,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || !Array.isArray(d.missionsDone)) return null;
    return d;
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }
export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }
