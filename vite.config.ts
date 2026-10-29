import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "version-offline-cache",
      writeBundle(options, bundle) {
        const version = createHash("sha256")
          .update(
            Object.values(bundle)
              .map((asset) =>
                asset.type === "chunk" ? asset.code : String(asset.source),
              )
              .join(""),
          )
          .update(readFileSync(resolve("public/art/villager-blue.png")))
          .update(readFileSync(resolve("public/art/villager-red.png")))
          .digest("hex")
          .slice(0, 12);
        const path = resolve(options.dir ?? "dist", "sw.js");
        writeFileSync(
          path,
          readFileSync(path, "utf8").replace(
            "crownfall-v1",
            `crownfall-${version}`,
          ),
        );
      },
    },
  ],
});
