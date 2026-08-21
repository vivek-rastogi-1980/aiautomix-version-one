"use client";

import { Fragment, useRef } from "react";
import Link from "next/link";

import { submitIdea } from "@/lib/leads/submit-idea";
import { trackEvent } from "@/lib/analytics/events";
import { asStyle } from "@/lib/styles";
import { useMergedState } from "@/hooks/use-merged-state";
import { SiteNav } from "@/components/layout/site-nav";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- faithful re-host of the design's imperative animation controller; see MIGRATION-NOTES.md */

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    ::selection { background: #7C5CFF; color: #fff; }
    a { color: #8CA0FF; }
    a:hover { color: #B4C2FF; }
    input::placeholder, textarea::placeholder { color: #6E6C7C; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    .reveal { opacity: 0; animation: riseIn 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

const INITIAL_STATE = {
  ideaText: "",
  // `website` is the honeypot: never rendered, so a human always leaves it
  // empty and a naive bot fills it. Kept in form state so the existing field
  // setters work on it unchanged.
  form: { name: "", email: "", industry: "", idea: "", website: "" },
  nameError: "",
  emailError: "",
  submitted: false,
  submitError: "",
  submitMessage: "",
  faqOpenIdx: null as number | null,
};
type PageState = typeof INITIAL_STATE;

class ValidateYourIdeaController {
  [k: string]: any;
  state: any;
  setState: (u: any) => void;
  props: Record<string, any> = {};
  constructor(state: PageState, setState: (u: any) => void) {
    this.state = state;
    this.setState = setState;
  }
  formSectionRef: any = (node?: any) => {
    this._formNode = node;
  };
  scrollToForm: any = () => {
    if (this._formNode)
      this._formNode.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  renderVals() {
    const gradient =
      "linear-gradient(90deg, #57C7FF 0%, #7C5CFF 60%, #C86CFF 100%)";
    const agentDefs = [
      {
        icon: "📊",
        name: "Market",
        desc: "Sizes your total and reachable market with cited, real-world data.",
        delay: "0s",
      },
      {
        icon: "⚔️",
        name: "Competition",
        desc: "Maps direct and indirect competitors, pricing, and gaps.",
        delay: "0.1s",
      },
      {
        icon: "🛠️",
        name: "Feasibility & Cost",
        desc: "Estimates what it actually takes to build and run this.",
        delay: "0.2s",
      },
      {
        icon: "💰",
        name: "Revenue",
        desc: "Models realistic pricing and revenue scenarios.",
        delay: "0.3s",
      },
      {
        icon: "🧭",
        name: "Synthesis",
        desc: "Weighs every agent's findings into one honest verdict.",
        delay: "0.4s",
      },
    ];
    const scoreDefs = [
      { label: "Market opportunity", score: 16, max: 20, color: "#57C7FF" },
      { label: "Competitive landscape", score: 13, max: 20, color: "#7C5CFF" },
      { label: "Feasibility & cost", score: 15, max: 20, color: "#57F2A4" },
      { label: "Revenue potential", score: 14, max: 20, color: "#C86CFF" },
      { label: "Overall confidence", score: 14, max: 20, color: "#F2C957" },
    ];
    const scoreRows = scoreDefs.map((r: any) => ({
      label: r.label,
      score: r.score,
      max: r.max,
      barStyle: {
        height: "100%",
        width: (r.score / r.max) * 100 + "%",
        borderRadius: "4px",
        background: r.color,
      },
    }));
    const industryOptions = [
      "Restaurant",
      "Hospital",
      "Education",
      "Real Estate",
      "Travel",
      "Gym & Fitness",
      "Retail",
      "SaaS",
      "E-commerce",
      "Professional Services",
    ];
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
    const fieldSetter = (field?: any) => (e?: any) =>
      this.setState((s: any) => ({
        form: { ...s.form, [field]: e.target.value },
      }));
    const agentDetailDefs = [
      {
        name: "Market",
        accent: "#57C7FF",
        whatItDoes:
          "Sizes your total addressable market, the realistically reachable segment, and near-term obtainable share using cited industry reports and real data sources — not a guessed number.",
        whyItMatters:
          "A great product in a market too small to sustain a business fails for a reason that has nothing to do with execution. Knowing the real ceiling before you build prevents months wasted chasing a market that can't support you.",
        result:
          "TAM / SAM / SOM figures with growth rate and cited sources, plus a plain-language read on whether the market is big enough to matter.",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_122755_abbb3553-9720-477e-8937-fc611d1d2efc.png",
      },
      {
        name: "Competition",
        accent: "#7C5CFF",
        whatItDoes:
          "Maps the direct and indirect players already serving this space, their pricing, positioning, and the gaps they're leaving open.",
        whyItMatters:
          "Most ideas aren't original — they're a variation on something that already exists. Understanding who you're really up against, and where they're weak, is what turns 'nice idea' into a defensible plan.",
        result:
          "A competitor landscape with pricing comparisons, market gaps, and a clear-eyed view of what differentiation is actually available to you.",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_122757_9549f613-440f-47c0-a964-0503a1985f56.png",
      },
      {
        name: "Feasibility & Cost",
        accent: "#57F2A4",
        whatItDoes:
          "Estimates what it actually takes to build, launch, and run this — team, tooling, infrastructure, and realistic timelines.",
        whyItMatters:
          "An idea can be validated by the market and still be the wrong bet if it costs far more to build than you can fund. This agent keeps ambition grounded in what's actually executable with your resources.",
        result:
          "A cost and build-time estimate broken down by phase, with the biggest feasibility risks flagged before you commit capital.",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_122800_f41a3919-8428-47a2-b046-4b8df5432597.png",
      },
      {
        name: "Revenue",
        accent: "#C86CFF",
        whatItDoes:
          "Models realistic pricing and revenue scenarios based on comparable products, target customer willingness to pay, and market data.",
        whyItMatters:
          "'People will pay for this' is the assumption that sinks the most startups. Modeling actual revenue scenarios up front tells you whether the business math works before you've spent a dollar building it.",
        result:
          "Pricing recommendations with conservative, expected, and optimistic revenue projections over the first 12-24 months.",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_122801_f11fc6a5-49af-4418-b5fc-88d845b9efe4.png",
      },
      {
        name: "Synthesis",
        accent: "#F2C957",
        whatItDoes:
          "Weighs every other agent's findings against each other, resolves the tensions between them, and produces one honest, weighted verdict.",
        whyItMatters:
          "Five separate reports are just more data to get lost in. This agent is what turns raw findings into an actual decision you can act on — including naming the single biggest risk to fix first.",
        result:
          "A single validation score out of 100, a plain-language verdict, and the top risk standing between your idea and a strong launch.",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_122859_2296ea24-cf3c-4a85-ad39-7b00bea63152.png",
      },
    ];
    const agentDetails = agentDetailDefs.map((a?: any, i?: any) => ({
      ...a,
      num: i + 1,
      slotId: "agent-detail-" + i,
      sectionStyle: {
        padding: "100px 64px",
        background: i % 2 === 0 ? "#0A0B0F" : "rgb(251, 235, 216)",
        color: i % 2 === 0 ? "#F4F3F7" : "#1C160E",
      },
      textColStyle: { order: i % 2 === 0 ? 0 : 1 },
      imgColStyle: {
        order: i % 2 === 0 ? 1 : 0,
        borderRadius: "20px",
        overflow: "hidden",
        aspectRatio: "4/3",
        border:
          i % 2 === 0
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(28,22,14,0.1)",
      },
      labelColor: i % 2 === 0 ? "#B4B2C0" : "#5C5847",
      headingColor: i % 2 === 0 ? "#F4F3F7" : "#1C160E",
      bodyColor: i % 2 === 0 ? "#B4B2C0" : "#5C5847",
      strongColor: i % 2 === 0 ? "#F4F3F7" : "#1C160E",
      resultCardStyle: {
        background: i % 2 === 0 ? "#111219" : "#FFFFFF",
        border:
          i % 2 === 0
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(28,22,14,0.08)",
        borderRadius: "14px",
        padding: "20px 22px",
        animationDelay: "0.15s",
      },
      resultTextColor: i % 2 === 0 ? "#D6D4E0" : "#3A3226",
    }));
    const glassCardStyle = {
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "28px",
      padding: "48px 44px",
      boxShadow: "0 30px 80px -30px rgba(0,0,0,0.5)",
    };
    const benefitDefs = [
      "Validate before investing",
      "Reduce startup risk",
      "Save months of research",
      "Make data-driven decisions",
      "Identify hidden opportunities",
      "Understand competitors",
      "Estimate realistic revenue",
      "Receive actionable recommendations",
      "Build investor confidence",
      "Launch with clarity",
    ];
    const benefits = benefitDefs.map((text: any) => ({
      text,
      cardStyle: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "20px 22px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px",
      },
    }));
    const faqDefs = [
      {
        q: "Can AI accurately validate my business idea?",
        a: "Our multi-agent AI analyzes market demand, competition, financial feasibility, industry trends, and potential risks using structured business intelligence. While no tool can guarantee success, it provides data-driven insights to help you make informed decisions.",
      },
      {
        q: "What industries do you support?",
        a: "We support startups and businesses across SaaS, e-commerce, healthcare, education, retail, real estate, manufacturing, professional services, and many more.",
      },
      {
        q: "How long does validation take?",
        a: "Most business ideas are analyzed within minutes, allowing you to receive actionable insights much faster than traditional consulting.",
      },
      {
        q: "Will I receive a downloadable report?",
        a: "Yes. You'll receive a comprehensive report covering market analysis, competition, feasibility, revenue projections, risk assessment, and strategic recommendations.",
      },
      {
        q: "Can I validate multiple ideas?",
        a: "Absolutely. You can validate as many ideas as you like and compare the results to identify the strongest opportunity.",
      },
      {
        q: "Is my business idea secure?",
        a: "Yes. Your information is handled securely, and your idea remains confidential throughout the validation process.",
      },
    ];
    const faqs = faqDefs.map((f?: any, i?: any) => ({
      q: f.q,
      a: f.a,
      isOpen: this.state.faqOpenIdx === i,
      toggleSymbol: this.state.faqOpenIdx === i ? "−" : "+",
      onClick: () =>
        this.setState((s: any) => ({
          faqOpenIdx: s.faqOpenIdx === i ? null : i,
        })),
    }));
    return {
      ideaText: this.state.ideaText,
      agentDetails,
      glassCardStyle,
      benefits,
      faqs,
      onIdeaChange: (e?: any) => this.setState({ ideaText: e.target.value }),
      scrollToForm: this.scrollToForm,
      formSectionRef: this.formSectionRef,
      agentDefs,
      scoreRows,
      industryOptions,
      form: this.state.form,
      nameError: this.state.nameError,
      emailError: this.state.emailError,
      nameInputStyle: this.state.nameError
        ? { ...baseInput, ...errorBorder }
        : baseInput,
      emailInputStyle: this.state.emailError
        ? { ...baseInput, ...errorBorder }
        : baseInput,
      selectStyle: { ...baseInput, appearance: "none", cursor: "pointer" },
      textareaStyle: {
        ...baseInput,
        minHeight: "90px",
        resize: "vertical",
        fontFamily: "inherit",
      },
      onField_name: fieldSetter("name"),
      onField_email: fieldSetter("email"),
      onField_industry: fieldSetter("industry"),
      onField_idea: fieldSetter("idea"),
      submitted: this.state.submitted,
      submitError: this.state.submitError,
      submitMessage: this.state.submitMessage,
      submit: () => {
        const f = this.state.form;
        const nameErr = f.name.trim() ? "" : "Please enter your name.";
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
        const emailErr = f.email.trim()
          ? emailValid
            ? ""
            : "Please enter a valid email address."
          : "Please enter your email.";
        const ideaErr = f.idea.trim().length >= 10;
        if (nameErr || emailErr || !ideaErr) {
          this.setState({
            nameError: nameErr,
            emailError: emailErr,
            submitError: ideaErr
              ? ""
              : "Please describe your idea in a little more detail.",
          });
          return;
        }

        // Optimistic: the confirmation shows immediately, then the submission
        // is persisted. Until this was wired the handler stopped HERE — it set
        // `submitted` and sent nothing, so every visitor saw "Your validation
        // is running" and their idea was discarded. The success state is now
        // provisional and is corrected if the request actually fails.
        this.setState({
          submitted: true,
          nameError: "",
          emailError: "",
          submitError: "",
        });

        void submitIdea(
          {
            name: f.name,
            email: f.email,
            industry: f.industry,
            idea: f.idea,
          },
          f.website,
        ).then((result) => {
          if (result.ok) {
            // Fired on confirmed persistence rather than on click: an event
            // counting attempts instead of captured leads overstates the
            // conversion rate. Carries no field values.
            trackEvent("idea_validator_started", {
              source: "validate-your-idea-page",
            });
            this.setState({ submitMessage: result.message });
            return;
          }
          // Reopen the form with the error rather than leaving the visitor
          // believing a lost submission was received.
          this.setState({
            submitted: false,
            submitError: result.message,
          });
        });
      },
    };
  }
}
function usePageVals() {
  const [state, setState] = useMergedState<PageState>(INITIAL_STATE);
  const ref = useRef<ValidateYourIdeaController | null>(null);
  if (!ref.current)
    ref.current = new ValidateYourIdeaController(state, setState);
  const ctrl = ref.current;
  ctrl.state = state;
  ctrl.setState = setState;
  return ctrl.renderVals();
}

export function ValidateYourIdeaView() {
  const {
    ideaText,
    agentDetails,
    glassCardStyle,
    benefits,
    faqs,
    onIdeaChange,
    scrollToForm,
    formSectionRef,
    scoreRows,
    industryOptions,
    form,
    nameError,
    emailError,
    nameInputStyle,
    emailInputStyle,
    selectStyle,
    textareaStyle,
    onField_name,
    onField_email,
    onField_industry,
    onField_idea,
    submitted,
    submitError,
    submitMessage,
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
            padding: "140px 64px 100px",
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
            {" Free score · No credit card "}
          </div>
          <h1
            className="reveal"
            style={{
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: "700",
              fontSize: "clamp(40px,6vw,88px)",
              lineHeight: "1.02",
              letterSpacing: "-0.03em",
              margin: "0 0 28px",
              position: "relative",
              zIndex: "2",
              animationDelay: "0.1s",
            }}
          >
            {" Validate your business idea"}
            <br />
            <span
              style={{
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {"before you build it."}
            </span>
          </h1>
          <p
            className="reveal"
            style={{
              fontSize: "18px",
              color: "#ABA9B8",
              maxWidth: "600px",
              margin: "0 auto 44px",
              lineHeight: "1.6",
              position: "relative",
              zIndex: "2",
              animationDelay: "0.2s",
            }}
          >
            {
              " Five specialist AI agents pressure-test your idea against real market data — and hand back one honest, citation-backed verdict in minutes. "
            }
          </p>
          <div
            className="reveal"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              flexWrap: "wrap",
              position: "relative",
              zIndex: "2",
              animationDelay: "0.3s",
            }}
          >
            <input
              value={ideaText}
              onChange={onIdeaChange}
              placeholder="Describe your business idea in one line…"
              style={{
                width: "400px",
                maxWidth: "80vw",
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
                padding: "16px 28px",
                borderRadius: "12px",
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                color: "#0A0B0F",
                fontSize: "15px",
                fontWeight: "700",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {"Get my free score →"}
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
            animationDelay: "0.35s",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "36px",
                fontWeight: "700",
              }}
            >
              {"9/10"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"startups fail without validation"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "36px",
                fontWeight: "700",
              }}
            >
              {"5"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"specialist agents per report"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "36px",
                fontWeight: "700",
              }}
            >
              {"<5 min"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"to your first score"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "36px",
                fontWeight: "700",
              }}
            >
              {"100%"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"citation-backed findings"}
            </div>
          </div>
        </div>
        {agentDetails.map((ad?: any, adIdx?: any) => (
          <div key={adIdx} style={asStyle(ad.sectionStyle)}>
            <div
              style={{
                maxWidth: "1200px",
                margin: "0 auto",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "64px",
                alignItems: "center",
              }}
            >
              <div style={asStyle(ad.textColStyle)}>
                <div
                  className="reveal"
                  style={{
                    fontSize: "14px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "{{ ad.accent }}",
                    marginBottom: "16px",
                    fontWeight: "700",
                  }}
                >
                  {"Agent "}
                  {ad.num}
                  {" of 5"}
                </div>
                <h2
                  className="reveal"
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "800",
                    fontSize: "clamp(28px,3.4vw,42px)",
                    lineHeight: "1.12",
                    letterSpacing: "-0.02em",
                    margin: "0 0 20px",
                  }}
                >
                  {ad.name}
                  {" Agent"}
                </h2>
                <p
                  className="reveal"
                  style={{
                    fontSize: "15px",
                    color: "{{ ad.bodyColor }}",
                    lineHeight: "1.7",
                    margin: "0 0 22px",
                    animationDelay: "0.05s",
                  }}
                >
                  <strong style={{ color: "{{ ad.strongColor }}" }}>
                    {"What it does:"}
                  </strong>{" "}
                  {ad.whatItDoes}
                </p>
                <p
                  className="reveal"
                  style={{
                    fontSize: "15px",
                    color: "{{ ad.bodyColor }}",
                    lineHeight: "1.7",
                    margin: "0 0 22px",
                    animationDelay: "0.1s",
                  }}
                >
                  <strong style={{ color: "{{ ad.strongColor }}" }}>
                    {"Why it matters:"}
                  </strong>{" "}
                  {ad.whyItMatters}
                </p>
                <div className="reveal" style={asStyle(ad.resultCardStyle)}>
                  <div
                    style={{
                      fontSize: "11.5px",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "{{ ad.accent }}",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {"What it produces"}
                  </div>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "{{ ad.resultTextColor }}",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {ad.result}
                  </p>
                </div>
              </div>
              <div className="reveal" style={asStyle(ad.imgColStyle)}>
                <img
                  src={ad.imgSrc}
                  alt={`${ad.name} agent illustration`}
                  style={{
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
        ))}
        <div style={{ padding: "120px 64px" }}>
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
                  color: "#8A87A0",
                  marginBottom: "20px",
                  fontWeight: "600",
                }}
              >
                {"What you get"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(30px,3.6vw,48px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"A report you can actually defend."}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                display: "grid",
                gridTemplateColumns: "0.9fr 1.1fr",
                gap: "0",
                borderRadius: "24px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#111219",
              }}
            >
              <div
                style={{
                  padding: "48px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: "1px solid rgba(255,255,255,0.08)",
                  background:
                    "radial-gradient(circle at 50% 30%, rgba(124,92,255,0.12), transparent 60%)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "56px",
                    fontWeight: "700",
                  }}
                >
                  {"72"}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#8A87A0",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {"Validation score"}
                </div>
                <div
                  style={{
                    marginTop: "22px",
                    fontSize: "14px",
                    color: "#57F2A4",
                    fontWeight: "600",
                  }}
                >
                  {"Promising — one risk to fix first"}
                </div>
              </div>
              <div style={{ padding: "40px 48px" }}>
                {scoreRows.map((row?: any, rowIdx?: any) => (
                  <div key={rowIdx} style={{ marginBottom: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        marginBottom: "8px",
                      }}
                    >
                      <span style={{ color: "#D6D4E0" }}>{row.label}</span>{" "}
                      <span style={{ color: "#F4F3F7", fontWeight: "600" }}>
                        {row.score}
                        {"/"}
                        {row.max}
                      </span>
                    </div>
                    <div
                      style={{
                        height: "6px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={asStyle(row.barStyle)}></div>
                    </div>
                  </div>
                ))}
              </div>
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
                fontSize: "clamp(28px,3.4vw,44px)",
                lineHeight: "1.08",
                letterSpacing: "-0.02em",
                margin: "0 0 40px",
              }}
            >
              {"Get your free score."}
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
                  {"Your validation is running."}
                </h3>
                <p
                  style={{ fontSize: "14.5px", color: "#8A87A0", margin: "0" }}
                >
                  {submitMessage
                    ? submitMessage
                    : "We're saving your idea — one moment."}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#6E6B85",
                    margin: "10px 0 0",
                  }}
                >
                  {"Sent to "}
                  {form.email}
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
                <select
                  value={form.industry}
                  onChange={onField_industry}
                  style={asStyle(selectStyle)}
                >
                  <option value="" style={{ background: "#1A1B24" }}>
                    {"Select your industry…"}
                  </option>
                  {industryOptions.map((ind?: any, indIdx?: any) => (
                    <option
                      key={indIdx}
                      value={ind}
                      style={{ background: "#1A1B24" }}
                    >
                      {ind}
                    </option>
                  ))}
                </select>
                <textarea
                  value={form.idea}
                  onChange={onField_idea}
                  placeholder="Describe your business idea…"
                  style={asStyle(textareaStyle)}
                ></textarea>
                <div
                  onClick={submit}
                  style={{
                    marginTop: "6px",
                    padding: "16px",
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
                  {"Get my free score →"}
                </div>
                {submitError ? (
                  <p
                    role="alert"
                    style={{
                      fontSize: "13.5px",
                      color: "#FF8B8B",
                      margin: "10px 0 0",
                    }}
                  >
                    {submitError}
                  </p>
                ) : null}
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#6E6C7C",
                    textAlign: "center",
                    margin: "8px 0 0",
                  }}
                >
                  {"No credit card. One free score per email."}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(180deg,#0A0B0F 0%,#12143A 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-10%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "900px",
              height: "600px",
              background:
                "radial-gradient(ellipse at center, rgba(124,92,255,0.2), transparent 65%)",
              filter: "blur(50px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto",
              textAlign: "center",
              position: "relative",
              zIndex: "1",
            }}
          >
            <div className="reveal" style={asStyle(glassCardStyle)}>
              <div
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8CA0FF",
                  marginBottom: "20px",
                  fontWeight: "700",
                }}
              >
                {"Human + AI"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(24px,2.8vw,36px)",
                  lineHeight: "1.35",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {
                  " Exactly! The best results come when AI and people work together. AI handles repetitive tasks, while people bring creativity, strategy, and human connection. "
                }
              </h2>
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "64px" }}
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
                {"Why validate first"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"What you gain by validating before you build."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: "20px",
              }}
            >
              {benefits.map((b?: any, bIdx?: any) => (
                <div key={bIdx} className="reveal" style={asStyle(b.cardStyle)}>
                  <span
                    style={{
                      color: "#57F2A4",
                      fontSize: "16px",
                      flexShrink: "0",
                    }}
                  >
                    {"✓"}
                  </span>{" "}
                  <span
                    style={{
                      fontSize: "14.5px",
                      color: "#D6D4E0",
                      fontWeight: "500",
                    }}
                  >
                    {b.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0E0F16" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "56px" }}
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
                {"FAQ"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Frequently Asked Questions"}
              </h2>
            </div>
            {faqs.map((faq?: any, faqIdx?: any) => (
              <div
                key={faqIdx}
                className="reveal"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  padding: "22px 0",
                  cursor: "pointer",
                }}
                onClick={faq.onClick}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <span style={{ fontSize: "15.5px", fontWeight: "600" }}>
                    {faq.q}
                  </span>{" "}
                  <span
                    style={{
                      fontSize: "19px",
                      color: "#8A87A0",
                      flexShrink: "0",
                    }}
                  >
                    {faq.toggleSymbol}
                  </span>
                </div>
                {faq.isOpen ? (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.7",
                      margin: "14px 0 0",
                    }}
                  >
                    {faq.a}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            padding: "140px 64px",
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(180deg,#0A0B0F 0%,#12143A 100%)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "0",
              left: "50%",
              transform: "translateX(-50%)",
              width: "800px",
              height: "500px",
              background:
                "radial-gradient(ellipse at center, rgba(87,199,255,0.18), transparent 65%)",
              filter: "blur(45px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            className="reveal"
            style={{
              maxWidth: "640px",
              margin: "0 auto",
              position: "relative",
              zIndex: "1",
            }}
          >
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(30px,3.8vw,50px)",
                lineHeight: "1.12",
                letterSpacing: "-0.02em",
                margin: "0 0 20px",
              }}
            >
              {"Ready to Validate Your Next Big Idea?"}
            </h2>
            <p
              style={{ fontSize: "16px", color: "#ABA9B8", margin: "0 0 8px" }}
            >
              {"Don't spend months building the wrong business."}
            </p>
            <p
              style={{ fontSize: "16px", color: "#ABA9B8", margin: "0 0 36px" }}
            >
              {"Let AI analyze your idea before you invest."}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div
                onClick={scrollToForm}
                style={{
                  padding: "17px 30px",
                  borderRadius: "12px",
                  background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  color: "#0A0B0F",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                {"Validate My Business Idea"}
              </div>
              <div
                onClick={scrollToForm}
                style={{
                  padding: "17px 30px",
                  borderRadius: "12px",
                  background: "transparent",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  color: "#F4F3F7",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {"Talk to an AI Business Advisor"}
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "64px",
            background: "#0A0B0F",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              gap: "14px 28px",
              justifyContent: "center",
            }}
          >
            <Link
              href="/create-a-business-plan"
              style={{ fontSize: "13.5px", color: "#8A87A0" }}
            >
              {"Business Plan Generator"}
            </Link>{" "}
            <Link
              href="/ai-strategies-and-consulting"
              style={{ fontSize: "13.5px", color: "#8A87A0" }}
            >
              {"AI Market Research"}
            </Link>{" "}
            <Link
              href="/ai-agents"
              style={{ fontSize: "13.5px", color: "#8A87A0" }}
            >
              {"AI Workflow Automation"}
            </Link>{" "}
            <Link
              href="/ai-strategies-and-consulting"
              style={{ fontSize: "13.5px", color: "#8A87A0" }}
            >
              {"AI Consulting"}
            </Link>{" "}
            <Link
              href="/services"
              style={{ fontSize: "13.5px", color: "#8A87A0" }}
            >
              {"Website Development"}
            </Link>{" "}
            <Link href="/crm" style={{ fontSize: "13.5px", color: "#8A87A0" }}>
              {"CRM Automation"}
            </Link>{" "}
            <Link
              href="/generate-leads"
              style={{ fontSize: "13.5px", color: "#8A87A0" }}
            >
              {"Lead Generation"}
            </Link>{" "}
            <Link
              href="/ai-chatbot"
              style={{ fontSize: "13.5px", color: "#8A87A0" }}
            >
              {"AI Voice Agent"}
            </Link>{" "}
            <Link href="/" style={{ fontSize: "13.5px", color: "#8A87A0" }}>
              {"Contact Us"}
            </Link>
          </div>
        </div>
        <div style={{ padding: "60px 64px 40px", textAlign: "center" }}>
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
