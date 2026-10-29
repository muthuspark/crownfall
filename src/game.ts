export type Team = 0 | 1;
export type Resource = "food" | "wood" | "gold";
export type UnitKind = "villager" | "spearman" | "archer" | "cavalry";
export type BuildingKind =
  | "townCenter"
  | "house"
  | "farm"
  | "barracks"
  | "range"
  | "stable";
export type Point = { x: number; y: number };
export const SIZE = 72;
export const SAVE_VERSION = 1;
export const POP_LIMIT = 60;
export const FIXED_STEP = 0.1;
export type Cost = Partial<Record<Resource, number>>;
export const UNIT: Record<
  UnitKind,
  {
    name: string;
    cost: Cost;
    hp: number;
    attack: number;
    range: number;
    speed: number;
    time: number;
    building: BuildingKind;
    age: number;
  }
> = {
  villager: {
    name: "Villager",
    cost: { food: 50 },
    hp: 45,
    attack: 3,
    range: 1.15,
    speed: 1.65,
    time: 18,
    building: "townCenter",
    age: 1,
  },
  spearman: {
    name: "Spearman",
    cost: { food: 55, wood: 25 },
    hp: 75,
    attack: 6,
    range: 1.35,
    speed: 1.55,
    time: 20,
    building: "barracks",
    age: 1,
  },
  archer: {
    name: "Archer",
    cost: { wood: 30, gold: 40 },
    hp: 45,
    attack: 5,
    range: 5,
    speed: 1.5,
    time: 24,
    building: "range",
    age: 1,
  },
  cavalry: {
    name: "Cavalry",
    cost: { food: 80, gold: 60 },
    hp: 145,
    attack: 10,
    range: 1.3,
    speed: 2.35,
    time: 32,
    building: "stable",
    age: 2,
  },
};
export const BUILDING: Record<
  BuildingKind,
  {
    name: string;
    cost: Cost;
    hp: number;
    size: number;
    time: number;
    age: number;
  }
> = {
  townCenter: {
    name: "Town Center",
    cost: { wood: 400 },
    hp: 2400,
    size: 4,
    time: 90,
    age: 1,
  },
  house: {
    name: "House",
    cost: { wood: 35 },
    hp: 450,
    size: 2,
    time: 25,
    age: 1,
  },
  farm: {
    name: "Farm",
    cost: { wood: 60 },
    hp: 220,
    size: 3,
    time: 20,
    age: 1,
  },
  barracks: {
    name: "Barracks",
    cost: { wood: 150 },
    hp: 1100,
    size: 3,
    time: 45,
    age: 1,
  },
  range: {
    name: "Archery Range",
    cost: { wood: 150 },
    hp: 900,
    size: 3,
    time: 45,
    age: 1,
  },
  stable: {
    name: "Stable",
    cost: { wood: 180 },
    hp: 1100,
    size: 3,
    time: 50,
    age: 2,
  },
};
export const ADVANCE_COST: Cost = { food: 600, gold: 300 };
export const UPGRADE_COST: Cost = { food: 250, gold: 200 };
export interface Order {
  kind: "idle" | "move" | "attackMove" | "gather" | "build" | "attack";
  x: number;
  y: number;
  target?: number;
}
export interface Unit extends Point {
  id: number;
  type: "unit";
  kind: UnitKind;
  team: Team;
  hp: number;
  maxHp: number;
  order: Order;
  path: Point[];
  repath: number;
  cooldown: number;
  carry: number;
  cargo: Resource | null;
  returning: boolean;
  work: number;
}
export interface QueueItem {
  kind: UnitKind | "advance" | "upgrade";
  remaining: number;
  total: number;
}
export interface Building extends Point {
  id: number;
  type: "building";
  kind: BuildingKind;
  team: Team;
  hp: number;
  maxHp: number;
  progress: number;
  queue: QueueItem[];
  cooldown: number;
  rally: Point | null;
}
export interface ResourceNode extends Point {
  id: number;
  type: "resource";
  kind: "tree" | "berries" | "gold";
  amount: number;
}
export type Entity = Unit | Building | ResourceNode;
export interface Player {
  resources: Record<Resource, number>;
  age: 1 | 2;
  upgraded: boolean;
  explored: number[];
  stats: { gathered: number; built: number; trained: number; kills: number };
}
export interface Effect extends Point {
  kind: "hit" | "arrow" | "flag";
  tx: number;
  ty: number;
  life: number;
  max: number;
  team: Team;
}
export interface GameState {
  version: number;
  time: number;
  visionClock: number;
  seed: number;
  nextId: number;
  units: Unit[];
  buildings: Building[];
  nodes: ResourceNode[];
  players: Player[];
  terrain: number[];
  winner: Team | null;
  ai: { nextThink: number; nextRaid: number; raids: number };
  objectives: number;
}
export interface Notice {
  text: string;
  time: number;
}
const idle = (): Order => ({ kind: "idle", x: 0, y: 0 });
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const cell = (x: number, y: number) =>
  Math.floor(y) * SIZE + Math.floor(x);
export const inBounds = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export function resourceOf(n: ResourceNode): Resource {
  return n.kind === "tree" ? "wood" : n.kind === "berries" ? "food" : "gold";
}
export function footprint(b: Building) {
  return BUILDING[b.kind].size;
}
export function center(e: Entity): Point {
  const s = e.type === "building" ? footprint(e) : 0;
  return { x: e.x + s / 2, y: e.y + s / 2 };
}
export function entityDistance(p: Point, e: Entity) {
  if (e.type !== "building") return distance(p, e);
  const s = footprint(e);
  return Math.hypot(
    Math.max(e.x - p.x, 0, p.x - e.x - s),
    Math.max(e.y - p.y, 0, p.y - e.y - s),
  );
}
export function damage(
  attacker: UnitKind,
  target: UnitKind | BuildingKind,
  upgraded = false,
) {
  let value = UNIT[attacker].attack + (upgraded ? 2 : 0);
  if (attacker === "spearman" && target === "cavalry") value *= 2.8;
  if (attacker === "archer" && target === "spearman") value *= 1.65;
  if (attacker === "cavalry" && target === "archer") value *= 1.6;
  if (target in BUILDING && attacker === "archer") value *= 0.45;
  return value;
}

export class Game {
  state: GameState;
  effects: Effect[] = [];
  notices: Notice[] = [];
  blocked = new Uint8Array(SIZE * SIZE);
  private unitsByCell = new Map<number, Unit[]>();
  constructor(state?: GameState) {
    this.state = state ?? {
      version: SAVE_VERSION,
      time: 0,
      visionClock: 0,
      seed: 71423,
      nextId: 1,
      units: [],
      buildings: [],
      nodes: [],
      players: [0, 1].map(() => ({
        resources: { food: 300, wood: 400, gold: 120 },
        age: 1,
        upgraded: false,
        explored: Array(SIZE * SIZE).fill(0),
        stats: { gathered: 0, built: 0, trained: 0, kills: 0 },
      })),
      terrain: [],
      winner: null,
      ai: { nextThink: 3, nextRaid: 270, raids: 0 },
      objectives: 0,
    };
    if (!state) this.generate();
    this.rebuildBlocked();
    if (!state) this.reveal();
    this.rebuildSpatial();
  }
  random() {
    this.state.seed = (Math.imul(this.state.seed, 1664525) + 1013904223) >>> 0;
    return this.state.seed / 4294967296;
  }
  get player() {
    return this.state.players[0];
  }
  get entities(): Entity[] {
    return [...this.state.units, ...this.state.buildings, ...this.state.nodes];
  }
  find(id: number): Entity | undefined {
    return (
      this.state.units.find((e) => e.id === id) ??
      this.state.buildings.find((e) => e.id === id) ??
      this.state.nodes.find((e) => e.id === id)
    );
  }
  population(team: Team) {
    return this.state.units.filter((u) => u.team === team).length;
  }
  capacity(team: Team) {
    return Math.min(
      POP_LIMIT,
      this.state.buildings
        .filter((b) => b.team === team && b.progress >= 1)
        .reduce(
          (n, b) =>
            n + (b.kind === "townCenter" ? 10 : b.kind === "house" ? 5 : 0),
          0,
        ),
    );
  }
  reserved(team: Team) {
    return (
      this.population(team) +
      this.state.buildings
        .filter((b) => b.team === team)
        .reduce((n, b) => n + b.queue.filter((q) => q.kind in UNIT).length, 0)
    );
  }
  canAfford(team: Team, cost: Cost) {
    return (Object.entries(cost) as [Resource, number][]).every(
      ([r, n]) => this.state.players[team].resources[r] >= n,
    );
  }
  pay(team: Team, cost: Cost) {
    if (!this.canAfford(team, cost)) return false;
    for (const [r, n] of Object.entries(cost))
      this.state.players[team].resources[r as Resource] -= n;
    return true;
  }
  notify(text: string) {
    this.notices.unshift({ text, time: 5 });
    this.notices = this.notices.slice(0, 3);
  }
  addBuilding(
    kind: BuildingKind,
    team: Team,
    x: number,
    y: number,
    complete = true,
  ): Building {
    const def = BUILDING[kind];
    const b: Building = {
      id: this.state.nextId++,
      type: "building",
      kind,
      team,
      x,
      y,
      hp: complete ? def.hp : Math.max(1, def.hp * 0.05),
      maxHp: def.hp,
      progress: complete ? 1 : 0,
      queue: [],
      cooldown: 0,
      rally: null,
    };
    this.state.buildings.push(b);
    return b;
  }
  addUnit(kind: UnitKind, team: Team, x: number, y: number) {
    const maxHp = UNIT[kind].hp * (this.state.players[team].upgraded ? 1.2 : 1);
    const u: Unit = {
      id: this.state.nextId++,
      type: "unit",
      kind,
      team,
      x,
      y,
      hp: maxHp,
      maxHp,
      order: idle(),
      path: [],
      repath: 0,
      cooldown: 0,
      carry: 0,
      cargo: null,
      returning: false,
      work: 0,
    };
    this.state.units.push(u);
    return u;
  }
  private generate() {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const pond =
          Math.pow((x - 36) / 5, 2) + Math.pow((y - 18) / 3.6, 2) < 1 ||
          Math.pow((x - 35) / 4.5, 2) + Math.pow((y - 54) / 3.2, 2) < 1;
        this.state.terrain.push(pond ? 3 : this.random() < 0.12 ? 1 : 0);
      }
    // A fixed old road joins both settlements across the central meadow.
    for (let t = 8; t < 64; t++)
      for (let w = -1; w <= 1; w++) {
        const x = t,
          y = t + w;
        if (inBounds(x, y)) this.state.terrain[cell(x, y)] = 2;
      }
    const starts: Point[] = [
      { x: 12, y: 12 },
      { x: 56, y: 56 },
    ];
    for (const [index, p] of starts.entries()) {
      const team = index as Team;
      this.addBuilding("townCenter", team, p.x, p.y);
      this.addBuilding("house", team, p.x - 4, p.y + 2);
      this.addBuilding("barracks", team, p.x + 6, p.y + 1);
      for (let i = 0; i < 5; i++)
        this.addUnit("villager", team, p.x - 1 + i * 0.7, p.y + 5.5);
      this.addUnit("spearman", team, p.x + 5.2, p.y + 5.5);
      this.addUnit("spearman", team, p.x + 6, p.y + 5.7);
    }
    const clusters: [number, number, ResourceNode["kind"], number][] = [
      [7, 21, "tree", 44],
      [22, 7, "tree", 42],
      [48, 65, "tree", 44],
      [65, 48, "tree", 42],
      [7, 9, "berries", 8],
      [63, 61, "berries", 8],
      [23, 18, "gold", 8],
      [49, 53, "gold", 8],
      [20, 40, "tree", 50],
      [49, 29, "tree", 50],
      [7, 46, "tree", 48],
      [62, 24, "tree", 48],
      [32, 41, "gold", 10],
      [41, 31, "gold", 10],
      [29, 29, "berries", 9],
      [43, 43, "berries", 9],
      [5, 5, "tree", 30],
      [66, 66, "tree", 30],
      [39, 6, "tree", 25],
      [31, 65, "tree", 25],
    ];
    const occupied = new Set<number>();
    for (const [cx, cy, kind, count] of clusters) {
      for (let n = 0; n < count * 4 && [...occupied].length < 2000; n++) {
        if (n >= count * 3) break;
        const radius = kind === "tree" ? 5 : 2.2;
        const x = Math.round(cx + (this.random() - 0.5) * radius * 2),
          y = Math.round(cy + (this.random() - 0.5) * radius * 2);
        if (
          !inBounds(x, y) ||
          x < 2 ||
          y < 2 ||
          x > 69 ||
          y > 69 ||
          occupied.has(cell(x, y)) ||
          this.state.terrain[cell(x, y)] >= 2
        )
          continue;
        if (
          this.state.buildings.some(
            (b) =>
              x >= b.x - 1 &&
              x <= b.x + footprint(b) &&
              y >= b.y - 1 &&
              y <= b.y + footprint(b),
          )
        )
          continue;
        occupied.add(cell(x, y));
        this.state.nodes.push({
          id: this.state.nextId++,
          type: "resource",
          kind,
          x: x + 0.5,
          y: y + 0.5,
          amount: kind === "tree" ? 170 : kind === "gold" ? 650 : 180,
        });
        if (n >= count) break;
      }
    }
  }
  rebuildBlocked() {
    this.blocked.fill(0);
    this.state.terrain.forEach((v, i) => {
      if (v === 3) this.blocked[i] = 1;
    });
    for (const n of this.state.nodes)
      if (n.amount > 0) this.blocked[cell(n.x, n.y)] = 1;
    for (const b of this.state.buildings)
      for (let y = b.y; y < b.y + footprint(b); y++)
        for (let x = b.x; x < b.x + footprint(b); x++)
          if (inBounds(x, y)) this.blocked[cell(x, y)] = 1;
  }
  walkable(x: number, y: number) {
    return inBounds(x, y) && !this.blocked[cell(x, y)];
  }
  known(team: Team, e: Entity) {
    return (
      this.state.players[team].explored[cell(center(e).x, center(e).y)] === 1
    );
  }
  reveal() {
    for (const e of [...this.state.units, ...this.state.buildings]) {
      const c = center(e),
        r = e.type === "building" ? 9 : e.kind === "cavalry" ? 8 : 6;
      const explored = this.state.players[e.team].explored;
      for (
        let y = Math.max(0, Math.floor(c.y - r));
        y < Math.min(SIZE, Math.ceil(c.y + r));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(c.x - r));
          x < Math.min(SIZE, Math.ceil(c.x + r));
          x++
        )
          if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) < r)
            explored[cell(x, y)] = 1;
    }
  }
  canPlace(kind: BuildingKind, x: number, y: number, team: Team) {
    const s = BUILDING[kind].size;
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 1 ||
      y < 1 ||
      x + s >= SIZE ||
      y + s >= SIZE
    )
      return false;
    if (this.state.players[team].age < BUILDING[kind].age) return false;
    for (let yy = y; yy < y + s; yy++)
      for (let xx = x; xx < x + s; xx++)
        if (
          !this.walkable(xx, yy) ||
          !this.state.players[team].explored[cell(xx, yy)]
        )
          return false;
    return !this.state.units.some(
      (u) => u.x >= x && u.x < x + s && u.y >= y && u.y < y + s,
    );
  }
  place(
    kind: BuildingKind,
    x: number,
    y: number,
    team: Team,
    builders: number[],
  ) {
    if (
      !builders.some((id) =>
        this.state.units.some(
          (u) => u.id === id && u.team === team && u.kind === "villager",
        ),
      )
    )
      return false;
    if (!this.canPlace(kind, x, y, team)) return false;
    const site = { type: "building", kind, x, y } as Building;
    const reachable = builders.some((id) => {
      const u = this.state.units.find(
        (u) => u.id === id && u.kind === "villager" && u.team === team,
      );
      if (!u) return false;
      if (entityDistance(u, site) <= 1.3) return true;
      const end = this.pathfind(u, this.approach(site, u)).at(-1);
      return !!end && entityDistance(end, site) <= 1.3;
    });
    if (!reachable || !this.pay(team, BUILDING[kind].cost)) return false;
    const b = this.addBuilding(kind, team, x, y, false);
    this.rebuildBlocked();
    this.command(
      builders,
      {
        kind: "build",
        target: b.id,
        x: x + footprint(b) / 2,
        y: y + footprint(b) / 2,
      },
      team,
    );
    return true;
  }
  queue(id: number, kind: QueueItem["kind"], team: Team): boolean {
    const b = this.state.buildings.find(
      (b) => b.id === id && b.team === team && b.progress >= 1,
    );
    if (!b || b.queue.length >= 5) return false;
    if (kind === "advance" || kind === "upgrade") {
      const p = this.state.players[team];
      if (
        b.kind !== "townCenter" ||
        (kind === "advance" ? p.age >= 2 : p.age < 2 || p.upgraded)
      )
        return false;
      if (
        this.state.buildings.some(
          (b) => b.team === team && b.queue.some((q) => q.kind === kind),
        )
      )
        return false;
      if (!this.pay(team, kind === "advance" ? ADVANCE_COST : UPGRADE_COST))
        return false;
      const total = kind === "advance" ? 100 : 50;
      b.queue.push({ kind, total, remaining: total });
      return true;
    }
    const def = UNIT[kind];
    if (
      def.building !== b.kind ||
      this.state.players[team].age < def.age ||
      this.reserved(team) >= this.capacity(team) ||
      !this.pay(team, def.cost)
    )
      return false;
    b.queue.push({ kind, total: def.time, remaining: def.time });
    return true;
  }
  cancelQueue(id: number, index: number) {
    const b = this.state.buildings.find((b) => b.id === id && b.team === 0);
    if (!b || !b.queue[index]) return;
    const [q] = b.queue.splice(index, 1);
    const cost =
      q.kind === "advance"
        ? ADVANCE_COST
        : q.kind === "upgrade"
          ? UPGRADE_COST
          : UNIT[q.kind].cost;
    for (const [r, n] of Object.entries(cost))
      this.player.resources[r as Resource] += n;
  }
  command(ids: number[], order: Order, team: Team = 0) {
    let index = 0;
    for (const id of ids) {
      const u = this.state.units.find((u) => u.id === id && u.team === team);
      if (!u) continue;
      if (
        (order.kind === "gather" || order.kind === "build") &&
        u.kind !== "villager"
      )
        continue;
      u.order = { ...order };
      if (order.kind === "move" || order.kind === "attackMove") {
        const offset = this.formationOffset(index++);
        u.order.x = Math.max(0.5, Math.min(SIZE - 0.5, order.x + offset.x));
        u.order.y = Math.max(0.5, Math.min(SIZE - 0.5, order.y + offset.y));
      }
      u.path = [];
      u.repath = 0;
      u.work = 0;
      if (order.kind !== "gather") u.returning = false;
      else if (u.carry > 0) {
        const target = order.target ? this.find(order.target) : undefined;
        const nextCargo =
          target?.type === "resource" ? resourceOf(target) : "food";
        if (u.cargo !== nextCargo) u.returning = true;
      }
    }
    if (team === 0 && (order.kind === "move" || order.kind === "attackMove"))
      this.effects.push({
        kind: "flag",
        x: order.x,
        y: order.y,
        tx: order.x,
        ty: order.y,
        life: 0.8,
        max: 0.8,
        team,
      });
  }
  private formationOffset(i: number): Point {
    if (i === 0) return { x: 0, y: 0 };
    const a = i * 2.4,
      r = 0.5 * Math.sqrt(i);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  private reachableGoal(from: Point, to: Point): Point | null {
    const tx = Math.floor(to.x),
      ty = Math.floor(to.y);
    let best: Point | null = null,
      score = Infinity;
    for (let r = 0; r <= 7; r++) {
      for (let y = ty - r; y <= ty + r; y++)
        for (let x = tx - r; x <= tx + r; x++) {
          if (
            r > 0 &&
            x !== tx - r &&
            x !== tx + r &&
            y !== ty - r &&
            y !== ty + r
          )
            continue;
          if (!this.walkable(x, y)) continue;
          const p = { x: x + 0.5, y: y + 0.5 };
          const s = distance(p, to) * 3 + distance(p, from);
          if (s < score) {
            best = p;
            score = s;
          }
        }
      if (best) return best;
    }
    return null;
  }
  pathfind(from: Point, to: Point): Point[] {
    const end = this.reachableGoal(from, to);
    if (!end) return [];
    const sx = Math.floor(from.x),
      sy = Math.floor(from.y),
      ex = Math.floor(end.x),
      ey = Math.floor(end.y);
    if (sx === ex && sy === ey) return [end];
    const start = cell(sx, sy),
      goal = cell(ex, ey),
      g = new Float32Array(SIZE * SIZE).fill(Infinity),
      parent = new Int32Array(SIZE * SIZE).fill(-1),
      closed = new Uint8Array(SIZE * SIZE);
    g[start] = 0;
    const heap: { i: number; f: number }[] = [];
    const push = (v: { i: number; f: number }) => {
      heap.push(v);
      let n = heap.length - 1;
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (heap[p].f <= v.f) break;
        heap[n] = heap[p];
        n = p;
      }
      heap[n] = v;
    };
    const pop = () => {
      const root = heap[0],
        last = heap.pop()!;
      if (heap.length) {
        let n = 0;
        while (n * 2 + 1 < heap.length) {
          let c = n * 2 + 1;
          if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
          if (heap[c].f >= last.f) break;
          heap[n] = heap[c];
          n = c;
        }
        heap[n] = last;
      }
      return root;
    };
    push({ i: start, f: 0 });
    let found = false,
      iterations = 0;
    while (heap.length && iterations++ < SIZE * SIZE * 2) {
      const current = pop().i;
      if (closed[current]) continue;
      if (current === goal) {
        found = true;
        break;
      }
      closed[current] = 1;
      const x = current % SIZE,
        y = Math.floor(current / SIZE);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || !this.walkable(x + dx, y + dy)) continue;
          if (
            dx &&
            dy &&
            (!this.walkable(x + dx, y) || !this.walkable(x, y + dy))
          )
            continue;
          const ni = cell(x + dx, y + dy),
            ng = g[current] + (dx && dy ? 1.4142 : 1);
          if (ng >= g[ni]) continue;
          g[ni] = ng;
          parent[ni] = current;
          push({ i: ni, f: ng + Math.hypot(ex - x - dx, ey - y - dy) });
        }
    }
    if (!found) return [];
    const path: Point[] = [];
    for (let at = goal; at !== start && at !== -1; at = parent[at])
      path.push({ x: (at % SIZE) + 0.5, y: Math.floor(at / SIZE) + 0.5 });
    return path.reverse();
  }
  private approach(e: Entity, from: Point): Point {
    if (e.type !== "building") return e;
    const s = footprint(e);
    const candidates: Point[] = [];
    for (let t = 0; t < s; t++)
      candidates.push(
        { x: e.x - 0.5, y: e.y + t + 0.5 },
        { x: e.x + s + 0.5, y: e.y + t + 0.5 },
        { x: e.x + t + 0.5, y: e.y - 0.5 },
        { x: e.x + t + 0.5, y: e.y + s + 0.5 },
      );
    return (
      candidates
        .filter((p) => this.walkable(p.x, p.y))
        .sort((a, b) => distance(a, from) - distance(b, from))[0] ?? center(e)
    );
  }
  private move(u: Unit, to: Point, dt: number) {
    u.repath -= dt;
    if (u.repath <= 0) {
      u.path = this.pathfind(u, to);
      u.repath = 2 + this.random();
    }
    const next = u.path[0];
    if (!next) return false;
    if (!this.walkable(next.x, next.y)) {
      u.path = [];
      u.repath = 0;
      return false;
    }
    const d = distance(u, next),
      step = UNIT[u.kind].speed * dt;
    if (d <= step) {
      u.x = next.x;
      u.y = next.y;
      u.path.shift();
    } else {
      u.x += ((next.x - u.x) / d) * step;
      u.y += ((next.y - u.y) / d) * step;
    }
    return true;
  }
  private rebuildSpatial() {
    this.unitsByCell.clear();
    for (const u of this.state.units) {
      const key = cell(u.x, u.y),
        list = this.unitsByCell.get(key) ?? [];
      list.push(u);
      this.unitsByCell.set(key, list);
    }
  }
  private nearby(p: Point, r: number) {
    const result: Unit[] = [];
    for (
      let y = Math.max(0, Math.floor(p.y - r));
      y <= Math.min(SIZE - 1, Math.floor(p.y + r));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(p.x - r));
        x <= Math.min(SIZE - 1, Math.floor(p.x + r));
        x++
      ) {
        const list = this.unitsByCell.get(cell(x, y));
        if (list) result.push(...list);
      }
    return result;
  }
  private enemy(u: Unit): Unit | Building | undefined {
    let best: Unit | Building | undefined,
      score = Infinity;
    for (const other of this.nearby(u, 6)) {
      if (other.team === u.team || other.hp <= 0 || !this.known(u.team, other))
        continue;
      const d = distance(u, other);
      if (d < 6 && d < score) {
        best = other;
        score = d;
      }
    }
    if (best) return best;
    for (const b of this.state.buildings) {
      if (b.team === u.team || b.hp <= 0 || !this.known(u.team, b)) continue;
      const d = entityDistance(u, b);
      if (d < 5 && d < score) {
        best = b;
        score = d;
      }
    }
    return best;
  }
  private attack(u: Unit, target: Unit | Building, dt: number) {
    const range = UNIT[u.kind].range;
    if (entityDistance(u, target) > range) {
      this.move(u, this.approach(target, u), dt);
      return;
    }
    u.path = [];
    if (u.cooldown > 0) return;
    u.cooldown = u.kind === "archer" ? 1.5 : 1.25;
    const hit = damage(
      u.kind,
      target.kind,
      this.state.players[u.team].upgraded,
    );
    target.hp -= hit;
    const c = center(target);
    this.effects.push({
      kind: u.kind === "archer" ? "arrow" : "hit",
      x: u.x,
      y: u.y,
      tx: c.x,
      ty: c.y,
      life: 0.35,
      max: 0.35,
      team: u.team,
    });
    if (target.hp <= 0) this.state.players[u.team].stats.kills++;
  }
  private resourceAccessible(n: ResourceNode) {
    return [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].some(([dx, dy]) => this.walkable(n.x + dx, n.y + dy));
  }
  private nextResource(u: Unit, resource: Resource) {
    const choices: Entity[] = [
      ...this.state.nodes.filter(
        (n) =>
          n.amount > 0 &&
          resourceOf(n) === resource &&
          this.known(u.team, n) &&
          this.resourceAccessible(n),
      ),
    ];
    if (resource === "food")
      choices.push(
        ...this.state.buildings.filter(
          (b) => b.team === u.team && b.kind === "farm" && b.progress >= 1,
        ),
      );
    for (const target of choices.sort(
      (a, b) => entityDistance(u, a) - entityDistance(u, b),
    )) {
      if (entityDistance(u, target) <= 1.15) return target;
      const path = this.pathfind(u, this.approach(target, u)),
        end = path.at(-1);
      if (end && entityDistance(end, target) <= 1.15) return target;
    }
    return undefined;
  }
  private updateGather(u: Unit, dt: number) {
    let target = u.order.target ? this.find(u.order.target) : undefined;
    const resource =
      u.cargo ?? (target?.type === "resource" ? resourceOf(target) : "food");
    if (target?.type === "resource" && !this.resourceAccessible(target))
      target = undefined;
    if (u.returning) {
      const tc = this.state.buildings.find(
        (b) => b.team === u.team && b.kind === "townCenter" && b.progress >= 1,
      );
      if (!tc) {
        u.order = idle();
        return;
      }
      if (entityDistance(u, tc) <= 1.2) {
        this.state.players[u.team].resources[resource] += u.carry;
        this.state.players[u.team].stats.gathered += u.carry;
        u.carry = 0;
        u.returning = false;
        u.path = [];
        u.repath = 0;
      } else this.move(u, this.approach(tc, u), dt);
      return;
    }
    if (!target || (target.type === "resource" && target.amount <= 0)) {
      target = this.nextResource(u, resource);
      if (!target) {
        if (u.carry > 0) u.returning = true;
        else u.order = idle();
        return;
      }
      u.order.target = target.id;
      u.path = [];
      u.repath = 0;
    }
    if (
      target.type !== "resource" &&
      !(
        target.type === "building" &&
        target.kind === "farm" &&
        target.team === u.team &&
        target.progress >= 1
      )
    ) {
      u.order = idle();
      return;
    }
    if (entityDistance(u, target) > 1.15) {
      if (this.move(u, this.approach(target, u), dt)) u.work = 0;
      else u.work += dt;
      if (u.work > 6) {
        const alternative = this.nextResource(u, resource);
        if (alternative) {
          u.order.target = alternative.id;
          u.path = [];
          u.repath = 0;
        }
        u.work = 0;
      }
      return;
    }
    u.path = [];
    u.cargo = target.type === "resource" ? resourceOf(target) : "food";
    let amount =
      dt * (u.cargo === "wood" ? 1.05 : u.cargo === "gold" ? 1 : 1.3);
    if (target.type === "resource") {
      amount = Math.min(amount, target.amount);
      target.amount -= amount;
    }
    u.carry += amount;
    if (u.carry >= 12 || (target.type === "resource" && target.amount <= 0)) {
      u.returning = true;
      u.repath = 0;
    }
  }
  private updateUnit(u: Unit, dt: number) {
    u.cooldown = Math.max(0, u.cooldown - dt);
    if (u.hp <= 0) return;
    let target = u.order.target ? this.find(u.order.target) : undefined;
    if (u.order.kind === "attack") {
      if (
        !target ||
        target.type === "resource" ||
        target.hp <= 0 ||
        !this.known(u.team, target)
      ) {
        u.order = idle();
        u.path = [];
      } else {
        this.attack(u, target, dt);
        return;
      }
    }
    if (
      (u.order.kind === "idle" || u.order.kind === "attackMove") &&
      u.kind !== "villager"
    ) {
      const enemy = this.enemy(u);
      if (enemy) {
        this.attack(u, enemy, dt);
        return;
      }
    }
    if (u.order.kind === "gather") {
      this.updateGather(u, dt);
      return;
    }
    if (u.order.kind === "build") {
      if (!target || target.type !== "building" || target.hp <= 0) {
        u.order = idle();
        return;
      }
      if (target.progress >= 1) {
        u.order = idle();
        u.path = [];
        if (target.kind === "farm")
          u.order = {
            kind: "gather",
            target: target.id,
            x: target.x,
            y: target.y,
          };
        return;
      }
      if (entityDistance(u, target) > 1.3)
        this.move(u, this.approach(target, u), dt);
      else {
        u.path = [];
        const delta = Math.min(
          1 - target.progress,
          dt / BUILDING[target.kind].time,
        );
        target.progress += delta;
        target.hp = Math.min(
          target.maxHp,
          target.hp + delta * target.maxHp * 0.95,
        );
        if (target.progress >= 1) {
          this.state.players[u.team].stats.built++;
          this.reveal();
          if (u.team === 0)
            this.notify(`${BUILDING[target.kind].name} completed`);
        }
      }
      return;
    }
    if (u.order.kind === "move" || u.order.kind === "attackMove") {
      if (distance(u, u.order) < 0.55) {
        u.order = idle();
        u.path = [];
      } else {
        const moved = this.move(u, u.order, dt);
        if (!moved) {
          u.work += dt;
          if (u.work > 4) {
            u.order = idle();
            u.path = [];
          }
        } else u.work = 0;
      }
    }
  }
  private spawnNear(b: Building) {
    const c = center(b);
    for (let r = footprint(b) / 2 + 0.8; r < footprint(b) + 4; r += 0.7)
      for (let a = 0; a < Math.PI * 2; a += 0.45) {
        const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
        if (
          this.walkable(p.x, p.y) &&
          !this.state.units.some((u) => distance(u, p) < 0.45)
        )
          return p;
      }
    return null;
  }
  private updateBuilding(b: Building, dt: number) {
    if (b.hp <= 0 || b.progress < 1) return;
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.kind === "townCenter" && b.cooldown <= 0) {
      const c = center(b);
      const target = this.nearby(c, 8)
        .filter(
          (u) =>
            u.team !== b.team &&
            u.hp > 0 &&
            this.known(b.team, u) &&
            entityDistance(u, b) < 6,
        )
        .sort((a, d) => distance(a, c) - distance(d, c))[0];
      if (target) {
        target.hp -= 7;
        b.cooldown = 1.3;
        this.effects.push({
          kind: "arrow",
          x: c.x,
          y: c.y,
          tx: target.x,
          ty: target.y,
          life: 0.4,
          max: 0.4,
          team: b.team,
        });
        if (target.hp <= 0) this.state.players[b.team].stats.kills++;
      }
    }
    const q = b.queue[0];
    if (!q) return;
    if (q.kind in UNIT && this.population(b.team) >= this.capacity(b.team))
      return;
    q.remaining = Math.max(0, q.remaining - dt);
    if (q.remaining > 0) return;
    if (q.kind === "advance") {
      this.state.players[b.team].age = 2;
      if (b.team === 0)
        this.notify("Castle Age reached. Cavalry is now available.");
    } else if (q.kind === "upgrade") {
      this.state.players[b.team].upgraded = true;
      for (const u of this.state.units.filter((u) => u.team === b.team)) {
        u.maxHp = UNIT[u.kind].hp * 1.2;
        u.hp = Math.min(u.maxHp, u.hp + UNIT[u.kind].hp * 0.2);
      }
      if (b.team === 0)
        this.notify("Forged arms complete. Your units are stronger.");
    } else {
      const p = this.spawnNear(b);
      if (!p) return;
      const u = this.addUnit(q.kind, b.team, p.x, p.y);
      this.state.players[b.team].stats.trained++;
      if (b.rally) {
        const near = this.entities
          .filter(
            (e) =>
              e.type === "resource" ||
              (e.type === "building" && e.team === b.team && e.kind === "farm"),
          )
          .find((e) => entityDistance(b.rally!, e) < 1);
        if (u.kind === "villager" && near) {
          u.order = { kind: "gather", target: near.id, x: near.x, y: near.y };
        } else u.order = { kind: "move", ...b.rally };
      }
    }
    b.queue.shift();
  }
  private aiPlace(kind: BuildingKind) {
    const builders = this.state.units.filter(
      (u) => u.team === 1 && u.kind === "villager" && u.order.kind !== "build",
    );
    if (!builders.length) return false;
    const tc = this.state.buildings.find(
      (b) => b.team === 1 && b.kind === "townCenter",
    );
    if (!tc) return false;
    for (let r = 5; r < 19; r += 2)
      for (let a = 0; a < Math.PI * 2; a += 0.55) {
        const x = Math.round(tc.x + Math.cos(a) * r),
          y = Math.round(tc.y + Math.sin(a) * r);
        if (
          this.canPlace(kind, x, y, 1) &&
          this.place(kind, x, y, 1, [builders[0].id])
        )
          return true;
      }
    return false;
  }
  private thinkAI() {
    const s = this.state,
      p = s.players[1],
      villagers = s.units.filter((u) => u.team === 1 && u.kind === "villager"),
      mine = s.buildings.filter((b) => b.team === 1),
      tc = mine.find((b) => b.kind === "townCenter");
    if (!tc) return;
    const pending = mine.filter((b) => b.progress < 1);
    for (const b of pending)
      if (
        !villagers.some(
          (u) => u.order.kind === "build" && u.order.target === b.id,
        )
      ) {
        const free = villagers.find((u) => u.order.kind !== "build");
        if (free)
          this.command(
            [free.id],
            { kind: "build", target: b.id, ...center(b) },
            1,
          );
      }
    const counts = { food: 0, wood: 0, gold: 0 };
    for (const v of villagers)
      if (v.order.kind === "gather") {
        const target = this.find(v.order.target ?? -1);
        if (target?.type === "resource") counts[resourceOf(target)]++;
        else if (target?.type === "building") counts.food++;
      }
    for (const u of villagers.filter((u) => u.order.kind === "idle")) {
      const r: Resource =
        counts.food < Math.ceil(villagers.length * 0.43)
          ? "food"
          : counts.wood < Math.ceil(villagers.length * 0.35)
            ? "wood"
            : "gold";
      const target = this.nextResource(u, r);
      if (target) {
        this.command(
          [u.id],
          { kind: "gather", target: target.id, ...center(target) },
          1,
        );
        counts[r]++;
      }
    }
    if (villagers.length < 22 && tc.queue.length < 2)
      this.queue(tc.id, "villager", 1);
    if (
      this.reserved(1) >= this.capacity(1) - 3 &&
      this.capacity(1) < 60 &&
      !mine.some((b) => b.kind === "house" && b.progress < 1)
    )
      this.aiPlace("house");
    if (!mine.some((b) => b.kind === "range") && s.time > 100)
      this.aiPlace("range");
    if (s.time > 440 && p.age === 1 && tc.queue.length < 2)
      this.queue(tc.id, "advance", 1);
    if (p.age === 2 && !mine.some((b) => b.kind === "stable"))
      this.aiPlace("stable");
    if (p.age === 2 && !p.upgraded && s.time > 650)
      this.queue(tc.id, "upgrade", 1);
    if (
      p.resources.food < 120 &&
      p.resources.wood > 100 &&
      counts.food < 8 &&
      !mine.some((b) => b.kind === "farm" && b.progress < 1)
    )
      this.aiPlace("farm");
    for (const b of mine.filter(
      (b) =>
        ["barracks", "range", "stable"].includes(b.kind) &&
        b.queue.length < 2 &&
        b.progress >= 1,
    )) {
      const kind: UnitKind =
        b.kind === "barracks"
          ? "spearman"
          : b.kind === "range"
            ? "archer"
            : "cavalry";
      if (
        p.age === 1 &&
        s.time > 380 &&
        (kind === "archer" || p.resources.food < 660)
      )
        continue;
      this.queue(b.id, kind, 1);
    }
    if (s.time >= s.ai.nextRaid) {
      const army = s.units.filter((u) => u.team === 1 && u.kind !== "villager");
      const wave = army
        .filter((u) => u.order.kind === "idle" || u.order.kind === "move")
        .slice(0, Math.min(16, 5 + s.ai.raids * 2));
      if (wave.length >= 3) {
        this.command(
          wave.map((u) => u.id),
          { kind: "attackMove", x: 14, y: 14 },
          1,
        );
        s.ai.raids++;
        s.ai.nextRaid = s.time + 180;
      } else s.ai.nextRaid = s.time + 30;
    }
    // A home guard responds to revealed threats without interrupting workers.
    const threat = s.units.find(
      (u) => u.team === 0 && this.known(1, u) && entityDistance(u, tc) < 12,
    );
    if (threat) {
      const guard = s.units.filter(
        (u) => u.team === 1 && u.kind !== "villager" && u.order.kind === "idle",
      );
      this.command(
        guard.map((u) => u.id),
        { kind: "attackMove", x: threat.x, y: threat.y },
        1,
      );
    }
  }
  update(dt: number) {
    if (this.state.winner !== null) return;
    this.state.time += dt;
    this.effects = this.effects.filter((e) => (e.life -= dt) > 0);
    this.notices = this.notices.filter((n) => (n.time -= dt) > 0);
    this.rebuildSpatial();
    for (const u of this.state.units) this.updateUnit(u, dt);
    for (const b of this.state.buildings) this.updateBuilding(b, dt);
    // Small separation preserves routes while keeping formations legible.
    for (const u of this.state.units) {
      for (const other of this.nearby(u, 0.6)) {
        if (other.id <= u.id) continue;
        const d = distance(u, other);
        if (d < 0.38 && d > 0.001) {
          const k = (0.38 - d) * 0.25;
          const dx = ((u.x - other.x) / d) * k,
            dy = ((u.y - other.y) / d) * k;
          if (this.walkable(u.x + dx, u.y + dy)) {
            u.x += dx;
            u.y += dy;
          }
          if (this.walkable(other.x - dx, other.y - dy)) {
            other.x -= dx;
            other.y -= dy;
          }
        }
      }
    }
    let changed = false;
    const dead = this.state.buildings.filter((b) => b.hp <= 0);
    for (const b of dead)
      if (b.kind === "townCenter") this.state.winner = b.team === 0 ? 1 : 0;
    if (dead.length) {
      this.state.buildings = this.state.buildings.filter((b) => b.hp > 0);
      changed = true;
    }
    this.state.units = this.state.units.filter((u) => u.hp > 0);
    if (this.state.nodes.some((n) => n.amount <= 0)) {
      this.state.nodes = this.state.nodes.filter((n) => n.amount > 0);
      changed = true;
    }
    if (changed) this.rebuildBlocked();
    this.state.visionClock -= dt;
    if (this.state.visionClock <= 0) {
      this.reveal();
      this.state.visionClock = 0.7;
    }
    if (this.state.time >= this.state.ai.nextThink) {
      this.state.ai.nextThink = this.state.time + 4;
      this.thinkAI();
    }
    const p = this.player;
    this.state.objectives |=
      (p.stats.gathered >= 36 ? 1 : 0) |
      (this.state.buildings.some(
        (b) =>
          b.team === 0 && b.kind === "house" && b.progress >= 1 && b.id > 20,
      )
        ? 2
        : 0) |
      (p.stats.trained >= 3 ? 4 : 0) |
      (p.age === 2 ? 8 : 0) |
      (this.state.winner === 0 ? 16 : 0);
  }
  serialize() {
    return JSON.stringify(this.state);
  }
  static restore(raw: string) {
    const s = JSON.parse(raw) as GameState;
    if (
      !s ||
      s.version !== SAVE_VERSION ||
      !Number.isFinite(s.time) ||
      s.time < 0 ||
      !Number.isFinite(s.visionClock) ||
      !Number.isInteger(s.seed) ||
      !Number.isInteger(s.nextId) ||
      !Array.isArray(s.units) ||
      !Array.isArray(s.buildings) ||
      !Array.isArray(s.nodes) ||
      s.units.length > 120 ||
      s.buildings.length > 500 ||
      s.nodes.length > SIZE * SIZE ||
      s.players?.length !== 2 ||
      s.terrain?.length !== SIZE * SIZE ||
      !s.terrain.every((v) => Number.isInteger(v) && v >= 0 && v <= 3) ||
      ![null, 0, 1].includes(s.winner) ||
      !s.ai ||
      !Number.isFinite(s.ai.nextThink) ||
      !Number.isFinite(s.ai.nextRaid)
    )
      throw new Error(
        "This save is incompatible or damaged. Start a new skirmish.",
      );
    const ids = new Set<number>();
    for (const e of [...s.units, ...s.buildings, ...s.nodes]) {
      if (
        !Number.isInteger(e.id) ||
        e.id < 1 ||
        ids.has(e.id) ||
        !Number.isFinite(e.x) ||
        !Number.isFinite(e.y) ||
        !inBounds(e.x, e.y)
      )
        throw new Error("Invalid saved entity");
      ids.add(e.id);
      if (e.type === "unit") {
        if (
          !(e.kind in UNIT) ||
          ![0, 1].includes(e.team) ||
          !Number.isFinite(e.hp) ||
          !Number.isFinite(e.maxHp) ||
          !e.order ||
          !["idle", "move", "attackMove", "gather", "build", "attack"].includes(
            e.order.kind,
          ) ||
          !Array.isArray(e.path) ||
          !e.path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ||
          !Number.isFinite(e.carry) ||
          !Number.isFinite(e.repath) ||
          !Number.isFinite(e.cooldown) ||
          !Number.isFinite(e.work) ||
          !Number.isFinite(e.order.x) ||
          !Number.isFinite(e.order.y)
        )
          throw new Error("Invalid saved unit");
      } else if (e.type === "building") {
        if (
          !(e.kind in BUILDING) ||
          ![0, 1].includes(e.team) ||
          !Number.isFinite(e.hp) ||
          !Number.isFinite(e.progress) ||
          e.progress < 0 ||
          e.progress > 1 ||
          !Array.isArray(e.queue) ||
          e.queue.length > 5 ||
          e.queue.some(
            (q) =>
              (!(q.kind in UNIT) &&
                q.kind !== "advance" &&
                q.kind !== "upgrade") ||
              !Number.isFinite(q.remaining) ||
              !Number.isFinite(q.total),
          )
        )
          throw new Error("Invalid saved building");
      } else if (
        e.type !== "resource" ||
        !["tree", "berries", "gold"].includes(e.kind) ||
        !Number.isFinite(e.amount)
      )
        throw new Error("Invalid saved resource");
    }
    if (s.nextId <= Math.max(0, ...ids))
      throw new Error("Invalid saved identifiers");
    for (const p of s.players)
      if (
        !p.resources ||
        !["food", "wood", "gold"].every(
          (r) =>
            Number.isFinite(p.resources[r as Resource]) &&
            p.resources[r as Resource] >= 0,
        ) ||
        ![1, 2].includes(p.age) ||
        typeof p.upgraded !== "boolean" ||
        p.explored?.length !== SIZE * SIZE ||
        !p.explored.every((v) => v === 0 || v === 1) ||
        !p.stats ||
        !Object.values(p.stats).every(Number.isFinite)
      )
        throw new Error("Invalid saved player");
    return new Game(s);
  }
}
