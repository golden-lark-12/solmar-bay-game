[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/golden-lark-12/solmar-bay-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/golden-lark-12/solmar-bay-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Puerto Alba — an open-world crime story

Puerto Alba: 3D golden-hour open-world crime — 12 'The Debt' story jobs as Ria Solano, 5 districts, 5-star tactical dispatch (P-12/P-07 pursuit & ramming, roadblocks, CONDOR-1 spotlight air unit), on-foot & vehicle combat, weapon wheel, crew abilities, street races, garage, ALBA FM radio & saves.

A sun-soaked coastal open-world crime game that runs entirely from static
files under `game/`. No build step, no network requests, no accounts.
Open `game/index.html` in desktop Chrome (or run `node serve.ts` and visit
http://localhost:8080) and play with keyboard and mouse.

## The story — "The Debt"

Ria Solano owes Don Rafael Alba $40,000. Drive, steal, race and fight your
way out of the debt across five districts of Puerto Alba, from Marina Row to
the island club, with the whole Alba police department on your tail.

## The 12 jobs

| Job | Name | Giver | District |
| --- | --- | --- | --- |
| M1 | Hot Wheels | Kiki Maro, Wheelwoman | Marina Row |
| M2 | The Drop | Lena Kade, Fixer | Marina Row |
| M3 | Causeway Run | Dario Voss, Wheelman | Causeway |
| M4 | Marina Lights | Sable Quinn, Marina Owner | Marina Row |
| M5 | Commerce Row Heat | Marco Venn, Fixer | Commerce Row |
| M6 | Island Lights | Iris Vale, Club Owner | The Island |
| M7 | Payback at the Docks | Don Rafael Alba, Don of Alba | Marina Row |
| M8 | The Debt Paid | Don Rafael Alba, Don of Alba | The Strand |
| M9 | Strand Grand Prix | Rex Calder, Race Promoter | The Strand |
| M10 | Tune-Up for Alba | Gus Ferran, Garage Mechanic | Marina Row |
| M11 | The Luna Vault | Sable Quinn, Marina Owner | The Strand |
| M12 | Alba's Last Call | Don Rafael Alba, Don of Alba | The Island |

Press M to start the next job. Each job pays cash and RP, and some unlock
new weapons. Finish M8 to pay the debt — then M12 closes the story.

## Crew

Three crew members ride with you, each with one ability on a cooldown:

- **Kiki Maro** (KM) — Slipstream, key Z, 25s cooldown. A burst of speed.
- **Lena Kade** (LK) — Loop Feeds, key X, 30s cooldown. Drops one wanted star.
- **Dario Voss** (DV) — Ram, key C, 20s cooldown. Wrecks the nearest cruiser.

## Ranks

Earn RP from jobs and races to climb the ladder:

- Wheelman — 0 RP
- Street Hustler — 250 RP
- Fixer — 550 RP
- Ghost of Alba — 900 RP
- King of Alba — 1400 RP

## What is in the game

- **Garage shop** — Alba Garage sells the Nitro Kit, Engine Tune and Armor
  Plating. Park near the garage and press G to buy.
- **Street races** — the Strand Grand Prix (M9): seven gates, three rivals,
  best time saved on the board.
- **Districts + standing** — five districts (The Strand, Marina Row,
  Commerce Row, Causeway, The Island). Standing rises as you work each
  district.
- **Nitro boost** — hold Shift with the Nitro Kit installed to burn the
  nitro meter for a big speed boost.
- **Weapon wheel** — hold Tab and pick 1-6 to swap weapons mid-fight.
- **Police heat** — a five-star wanted system with pursuit cruisers,
  roadblocks and the CONDOR-1 helicopter with its spotlight.
- **Radio** — ALBA FM 98.1, "Golden Hour Drive" and more.
- **Landmarks** — the ferris wheel on the pier, Casino Luna, the island
  clubhouse, the lighthouse, and the beach at golden hour.

## Weapons

| Weapon | Ammo | Unlock |
| --- | --- | --- |
| Pistol | 120 | start |
| SMG | 240 | start |
| Pump Shotgun | 48 | M3 Causeway Run |
| Carbine | 180 | M5 Commerce Row Heat |
| Grenade Launcher | 12 | M7 Payback at the Docks |
| Sniper | 20 | M11 The Luna Vault |

## Controls

- WASD / Arrows — drive & walk
- E — steal / enter car
- Shift — nitro boost (with Nitro Kit)
- Mouse click — shoot
- Tab (hold) — weapon wheel
- F — swap weapon
- Z / X / C — crew abilities
- G — garage shop (near Alba Garage)
- M — start next job
- P — pause

## Files

```
game/
  index.html        entry point
  style.css         HUD + screen styles
  src/
    main.js         boot, game loop, camera, screenshot staging
    city.js         the city: roads, buildings, beach, water, sun, signs
    hud.js          HUD: cash, rank, mission panel, dispatch, minimap
    police.js       wanted levels, cruisers, dispatch, helicopter
    vehicle.js      cars: body, glass cabin, wheels, light bars
    player.js       Ria on foot
    traffic.js      traffic cars
    pedestrians.js  pedestrians
    missions.js     the 12 jobs, ranks, stages
    races.js        street races, checkpoints, best times
    districts.js    the 5 districts + standing
    garage.js       garage shop + upgrades
    combat.js       weapons, firing, wheel selection
    effects.js      explosions, muzzle flashes, sparks, smoke
    ui.js           start / pause / end screens
    input.js        keyboard + mouse
    audio.js        engine, sirens, radio, sound effects
    save.js         save / load
    utils.js        math helpers
  vendor/
    three.min.js    Three.js
```

## Screenshots

- `screenshots/1-title.jpg` — live 3D title screen at the waterfront, Ria's car, lighthouse, ferris wheel, Casino Luna, zero gameplay HUD
- `screenshots/2-chase.jpg` — 5-star high-speed chase at 135 km/h, nitro, two-tone cruisers, CONDOR-1 spotlight
- `screenshots/3-combat.jpg` — on-foot shootout, small muzzle flash + tracers, corner Don Rafael comms, no Tab panel
- `screenshots/4-race.jpg` — twilight street race on the Strand

Take fresh ones with `node take-shots.mjs`. Run the full playtest with
`node playtest.mjs`.
