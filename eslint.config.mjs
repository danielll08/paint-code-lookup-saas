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
    // e2e harness output
    ".next-e2e/**",
    "e2e/.output/**",
    // vercel deployment artifacts
    ".vercel/**",
    // agent configurations & skills
    ".agents/**",
  ]),
]);

export default eslintConfig;
