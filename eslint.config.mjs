import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
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
    },
  },
];

export default eslintConfig;
