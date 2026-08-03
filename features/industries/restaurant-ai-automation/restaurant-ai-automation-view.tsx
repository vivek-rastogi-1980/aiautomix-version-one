import { Fragment } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/layout/site-nav";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    ::selection { background: #7C5CFF; color: #fff; }
    a { color: #8CA0FF; }
    a:hover { color: #B4C2FF; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes barGrow { from { width: 0; } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    .reveal { opacity: 0; animation: riseIn 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

export function RestaurantAiAutomationView() {
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
            {" Trending AI solution — Restaurant "}
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
            {" Restaurants run on "}
            <span
              style={{
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {"3-5% margins"}
            </span>
            {" — most still guess at demand. "}
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
              " Orders get missed, staff get over- or under-scheduled, and food gets wasted on hunches — AI now predicts demand and automates the rest in real time. "
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
              src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_055118_43262eb3-c998-4215-8343-f518dc9b4e8c.png"
              alt="Restaurant staff using an AI ordering and kitchen dashboard"
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
                  {"$117B"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "global restaurant industry revenue in 2025, projected past $208B by 2033"
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
                  {"$13.2B"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "global AI-in-restaurants market in 2025 — growing over 22% a year"
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
                  {"60%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "of restaurants have already adopted some form of AI for efficiency"
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
                  {"24%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {"of restaurants plan to adopt AI within the next 12 months"}
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
                  <span>{"Cloud POS & digital ordering"}</span>
                  <span style={{ color: "#8A87A0" }}>{"78%"}</span>
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
                      width: "78%",
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
                  <span>{"Predictive inventory & demand forecasting"}</span>
                  <span style={{ color: "#8A87A0" }}>{"55%"}</span>
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
                      width: "55%",
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
                  <span>{"AI-driven staff scheduling"}</span>
                  <span style={{ color: "#8A87A0" }}>{"42%"}</span>
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
                      width: "42%",
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
                  <span>{"Voice AI for drive-thru & phone orders"}</span>
                  <span style={{ color: "#8A87A0" }}>{"28%"}</span>
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
                      width: "28%",
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
                  <span>{"Kitchen automation & robotics"}</span>
                  <span style={{ color: "#8A87A0" }}>{"17%"}</span>
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
                      width: "17%",
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
                    {"Phone orders get missed during the dinner rush."}
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
                      "A voice AI answers every call, takes the order, and routes it straight to the kitchen."
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
                    {
                      "Managers over-order and throw out unsold food every week."
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
                      "Demand forecasting orders exactly what's needed, cutting waste and cost."
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
                      "Shifts are staffed by gut feel, leaving the floor short or overstaffed."
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
                      "AI scheduling matches staffing to predicted foot traffic, hour by hour."
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
                      "Loyalty programs send the same generic offer to every customer."
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
                      "AI personalizes offers per diner based on real order history."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_055120_2fb40774-bb21-4082-b2cd-82390337c833.png"
                  alt="Customer using a self-service AI ordering kiosk in a restaurant"
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
                    {"AI ordering & kiosks"}
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
                      "Voice and kiosk AI take orders accurately, upsell naturally, and never miss a call."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_055122_995a0b8f-61ad-46bd-9352-9813e9555a1b.png"
                  alt="Restaurant manager reviewing an AI inventory and demand forecasting dashboard"
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
                    {"Demand forecasting"}
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
                      "Predicts daily demand from weather, events, and history to cut food waste."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_055123_8961495d-7c10-407a-8b6b-8a717beabc2a.png"
                  alt="Restaurant manager building AI-optimized staff schedule on a tablet"
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
                    {"Smart staff scheduling"}
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
                      "Builds shift schedules that match predicted traffic, hour by hour."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_055219_c12f5876-43d8-4444-ac58-113178ee3aa4.png"
                  alt="Kitchen display system with automated order tickets in a commercial kitchen"
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
                    {"Kitchen display automation"}
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
                      "Routes and sequences tickets automatically to keep every station on pace."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_055220_0751a4b0-ea1b-4ae7-a88d-4b65091955d5.png"
                  alt="Customer receiving a personalized restaurant loyalty offer on a phone"
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
                    {"Personalized loyalty"}
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
                      "Sends the right offer to the right diner based on real order history."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_055222_3a0789ea-b102-4263-bc2e-84dedde6c038.png"
                  alt="Restaurant owner viewing a multi-location sales and performance dashboard"
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
                    {"Multi-location analytics"}
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
                      "Rolls up sales, labor, and waste data across locations into one live view."
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
                  "Five concrete, fundable starting points inside restaurant automation."
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
                  {"Voice AI for phone & drive-thru orders"}
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
                    "Answers every call, takes the order accurately, and never puts a customer on hold."
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
                  {"Waste-cutting demand forecaster"}
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
                    "Gives independent restaurants the same ordering precision as national chains."
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
                  {"Auto-scheduling for shift-based labor"}
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
                    "Builds and adjusts staff schedules automatically as demand forecasts shift."
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
                  {"Kitchen ticket router for ghost kitchens"}
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
                    "Sequences multi-brand, multi-platform orders into one optimized kitchen flow."
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
                  {"Loyalty personalization for independents"}
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
                    "Brings chain-level personalized offers to single-location restaurants."
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
                  {"Multi-location performance rollup"}
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
                    "Gives small chains one live dashboard across sales, labor, and waste."
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
              {" Have a restaurant AI idea?"}
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
