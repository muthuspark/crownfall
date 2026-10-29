/** Development-only diagnostic entry. Not included in the production build. */
import { Game, FIXED_STEP, type UnitKind } from "./game";
import { Renderer } from "./render";
if (import.meta.env.DEV) {
  const canvas = document.querySelector<HTMLCanvasElement>("#benchmark")!,
    output = document.querySelector<HTMLOutputElement>("#metrics")!,
    game = new Game();
  game.state.units = [];
  game.state.buildings = [];
  game.state.nodes = game.state.nodes.filter(
    (n) => n.x < 23 || n.x > 49 || n.y < 23 || n.y > 49,
  );
  game.state.ai.nextThink = Infinity;
  game.state.ai.nextRaid = Infinity;
  for (let team = 0; team < 2; team++) {
    game.state.players[team].explored.fill(1);
    game.addBuilding(
      "townCenter",
      team as 0 | 1,
      team === 0 ? 21 : 47,
      team === 0 ? 21 : 47,
    );
    for (let i = 0; i < 60; i++)
      game.addUnit(
        (["spearman", "archer", "cavalry"] as UnitKind[])[i % 3],
        team as 0 | 1,
        26 + (i % 10) * 0.7 + team * 10,
        26 + Math.floor(i / 10) * 0.7 + team * 10,
      );
  }
  for (const u of game.state.units) u.hp = u.maxHp = 100000;
  game.rebuildBlocked();
  const renderer = new Renderer(canvas);
  renderer.camera = { x: 36, y: 36 };
  renderer.zoom = 1.2;
  // Exercise routing and combat each frame, retaining 120 entities throughout the run.
  for (const team of [0, 1] as const)
    game.command(
      game.state.units.filter((u) => u.team === team).map((u) => u.id),
      { kind: "attackMove", x: 36, y: 36 },
      team,
    );
  let previous = performance.now(),
    accumulator = 0,
    frames = 0,
    sampled = 0,
    start = previous,
    drawTime = 0,
    simulationTime = 0;
  function frame(now: number) {
    const delta = Math.min((now - previous) / 1000, 0.25);
    previous = now;
    accumulator += delta;
    const simStart = performance.now();
    while (accumulator >= FIXED_STEP) {
      for (const u of game.state.units) u.hp = u.maxHp;
      game.update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
    simulationTime += performance.now() - simStart;
    const drawStart = performance.now();
    renderer.draw(game, now);
    drawTime += performance.now() - drawStart;
    frames++;
    if (now - start >= 1000) {
      sampled++;
      output.textContent = `${innerWidth} × ${innerHeight} · DPR ${devicePixelRatio}\nUnits: ${game.state.units.length} / 120\nFPS: ${((frames * 1000) / (now - start)).toFixed(1)}\nRender: ${(drawTime / frames).toFixed(2)} ms/frame\nSimulation: ${(simulationTime / frames).toFixed(2)} ms/frame\nSamples: ${sampled}`;
      frames = 0;
      drawTime = 0;
      simulationTime = 0;
      start = now;
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", () => renderer.resize());
  requestAnimationFrame(frame);
}
