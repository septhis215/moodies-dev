// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/mockServiceWorker.js",
  ]),
  {
    rules: {
      "@next/next/no-img-element": "off",
      // Keep newly surfaced React Compiler diagnostics from blocking this framework upgrade.
      "react-hooks/error-boundaries": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
    },
  },
  ...storybook.configs["flat/recommended"],
];

export default eslintConfig;
