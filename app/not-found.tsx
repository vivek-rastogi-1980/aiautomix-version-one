import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Page not found | AIAutoMix" },
  // A 404 must never be indexed, and Next does not add this for you.
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/ai-agents", label: "AI Agents" },
  { href: "/news", label: "News" },
  { href: "/contact", label: "Contact" },
];

/**
 * Branded 404 (P0-4).
 *
 * Previously this was Next's unstyled default: white page, no brand, no
 * navigation, no way back in. A dead end on a marketing site loses the visit
 * outright, so this offers the routes someone is most likely to have been
 * looking for.
 *
 * Deliberately a Server Component with no client JavaScript — an error page
 * should render even when something else on the site is broken.
 */
export default function NotFound() {
  return (
    <main
      style={{
        background: "#0A0B0F",
        color: "#F4F3F7",
        fontFamily: "'Inter',sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontWeight: 800,
          fontSize: "clamp(64px,12vw,140px)",
          lineHeight: 1,
          letterSpacing: "-0.04em",
          background: "linear-gradient(135deg, #7C5CFF 0%, #F0219E 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {"404"}
      </div>

      <h1
        style={{
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontWeight: 800,
          fontSize: "clamp(24px,3.4vw,38px)",
          letterSpacing: "-0.02em",
          margin: "18px 0 14px",
        }}
      >
        {"We couldn't find that page"}
      </h1>

      <p
        style={{
          fontSize: "16.5px",
          lineHeight: 1.6,
          color: "#B9B5C9",
          maxWidth: "460px",
          margin: "0 0 36px",
        }}
      >
        {
          "The link may be out of date, or the page may have moved. Here's where most people go next."
        }
      </p>

      <nav
        aria-label="Helpful links"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          justifyContent: "center",
        }}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: "11px 22px",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              color: "#F4F3F7",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
