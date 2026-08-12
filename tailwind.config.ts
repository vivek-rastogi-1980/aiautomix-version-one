import type { Config } from "tailwindcss";

/**
 * Brand tokens mirror the existing AIAutomix palette (UI-DESIGN-SYSTEM.md).
 * Migrated pages keep their original hand-tuned styles for pixel fidelity;
 * new Sprint 2+ UI should consume these tokens.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /*
         * Semantic tokens resolve through CSS variables so a single
         * `data-theme` attribute can flip the dashboard and admin panel to
         * light. The variables' `:root` values are the original dark hexes, so
         * anything that does not opt in renders exactly as before.
         *
         * Solid colours use the `<alpha-value>` form so existing opacity
         * modifiers (`bg-ink/75` on the sticky headers) keep working. The
         * `line-*` and `fill-*` scales bake their own alpha and are not meant
         * to take a modifier.
         */
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        "muted-strong": "rgb(var(--muted-strong-rgb) / <alpha-value>)",

        /* Hairlines: `border-line`, `divide-line`. */
        line: "var(--line)",
        "line-strong": "var(--line-strong)",

        /* Surface fills, lightest to heaviest. Replaces `white/[0.0x]`. */
        "fill-1": "var(--fill-1)",
        "fill-2": "var(--fill-2)",
        "fill-3": "var(--fill-3)",
        "fill-4": "var(--fill-4)",
        "fill-5": "var(--fill-5)",
        "fill-6": "var(--fill-6)",

        /* Readable link colour in both themes — see globals.css. */
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",

        "danger-text": "var(--danger-text)",
        "danger-border": "var(--danger-border)",
        "danger-fill": "var(--danger-fill)",

        "brand-cyan": "#57C7FF",
        "brand-violet": "#7C5CFF",
        "brand-magenta": "#C86CFF",
        "brand-green": "#57F2A4",
        "accent-lime": "#E9F2C6",
        "accent-dark": "#181A0E",
        danger: "#FF6B6B",
        "danger-soft": "#FF8A8A",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(90deg, #57C7FF 0%, #7C5CFF 60%, #C86CFF 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
