import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    // Build output and dependencies are not source. Without this, invoking
    // ESLint directly (`npx eslint .`) lints the compiled bundles in `.next/`
    // and reports ~1,850 phantom problems from generated code. `next lint`
    // ignored these implicitly, but it is deprecated and removed in Next 16,
    // so the ignores have to live in the config for the direct invocation
    // that replaces it.
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    // The migrated animation-controller views carry blanket eslint-disable
    // directives by design (faithful re-host of the original imperative code);
    // some controllers don't trip every disabled rule, so don't flag those
    // intentional directives as "unused". See MIGRATION-NOTES.md.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // Migrated marketing pages intentionally keep the original <img> tags and
      // hand-tuned inline styles for pixel fidelity (see MIGRATION-NOTES.md).
      "@next/next/no-img-element": "off",

      // A leading underscore is this codebase's marker for "required by the
      // signature, deliberately unused" — Server Action `(_prev, _formData)`
      // params that `useActionState` supplies, and destructuring-to-omit in the
      // smoke tests. Encoding the convention in the rule keeps the intent
      // visible at the call site instead of scattering disable comments.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // `features/ai/pdf` builds @react-pdf/renderer documents. Its `Image` is a
    // PDF drawing primitive that never reaches the DOM and has no `alt` in its
    // API, so the HTML-oriented alt-text rule cannot apply here.
    files: ["features/ai/pdf/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
];

export default eslintConfig;
