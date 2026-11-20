// districts.js — the five districts of Puerto Alba + standing per district.
// Standing rises when you finish jobs in a district. Puerto Alba.

import { clamp } from './utils.js';

export const DISTRICTS = [
  { name: 'The Strand', cx: 0, cz: 215, r: 130, standing: 0 },
  { name: 'Marina Row', cx: -190, cz: 40, r: 130, standing: 0 },
  { name: 'Commerce Row', cx: 40, cz: -140, r: 150, standing: 0 },
  { name: 'Causeway', cx: 0, cz: 385, r: 110, standing: 0 },
  { name: 'The Island', cx: 0, cz: 520, r: 105, standing: 0 }
];

export class Districts {
  constructor() {
    this.list = DISTRICTS.map(d => Object.assign({}, d));
    this.current = 'Commerce Row';
  }

  districtAt(x, z) {
    let best = null, bestD = Infinity;
    for (const d of this.list) {
      const dd = Math.hypot(x - d.cx, z - d.cz);
      if (dd < d.r && dd < bestD) { best = d; bestD = dd; }
    }
    // Fallback: nearest district by center.
    if (!best) {
      for (const d of this.list) {
        const dd = Math.hypot(x - d.cx, z - d.cz);
        if (dd < bestD) { best = d; bestD = dd; }
      }
    }
    return best;
  }

  updatePosition(x, z) {
    const d = this.districtAt(x, z);
    if (d) this.current = d.name;
    return this.current;
  }

  addStanding(name, n) {
    const d = this.list.find(d => d.name === name);
    if (d) d.standing = clamp(d.standing + n, 0, 100);
  }
  standing(name) {
    const d = this.list.find(d => d.name === name);
    return d ? d.standing : 0;
  }
  currentStanding() { return this.standing(this.current); }

  serialize() {
    const out = {};
    for (const d of this.list) out[d.name] = d.standing;
    return out;
  }
  restore(data) {
    if (!data) return;
    for (const d of this.list) {
      if (typeof data[d.name] === 'number') d.standing = clamp(data[d.name], 0, 100);
    }
  }
}
