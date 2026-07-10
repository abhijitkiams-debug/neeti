import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored pdf.js worker build — not our code, not worth linting.
    "public/pdf-worker/**",
  ]),
  {
    rules: {
      // This React-Compiler-readiness rule flags the standard "fetch on
      // mount" data-loading pattern (useEffect + setState) used throughout
      // this app's admin pages. It's a perf/style nitpick, not a
      // correctness issue, and the app is unaffected — downgrading rather
      // than rewriting every page onto a data-fetching library.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
