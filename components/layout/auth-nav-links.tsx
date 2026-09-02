"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signOutAction } from "@/features/auth/actions";

/**
 * Log in / Dashboard + Log out, for the marketing site header.
 *
 * ---------------------------------------------------------------------------
 * Why the state comes from a tiny endpoint
 * ---------------------------------------------------------------------------
 * Two other designs were tried and rejected, and the reasons are worth keeping:
 *
 *   READ THE SESSION IN THE ROOT LAYOUT. Correct, but it makes every marketing
 *   page dynamic — a cookie read turns the whole statically-rendered public
 *   site into per-request server renders, for two links in a header.
 *
 *   USE THE SUPABASE BROWSER CLIENT. Keeps the pages static, but pulls
 *   `@supabase/ssr` into the shared bundle for every public page. Measured at
 *   roughly +68 kB of JavaScript on pages whose whole job is to load fast for a
 *   stranger.
 *
 * `GET /api/auth/status` returns one boolean and nothing else. The pages stay
 * static, the bundle stays small, and the header settles a moment after
 * hydration.
 *
 * ---------------------------------------------------------------------------
 * The placeholder is deliberate
 * ---------------------------------------------------------------------------
 * Until the answer arrives this renders an empty box of roughly the right
 * width rather than guessing. Rendering "Log in" optimistically would show
 * every signed-in visitor the wrong link for a beat, and a header that changes
 * under the cursor is worse than one that arrives slightly late.
 */

const linkStyle: React.CSSProperties = {
  padding: "11px 18px",
  borderRadius: "100px",
  color: "#F4F1EA",
  fontSize: "13px",
  fontWeight: 600,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const buttonStyle: React.CSSProperties = {
  ...linkStyle,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

export function AuthNavLinks() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/status", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { signedIn: false }))
      .then((data: { signedIn?: boolean }) => {
        setSignedIn(data.signedIn === true);
      })
      // A header that cannot reach the server shows the signed-out view. It is
      // the safe wrong answer: it offers a way in rather than a broken way out.
      .catch(() => {
        if (!controller.signal.aborted) setSignedIn(false);
      });

    return () => controller.abort();
  }, [router]);

  if (signedIn === null) {
    // Reserve the space so the header does not jump once the answer arrives.
    return (
      <span
        aria-hidden="true"
        className="site-nav-auth-placeholder"
        style={{ display: "inline-block", width: "72px" }}
      />
    );
  }

  if (!signedIn) {
    return (
      <Link href="/login" className="site-nav-pill" style={linkStyle}>
        Log in
      </Link>
    );
  }

  return (
    <>
      <Link href="/dashboard" className="site-nav-pill" style={linkStyle}>
        Dashboard
      </Link>
      {/*
        The existing Server Action, reused rather than reimplemented. It clears
        the session server-side and redirects — so the cookies the server reads
        and the links this header shows cannot disagree afterwards.
      */}
      <form action={signOutAction} style={{ display: "contents" }}>
        <button type="submit" className="site-nav-pill" style={buttonStyle}>
          Log out
        </button>
      </form>
    </>
  );
}
