"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Branded runtime error boundary (P0-4).
 *
 * Must be a Client Component — that is Next's contract for `error.tsx`, since
 * it receives the `reset` callback.
 *
 * `error.digest` is deliberately the only thing surfaced: Next replaces the real
 * message with an opaque digest in production precisely so stack traces and
 * internal details do not reach the browser. Showing the digest gives a user
 * something to quote in a support request without leaking anything.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaches Vercel's function logs. Replace with a reporting service when one
    // exists — this is the single place that would need to change.
    console.error("[app] unhandled error", error);
  }, [error]);

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
          fontSize: "13px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#8A87A0",
          fontWeight: 600,
          marginBottom: "18px",
        }}
      >
        {"Something went wrong"}
      </div>

      <h1
        style={{
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontWeight: 800,
          fontSize: "clamp(26px,3.6vw,42px)",
          letterSpacing: "-0.02em",
          margin: "0 0 14px",
          maxWidth: "560px",
        }}
      >
        {"That didn't load as expected"}
      </h1>

      <p
        style={{
          fontSize: "16.5px",
          lineHeight: 1.6,
          color: "#B9B5C9",
          maxWidth: "460px",
          margin: "0 0 32px",
        }}
      >
        {
          "The issue has been logged. Trying again usually works — if it doesn't, get in touch and we'll sort it out."
        }
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "12px 26px",
            borderRadius: "100px",
            border: "none",
            background: "linear-gradient(135deg, #7C5CFF 0%, #F0219E 100%)",
            color: "#FFFFFF",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {"Try again"}
        </button>
        <Link
          href="/"
          style={{
            padding: "12px 26px",
            borderRadius: "100px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            color: "#F4F3F7",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {"Back to home"}
        </Link>
        <Link
          href="/contact"
          style={{
            padding: "12px 26px",
            borderRadius: "100px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            color: "#F4F3F7",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {"Contact us"}
        </Link>
      </div>

      {error.digest ? (
        <p style={{ fontSize: "12.5px", color: "#4A4858", marginTop: "34px" }}>
          {`Reference: ${error.digest}`}
        </p>
      ) : null}
    </main>
  );
}
