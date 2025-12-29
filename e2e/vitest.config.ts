import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    root: "./e2e",
    include: ["**/*.test.ts"],
    testTimeout: 30000, // E2E tests can be slower
  },
});
