"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";
import { asStyle } from "@/lib/styles";
import { useMergedState } from "@/hooks/use-merged-state";
import { SiteNav } from "@/components/layout/site-nav";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- faithful re-host of the design's imperative animation controller; see MIGRATION-NOTES.md */

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    ::selection { background: #7C5CFF; color: #fff; }
    a { color: #8CA0FF; text-decoration: none; }
    a:hover { color: #B4C2FF; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes stepFlash { 0%,7% { transform: translateX(-140%) skewX(-20deg); opacity: 0; } 3% { opacity: 1; } 6% { transform: translateX(140%) skewX(-20deg); opacity: 0; } 100% { transform: translateX(140%) skewX(-20deg); opacity: 0; } }
    .reveal { opacity: 0; animation: riseIn 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

const INITIAL_STATE = {
  faqOpenIdx: null as number | null,
  validateModalOpen: false,
  validateSubmitted: false,
  validateForm: { name: "", email: "", industry: "", idea: "" },
  validateNameError: "",
  validateEmailError: "",
  viewportWidth: typeof window !== "undefined" ? window.innerWidth : 1400,
  activeAgentIndex: 0,
  mutedMap: {} as Record<string, any>,
  spinningRestart: null as number | null,
};
type PageState = typeof INITIAL_STATE;

class AiBusinessIdeaValidationController {
  [k: string]: any;
  state: any;
  setState: (u: any) => void;
  props: Record<string, any> = {};
  constructor(state: PageState, setState: (u: any) => void) {
    this.state = state;
    this.setState = setState;
  }
  reportRef: any = (n?: any) => {
    this._reportNode = n;
  };
  scrollToReport: any = () => {
    if (this._reportNode)
      this._reportNode.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  goValidate: any = () => {
    window.location.href = "/validate-your-idea";
  };
  componentDidMount() {
    this._onResize = () => this.setState({ viewportWidth: window.innerWidth });
    window.addEventListener("resize", this._onResize);
    this._startAgentTimer();
  }
  componentWillUnmount() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._agentTimer) clearInterval(this._agentTimer);
    if (this._carouselObserver) this._carouselObserver.disconnect();
  }
  carouselSectionRef: any = (node?: any) => {
    if (!node || this._carouselObserver) return;
    this._carouselObserver = new IntersectionObserver(
      (entries?: any) => {
        if (!entries[0].isIntersecting) {
          this.setState({ mutedMap: {} });
          this._startAgentTimer(true);
        }
      },
      { threshold: 0.15 },
    );
    this._carouselObserver.observe(node);
  };
  _startAgentTimer(enable?: any) {
    if (this._agentTimer) clearInterval(this._agentTimer);
    if (enable === false) return;
    this._agentTimer = setInterval(() => {
      this.setState((s: any) => ({
        activeAgentIndex: (s.activeAgentIndex + 1) % 5,
        mutedMap: {},
      }));
    }, 12000);
  }
  getVideoRef(i?: any, videoSrc?: any, initialMuted?: any) {
    if (!this._videoRefFns) this._videoRefFns = {};
    if (!this._videoRefFns[i]) {
      this._videoRefFns[i] = (node?: any) => {
        if (node && node.getAttribute("src") !== videoSrc) {
          node.src = videoSrc;
          node.muted = initialMuted;
          node.loop = true;
          node.preload = "metadata";
        }
      };
    }
    return this._videoRefFns[i];
  }
  renderVals() {
    const gradient =
      "linear-gradient(90deg, #57C7FF 0%, #7C5CFF 60%, #C86CFF 100%)";
    const agentRoleDefs = [
      {
        tag: "Market Agent",
        isVideo: true,
        videoSrc: "./assets/market-agent.mp4",
      },
      {
        tag: "Competition Agent",
        isVideo: true,
        videoSrc: "./assets/competition-agent.mp4",
      },
      {
        tag: "Feasibility & Cost Agent",
        isVideo: true,
        videoSrc: "./assets/feasibility-agent.mp4",
      },
      {
        tag: "Revenue Agent",
        isVideo: true,
        videoSrc: "./assets/revenue-agent.mp4",
      },
      {
        tag: "Synthesis Agent",
        isVideo: true,
        videoSrc: "./assets/synthesis-agent.mp4",
      },
    ];
    const active = this.state.activeAgentIndex;
    const n = agentRoleDefs.length;
    const vw = this.state.viewportWidth;
    const stageMainW = Math.min(vw - 340, 980);
    const stageMainH = stageMainW * (788 / 1576);
    const carouselStageStyle = {
      position: "relative",
      width: "100%",
      height: stageMainH + "px",
      overflow: "visible",
      marginTop: "48px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    };
    const pauseAgentTimer = () => {
      if (this._agentTimer) clearInterval(this._agentTimer);
    };
    const resumeAgentTimer = () => this._startAgentTimer();
    const toggleMuteFor = (idx?: any) => () => {
      this.setState((s: any) => {
        const nowMuted = s.mutedMap[idx] === false ? true : false;
        if (!nowMuted) {
          this._startAgentTimer(false);
          const node = document.getElementById(
            "agent-video-0" + (idx + 1),
          ) as any;
          if (node) {
            node.currentTime = 0;
            node.play();
          }
        } else {
          this._startAgentTimer(true);
        }
        return { mutedMap: { ...s.mutedMap, [idx]: nowMuted } };
      });
    };
    const onVideoEnded = (idx?: any) => () => {
      if (this.state.mutedMap[idx] === false) {
        const nextIdx = (idx + 1) % n;
        this.setState({
          activeAgentIndex: nextIdx,
          mutedMap: { [nextIdx]: false },
        });
        this._startAgentTimer(false);
        requestAnimationFrame(() => {
          const node = document.getElementById(
            "agent-video-0" + (nextIdx + 1),
          ) as any;
          if (node) {
            node.currentTime = 0;
            node.muted = true;
            node.play();
          }
        });
      }
    };
    const muteBtnStyle = {
      position: "absolute",
      bottom: "16px",
      right: "16px",
      zIndex: 4,
      width: "38px",
      height: "38px",
      borderRadius: "50%",
      background: "rgba(15,16,24,0.7)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(255,255,255,0.16)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    };
    const restartBtnStyle = {
      position: "absolute",
      bottom: "16px",
      right: "64px",
      zIndex: 4,
      width: "38px",
      height: "38px",
      borderRadius: "50%",
      background: "rgba(15,16,24,0.7)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(255,255,255,0.16)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "transform 0.2s ease, background 0.2s ease",
    };
    const goToAgent = (i?: any) => {
      this._startAgentTimer(true);
      this.setState({ activeAgentIndex: ((i % n) + n) % n, mutedMap: {} });
    };
    const carouselDotsStyle = {
      display: "flex",
      justifyContent: "center",
      gap: "8px",
      marginTop: "32px",
      position: "relative",
      zIndex: 1,
    };
    const agentCarouselCards = agentRoleDefs.map((a?: any, i?: any) => {
      let rel = i - active;
      if (rel > n / 2) rel -= n;
      if (rel < -n / 2) rel += n;
      const mainW = stageMainW;
      const mainH = mainW * (788 / 1576);
      const sideOffset = mainW * 0.62;
      const isMain = rel === 0;
      const within = Math.abs(rel) <= 1;
      const scale = isMain ? 1 : 0.8;
      const opacity = isMain ? 1 : within ? 0.45 : 0;
      const zIndex = isMain ? 3 : 2 - Math.abs(rel);
      const rotate = isMain ? 0 : rel > 0 ? 6 : -6;
      return {
        tag: a.tag,
        isVideo: true,
        videoSrc: a.videoSrc,
        videoRef: this.getVideoRef(
          i,
          a.videoSrc,
          this.state.mutedMap[i] === false ? false : true,
        ),
        isMain,
        isMuted: this.state.mutedMap[i] === false ? false : true,
        toggleMute: toggleMuteFor(i),
        onVideoEnded: onVideoEnded(i),
        restartBtnStyle,
        restartIconStyle:
          this.state.spinningRestart === i
            ? {
                transform: "rotate(-360deg)",
                transition: "transform 0.5s ease",
              }
            : { transform: "rotate(0deg)" },
        restartVideo: () => {
          const node = document.getElementById(
            "agent-video-0" + (i + 1),
          ) as any;
          if (node) {
            node.currentTime = 0;
            node.play();
          }
          this.setState({ spinningRestart: i });
          setTimeout(
            () =>
              this.setState((s: any) =>
                s.spinningRestart === i ? { spinningRestart: null } : null,
              ),
            520,
          );
        },
        number: "0" + (i + 1),
        slotStyle: {
          position: "absolute",
          width: mainW + "px",
          height: mainH + "px",
          transform:
            "translateX(" +
            rel * sideOffset +
            "px) scale(" +
            scale +
            ") rotate(" +
            rotate +
            "deg)",
          opacity,
          zIndex,
          transition:
            "transform 0.85s cubic-bezier(0.22,1,0.36,1), opacity 0.85s ease",
          pointerEvents: within && !isMain ? "auto" : isMain ? "auto" : "none",
          cursor: within && !isMain ? "pointer" : "default",
        },
        onSlotClick:
          within && !isMain ? () => goToAgent(active + rel) : undefined,
        titleBoxStyle: {
          position: "absolute",
          top: "-40px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 18px 8px 8px",
          borderRadius: "100px",
          background: "rgba(15,16,24,0.72)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.14)",
          opacity: isMain ? 1 : 0,
          transition: "opacity 0.4s ease",
          whiteSpace: "nowrap",
        },
        robotIconWrapStyle: {
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          flexShrink: 0,
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        titleTextStyle: {
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontSize: "15px",
          fontWeight: 700,
          color: "#F4F3F7",
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        },
        imgWrapStyle: {
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "24px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: isMain
            ? "0 50px 100px -30px rgba(0,0,0,0.7)"
            : "0 20px 50px -20px rgba(0,0,0,0.5)",
        },
        fallbackBgStyle: {
          position: "absolute",
          inset: 0,
          borderRadius: "24px",
          background:
            "radial-gradient(circle at 30% 20%, rgba(124,92,255,0.25), transparent 55%), radial-gradient(circle at 80% 80%, rgba(87,199,255,0.18), transparent 55%), #14151f",
        },
        scrimStyle: {
          position: "absolute",
          inset: 0,
          borderRadius: "24px",
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, transparent 40%, rgba(10,11,15,0.9) 100%)",
        },
        navDotStyle: {
          width: isMain ? "22px" : "7px",
          height: "7px",
          borderRadius: "4px",
          background: isMain ? gradient : "rgba(255,255,255,0.18)",
          transition: "all 0.4s ease",
        },
      };
    });

    const glassCardStyle = {
      background: "rgba(255,255,255,0.04)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: "18px",
      padding: "28px 24px",
    };
    const glassCardStyleLight = {
      background: "rgba(255,255,255,0.65)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      border: "1px solid rgba(10,11,15,0.08)",
      borderRadius: "18px",
      padding: "28px 24px",
    };
    const modalOverlayStyle = {
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background:
        "radial-gradient(circle at 50% 30%, rgba(87,45,120,0.55), rgba(10,8,20,0.82) 70%)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    };
    const modalCardStyle = {
      width: "min(480px, 100%)",
      maxHeight: "88vh",
      overflowY: "auto",
      background: "#111219",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "20px",
      padding: "36px",
      position: "relative",
      boxShadow: "0 40px 100px -30px rgba(0,0,0,0.7)",
      color: "#F4F3F7",
    };
    const modalCloseStyle = {
      position: "absolute",
      top: "18px",
      right: "18px",
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.06)",
      color: "#ABA9B8",
      cursor: "pointer",
      fontSize: "13px",
    };
    const modalInputStyle = {
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
    const errorBorderStyle = {
      ...modalInputStyle,
      border: "1px solid #FF6B6B",
    };
    const fieldErrorStyle = {
      margin: "-8px 0 0",
      fontSize: "12.5px",
      color: "#FF8A8A",
    };
    const modalSelectStyle = {
      ...modalInputStyle,
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      cursor: "pointer",
      colorScheme: "dark",
      paddingRight: "38px",
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238A87A0' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 16px center",
    };
    const modalTextareaStyle = {
      ...modalInputStyle,
      minHeight: "80px",
      resize: "vertical",
      fontFamily: "inherit",
    };
    const modalSubmitStyle = {
      marginTop: "6px",
      padding: "15px",
      borderRadius: "10px",
      background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
      color: "#0A0B0F",
      fontSize: "15px",
      fontWeight: "700",
      textAlign: "center",
      cursor: "pointer",
    };
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
    const validateFieldSetter = (field?: any) => (e?: any) =>
      this.setState((s: any) => ({
        validateForm: { ...s.validateForm, [field]: e.target.value },
      }));
    const trustQuestions = [
      "Is there real market demand?",
      "Who are my competitors?",
      "Will customers actually pay?",
      "How much revenue can I generate?",
      "What will it cost?",
      "Is this idea financially viable?",
      "What risks should I expect?",
      "Is now the right time?",
    ];
    const trustCardStyle = {
      position: "relative",
      borderRadius: "100px",
      overflow: "hidden",
      background: "#240f0a",
      boxShadow:
        "0 0 0 1px rgba(255,138,90,0.25), 0 0 30px 4px rgba(255,138,90,0.28), 0 0 70px 14px rgba(255,90,60,0.16), 0 20px 45px -16px rgba(0,0,0,0.6)",
    };
    const trustQuestionsFmt = trustQuestions.map((text?: any, i?: any) => ({
      text,
      delay: i * 0.35 + "s",
      floatStyle: {
        display: "flex",
        gap: "10px",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 22px",
        textAlign: "center",
        animation:
          "floatSlow " + (4.5 + (i % 3) * 0.6) + "s ease-in-out infinite",
        animationDelay: i * 0.25 + "s",
      },
    }));
    const failReasons = [
      "No Market Research",
      "Wrong Target Audience",
      "Strong Competition",
      "Poor Pricing",
      "Low Profit Margins",
      "High Customer Acquisition Cost",
      "Unrealistic Revenue",
      "No Execution Strategy",
    ].map((text?: any, i?: any) => ({ text, delay: i * 0.05 + "s" }));
    const agentDefs = [
      {
        icon: "📊",
        name: "Market Agent",
        iconBg: "rgba(87,199,255,0.16)",
        desc: "Analyzes market demand, customer needs, industry trends, and growth opportunities to validate the commercial potential of your business idea.",
      },
      {
        icon: "⚔️",
        name: "Competition Agent",
        iconBg: "rgba(124,92,255,0.16)",
        desc: "Evaluates competitors, pricing, products, strengths, and market positioning to identify competitive advantages.",
      },
      {
        icon: "🛠️",
        name: "Feasibility & Cost Agent",
        iconBg: "rgba(242,201,87,0.18)",
        desc: "Assesses technical feasibility, implementation complexity, estimated costs, required resources, and potential risks.",
      },
      {
        icon: "💰",
        name: "Revenue Agent",
        iconBg: "rgba(87,242,164,0.18)",
        desc: "Forecasts revenue potential, pricing strategies, profit margins, and long-term growth opportunities.",
      },
      {
        icon: "🧭",
        name: "Synthesis Agent",
        iconBg: "rgba(200,108,255,0.16)",
        desc: "Combines insights from every AI agent into a complete business validation report with strategic recommendations and an execution roadmap.",
      },
    ];
    const agents = agentDefs.map((a?: any, i?: any) => ({
      ...a,
      numPadded: String(i + 1).padStart(2, "0"),
      delay: i * 0.06 + "s",
    }));

    const sixStepDefs = [
      "Describe Your Business Idea",
      "AI Market Research",
      "Competition Analysis",
      "Revenue & Cost Analysis",
      "Risk Assessment",
      "Receive Your Business Validation Report",
    ];
    const sixSteps = sixStepDefs.map((title?: any, i?: any) => ({
      num: i + 1,
      numPadded: String(i + 1).padStart(2, "0"),
      title,
      delay: i * 0.06 + "s",
      showArrow: i < sixStepDefs.length - 1,
      flashStyle: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: "55%",
        background:
          "linear-gradient(90deg, transparent, rgba(140,160,255,0.35), transparent)",
        animation:
          "stepFlash " + sixStepDefs.length * 0.9 + "s linear infinite",
        animationDelay: i * 0.9 + "s",
      },
    }));

    const analysisDefs = [
      {
        title: "Market",
        icon: "📊",
        color: "#57C7FF",
        items: ["Market Size", "Customer Demand", "Trends", "Opportunities"],
      },
      {
        title: "Competition",
        icon: "⚔️",
        color: "#7C5CFF",
        items: ["Competitors", "Pricing", "Products", "Positioning"],
      },
      {
        title: "Customers",
        icon: "👥",
        color: "#C86CFF",
        items: [
          "Buyer Persona",
          "Pain Points",
          "Buying Behavior",
          "Market Segments",
        ],
      },
      {
        title: "Financial",
        icon: "💰",
        color: "#57F2A4",
        items: ["Revenue Forecast", "Cost Estimation", "ROI", "Profitability"],
      },
      {
        title: "Technical",
        icon: "🛠️",
        color: "#F2C957",
        items: ["Technology", "Resources", "Scalability", "Timeline"],
      },
      {
        title: "Risk",
        icon: "⚠️",
        color: "#FF8A6E",
        items: [
          "Business Risks",
          "Market Risks",
          "Financial Risks",
          "Execution Risks",
        ],
      },
    ];
    const analysisGroups = analysisDefs.map((g?: any, i?: any) => ({
      ...g,
      delay: i * 0.06 + "s",
    }));

    const comparisonRows = [
      { old: "Weeks of research", newer: "Minutes" },
      { old: "Expensive consultants", newer: "Affordable AI analysis" },
      { old: "Limited insights", newer: "Multi-agent intelligence" },
      { old: "Manual reports", newer: "Automated comprehensive reports" },
      { old: "Generic advice", newer: "Personalized recommendations" },
      { old: "One-time consultation", newer: "Repeatable validation anytime" },
    ];

    const reportSectionDefs = [
      { icon: "📋", name: "Executive Summary" },
      { icon: "📈", name: "Market Analysis" },
      { icon: "🧩", name: "SWOT Analysis" },
      { icon: "💵", name: "Revenue Forecast" },
      { icon: "⚔️", name: "Competitor Matrix" },
      { icon: "🎯", name: "Business Score" },
      { icon: "🚀", name: "Launch Recommendation" },
    ];
    const reportSections = reportSectionDefs.map((r?: any, i?: any) => ({
      ...r,
      delay: i * 0.05 + "s",
    }));

    const industries = [
      "SaaS",
      "E-commerce",
      "Healthcare",
      "Education",
      "Real Estate",
      "Food & Beverage",
      "Manufacturing",
      "Retail",
      "Logistics",
      "Travel",
      "Finance",
      "AI Startups",
    ];

    const benefits = [
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
      goValidate: this.goValidate,
      scrollToReport: this.scrollToReport,
      reportRef: this.reportRef,
      carouselSectionRef: this.carouselSectionRef,
      carouselStageStyle,
      carouselDotsStyle,
      agentCarouselCards,
      pauseAgentTimer,
      resumeAgentTimer,
      muteBtnStyle,
      glassCardStyle,
      glassCardStyleLight,
      trustQuestions,
      trustQuestionsFmt,
      trustCardStyle,
      failReasons,
      agents,
      sixSteps,
      analysisGroups,
      comparisonRows,
      reportSections,
      industries,
      benefits,
      faqs,
      validateModalOpen: this.state.validateModalOpen,
      validateSubmitted: this.state.validateSubmitted,
      validateForm: this.state.validateForm,
      modalOverlayStyle,
      modalCardStyle,
      modalCloseStyle,
      modalSelectStyle,
      modalTextareaStyle,
      modalSubmitStyle,
      modalInputStyle,
      fieldErrorStyle,
      industryOptions,
      validateNameInputStyle: this.state.validateNameError
        ? errorBorderStyle
        : modalInputStyle,
      validateEmailInputStyle: this.state.validateEmailError
        ? errorBorderStyle
        : modalInputStyle,
      validateNameError: this.state.validateNameError,
      validateEmailError: this.state.validateEmailError,
      stopPropagation: (e?: any) => e.stopPropagation(),
      openValidateModal: () =>
        this.setState({
          validateModalOpen: true,
          validateSubmitted: false,
          validateNameError: "",
          validateEmailError: "",
        }),
      closeValidateModal: () => this.setState({ validateModalOpen: false }),
      onValidateField_name: validateFieldSetter("name"),
      onValidateField_email: validateFieldSetter("email"),
      onValidateField_industry: validateFieldSetter("industry"),
      onValidateField_idea: validateFieldSetter("idea"),
      submitValidateForm: () => {
        const f = this.state.validateForm;
        const nameErr = f.name.trim() ? "" : "Please enter your name.";
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
        const emailErr = f.email.trim()
          ? emailValid
            ? ""
            : "Please enter a valid email address."
          : "Please enter your email.";
        if (nameErr || emailErr) {
          this.setState({
            validateNameError: nameErr,
            validateEmailError: emailErr,
          });
          return;
        }
        this.setState({
          validateSubmitted: true,
          validateNameError: "",
          validateEmailError: "",
        });
      },
    };
  }
}
function usePageVals() {
  const [state, setState] = useMergedState<PageState>(INITIAL_STATE);
  const ref = useRef<AiBusinessIdeaValidationController | null>(null);
  if (!ref.current)
    ref.current = new AiBusinessIdeaValidationController(state, setState);
  const ctrl = ref.current;
  ctrl.state = state;
  ctrl.setState = setState;
  useEffect(() => {
    ctrl.componentDidMount();
    return () => ctrl.componentWillUnmount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ctrl.renderVals();
}

export function AiBusinessIdeaValidationView() {
  const {
    goValidate,
    scrollToReport,
    reportRef,
    carouselSectionRef,
    carouselStageStyle,
    carouselDotsStyle,
    agentCarouselCards,
    pauseAgentTimer,
    resumeAgentTimer,
    muteBtnStyle,
    trustQuestionsFmt,
    trustCardStyle,
    failReasons,
    agents,
    sixSteps,
    analysisGroups,
    comparisonRows,
    reportSections,
    industries,
    benefits,
    faqs,
    validateModalOpen,
    validateSubmitted,
    validateForm,
    modalOverlayStyle,
    modalCardStyle,
    modalCloseStyle,
    modalSelectStyle,
    modalTextareaStyle,
    modalSubmitStyle,
    fieldErrorStyle,
    industryOptions,
    validateNameInputStyle,
    validateEmailInputStyle,
    validateNameError,
    validateEmailError,
    stopPropagation,
    openValidateModal,
    closeValidateModal,
    onValidateField_name,
    onValidateField_email,
    onValidateField_industry,
    onValidateField_idea,
    submitValidateForm,
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
        {validateModalOpen ? (
          <div style={asStyle(modalOverlayStyle)} onClick={closeValidateModal}>
            <div style={asStyle(modalCardStyle)} onClick={stopPropagation}>
              <div
                style={asStyle(modalCloseStyle)}
                onClick={closeValidateModal}
              >
                {"✕"}
              </div>
              {validateSubmitted ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: "44px", marginBottom: "16px" }}>
                    {"✓"}
                  </div>
                  <h3
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "24px",
                      fontWeight: "700",
                      margin: "0 0 10px",
                    }}
                  >
                    {"Your validation is running."}
                  </h3>
                  <p
                    style={{ fontSize: "15px", color: "#8A87A0", margin: "0" }}
                  >
                    {"We'll email your free score and full report to "}
                    {validateForm.email}
                    {" shortly."}
                  </p>
                </div>
              ) : null}
              {!validateSubmitted ? (
                <>
                  <h3
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "22px",
                      fontWeight: "700",
                      margin: "0 0 8px",
                    }}
                  >
                    {"Validate my business idea"}
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "#8A87A0",
                      margin: "0 0 26px",
                    }}
                  >
                    {
                      "Give us a few details and we'll validate your idea for free."
                    }
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <input
                      value={validateForm.name}
                      onChange={onValidateField_name}
                      placeholder="Full name"
                      style={asStyle(validateNameInputStyle)}
                    />
                    {validateNameError ? (
                      <p style={asStyle(fieldErrorStyle)}>
                        {validateNameError}
                      </p>
                    ) : null}
                    <input
                      value={validateForm.email}
                      onChange={onValidateField_email}
                      placeholder="Work email"
                      style={asStyle(validateEmailInputStyle)}
                    />
                    {validateEmailError ? (
                      <p style={asStyle(fieldErrorStyle)}>
                        {validateEmailError}
                      </p>
                    ) : null}
                    <select
                      value={validateForm.industry}
                      onChange={onValidateField_industry}
                      style={asStyle(modalSelectStyle)}
                    >
                      <option
                        value=""
                        style={{ background: "#1A1B24", color: "#F4F3F7" }}
                      >
                        {"Select your industry…"}
                      </option>
                      {industryOptions.map((ind?: any, indIdx?: any) => (
                        <option
                          key={indIdx}
                          value={ind}
                          style={{ background: "#1A1B24", color: "#F4F3F7" }}
                        >
                          {ind}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={validateForm.idea}
                      onChange={onValidateField_idea}
                      placeholder="Describe your business idea…"
                      style={asStyle(modalTextareaStyle)}
                    ></textarea>
                    <div
                      onClick={submitValidateForm}
                      style={asStyle(modalSubmitStyle)}
                    >
                      {"Get my free score →"}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
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
              filter: "blur(45px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "820px",
              margin: "0 auto",
              position: "relative",
              zIndex: "1",
            }}
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
              {"Stop guessing"}
            </div>
            <h1
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(34px,4.8vw,60px)",
                lineHeight: "1.08",
                letterSpacing: "-0.02em",
                margin: "0 0 22px",
                animationDelay: "0.08s",
              }}
            >
              {"Business Idea Validation"}
            </h1>
            <p
              className="reveal"
              style={{
                fontSize: "16.5px",
                color: "#8CA0FF",
                lineHeight: "1.7",
                margin: "0 0 24px",
                fontWeight: "600",
                animationDelay: "0.14s",
              }}
            >
              {"Validate your business idea"}
              <br />
              {"before you build it"}
            </p>
            <p
              className="reveal"
              style={{
                fontSize: "16.5px",
                color: "#ABA9B8",
                maxWidth: "640px",
                margin: "0 auto 36px",
                lineHeight: "1.7",
                animationDelay: "0.18s",
              }}
            >
              {
                " Our AI-powered validation platform analyzes your business idea from every angle — market demand, competition, feasibility, revenue potential, risks, and execution strategy — so you can launch with confidence. "
              }
            </p>
            <div
              className="reveal"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                flexWrap: "wrap",
                animationDelay: "0.24s",
              }}
            >
              <div
                onClick={openValidateModal}
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
                onClick={scrollToReport}
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
                {"See Sample Report"}
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "100px 64px",
            position: "relative",
            overflow: "hidden",
            background: "#0A0B0F",
          }}
        >
          <img
            src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260729_094627_0b6c9243-4235-456b-be31-339713fdc0dd.png"
            alt="Dark abstract office team discussing strategy"
            style={{
              position: "absolute",
              inset: "0",
              width: "100%",
              height: "100%",
              opacity: "0.45",
              objectFit: "cover",
              display: "block",
            }}
            loading="lazy"
          />
          <div
            style={{
              position: "absolute",
              inset: "0",
              background:
                "linear-gradient(180deg, rgba(10,11,15,0.55) 0%, rgba(10,11,15,0.85) 100%)",
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
            <h2
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(24px,2.8vw,36px)",
                lineHeight: "1.3",
                letterSpacing: "-0.01em",
                margin: "0 0 10px",
                color: "#F4F3F7",
                textShadow:
                  "0 1px 0 rgba(255,255,255,0.15), 0 2px 2px rgba(0,0,0,0.4), 0 8px 18px rgba(0,0,0,0.55), 0 16px 34px rgba(0,0,0,0.4)",
              }}
            >
              {"Thousands of Entrepreneurs Fail for the Same Reason"}
            </h2>
            <p
              className="reveal"
              style={{
                fontSize: "16px",
                color: "#ABA9B8",
                margin: "0 0 36px",
                animationDelay: "0.05s",
              }}
            >
              {
                "They build before validating. Many startups fail because they never answer critical questions:"
              }
            </p>
            <div
              className="reveal"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: "16px",
                textAlign: "left",
                animationDelay: "0.1s",
              }}
            >
              {trustQuestionsFmt.map((q?: any, qIdx?: any) => (
                <div key={qIdx} style={asStyle(trustCardStyle)}>
                  <div style={asStyle(q.floatStyle)}>
                    <span
                      style={{
                        fontSize: "13.5px",
                        color: "#FFFFFF",
                        fontWeight: "700",
                        textShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }}
                    >
                      {q.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p
              className="reveal"
              style={{
                fontSize: "15px",
                color: "#F4F3F7",
                fontWeight: "600",
                margin: "36px 0 0",
                animationDelay: "0.15s",
              }}
            >
              {"AIAutomix answers these questions before you invest."}
            </p>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "56px" }}
            >
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Why Most Business Ideas Fail"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: "18px",
              }}
            >
              {failReasons.map((r?: any, rIdx?: any) => (
                <div
                  key={rIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,90,90,0.18)",
                    borderRadius: "14px",
                    padding: "22px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    animationDelay: "{{ r.delay }}",
                  }}
                >
                  <span style={{ color: "#FF6B6B", fontSize: "16px" }}>
                    {"✕"}
                  </span>{" "}
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#E7E5F0",
                      fontWeight: "600",
                    }}
                  >
                    {r.text}
                  </span>
                </div>
              ))}
            </div>
            <p
              className="reveal"
              style={{
                textAlign: "center",
                fontSize: "16px",
                color: "#57F2A4",
                fontWeight: "700",
                margin: "44px 0 0",
              }}
            >
              {"Validation costs far less than failure."}
            </p>
          </div>
        </div>
        <div
          ref={carouselSectionRef}
          style={{
            padding: "140px 0",
            position: "relative",
            overflow: "hidden",
            background: "#0A0B0F",
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
              filter: "blur(45px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "1300px",
              margin: "0 auto",
              position: "relative",
              zIndex: "1",
              padding: "0 64px",
            }}
          >
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
                {"How we validate"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(34px,4.5vw,64px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0 0 20px",
                }}
              >
                {"How do we validate your idea?"}
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
                  " Five specialist agents hand off their findings in sequence — no single model is asked to know everything. "
                }
              </p>
            </div>
          </div>
          <div
            style={asStyle(carouselStageStyle)}
            onMouseEnter={pauseAgentTimer}
            onMouseLeave={resumeAgentTimer}
          >
            {agentCarouselCards.map((agent?: any, agentIdx?: any) => (
              <div
                key={agentIdx}
                style={asStyle(agent.slotStyle)}
                onClick={agent.onSlotClick}
              >
                <div style={asStyle(agent.titleBoxStyle)}>
                  <div style={asStyle(agent.robotIconWrapStyle)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="5"
                        y="9"
                        width="14"
                        height="11"
                        rx="3"
                        stroke="#0A0B0F"
                        strokeWidth="1.7"
                      ></rect>
                      <path
                        d="M12 9V5"
                        stroke="#0A0B0F"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      ></path>
                      <circle cx="12" cy="3.5" r="1.5" fill="#0A0B0F"></circle>
                      <circle cx="9.5" cy="14" r="1.4" fill="#0A0B0F"></circle>
                      <circle cx="14.5" cy="14" r="1.4" fill="#0A0B0F"></circle>
                      <path
                        d="M9 17.5h6"
                        stroke="#0A0B0F"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      ></path>
                      <path
                        d="M2 13h3M19 13h3"
                        stroke="#0A0B0F"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      ></path>
                    </svg>
                  </div>
                  <span style={asStyle(agent.titleTextStyle)}>{agent.tag}</span>
                </div>
                <div style={asStyle(agent.imgWrapStyle)}>
                  <div style={asStyle(agent.fallbackBgStyle)}></div>
                  {agent.isVideo ? (
                    <>
                      <video
                        ref={agent.videoRef}
                        id={`agent-video-${agent.number}`}
                        onEnded={agent.onVideoEnded}
                        style={{
                          position: "absolute",
                          inset: "0",
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "24px",
                        }}
                        autoPlay={agent.isMain}
                        playsInline={true}
                      ></video>
                      <div
                        onClick={agent.toggleMute}
                        style={asStyle(muteBtnStyle)}
                      >
                        {agent.isMuted ? (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path d="M4 9v6h4l5 5V4L8 9H4z" fill="#fff"></path>
                            <path
                              d="M16 8l5 8M21 8l-5 8"
                              stroke="#fff"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            ></path>
                          </svg>
                        ) : null}
                        {!agent.isMuted ? (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path d="M4 9v6h4l5 5V4L8 9H4z" fill="#fff"></path>
                            <path
                              d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
                              stroke="#fff"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            ></path>
                          </svg>
                        ) : null}
                      </div>
                      <div
                        onClick={agent.restartVideo}
                        style={asStyle(agent.restartBtnStyle)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={asStyle(agent.restartIconStyle)}
                        >
                          <path
                            d="M3 12a9 9 0 1 1 3 6.7"
                            stroke="#fff"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          ></path>
                          <path
                            d="M3 8v5h5"
                            stroke="#fff"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          ></path>
                        </svg>
                      </div>
                    </>
                  ) : null}
                  <div style={asStyle(agent.scrimStyle)}></div>
                </div>
              </div>
            ))}
          </div>
          <div style={asStyle(carouselDotsStyle)}>
            {agentCarouselCards.map((agent?: any, agentIdx?: any) => (
              <div key={agentIdx} style={asStyle(agent.navDotStyle)}></div>
            ))}
          </div>
        </div>
        <div
          style={{ padding: "120px 64px", background: "rgb(244, 241, 234)" }}
        >
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "64px" }}
            >
              <div
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8A7458",
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"The team behind the score"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                  color: "#0A0B0F",
                }}
              >
                {"Meet Your AI Business Validation Team"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: "22px",
              }}
            >
              {agents.map((a?: any, aIdx?: any) => (
                <div
                  key={aIdx}
                  className="reveal"
                  style={{
                    position: "relative",
                    background: "#FFFFFF",
                    borderRadius: "20px",
                    padding: "32px 26px",
                    boxShadow: "0 24px 50px -30px rgba(0,0,0,0.25)",
                    border: "1px solid rgba(10,11,15,0.06)",
                    animationDelay: "{{ a.delay }}",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "20px",
                      right: "20px",
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "rgba(10,11,15,0.18)",
                    }}
                  >
                    {a.numPadded}
                  </div>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "14px",
                      background: "{{ a.iconBg }}",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      marginBottom: "18px",
                    }}
                  >
                    {a.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "10px",
                      color: "#0A0B0F",
                    }}
                  >
                    {a.name}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#5C5847",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {a.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background: "#0A0B0F",
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
                "radial-gradient(ellipse at center, rgba(124,92,255,0.14), transparent 65%)",
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
            }}
          >
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
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"The process"}
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
                {"Validate Any Business Idea in 6 Steps"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                gap: "20px",
              }}
            >
              {sixSteps.map((s?: any, sIdx?: any) => (
                <div
                  key={sIdx}
                  className="reveal"
                  style={{
                    position: "relative",
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    padding: "28px 24px",
                    overflow: "hidden",
                    animationDelay: "{{ s.delay }}",
                  }}
                >
                  <div style={asStyle(s.flashStyle)}></div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontWeight: "800",
                      fontSize: "44px",
                      lineHeight: "1",
                      background: "linear-gradient(135deg,#57C7FF,#7C5CFF)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                      marginBottom: "16px",
                      position: "relative",
                      zIndex: "1",
                    }}
                  >
                    {s.numPadded}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16.5px",
                      fontWeight: "700",
                      color: "#F4F3F7",
                      position: "relative",
                      zIndex: "1",
                    }}
                  >
                    {s.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{ padding: "120px 64px", background: "rgb(244, 241, 234)" }}
        >
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "64px" }}
            >
              <div
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8A7458",
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"Full-spectrum analysis"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                  color: "#0A0B0F",
                }}
              >
                {"What We Analyze"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: "22px",
              }}
            >
              {analysisGroups.map((g?: any, gIdx?: any) => (
                <div
                  key={gIdx}
                  className="reveal"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "18px",
                    padding: "28px 26px",
                    borderTop: "4px solid {{ g.color }}",
                    boxShadow: "0 20px 45px -24px rgba(0,0,0,0.18)",
                    animationDelay: "{{ g.delay }}",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "20px",
                    }}
                  >
                    <span style={{ fontSize: "22px" }}>{g.icon}</span>{" "}
                    <span
                      style={{
                        fontFamily: "'Bricolage Grotesque',sans-serif",
                        fontSize: "16.5px",
                        fontWeight: "700",
                        color: "#0A0B0F",
                      }}
                    >
                      {g.title}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                  >
                    {g.items.map((item?: any, itemIdx?: any) => (
                      <span
                        key={itemIdx}
                        style={{
                          fontSize: "12.5px",
                          color: "#5C5847",
                          background: "rgb(244, 241, 234)",
                          padding: "7px 12px",
                          borderRadius: "100px",
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background: "#0A0B0F",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "0",
              right: "-10%",
              width: "700px",
              height: "700px",
              background:
                "radial-gradient(circle, rgba(87,199,255,0.1), transparent 65%)",
              filter: "blur(50px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              position: "relative",
              zIndex: "1",
            }}
          >
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
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"The gap in practice"}
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
                {"Why Choose AI Instead of Traditional Consulting?"}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 40px 90px -40px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div
                  style={{
                    padding: "20px 24px",
                    background: "#1A1215",
                    fontSize: "13px",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#B49C9C",
                    fontWeight: "700",
                  }}
                >
                  {"Traditional Consulting"}
                </div>
                <div
                  style={{
                    padding: "20px 24px",
                    background: "linear-gradient(160deg,#0E3D24,#0A2A1A)",
                    fontSize: "13px",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#57F2A4",
                    fontWeight: "700",
                  }}
                >
                  {"AIAutomix AI Validation"}
                </div>
              </div>
              {comparisonRows.map((row?: any, rowIdx?: any) => (
                <div
                  key={rowIdx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      padding: "18px 24px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "14px",
                      color: "#A89494",
                      background: "rgba(255,107,107,0.04)",
                    }}
                  >
                    <span style={{ color: "#FF6B6B", flexShrink: "0" }}>
                      {"✕"}
                    </span>
                    {row.old}
                  </div>
                  <div
                    style={{
                      padding: "18px 24px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "14px",
                      color: "#E7E5F0",
                      background: "rgba(87,242,164,0.07)",
                      fontWeight: "500",
                    }}
                  >
                    <span style={{ color: "#57F2A4", flexShrink: "0" }}>
                      {"✓"}
                    </span>
                    {row.newer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          ref={reportRef}
          style={{ padding: "120px 64px", background: "rgb(244, 241, 234)" }}
        >
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div className="reveal" style={{ marginBottom: "48px" }}>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                  color: "#0A0B0F",
                }}
              >
                {"Sample Report Preview"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                gap: "16px",
                marginBottom: "44px",
              }}
            >
              {reportSections.map((rs?: any, rsIdx?: any) => (
                <div
                  key={rsIdx}
                  className="reveal"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(10,11,15,0.08)",
                    borderRadius: "14px",
                    padding: "20px 16px",
                    animationDelay: "{{ rs.delay }}",
                  }}
                >
                  <div style={{ fontSize: "20px", marginBottom: "10px" }}>
                    {rs.icon}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#3A3226",
                    }}
                  >
                    {rs.name}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="reveal"
              onClick={goValidate}
              style={{
                display: "inline-block",
                padding: "17px 30px",
                borderRadius: "12px",
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                color: "#0A0B0F",
                fontSize: "15px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {"Download Sample Report"}
            </div>
          </div>
        </div>
        <div style={{ padding: "100px 64px", background: "#0A0B0F" }}>
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div className="reveal" style={{ marginBottom: "40px" }}>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3vw,38px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Industries We Support"}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              {industries.map((ind?: any, indIdx?: any) => (
                <div
                  key={indIdx}
                  style={{
                    padding: "12px 20px",
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "100px",
                    fontSize: "13.5px",
                    color: "#D6D4E0",
                    fontWeight: "500",
                  }}
                >
                  {ind}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{ padding: "120px 64px", background: "rgb(244, 241, 234)" }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "56px" }}
            >
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                  color: "#0A0B0F",
                }}
              >
                {"Why Entrepreneurs Choose AIAutomix"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: "18px",
              }}
            >
              {benefits.map((b?: any, bIdx?: any) => (
                <div
                  key={bIdx}
                  className="reveal"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "18px 20px",
                    background: "#FFFFFF",
                    border: "1px solid rgba(10,11,15,0.08)",
                    borderRadius: "12px",
                  }}
                >
                  <span style={{ color: "#2E9E6B" }}>{"✓"}</span>{" "}
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#3A3226",
                      fontWeight: "500",
                    }}
                  >
                    {b}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "56px" }}
            >
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
            background: "rgb(244, 241, 234)",
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
                "radial-gradient(ellipse at center, rgba(124,92,255,0.14), transparent 65%)",
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
                color: "#0A0B0F",
              }}
            >
              {"Ready to Validate Your Next Big Idea?"}
            </h2>
            <p
              style={{ fontSize: "16px", color: "#5C5847", margin: "0 0 8px" }}
            >
              {"Don't spend months building the wrong business."}
            </p>
            <p
              style={{ fontSize: "16px", color: "#5C5847", margin: "0 0 36px" }}
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
                onClick={openValidateModal}
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
                onClick={openValidateModal}
                style={{
                  padding: "17px 30px",
                  borderRadius: "12px",
                  background: "transparent",
                  border: "1.5px solid rgba(10,11,15,0.2)",
                  color: "#0A0B0F",
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
            position: "relative",
            zIndex: "1",
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
        <div style={{ padding: "56px 64px 40px", textAlign: "center" }}>
          <Link href="/" style={{ fontSize: "14px", color: "#8A87A0" }}>
            {"← Back to AIAutomix home"}
          </Link>
        </div>
      </div>
    </>
  );
}
