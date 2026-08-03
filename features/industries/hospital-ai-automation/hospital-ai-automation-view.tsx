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

export function HospitalAiAutomationView() {
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
            {" Trending AI solution — Hospital "}
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
            {" Healthcare spends "}
            <span
              style={{
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {"$10 trillion"}
            </span>
            {" a year — half of it on paperwork. "}
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
              " Doctors spend more time on documentation than patients, and staffing gaps go unseen until they hurt care — AI now closes both in real time. "
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
              src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_183234_2f047c51-f811-4ccd-b909-79fe0e6d3953.jpeg"
              alt="Doctor using an AI clinical documentation assistant"
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
                  {"$10T+"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {"global healthcare spend each year, growing faster than GDP"}
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
                  {"2hrs"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "spent on documentation for every 1 hour of direct patient care"
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
                  {"30%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "of healthcare spend is estimated waste — much of it administrative"
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
                  {"20-30%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "reduction in no-shows when AI handles scheduling and reminders"
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
                  <span>{"Medical billing & claims automation"}</span>
                  <span style={{ color: "#8A87A0" }}>{"74%"}</span>
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
                      width: "74%",
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
                  <span>{"AI scheduling & appointment reminders"}</span>
                  <span style={{ color: "#8A87A0" }}>{"61%"}</span>
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
                      width: "61%",
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
                  <span>{"Ambient clinical documentation"}</span>
                  <span style={{ color: "#8A87A0" }}>{"45%"}</span>
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
                      width: "45%",
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
                  <span>{"Predictive bed & staff planning"}</span>
                  <span style={{ color: "#8A87A0" }}>{"33%"}</span>
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
                      width: "33%",
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
                  <span>{"AI-assisted diagnostic imaging"}</span>
                  <span style={{ color: "#8A87A0" }}>{"26%"}</span>
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
                      width: "26%",
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
                      "Doctors type notes for hours after seeing patients all day."
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
                      "Ambient AI listens to the visit and drafts the clinical note automatically."
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
                      "Patients miss appointments with no reminder system that actually works."
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
                    {"AI scheduling and reminders cut no-shows by 20-30%."}
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
                      "Claims get denied for coding errors, delaying revenue for months."
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
                      "AI checks claims before submission, cutting denials and speeding payment."
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
                      "Bed shortages and staffing gaps are discovered mid-shift."
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
                      "Predictive models forecast occupancy and staffing needs days ahead."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_183236_1e204dc8-2bdf-4e58-b97d-1dec497f4b4c.jpeg"
                  alt="Doctor using ambient AI clinical documentation during patient visit"
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
                    {"Ambient clinical notes"}
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
                      "AI listens to the visit and drafts structured notes, ready for physician review."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_183237_87e586e8-5e7c-49ce-aa70-6c24909384e6.jpeg"
                  alt="Hospital staff reviewing an automated billing and claims dashboard"
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
                    {"Billing & claims automation"}
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
                      "Checks codes and documentation before submission to cut denials."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_183239_ea0322e6-8513-4a3e-b90b-b10bb78b5839.jpeg"
                  alt="Patient receiving an AI appointment reminder on phone"
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
                    {"Smart scheduling"}
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
                      "AI books, reminds, and reschedules patients automatically, cutting no-shows."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_183351_72b1c5b3-facf-4d84-89b3-5e8df7278b34.jpeg"
                  alt="Radiologist reviewing AI-assisted diagnostic imaging scan"
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
                    {"AI-assisted diagnostics"}
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
                      "Flags anomalies in scans and labs for radiologists to confirm faster."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_183353_8c99a3a7-b858-44c1-a24d-82d613f14ac6.jpeg"
                  alt="Hospital administrator viewing bed occupancy and staffing dashboard"
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
                    {"Predictive staffing & beds"}
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
                      "Forecasts occupancy and staffing needs days in advance from admission trends."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_183354_81d7d0e7-9101-473a-afcc-bac201cb60d5.jpeg"
                  alt="Patient chatting with a 24/7 AI health support chatbot"
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
                    {"24/7 patient support"}
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
                      "Answers routine patient questions and triages urgency around the clock."
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
                  "Five concrete, fundable starting points inside healthcare automation."
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
                  {"Ambient scribe for small clinics"}
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
                    "Brings enterprise-grade ambient documentation to independent practices at a fraction of the cost."
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
                  {"Claim denial prevention engine"}
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
                    "Catches coding and documentation errors before submission, recovering lost revenue."
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
                  {"No-show prediction & recall"}
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
                    "Flags high-risk appointments and automatically fills cancellations from a waitlist."
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
                  {"Bed & staffing forecast for smaller hospitals"}
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
                    "Gives mid-size hospitals the same predictive planning tools as large health systems."
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
                  {"24/7 patient triage assistant"}
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
                    "Answers routine questions and routes urgent cases to a human immediately."
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
                  {"Prior authorization autopilot"}
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
                    "Drafts and submits insurance prior-auth requests automatically from the chart."
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
              {" Have a healthcare AI idea?"}
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
