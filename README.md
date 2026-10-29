# Crownfall

An original, Age of Empires II inspired medieval RTS MVP. One human, one relaxed AI, one designed isometric battlefield. Simulation, AI, rendering, and saved matches run entirely in the browser.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Use a desktop keyboard and mouse; 1280×720 or larger is recommended.

```sh
npm test
npm run build
npm run preview
```

`dist/` is the complete static game. Serve it from any static HTTP host, including a subdirectory. No backend, environment variables, account, external fonts, CDN, or API keys are needed. `qa.html` is a development-only renderer benchmark, available through the dev server and excluded from production output.

## Play

Start with five villagers, two spearmen, a Town Center, a house, and a barracks. Train villagers at the Town Center. Gather food from berries and farms, wood from trees, and gold from deposits. Villagers carry resources back to the Town Center. Build houses to increase population capacity, up to 60 villagers and soldiers per side.

Build an archery range for archers. Research Castle Age at the Town Center for 600 food and 300 gold to unlock stables and cavalry. Forged Arms then provides +2 attack and +20% health to existing and future units.

Spearmen counter cavalry, cavalry counter archers, and archers counter spearmen. Town Centers fire defensive arrows. Destroy the enemy Town Center to win; losing yours ends the match. Scouting permanently reveals terrain and enemy activity in explored areas. The AI follows the same resource and population rules, develops its economy, advances, defends, and sends periodic raids.

The opening objectives are dismissible. There is no audio. Matches target 20–30 minutes; actual duration depends on your play and the balance is intentionally preliminary.

| Action                                | Control                                               |
| ------------------------------------- | ----------------------------------------------------- |
| Select                                | Left click                                            |
| Select a group                        | Drag a rectangle                                      |
| Add/remove from selection             | Shift + click                                         |
| Select visible units of one type      | Double click                                          |
| Move, gather, build, attack           | Right click the target                                |
| Attack-move                           | Q, then left click                                    |
| Stop                                  | X                                                     |
| Move camera                           | WASD, arrow keys, screen edges, or middle-button drag |
| Zoom                                  | Scroll, +, −                                          |
| Assign / recall a control group       | Ctrl/Cmd + 1–9 / 1–9                                  |
| Find the next idle villager           | .                                                     |
| Select and center on Town Center      | H                                                     |
| Pause / cancel placement              | Escape                                                |
| Controls reference                    | ? button or F1                                        |
| Set a production rally point          | Select a building, then right click the field         |
| Cancel a queued item with full refund | Click its queue entry                                 |

Select a villager to open the construction palette. Choose a building and click clear, explored ground. Hold Shift to place more than one. Right-click or Escape cancels placement. An unfinished building can receive more builders by selecting villagers and right-clicking it.

## Saves and offline use

There is one match slot in IndexedDB. The game saves every 30 simulated seconds, on pause, and at the end of a match. Starting another match replaces this slot after an inline confirmation. Resume restores active orders, queues, resources, exploration, and seeded simulation timing. Selection, camera position, and control groups are session UI state and reset after a reload.

The game pauses when its tab becomes hidden or loses focus. Storage failures show an inline warning and leave gameplay available. Saves are specific to the browser profile and origin; clearing site data removes them. There is no cloud sync or save export.

The **production build** registers a service worker and caches its complete shell, JavaScript, CSS, and favicon. Wait for “Offline ready” on the main menu after the first load. You can then close and reopen the same URL without a network connection. Service workers require HTTPS or localhost; directly double-clicking `index.html` is unsupported. Development mode intentionally skips offline caching. Each production build gets a content-derived cache version.

## Code and tuning

- `src/game.ts`: serializable game state, seeded map, fixed-step simulation, resource accounting, construction, queues, A\* routing, exploration, combat, AI, and save validation. Unit/building definitions and research costs are exported near the top; gathering and AI pacing are implemented in the same module.
- `src/render.ts`: Canvas 2D isometric terrain, original artwork, depth ordering, effects, placement previews, selection, and minimap. Terrain, buildings, and soldiers are generated from code and cached in offscreen canvases.
- `src/villager.ts`: eight-direction villager sprites with idle, walking, chopping, mining, carrying, building, and gathering animations. Animation follows simulation time, so pausing freezes it. Reduced-motion mode uses static poses.
- `public/art/villager-{blue,red}.png`: bundled transparent sprite atlases rendered from an original articulated Blender model. Both are cached for offline play.
- `scripts/render-villager.py`: reproducible villager model and atlas generator. The shipped PNGs require no Blender installation to play or build. To regenerate, use Blender 4+ with Pillow available to its Python interpreter and run `blender --background --python scripts/render-villager.py`. Alternatively, install Python 3.11 with `bpy==4.3.0` and `Pillow`, then run `python scripts/render-villager.py`.
- `src/main.ts` / `src/style.css`: semantic HTML menus and HUD, desktop input, tutorial objectives, pause, results, and autosave orchestration.
- `src/storage.ts`: atomic IndexedDB match storage. `public/sw.js` and `vite.config.ts`: offline shell and build-specific cache versioning.

The simulation advances in fixed 100 ms steps and pauses rather than catching up after a hidden tab. Units use eight-direction A\* without cutting blocked corners, spread group destinations, and use local separation. Workers retarget depleted or unreachable resources. Construction checks that a selected builder can reach the site. The MVP uses exploration-only visibility; revealed areas are never re-hidden. Archers do not simulate projectile obstruction by trees or buildings.

## Validation

Automated coverage includes resource deliveries and depletion, changing jobs with cargo, renewable farms, construction costs and placement, training queues and refunds, population, age unlocks, upgrades, routing, unreachable pockets, group movement, combat counters and victory, exploration, deterministic save/resume, damaged saves, and denied browser storage. A seeded 30-minute defended simulation checks AI gathering, growth, age advancement, and repeated raids. A 120-unit test exercises the simulation workload.

See `VERIFICATION.md` for the browser checks and measurements performed for this implementation. Browser testing is not a substitute for further match balancing or testing on additional hardware.

## Assets and scope

All battlefield artwork, interface styling, and the crown favicon were authored for this project. No commercial Age of Empires art, music, branding, or files are included. System fonts require no downloads. Vite, TypeScript, Vitest, and fake-indexeddb are development dependencies; the production game has no runtime packages.

This MVP intentionally omits multiplayer, campaigns, naval units, siege, walls, towers, trading, diplomacy, additional civilizations, sound, mobile controls, and full nonvisual battlefield interaction.
