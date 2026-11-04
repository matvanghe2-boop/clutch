import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Les captures sont datées du 4 novembre 2026 : les dates sans année se lisent par rapport à ce jour.
    env: { TZ: "UTC" },
  },
});
