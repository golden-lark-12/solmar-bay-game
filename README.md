# Puerto Alba

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/golden-lark-12/solmar-bay-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/golden-lark-12/solmar-bay-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Puerto Alba is an open-world crime game in the spirit of GTA 6, built for the
make.fun gta6-01 bounty. Ria Solano, getaway driver, owes a debt — and the only
way out is through it. Explore a sun-soaked coastal city at golden hour on foot
and by car: steal cars, outrun the police helicopter, run jobs across town, and
collect cash stashes.

## The city

A full procedural city at golden hour: downtown glass towers, beachfront
hotels, suburbs, parks and palm trees, a beach with umbrellas, a pier and a
marina, and a causeway bridge out to an island with a lighthouse. The sky runs
purple to orange over the ocean, the sun sits low, and streetlights glow as the
shadows stretch. Traffic loops the road grid, pedestrians stroll the sidewalks
(and scatter when shots are fired), beachgoers wander the sand.

## Systems

- **On foot:** WASD + mouse look (pointer lock), Shift to run, third-person camera
- **Driving:** E to enter or exit, WASD to drive, Space to brake / handbrake,
  follow camera, speedometer, car condition %, headlights, skid smoke
- **Car stealing:** E near any parked or traffic car — the driver bails and the
  car is yours, but the law notices
- **Wanted level 0–5 stars:** rises on stealing, hitting pedestrians and
  shooting; police cars spawn, chase and ram; at 3+ stars Air One (a police
  helicopter with a spotlight cone) joins and a roadblock is thrown across the
  road ahead; hide to cool off; get busted or wasted and you pay a fine and
  wake up across town
- **Combat:** F to punch, mouse-click to shoot (hitscan with tracer and muzzle
  flash). Six weapon slots (1-6): Fists, P9 pistol, Mako SMG (unlocks after
  JOB 2/8), and three locked slots (12G Breacher, AR-9, RPG). R reloads.
- **Crew (Z / X / C):** Mira the driver swaps plates (drops a wanted star),
  Lio the mechanic quick-fixes the car, Kiki the lookout calls out the police
  response. Each ability has a cooldown.
- **Story — "The Debt", 8 jobs:** each job has a named giver and a spoken line
  — Marisol "Sol" Quintana the fixer, Tía Rosa the diner owner, Lupe the
  smuggler, Uncle Dee the fixer, Mira Kesang the driver. JOB 1 Hot Wheels
  (steal a car), JOB 2 The Drop (marina pickup), JOB 3 Causeway Run (cross the
  bridge at 3 stars), JOB 4 Repo Rodeo (lift the valet coupe), JOB 5 Salt &
  Sirens (survive a 40-second parade), JOB 6 Wreck the Regent (ram the target
  car before it reaches the pier), JOB 7 Golden Hour (lose the manhunt before
  the boat sails), JOB 8 The Debt Paid (bring the ledger home).
- **Respect:** jobs and stashes earn RP — climb DRIVER → FIXER → SHOT CALLER
- **Free roam:** 10 cash stashes to collect and a 5-gate checkpoint time trial
- **HUD:** mission banner with stage bars and timer, PAPD dispatch panel
  (named units, roles, live distances), weapon slots, crew abilities, respect
  rank + RP bar, health + armour, cash, wanted stars, radio station, location
  label, dialogue box, and a live minimap with roads, a route line to the
  objective, the player arrow, police dots, the helicopter, the roadblock and
  the mission blip
- **Menus & save:** start screen (Start Story / Free Roam / Continue), pause
  with Esc, save/load via localStorage (cash, missions, position, stashes)
- **Audio:** 100% synthesised WebAudio — engine hum by speed, two-tone siren,
  gunshots, explosion thump, pickup chimes, mission jingles, ambient
  golden-hour pad. M to mute. No audio files.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network — the game runs
offline from static files (three.js r160 is vendored under `game/vendor/`).

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click the game to lock the mouse) |
| Shift | Run |
| E | Enter / exit / steal a car, pick up, start the time trial |
| Space | Brake / handbrake |
| Click | Shoot |
| F | Punch |
| R | Reload |
| 1–6 | Switch weapon slot |
| Z / X / C | Crew: swap plates / quick fix / eyes out |
| Esc | Pause |
| M | Mute |

## Structure

`game/src/` is split into one file per system: `main.js` (boot + loop +
shot mode), `city.js`, `player.js`, `vehicle.js`, `traffic.js`,
`pedestrians.js`, `police.js` (helicopter, roadblock, dispatch),
`missions.js` (8 jobs + crew + respect), `combat.js` (weapon slots),
`hud.js` (incl. minimap with route line), `audio.js`, `save.js`,
`effects.js` (incl. fire + explosions), `ui.js`, `input.js`, `utils.js`.
Everything — city, characters, vehicles, story, art and sound — is original
work made for this entry.

---

<sub>Entered on [make.fun](https://make.fun/?ref=m1wzkt80&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
