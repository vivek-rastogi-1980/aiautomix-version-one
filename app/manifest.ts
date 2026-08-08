import type { MetadataRoute } from "next";

/**
 * Web app manifest (SPRINT-06 S06-05).
 *
 * Lighthouse's Best Practices and PWA checks look for one, and without it a
 * visitor who adds the site to a phone home screen gets the raw URL as a label
 * and a screenshot as an icon.
 *
 * `display: "browser"` rather than `"standalone"` is deliberate. This is a
 * marketing site plus an authenticated dashboard, not an app that benefits from
 * hiding browser chrome — and standalone mode removes the back button and
 * address bar, which on an auth-gated site makes it harder to tell you are on
 * the real domain.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIAutoMix — AI Automation & Business Intelligence",
    short_name: "AIAutoMix",
    description:
      "Validate, build, automate and scale your business with AI automation, AI agents, CRM, voice AI and business intelligence.",
    start_url: "/",
    display: "browser",
    background_color: "#0A0B0F",
    theme_color: "#0A0B0F",
    lang: "en",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/assets/logo-ice2.png",
        sizes: "890x827",
        type: "image/png",
      },
    ],
  };
}
