import "./style.css";
import {
  Game,
  BUILDING,
  UNIT,
  ADVANCE_COST,
  UPGRADE_COST,
  POP_LIMIT,
  FIXED_STEP,
  SIZE,
  center,
  resourceOf,
  type BuildingKind,
  type UnitKind,
  type Entity,
  type Building,
  type Cost,
  type Point,
  type Order,
} from "./game";
import { Renderer } from "./render";
import { loadMatch, saveMatch, type SavedMatch } from "./storage";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<canvas id="battlefield" aria-label="Isometric battlefield. Select with left click, command with right click. See the controls reference for keyboard commands." tabindex="0"></canvas>
<div id="game-ui" hidden>
  <header class="topbar">
    <button class="wordmark" id="home-button" title="Pause game">♜ <span>CROWNFALL</span></button>
    <div class="resources" aria-label="Your resources">
      <div class="resource" title="Food · gathered from berries and farms"><span class="resource-icon food">◒</span><span><strong id="food">300</strong><small>FOOD</small></span></div>
      <div class="resource" title="Wood · gathered from trees"><span class="resource-icon wood">♠</span><span><strong id="wood">400</strong><small>WOOD</small></span></div>
      <div class="resource" title="Gold · mined from deposits"><span class="resource-icon gold">◆</span><span><strong id="gold">120</strong><small>GOLD</small></span></div>
      <div class="resource population" title="Population · build houses to increase capacity, up to 60"><span class="resource-icon">♟</span><span><strong id="population">7 / 15</strong><small>POPULATION</small></span></div>
    </div>
    <div class="match-info"><span class="age-badge" id="age">I</span><div><strong id="age-name">Feudal Age</strong><small id="clock">00:00</small></div></div>
    <button class="square" id="help-button" title="Controls and help" aria-label="Controls and help">?</button>
    <button class="square" id="pause-button" title="Pause (Escape)" aria-label="Pause game">Ⅱ</button>
  </header>
  <aside class="objectives" id="objectives"><div class="eyebrow"><span class="little-diamond">◆</span> YOUR FIRST KINGDOM <button id="dismiss-objectives" aria-label="Dismiss guided objectives">×</button></div><h2 id="objective-title"></h2><p id="objective-copy"></p><div class="objective-footer"><span id="objective-count"></span><div id="objective-dots"></div></div></aside>
  <div class="enemy-label"><span class="enemy-dot"></span> THE CRIMSON KEEP <span>RELAXED AI</span></div>
  <div id="notices" role="status" aria-live="polite"></div>
  <div id="command-hint" class="command-hint" hidden></div>
  <div class="bottom-dock">
    <section class="selection-panel" aria-label="Selected entity"><div id="portrait" class="portrait"><span>♜</span></div><div class="selection-copy"><div id="selection-meta" class="eyebrow">THE BLUE BANNER</div><h2 id="selection-name">Your kingdom awaits</h2><div id="selection-detail">Select a villager or building to give an order.</div><div id="selection-health"></div></div></section>
    <section class="commands-panel" aria-label="Available commands"><div class="command-heading"><span id="commands-title">COMMANDS</span><span id="command-caption">Left click to select · Right click to command</span></div><div id="commands" class="commands"></div><div id="queue" class="queue"></div></section>
    <section class="map-panel"><div class="map-heading"><span>THE KING'S MEADOW</span><span>N ↗</span></div><canvas id="minimap" width="168" height="168" tabindex="0" role="button" aria-label="Minimap. Click to move camera; keyboard users can use W A S D on the battlefield."></canvas></section>
  </div>
  <footer class="battle-footer"><span><span class="team-dot"></span> YOU · BLUE BANNER</span><span id="save-status">All progress stays on this device</span><span id="zoom-label">110%</span></footer>
</div>
<section id="menu" class="menu-screen">
  <div class="menu-shade"></div><div class="menu-content"><div class="menu-eyebrow"><span></span> A BROWSER STRATEGY GAME</div><h1>CROWN<span>FALL</span><i>Build a kingdom.<br>Leave a legacy.</i></h1><p class="menu-description">A quiet meadow. Two rival banners.<br>Gather your people, raise an army, and claim the field.</p>
  <div id="menu-actions" class="menu-actions"><button id="new-game" class="primary">Begin a skirmish <span>↗</span></button><button id="resume-game" class="secondary" hidden>Continue your kingdom <span>→</span></button><button id="menu-help" class="text-button">How to play <span>?</span></button></div>
  <div id="new-confirm" class="inline-confirm" hidden><p>A new skirmish will replace your saved kingdom.</p><button id="confirm-new" class="primary">Start a new kingdom →</button><button id="cancel-new" class="text-button">Keep my kingdom</button></div>
  <div class="menu-facts"><span>01 <small>PLAYER VS. AI</small></span><span>02 <small>AGES TO MASTER</small></span><span>60 <small>POPULATION LIMIT</small></span></div></div>
  <aside class="map-note"><div class="eyebrow">SKIRMISH 01</div><h2>The King's Meadow</h2><p>Temperate grasslands · Balanced resources<br>One rival · 20–30 minute matches</p><span><i class="team-dot"></i> YOUR SETTLEMENT</span></aside>
  <footer class="menu-footer"><span>AN ORIGINAL MEDIEVAL RTS</span><span id="offline-status">CLIENT SIDE · NO ACCOUNT NEEDED</span></footer>
</section>
<section id="pause-screen" class="overlay" hidden><div class="dialog pause-dialog"><div class="eyebrow">A MOMENT OF RESPITE</div><h2>Your kingdom can wait.</h2><p>The battlefield is paused. Resume whenever you’re ready.</p><div class="dialog-actions"><button id="continue-game" class="primary">Return to the field <span>→</span></button><button id="save-now" class="secondary">Save now</button><button id="pause-help" class="secondary">Controls & help</button><button id="restart-button" class="text-button">Restart skirmish</button><button id="return-menu" class="text-button">Main menu</button></div><div id="restart-confirm" class="inline-confirm" hidden><p>Replace this match with a fresh kingdom?</p><button id="confirm-restart" class="primary">Restart match</button><button id="cancel-restart" class="text-button">Keep playing</button></div></div></section>
<section id="help-screen" class="overlay" hidden><div class="dialog help-dialog"><div class="eyebrow">FIELD MANUAL</div><h2>A kingdom, one order at a time.</h2><div class="help-grid"><div><h3>Raise your settlement</h3><p>Select villagers, then right-click berries, trees, or gold. They carry resources back to your Town Center. Build houses for room to grow, and farms for lasting food.</p><h3>Raise your banner</h3><p>Train spearmen at the barracks and archers at an archery range. Reach Castle Age at your Town Center to unlock stables, cavalry, and Forged Arms.</p><h3>Claim the field</h3><p>Spears beat cavalry. Cavalry beat archers. Archers beat spears. Destroy the Crimson Town Center to win. Explored areas remain visible.</p></div><dl><div><dt>Select / group select</dt><dd>Click / drag</dd></div><div><dt>Add to selection</dt><dd>Shift + click</dd></div><div><dt>Move / gather / attack</dt><dd>Right click</dd></div><div><dt>Attack-move</dt><dd>Q, then click</dd></div><div><dt>Stop</dt><dd>X</dd></div><div><dt>Move camera</dt><dd>W A S D / arrows / edges</dd></div><div><dt>Zoom</dt><dd>Scroll / + / −</dd></div><div><dt>Create / recall group</dt><dd>Ctrl + 1–9 / 1–9</dd></div><div><dt>Find idle villager</dt><dd>.</dd></div><div><dt>Center on Town Center</dt><dd>H</dd></div><div><dt>Pause / cancel build</dt><dd>Escape</dd></div></dl></div><p class="help-note">Select a production building and right-click the ground to set its rally point. Click a queued item to cancel it for a full refund. Each side can field 60 villagers and soldiers combined.</p><button id="close-help" class="primary">Understood <span>→</span></button></div></section>
<section id="result-screen" class="overlay" hidden><div class="dialog result-dialog"><div class="eyebrow" id="result-eyebrow"></div><h2 id="result-title"></h2><p id="result-copy"></p><div id="result-stats" class="result-stats"></div><button id="play-again" class="primary">Raise a new banner <span>→</span></button><button id="result-menu" class="text-button">Main menu</button></div></section>
<div id="storage-warning" class="storage-warning" role="status" hidden></div>
<div id="small-screen"><span>♜</span><h2>Your kingdom needs a little more room.</h2><p>Play on a desktop or laptop with a keyboard and mouse. A window at least 1000 pixels wide works best.</p></div>
`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("battlefield"),
  renderer = new Renderer(canvas),
  mini = $<HTMLCanvasElement>("minimap");
let game = new Game(),
  running = false,
  started = false,
  screen: "menu" | "game" | "paused" | "result" = "menu",
  saved: SavedMatch | undefined,
  storageAvailable = true,
  helpReturn: "menu" | "game" | "paused" = "menu",
  attackMode = false,
  saving = false,
  lastSave = 0,
  uiClock = 0,
  accumulator = 0,
  lastFrame = performance.now(),
  resultShown = false;
let pointerStart: Point | null = null,
  middleStart: Point | null = null,
  dragMoved = false,
  lastCommandKey = "",
  lastQueueKey = "",
  lastPortrait = "",
  lastObjective = -1,
  tutorialDismissed = false;
let groups: Record<string, number[]> = {};
const icons = new Map<string, string>();
const icon = (kind: BuildingKind | UnitKind) => {
  if (!icons.has(kind)) icons.set(kind, renderer.icon(kind));
  return icons.get(kind)!;
};
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const costText = (cost: Cost) =>
  Object.entries(cost)
    .map(([r, n]) => `${n} ${r}`)
    .join(" · ");
function selected() {
  return [...renderer.selection]
    .map((id) => game.find(id))
    .filter((e): e is Entity => !!e);
}
function resetUI() {
  renderer.selection.clear();
  groups = {};
  renderer.placement = null;
  attackMode = false;
  lastCommandKey = "";
  lastQueueKey = "";
  lastPortrait = "";
  lastObjective = -1;
  resultShown = false;
  accumulator = 0;
}
function warnStorage(message: string) {
  storageAvailable = false;
  $("storage-warning").textContent = message;
  $("storage-warning").hidden = false;
  $("save-status").textContent = "Local saving unavailable";
}
async function persist() {
  if (!storageAvailable || !started || saving) return;
  saving = true;
  try {
    const raw = game.serialize();
    await saveMatch(raw);
    saved = { raw, savedAt: Date.now() };
    lastSave = game.state.time;
    $("save-status").textContent =
      `Saved locally · ${formatTime(game.state.time)}`;
    $("resume-game").hidden = false;
  } catch {
    warnStorage(
      "Your browser could not save this match. You can keep playing, but progress may be lost when this page closes.",
    );
  } finally {
    saving = false;
  }
}
function play() {
  screen = "game";
  running = true;
  renderer.active = true;
  $("menu").hidden = true;
  $("pause-screen").hidden = true;
  $("result-screen").hidden = true;
  $("game-ui").hidden = false;
  $("objectives").hidden = tutorialDismissed;
  canvas.focus();
  updateUI();
}
async function newGame() {
  if (saving) {
    game.notify("Please wait for the current save to finish.");
    return;
  }
  game = new Game();
  resetUI();
  if (storageAvailable) $("storage-warning").hidden = true;
  started = true;
  tutorialDismissed = false;
  lastSave = 0;
  renderer.camera = { x: 15, y: 15 };
  renderer.zoom = 1.1;
  $("new-confirm").hidden = true;
  $("menu-actions").hidden = false;
  $("restart-confirm").hidden = true;
  $("pause-screen").querySelector(".dialog-actions")!.removeAttribute("hidden");
  play();
  game.notify("Welcome, commander. Select your villagers to begin.");
  await persist();
}
function pause() {
  if (!started || screen !== "game") return;
  running = false;
  renderer.active = false;
  renderer.keys.clear();
  renderer.edge = { x: 0, y: 0 };
  screen = "paused";
  $("pause-screen").hidden = false;
  void persist();
  $("continue-game").focus();
}
function menu() {
  running = false;
  renderer.active = false;
  screen = "menu";
  renderer.keys.clear();
  $("menu").hidden = false;
  $("game-ui").hidden = true;
  $("pause-screen").hidden = true;
  $("result-screen").hidden = true;
  $("resume-game").hidden = !started && !saved;
  $("new-game").focus();
}
function requestNew() {
  if (started || saved) {
    $("menu-actions").hidden = true;
    $("new-confirm").hidden = false;
    $("confirm-new").focus();
  } else void newGame();
}
function showHelp() {
  helpReturn =
    screen === "game" ? "game" : screen === "paused" ? "paused" : "menu";
  if (screen === "game") pause();
  $("help-screen").hidden = false;
  $("close-help").focus();
}
function closeHelp() {
  $("help-screen").hidden = true;
  if (helpReturn === "game") play();
  else if (helpReturn === "paused") $("continue-game").focus();
  else $("menu-help").focus();
}
$("new-game").onclick = requestNew;
$("confirm-new").onclick = () => void newGame();
$("cancel-new").onclick = () => {
  $("new-confirm").hidden = true;
  $("menu-actions").hidden = false;
};
$("resume-game").onclick = () => {
  if (started) {
    if (game.state.winner !== null) {
      showResult();
      return;
    }
    play();
    return;
  }
  if (saved) {
    try {
      game = Game.restore(saved.raw);
      resetUI();
      started = true;
      renderer.camera = { x: 15, y: 15 };
      play();
      if (game.state.winner !== null) showResult();
    } catch {
      saved = undefined;
      $("resume-game").hidden = true;
      warnStorage(
        "The saved match could not be restored. Start a new skirmish to create a fresh save.",
      );
      storageAvailable = true;
    }
  }
};
$("pause-button").onclick = pause;
$("home-button").onclick = pause;
$("continue-game").onclick = play;
$("save-now").onclick = () => void persist();
$("return-menu").onclick = () => {
  void persist();
  menu();
};
$("help-button").onclick = showHelp;
$("menu-help").onclick = showHelp;
$("pause-help").onclick = showHelp;
$("close-help").onclick = closeHelp;
$("dismiss-objectives").onclick = () => {
  tutorialDismissed = true;
  $("objectives").hidden = true;
};
$("restart-button").onclick = () => {
  $("restart-confirm").hidden = false;
  $("pause-screen")
    .querySelector(".dialog-actions")!
    .setAttribute("hidden", "");
};
$("cancel-restart").onclick = () => {
  $("restart-confirm").hidden = true;
  $("pause-screen").querySelector(".dialog-actions")!.removeAttribute("hidden");
};
$("confirm-restart").onclick = () => void newGame();
$("play-again").onclick = () => void newGame();
$("result-menu").onclick = menu;
function showResult() {
  screen = "result";
  running = false;
  renderer.active = false;
  $("result-screen").hidden = false;
  const win = game.state.winner === 0;
  $("result-eyebrow").textContent = win
    ? "THE MEADOW IS YOURS"
    : "YOUR BANNER WILL RISE AGAIN";
  $("result-title").textContent = win
    ? "A kingdom well earned."
    : "Every kingdom has a beginning.";
  $("result-copy").textContent = win
    ? "The Crimson Keep has fallen. Your people have a new story to tell."
    : "Your Town Center has fallen. Rebuild, adapt, and return to the field.";
  const s = game.player.stats;
  $("result-stats").innerHTML =
    `<div><strong>${formatTime(game.state.time)}</strong><span>TIME ON THE FIELD</span></div><div><strong>${s.trained}</strong><span>UNITS TRAINED</span></div><div><strong>${s.kills}</strong><span>ENEMIES DEFEATED</span></div>`;
  resultShown = true;
  void persist();
  $("play-again").focus();
}
function setHint() {
  const text = renderer.placement
    ? `Place ${BUILDING[renderer.placement].name} · Left click to build · Escape to cancel`
    : attackMode
      ? "Attack-move · Click a destination · Escape to cancel"
      : "";
  $("command-hint").hidden = !text;
  $("command-hint").textContent = text;
  canvas.classList.toggle("placing", !!renderer.placement);
  canvas.classList.toggle("attacking", attackMode);
}
function beginBuild(kind: BuildingKind) {
  renderer.placement = kind;
  attackMode = false;
  setHint();
  canvas.focus();
}
function command(order: Order) {
  game.command([...renderer.selection], order);
  lastCommandKey = "";
  updateUI();
}
function contextOrder(p: Point) {
  const world = renderer.unproject(p);
  if (world.x < 0 || world.y < 0 || world.x >= SIZE || world.y >= SIZE) return;
  const target = renderer.hit(game, p),
    mine = selected().filter((e) => e.type !== "resource" && e.team === 0);
  const buildings = mine.filter(
    (e): e is Building =>
      e.type === "building" && e.kind !== "farm" && e.kind !== "house",
  );
  if (buildings.length && !mine.some((e) => e.type === "unit")) {
    for (const b of buildings) b.rally = { x: world.x, y: world.y };
    game.notify("Rally point set");
    game.effects.push({
      kind: "flag",
      ...world,
      tx: world.x,
      ty: world.y,
      life: 1,
      max: 1,
      team: 0,
    });
    return;
  }
  const villagers = mine.filter(
    (e) => e.type === "unit" && e.kind === "villager",
  );
  if (target?.type === "resource" && villagers.length) {
    command({ kind: "gather", target: target.id, x: target.x, y: target.y });
    return;
  }
  if (
    target?.type === "building" &&
    target.team === 0 &&
    villagers.length &&
    (target.progress < 1 || target.kind === "farm")
  ) {
    command({
      kind: target.progress < 1 ? "build" : "gather",
      target: target.id,
      ...center(target),
    });
    return;
  }
  if (target && target.type !== "resource" && target.team === 1) {
    command({ kind: "attack", target: target.id, ...center(target) });
    return;
  }
  command({ kind: "move", ...world });
}
canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (!running) return;
  if (renderer.placement || attackMode) {
    renderer.placement = null;
    attackMode = false;
    setHint();
    return;
  }
  contextOrder({ x: event.clientX, y: event.clientY });
});
canvas.addEventListener("pointerdown", (event) => {
  if (!running) return;
  canvas.focus();
  renderer.pointer = { x: event.clientX, y: event.clientY };
  if (event.button === 1) {
    event.preventDefault();
    middleStart = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (event.button !== 0) return;
  pointerStart = { x: event.clientX, y: event.clientY };
  dragMoved = false;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  const p = { x: event.clientX, y: event.clientY };
  renderer.pointer = p;
  if (!running) return;
  if (middleStart) {
    const dx = (p.x - middleStart.x) / renderer.zoom,
      dy = (p.y - middleStart.y) / renderer.zoom;
    renderer.camera.x -= dx / 48 + dy / 24;
    renderer.camera.y += dx / 48 - dy / 24;
    middleStart = p;
    return;
  }
  if (pointerStart && !renderer.placement && !attackMode) {
    if (Math.hypot(p.x - pointerStart.x, p.y - pointerStart.y) > 5)
      dragMoved = true;
    if (dragMoved) renderer.drag = { start: pointerStart, end: p };
  }
  renderer.hover = renderer.hit(game, p)?.id ?? null;
  renderer.edge = {
    x: p.x < 14 ? -1 : p.x > innerWidth - 14 ? 1 : 0,
    y: p.y < 76 ? -1 : p.y > innerHeight - 14 ? 1 : 0,
  };
});
canvas.addEventListener("pointerleave", () => {
  renderer.edge = { x: 0, y: 0 };
  renderer.hover = null;
});
canvas.addEventListener("pointerup", (event) => {
  if (event.button === 1) {
    middleStart = null;
    return;
  }
  if (event.button !== 0 || !pointerStart) return;
  const p = { x: event.clientX, y: event.clientY };
  pointerStart = null;
  if (!running) {
    renderer.drag = null;
    return;
  }
  if (renderer.placement) {
    const world = renderer.unproject(p),
      kind = renderer.placement;
    if (
      game.place(kind, Math.floor(world.x), Math.floor(world.y), 0, [
        ...renderer.selection,
      ])
    ) {
      if (!event.shiftKey) renderer.placement = null;
      game.notify(`Building ${BUILDING[kind].name.toLowerCase()}`);
    } else
      game.notify(
        "Cannot build here. Check resources, villagers, and clear explored ground.",
      );
    setHint();
    updateUI();
    return;
  }
  if (attackMode) {
    command({ kind: "attackMove", ...renderer.unproject(p) });
    attackMode = false;
    setHint();
    return;
  }
  if (!event.shiftKey) renderer.selection.clear();
  if (dragMoved && renderer.drag) {
    const a = renderer.drag.start,
      b = renderer.drag.end;
    for (const u of game.state.units) {
      if (u.team !== 0) continue;
      const s = renderer.project(u);
      if (
        s.x >= Math.min(a.x, b.x) &&
        s.x <= Math.max(a.x, b.x) &&
        s.y >= Math.min(a.y, b.y) - 5 &&
        s.y <= Math.max(a.y, b.y) + 20
      )
        renderer.selection.add(u.id);
    }
  } else {
    const e = renderer.hit(game, p);
    if (e) {
      if (event.shiftKey && renderer.selection.has(e.id))
        renderer.selection.delete(e.id);
      else renderer.selection.add(e.id);
    }
  }
  renderer.drag = null;
  lastCommandKey = "";
  updateUI();
});
canvas.addEventListener("pointercancel", () => {
  pointerStart = null;
  middleStart = null;
  renderer.drag = null;
});
canvas.addEventListener("dblclick", (event) => {
  if (!running || renderer.placement) return;
  const e = renderer.hit(game, { x: event.clientX, y: event.clientY });
  if (e?.type === "unit" && e.team === 0) {
    renderer.selection.clear();
    for (const u of game.state.units) {
      const p = renderer.project(u);
      if (
        u.team === 0 &&
        u.kind === e.kind &&
        p.x > 0 &&
        p.x < innerWidth &&
        p.y > 60 &&
        p.y < innerHeight - 180
      )
        renderer.selection.add(u.id);
    }
    updateUI();
  }
});
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    if (running)
      renderer.setZoom(renderer.zoom * (event.deltaY > 0 ? 0.9 : 1.1), {
        x: event.clientX,
        y: event.clientY,
      });
  },
  { passive: false },
);
mini.addEventListener("pointerdown", (event) => {
  if (!running) return;
  const r = mini.getBoundingClientRect();
  renderer.camera = {
    x: ((event.clientX - r.left) / r.width) * SIZE,
    y: ((event.clientY - r.top) / r.height) * SIZE,
  };
  canvas.focus();
});
window.addEventListener("pointermove", (event) => {
  if (event.target !== canvas) renderer.edge = { x: 0, y: 0 };
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    if (!$("help-screen").hidden) {
      closeHelp();
      return;
    }
    if (renderer.placement || attackMode) {
      renderer.placement = null;
      attackMode = false;
      setHint();
      return;
    }
    if (screen === "game") pause();
    else if (screen === "paused") play();
    return;
  }
  if (!running) return;
  const key = event.key.toLowerCase();
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
    ].includes(key)
  ) {
    event.preventDefault();
    renderer.keys.add(key);
  }
  if (event.repeat) return;
  if (key === "q") {
    attackMode = true;
    renderer.placement = null;
    setHint();
  }
  if (key === "x") command({ kind: "idle", x: 0, y: 0 });
  if (key === "h") {
    const tc = game.state.buildings.find(
      (b) => b.team === 0 && b.kind === "townCenter",
    );
    if (tc) {
      renderer.selection = new Set([tc.id]);
      renderer.camera = center(tc);
      updateUI();
    }
  }
  if (key === ".") {
    const list = game.state.units.filter(
      (u) => u.team === 0 && u.kind === "villager" && u.order.kind === "idle",
    );
    const index = list.findIndex((u) => renderer.selection.has(u.id));
    const u = list[(index + 1) % list.length];
    if (u) {
      renderer.selection = new Set([u.id]);
      renderer.camera = { x: u.x, y: u.y };
      updateUI();
    } else game.notify("All villagers are working.");
  }
  if (/^[1-9]$/.test(key)) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      groups[key] = [...renderer.selection];
      game.notify(`Control group ${key} assigned`);
    } else if (groups[key]) {
      renderer.selection = new Set(groups[key].filter((id) => !!game.find(id)));
      updateUI();
    }
  }
  if (key === "=" || key === "+") renderer.setZoom(renderer.zoom * 1.1);
  if (key === "-") renderer.setZoom(renderer.zoom * 0.9);
  if (key === "f1") {
    event.preventDefault();
    showHelp();
  }
});
window.addEventListener("keyup", (event) =>
  renderer.keys.delete(event.key.toLowerCase()),
);
window.addEventListener("blur", () => {
  renderer.keys.clear();
  renderer.edge = { x: 0, y: 0 };
  if (running) pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) pause();
});
window.addEventListener("resize", () => renderer.resize());
function actionButton(
  label: string,
  kind: BuildingKind | UnitKind | "advance" | "upgrade" | "attack" | "stop",
  cost: Cost,
  enabled: boolean,
  title: string,
  action: () => void,
) {
  const button = document.createElement("button");
  button.className = "action-button";
  button.disabled = !enabled;
  button.title = title;
  button.setAttribute(
    "aria-label",
    `${label}${Object.keys(cost).length ? ", " + costText(cost) : ""}. ${title}`,
  );
  const image =
    kind in BUILDING || kind in UNIT
      ? `<img src="${icon(kind as BuildingKind | UnitKind)}" alt="" draggable="false">`
      : `<span class="action-symbol">${kind === "advance" ? "♜" : kind === "upgrade" ? "⚒" : kind === "attack" ? "⚔" : "■"}</span>`;
  button.innerHTML = `${image}<span class="action-label">${label}</span><small>${
    Object.entries(cost)
      .map(
        ([r, n]) =>
          `<i class="cost-${r}">${r === "food" ? "◒" : r === "wood" ? "♠" : "◆"}</i> ${n}`,
      )
      .join(" ") || (kind === "attack" ? "Q" : "X")
  }</small>`;
  button.onclick = action;
  return button;
}
function updateCommands(selection: Entity[]) {
  const own = selection.filter((e) => e.type !== "resource" && e.team === 0);
  const builder = own.some((e) => e.type === "unit" && e.kind === "villager");
  const b = own.length === 1 && own[0].type === "building" ? own[0] : undefined;
  const key = JSON.stringify({
    ids: selection.map((e) => e.id),
    food: Math.floor(game.player.resources.food / 5),
    wood: Math.floor(game.player.resources.wood / 5),
    gold: Math.floor(game.player.resources.gold / 5),
    age: game.player.age,
    upgraded: game.player.upgraded,
    cap: game.capacity(0),
    pop: game.reserved(0),
    queues: game.state.buildings
      .filter((b) => b.team === 0)
      .map((b) => [b.id, b.progress >= 1, b.queue.map((q) => q.kind)]),
  });
  if (key === lastCommandKey) return;
  lastCommandKey = key;
  const commands = $("commands");
  commands.replaceChildren();
  $("commands-title").textContent = builder
    ? "BUILD SETTLEMENT"
    : b
      ? "PRODUCTION"
      : "COMMANDS";
  $("command-caption").textContent = builder
    ? "Choose a building, then place it on the field"
    : b
      ? "Right click the field to set a rally point"
      : "Left click to select · Right click to command";
  if (builder) {
    for (const kind of [
      "house",
      "farm",
      "barracks",
      "range",
      "stable",
    ] as BuildingKind[]) {
      const d = BUILDING[kind],
        locked = game.player.age < d.age,
        affordable = game.canAfford(0, d.cost);
      commands.append(
        actionButton(
          d.name,
          kind,
          d.cost,
          !locked && affordable,
          locked
            ? "Requires Castle Age"
            : !affordable
              ? "Not enough resources"
              : `${d.time}s construction · Select a clear, explored site`,
          () => beginBuild(kind),
        ),
      );
    }
  } else if (b && b.progress >= 1) {
    for (const kind of Object.keys(UNIT) as UnitKind[]) {
      const d = UNIT[kind];
      if (d.building !== b.kind) continue;
      const locked = game.player.age < d.age,
        pop = game.reserved(0) >= game.capacity(0),
        affordable = game.canAfford(0, d.cost),
        full = b.queue.length >= 5;
      commands.append(
        actionButton(
          d.name,
          kind,
          d.cost,
          !locked && !pop && affordable && !full,
          locked
            ? "Requires Castle Age"
            : pop
              ? "Population full. Build more houses."
              : !affordable
                ? "Not enough resources"
                : full
                  ? "Training queue is full"
                  : `${d.time}s training`,
          () => {
            if (!game.queue(b.id, kind, 0))
              game.notify(
                "Unable to train. Check population, resources, and queue.",
              );
            updateUI();
          },
        ),
      );
    }
    if (b.kind === "townCenter") {
      const advancing = game.state.buildings.some(
        (b) => b.team === 0 && b.queue.some((q) => q.kind === "advance"),
      );
      if (game.player.age === 1)
        commands.append(
          actionButton(
            advancing ? "Advancing…" : "Castle Age",
            "advance",
            ADVANCE_COST,
            !advancing && b.queue.length < 5 && game.canAfford(0, ADVANCE_COST),
            advancing
              ? "Already queued"
              : "100s research · Unlock cavalry and Forged Arms",
            () => {
              game.queue(b.id, "advance", 0);
              updateUI();
            },
          ),
        );
      else {
        const pending = game.state.buildings.some(
          (b) => b.team === 0 && b.queue.some((q) => q.kind === "upgrade"),
        );
        commands.append(
          actionButton(
            game.player.upgraded
              ? "Arms forged"
              : pending
                ? "Forging…"
                : "Forged Arms",
            "upgrade",
            UPGRADE_COST,
            !game.player.upgraded &&
              !pending &&
              b.queue.length < 5 &&
              game.canAfford(0, UPGRADE_COST),
            "50s research · +2 attack and +20% health for all units",
            () => {
              game.queue(b.id, "upgrade", 0);
              updateUI();
            },
          ),
        );
      }
    }
  } else if (own.some((e) => e.type === "unit")) {
    commands.append(
      actionButton(
        "Attack-move",
        "attack",
        {},
        true,
        "Move while engaging enemies along the way",
        () => {
          attackMode = true;
          setHint();
          canvas.focus();
        },
      ),
      actionButton("Stop", "stop", {}, true, "Stop current orders", () =>
        command({ kind: "idle", x: 0, y: 0 }),
      ),
    );
  } else {
    const text = document.createElement("p");
    text.className = "empty-commands";
    text.innerHTML =
      b && b.progress < 1
        ? "Construction in progress.<br>Select a villager and right-click this site to help."
        : "<span>♧</span> A kingdom begins with its people.<br>Select villagers to gather and build, or your Town Center to train more.";
    commands.append(text);
  }
}
const objectiveData = [
  [
    "Put your people to work",
    "Select villagers, then right-click berries, trees, or gold. Gather and deliver 36 resources.",
  ],
  [
    "Make room to grow",
    "Select a villager and build a house on clear ground. Each house adds 5 population.",
  ],
  [
    "Gather your strength",
    "Train 3 units at your Town Center, barracks, or an archery range.",
  ],
  [
    "Enter the Castle Age",
    "Save 600 food and 300 gold. Select your Town Center and research Castle Age.",
  ],
  [
    "Take the Crimson Keep",
    "Train a mixed army. Explore to the southeast and destroy the enemy Town Center.",
  ],
  ["The meadow is yours", "Your kingdom has prevailed."],
];
function updateUI() {
  for (const id of [...renderer.selection])
    if (!game.find(id)) renderer.selection.delete(id);
  const p = game.player;
  for (const resource of ["food", "wood", "gold"] as const)
    $(resource).textContent = Math.floor(p.resources[resource]).toString();
  $("population").textContent = `${game.population(0)} / ${game.capacity(0)}`;
  $("population").classList.toggle(
    "at-cap",
    game.reserved(0) >= game.capacity(0),
  );
  $("age").textContent = p.age === 1 ? "I" : "II";
  $("age-name").textContent = p.age === 1 ? "Feudal Age" : "Castle Age";
  $("clock").textContent = formatTime(game.state.time);
  $("zoom-label").textContent = `${Math.round(renderer.zoom * 100)}%`;
  const entities = selected(),
    one = entities.length === 1 ? entities[0] : undefined;
  let name = "Your kingdom awaits",
    meta = "THE BLUE BANNER",
    detail = "Select a villager or building to give an order.",
    portrait = "";
  if (one) {
    if (one.type === "resource") {
      name =
        one.kind === "tree"
          ? "Woodland"
          : one.kind === "berries"
            ? "Berry bushes"
            : "Gold deposit";
      meta = "NATURAL RESOURCE";
      detail = `${Math.ceil(one.amount)} ${resourceOf(one)} remaining · Right-click with villagers`;
      portrait = "resource-" + one.kind;
    } else {
      meta = one.team === 0 ? "YOUR BLUE BANNER" : "THE CRIMSON KEEP";
      name =
        one.type === "unit" ? UNIT[one.kind].name : BUILDING[one.kind].name;
      portrait = one.kind;
      detail =
        one.type === "unit"
          ? `${Math.ceil(one.hp)} / ${Math.ceil(one.maxHp)} HP · ${one.order.kind === "idle" ? "Awaiting orders" : one.order.kind === "gather" ? (one.returning ? "Delivering resources" : "Gathering " + (one.cargo ?? "resources")) : one.order.kind === "build" ? "Constructing" : one.order.kind === "attack" ? "Attacking" : one.order.kind === "attackMove" ? "Advancing" : "Moving"}${one.carry > 0 ? " · Carrying " + Math.floor(one.carry) : ""}`
          : one.progress < 1
            ? `Under construction · ${Math.floor(one.progress * 100)}%`
            : `${Math.ceil(one.hp)} / ${one.maxHp} HP${one.kind === "house" ? " · +5 population" : one.kind === "farm" ? " · Renewable food" : one.kind === "townCenter" ? " · Heart of your kingdom" : ""}`;
    }
  } else if (entities.length > 1) {
    name = `${entities.length} selected`;
    meta = "YOUR PEOPLE";
    const counts = new Map<string, number>();
    entities.forEach((e) => {
      const n =
        e.type === "unit"
          ? UNIT[e.kind].name
          : e.type === "building"
            ? BUILDING[e.kind].name
            : "Resource";
      counts.set(n, (counts.get(n) ?? 0) + 1);
    });
    detail = [...counts]
      .map(([n, c]) => `${c} ${n.toLowerCase()}${c > 1 ? "s" : ""}`)
      .join(" · ");
    portrait = "group";
  }
  $("selection-name").textContent = name;
  $("selection-meta").textContent = meta;
  $("selection-detail").textContent = detail;
  if (portrait !== lastPortrait) {
    lastPortrait = portrait;
    $("portrait").innerHTML =
      portrait in BUILDING || portrait in UNIT
        ? `<img src="${icon(portrait as BuildingKind)}" alt="">`
        : `<span>${portrait.startsWith("resource") ? "♧" : portrait === "group" ? "⚑" : "♜"}</span>`;
  }
  $("selection-health").innerHTML =
    one && one.type !== "resource"
      ? `<div class="health-track"><span style="width:${Math.max(0, (one.hp / one.maxHp) * 100)}%"></span></div>`
      : "";
  updateCommands(entities);
  const b = one?.type === "building" && one.team === 0 ? one : undefined;
  const queueKey = b
    ? `${b.id}:${b.queue.map((q) => `${q.kind}:${Math.ceil(q.remaining)}`).join(",")}`
    : "";
  if (queueKey !== lastQueueKey) {
    lastQueueKey = queueKey;
    const queue = $("queue");
    queue.replaceChildren();
    if (b?.queue.length) {
      for (const [index, q] of b.queue.entries()) {
        const button = document.createElement("button");
        button.className = "queue-item";
        button.title = "Cancel for a full refund";
        const label =
          q.kind === "advance"
            ? "Castle Age"
            : q.kind === "upgrade"
              ? "Forged Arms"
              : UNIT[q.kind].name;
        button.setAttribute(
          "aria-label",
          `Cancel ${label}, ${Math.ceil(q.remaining)} seconds remaining, full refund`,
        );
        button.innerHTML = `<span>${label}</span><small>${index === 0 ? Math.ceil(q.remaining) + "s" : "queued"}</small><i style="width:${index === 0 ? (1 - q.remaining / q.total) * 100 : 0}%"></i>`;
        button.onclick = () => {
          game.cancelQueue(b.id, index);
          lastCommandKey = "";
          updateUI();
        };
        queue.append(button);
      }
    }
  }
  let objective = 0;
  while (objective < 5 && game.state.objectives & (1 << objective)) objective++;
  if (objective !== lastObjective) {
    lastObjective = objective;
    $("objective-title").textContent = objectiveData[objective][0];
    $("objective-copy").textContent = objectiveData[objective][1];
    $("objective-count").textContent = `${Math.min(objective + 1, 5)} OF 5`;
    $("objective-dots").innerHTML = Array.from(
      { length: 5 },
      (_, i) =>
        `<i class="${i < objective ? "done" : i === objective ? "current" : ""}"></i>`,
    ).join("");
  }
  const noticeKey = game.notices.map((n) => n.text).join("|");
  if ($("notices").dataset.key !== noticeKey) {
    $("notices").dataset.key = noticeKey;
    $("notices").innerHTML = game.notices
      .map((n) => `<div><span>◆</span>${esc(n.text)}</div>`)
      .join("");
  }
}
async function initialize() {
  try {
    saved = await loadMatch();
    if (saved) {
      try {
        Game.restore(saved.raw);
        $("resume-game").hidden = false;
        $("resume-game").title =
          `Saved ${new Date(saved.savedAt).toLocaleString()}`;
      } catch {
        saved = undefined;
        $("storage-warning").textContent =
          "The previous save is incompatible or damaged. Start a new skirmish to replace it.";
        $("storage-warning").hidden = false;
      }
    }
  } catch {
    warnStorage(
      "Local saving is unavailable. You can still play, but this match will not be saved.",
    );
  }
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    try {
      await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
      );
      await navigator.serviceWorker.ready;
      $("offline-status").textContent = "OFFLINE READY · ALL YOURS";
    } catch {
      $("offline-status").textContent =
        "CLIENT SIDE · OFFLINE CACHE UNAVAILABLE";
    }
  }
}
function frame(now: number) {
  const delta = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;
  if (running) {
    accumulator += delta;
    while (accumulator >= FIXED_STEP) {
      game.update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
    renderer.pan(delta);
    if (game.state.winner !== null && !resultShown) showResult();
    if (game.state.time - lastSave >= 30 && !saving) void persist();
  }
  renderer.draw(game, now);
  uiClock += delta;
  if (uiClock >= 0.15) {
    uiClock = 0;
    if (started) updateUI();
    renderer.minimap(mini, game);
  }
  requestAnimationFrame(frame);
}
void initialize();
updateUI();
requestAnimationFrame(frame);
