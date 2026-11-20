# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/golden-lark-12/solmar-bay-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/golden-lark-12/solmar-bay-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an open-world crime game in the spirit of GTA 6, built for the
make.fun gta6-01 bounty. Ria Solano, getaway driver, owes a debt — and the only
way out is through it. Explore a sun-soaked coastal city on foot and by car:
steal cars, outrun the police, run jobs across town, and collect cash stashes.

## The city

A full procedural city at dusk: downtown glass towers, suburbs, parks and palm
trees, a beach with a pier and a marina, and a causeway bridge out to an island
with a lighthouse. Traffic loops the road grid, pedestrians stroll the
sidewalks (and scatter when shots are fired), and streetlights glow as the sun
sits low over the ocean.

## Systems

- **On foot:** WASD + mouse look (pointer lock), Shift to run, third-person camera
- **Driving:** E to enter or exit, WASD to drive, Space to brake / handbrake,
  follow camera, speedometer, headlights, skid smoke
- **Car stealing:** E near any parked or traffic car — the driver bails and the
  car is yours, but the law notices
- **Wanted level 0–5 stars:** rises on stealing, hitting pedestrians and
  shooting; police cars spawn, chase and ram; hide to cool off; get busted or
  wasted and you pay a fine and wake up across town
- **Combat:** F to punch, mouse-click pistol (12 rounds, R to reload, hitscan
  with tracer and muzzle flash)
- **Missions — "The Debt":** M1 Hot Wheels (steal a car, reach the drop-off,
  lose a 1-star wanted level), M2 The Drop (pick up a package at the marina,
  deliver it across town at 2 stars), M3 Causeway Run (final getaway across
  the bridge at 3 stars)
- **Free roam:** 10 cash stashes to collect and a 5-gate checkpoint time trial
- **HUD:** health, cash, wanted stars, ammo, objective line, and a live
  minimap with roads, the player arrow, police dots, traffic and the mission blip
- **Menus & save:** start screen (Start Story / Free Roam / Continue), pause
  with Esc, save/load via localStorage (cash, missions, position, stashes)
- **Audio:** 100% synthesised WebAudio — engine hum by speed, two-tone siren,
  gunshots, pickup chimes, mission jingles, ambient dusk pad. M to mute. No
  audio files.

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
| Click | Shoot pistol |
| F | Punch |
| R | Reload |
| Esc | Pause |
| M | Mute |

## Structure

`game/src/` is split into one file per system: `main.js` (boot + loop +
shot mode), `city.js`, `player.js`, `vehicle.js`, `traffic.js`,
`pedestrians.js`, `police.js`, `missions.js`, `combat.js`, `hud.js`
(incl. minimap), `audio.js`, `save.js`, `effects.js`, `ui.js`, `input.js`,
`utils.js`. Everything — city, characters, vehicles, story, art and sound —
is original work made for this entry.

---

<sub>Entered on [make.fun](https://make.fun/?ref=m1wzkt80&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
