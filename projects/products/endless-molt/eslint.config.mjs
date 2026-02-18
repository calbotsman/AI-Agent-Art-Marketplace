import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "agent-sdk/dist/**",
    "artifacts/**",
    "out/**",
    "build/**",
    "cache/**",
    "deployments/**",
    "next-env.d.ts",
    "typechain-types/**",
  ]),
]);

export default eslintConfig;
