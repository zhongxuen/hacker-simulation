import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Plain Node, no jsdom: the simulation engine must run headless.
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
  },
});
