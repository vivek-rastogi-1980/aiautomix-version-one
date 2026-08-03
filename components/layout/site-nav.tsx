"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_CSS = `
  @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
  @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
  .site-menu-link:hover { background: #E4E3FA; }
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/login"
            style={{
              padding: "11px 18px",
              borderRadius: "100px",
              color: "#F4F1EA",
              fontSize: "13px",
              fontWeight: "600",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {"Log in"}
          </Link>
          <Link
            href="/contact"
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
              href="/#news"
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
