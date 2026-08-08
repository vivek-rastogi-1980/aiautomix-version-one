import { ImageResponse } from "next/og";

/**
 * Branded social card (P0-9).
 *
 * The previous og:image was `/assets/logo-ice2.png` — 890×827 and 419 KB. Social
 * platforms compose for 1200×630, so a near-square logo gets letterboxed or
 * centre-cropped, and 419 KB is heavy for something fetched by a crawler.
 *
 * Generated rather than committed as a binary: `next/og` ships with Next, so
 * this adds no dependency, renders at build time, and stays editable as code
 * instead of requiring a round trip through a design tool.
 *
 * Because this file sits at the root of `app/`, every route inherits it unless
 * it declares its own — so the whole site gets a correct card from one file.
 *
 * ImageResponse uses Satori, which supports flexbox but not CSS grid, and needs
 * an explicit `display: flex` on any element with multiple children.
 */

export const alt =
  "AIAutoMix — AI automation, AI agents and business intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: "#0A0B0F",
        padding: "88px",
        position: "relative",
      }}
    >
      {/* Brand glow, echoing the hero treatment. */}
      <div
        style={{
          position: "absolute",
          top: "-180px",
          right: "-120px",
          width: "620px",
          height: "620px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124,92,255,0.38) 0%, rgba(124,92,255,0) 70%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-220px",
          left: "-140px",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(240,33,158,0.28) 0%, rgba(240,33,158,0) 70%)",
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "0.22em",
          color: "#B9B5C9",
          marginBottom: "28px",
        }}
      >
        AIAUTOMIX
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.06,
          color: "#F4F3F7",
          maxWidth: "900px",
        }}
      >
        AI Automation &amp; Business Intelligence
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 30,
          lineHeight: 1.45,
          color: "#B9B5C9",
          marginTop: "30px",
          maxWidth: "820px",
        }}
      >
        Validate, build, automate and scale your business with AI.
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "52px",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "80px",
            height: "6px",
            borderRadius: "100px",
            background: "linear-gradient(90deg, #7C5CFF 0%, #F0219E 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#8A87A0",
            marginLeft: "22px",
          }}
        >
          www.aiautomix.com
        </div>
      </div>
    </div>,
    { ...size },
  );
}
