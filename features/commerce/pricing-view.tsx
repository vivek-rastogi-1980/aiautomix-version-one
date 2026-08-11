import Link from "next/link";

import { SiteNav } from "@/components/layout/site-nav";
import { formatPrice } from "@/features/commerce/subscriptions";
import type { Feature, Plan } from "@/features/commerce/types";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    a { color: #8CA0FF; text-decoration: none; }
    a:hover { color: #B4C2FF; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
  .site-menu-link:hover { background: #E4E3FA; }

  .plan-card { transition: transform 0.25s cubic-bezier(0.22,0.61,0.36,1), border-color 0.25s ease; }
  .plan-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.16) !important; }
  @media (prefers-reduced-motion: reduce) {
    .plan-card { transition: none; }
    .plan-card:hover { transform: none; }
  }

  /* The comparison table is the one element that cannot reflow below ~640px
     without becoming unreadable, so it scrolls inside its own container rather
     than forcing the page to scroll horizontally. */
  .plan-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .plan-table { border-collapse: collapse; width: 100%; min-width: 680px; }
  .plan-table th, .plan-table td { padding: 13px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; }
  .plan-table th { color: #8A87A0; font-weight: 600; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
  .plan-table td:not(:first-child), .plan-table th:not(:first-child) { text-align: center; }

  @media (max-width: 900px) {
    .pricing-wrap { padding: 80px 20px 100px !important; }
    .plan-grid { grid-template-columns: 1fr !important; }
  }
`;

/** Display order and labels. Keys are the typed `Feature` union. */
const FEATURE_ROWS: { key: Feature; label: string }[] = [
  { key: "business_idea_validation", label: "Idea validations" },
  { key: "business_plan", label: "Business plans" },
  { key: "pdf_export", label: "PDF export" },
  { key: "market_research", label: "Market research" },
  { key: "competitor_analysis", label: "Competitor analysis" },
  { key: "team_members", label: "Team members" },
  { key: "api_access", label: "API access" },
];

export type EntitlementMatrix = Record<
  string,
  Record<string, { enabled: boolean; limit: number | null }>
>;

interface PricingViewProps {
  plans: Plan[];
  /** planId -> feature -> entitlement. Comes from the database, not the client. */
  entitlements: EntitlementMatrix;
}

/** Renders a cell: unlimited, denied, or a cap. */
function cell(entry?: { enabled: boolean; limit: number | null }) {
  if (!entry || !entry.enabled || entry.limit === 0) {
    return <span style={{ color: "#4A4858" }}>—</span>;
  }
  if (entry.limit === null) {
    return <span style={{ color: "#57F2A4", fontWeight: 600 }}>Unlimited</span>;
  }
  return <span style={{ color: "#F4F3F7" }}>{entry.limit}</span>;
}

export function PricingView({ plans, entitlements }: PricingViewProps) {
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
          className="pricing-wrap"
          style={{
            maxWidth: "1180px",
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
              marginBottom: "18px",
              fontWeight: 600,
            }}
          >
            {"Pricing"}
          </div>
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: "clamp(32px,4.6vw,54px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "0 0 16px",
              maxWidth: "740px",
            }}
          >
            {"Start free. Scale when the work does."}
          </h1>
          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.6,
              color: "#B9B5C9",
              maxWidth: "600px",
              margin: "0 0 56px",
            }}
          >
            {
              "Every plan includes the AI platform — validation, planning and branded PDF export. Higher tiers raise the limits and unlock research."
            }
          </p>

          <div
            className="plan-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "18px",
              marginBottom: "72px",
            }}
          >
            {plans.map((plan) => {
              const featured = plan.id === "growth";
              return (
                <div
                  key={plan.id}
                  className="plan-card"
                  style={{
                    border: featured
                      ? "1px solid rgba(124,92,255,0.5)"
                      : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "20px",
                    padding: "26px",
                    background: featured
                      ? "linear-gradient(160deg, rgba(124,92,255,0.12), rgba(240,33,158,0.05))"
                      : "rgba(255,255,255,0.02)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {featured ? (
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#B9A4FF",
                        marginBottom: "10px",
                      }}
                    >
                      {"Most popular"}
                    </div>
                  ) : null}

                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontWeight: 700,
                      fontSize: "19px",
                      marginBottom: "6px",
                    }}
                  >
                    {plan.name}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "6px",
                      margin: "8px 0 4px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Bricolage Grotesque',sans-serif",
                        fontWeight: 800,
                        fontSize: "32px",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {formatPrice(plan.price_monthly, plan.currency)}
                    </span>
                    {plan.price_monthly !== null && plan.price_monthly > 0 ? (
                      <span style={{ fontSize: "13.5px", color: "#8A87A0" }}>
                        {"/month"}
                      </span>
                    ) : null}
                  </div>

                  <p
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: "#B9B5C9",
                      margin: "10px 0 18px",
                      flexGrow: 1,
                    }}
                  >
                    {plan.description}
                  </p>

                  <div
                    style={{
                      fontSize: "13px",
                      color: "#8A87A0",
                      marginBottom: "18px",
                    }}
                  >
                    {plan.monthly_credits > 0
                      ? `${plan.monthly_credits.toLocaleString("en-US")} credits / month`
                      : plan.id === "enterprise"
                        ? "Custom credit allowance"
                        : "No included credits"}
                  </div>

                  {/*
                    Deliberately NOT a checkout button. Sprint 6.5 implements no
                    payment provider, and a button that appears to purchase but
                    does not is worse than none — it teaches users the product is
                    broken. Contact is the honest action available today.
                  */}
                  <Link
                    href="/contact"
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "11px 18px",
                      borderRadius: "100px",
                      fontSize: "14px",
                      fontWeight: 600,
                      textDecoration: "none",
                      border: featured
                        ? "none"
                        : "1px solid rgba(255,255,255,0.14)",
                      background: featured
                        ? "linear-gradient(135deg, #7C5CFF 0%, #F0219E 100%)"
                        : "transparent",
                      color: "#FFFFFF",
                    }}
                  >
                    {plan.id === "free" ? "Get started" : "Talk to us"}
                  </Link>
                </div>
              );
            })}
          </div>

          <h2
            style={{
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: 700,
              fontSize: "clamp(21px,2.4vw,28px)",
              letterSpacing: "-0.01em",
              margin: "0 0 22px",
            }}
          >
            {"Compare plans"}
          </h2>

          <div className="plan-table-scroll">
            <table className="plan-table">
              <caption
                style={{
                  captionSide: "bottom",
                  textAlign: "left",
                  fontSize: "12.5px",
                  color: "#6E6C7C",
                  paddingTop: "14px",
                }}
              >
                {
                  "Limits are per calendar month. “Unlimited” is subject to fair use."
                }
              </caption>
              <thead>
                <tr>
                  <th scope="col">{"Feature"}</th>
                  {plans.map((p) => (
                    <th key={p.id} scope="col">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.key}>
                    <th
                      scope="row"
                      style={{
                        color: "#D6D4E0",
                        textTransform: "none",
                        fontSize: "14px",
                        letterSpacing: 0,
                      }}
                    >
                      {row.label}
                    </th>
                    {plans.map((p) => (
                      <td key={p.id}>{cell(entitlements[p.id]?.[row.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p
            style={{ fontSize: "13.5px", color: "#6E6C7C", marginTop: "34px" }}
          >
            {
              "Checkout is not yet available. Get in touch and we'll set your workspace up directly."
            }
          </p>
        </div>
      </div>
    </>
  );
}
