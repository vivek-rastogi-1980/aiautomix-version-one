"use client";

import { Fragment, type ChangeEvent } from "react";
import Link from "next/link";
import { asStyle } from "@/lib/styles";
import { submitLead } from "@/lib/leads/submit";
import { useMergedState } from "@/hooks/use-merged-state";
import { SiteNav } from "@/components/layout/site-nav";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    a { color: #8CA0FF; text-decoration: none; }
    a:hover { color: #B4C2FF; }
    input::placeholder, textarea::placeholder { color: #6E6C7C; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .reveal { opacity: 0; animation: riseIn 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function usePageVals() {
  const [state, setState] = useMergedState({
    // `website` is the honeypot — hidden from users, so a human leaves it empty
    // and a naive bot fills it.
    form: { name: "", email: "", company: "", message: "", website: "" },
    nameError: "",
    emailError: "",
    submitError: "",
    submitted: false,
  });

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
  const errorBorder = { ...baseInput, border: "1px solid #FF6B6B" };
  const fieldSetter =
    (field: keyof typeof state.form) => (e: ChangeEvent<FieldElement>) =>
      setState((s) => ({ form: { ...s.form, [field]: e.target.value } }));
  return {
    form: state.form,
    submitted: state.submitted,
    nameError: state.nameError,
    emailError: state.emailError,
    nameInputStyle: state.nameError ? errorBorder : baseInput,
    emailInputStyle: state.emailError ? errorBorder : baseInput,
    baseInputStyle: baseInput,
    textareaStyle: {
      ...baseInput,
      minHeight: "110px",
      resize: "vertical",
      fontFamily: "inherit",
    },
    onField_name: fieldSetter("name"),
    onField_email: fieldSetter("email"),
    onField_company: fieldSetter("company"),
    onField_message: fieldSetter("message"),
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
      // Was a `mailto:` handoff, which showed this success state whether or not
      // a mail client existed — so every visitor on mobile or webmail saw
      // "sent" while the message went nowhere. Now the confirmation is
      // provisional and reverts if the request genuinely fails.
      setState({
        submitted: true,
        nameError: "",
        emailError: "",
        submitError: "",
      });

      void submitLead(
        "contact",
        {
          name: f.name,
          email: f.email,
          company: f.company,
          message: f.message,
        },
        f.website,
      ).then((result) => {
        if (result.ok) return;
        setState({ submitted: false, submitError: result.message });
      });
    },
  };
}

export function ContactView() {
  const {
    form,
    submitted,
    nameError,
    emailError,
    nameInputStyle,
    emailInputStyle,
    baseInputStyle,
    textareaStyle,
    onField_name,
    onField_email,
    onField_company,
    onField_message,
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
          minHeight: "100vh",
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
              left: "50%",
              transform: "translateX(-50%)",
              width: "900px",
              height: "600px",
              background:
                "radial-gradient(ellipse at center, rgba(124,92,255,0.2), transparent 65%)",
              filter: "blur(45px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              position: "relative",
              zIndex: "1",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "64px",
              alignItems: "start",
            }}
          >
            <div>
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
                {"Get in touch"}
              </div>
              <h1
                className="reveal"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(32px,4.4vw,54px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em",
                  margin: "0 0 22px",
                  animationDelay: "0.08s",
                }}
              >
                {"Let's talk about your business."}
              </h1>
              <p
                className="reveal"
                style={{
                  fontSize: "16px",
                  color: "#ABA9B8",
                  lineHeight: "1.7",
                  margin: "0 0 36px",
                  animationDelay: "0.14s",
                }}
              >
                {
                  " Questions about validating an idea, a service, or a custom AI solution — we usually reply within 24 hours. "
                }
              </p>
              <div
                className="reveal"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  animationDelay: "0.2s",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12.5px",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#6E6C7C",
                      fontWeight: "600",
                      marginBottom: "6px",
                    }}
                  >
                    {"Email"}
                  </div>
                  <a
                    href="mailto:contact@aiautomix.com"
                    style={{ fontSize: "15px", color: "#F4F3F7" }}
                  >
                    {"contact@aiautomix.com"}
                  </a>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "12.5px",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#6E6C7C",
                      fontWeight: "600",
                      marginBottom: "6px",
                    }}
                  >
                    {"Follow us"}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <a
                      href="https://www.linkedin.com/company/aiautomix"
                      target="_blank"
                      rel="noopener"
                      style={{ fontSize: "14px", color: "#F4F3F7" }}
                    >
                      {"LinkedIn"}
                    </a>{" "}
                    <a
                      href="https://www.instagram.com/aiautomationmix"
                      target="_blank"
                      rel="noopener"
                      style={{ fontSize: "14px", color: "#F4F3F7" }}
                    >
                      {"Instagram"}
                    </a>{" "}
                    <a
                      href="https://www.youtube.com/@AIAutomix"
                      target="_blank"
                      rel="noopener"
                      style={{ fontSize: "14px", color: "#F4F3F7" }}
                    >
                      {"YouTube"}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="reveal"
              style={{
                background: "#111219",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "36px",
                animationDelay: "0.1s",
              }}
            >
              {submitted ? (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
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
                    {"Message sent."}
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "#8A87A0",
                      margin: "0",
                    }}
                  >
                    {"We'll get back to you at "}
                    {form.email}
                    {" within 24 hours."}
                  </p>
                </div>
              ) : null}
              {!submitted ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
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
                    placeholder="Email"
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
                  <input
                    value={form.company}
                    onChange={onField_company}
                    placeholder="Company (optional)"
                    style={asStyle(baseInputStyle)}
                  />
                  <textarea
                    value={form.message}
                    onChange={onField_message}
                    placeholder="How can we help?"
                    style={asStyle(textareaStyle)}
                  ></textarea>
                  <div
                    onClick={submit}
                    style={{
                      marginTop: "6px",
                      padding: "15px",
                      borderRadius: "10px",
                      background:
                        "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                      color: "#0A0B0F",
                      fontSize: "15px",
                      fontWeight: "700",
                      textAlign: "center",
                      cursor: "pointer",
                    }}
                  >
                    {"Send message →"}
                  </div>
                </div>
              ) : null}
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
