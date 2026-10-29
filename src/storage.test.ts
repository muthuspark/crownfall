import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMatch, saveMatch, deleteMatch } from "./storage";
import { Game } from "./game";
afterEach(() => vi.unstubAllGlobals());
describe("browser-local persistence", () => {
  it("keeps one resumable match, replacing the previous save atomically", async () => {
    await deleteMatch();
    expect(await loadMatch()).toBeUndefined();
    const game = new Game();
    await saveMatch(game.serialize());
    const first = await loadMatch();
    expect(first?.savedAt).toBeGreaterThan(0);
    expect(Game.restore(first!.raw).serialize()).toBe(game.serialize());
    game.update(0.1);
    await saveMatch(game.serialize());
    expect((await loadMatch())?.raw).toBe(game.serialize());
  });
  it("can remove the local match", async () => {
    await saveMatch(new Game().serialize());
    await deleteMatch();
    expect(await loadMatch()).toBeUndefined();
  });
  it("rejects unavailable or denied storage so the interface can keep gameplay available", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    });
    await expect(loadMatch()).rejects.toThrow("Storage is blocked");
    await expect(saveMatch("{}")).rejects.toThrow("Storage is blocked");
  });
});
