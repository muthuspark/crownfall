import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { villagerPose } from "./villager";

function setup() {
  const game = new Game();
  const unit = game.state.units.find((u) => u.kind === "villager")!;
  const tree = game.state.nodes.find((n) => n.kind === "tree")!;
  return { game, unit, tree };
}

describe("villager animation", () => {
  it("faces all eight screen directions using the isometric projection", () => {
    const { unit } = setup();
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction * Math.PI / 4;
      const sx = Math.cos(angle), sy = Math.sin(angle) * 2;
      unit.path = [{ x: unit.x + (sx + sy) / 2, y: unit.y + (sy - sx) / 2 }];
      expect(villagerPose(unit, undefined, 1).direction).toBe(direction);
    }
  });
  it("switches from walking to working to carrying without changing simulation state", () => {
    const { unit, tree } = setup();
    unit.order = { kind: "gather", x: tree.x, y: tree.y, target: tree.id };
    unit.path = [{ x: tree.x, y: tree.y }];
    expect(villagerPose(unit, tree, 1).action).toBe("walk");
    unit.path = [];
    expect(villagerPose(unit, tree, 1).action).toBe("chop");
    unit.carry = 12;
    unit.returning = true;
    unit.path = [{ x: unit.x + 2, y: unit.y }];
    expect(villagerPose(unit, tree, 1).action).toBe("carry");
    unit.path = [];
    expect(villagerPose(unit, tree, 1).action).toBe("carry");
  });
  it("uses the right tools and preserves idle facing and reduced motion", () => {
    const { game, unit } = setup();
    const gold = game.state.nodes.find((n) => n.kind === "gold")!;
    unit.path = [];
    unit.order = { kind: "gather", x: gold.x, y: gold.y, target: gold.id };
    expect(villagerPose(unit, gold, 1).action).toBe("mine");
    unit.order.kind = "build";
    expect(villagerPose(unit, gold, 1, 3, true).frame).toBe(0);
    expect(villagerPose(unit, gold, 1).action).toBe("build");
    unit.order.kind = "idle";
    expect(villagerPose(unit, undefined, 1, 6).direction).toBe(6);
    expect(villagerPose(unit, undefined, 1, 6, true).frame).toBe(0);
    expect(villagerPose(unit, undefined, 1)).toEqual(villagerPose(unit, undefined, 1));
  });
});
