import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // jsx-a11y plugin is registered by eslint-config-next; enable its strict rule set.
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
