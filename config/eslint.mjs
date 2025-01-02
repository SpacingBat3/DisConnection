// @ts-check
import js  from "@eslint/js";
import ts  from "typescript-eslint";
import ix  from "eslint-plugin-import-x";
import pth from "node:path";

export default ts.config({
  extends: [
    js.configs.recommended,
    ts.configs.strictTypeChecked,
    ix.flatConfigs.recommended,
    ix.flatConfigs.typescript
  ],
  ignores: ["**/*.d.ts", "**/*.*js" ],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: pth.resolve(import.meta.dirname,".."),
    },
  },
  rules: {
    "no-empty": [ "error", { allowEmptyCatch: true } ],
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }]
  }
});