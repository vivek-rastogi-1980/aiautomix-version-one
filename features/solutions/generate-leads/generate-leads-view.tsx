"use client";

import { Fragment, type ChangeEvent, useEffect, useRef } from "react";
import Link from "next/link";
import { asStyle } from "@/lib/styles";
import { useMergedState } from "@/hooks/use-merged-state";
import { SiteNav } from "@/components/layout/site-nav";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    ::selection { background: #7C5CFF; color: #fff; }
    a { color: #8CA0FF; }
    a:hover { color: #B4C2FF; }
    input::placeholder, textarea::placeholder { color: #6E6C7C; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    @keyframes typeCursorBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
    @keyframes leadPulse { 0% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.4); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
    .reveal { opacity: 0; animation: riseIn 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
    [style*="cursor:pointer"], [style*="cursor: pointer"] { transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), filter 0.22s ease; }
    [style*="cursor:pointer"]:hover, [style*="cursor: pointer"]:hover { transform: scale(1.04); filter: brightness(1.06); }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
      @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
`;

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function usePageVals() {
  const [state, setState] = useMergedState({
    ideaText: "",
    typedIndex: 0,
    form: { name: "", email: "", idea: "" },
    nameError: "",
    emailError: "",
    submitted: false,
  });
  const fullTypedText =
    "Found 214 prospects matching your ICP this week — 38 scored as high-intent, routed to your team automatically...";
  const formNodeRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = (node: HTMLDivElement | null) => {
    formNodeRef.current = node;
  };
  const scrollToForm = () => {
    formNodeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useEffect(() => {
    const typeTimer = setInterval(() => {
      setState((s) => {
        const next = s.typedIndex + 1;
        if (next > fullTypedText.length) {
          return { typedIndex: 0 };
        }
        return { typedIndex: next };
      });
    }, 45);
    return () => clearInterval(typeTimer);
  }, [setState, fullTypedText]);

  const planSections = [
    {
      icon: "🔎",
      name: "Prospect Sourcing",
      desc: "Continuous discovery of prospects matching your ideal customer profile.",
      delay: "0s",
    },
    {
      icon: "🧮",
      name: "Lead Scoring",
      desc: "Every prospect ranked by fit and intent before it reaches your team.",
      delay: "0.1s",
    },
    {
      icon: "✉️",
      name: "Outreach Sequences",
      desc: "Personalized first-touch messaging sent automatically.",
      delay: "0.2s",
    },
    {
      icon: "📥",
      name: "CRM Routing",
      desc: "Qualified leads land directly in your CRM, tagged and assigned.",
      delay: "0.3s",
    },
    {
      icon: "⏱️",
      name: "Instant Follow-Up",
      desc: "Hot leads get a response in minutes, not days.",
      delay: "0.4s",
    },
    {
      icon: "📊",
      name: "Pipeline Reporting",
      desc: "A live view of source, stage, and conversion for every lead.",
      delay: "0.5s",
    },
  ];
  const barDefs = [
    { label: "Prospects Sourced", pct: 100 },
    { label: "Scored High-Intent", pct: 65 },
    { label: "Routed to CRM", pct: 40 },
    { label: "First Response Sent", pct: 25 },
  ];
  const buildBars = barDefs.map((b) => ({
    label: b.label,
    pct: b.pct,
    fillStyle: {
      height: "100%",
      width: b.pct + "%",
      borderRadius: "4px",
      background: "linear-gradient(90deg,#57F2A4,#57C7FF)",
    },
  }));
  const errorBorder = { border: "1px solid #FF6B6B" };
  const baseInput = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#F4F3F7",
    fontSize: "14.5px",
    outline: "none",
    fontFamily: "'Inter',sans-serif",
  };
  const fieldSetter =
    (field: keyof typeof state.form) => (e: ChangeEvent<FieldElement>) =>
      setState((s) => ({ form: { ...s.form, [field]: e.target.value } }));
  return {
    ideaText: state.ideaText,
    onIdeaChange: (e: ChangeEvent<FieldElement>) =>
      setState({ ideaText: e.target.value }),
    scrollToForm: scrollToForm,
    formSectionRef: formSectionRef,
    planSections,
    buildBars,
    typedText: fullTypedText.slice(0, state.typedIndex),
    typeCursorStyle: {
      animation: "typeCursorBlink 0.9s step-end infinite",
      color: "#57F2A4",
    },
    form: state.form,
    nameError: state.nameError,
    emailError: state.emailError,
    nameInputStyle: state.nameError
      ? { ...baseInput, ...errorBorder }
      : baseInput,
    emailInputStyle: state.emailError
      ? { ...baseInput, ...errorBorder }
      : baseInput,
    textareaStyle: {
      ...baseInput,
      minHeight: "90px",
      resize: "vertical",
      fontFamily: "inherit",
    },
    onField_name: fieldSetter("name"),
    onField_email: fieldSetter("email"),
    onField_idea: fieldSetter("idea"),
    submitted: state.submitted,
    submit: () => {
      const f = state.form;
      const nameErr = f.name.trim() ? "" : "Please enter your name.";
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
      const emailErr = f.email.trim()
        ? emailValid
          ? ""
          : "Please enter a valid email address."
        : "Please enter your email.";
      if (nameErr || emailErr) {
        setState({ nameError: nameErr, emailError: emailErr });
        return;
      }
      setState({ submitted: true, nameError: "", emailError: "" });
    },
  };
}

export function GenerateLeadsView() {
  const {
    ideaText,
    onIdeaChange,
    scrollToForm,
    formSectionRef,
    planSections,
    buildBars,
    typedText,
    typeCursorStyle,
    form,
    nameError,
    emailError,
    nameInputStyle,
    emailInputStyle,
    textareaStyle,
    onField_name,
    onField_email,
    onField_idea,
    submitted,
    submit,
  } = usePageVals();

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
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-15%",
              left: "15%",
              width: "900px",
              height: "600px",
              background:
                "radial-gradient(ellipse at center, rgba(87,242,164,0.18), transparent 65%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "1300px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1.05fr 0.95fr",
              gap: "64px",
              alignItems: "center",
              position: "relative",
              zIndex: "1",
            }}
          >
            <div>
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
                  marginBottom: "28px",
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
                {" Free to start · 24/7 lead sourcing "}
              </div>
              <h1
                className="reveal"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(38px,5vw,64px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0 0 24px",
                  animationDelay: "0.1s",
                }}
              >
                {" Generate leads"}
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(90deg,#57F2A4,#2FD8C4,#57C7FF)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {"while you sleep."}
                </span>
              </h1>
              <p
                className="reveal"
                style={{
                  fontSize: "17.5px",
                  color: "#ABA9B8",
                  maxWidth: "520px",
                  margin: "0 0 40px",
                  lineHeight: "1.6",
                  animationDelay: "0.2s",
                }}
              >
                {
                  " Automated sourcing and scoring fills your pipeline with qualified prospects — matched to your ideal customer profile, scored on fit, and routed to your team the moment they're ready. "
                }
              </p>
              <div
                className="reveal"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  flexWrap: "wrap",
                  animationDelay: "0.3s",
                }}
              >
                <input
                  value={ideaText}
                  onChange={onIdeaChange}
                  placeholder="Describe your business in one line…"
                  style={{
                    width: "340px",
                    maxWidth: "75vw",
                    padding: "16px 20px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#F4F3F7",
                    fontSize: "15px",
                    fontFamily: "'Inter',sans-serif",
                    outline: "none",
                  }}
                />
                <div
                  onClick={scrollToForm}
                  style={{
                    padding: "16px 26px",
                    borderRadius: "12px",
                    background:
                      "linear-gradient(90deg,#57F2A4,#2FD8C4,#57C7FF)",
                    color: "#0A0B0F",
                    fontSize: "15px",
                    fontWeight: "700",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {"Fill my pipeline →"}
                </div>
              </div>
            </div>
            <div
              className="reveal"
              style={{ position: "relative", animationDelay: "0.25s" }}
            >
              <div
                style={{
                  position: "relative",
                  borderRadius: "24px",
                  overflow: "hidden",
                  aspectRatio: "4/3",
                  boxShadow: "0 50px 100px -30px rgba(0,0,0,0.6)",
                  animation: "floatSlow 6s ease-in-out infinite",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_105318_2976d16e-b110-4326-8657-9fb68da36049.png"
                  alt="Sales pipeline filling with new leads"
                  style={{
                    position: "absolute",
                    inset: "0",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
        <div
          className="reveal"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "64px",
            flexWrap: "wrap",
            padding: "0 64px 100px",
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "34px",
                fontWeight: "700",
              }}
            >
              {"340%"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"More qualified leads"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "34px",
                fontWeight: "700",
              }}
            >
              {"4 min"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"Average response time"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "34px",
                fontWeight: "700",
              }}
            >
              {"90%"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"Lead scoring accuracy"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "34px",
                fontWeight: "700",
              }}
            >
              {"24/7"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"Always sourcing"}
            </div>
          </div>
        </div>
        <div style={{ padding: "100px 64px", background: "#0E0F16" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "72px" }}
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
                {"How it works"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(30px,3.8vw,52px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"Source, score, and route — automatically."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: "20px",
              }}
            >
              {planSections.map((sec, secIdx) => (
                <div
                  key={secIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    padding: "28px 24px",
                    animationDelay: "{{ sec.delay }}",
                  }}
                >
                  <div style={{ fontSize: "26px", marginBottom: "14px" }}>
                    {sec.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16.5px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {sec.name}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#8A87A0",
                      lineHeight: "1.5",
                      margin: "0",
                    }}
                  >
                    {sec.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "0.9fr 1.1fr",
              gap: "56px",
              alignItems: "center",
            }}
          >
            <div className="reveal">
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
                {"Watch it fill"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  lineHeight: "1.1",
                  letterSpacing: "-0.02em",
                  margin: "0 0 20px",
                }}
              >
                {"Your pipeline, filling in real time."}
              </h2>
              <p
                style={{
                  fontSize: "16px",
                  color: "#ABA9B8",
                  lineHeight: "1.65",
                  margin: "0",
                }}
              >
                {
                  " Every new prospect is scored against your ideal customer profile before it ever reaches a rep — so your team only spends time on leads worth the call. "
                }
              </p>
            </div>
            <div
              className="reveal"
              style={{
                background: "#111219",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "36px 40px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "10px",
                    height: "10px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: "0",
                      borderRadius: "50%",
                      background: "#57F2A4",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      inset: "0",
                      borderRadius: "50%",
                      background: "#57F2A4",
                      animation: "leadPulse 1.6s ease-out infinite",
                    }}
                  ></div>
                </div>
                <span style={{ fontSize: "13.5px", color: "#8A87A0" }}>
                  {"Sourcing: New Prospects"}
                </span>
              </div>
              <p
                style={{
                  fontSize: "15.5px",
                  lineHeight: "1.75",
                  color: "#D6D4E0",
                  margin: "0 0 24px",
                }}
              >
                <span>{typedText}</span>
                <span style={asStyle(typeCursorStyle)}>{"|"}</span>
              </p>
              {buildBars.map((bar, barIdx) => (
                <div key={barIdx} style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12.5px",
                      color: "#8A87A0",
                      marginBottom: "6px",
                    }}
                  >
                    <span>{bar.label}</span>
                    <span>
                      {bar.pct}
                      {"%"}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "5px",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={asStyle(bar.fillStyle)}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background: "#F4F1EA",
            color: "#0A0B0F",
          }}
        >
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "56px" }}
            >
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
                {"See it live"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.6vw,48px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"Every lead, scored and tracked."}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                position: "relative",
                borderRadius: "24px",
                overflow: "hidden",
                aspectRatio: "16/9",
                boxShadow: "0 40px 90px -30px rgba(10,11,15,0.35)",
              }}
            >
              <img
                src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_105320_599a5b4f-16c1-4db6-ab83-e95907aba418.png"
                alt="Lead generation dashboard with funnel charts"
                style={{
                  position: "absolute",
                  inset: "0",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
        <div
          ref={formSectionRef}
          style={{ padding: "120px 64px", background: "#0E0F16" }}
        >
          <div
            style={{ maxWidth: "560px", margin: "0 auto", textAlign: "center" }}
          >
            <div
              className="reveal"
              style={{
                fontSize: "14px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A87A0",
                marginBottom: "20px",
                fontWeight: "600",
              }}
            >
              {"Get started"}
            </div>
            <h2
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(26px,3.2vw,42px)",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                margin: "0 0 40px",
              }}
            >
              {"Fill your pipeline."}
            </h2>
            {submitted ? (
              <div
                className="reveal"
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "18px",
                  padding: "44px",
                }}
              >
                <div style={{ fontSize: "40px", marginBottom: "14px" }}>
                  {"✓"}
                </div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "22px",
                    fontWeight: "700",
                    margin: "0 0 10px",
                  }}
                >
                  {"Request received."}
                </h3>
                <p
                  style={{ fontSize: "14.5px", color: "#8A87A0", margin: "0" }}
                >
                  {"We'll reach out to "}
                  {form.email}
                  {" to set up lead sourcing."}
                </p>
              </div>
            ) : null}
            {!submitted ? (
              <div
                className="reveal"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  textAlign: "left",
                }}
              >
                <input
                  value={form.name}
                  onChange={onField_name}
                  placeholder="Full name"
                  style={asStyle(nameInputStyle)}
                />
                {nameError ? (
                  <p
                    style={{
                      margin: "-8px 0 0",
                      fontSize: "12.5px",
                      color: "#FF8A8A",
                    }}
                  >
                    {nameError}
                  </p>
                ) : null}
                <input
                  value={form.email}
                  onChange={onField_email}
                  placeholder="Work email"
                  style={asStyle(emailInputStyle)}
                />
                {emailError ? (
                  <p
                    style={{
                      margin: "-8px 0 0",
                      fontSize: "12.5px",
                      color: "#FF8A8A",
                    }}
                  >
                    {emailError}
                  </p>
                ) : null}
                <textarea
                  value={form.idea}
                  onChange={onField_idea}
                  placeholder="Who is your ideal customer?"
                  style={asStyle(textareaStyle)}
                ></textarea>
                <div
                  onClick={submit}
                  style={{
                    marginTop: "6px",
                    padding: "16px",
                    borderRadius: "10px",
                    background:
                      "linear-gradient(90deg,#57F2A4,#2FD8C4,#57C7FF)",
                    color: "#0A0B0F",
                    fontSize: "15px",
                    fontWeight: "700",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  {"Fill my pipeline →"}
                </div>
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#6E6C7C",
                    textAlign: "center",
                    margin: "8px 0 0",
                  }}
                >
                  {"Free to start. No credit card required."}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div
          style={{
            padding: "48px 64px",
            textAlign: "center",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: "14px",
              color: "#8A87A0",
              textDecoration: "none",
            }}
          >
            {"← Back to AIAutomix home"}
          </Link>
        </div>
      </div>
    </>
  );
}
