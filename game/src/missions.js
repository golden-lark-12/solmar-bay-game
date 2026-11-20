// missions.js — the story of "The Debt": 12 jobs, each with a named giver,
// three lines of dialogue, stages (steal / reach / hold / escape / wreck /
// race / buy), cash + respect rewards, weapon unlocks. Puerto Alba.

import { Car } from './vehicle.js';

export const RANKS = [
  { name: 'Wheelman', rp: 0 },
  { name: 'Street Hustler', rp: 250 },
  { name: 'Fixer', rp: 550 },
  { name: 'Ghost of Alba', rp: 900 },
  { name: 'King of Alba', rp: 1400 }
];

export function rankFor(rp) {
  let r = RANKS[0];
  for (const k of RANKS) if (rp >= k.rp) r = k;
  const next = RANKS[RANKS.indexOf(r) + 1];
  return { rank: r, next };
}

export const JOBS = [
  {
    id: 'M1', name: 'Hot Wheels', giver: 'Kiki Maro', role: 'Wheelwoman', district: 'Marina Row',
    type: 'story', reward: 2500, rp: 120, unlock: null,
    dialogue: [
      'Kiki: Ria. That Comet GT on Marina Row? It has our name on it.',
      'Kiki: Lift it clean, no sirens, and bring it to the garage.',
      'Ria: One clean lift. Then the Don gets one less reason to call.'
    ],
    stages: [
      { type: 'steal', x: -160, z: 80, radius: 6, text: 'Steal the Comet GT' },
      { type: 'reach', x: -150, z: 136, radius: 16, text: 'Deliver it to Alba Garage' }
    ]
  },
  {
    id: 'M2', name: 'The Drop', giver: 'Lena Kade', role: 'Fixer', district: 'Marina Row',
    type: 'story', reward: 3000, rp: 150, unlock: null,
    dialogue: [
      'Lena: A package for the pier. No questions, no peeking.',
      'Lena: Wait at the marker until my buyer shows. Five seconds of patience.',
      'Ria: Patience I have. Curiosity I left at the docks.'
    ],
    stages: [
      { type: 'reach', x: -240, z: 180, radius: 12, text: 'Reach the pier' },
      { type: 'hold', x: -240, z: 180, radius: 12, seconds: 5, text: 'Hold the drop point' }
    ]
  },
  {
    id: 'M3', name: 'Causeway Run', giver: 'Dario Voss', role: 'Wheelman', district: 'Causeway',
    type: 'story', reward: 4500, rp: 200, unlock: 'M3',
    dialogue: [
      'Dario: The causeway at golden hour. Fastest line in Alba.',
      'Dario: Run it end to end, then hold the island club till I call.',
      'Ria: If the cops follow, they can admire the view too.'
    ],
    stages: [
      { type: 'reach', x: 0, z: 320, radius: 14, text: 'Hit the causeway' },
      { type: 'reach', x: 0, z: 470, radius: 14, text: 'Cross to the island' },
      { type: 'hold', x: 0, z: 470, radius: 14, seconds: 8, text: 'Hold the club entrance' }
    ]
  },
  {
    id: 'M4', name: 'Marina Lights', giver: 'Sable Quinn', role: 'Marina Owner', district: 'Marina Row',
    type: 'story', reward: 5000, rp: 220, unlock: null,
    dialogue: [
      'Sable: A rival hauler parks on my marina like he owns it.',
      'Sable: Wreck it. Leave it where the tide can see it.',
      'Ria: Consider it a new reef.'
    ],
    stages: [
      { type: 'wreck', x: -160, z: 80, radius: 10, text: 'Wreck the rival hauler' }
    ]
  },
  {
    id: 'M5', name: 'Commerce Row Heat', giver: 'Marco Venn', role: 'Fixer', district: 'Commerce Row',
    type: 'story', reward: 6000, rp: 260, unlock: 'M5',
    dialogue: [
      'Marco: Venn\'s boys torched my delivery van. Debts get paid in dents.',
      'Marco: Total their coupe on Commerce Row, then vanish.',
      'Ria: Vanishing is my favorite part.'
    ],
    stages: [
      { type: 'wreck', x: 80, z: -80, radius: 10, text: 'Wreck the rival coupe' },
      { type: 'escape', x: 0, z: 0, radius: 0, text: 'Lose the cops' }
    ]
  },
  {
    id: 'M6', name: 'Island Lights', giver: 'Iris Vale', role: 'Club Owner', district: 'The Island',
    type: 'story', reward: 6500, rp: 280, unlock: null,
    dialogue: [
      'Iris: My club opens tonight and the Don\'s men want a cut of the door.',
      'Iris: Show up, hold the floor, then bring the night to the casino.',
      'Ria: I will be the best-dressed problem they have tonight.'
    ],
    stages: [
      { type: 'reach', x: 0, z: 470, radius: 14, text: 'Reach the island club' },
      { type: 'hold', x: 0, z: 470, radius: 14, seconds: 10, text: 'Hold the club floor' },
      { type: 'reach', x: 190, z: 228, radius: 16, text: 'Reach Casino Luna' }
    ]
  },
  {
    id: 'M7', name: 'Payback at the Docks', giver: 'Don Rafael Alba', role: 'Don of Alba', district: 'Marina Row',
    type: 'story', reward: 10000, rp: 400, unlock: 'M7',
    dialogue: [
      'Don Alba: Forty thousand you owe me, Ria. Tonight you start paying it back.',
      'Don Alba: A rival convoy docks at midnight. Wreck their lead car.',
      'Ria: One car. Then we talk about the other thirty-nine thousand.'
    ],
    stages: [
      { type: 'wreck', x: -240, z: -160, radius: 10, text: 'Wreck the convoy lead car' },
      { type: 'reach', x: -150, z: 136, radius: 16, text: 'Escape to Alba Garage' }
    ]
  },
  {
    id: 'M8', name: 'The Debt Paid', giver: 'Don Rafael Alba', role: 'Don of Alba', district: 'The Strand',
    type: 'story', reward: 15000, rp: 500, unlock: null,
    dialogue: [
      'Don Alba: The last of it, Ria. Forty thousand, in one bag, on the Strand.',
      'Don Alba: Every cruiser in Alba will be looking for you. Make them work for it.',
      'Ria: When this bag lands, I drive for me. Nobody else.'
    ],
    stages: [
      { type: 'reach', x: -240, z: 200, radius: 12, text: 'Deliver the bag on the Strand' },
      { type: 'escape', x: 0, z: 0, radius: 0, text: 'Lose the 5-star heat' }
    ]
  },
  {
    id: 'M9', name: 'Strand Grand Prix', giver: 'Rex Calder', role: 'Race Promoter', district: 'The Strand',
    type: 'race', raceId: 'strand-gp', reward: 4000, rp: 200, unlock: null,
    dialogue: [
      'Rex: Seven gates, three rivals, one beachfront. Winner takes four grand.',
      'Rex: Beat my best time and I will put your name on the board.',
      'Ria: Put it in gold. I like gold.'
    ],
    stages: [
      { type: 'race', raceId: 'strand-gp', x: -220, z: 205, radius: 14, text: 'Win the Strand Grand Prix' }
    ]
  },
  {
    id: 'M10', name: 'Tune-Up for Alba', giver: 'Gus Ferran', role: 'Garage Mechanic', district: 'Marina Row',
    type: 'garage', reward: 3000, rp: 180, unlock: null,
    dialogue: [
      'Gus: The garage is real now, Ria. Bring me a car worth tuning.',
      'Gus: Buy any upgrade off my wall and I will fit it myself.',
      'Ria: One Comet GT, one upgrade. Try to keep up, Gus.'
    ],
    stages: [
      { type: 'steal', x: -160, z: 160, radius: 6, text: 'Steal a car for the garage' },
      { type: 'reach', x: -150, z: 136, radius: 16, text: 'Bring it to Alba Garage' },
      { type: 'buy', x: -150, z: 136, radius: 16, text: 'Buy any garage upgrade' }
    ]
  },
  {
    id: 'M11', name: 'The Luna Vault', giver: 'Sable Quinn', role: 'Marina Owner', district: 'The Strand',
    type: 'heist', reward: 12000, rp: 450, unlock: 'M11',
    dialogue: [
      'Sable: Casino Luna keeps its vault behind twelve seconds of nerve.',
      'Sable: Stand at the doors, crack it, and do not stop for the lights.',
      'Ria: Twelve seconds. I have held my breath longer.'
    ],
    stages: [
      { type: 'reach', x: 190, z: 228, radius: 16, text: 'Reach Casino Luna' },
      { type: 'hold', x: 190, z: 228, radius: 16, seconds: 12, text: 'Crack the vault' },
      { type: 'escape', x: 0, z: 0, radius: 0, text: 'Lose the cops' }
    ]
  },
  {
    id: 'M12', name: "Alba's Last Call", giver: 'Don Rafael Alba', role: 'Don of Alba', district: 'The Island',
    type: 'finale', reward: 15000, rp: 500, unlock: null,
    dialogue: [
      'Don Alba: One last job, Ria. The island, the whole heat, and a clean exit.',
      'Don Alba: Bring the ledger to the clubhouse and the debt is dust.',
      'Ria: Last call, Don. After tonight, Alba drives itself.'
    ],
    stages: [
      { type: 'reach', x: 0, z: 470, radius: 14, text: 'Reach the island clubhouse' },
      { type: 'escape', x: 0, z: 0, radius: 0, text: 'Lose the 5-star heat' }
    ]
  }
];

export class Missions {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.jobs = JOBS.map(j => Object.assign({}, j, { done: false }));
    this.active = null; // {job, stageIndex, holdT, stageCar, raceStarted}
    this.completed = [];
  }

  job(id) { return this.jobs.find(j => j.id === id); }
  isDone(id) { return this.completed.includes(id); }

  start(id, force) {
    const job = this.job(id);
    if (!job || this.isDone(id)) return null;
    if (this.active) this.abandon();
    this.active = { job, stageIndex: 0, holdT: 0, stageCar: null, raceStarted: false };
    this.prepareStage();
    return this.active;
  }

  prepareStage() {
    const a = this.active;
    if (!a) return;
    const st = a.job.stages[a.stageIndex];
    if (!st) return;
    a.holdT = 0;
    if (a.stageCar) { a.stageCar.dispose(); a.stageCar = null; }
    if (st.type === 'wreck' || st.type === 'steal') {
      const isWreck = st.type === 'wreck';
      a.stageCar = new Car(this.THREE, this.scene, {
        x: st.x, z: st.z,
        color: isWreck ? 0x8a1a1a : 0x2ad8c8,
        name: isWreck ? 'Rival Hauler' : 'Comet GT',
        topSpeed: 20, health: isWreck ? 100 : 100
      });
      a.stageCar.heading = Math.PI / 2;
      a.stageCar.mesh.rotation.y = a.stageCar.heading;
    }
  }

  stage() {
    if (!this.active) return null;
    return this.active.job.stages[this.active.stageIndex] || null;
  }
  stageTarget() {
    const st = this.stage();
    if (!st) return null;
    if (st.type === 'escape') {
      // Escape stages route to Alba Garage.
      return { x: -150, z: 136, text: 'Escape to Alba Garage', type: 'escape' };
    }
    return { x: st.x, z: st.z, text: st.text, type: st.type };
  }

  // ctx: {px, pz, inCar, wanted, raceResult, garage, enteredCar}
  // Returns events: [{type:'stage'|'complete'|'race-lost'|'buy', ...}]
  update(dt, ctx) {
    const events = [];
    const a = this.active;
    if (!a) return events;
    const st = a.job.stages[a.stageIndex];
    if (!st) return events;
    const d = Math.hypot(ctx.px - (st.x || 0), ctx.pz - (st.z || 0));
    const advance = () => {
      a.stageIndex += 1;
      events.push({ type: 'stage', job: a.job, stageIndex: a.stageIndex });
      if (a.stageIndex >= a.job.stages.length) {
        const reward = { cash: a.job.reward, rp: a.job.rp, unlock: a.job.unlock, job: a.job };
        this.completed.push(a.job.id);
        this.active = null;
        events.push({ type: 'complete', reward });
      } else {
        this.prepareStage();
      }
    };
    switch (st.type) {
      case 'steal':
        if (ctx.inCar || (a.stageCar && ctx.enteredCar === a.stageCar)) advance();
        break;
      case 'reach':
        if (d < (st.radius || 12)) advance();
        break;
      case 'hold':
        if (d < (st.radius || 12)) {
          a.holdT += dt;
          if (a.holdT >= (st.seconds || 5)) advance();
        } else {
          a.holdT = Math.max(0, a.holdT - dt);
        }
        break;
      case 'escape':
        if (ctx.wanted === 0) advance();
        break;
      case 'wreck':
        if (a.stageCar && a.stageCar.health <= 0) advance();
        break;
      case 'race': {
        if (!a.raceStarted) {
          a.raceStarted = true;
          events.push({ type: 'race-start', raceId: st.raceId });
        }
        if (ctx.raceResult) {
          if (ctx.raceResult.won) advance();
          else events.push({ type: 'race-lost', raceId: st.raceId });
        }
        break;
      }
      case 'buy':
        if (ctx.garage && (ctx.garage.has('armor') || ctx.garage.has('engine') || ctx.garage.has('nitro'))) advance();
        break;
      default:
        break;
    }
    return events;
  }

  holdProgress() {
    const a = this.active;
    if (!a) return 0;
    const st = a.job.stages[a.stageIndex];
    if (!st || st.type !== 'hold') return 0;
    return Math.min(1, a.holdT / (st.seconds || 5));
  }

  abandon() {
    if (!this.active) return;
    if (this.active.stageCar) this.active.stageCar.dispose();
    this.active = null;
  }

  serialize() { return this.completed.slice(); }
  restore(doneList) {
    if (!doneList) return;
    for (const id of doneList) {
      if (this.job(id)) this.completed.push(id);
    }
  }
}
