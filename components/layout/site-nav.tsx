"use client";

import { useState } from "react";
import Link from "next/link";

import { AuthNavLinks } from "@/components/layout/auth-nav-links";

const NAV_CSS = `
  @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
  @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
  .site-menu-link:hover { background: #E4E3FA; }
  /* ---------------------------------------------------------------------
     Responsive header.

     The bar is a single non-wrapping flex row, so at desktop sizing a
     signed-in visitor carries four pills — Dashboard, Log out, Let's Talk,
     MENU — plus a 52px logo and 128px of gutter. That totals roughly 600px
     and cannot fit a phone: the row overflows and the pills collide, which
     is the "logout layout" disorder.

     Desktop is left exactly as it was. Only these overrides run below the
     breakpoints, and they use !important because everything above is an
     inline style attribute, which a plain rule cannot outrank.
     --------------------------------------------------------------------- */
  @media (max-width: 900px) {
    .site-nav-bar { padding: 14px 20px !important; }
    .site-nav-actions { gap: 8px !important; }
    .site-nav-pill { padding: 9px 14px !important; font-size: 12px !important; }
  }
  @media (max-width: 560px) {
    /* "Let's Talk" points at /contact, which the MENU overlay already lists
       as Contact. Dropping the duplicate is what buys the remaining three
       pills room to sit on one line rather than stacking. */
    .site-nav-talk { display: none !important; }
    .site-nav-pill { padding: 8px 12px !important; font-size: 11.5px !important; }
    .site-nav-logo { width: 42px !important; height: 42px !important; }
    .site-nav-auth-placeholder { width: 58px !important; }
  }
  @media (max-width: 400px) {
    .site-nav-bar { padding: 12px 14px !important; }
    .site-nav-pill { padding: 7px 10px !important; font-size: 11px !important; }
  }
`;

/**
 * Sticky site header + full-screen menu overlay.
 *
 * Extracted 1:1 from the design pages (the markup below is byte-identical
 * across 19 of the 24 original pages) — do not restyle without a design brief.
 */
export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen((open) => !open);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NAV_CSS }} />
      <div
        className="site-nav-bar"
        style={{
          position: "sticky",
          top: "0",
          zIndex: "9500",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 64px",
          background: "rgba(10,11,15,0.75)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
          }}
        >
          <div
            className="site-nav-logo"
            style={{
              position: "relative",
              width: "52px",
              height: "52px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "visible",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-220px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "0",
                height: "0",
                borderLeft: "76px solid transparent",
                borderRight: "76px solid transparent",
                borderTop: "240px solid rgba(255,255,255,0.13)",
                filter: "blur(16px)",
                mixBlendMode: "screen",
                animation: "beamFlicker 3.2s ease-in-out infinite",
                pointerEvents: "none",
              }}
            ></div>
            <div
              style={{
                position: "absolute",
                top: "-220px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "0",
                height: "0",
                borderLeft: "14px solid transparent",
                borderRight: "14px solid transparent",
                borderTop: "230px solid rgba(255,255,255,0.6)",
                filter: "blur(2.5px)",
                mixBlendMode: "screen",
                animation: "beamFlicker 3.2s ease-in-out infinite 0.15s",
                pointerEvents: "none",
              }}
            ></div>
            <div
              style={{
                position: "absolute",
                top: "-62px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "96px",
                height: "90px",
                background:
                  "radial-gradient(ellipse 48px 90px at 50% 0%, rgba(255,255,255,0.4), transparent 72%)",
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            ></div>
            <img
              alt="AIAutomix"
              src="/assets/logo-ice2.png"
              style={{
                position: "relative",
                width: "52px",
                height: "52px",
                objectFit: "contain",
                zIndex: "2",
                filter:
                  "drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1)",
                animation: "navLogoFloat 4.5s ease-in-out infinite",
              }}
            />
          </div>
        </Link>
        <div
          className="site-nav-actions"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <AuthNavLinks />
          <Link
            href="/contact"
            className="site-nav-pill site-nav-talk"
            style={{
              padding: "11px 20px",
              borderRadius: "100px",
              background: "#181A0E",
              color: "#F4F1EA",
              fontSize: "13px",
              fontWeight: "600",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {"Let's Talk"}
          </Link>
          <div
            onClick={toggleMenu}
            className="site-nav-pill"
            style={{
              padding: "11px 22px",
              borderRadius: "100px",
              background: "#FFFFFF",
              color: "#181A0E",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {!menuOpen ? <>{"MENU"}</> : null}
            {menuOpen ? <>{"CLOSE"}</> : null}
          </div>
        </div>
      </div>
      {menuOpen ? (
        <div
          style={{
            position: "fixed",
            inset: "0",
            zIndex: "9400",
            background: "#E9F2C6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <Link
              href="/"
              className="site-menu-link"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(28px,4.2vw,48px)",
                color: "#181A0E",
                textDecoration: "none",
                padding: "6px 24px",
                borderRadius: "12px",
              }}
            >
              {"Home"}
            </Link>{" "}
            <Link
              href="/services"
              className="site-menu-link"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(28px,4.2vw,48px)",
                color: "#181A0E",
                textDecoration: "none",
                padding: "6px 24px",
                borderRadius: "12px",
              }}
            >
              {"Services"}
            </Link>{" "}
            <Link
              href="/contact"
              className="site-menu-link"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(28px,4.2vw,48px)",
                color: "#181A0E",
                textDecoration: "none",
                padding: "6px 24px",
                borderRadius: "12px",
              }}
            >
              {"About"}
            </Link>{" "}
            <Link
              href="/news"
              className="site-menu-link"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(28px,4.2vw,48px)",
                color: "#181A0E",
                textDecoration: "none",
                padding: "6px 24px",
                borderRadius: "12px",
              }}
            >
              {"News"}
            </Link>{" "}
            <Link
              href="/contact"
              className="site-menu-link"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(28px,4.2vw,48px)",
                color: "#181A0E",
                textDecoration: "none",
                padding: "6px 24px",
                borderRadius: "12px",
              }}
            >
              {"Contact"}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
