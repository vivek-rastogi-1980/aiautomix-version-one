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
        ink: "#0A0B0F",
        surface: "#111219",
        foreground: "#F4F3F7",
        muted: "#8A87A0",
        "muted-strong": "#6E6C7C",
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
