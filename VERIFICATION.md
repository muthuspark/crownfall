# Implementation verification

Verified on 2026-10-28 in Linux, Node.js 22.20.0, Chrome 139, Intel Core i7-9700K (8 logical CPUs). Other applications were running; these are development-machine observations, not isolated performance guarantees.

## Automated

`npm test`: 27 passing tests across simulation, IndexedDB storage, and the actual service-worker script. Coverage includes a seeded 30-minute defended match that requires the AI to grow, advance to Castle Age, gather resources, and send repeated raids. Additional tests exercise 120 units, both victory outcomes, a commanded army destroying a Town Center, save/resume equivalence, blocked storage, unreachable resource pockets, cargo preservation when changing jobs, subdirectory asset caching, and `Vary: Origin` offline-cache behavior.

`npm run build`: TypeScript checks and production build pass. The static build contains bundled HTML, CSS, JavaScript, favicon, and a versioned service worker. The development benchmark is excluded. `npm audit`: zero reported vulnerabilities at verification time.

## Browser checks

- Opened the game, started a skirmish, selected units by clicking and the idle-villager shortcut, and selected the Town Center with H.
- Trained a villager and verified the food deduction and active queue.
- Selected a villager and ordered gathering by right-clicking a resource; the HUD reflected the gathering order.
- Placed a house on the battlefield; verified a 35 wood deduction and the villager's construction order.
- Paused the game and verified local saving, then reloaded and resumed the saved match.
- Loaded the production game at 1280×720, waited for “Offline ready,” queued a villager, and paused to save. Stopped the HTTP server and confirmed the origin could no longer be reached with curl. Reloaded the browser: the game shell, styles, and pixel artwork loaded from the service worker. Resumed the IndexedDB save offline; 250 food and the active villager queue were preserved.
- Inspected the desktop HUD at 1280×720 and at a larger desktop viewport. Rendering benchmark exercised 1920×1080 as well.
- Inspected the browser console during the renderer benchmark; no warnings or errors were reported.

## Performance observations

The development-only `/qa.html` scene retains 120 units, exercises group routing and combat, and samples actual requestAnimationFrame timing. At DPR 1:

| Viewport  | Observed FPS samples | Draw time    | Simulation time per rendered frame |
| --------- | -------------------- | ------------ | ---------------------------------- |
| 1280×720  | 23.8–48.9            | 2.22–2.56 ms | 0.48–0.60 ms                       |
| 1920×1080 | 25.2                 | 3.52 ms      | 0.33 ms                            |

The 30 FPS target was not consistently met in this browser session, despite low measured drawing and simulation costs. Further testing under controlled foreground conditions and on additional GPUs is needed before claiming a sustained minimum. Frame scheduling includes browser/OS work that the benchmark does not attribute.

## Remaining validation limits

- Chrome was exercised interactively. Firefox and Edge have not been manually checked.
- Match duration and difficulty need human playtesting. The 30-minute automated soak keeps the player's Town Center alive deliberately to observe continued AI development; it does not establish that a normal match lasts exactly 20–30 minutes.
- Victory and defeat are covered at the simulation level; neither full outcome was played to completion manually in the browser.
- The battlefield uses spatial mouse interaction and is not fully playable with a screen reader. Small screens intentionally show a desktop-use message.

## Villager sprite upgrade (2026-10-29)

- Rendered original Blender characters for both teams: seven actions, eight directions, eight frames per action (896 frames total).
- Verified every atlas frame is nonempty, has transparent surroundings, and stays inside its cell. Quantized each sheet to under 400 KB.
- Added animation tests for all eight projected directions, walking/work/carry transitions, tool selection, retained idle facing, and reduced motion. Added offline-cache coverage for both sheets.
- `npm test`: 31 tests pass. `npm run build`: TypeScript and production build pass.
- Visually checked the compact resource bar and new villagers in Chrome; selected a villager and ordered tree gathering. Confirmed wood gathering and delivery increased the resource counter.
