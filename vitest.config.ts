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
      // Logic is unit-tested here. React hooks and thin Supabase/browser I/O wrappers are covered by
      // the E2E suite on 6 devices instead (DECISIONS 2026-11-03).
      exclude: [
        "lib/supabase/**",
        "lib/store/**",
        "**/*.d.ts",
        "lib/**/use*.ts",
        "lib/db/**",
        "lib/sound/**",
        "lib/i18n/**",
        "lib/today/loadContext.ts",
        "lib/export/buildExport.ts",
      ],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        "lib/engine/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
        "lib/game/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
});
