# Puerto Alba — an open-world crime story

A sun-soaked coastal open-world crime game that runs entirely from static
files under `game/`. No build step, no network requests, no accounts.
Open `game/index.html` in desktop Chrome (or run `node serve.ts` and visit
http://localhost:8080) and play with keyboard and mouse.

## The story — "The Debt"

Ria Solano, getaway driver, owes Don Rafael Alba forty grand. Eight jobs
stand between her and freedom:

| # | Job | Giver |
|---|-----|-------|
| M1 | Hot Wheels | Marco "Wrench" Vela |
| M2 | The Drop | Lena Cruz |
| M3 | Causeway Run | Dario Font |
| M4 | Harbor Lights | Sofia Marin |
| M5 | The Vault Job | Elias "Ledger" Prado |
| M6 | Ghost in the Machine | Mina Okafor |
| M7 | Payback at the Docks | Tito Rivas |
| M8 | The Debt Paid | Don Rafael Alba |

Each job pays cash and respect points (RP). Respect raises Ria's rank —
Wheelman, Getaway Driver, Street Legend, Ghost of Alba, Queen of the
Causeway — and finishing jobs unlocks new weapons. Her crew of three
travels with her: Jax the getaway driver, Mina the hacker, and Tito the
muscle, each with an ability on a cooldown (Z / X / C).

## What is in the game

- A full 3D city at golden hour: avenues, towers with lit windows, a beach
  with palms and umbrellas, a bay, and a causeway to an island — built with
  vendored three.js 0.160.0 (`game/vendor/three.min.js`).
- On foot and by car: steal any parked car (E), drive with arcade physics,
  car condition and damage.
- Traffic that loops the avenues and pedestrians who stroll the sidewalks —
  and run when trouble starts.
- Wanted level 0–5 with the Alba PD: pursuit cars that flank and ram,
  roadblocks, and Air One, the police helicopter with a searchlight.
- Combat: six weapon slots (fists, pistol, SMG, shotgun, rifle, launcher)
  with ammo, reloads and locked states.
- A dense HUD: wanted stars, cash, health/armor, respect and rank, the Alba
  PD dispatch panel with named units and distances, a minimap with a gold
  route line, weapon slots, a dialogue box, stage bars, a timer, the radio
  station, car condition and the crew panel.
- Start screen, pause menu, localStorage saves, and a fully synthesized
  WebAudio soundtrack: engine hum, sirens, gunshots, booms and radio
  jingles. No audio files.

## Controls

- WASD / arrows — drive or move (Shift to sprint on foot)
- E — steal a car / exit a car
- Mouse drag — orbit the camera; click — shoot
- 1–6 — weapons, R — reload
- Z / X / C — crew abilities (Slipstream, Loop Feeds, Ram)
- J — start the next job, V — change radio station, H — horn
- M — mute, P / Esc — pause

## Files

- `game/index.html` — the page and the whole HUD layout
- `game/src/utils.js` — math, formatting and DOM helpers
- `game/src/save.js` — localStorage saves
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/input.js` — keyboard and mouse
- `game/src/city.js` — the city, beach, causeway, collision
- `game/src/vehicle.js` — cars and arcade driving
- `game/src/traffic.js` — ambient traffic
- `game/src/pedestrians.js` — sidewalk crowds
- `game/src/player.js` — Ria on foot
- `game/src/police.js` — wanted level, pursuit, helicopter, roadblocks
- `game/src/combat.js` — weapons, ammo, hit tests
- `game/src/effects.js` — explosions, smoke, sparks, camera shake
- `game/src/missions.js` — the eight story jobs
- `game/src/hud.js` — HUD, dispatch panel, minimap, dialogue
- `game/src/ui.js` — start / pause / busted screens
- `game/src/main.js` — boot, game loop, camera, screenshot staging
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`
- `serve.ts` — tiny static dev server

## Screenshots

`screenshots/` holds four renders of the game itself, staged with `?shot=`
parameters: 1-chase (the cover: golden-hour pursuit with Air One overhead),
2-steal, 3-mission, 4-vista.

## Originality

Puerto Alba, Ria Solano, the Alba PD, the crew and every job are original
creations for this entry. Nothing here copies any commercial game — no
names, characters, maps, art or music from any other title.
