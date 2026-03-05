import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Transitional release baseline: keep runtime lint noise low while legacy debt is retired in follow-up work.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "agent-sdk/**",
    "agent-sdk/dist/**",
    "artifacts/**",
    "database/**",
    "out/**",
    "build/**",
    "cache/**",
    "deployments/**",
    "packages/**",
    "scripts/**",
    "test/**",
    "check-*.js",
    "next-env.d.ts",
    "typechain-types/**",
  ]),
]);

export default eslintConfig;
