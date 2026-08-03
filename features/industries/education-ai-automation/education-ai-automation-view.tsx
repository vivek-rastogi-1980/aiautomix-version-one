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
    @keyframes pulseGlow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
    @keyframes countUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    .reveal { opacity: 0; animation: riseIn 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

export function EducationAiAutomationView() {
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
            {" Trending AI solution — Education "}
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
              maxWidth: "1000px",
              margin: "0 auto 28px",
              position: "relative",
              zIndex: "2",
            }}
          >
            {" Education is a "}
            <span
              style={{
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {"$7 trillion+"}
            </span>
            {" industry running on broken processes. "}
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
              " Schools, universities and edtech platforms lose time and revenue to the same five gaps every year — and AI now closes every one of them. "
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
              src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_174650_3cc6138e-6bbf-438f-b95c-9656447c9703.jpeg"
              alt="Students in a modern classroom using AI-assisted learning tools"
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
              {"The opportunity"}
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
              {"A massive market, still run manually."}
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
                  {"$7T+"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "global education industry spend in 2025, projected toward $10T by 2030"
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
                  {"269M"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "students in higher education alone worldwide, on largely one-size-fits-all paths"
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
                  {"~$200B"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "global EdTech market in 2025 — still under 3% of total education spend"
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
                  {"~11%"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#5C5847",
                    marginTop: "8px",
                  }}
                >
                  {
                    "CAGR for EdTech through 2033 — most of that growth is still ahead"
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "140px 64px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
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
                {"The gaps"}
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
                {"Five problems every institution repeats."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "24px",
              }}
            >
              <div
                className="reveal"
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "16px" }}>
                  {"🎯"}
                </div>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "19px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}
                >
                  {"One-size-fits-all pacing"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#8A87A0",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Most classrooms move students through material at a single fixed pace, regardless of ability — fast learners get bored, others get left behind."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.08s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "16px" }}>
                  {"📝"}
                </div>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "19px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}
                >
                  {"Grading eats the week"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#8A87A0",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Manual grading and feedback commonly take days to turn around — students often lose the learning moment before feedback arrives."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.16s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "16px" }}>
                  {"📉"}
                </div>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "19px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}
                >
                  {"Dropouts go unseen"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#8A87A0",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "At-risk students are usually flagged only after they've already fallen behind, not before."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.24s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "16px" }}>
                  {"📞"}
                </div>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "19px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}
                >
                  {"Admissions bottlenecks"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#8A87A0",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Small teams answer the same enrollment questions hundreds of times a season by hand."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.32s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "16px" }}>
                  {"🗂"}
                </div>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "19px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}
                >
                  {"Content never updates"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#8A87A0",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Curriculum and practice material are built once and rarely adapted to what's actually working."
                  }
                </p>
              </div>
              <div
                className="reveal"
                style={{
                  animationDelay: "0.4s",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "16px" }}>
                  {"💬"}
                </div>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "19px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}
                >
                  {"No 24/7 support"}
                </div>
                <p
                  style={{
                    fontSize: "14.5px",
                    color: "#8A87A0",
                    lineHeight: "1.6",
                    margin: "0",
                  }}
                >
                  {
                    "Students hit questions at 11pm with no one to ask until the next class."
                  }
                </p>
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
                    {"Every student gets the same lesson plan and pace."}
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
                      "An AI tutor adapts pace and difficulty per student, in real time."
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
                    {"Teachers grade essays and quizzes by hand overnight."}
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
                      "AI grades objectively and returns feedback within minutes."
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
                    {"At-risk students are noticed after they fail a term."}
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
                      "Predictive models flag disengagement weeks before it shows up in grades."
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
                      "Admissions staff answer the same questions all day by phone and email."
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
                      "An AI agent handles inquiries, scheduling, and follow-ups around the clock."
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
              <p
                style={{
                  fontSize: "18px",
                  color: "#ABA9B8",
                  maxWidth: "600px",
                  margin: "0 auto",
                  lineHeight: "1.6",
                }}
              >
                {
                  "Early movers are already running these — the gap is adoption, not technology."
                }
              </p>
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_174652_8ac55ef7-3596-4dc4-909b-22e2fbdf0611.png"
                  alt="AI tutoring chat interface on a tablet"
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
                    {"1:1 AI tutoring"}
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
                      "Adaptive tutors that answer questions, explain mistakes, and adjust difficulty live."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_174654_ba6a4276-6f1a-44dc-944f-4317a0287cf9.jpeg"
                  alt="Automated essay grading dashboard"
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
                    {"Automated grading"}
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
                      "Essays, quizzes, and code assignments graded consistently, with rationale attached."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_174655_78e731df-b33c-4460-a5cb-ca8963e31df4.jpeg"
                  alt="Enrollment chatbot conversation on phone"
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
                    {"Admissions concierge"}
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
                      "AI agents pre-qualify, answer FAQs, and book campus tours without staff involvement."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_174910_338eacc7-902f-497d-a350-22166927372d.jpeg"
                  alt="Student retention risk dashboard"
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
                    {"Retention prediction"}
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
                      "Engagement signals flag which students need outreach before they disengage."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_174911_60186083-d5c4-480e-b02f-c1f8a9ab577c.png"
                  alt="Curriculum content generation tool"
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
                    {"Live curriculum generation"}
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
                      "Practice sets and lesson material regenerated from what's actually tripping students up."
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_174913_8c276f84-0c41-43d9-a69c-e85fec285f00.png"
                  alt="Student support chatbot at night"
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
                    {"24/7 student support"}
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
                      "Always-on help for homework questions, deadlines, and logistics."
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
                  " Five concrete starting points inside education automation, worth validating before you build. "
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
                  {"AI grading co-pilot for teachers"}
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
                    "Grades assignments in a teacher's own rubric and voice, then lets them approve or edit in seconds instead of hours."
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
                  {"Dropout early-warning system"}
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
                    "Combines attendance, LMS activity, and grades into one risk score institutions can act on weeks earlier."
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
                  {"Admissions AI concierge"}
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
                    "Handles inbound enrollment questions, tour scheduling, and application nudges across chat, SMS, and email."
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
                  {"Adaptive practice generator"}
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
                    "Turns a syllabus into an endless, personalized stream of practice questions targeted at each student's gaps."
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
                  {"Parent communication autopilot"}
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
                    "Auto-drafts progress updates and answers parent questions from real student data, in the school's tone."
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
                  {"Curriculum freshness engine"}
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
                    "Continuously rewrites lesson material based on where students actually struggle, term over term."
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
              {" Have an education AI idea?"}
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
