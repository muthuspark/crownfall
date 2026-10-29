import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

/** Exercise the actual worker with a host that varies static responses on Origin. */
function workerHarness() {
  const events: Record<string, (event: any) => void> = {};
  const files = new Map<string, Response>();
  const requested: string[] = [];
  const html =
    '<html><script src="./assets/game.js"></script><link href="./assets/game.css"><link href="./crown.svg"></html>';
  let online = true;
  const cache = {
    put: async (key: string, response: Response) => {
      files.set(new URL(key, "http://game.local").href, response);
    },
    addAll: async (urls: string[]) => {
      for (const url of urls) {
        requested.push(url);
        files.set(
          url,
          new Response("bundled asset", { headers: { Vary: "Origin" } }),
        );
      }
    },
    match: async (input: Request | string, options?: CacheQueryOptions) => {
      const key =
        typeof input === "string"
          ? new URL(input, "http://game.local").href
          : input.url;
      const response = files.get(key);
      if (response?.headers.has("Vary") && !options?.ignoreVary)
        return undefined;
      return response?.clone();
    },
  };
  runInNewContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      URL,
      Request,
      Response,
      self: {
        location: {
          href: "http://game.local/kingdom/sw.js",
          origin: "http://game.local",
        },
        addEventListener: (type: string, callback: (event: any) => void) =>
          (events[type] = callback),
        skipWaiting: async () => {},
        clients: { claim: async () => {} },
      },
      caches: {
        open: async () => cache,
        keys: async () => [],
        delete: async () => true,
      },
      fetch: async () => {
        if (!online) throw new TypeError("Network offline");
        return new Response(html);
      },
    },
  );
  async function install() {
    let waiting: Promise<void> | undefined;
    events.install({
      waitUntil: (promise: Promise<void>) => (waiting = promise),
    });
    await waiting;
  }
  async function request(path: string, mode: RequestMode = "cors") {
    let response: Promise<Response> | undefined;
    const request = new Request("http://game.local" + path);
    Object.defineProperty(request, "mode", { value: mode });
    events.fetch({
      request,
      respondWith: (promise: Promise<Response>) => (response = promise),
    });
    return response;
  }
  return { install, request, requested, goOffline: () => (online = false) };
}
describe("production offline cache", () => {
  it("preloads all same-origin shell assets relative to a hosted subdirectory", async () => {
    const worker = workerHarness();
    await worker.install();
    expect(worker.requested).toEqual([
      "http://game.local/kingdom/assets/game.js",
      "http://game.local/kingdom/assets/game.css",
      "http://game.local/kingdom/crown.svg",
      "http://game.local/kingdom/art/villager-blue.png",
      "http://game.local/kingdom/art/villager-red.png",
    ]);
  });
  it("serves JS and CSS offline even when the static host adds Vary: Origin", async () => {
    const worker = workerHarness();
    await worker.install();
    worker.goOffline();
    expect(
      await (await worker.request("/kingdom/assets/game.js"))?.text(),
    ).toBe("bundled asset");
    expect(
      await (await worker.request("/kingdom/assets/game.css"))?.text(),
    ).toBe("bundled asset");
  });
  it("falls back to the cached shell for an offline navigation", async () => {
    const worker = workerHarness();
    await worker.install();
    worker.goOffline();
    expect(
      await (await worker.request("/kingdom/", "navigate"))?.text(),
    ).toContain("./assets/game.js");
    expect(
      await (await worker.request("/kingdom/unavailable", "navigate"))?.text(),
    ).toContain("./assets/game.js");
  });
  it("serves both villager sheets offline before they have been displayed", async () => {
    const worker = workerHarness();
    await worker.install();
    worker.goOffline();
    for (const team of ["blue", "red"]) {
      expect(
        await (await worker.request(`/kingdom/art/villager-${team}.png`))?.text(),
      ).toBe("bundled asset");
    }
  });
});
