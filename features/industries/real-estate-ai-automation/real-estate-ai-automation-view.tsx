import { Fragment } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/layout/site-nav";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    ::selection { background: #7C5CFF; color: #fff; }
    a { color: #8CA0FF; }
    a:hover { color: #B4C2FF; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    @keyframes barGrow { from { width: 0; } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    .reveal { opacity: 0; animation: riseIn 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

export function RealEstateAiAutomationView() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div
        style={{
          background: "#0A0B0F",
          color: "#F4F3F7",
          fontFamily: "'Inter',sans-serif",
          width: "100%",
          overflowX: "hidden",
        }}
      >
        <SiteNav />
        <div
          style={{
            position: "relative",
            padding: "120px 64px 100px",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-15%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "1100px",
              height: "650px",
              background:
                "radial-gradient(ellipse at center, rgba(124,92,255,0.22), transparent 65%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            className="reveal"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 16px",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              fontSize: "13px",
              color: "#C9C7D6",
              marginBottom: "32px",
              position: "relative",
              zIndex: "2",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#57F2A4",
              }}
            ></span>
            {" Trending AI solution — Real Estate "}
          </div>
          <h1
            className="reveal"
            style={{
              animationDelay: "0.1s",
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: "800",
              fontSize: "clamp(38px,6vw,84px)",
              lineHeight: "1.02",
              letterSpacing: "-0.03em",
              maxWidth: "1050px",
              margin: "0 auto 28px",
              position: "relative",
              zIndex: "2",
            }}
          >
            {" Real estate moves "}
            <span
              style={{
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {"$300 trillion"}
            </span>
            {" — on spreadsheets and cold calls. "}
          </h1>
          <p
            className="reveal"
            style={{
              animationDelay: "0.2s",
              fontSize: "19px",
              lineHeight: "1.65",
              color: "#ABA9B8",
              maxWidth: "640px",
              margin: "0 auto 44px",
              position: "relative",
              zIndex: "2",
            }}
          >
            {
              " Agents, brokerages and property managers lose deals to slow response times and manual valuation — AI now closes both gaps in real time. "
            }
          </p>
          <div
            className="reveal"
            style={{
              animationDelay: "0.3s",
              position: "relative",
              zIndex: "2",
            }}
          >
            <img
              src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_181426_cd155ffa-7f71-46c0-8bbe-348a7ceafc4b.jpeg"
              alt="Real estate agent using an AI-powered property dashboard"
              style={{
                width: "min(1000px,88vw)",
                height: "460px",
                margin: "0 auto",
                display: "block",
                boxShadow: "0 60px 120px -40px rgba(0,0,0,0.6)",
                objectFit: "cover",
                borderRadius: "24px",
              }}
              loading="lazy"
            />
          </div>
        </div>
        <div
          style={{
            padding: "100px 64px",
            background: "#F4F1EA",
            color: "#0A0B0F",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              style={{
                fontSize: "14px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A8676",
                marginBottom: "20px",
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {"The real numbers"}
            </div>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(32px,4.5vw,60px)",
                lineHeight: "1.05",
                letterSpacing: "-0.02em",
                margin: "0 0 64px",
                textAlign: "center",
              }}
            >
              {"The data behind the gap."}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "32px",
              }}
            >
              <div className="reveal" style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "52px",
                    fontWeight: "700",
                  }}
                >
                  {"$300T+"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "total global real estate value — the world's largest asset class"
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{ animationDelay: "0.1s", textAlign: "center" }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "52px",
                    fontWeight: "700",
                  }}
                >
                  {"78%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "of buyers go with the agent who responds first — most take hours to reply"
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{ animationDelay: "0.2s", textAlign: "center" }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "52px",
                    fontWeight: "700",
                  }}
                >
                  {"30hrs"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "spent per listing on manual admin, scheduling, and paperwork"
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{ animationDelay: "0.3s", textAlign: "center" }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "52px",
                    fontWeight: "700",
                  }}
                >
                  {"2-4%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "typical AVM valuation error rate — down from 8-10% five years ago"
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "140px 64px" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "72px" }}>
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
                {"Adoption today"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(32px,4.5vw,60px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"Where AI has already taken over."}
              </h2>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "28px" }}
            >
              <div className="reveal">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    marginBottom: "10px",
                  }}
                >
                  <span>{"Automated valuation models (AVMs)"}</span>
                  <span style={{ color: "#8A87A0" }}>{"86%"}</span>
                </div>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "86%",
                      borderRadius: "6px",
                      background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                      animation: "barGrow 1.2s ease-out",
                    }}
                  ></div>
                </div>
              </div>
              <div className="reveal" style={{ animationDelay: "0.08s" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    marginBottom: "10px",
                  }}
                >
                  <span>{"AI lead response & qualification"}</span>
                  <span style={{ color: "#8A87A0" }}>{"64%"}</span>
                </div>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "64%",
                      borderRadius: "6px",
                      background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                      animation: "barGrow 1.2s ease-out 0.1s both",
                    }}
                  ></div>
                </div>
              </div>
              <div className="reveal" style={{ animationDelay: "0.16s" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    marginBottom: "10px",
                  }}
                >
                  <span>{"Virtual staging & listing photos"}</span>
                  <span style={{ color: "#8A87A0" }}>{"58%"}</span>
                </div>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "58%",
                      borderRadius: "6px",
                      background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                      animation: "barGrow 1.2s ease-out 0.2s both",
                    }}
                  ></div>
                </div>
              </div>
              <div className="reveal" style={{ animationDelay: "0.24s" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    marginBottom: "10px",
                  }}
                >
                  <span>{"Predictive maintenance (property mgmt)"}</span>
                  <span style={{ color: "#8A87A0" }}>{"37%"}</span>
                </div>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "37%",
                      borderRadius: "6px",
                      background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                      animation: "barGrow 1.2s ease-out 0.3s both",
                    }}
                  ></div>
                </div>
              </div>
              <div className="reveal" style={{ animationDelay: "0.32s" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    marginBottom: "10px",
                  }}
                >
                  <span>{"Contract & closing automation"}</span>
                  <span style={{ color: "#8A87A0" }}>{"29%"}</span>
                </div>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "29%",
                      borderRadius: "6px",
                      background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                      animation: "barGrow 1.2s ease-out 0.4s both",
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "140px 64px",
            background: "linear-gradient(180deg, #0A0B0F 0%, #100E1C 100%)",
          }}
        >
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "80px" }}>
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
                {"Before → after"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(32px,4.5vw,60px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"What automation actually changes."}
              </h2>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="reveal"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: "24px",
                  background: "#0D0E15",
                  padding: "28px 36px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#7A7887",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"Before"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#B4B2C0" }}
                  >
                    {"Leads sit in an inbox for hours before anyone replies."}
                  </p>
                </div>
                <div style={{ fontSize: "20px", color: "#7C5CFF" }}>{"→"}</div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#57F2A4",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"After"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#E7E5F0" }}
                  >
                    {
                      "An AI agent replies in under a minute, qualifies, and books a tour."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.08s",
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: "24px",
                  background: "#0D0E15",
                  padding: "28px 36px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#7A7887",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"Before"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#B4B2C0" }}
                  >
                    {"Agents guess at pricing from a handful of nearby comps."}
                  </p>
                </div>
                <div style={{ fontSize: "20px", color: "#7C5CFF" }}>{"→"}</div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#57F2A4",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"After"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#E7E5F0" }}
                  >
                    {
                      "An AVM prices from thousands of live data points within 2-4% accuracy."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.16s",
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: "24px",
                  background: "#0D0E15",
                  padding: "28px 36px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#7A7887",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"Before"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#B4B2C0" }}
                  >
                    {
                      "Empty units get staged with real furniture, at real cost and delay."
                    }
                  </p>
                </div>
                <div style={{ fontSize: "20px", color: "#7C5CFF" }}>{"→"}</div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#57F2A4",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"After"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#E7E5F0" }}
                  >
                    {
                      "AI virtual staging furnishes listing photos in minutes, for a fraction of the cost."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.24s",
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: "24px",
                  background: "#0D0E15",
                  padding: "28px 36px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#7A7887",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"Before"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#B4B2C0" }}
                  >
                    {
                      "Maintenance issues surface only after a tenant complains."
                    }
                  </p>
                </div>
                <div style={{ fontSize: "20px", color: "#7C5CFF" }}>{"→"}</div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#57F2A4",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    {"After"}
                  </div>
                  <p
                    style={{ margin: "0", fontSize: "15px", color: "#E7E5F0" }}
                  >
                    {
                      "Predictive models flag equipment failure risk before it happens."
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "140px 64px" }}>
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "80px" }}>
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
                {"Already happening"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(32px,4.5vw,60px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0 0 20px",
                }}
              >
                {"Processes being automated right now."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "28px",
              }}
            >
              <div
                className="reveal"
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_181428_fffe4368-0486-4b4e-986a-75e2744caa9e.jpeg"
                  alt="AI chatbot qualifying a real estate lead on phone"
                  style={{
                    width: "100%",
                    height: "220px",
                    display: "block",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {"Instant lead response"}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {
                      "AI agents reply, qualify, and schedule tours within seconds of an inquiry."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.08s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_181429_c3b72e2e-e3a2-4fd4-92f6-2b01472a6f86.jpeg"
                  alt="Automated property valuation model dashboard"
                  style={{
                    width: "100%",
                    height: "220px",
                    display: "block",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {"Automated valuation (AVM)"}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {
                      "Real-time pricing from comps, market trends, and property condition data."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.16s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_181431_21c9a957-c666-426f-9858-627d3336eeb4.jpeg"
                  alt="Virtual staging before and after listing photo"
                  style={{
                    width: "100%",
                    height: "220px",
                    display: "block",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {"Virtual staging"}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {
                      "Empty rooms furnished digitally in minutes for a fraction of physical staging cost."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.24s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_181516_cffe5508-89b9-4e8c-aec9-83629a36d5cc.jpeg"
                  alt="Predictive maintenance dashboard for property management"
                  style={{
                    width: "100%",
                    height: "220px",
                    display: "block",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {"Predictive maintenance"}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {
                      "Sensor and usage data flag HVAC, plumbing, and equipment risk before failure."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.32s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_181518_651e2d01-8d09-4672-8b91-b081ec2aae26.jpeg"
                  alt="Digital contract signing on tablet"
                  style={{
                    width: "100%",
                    height: "220px",
                    display: "block",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {"Contract automation"}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {
                      "AI drafts, reviews, and routes lease and purchase paperwork for e-signature."
                    }
                  </p>
                </div>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.4s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_181519_83db0829-83e5-4915-a67c-2f3886de6606.jpeg"
                  alt="AI investment analytics dashboard for real estate portfolio"
                  style={{
                    width: "100%",
                    height: "220px",
                    display: "block",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
                <div style={{ padding: "24px" }}>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {"Portfolio analytics"}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {
                      "Investors get live yield, occupancy, and risk forecasts across every property."
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "140px 64px",
            background: "#F4F1EA",
            color: "#0A0B0F",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "72px" }}>
              <div
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8A8676",
                  marginBottom: "20px",
                  fontWeight: "600",
                }}
              >
                {"Build this"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(32px,4.5vw,60px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0 0 20px",
                }}
              >
                {"SaaS ideas worth validating."}
              </h2>
              <p
                style={{
                  fontSize: "18px",
                  color: "#5C5847",
                  maxWidth: "600px",
                  margin: "0 auto",
                  lineHeight: "1.6",
                }}
              >
                {
                  "Five concrete, fundable starting points inside real estate automation."
                }
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,1fr)",
                gap: "24px",
              }}
            >
              <div
                className="reveal"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(10,11,15,0.08)",
                  borderRadius: "18px",
                  padding: "30px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "18px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"AI lead response agent"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#5C5847",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Replies to every inbound inquiry in under a minute across chat, SMS, and email, then books the tour."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.08s",
                  background: "#fff",
                  border: "1px solid rgba(10,11,15,0.08)",
                  borderRadius: "18px",
                  padding: "30px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "18px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"Instant AVM for small brokerages"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#5C5847",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Gives independent agents the same real-time valuation power as large portals, at a fraction of the cost."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.16s",
                  background: "#fff",
                  border: "1px solid rgba(10,11,15,0.08)",
                  borderRadius: "18px",
                  padding: "30px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "18px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"One-click virtual staging"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#5C5847",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Turns empty-room photos into fully staged listings in under a minute, no furniture rental required."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.24s",
                  background: "#fff",
                  border: "1px solid rgba(10,11,15,0.08)",
                  borderRadius: "18px",
                  padding: "30px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "18px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"Predictive maintenance for landlords"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#5C5847",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Flags which units need service before tenants complain, cutting emergency repair costs."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.32s",
                  background: "#fff",
                  border: "1px solid rgba(10,11,15,0.08)",
                  borderRadius: "18px",
                  padding: "30px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "18px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"Closing document co-pilot"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#5C5847",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Drafts and checks lease and purchase agreements against local regulations automatically."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.4s",
                  background: "#fff",
                  border: "1px solid rgba(10,11,15,0.08)",
                  borderRadius: "18px",
                  padding: "30px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "18px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"Portfolio intelligence for small investors"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#5C5847",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Brings institutional-grade yield and risk analytics to owners of just a handful of properties."
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "140px 64px 160px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "10%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "900px",
              height: "600px",
              background:
                "radial-gradient(ellipse at center, rgba(124,92,255,0.16), transparent 65%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "700px",
              margin: "0 auto",
              position: "relative",
              zIndex: "2",
            }}
          >
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(32px,5vw,64px)",
                lineHeight: "1.05",
                letterSpacing: "-0.025em",
                margin: "0 0 28px",
              }}
            >
              {" Have a real estate AI idea?"}
              <br />
              {"Get an "}
              <span
                style={{
                  background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {"honest"}
              </span>
              {" score first. "}
            </h2>
            <p
              style={{ fontSize: "16px", color: "#8A87A0", margin: "0 0 36px" }}
            >
              {
                "Free, citation-backed validation in minutes — before you build a thing."
              }
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "17px 30px",
                borderRadius: "12px",
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                color: "#0A0B0F",
                fontSize: "15px",
                fontWeight: "700",
                textDecoration: "none",
              }}
            >
              {"Validate your idea free →"}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
