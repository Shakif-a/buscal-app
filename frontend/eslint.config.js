import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: [
      "dist",
      "node_modules",
      "cypress/downloads",
      "cypress/screenshots",
      "cypress/videos",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-empty-pattern": "warn",
      "no-undef": "warn",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^[A-Z_]",
        },
      ],
      "no-useless-catch": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["cypress/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.mocha,
        cy: "readonly",
        Cypress: "readonly",
        expect: "readonly",
      },
    },
  },
  {
    files: [
      "src/okrTracker/features/objectives/evidenceFiles.js",
      "src/okrTracker/features/objectives/keyResultService.js",
      "src/okrTracker/pages/objectives/ObjectiveCard.jsx",
      "cypress/e2e/okr.cy.js",
      "cypress/fixtures/okr.jsx",
      "test/evidenceFiles.test.js",
      "test/okrPermissionServices.test.js",
    ],
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^[A-Z_]",
        },
      ],
    },
  },
];
