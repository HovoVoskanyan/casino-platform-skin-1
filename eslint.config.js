import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src/routeTree.gen.ts", "src/api/schema.d.ts", "design"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // House rule: no hand-written fetch — everything goes through the generated client.
      "no-restricted-globals": ["error", { name: "fetch", message: "Use the generated API client (src/api/client.ts)." }],
      "no-restricted-imports": ["error", { paths: [{ name: "axios", message: "Use the generated API client." }] }],
    },
  },
  {
    files: ["src/features/**", "src/routes/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["src/api/**", "src/test/**", "scripts/**"],
    rules: { "no-restricted-globals": "off" },
  },
);
