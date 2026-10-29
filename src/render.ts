import {
  Game,
  SIZE,
  BUILDING,
  UNIT,
  center,
  footprint,
  cell,
  inBounds,
  type Point,
  type Entity,
  type BuildingKind,
  type Building,
  type Unit,
  type ResourceNode,
} from "./game";
import { VillagerSprites, villagerPose, type VillagerPose } from "./villager";
const TW = 48,
  TH = 24;
const TEAM = ["#5e98bd", "#bd6353"];
const LIGHT = ["#a1c2cf", "#e3a58a"];
type Ctx = CanvasRenderingContext2D;
function polygon(c: Ctx, points: number[][], fill: string, stroke?: string) {
  c.beginPath();
  points.forEach(([x, y], i) =>
    i
      ? c.lineTo(Math.round(x), Math.round(y))
      : c.moveTo(Math.round(x), Math.round(y)),
  );
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.stroke();
  }
}
function rect(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
const hash = (x: number, y: number) =>
  Math.abs(Math.imul(x + 1729, 374761393) ^ Math.imul(y + 842, 668265263)) >>>
  0;
function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}
export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  width = 0;
  height = 0;
  dpr = 1;
  camera: Point = { x: 15, y: 15 };
  zoom = 1.1;
  selection = new Set<number>();
  hover: number | null = null;
  placement: BuildingKind | null = null;
  pointer: Point = { x: 0, y: 0 };
  drag: { start: Point; end: Point } | null = null;
  keys = new Set<string>();
  edge: Point = { x: 0, y: 0 };
  active = false;
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private tiles: HTMLCanvasElement[] = [];
  private trees: HTMLCanvasElement[] = [];
  private buildings = new Map<string, HTMLCanvasElement>();
  private sprites = new Map<string, HTMLCanvasElement>();
  private villagers = new VillagerSprites();
  private villagerDirections = new Map<number, number>();
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.makeTiles();
    this.makeTrees();
    this.resize();
  }
  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }
  project(p: Point): Point {
    const dx = p.x - this.camera.x,
      dy = p.y - this.camera.y;
    return {
      x: this.width / 2 + (((dx - dy) * TW) / 2) * this.zoom,
      y: this.height * 0.46 + (((dx + dy) * TH) / 2) * this.zoom,
    };
  }
  unproject(p: Point): Point {
    const sx = (p.x - this.width / 2) / this.zoom,
      sy = (p.y - this.height * 0.46) / this.zoom;
    return {
      x: this.camera.x + sx / TW + sy / TH,
      y: this.camera.y - sx / TW + sy / TH,
    };
  }
  pan(dt: number) {
    if (!this.active) return;
    const speed = (650 * dt) / this.zoom;
    const x =
      (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0) +
      this.edge.x;
    const y =
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) -
      (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) +
      this.edge.y;
    this.camera.x = Math.max(
      0,
      Math.min(SIZE, this.camera.x + (x * speed) / TW + (y * speed) / TH),
    );
    this.camera.y = Math.max(
      0,
      Math.min(SIZE, this.camera.y - (x * speed) / TW + (y * speed) / TH),
    );
  }
  setZoom(value: number, anchor?: Point) {
    const before = anchor ? this.unproject(anchor) : null;
    this.zoom = Math.max(0.55, Math.min(1.8, value));
    if (anchor && before) {
      const after = this.unproject(anchor);
      this.camera.x += before.x - after.x;
      this.camera.y += before.y - after.y;
    }
  }
  hit(game: Game, p: Point): Entity | undefined {
    const world = this.unproject(p);
    const units = game.state.units
      .filter((u) => game.known(0, u))
      .map((u) => ({ u, p: this.project(u) }))
      .filter(
        ({ p: s }) =>
          Math.abs(p.x - s.x) < 16 * this.zoom &&
          p.y > s.y - 38 * this.zoom &&
          p.y < s.y + 8 * this.zoom,
      )
      .sort((a, b) => b.p.y - a.p.y);
    if (units.length) return units[0].u;
    const building = game.state.buildings
      .filter((b) => game.known(0, b))
      .find(
        (b) =>
          world.x >= b.x &&
          world.x < b.x + footprint(b) &&
          world.y >= b.y &&
          world.y < b.y + footprint(b),
      );
    if (building) return building;
    // Roofs remain selectable even where they extend above the footprint.
    const roof = game.state.buildings
      .filter((b) => game.known(0, b))
      .sort((a, b) => b.x + b.y - a.x - a.y)
      .find((b) => {
        const c = this.project(center(b));
        return (
          Math.abs(c.x - p.x) < footprint(b) * 20 * this.zoom &&
          p.y < c.y &&
          p.y > c.y - (footprint(b) * 12 + 65) * this.zoom
        );
      });
    if (roof) return roof;
    return game.state.nodes
      .filter(
        (n) =>
          game.known(0, n) &&
          Math.abs(n.x - world.x) < 1.1 &&
          Math.abs(n.y - world.y) < 1.1,
      )
      .sort(
        (a, b) =>
          (a.x - world.x) ** 2 +
          (a.y - world.y) ** 2 -
          ((b.x - world.x) ** 2 + (b.y - world.y) ** 2),
      )[0];
  }
  private makeTiles() {
    const palettes = [
      ["#7c9357", "#81985a", "#879d60", "#789052", "#8a9e5e", "#7f9654"],
      ["#8e9c60", "#89975b", "#93a169", "#829258"],
      ["#a7a078", "#aaa27b", "#9c966d"],
      ["#698d88", "#648782", "#759590"],
    ];
    for (let type = 0; type < 4; type++)
      for (let variant = 0; variant < 6; variant++) {
        const cv = makeCanvas(50, 28),
          c = cv.getContext("2d")!;
        const palette = palettes[type];
        polygon(
          c,
          [
            [25, 1],
            [49, 13],
            [25, 25],
            [1, 13],
          ],
          palette[variant % palette.length],
        );
        for (let i = 0; i < 8; i++) {
          const x = 5 + (hash(variant * 30 + i, type) % 39),
            y = 4 + (hash(i * 7, variant + type) % 17);
          if (Math.abs(x - 25) / 24 + Math.abs(y - 13) / 12 > 0.85) continue;
          rect(
            c,
            x,
            y,
            type === 3 ? 5 : 2,
            1,
            type === 3
              ? "#8baaa1"
              : type === 2
                ? "#bcb38c"
                : i % 3 === 0
                  ? "#a0ad70"
                  : "#6f874b",
          );
          if (type < 2 && i % 3 === 0) rect(c, x + 1, y - 1, 1, 2, "#a0ad70");
        }
        this.tiles.push(cv);
      }
  }
  private makeTrees() {
    for (let v = 0; v < 6; v++) {
      const cv = makeCanvas(56, 92),
        c = cv.getContext("2d")!;
      polygon(
        c,
        [
          [8, 80],
          [29, 72],
          [52, 81],
          [30, 89],
        ],
        "#526e423f",
      );
      rect(c, 26, 48, 6, 32, "#625d3d");
      rect(c, 28, 52, 2, 27, "#92805a");
      rect(c, 21, 60, 7, 3, "#625d3d");
      const pine = v < 3;
      const dark = pine ? "#354f39" : "#3d5b37",
        mid = pine ? "#466944" : "#527641",
        light = pine ? "#62834b" : "#6e8b4d";
      if (pine) {
        for (let i = 0; i < 3; i++) {
          const y = 55 - i * 16,
            w = 24 - i * 5;
          polygon(
            c,
            [
              [28, y - 25],
              [28 + w, y + 8],
              [39, y + 8],
              [40, y + 13],
              [13, y + 13],
              [14, y + 7],
              [28 - w, y + 8],
            ],
            dark,
          );
          polygon(
            c,
            [
              [28, y - 25],
              [28, y + 8],
              [28 - w, y + 8],
            ],
            mid,
          );
          polygon(
            c,
            [
              [28, y - 25],
              [21, y - 7],
              [30, y - 2],
              [20, y + 1],
              [26, y + 5],
              [10 + i * 5, y + 5],
            ],
            light,
          );
        }
      } else {
        for (let i = 0; i < 9; i++) {
          const x = 11 + (hash(i, v) % 31),
            y = 22 + (hash(v, i) % 34);
          rect(c, x - 7, y - 7, 17, 15, dark);
          rect(c, x - 5, y - 10, 14, 14, mid);
          rect(c, x - 4, y - 9, 9, 5, light);
        }
        rect(c, 17, 17, 17, 6, mid);
        rect(c, 20, 15, 12, 5, light);
      }
      this.trees.push(cv);
    }
  }
  private buildingSprite(b: Building) {
    const key = `${b.kind}-${b.team}-${b.progress < 1 ? "work" : "done"}`;
    const cached = this.buildings.get(key);
    if (cached) return cached;
    const cv = makeCanvas(256, 240),
      c = cv.getContext("2d")!,
      s = footprint(b),
      w = s * 24,
      h = s * 12,
      ox = 128,
      oy = 130;
    const iso = (x: number, y: number, z = 0) => [
      ox + (x - y) * 24,
      oy + (x + y) * 12 - z,
    ];
    const box = (
      x: number,
      y: number,
      bw: number,
      bd: number,
      height: number,
    ) => {
      polygon(
        c,
        [iso(x, y), iso(x + bw, y), iso(x + bw, y + bd), iso(x, y + bd)],
        "#807a5c",
      );
      polygon(
        c,
        [
          iso(x, y + bd),
          iso(x + bw, y + bd),
          iso(x + bw, y + bd, height),
          iso(x, y + bd, height),
        ],
        "#c5b494",
        "#6b6652",
      );
      polygon(
        c,
        [
          iso(x + bw, y),
          iso(x + bw, y + bd),
          iso(x + bw, y + bd, height),
          iso(x + bw, y, height),
        ],
        "#9d9479",
        "#6b6652",
      );
      polygon(
        c,
        [
          iso(x, y, height),
          iso(x + bw, y, height),
          iso(x + bw, y + bd, height),
          iso(x, y + bd, height),
        ],
        "#d7c5a1",
      );
    };
    const roof = (
      x: number,
      y: number,
      bw: number,
      bd: number,
      z: number,
      rise: number,
    ) => {
      const t =
        b.team === 0
          ? ["#527d92", "#365b70", "#7ba0a9"]
          : ["#9d5d4a", "#754337", "#be8770"];
      polygon(
        c,
        [
          iso(x - 0.15, y - 0.15, z),
          iso(x + bw / 2, y - 0.15, z + rise),
          iso(x + bw / 2, y + bd + 0.15, z + rise),
          iso(x - 0.15, y + bd + 0.15, z),
        ],
        t[0],
        "#3d4c45",
      );
      polygon(
        c,
        [
          iso(x + bw / 2, y - 0.15, z + rise),
          iso(x + bw + 0.15, y - 0.15, z),
          iso(x + bw + 0.15, y + bd + 0.15, z),
          iso(x + bw / 2, y + bd + 0.15, z + rise),
        ],
        t[1],
        "#3d4c45",
      );
      for (let i = 0.4; i < bd; i += 0.38) {
        const a = iso(x - 0.12, y + i, z),
          d = iso(x + bw / 2, y + i, z + rise);
        c.strokeStyle = t[2];
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(...(a as [number, number]));
        c.lineTo(...(d as [number, number]));
        c.stroke();
      }
      const a = iso(x + bw / 2, y - 0.15, z + rise),
        d = iso(x + bw / 2, y + bd + 0.15, z + rise);
      c.strokeStyle = t[2];
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(...(a as [number, number]));
      c.lineTo(...(d as [number, number]));
      c.stroke();
    };
    polygon(
      c,
      [
        [ox - w - 10, oy + h],
        [ox, oy - 8],
        [ox + w + 16, oy + h + 6],
        [ox + 8, oy + h * 2 + 10],
      ],
      "#3b503d50",
    );
    if (b.kind === "farm") {
      polygon(
        c,
        [iso(0, 0), iso(s, 0), iso(s, s), iso(0, s)],
        "#766b43",
        "#b5a075",
      );
      for (let i = 0.2; i < s; i += 0.32) {
        const a = iso(i, 0.1),
          z = iso(i, s - 0.1);
        c.strokeStyle = "#c2aa5f";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(...(a as [number, number]));
        c.lineTo(...(z as [number, number]));
        c.stroke();
        for (let t = 0.2; t < s; t += 0.4) {
          const p = iso(i, t);
          rect(c, p[0], p[1] - 5, 2, 5, "#c5b46e");
          rect(c, p[0] - 2, p[1] - 4, 5, 1, "#a7a257");
        }
      }
    } else if (b.progress < 1) {
      box(0.1, 0.1, s - 0.2, s - 0.2, 8);
      for (let i = 0; i < s; i++) {
        const p = iso(i + 0.25, s - 0.2);
        rect(c, p[0] - 2, p[1] - 45, 4, 45, "#a18c60");
        rect(c, p[0] + 2, p[1] - 44, 2, 42, "#d1b67e");
      }
      polygon(
        c,
        [
          iso(0.1, s - 0.2, 31),
          iso(s - 0.1, s - 0.2, 31),
          iso(s - 0.1, s - 0.2, 35),
          iso(0.1, s - 0.2, 35),
        ],
        "#aa9467",
      );
      for (let i = 0; i < 3; i++) {
        const p = iso(0.4 + i * 0.6, 0.6);
        rect(c, p[0], p[1] - 7, 25, 5, "#bdac79");
      }
      const p = iso(0.3, 0.3);
      rect(c, p[0], p[1] - 62, 2, 62, "#7e7152");
      polygon(
        c,
        [
          [p[0] + 2, p[1] - 60],
          [p[0] + 24, p[1] - 57],
          [p[0] + 18, p[1] - 46],
          [p[0] + 2, p[1] - 48],
        ],
        TEAM[b.team],
      );
    } else {
      if (b.kind === "townCenter") {
        box(0.2, 0.2, 3.6, 3.6, 30);
        roof(0.2, 0.2, 3.6, 3.6, 30, 35);
        box(0.15, 2.5, 1, 1.25, 66);
        roof(0.1, 2.45, 1.1, 1.35, 66, 24);
        box(2.6, 0.25, 1, 1, 55);
        roof(2.55, 0.2, 1.1, 1.1, 55, 23);
        for (const [wx, wy, z] of [
          [0.65, 3.77, 48],
          [0.65, 3.77, 25],
          [3.62, 0.75, 38],
          [3.62, 0.75, 20],
        ]) {
          const p = iso(wx, wy, z);
          rect(c, p[0] - 3, p[1] - 7, 6, 9, "#48544b");
          rect(c, p[0] - 4, p[1] - 8, 8, 2, "#e0cba4");
          rect(c, p[0] - 4, p[1] + 2, 8, 2, "#a19474");
        }
        for (let level = 8; level < 60; level += 10) {
          const a = iso(0.17, 3.76, level),
            d = iso(1.14, 3.76, level);
          c.strokeStyle = "#aa9c7d";
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(...(a as [number, number]));
          c.lineTo(...(d as [number, number]));
          c.stroke();
        }
        for (const [wx, wy] of [
          [2.2, 3.82],
          [3.1, 3.82],
        ]) {
          const p = iso(wx, wy, 21);
          rect(c, p[0] - 4, p[1], 8, 10, "#5b6652");
          rect(c, p[0] - 5, p[1] - 1, 10, 2, "#e0cba4");
          rect(c, p[0] - 1, p[1], 1, 10, "#bda983");
        }

        const door = iso(1.5, 3.82);
        rect(c, door[0] - 10, door[1] - 25, 20, 25, "#5b5945");
        rect(c, door[0] - 7, door[1] - 22, 14, 22, "#7a694b");
        rect(c, door[0] - 8, door[1] - 23, 16, 2, "#d5c09a");
        const pole = iso(1.8, 1.7, 70);
        rect(c, pole[0], pole[1] - 29, 2, 31, "#dbc292");
        polygon(
          c,
          [
            [pole[0] + 2, pole[1] - 29],
            [pole[0] + 27, pole[1] - 25],
            [pole[0] + 24, pole[1] - 12],
            [pole[0] + 2, pole[1] - 15],
          ],
          TEAM[b.team],
        );
        rect(c, pole[0] + 7, pole[1] - 24, 3, 9, LIGHT[b.team]);
        rect(c, pole[0] + 4, pole[1] - 21, 9, 3, LIGHT[b.team]);
      } else if (b.kind === "house") {
        box(0.15, 0.2, 1.7, 1.6, 25);
        roof(0.08, 0.12, 1.85, 1.78, 25, 24);
        const p = iso(0.6, 1.83);
        rect(c, p[0] - 5, p[1] - 18, 10, 18, "#726448");
        const win = iso(1.8, 0.8, 19);
        rect(c, win[0] - 3, win[1], 5, 7, "#5c6552");
        const ch = iso(0.5, 0.6, 50);
        rect(c, ch[0], ch[1] - 8, 6, 15, "#ada18a");
        rect(c, ch[0] - 1, ch[1] - 9, 8, 3, "#d0bfa3");
      } else {
        box(0.2, 0.2, 2.6, 2.6, 31);
        roof(0.1, 0.1, 2.8, 2.8, 31, 28);
        const p = iso(1.1, 2.82);
        rect(c, p[0] - 9, p[1] - 24, 18, 24, "#5e5c45");
        rect(c, p[0] - 7, p[1] - 22, 14, 22, "#83704f");
        for (let i = 0; i < 3; i++) {
          const t = iso(2.82, 0.5 + i * 0.75, 24);
          rect(c, t[0] - 3, t[1], 6, 9, "#4b574b");
          rect(c, t[0] - 3, t[1] + 3, 6, 1, "#b2a180");
        }
        const sign = iso(1.7, 2.9, 34);
        rect(c, sign[0] - 10, sign[1], 21, 15, "#6b6750");
        rect(c, sign[0] - 8, sign[1] + 2, 17, 11, TEAM[b.team]);
        if (b.kind === "barracks") {
          rect(c, sign[0], sign[1] + 3, 2, 9, "#ded2b0");
          rect(c, sign[0] - 3, sign[1] + 8, 8, 2, "#ded2b0");
        }
        if (b.kind === "range") {
          c.strokeStyle = "#dfcd98";
          c.lineWidth = 2;
          c.beginPath();
          c.arc(sign[0] + 1, sign[1] + 8, 4, 0, Math.PI * 2);
          c.stroke();
          rect(c, sign[0], sign[1] + 7, 2, 2, "#a95f4b");
        }
        if (b.kind === "stable") {
          const t = iso(0.4, 2.9);
          rect(c, t[0] - 5, t[1] - 15, 14, 9, "#6d4b32");
          rect(c, t[0] + 6, t[1] - 20, 6, 11, "#6d4b32");
          rect(c, t[0] - 4, t[1] - 7, 2, 8, "#493d2c");
          rect(c, t[0] + 5, t[1] - 7, 2, 8, "#493d2c");
        }
      }
      // Timber framing on the front facade.
      for (let i = 0.3; i < s - 0.1; i += 0.8) {
        const p = iso(i, s - 0.18);
        rect(c, p[0] - 1, p[1] - 23, 2, 22, "#7d7155");
      }
    }
    this.buildings.set(key, cv);
    return cv;
  }
  private unitSprite(u: Unit, frame: number, pose?: VillagerPose) {
    if (u.kind === "villager") {
      const sprite = this.villagers.get(u.team, pose ?? { action: "idle", direction: 2, frame: 0 });
      if (sprite) return sprite;
    }
    const key = `${u.kind}-${u.team}-${frame}-${u.carry > 3 ? 1 : 0}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const cv = makeCanvas(58, 62),
      c = cv.getContext("2d")!;
    const x = 29,
      y = 53,
      step = frame === 1 ? 2 : frame === 2 ? -2 : 0;
    const team = TEAM[u.team];
    if (u.kind === "cavalry") {
      rect(c, x - 16, y - 16, 27, 11, "#72543c");
      rect(c, x - 14, y - 14, 23, 6, "#8f6c47");
      rect(c, x + 6, y - 24, 7, 14, "#72543c");
      rect(c, x + 9, y - 25, 11, 7, "#a58053");
      rect(c, x + 7, y - 27, 4, 5, "#4d4537");
      rect(c, x + 17, y - 23, 2, 2, "#303c31");
      rect(c, x - 13, y - 7, 3, 9 + step, "#4e4434");
      rect(c, x + 6, y - 7, 3, 9 - step, "#4e4434");
      rect(c, x - 19, y - 16, 4, 12, "#403d31");
      rect(c, x - 7, y - 18, 14, 7, team);
      rect(c, x - 4, y - 29, 10, 15, "#b1b9ad");
      rect(c, x - 3, y - 36, 8, 8, "#c2c8b5");
      rect(c, x - 4, y - 35, 10, 3, "#657c7d");
      rect(c, x + 6, y - 44, 2, 29, "#b7a77d");
      polygon(
        c,
        [
          [x + 5, y - 44],
          [x + 7, y - 51],
          [x + 10, y - 43],
        ],
        "#d1d6c4",
      );
    } else {
      rect(c, x - 5, y - 9, 4, 9 + step, "#4b4a38");
      rect(c, x + 2, y - 9, 4, 9 - step, "#4b4a38");
      rect(c, x - 6, y - 1 + step, 6, 3, "#4b4434");
      rect(c, x + 2, y - 1 - step, 6, 3, "#4b4434");
      rect(
        c,
        x - 6,
        y - 25,
        13,
        18,
        u.kind === "villager" ? "#b5a37c" : "#a9b2a3",
      );
      rect(c, x - 6, y - 16, 13, 6, team);
      rect(c, x - 9, y - 24, 4, 13, "#bda27d");
      rect(c, x + 7, y - 24, 4, 13, "#bda27d");
      rect(c, x - 4, y - 33, 9, 9, "#d2b18a");
      rect(
        c,
        x - 5,
        y - 34,
        11,
        4,
        u.kind === "villager" ? "#756447" : "#c4cabb",
      );
      rect(c, x + 2, y - 29, 2, 2, "#4b4936");
      rect(c, x - 3, y - 25, 7, 3, "#766c50");
      if (u.kind === "spearman") {
        rect(c, x + 10, y - 40, 2, 40, "#b3a175");
        polygon(
          c,
          [
            [x + 8, y - 40],
            [x + 11, y - 49],
            [x + 14, y - 40],
          ],
          "#d0d6c4",
        );
        rect(c, x - 11, y - 23, 7, 13, team);
        rect(c, x - 10, y - 22, 5, 2, LIGHT[u.team]);
      }
      if (u.kind === "archer") {
        c.strokeStyle = "#cfb879";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x + 10, y - 32);
        c.lineTo(x + 16, y - 22);
        c.lineTo(x + 11, y - 12);
        c.stroke();
        c.strokeStyle = "#d3d0ae";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 10, y - 32);
        c.lineTo(x + 11, y - 12);
        c.stroke();
        rect(c, x - 6, y - 35, 12, 5, team);
      }
      if (u.kind === "villager") {
        rect(c, x + 9, y - 20, 2, 18, "#87734a");
        rect(c, x + 6, y - 22, 9, 3, "#adb3a0");
        if (u.carry > 3) {
          rect(c, x - 10, y - 16, 7, 9, "#967e4c");
          rect(c, x - 10, y - 17, 7, 2, "#bca466");
        }
      }
    }
    this.sprites.set(key, cv);
    return cv;
  }
  private ring(p: Point, rx: number, ry: number, color: string, width = 1) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.ellipse(p.x, p.y, rx * this.zoom, ry * this.zoom, 0, 0, Math.PI * 2);
    c.stroke();
  }
  private health(p: Point, ratio: number, w: number, team: number) {
    const c = this.ctx;
    const width = w * this.zoom;
    rect(c, p.x - width / 2 - 1, p.y - 1, width + 2, 5, "#29382c");
    rect(
      c,
      p.x - width / 2,
      p.y,
      width * Math.max(0, Math.min(1, ratio)),
      3,
      ratio < 0.25 ? "#d58a65" : team === 0 ? "#9bbca2" : "#c67f6b",
    );
  }
  private drawResource(n: ResourceNode) {
    const p = this.project(n),
      c = this.ctx;
    if (n.kind === "tree") {
      const v = hash(Math.floor(n.x), Math.floor(n.y)) % 6;
      c.drawImage(
        this.trees[v],
        p.x - 28 * this.zoom,
        p.y - 80 * this.zoom,
        56 * this.zoom,
        92 * this.zoom,
      );
    } else if (n.kind === "gold") {
      polygon(
        c,
        [
          [p.x - 17 * this.zoom, p.y],
          [p.x - 9 * this.zoom, p.y - 12 * this.zoom],
          [p.x + 2 * this.zoom, p.y - 17 * this.zoom],
          [p.x + 15 * this.zoom, p.y - 6 * this.zoom],
          [p.x + 17 * this.zoom, p.y + 2 * this.zoom],
          [p.x, p.y + 8 * this.zoom],
        ],
        "#817c5b",
      );
      polygon(
        c,
        [
          [p.x - 9 * this.zoom, p.y - 12 * this.zoom],
          [p.x + 2 * this.zoom, p.y - 17 * this.zoom],
          [p.x + 8 * this.zoom, p.y - 6 * this.zoom],
          [p.x - 3 * this.zoom, p.y - 3 * this.zoom],
        ],
        "#c8b26a",
      );
      rect(
        c,
        p.x + 8 * this.zoom,
        p.y - 5 * this.zoom,
        5 * this.zoom,
        4 * this.zoom,
        "#dfc985",
      );
      rect(
        c,
        p.x - 12 * this.zoom,
        p.y - 2 * this.zoom,
        6 * this.zoom,
        4 * this.zoom,
        "#bfa65d",
      );
    } else {
      rect(
        c,
        p.x - 13 * this.zoom,
        p.y - 12 * this.zoom,
        26 * this.zoom,
        14 * this.zoom,
        "#4c6c39",
      );
      rect(
        c,
        p.x - 9 * this.zoom,
        p.y - 17 * this.zoom,
        18 * this.zoom,
        17 * this.zoom,
        "#658244",
      );
      rect(
        c,
        p.x - 4 * this.zoom,
        p.y - 19 * this.zoom,
        9 * this.zoom,
        8 * this.zoom,
        "#7d9551",
      );
      for (let i = 0; i < 6; i++)
        rect(
          c,
          p.x + (((i * 7) % 20) - 10) * this.zoom,
          p.y + (((i * 3) % 12) - 15) * this.zoom,
          3 * this.zoom,
          3 * this.zoom,
          "#b3765b",
        );
    }
  }
  draw(game: Game, now: number) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#27392f";
    c.fillRect(0, 0, this.width, this.height);
    const corners = [
      this.unproject({ x: -150, y: -150 }),
      this.unproject({ x: this.width + 150, y: -150 }),
      this.unproject({ x: -150, y: this.height + 220 }),
      this.unproject({ x: this.width + 150, y: this.height + 220 }),
    ];
    const minX = Math.max(
        0,
        Math.floor(Math.min(...corners.map((p) => p.x))) - 2,
      ),
      maxX = Math.min(
        SIZE - 1,
        Math.ceil(Math.max(...corners.map((p) => p.x))) + 2,
      ),
      minY = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y))) - 2),
      maxY = Math.min(
        SIZE - 1,
        Math.ceil(Math.max(...corners.map((p) => p.y))) + 2,
      );
    const explored = game.player.explored;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const p = this.project({ x, y });
        if (
          p.x < -70 ||
          p.x > this.width + 70 ||
          p.y < -60 ||
          p.y > this.height + 60
        )
          continue;
        const known = explored[cell(x, y)];
        if (known) {
          const tile = game.state.terrain[cell(x, y)];
          c.drawImage(
            this.tiles[tile * 6 + (hash(x, y) % 6)],
            p.x - 25 * this.zoom,
            p.y - 1 * this.zoom,
            50 * this.zoom,
            28 * this.zoom,
          );
        } else {
          const h = hash(x, y) % 5;
          polygon(
            c,
            [
              [p.x, p.y],
              [p.x + 24 * this.zoom, p.y + 12 * this.zoom],
              [p.x, p.y + 24 * this.zoom],
              [p.x - 24 * this.zoom, p.y + 12 * this.zoom],
            ],
            h === 0 ? "#2a3c31" : "#293b30",
          );
        }
      }
    const entities = game.entities
      .filter((e) => game.known(0, e))
      .sort((a, b) => {
        const aa = center(a),
          bb = center(b);
        return aa.x + aa.y - (bb.x + bb.y);
      });
    for (const e of entities) {
      const p = this.project(center(e));
      if (
        p.x < -180 ||
        p.x > this.width + 180 ||
        p.y < -80 ||
        p.y > this.height + 240
      )
        continue;
      const selected = this.selection.has(e.id),
        hover = this.hover === e.id;
      if (e.type === "resource") {
        this.drawResource(e);
        if (hover) this.ring(this.project(e), 15, 7, "#d4c798");
        continue;
      }
      if (e.type === "building") {
        if (selected || hover)
          this.ring(
            p,
            footprint(e) * 22,
            footprint(e) * 11,
            selected ? "#e7d29c" : "#afc79c",
            selected ? 2 : 1,
          );
        const sprite = this.buildingSprite(e),
          base = this.project(e);
        c.drawImage(
          sprite,
          base.x - 128 * this.zoom,
          base.y - 130 * this.zoom,
          256 * this.zoom,
          240 * this.zoom,
        );
        if (selected || hover || e.hp < e.maxHp || e.progress < 1)
          this.health(
            {
              x: p.x,
              y:
                p.y -
                (e.kind === "townCenter" ? 113 : e.kind === "farm" ? 15 : 84) *
                  this.zoom,
            },
            e.progress < 1 ? e.progress : e.hp / e.maxHp,
            55,
            e.team,
          );
      } else {
        const base = this.project(e);
        this.ring(
          base,
          e.kind === "cavalry" ? 16 : 9,
          e.kind === "cavalry" ? 6 : 4,
          selected ? "#f1d58d" : "#334c3a66",
          selected ? 2 : 1,
        );
        const moving = e.path.length > 0,
          frame =
            moving && !this.reducedMotion
              ? Math.floor(now / 160 + e.id) % 3
              : 0;
        let pose: VillagerPose | undefined;
        if (e.kind === "villager") {
          pose = villagerPose(
            e, e.order.target ? game.find(e.order.target) : undefined,
            game.state.time, this.villagerDirections.get(e.id), this.reducedMotion,
          );
          this.villagerDirections.set(e.id, pose.direction);
        }
        const sprite = this.unitSprite(e, frame, pose);
        c.drawImage(
          sprite,
          base.x - 29 * this.zoom,
          base.y - 53 * this.zoom,
          58 * this.zoom,
          62 * this.zoom,
        );
        if (selected || hover || e.hp < e.maxHp)
          this.health(
            {
              x: base.x,
              y: base.y - (e.kind === "cavalry" ? 55 : 47) * this.zoom,
            },
            e.hp / e.maxHp,
            26,
            e.team,
          );
        if (selected && e.kind === "villager" && e.order.kind === "idle") {
          rect(c, base.x - 1, base.y - 61 * this.zoom, 3, 8, "#ebd48c");
          rect(c, base.x - 1, base.y - 51 * this.zoom, 3, 3, "#ebd48c");
        }
      }
    }
    for (const e of game.effects) {
      const p = this.project(e),
        to = this.project({ x: e.tx, y: e.ty });
      if (e.kind === "flag") {
        const t = e.life / e.max;
        this.ring(
          p,
          14 + (1 - t) * 12,
          7 + (1 - t) * 6,
          `rgba(235,219,153,${t})`,
          2,
        );
        rect(c, p.x, p.y - 23 * this.zoom, 2, 22 * this.zoom, "#f0d59d");
        polygon(
          c,
          [
            [p.x + 2, p.y - 23 * this.zoom],
            [p.x + 14 * this.zoom, p.y - 20 * this.zoom],
            [p.x + 2, p.y - 14 * this.zoom],
          ],
          "#e1c58a",
        );
      } else if (e.kind === "arrow") {
        const t = 1 - e.life / e.max,
          x = p.x + (to.x - p.x) * t,
          y =
            p.y +
            (to.y - p.y) * t -
            20 * this.zoom -
            Math.sin(t * Math.PI) * 20 * this.zoom;
        c.strokeStyle = "#e0d2a5";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - (to.x - p.x) * 0.04, y - (to.y - p.y) * 0.04);
        c.stroke();
      } else {
        const t = e.life / e.max;
        rect(c, to.x - 3, to.y - 18 * this.zoom, 6 * t, 6 * t, "#e6d29b");
      }
    }
    if (this.placement) {
      const world = this.unproject(this.pointer),
        x = Math.floor(world.x),
        y = Math.floor(world.y),
        s = BUILDING[this.placement].size,
        valid =
          game.canPlace(this.placement, x, y, 0) &&
          game.canAfford(0, BUILDING[this.placement].cost);
      for (let yy = y; yy < y + s; yy++)
        for (let xx = x; xx < x + s; xx++) {
          const p = this.project({ x: xx, y: yy });
          polygon(
            c,
            [
              [p.x, p.y],
              [p.x + 24 * this.zoom, p.y + 12 * this.zoom],
              [p.x, p.y + 24 * this.zoom],
              [p.x - 24 * this.zoom, p.y + 12 * this.zoom],
            ],
            valid ? "#e0d5a074" : "#b85c547d",
            valid ? "#e1d6a1" : "#d78670",
          );
        }
      const dummy: Building = {
        id: 0,
        type: "building",
        kind: this.placement,
        team: 0,
        x,
        y,
        hp: 1,
        maxHp: 1,
        progress: 1,
        queue: [],
        cooldown: 0,
        rally: null,
      };
      const base = this.project(dummy);
      c.globalAlpha = 0.55;
      c.drawImage(
        this.buildingSprite(dummy),
        base.x - 128 * this.zoom,
        base.y - 130 * this.zoom,
        256 * this.zoom,
        240 * this.zoom,
      );
      c.globalAlpha = 1;
    }
    if (this.drag) {
      const a = this.drag.start,
        b = this.drag.end;
      c.fillStyle = "#d1d9ac1c";
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      c.strokeStyle = "#d4d9aa";
      c.lineWidth = 1;
      c.strokeRect(a.x + 0.5, a.y + 0.5, b.x - a.x, b.y - a.y);
    }
    // A restrained vignette keeps the edges quiet without reducing battlefield clarity.
    const grad = c.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.width * 0.25,
      this.width / 2,
      this.height / 2,
      this.width * 0.7,
    );
    grad.addColorStop(0, "#13241b00");
    grad.addColorStop(1, "#13241b55");
    c.fillStyle = grad;
    c.fillRect(0, 0, this.width, this.height);
  }
  minimap(canvas: HTMLCanvasElement, game: Game) {
    const c = canvas.getContext("2d")!,
      w = canvas.width,
      h = canvas.height,
      scale = w / SIZE;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#283b30";
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (!game.player.explored[cell(x, y)]) continue;
        c.fillStyle =
          game.state.terrain[cell(x, y)] === 3
            ? "#799c9a"
            : game.state.terrain[cell(x, y)] === 2
              ? "#a69e75"
              : "#81925b";
        c.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    for (const n of game.state.nodes) {
      if (!game.known(0, n)) continue;
      c.fillStyle =
        n.kind === "tree"
          ? "#415f37"
          : n.kind === "gold"
            ? "#cbb878"
            : "#977357";
      c.fillRect(n.x * scale - 1, n.y * scale - 1, 2.5, 2.5);
    }
    for (const e of [...game.state.buildings, ...game.state.units]) {
      if (!game.known(0, e)) continue;
      c.fillStyle = TEAM[e.team];
      if (e.type === "building") {
        const s = footprint(e) * scale;
        c.fillRect(e.x * scale, e.y * scale, s, s);
      } else c.fillRect(e.x * scale - 1, e.y * scale - 1, 2, 2);
    }
    const corners = [
      this.unproject({ x: 0, y: 64 }),
      this.unproject({ x: this.width, y: 64 }),
      this.unproject({ x: this.width, y: this.height - 190 }),
      this.unproject({ x: 0, y: this.height - 190 }),
    ];
    c.strokeStyle = "#e4d2a2";
    c.lineWidth = 1;
    c.beginPath();
    corners.forEach((p, i) =>
      i
        ? c.lineTo(p.x * scale, p.y * scale)
        : c.moveTo(p.x * scale, p.y * scale),
    );
    c.closePath();
    c.stroke();
  }
  icon(kind: BuildingKind | Unit["kind"], team = 0) {
    const canvas = makeCanvas(96, 80),
      c = canvas.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    if (kind in BUILDING) {
      const b: Building = {
        type: "building",
        id: 0,
        kind: kind as BuildingKind,
        team: team as 0 | 1,
        x: 0,
        y: 0,
        hp: 1,
        maxHp: 1,
        progress: 1,
        queue: [],
        cooldown: 0,
        rally: null,
      };
      const source = this.buildingSprite(b);
      c.drawImage(source, 37, 50, 182, 184, 0, -7, 96, 96);
    } else {
      const u = { kind, team, carry: 0 } as Unit;
      const sprite = this.unitSprite(u, 0);
      c.drawImage(sprite, 10, 8, 75, 80);
    }
    return canvas.toDataURL();
  }
}
