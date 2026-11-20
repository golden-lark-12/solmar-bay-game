// garage.js — Alba Garage: upgrade shop for the player's car.
// Armor, engine tune, nitro kit, plus repair. Cash prices, persisted in save.
// Puerto Alba.

import { WORLD } from './city.js';

export const GARAGE_UPGRADES = [
  { id: 'armor', name: 'Armor Plating', desc: '+40 car health, shrugs off rams', price: 1500 },
  { id: 'engine', name: 'Engine Tune', desc: '+25% top speed', price: 2500 },
  { id: 'nitro', name: 'Nitro Kit', desc: 'Unlocks Shift boost + nitro meter', price: 2000 },
  { id: 'repair', name: 'Full Repair', desc: 'Condition back to 100%', price: 400 }
];

export class Garage {
  constructor() {
    this.owned = { armor: false, engine: false, nitro: false };
    this.open = false;
    this.pos = { x: WORLD.garage.x, z: WORLD.garage.z + 26 };
  }

  nearGarage(x, z) {
    return Math.hypot(x - this.pos.x, z - this.pos.z) < 26;
  }
  has(id) { return !!this.owned[id]; }
  hasNitro() { return !!this.owned.nitro; }

  // Apply owned upgrades to a car object.
  applyTo(car) {
    if (!car) return;
    if (this.owned.armor && car.health < 140) {
      car.health = Math.max(car.health, 140);
      car.condition = Math.max(car.condition, 100);
    }
    car.topSpeed = 34 * (this.owned.engine ? 1.25 : 1);
  }

  // Buy an upgrade. Returns {ok, message}.
  buy(id, cash) {
    const up = GARAGE_UPGRADES.find(u => u.id === id);
    if (!up) return { ok: false, message: 'No such upgrade.' };
    if (id === 'repair') {
      if (cash < up.price) return { ok: false, message: 'Not enough cash for a repair.' };
      return { ok: true, cost: up.price, message: 'Car repaired to 100%.', repair: true };
    }
    if (this.owned[id]) return { ok: false, message: up.name + ' already installed.' };
    if (cash < up.price) return { ok: false, message: 'Not enough cash for ' + up.name + '.' };
    this.owned[id] = true;
    return { ok: true, cost: up.price, message: up.name + ' installed.' };
  }

  serialize() { return Object.assign({}, this.owned); }
  restore(data) {
    if (!data) return;
    for (const k of ['armor', 'engine', 'nitro']) if (data[k]) this.owned[k] = true;
  }
}
