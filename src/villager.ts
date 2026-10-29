import { center, type Entity, type Unit } from "./game";

export const VILLAGER_ACTIONS = [
  "idle", "walk", "chop", "mine", "carry", "build", "gather",
] as const;
export type VillagerAction = (typeof VILLAGER_ACTIONS)[number];
export interface VillagerPose {
  action: VillagerAction;
  direction: number;
  frame: number;
}

/** Atlas directions run clockwise from screen-right in the 2:1 projection. */
export function villagerPose(
  u: Unit,
  target: Entity | undefined,
  seconds: number,
  lastDirection = 2,
  reducedMotion = false,
): VillagerPose {
  const moving = u.path.length > 0;
  const destination = moving ? u.path[0] : target ? center(target) : undefined;
  let direction = lastDirection;
  if (destination) {
    const dx = destination.x - u.x;
    const dy = destination.y - u.y;
    if (Math.hypot(dx, dy) > 0.01) {
      direction = (Math.round(Math.atan2((dx + dy) / 2, dx - dy) / (Math.PI / 4)) + 8) % 8;
    }
  }
  let action: VillagerAction = "idle";
  if (moving) action = u.carry > 0 ? "carry" : "walk";
  else if (u.order.kind === "gather" && target && !u.returning) {
    action = target.kind === "tree" ? "chop" : target.kind === "gold" ? "mine" : "gather";
  } else if (u.order.kind === "build" && target) action = "build";
  else if (u.order.kind === "attack" && target) action = "build";
  else if (u.carry > 0) action = "carry";
  const frozen = reducedMotion || (action === "carry" && !moving);
  const rate = action === "idle" ? 2 : action === "walk" || action === "carry" ? 10 : 8;
  const frame = frozen ? 0 : Math.floor(seconds * rate + u.id * 0.37) % 8;
  return { action, direction, frame };
}

/** Pre-rendered original Blender model; cached cells keep per-frame work small. */
export class VillagerSprites {
  private sheets = [new Image(), new Image()];
  private cells = new Map<string, HTMLCanvasElement>();

  constructor() {
    this.sheets.forEach((image, team) => {
      image.src = `${import.meta.env.BASE_URL}art/villager-${team === 0 ? "blue" : "red"}.png`;
    });
  }

  get(team: number, pose: VillagerPose): HTMLCanvasElement | undefined {
    const sheet = this.sheets[team];
    if (!sheet?.complete || !sheet.naturalWidth) return undefined;
    const key = `${team}/${pose.action}/${pose.direction}/${pose.frame}`;
    const cached = this.cells.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = 58;
    canvas.height = 62;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const row = VILLAGER_ACTIONS.indexOf(pose.action) * 8 + pose.frame;
    ctx.drawImage(sheet, pose.direction * 96, row * 96, 96, 96, 0, 0, 58, 62);
    this.cells.set(key, canvas);
    return canvas;
  }
}
