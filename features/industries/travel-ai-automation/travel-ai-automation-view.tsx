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

export function TravelAiAutomationView() {
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
            {" Trending AI solution — Travel "}
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
            {" Travel is a "}
            <span
              style={{
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {"$9 trillion"}
            </span>
            {" industry, still booked one tab at a time. "}
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
              " Travelers juggle a dozen tabs to plan a trip, and support teams answer the same questions on repeat — AI now collapses both into minutes. "
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
              src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_182143_42bbfddc-1ac7-4189-ac54-abe1bbc6eef3.jpeg"
              alt="Traveler using an AI trip-planning concierge app"
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
                  {"$9T+"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {"global travel & tourism economic contribution each year"}
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
                  {"33min"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "average time travelers spend comparing options before booking"
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
                    "of travel support inquiries are repetitive questions AI can fully resolve"
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
                  {"15-20%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "revenue lift airlines and hotels see from AI dynamic pricing"
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
                  <span>{"Dynamic pricing engines"}</span>
                  <span style={{ color: "#8A87A0" }}>{"82%"}</span>
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
                      width: "82%",
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
                  <span>{"24/7 AI customer support"}</span>
                  <span style={{ color: "#8A87A0" }}>{"67%"}</span>
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
                      width: "67%",
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
                  <span>{"Personalized itinerary generation"}</span>
                  <span style={{ color: "#8A87A0" }}>{"48%"}</span>
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
                      width: "48%",
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
                  <span>{"Predictive delay & disruption alerts"}</span>
                  <span style={{ color: "#8A87A0" }}>{"39%"}</span>
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
                      width: "39%",
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
                  <span>{"Automated rebooking on disruption"}</span>
                  <span style={{ color: "#8A87A0" }}>{"24%"}</span>
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
                      width: "24%",
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
                    {
                      "Travelers open a dozen tabs to compare flights, hotels, and activities."
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
                      "An AI concierge builds a full itinerary from one prompt, priced and bookable."
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
                    {"A cancelled flight means a long hold with a call center."}
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
                      "An AI agent rebooks automatically and notifies the traveler before they notice."
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
                    {"Prices are set on fixed rules, missing demand swings."}
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
                      "Dynamic pricing adjusts in real time, lifting revenue 15-20%."
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
                      "The same support questions get answered by hand, hundreds of times a day."
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
                      "AI resolves 60% of inquiries instantly, 24/7, with no wait."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_182145_ae782ef4-d132-4b23-b930-cebb37148e80.jpeg"
                  alt="AI trip planning concierge chat on phone"
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
                    {"AI itinerary builder"}
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
                      "Turns a one-line prompt into a full, bookable trip in minutes."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_182146_3c7e3a0f-655b-473d-ae40-7ef136cc6d83.jpeg"
                  alt="Dynamic pricing dashboard for flights and hotels"
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
                    {"Dynamic pricing"}
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
                      "Prices adjust in real time to demand, seasonality, and competitor rates."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_182147_62c5e10a-f9d3-4ed8-8871-7fcfbff8d634.jpeg"
                  alt="24/7 travel support chatbot conversation"
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
                    {"24/7 support agent"}
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
                      "Resolves booking changes, refunds, and FAQs instantly, any time zone."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_182248_adb6e525-7148-41eb-8774-e93b45004510.jpeg"
                  alt="Flight delay prediction alert on phone"
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
                    {"Disruption prediction"}
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
                      "Flags likely delays before airlines announce them, so travelers can act early."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_182250_a07f9e9b-dda5-404f-86bf-f69ada34014f.jpeg"
                  alt="Automated rebooking confirmation on phone"
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
                    {"Auto-rebooking"}
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
                      "On cancellation, AI finds and confirms the next best option automatically."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_182251_3afc1b19-6e4c-43a3-bfdf-409054fb0a15.jpeg"
                  alt="Personalized travel recommendations on tablet"
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
                    {"Personalized recommendations"}
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
                      "Suggests destinations and add-ons based on past trips and live preferences."
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
                  "Five concrete, fundable starting points inside travel automation."
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
                  {"One-prompt trip planner"}
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
                    "Builds a complete, bookable itinerary from a single sentence, priced across flights, stays, and activities."
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
                  {"Disruption autopilot for airlines"}
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
                    "Predicts delays and auto-rebooks affected passengers before they even open the app."
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
                  {"Dynamic pricing for boutique hotels"}
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
                    "Gives independent properties the same real-time pricing power as large chains."
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
                  {"24/7 travel support agent"}
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
                    "Resolves booking changes, refunds, and policy questions instantly, in any language."
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
                  {"Group trip coordinator"}
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
                    "Merges a group's preferences and budgets into one itinerary everyone actually agrees on."
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
                  {"Loyalty personalization engine"}
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
                    "Turns past trip data into individualized offers that actually convert."
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
              {" Have a travel AI idea?"}
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
