import { describe, it, expect } from "vitest";
import {
  Game,
  SIZE,
  FIXED_STEP,
  BUILDING,
  damage,
  distance,
  center,
  type UnitKind,
} from "./game";
function tick(g: Game, seconds: number) {
  for (let i = 0; i < seconds / FIXED_STEP; i++) g.update(FIXED_STEP);
}
function quiet() {
  const g = new Game();
  g.state.ai.nextThink = Infinity;
  g.state.ai.nextRaid = Infinity;
  return g;
}
function funded(g: Game) {
  g.player.resources = { food: 5000, wood: 5000, gold: 5000 };
}
function empty() {
  const g = quiet();
  g.state.units = [];
  g.state.nodes = [];
  g.state.terrain.fill(0);
  g.rebuildBlocked();
  return g;
}
function openSite(g: Game, kind: keyof typeof BUILDING) {
  const tc = g.state.buildings.find(
    (b) => b.team === 0 && b.kind === "townCenter",
  )!;
  for (let y = tc.y - 7; y < tc.y + 12; y++)
    for (let x = tc.x - 7; x < tc.x + 12; x++)
      if (g.canPlace(kind, x, y, 0)) return { x, y };
  throw new Error("No open site");
}

describe("economy and construction", () => {
  it("collects, carries, and delivers resources, then retargets depleted deposits", () => {
    const g = empty();
    const u = g.addUnit("villager", 0, 10.5, 14.5);
    const n = {
      id: g.state.nextId++,
      type: "resource" as const,
      kind: "berries" as const,
      x: 10.5,
      y: 17.5,
      amount: 6,
    };
    g.state.nodes.push(n, { ...n, id: g.state.nextId++, x: 9.5, amount: 100 });
    g.rebuildBlocked();
    g.reveal();
    const before = g.player.resources.food;
    g.command([u.id], { kind: "gather", target: n.id, x: n.x, y: n.y });
    tick(g, 65);
    expect(g.player.resources.food).toBeGreaterThan(before);
    expect(g.player.stats.gathered).toBeGreaterThan(6);
    expect(g.find(n.id)).toBeUndefined();
    expect(u.order.kind).toBe("gather");
    expect(u.order.target).not.toBe(n.id);
  });
  it("charges once, rejects occupied/unexplored ground, and completes a villager-built house", () => {
    const g = quiet();
    const vill = g.state.units.find(
      (u) => u.team === 0 && u.kind === "villager",
    )!;
    const p = openSite(g, "house"),
      before = g.player.resources.wood;
    expect(g.canPlace("house", 12, 12, 0)).toBe(false);
    expect(g.canPlace("house", 40, 40, 0)).toBe(false);
    expect(g.place("house", p.x, p.y, 0, [vill.id])).toBe(true);
    expect(g.place("house", p.x, p.y, 0, [vill.id])).toBe(false);
    expect(g.player.resources.wood).toBe(before - 35);
    tick(g, 80);
    const house = g.state.buildings.find((b) => b.x === p.x && b.y === p.y)!;
    expect(house.progress).toBe(1);
    expect(g.capacity(0)).toBe(20);
    expect(g.state.objectives & 2).toBe(2);
  });
  it("refuses construction without a villager or affordable resources", () => {
    const g = quiet(),
      p = openSite(g, "house");
    expect(g.place("house", p.x, p.y, 0, [])).toBe(false);
    g.player.resources.wood = 0;
    expect(g.place("house", p.x, p.y, 0, [g.state.units[0].id])).toBe(false);
  });
  it("farms provide renewable food without consuming the building", () => {
    const g = empty();
    const farm = g.addBuilding("farm", 0, 7, 13);
    const v = g.addUnit("villager", 0, 10.5, 14);
    g.rebuildBlocked();
    g.command([v.id], { kind: "gather", target: farm.id, ...center(farm) });
    tick(g, 90);
    expect(g.player.stats.gathered).toBeGreaterThan(40);
    expect(g.find(farm.id)).toBe(farm);
    expect(farm.hp).toBe(farm.maxHp);
  });
});

describe("resource routing regressions", () => {
  it("does not convert carried food into wood when changing jobs", () => {
    const g = empty(),
      u = g.addUnit("villager", 0, 10.5, 17.5);
    u.carry = 8;
    u.cargo = "food";
    const n = {
      id: g.state.nextId++,
      type: "resource" as const,
      kind: "tree" as const,
      x: 10.5,
      y: 19.5,
      amount: 200,
    };
    g.state.nodes.push(n);
    g.rebuildBlocked();
    g.reveal();
    const food = g.player.resources.food;
    g.command([u.id], { kind: "gather", target: n.id, x: n.x, y: n.y });
    expect(u.returning).toBe(true);
    tick(g, 35);
    expect(g.player.resources.food).toBe(food + 8);
    expect(g.player.resources.wood).toBeGreaterThan(400);
  });
  it("retargets a resource in an unreachable pocket to a reachable deposit", () => {
    const g = empty(),
      u = g.addUnit("villager", 0, 10.5, 17.5);
    const trapped = {
        id: g.state.nextId++,
        type: "resource" as const,
        kind: "gold" as const,
        x: 8.5,
        y: 20.5,
        amount: 500,
      },
      open = { ...trapped, id: g.state.nextId++, x: 12.5, y: 20.5 };
    g.state.nodes.push(trapped, open);
    for (let y = 18; y <= 22; y++)
      for (let x = 6; x <= 10; x++)
        if (y === 18 || y === 22 || x === 6 || x === 10)
          g.state.terrain[y * SIZE + x] = 3;
    g.rebuildBlocked();
    g.reveal();
    const before = g.player.resources.gold;
    g.command([u.id], {
      kind: "gather",
      target: trapped.id,
      x: trapped.x,
      y: trapped.y,
    });
    tick(g, 65);
    expect(g.player.resources.gold).toBeGreaterThan(before);
    expect(u.order.target).toBe(open.id);
  });
  it("a commanded army can destroy an enemy Town Center through combat", () => {
    const g = empty();
    const enemy = g.state.buildings.find(
      (b) => b.team === 1 && b.kind === "townCenter",
    )!;
    enemy.hp = 80;
    g.player.explored.fill(1);
    const army = Array.from({ length: 8 }, (_, i) =>
      g.addUnit("cavalry", 0, enemy.x - 1, enemy.y + i * 0.4),
    );
    g.command(
      army.map((u) => u.id),
      { kind: "attack", target: enemy.id, ...center(enemy) },
    );
    tick(g, 20);
    expect(g.state.winner).toBe(0);
  });
});

describe("production and progression", () => {
  it("reserves population for queues, blocks overflow, and refunds cancellation", () => {
    const g = quiet();
    funded(g);
    const tc = g.state.buildings.find(
      (b) => b.team === 0 && b.kind === "townCenter",
    )!;
    for (let n = 0; n < 5; n++)
      expect(g.queue(tc.id, "villager", 0)).toBe(true);
    expect(g.queue(tc.id, "villager", 0)).toBe(false);
    const before = g.player.resources.food;
    g.cancelQueue(tc.id, 2);
    expect(g.player.resources.food).toBe(before + 50);
    expect(g.reserved(0)).toBe(11);
    tick(g, 80);
    expect(g.population(0)).toBe(11);
    for (let n = 0; n < 4; n++)
      expect(g.queue(tc.id, "villager", 0)).toBe(true);
    expect(g.queue(tc.id, "villager", 0)).toBe(false);
    expect(g.capacity(0)).toBe(15);
  });
  it("requires Castle Age for cavalry and applies upgrades to existing and future units", () => {
    const g = empty();
    funded(g);
    const tc = g.state.buildings.find(
        (b) => b.team === 0 && b.kind === "townCenter",
      )!,
      stable = g.addBuilding("stable", 0, 20, 20);
    const u = g.addUnit("spearman", 0, 10, 10);
    g.rebuildBlocked();
    expect(g.queue(stable.id, "cavalry", 0)).toBe(false);
    expect(g.queue(tc.id, "upgrade", 0)).toBe(false);
    expect(g.queue(tc.id, "advance", 0)).toBe(true);
    expect(g.queue(tc.id, "advance", 0)).toBe(false);
    tick(g, 101);
    expect(g.player.age).toBe(2);
    expect(g.queue(stable.id, "cavalry", 0)).toBe(true);
    expect(g.queue(tc.id, "upgrade", 0)).toBe(true);
    tick(g, 52);
    expect(g.player.upgraded).toBe(true);
    expect(u.maxHp).toBe(90);
    expect(g.state.units.find((u) => u.kind === "cavalry")?.maxHp).toBe(174);
  });
  it("caps combined villagers and soldiers at sixty even with excess housing", () => {
    const g = quiet();
    for (let i = 0; i < 20; i++) g.addBuilding("house", 0, 30, 30);
    expect(g.capacity(0)).toBe(60);
  });
});

describe("navigation and combat", () => {
  it("routes around building footprints without cutting blocked corners", () => {
    const g = empty();
    const from = { x: 10.5, y: 14.5 },
      to = { x: 22.5, y: 14.5 };
    const path = g.pathfind(from, to);
    expect(path.length).toBeGreaterThan(12);
    let last = from;
    for (const p of path) {
      expect(g.walkable(p.x, p.y)).toBe(true);
      const dx = Math.sign(p.x - last.x),
        dy = Math.sign(p.y - last.y);
      if (dx && dy) {
        expect(g.walkable(last.x + dx, last.y)).toBe(true);
        expect(g.walkable(last.x, last.y + dy)).toBe(true);
      }
      last = p;
    }
    expect(distance(path.at(-1)!, to)).toBeLessThan(0.1);
  });
  it("settles unreachable move orders instead of working forever", () => {
    const g = empty();
    const u = g.addUnit("spearman", 0, 6.5, 6.5);
    for (let y = 5; y <= 7; y++)
      for (let x = 5; x <= 7; x++)
        if (x !== 6 || y !== 6) g.state.terrain[y * SIZE + x] = 3;
    g.rebuildBlocked();
    g.command([u.id], { kind: "move", x: 40, y: 40 });
    tick(g, 6);
    expect(u.order.kind).toBe("idle");
    expect(u.x).toBe(6.5);
  });
  it("moves groups without placing destinations on top of one another", () => {
    const g = empty();
    const units = Array.from({ length: 8 }, (_, i) =>
      g.addUnit("spearman", 0, 7 + i * 0.5, 8),
    );
    g.command(
      units.map((u) => u.id),
      { kind: "move", x: 30, y: 30 },
    );
    expect(new Set(units.map((u) => `${u.order.x},${u.order.y}`)).size).toBe(8);
    tick(g, 30);
    expect(units.every((u) => distance(u, { x: 30, y: 30 }) < 3)).toBe(true);
  });
  it("implements the three unit counters and applies building resistance to arrows", () => {
    expect(damage("spearman", "cavalry")).toBeGreaterThan(
      damage("spearman", "archer") * 2,
    );
    expect(damage("archer", "spearman")).toBeGreaterThan(
      damage("archer", "cavalry"),
    );
    expect(damage("cavalry", "archer")).toBeGreaterThan(
      damage("cavalry", "spearman"),
    );
    expect(damage("archer", "townCenter")).toBeLessThan(
      damage("archer", "cavalry"),
    );
  });
  it.each([0, 1] as const)(
    "ends the match when team %s loses its Town Center",
    (team) => {
      const g = quiet();
      g.state.buildings.find(
        (b) => b.team === team && b.kind === "townCenter",
      )!.hp = 0;
      tick(g, 0.1);
      expect(g.state.winner).toBe(team === 0 ? 1 : 0);
      const time = g.state.time;
      tick(g, 5);
      expect(g.state.time).toBe(time);
    },
  );
  it("permanently reveals exploration as units travel", () => {
    const g = empty(),
      u = g.addUnit("spearman", 0, 35.5, 35.5),
      before = g.player.explored.filter(Boolean).length;
    g.reveal();
    expect(g.player.explored[35 * SIZE + 35]).toBe(1);
    g.command([u.id], { kind: "move", x: 45.5, y: 45.5 });
    tick(g, 20);
    expect(g.player.explored.filter(Boolean).length).toBeGreaterThan(before);
    expect(g.player.explored[35 * SIZE + 35]).toBe(1);
    expect(g.player.explored[45 * SIZE + 45]).toBe(1);
  });
});

describe("persistence and long-running simulation", () => {
  it("restores active jobs, queues, resources, and seeded future behavior", () => {
    const g = new Game();
    const v = g.state.units[0],
      n = g.state.nodes.find((n) => n.kind === "berries" && g.known(0, n))!;
    g.command([v.id], { kind: "gather", target: n.id, x: n.x, y: n.y });
    const tc = g.state.buildings.find(
      (b) => b.team === 0 && b.kind === "townCenter",
    )!;
    g.queue(tc.id, "villager", 0);
    tick(g, 18);
    const restored = Game.restore(g.serialize());
    expect(restored.serialize()).toBe(g.serialize());
    tick(g, 100);
    tick(restored, 100);
    expect(restored.serialize()).toBe(g.serialize());
  });
  it("rejects incompatible, malformed, and nonfinite saves", () => {
    const g = new Game();
    expect(() => Game.restore("not json")).toThrow();
    const s = JSON.parse(g.serialize());
    s.version = 999;
    expect(() => Game.restore(JSON.stringify(s))).toThrow();
    s.version = 1;
    s.players[0].resources.food = -20;
    expect(() => Game.restore(JSON.stringify(s))).toThrow();
    s.players[0].resources.food = 0;
    s.units[0].x = null;
    expect(() => Game.restore(JSON.stringify(s))).toThrow();
  });
  it("runs a seeded 30-minute defended match with AI growth, progression, and raids", () => {
    const g = new Game();
    const tc = g.state.buildings.find(
      (b) => b.team === 0 && b.kind === "townCenter",
    )!;
    let aiMaxPop = 0,
      aiAge = 1;
    for (let i = 0; i < 18000 && g.state.winner === null; i++) {
      tc.hp = tc.maxHp;
      g.update(0.1);
      aiMaxPop = Math.max(aiMaxPop, g.population(1));
      aiAge = Math.max(aiAge, g.state.players[1].age);
    }
    console.log("AI soak:", {
      minutes: Math.round(g.state.time / 60),
      population: aiMaxPop,
      age: aiAge,
      raids: g.state.ai.raids,
      resources: g.state.players[1].resources,
      buildings: g.state.buildings
        .filter((b) => b.team === 1)
        .map((b) => b.kind),
    });
    expect(g.state.time).toBeGreaterThan(1799);
    expect(aiMaxPop).toBeGreaterThan(20);
    expect(aiAge).toBe(2);
    expect(g.state.ai.raids).toBeGreaterThanOrEqual(3);
    expect(g.state.players[1].stats.gathered).toBeGreaterThan(1500);
    for (const p of g.state.players)
      for (const value of Object.values(p.resources))
        expect(value).toBeGreaterThanOrEqual(0);
    for (const u of g.state.units) {
      expect(
        Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp),
      ).toBe(true);
      expect(u.x >= 0 && u.x < SIZE && u.y >= 0 && u.y < SIZE).toBe(true);
    }
  }, 30000);
  it("runs a population-cap stress workload without exceeding the simulation budget", () => {
    const g = empty();
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < 60; i++)
        g.addUnit(
          (["spearman", "archer", "cavalry"] as UnitKind[])[i % 3],
          team as 0 | 1,
          28 + (i % 10) * 0.7 + team * 7,
          28 + Math.floor(i / 10) * 0.7 + team * 7,
        );
      g.state.players[team].explored.fill(1);
    }
    const begin = performance.now();
    tick(g, 30);
    const elapsed = performance.now() - begin;
    console.log(
      `120-unit simulation: ${elapsed.toFixed(0)}ms for 30 simulated seconds`,
    );
    expect(elapsed).toBeLessThan(10000);
  }, 15000);
});
