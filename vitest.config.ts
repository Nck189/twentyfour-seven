import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/integration/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "content/**/*.ts"],
      exclude: ["lib/supabase/**", "lib/store/**", "**/*.d.ts"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        "lib/engine/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
        "lib/game/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
});
