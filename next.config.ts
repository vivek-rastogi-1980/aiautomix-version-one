import type { NextConfig } from "next";

/**
 * Baseline security headers, applied to every response.
 *
 * These were absent entirely, which left the app relying on browser defaults for
 * transport security, framing and referrer leakage. All six are transport- or
 * policy-level and change nothing about how a page renders.
 *
 * Deliberately NOT set here: `Content-Security-Policy`. The migrated Sprint 1
 * marketing pages carry hand-tuned inline styles, inline `<style>` blocks and
 * inline JSON-LD `<script>` tags for pixel fidelity (MIGRATION-NOTES.md), so any
 * CSP strict enough to be worth having would break them, and one loose enough to
 * pass (`unsafe-inline` on both scripts and styles) buys almost nothing. Landing
 * a real CSP means nonce-ing those inline blocks first — tracked as follow-up
 * work rather than smuggled into a sprint whose rule is "never change UI".
 */
const SECURITY_HEADERS = [
  // Force HTTPS for two years, including subdomains. Only takes effect over
  // HTTPS, so local http://localhost development is unaffected.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Stop the browser second-guessing Content-Type. Also limits what a
  // mislabelled file in a public storage bucket can be coerced into becoming.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: nothing here is designed to be embedded by a third party.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Send the full URL only to our own origin; cross-origin gets the bare origin,
  // so dashboard paths and record ids never leak in a Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No feature in this app needs these; deny them by default.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "d8j0ntlcm91z4.cloudfront.net" },
      { protocol: "https", hostname: "staging.aiautomix.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
