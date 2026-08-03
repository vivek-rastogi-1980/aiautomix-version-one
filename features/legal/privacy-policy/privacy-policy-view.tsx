import { Fragment } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/layout/site-nav";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    a { color: #8CA0FF; text-decoration: none; }
    a:hover { color: #B4C2FF; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

export function PrivacyPolicyView() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div
        style={{
          background: "#0A0B0F",
          color: "#F4F3F7",
          fontFamily: "'Inter',sans-serif",
          width: "100%",
          minHeight: "100vh",
        }}
      >
        <SiteNav />
        <div
          style={{
            maxWidth: "820px",
            margin: "0 auto",
            padding: "100px 64px 120px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8A87A0",
              marginBottom: "20px",
              fontWeight: "600",
            }}
          >
            {"Legal"}
          </div>
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: "800",
              fontSize: "clamp(30px,4vw,46px)",
              letterSpacing: "-0.02em",
              margin: "0 0 12px",
            }}
          >
            {"Privacy Policy"}
          </h1>
          <p
            style={{ fontSize: "13.5px", color: "#6E6C7C", margin: "0 0 48px" }}
          >
            {"Last updated: July 2026"}
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "36px",
              fontSize: "15px",
              color: "#B4B2C0",
              lineHeight: "1.75",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"1. Information we collect"}
              </h2>
              <p style={{ margin: "0" }}>
                {
                  "We collect information you provide directly — such as your name, email, company, and business idea details when you use our validation tools, book a session, or contact us — along with basic usage data (pages visited, actions taken) to improve our product."
                }
              </p>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"2. How we use your information"}
              </h2>
              <p style={{ margin: "0" }}>
                {
                  "We use your information to deliver validation reports and business plans, respond to inquiries, improve our AI agents, and — with your consent — send relevant product updates. We never sell your data to third parties."
                }
              </p>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"3. Your business idea stays confidential"}
              </h2>
              <p style={{ margin: "0" }}>
                {
                  "Business ideas and details submitted for validation are treated as confidential and are not shared with other users, competitors, or used to train shared models without your explicit permission."
                }
              </p>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"4. Data storage & security"}
              </h2>
              <p style={{ margin: "0" }}>
                {
                  "We use industry-standard encryption and access controls to protect your data in transit and at rest. Access is limited to team members who need it to operate the service."
                }
              </p>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"5. Cookies & analytics"}
              </h2>
              <p style={{ margin: "0" }}>
                {
                  "We use minimal cookies and analytics to understand how our site is used and to improve performance. You can disable cookies in your browser settings at any time."
                }
              </p>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"6. Your rights"}
              </h2>
              <p style={{ margin: "0" }}>
                {
                  "You can request access to, correction of, or deletion of your personal data at any time by contacting us. We will respond within 30 days."
                }
              </p>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"7. Changes to this policy"}
              </h2>
              <p style={{ margin: "0" }}>
                {
                  "We may update this policy from time to time. Material changes will be communicated via email or a notice on our site."
                }
              </p>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#F4F3F7",
                  margin: "0 0 12px",
                }}
              >
                {"8. Contact us"}
              </h2>
              <p style={{ margin: "0" }}>
                {"Questions about this policy? Reach us at "}
                <a href="mailto:hello@aiautomix.com">{"hello@aiautomix.com"}</a>
                {" or visit our "}
                <Link href="/contact">{"Contact page"}</Link>
                {"."}
              </p>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "56px 64px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
          }}
        >
          <Link href="/" style={{ fontSize: "14px", color: "#8A87A0" }}>
            {"← Back to AIAutomix home"}
          </Link>
        </div>
      </div>
    </>
  );
}
