import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // jsx-a11y plugin is registered by eslint-config-next (for these files); enable its strict rule set.
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-warning-comments": ["error", { terms: ["todo", "fixme"], location: "anywhere" }],
    },
  },
  {
    files: ["scripts/**", "tests/**"],
    rules: { "no-console": "off" },
  },
  {
    // The playtest kit is plain Node (CommonJS) so players' scripts can require() it.
    files: ["tests/playtest/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".lighthouseci/**",
    "next-env.d.ts",
    "public/sw.js",
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
