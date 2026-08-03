"use client";

import { Fragment, useRef } from "react";
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
    input::placeholder { color: #6E6C7C; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .reveal { opacity: 0; animation: riseIn 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
    @keyframes typingBounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
`;

const INITIAL_STATE = {
  chatMessages: [
    {
      from: "bot",
      text: "Hi! I'm trained on this company's docs. Ask me anything, or tap a question below.",
    },
  ],
  isTyping: false,
  hasAskedQuestion: false,
  chatInputValue: "",
  activeUseCaseIdx: 0,
  faqOpenIdx: null as number | null,
};
type PageState = typeof INITIAL_STATE;

class AiChatbotController {
  [k: string]: any;
  state: any;
  setState: (u: any) => void;
  props: Record<string, any> = {};
  constructor(state: PageState, setState: (u: any) => void) {
    this.state = state;
    this.setState = setState;
  }
  howRef: any = (n?: any) => {
    this._howNode = n;
  };
  pricingRef: any = (n?: any) => {
    this._pricingNode = n;
  };
  chatScrollRef: any = (n?: any) => {
    this._chatScrollNode = n;
  };
  scrollToHow: any = () => {
    if (this._howNode)
      this._howNode.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  scrollToPricing: any = () => {
    if (this._pricingNode)
      this._pricingNode.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  _replyFor(q?: any) {
    const lower = q.toLowerCase();
    if (
      lower.includes("pricing") ||
      lower.includes("cost") ||
      lower.includes("price")
    )
      return "We have a free tier to start, then plans from $49/mo. No card required to try it.";
    if (
      lower.includes("setup") ||
      lower.includes("install") ||
      lower.includes("embed")
    )
      return "Most teams are live in under 10 minutes — connect your docs, and drop one line of code on your site.";
    if (
      lower.includes("data") ||
      lower.includes("secure") ||
      lower.includes("privacy")
    )
      return "Your data is never used to train shared models, and we're SOC 2 Type II certified.";
    return "Good question — based on your connected docs, I'd walk you through that step by step. Try connecting your own content to see this live.";
  }
  _sendMessage(text?: any) {
    if (!text.trim()) return;
    this.setState((s: any) => ({
      chatMessages: [...s.chatMessages, { from: "user", text }],
      isTyping: true,
      hasAskedQuestion: true,
      chatInputValue: "",
    }));
    setTimeout(() => {
      this.setState((s: any) => ({
        chatMessages: [
          ...s.chatMessages,
          { from: "bot", text: this._replyFor(text) },
        ],
        isTyping: false,
      }));
      requestAnimationFrame(() => {
        if (this._chatScrollNode)
          this._chatScrollNode.scrollTop = this._chatScrollNode.scrollHeight;
      });
    }, 900);
    requestAnimationFrame(() => {
      if (this._chatScrollNode)
        this._chatScrollNode.scrollTop = this._chatScrollNode.scrollHeight;
    });
  }
  renderVals() {
    const bubbleStyleFor = (from?: any) => ({
      maxWidth: "82%",
      padding: "11px 15px",
      fontSize: "13.5px",
      lineHeight: 1.5,
      borderRadius:
        from === "bot" ? "14px 14px 14px 3px" : "14px 14px 3px 14px",
      background:
        from === "bot" ? "#1A1B24" : "linear-gradient(90deg,#57C7FF,#7C5CFF)",
      color: from === "bot" ? "#E7E5F0" : "#0A0B0F",
    });
    const chatMessages = this.state.chatMessages.map((m?: any, i?: any) => ({
      text: m.text,
      bubbleWrapStyle: {
        display: "flex",
        justifyContent: m.from === "bot" ? "flex-start" : "flex-end",
      },
      bubbleStyle: bubbleStyleFor(m.from),
    }));

    const sampleQuestionsDefs = [
      "How much does this cost?",
      "How long does setup take?",
      "Is my data kept private?",
    ];
    const sampleQuestions = sampleQuestionsDefs.map((q: any) => ({
      text: q,
      onClick: () => this._sendMessage(q),
    }));

    const advantages = [
      {
        icon: "🕒",
        title: "Coverage around the clock",
        desc: "No nights, weekends, or holidays where customers get silence.",
        example:
          "A DTC skincare brand added a chatbot before a weekend flash sale and resolved 1,900 order-status questions with zero staff online.",
      },
      {
        icon: "📉",
        title: "Lower cost per resolved ticket",
        desc: "Deflects the repetitive volume so headcount scales with growth, not ticket count.",
        example:
          "A SaaS company held support headcount flat through 3x user growth by deflecting 68% of tickets automatically.",
      },
      {
        icon: "⚡",
        title: "Faster first response",
        desc: "Visitors get an answer in seconds instead of waiting in a queue.",
        example:
          "A regional bank cut average first-response time from 4 hours to 12 seconds on account and card questions.",
      },
      {
        icon: "📈",
        title: "More qualified leads captured",
        desc: "Engages every visitor instantly instead of losing them to a contact form.",
        example:
          "A B2B software vendor saw a 35% lift in qualified demo bookings after replacing its contact form with a chatbot.",
      },
    ].map((a?: any, i?: any) => ({ ...a, delay: i * 0.07 + "s" }));
    const comparisonRows = [
      {
        without:
          "Support closes at 6pm — anything after that waits until morning.",
        withBot: "Answers questions instantly, 24 hours a day, every day.",
      },
      {
        without:
          "The same 20 questions get typed out by an agent, over and over.",
        withBot:
          "Repetitive questions are resolved instantly, freeing agents for real problems.",
      },
      {
        without: "Response times stretch past 6 hours during busy periods.",
        withBot:
          "First response lands in under a second, no matter the volume.",
      },
      {
        without: "Hiring more agents is the only way to handle more volume.",
        withBot: "Handles 10x the conversations without adding headcount.",
      },
      {
        without: "Website visitors who don't find an answer just leave.",
        withBot:
          "Engages every visitor immediately and captures the lead before they leave.",
      },
      {
        without:
          "Knowledge lives in a few agents' heads, inconsistent answers.",
        withBot:
          "Every answer is grounded in the same up-to-date docs, every time.",
      },
    ];
    const howSteps = [
      {
        num: "1",
        title: "Connect your data",
        desc: "Point it at your docs, help center, or knowledge base — no formatting required.",
      },
      {
        num: "2",
        title: "Train in minutes",
        desc: "It reads and indexes everything automatically. No prompt engineering.",
      },
      {
        num: "3",
        title: "Embed anywhere",
        desc: "One line of code on your site, or connect Slack, WhatsApp, Zendesk directly.",
      },
    ].map((s?: any, i?: any) => ({ ...s, delay: i * 0.08 + "s" }));

    const capabilities = [
      {
        icon: "📚",
        title: "Understands your docs, not generic answers",
        desc: "Every response is grounded in your actual content — not a generic LLM guess.",
        proof: "94% answer accuracy across 40k+ tickets",
      },
      {
        icon: "⚡",
        title: "Replies in under a second",
        desc: 'No spinner, no "let me check" — the answer streams back instantly.',
        proof: "Median response time: 0.8s",
      },
      {
        icon: "🔁",
        title: "Escalates when it should",
        desc: "Hands off to a human the moment confidence drops, with full context attached.",
        proof: "Zero silent failures reported by customers",
      },
      {
        icon: "🌐",
        title: "Speaks 40+ languages",
        desc: "Detects the visitor's language automatically and replies in kind.",
        proof: "No extra setup required",
      },
    ].map((c?: any, i?: any) => ({ ...c, delay: i * 0.07 + "s" }));

    const useCaseDefs = [
      {
        label: "Support",
        title: "Customer support",
        desc: "Deflect repetitive tickets instantly — password resets, order status, how-to questions — so your team only sees what actually needs a human.",
      },
      {
        label: "Sales",
        title: "Sales & pre-sales",
        desc: "Qualify inbound leads 24/7, answer pricing and feature questions on the spot, and hand off hot leads to a rep with full conversation context.",
      },
      {
        label: "Internal helpdesk",
        title: "Internal helpdesk",
        desc: "Point it at your internal wiki so employees get instant answers on HR policy, IT setup, and expense processes without opening a ticket.",
      },
    ];
    const useCaseTabs = useCaseDefs.map((u?: any, i?: any) => ({
      label: u.label,
      onClick: () => this.setState({ activeUseCaseIdx: i }),
      tabStyle: {
        padding: "11px 22px",
        borderRadius: "100px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 600,
        background:
          this.state.activeUseCaseIdx === i ? "#F4F3F7" : "transparent",
        color: this.state.activeUseCaseIdx === i ? "#0A0B0F" : "#ABA9B8",
        border:
          "1px solid " +
          (this.state.activeUseCaseIdx === i
            ? "#F4F3F7"
            : "rgba(255,255,255,0.14)"),
      },
    }));
    const activeUseCase = useCaseDefs[this.state.activeUseCaseIdx];

    const integrations = [
      "Slack",
      "Zendesk",
      "WhatsApp",
      "Your website",
      "Intercom",
      "HubSpot",
    ];

    const testimonialDefs = [
      {
        stat: "6h → 30s",
        quote:
          "First-response time went from six hours to thirty seconds. Our support queue has never been this calm.",
        name: "Priya Nair",
        role: "Head of Support, Fernway",
        avatarSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_101610_6aa637b1-0c49-4ac4-bcce-cc4084f36403.png",
      },
      {
        stat: "71% deflection",
        quote:
          "It resolved most of our tickets without a human touching them, and the ones it escalated came with perfect context.",
        name: "Daniel Osei",
        role: "CX Lead, Vaultra",
        avatarSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_101612_e191dc23-e08f-43e2-bd0e-57d92ad32d50.png",
      },
      {
        stat: "12 min setup",
        quote:
          "We connected our help center and it was answering real customer questions accurately within the same call.",
        name: "Sarah Kessler",
        role: "Ops Manager, Corebase",
        avatarSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_101614_e1cbfec8-ee0e-4a13-af8d-c9805b88a49b.png",
      },
    ];
    const testimonials = testimonialDefs.map((t?: any, i?: any) => ({
      ...t,
      slotId: "testimonial-" + i,
      delay: i * 0.08 + "s",
    }));

    const pricingDefs = [
      {
        name: "Free",
        price: "$0",
        period: "/mo",
        cta: "Start free",
        features: ["100 conversations/mo", "1 data source", "Website embed"],
        highlight: false,
      },
      {
        name: "Growth",
        price: "$49",
        period: "/mo",
        cta: "Try it free",
        features: [
          "2,000 conversations/mo",
          "Unlimited data sources",
          "Slack, Zendesk, WhatsApp",
          "Human handoff",
        ],
        highlight: true,
      },
      {
        name: "Scale",
        price: "Custom",
        period: "",
        cta: "Talk to us",
        features: [
          "Unlimited conversations",
          "SSO & audit logs",
          "Dedicated support",
        ],
        highlight: false,
      },
    ];
    const pricingTiers = pricingDefs.map((p: any) => ({
      name: p.name,
      price: p.price,
      period: p.period,
      cta: p.cta,
      features: p.features,
      onClick: () => this._sendMessage("How much does this cost?"),
      cardStyle: {
        padding: "32px 28px",
        borderRadius: "20px",
        background: p.highlight
          ? "linear-gradient(160deg,#1B1440,#111219)"
          : "#111219",
        border: p.highlight
          ? "1.5px solid #7C5CFF"
          : "1px solid rgba(255,255,255,0.08)",
      },
      ctaStyle: {
        padding: "13px",
        borderRadius: "10px",
        textAlign: "center",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
        background: p.highlight
          ? "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)"
          : "rgba(255,255,255,0.08)",
        color: p.highlight ? "#0A0B0F" : "#F4F3F7",
      },
    }));

    const faqDefs = [
      {
        q: "What happens if it gives a wrong answer?",
        a: "It only answers from your connected docs and shows its confidence — when it's unsure, it escalates to a human instead of guessing.",
      },
      {
        q: "How long does setup actually take?",
        a: "Most teams connect their docs and go live within 10-15 minutes. No code required beyond one embed snippet.",
      },
      {
        q: "What happens when it can't answer?",
        a: "It hands the conversation to a human teammate with full context attached — no repeating yourself.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes — monthly plans cancel anytime from your dashboard, no calls or emails required.",
      },
      {
        q: "Is my data used to train your models?",
        a: "Never. Your conversations and documents are used only to answer your own visitors.",
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
      chatMessages,
      isTyping: this.state.isTyping,
      hasAskedQuestion: this.state.hasAskedQuestion,
      sampleQuestions,
      chatScrollRef: this.chatScrollRef,
      chatInputValue: this.state.chatInputValue,
      onChatInputChange: (e?: any) =>
        this.setState({ chatInputValue: e.target.value }),
      onChatInputKeyDown: (e?: any) => {
        if (e.key === "Enter") this._sendMessage(this.state.chatInputValue);
      },
      onChatSend: () => this._sendMessage(this.state.chatInputValue),
      scrollToHow: this.scrollToHow,
      scrollToPricing: this.scrollToPricing,
      howRef: this.howRef,
      pricingRef: this.pricingRef,
      howSteps,
      capabilities,
      useCaseTabs,
      activeUseCase,
      integrations,
      testimonials,
      pricingTiers,
      faqs,
      advantages,
      comparisonRows,
    };
  }
}
function usePageVals() {
  const [state, setState] = useMergedState<PageState>(INITIAL_STATE);
  const ref = useRef<AiChatbotController | null>(null);
  if (!ref.current) ref.current = new AiChatbotController(state, setState);
  const ctrl = ref.current;
  ctrl.state = state;
  ctrl.setState = setState;
  return ctrl.renderVals();
}

export function AiChatbotView() {
  const {
    chatMessages,
    isTyping,
    hasAskedQuestion,
    sampleQuestions,
    chatScrollRef,
    chatInputValue,
    onChatInputChange,
    onChatInputKeyDown,
    onChatSend,
    scrollToHow,
    scrollToPricing,
    howRef,
    pricingRef,
    howSteps,
    capabilities,
    useCaseTabs,
    activeUseCase,
    integrations,
    testimonials,
    pricingTiers,
    faqs,
    advantages,
    comparisonRows,
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
            padding: "100px 64px 90px",
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
                "radial-gradient(ellipse at center, rgba(87,199,255,0.18), transparent 65%)",
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
                {" Used by 4,000+ teams "}
              </div>
              <h1
                className="reveal"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(34px,4.6vw,58px)",
                  lineHeight: "1.06",
                  letterSpacing: "-0.02em",
                  margin: "0 0 24px",
                  animationDelay: "0.1s",
                }}
              >
                {" Answer 70% of support tickets"}
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {"instantly."}
                </span>
              </h1>
              <p
                className="reveal"
                style={{
                  fontSize: "17px",
                  color: "#ABA9B8",
                  maxWidth: "480px",
                  lineHeight: "1.6",
                  margin: "0 0 34px",
                  animationDelay: "0.2s",
                }}
              >
                {
                  " For support and sales teams who are tired of answering the same questions. Train an AI chatbot on your own docs and embed it anywhere in minutes. "
                }
              </p>
              <div
                className="reveal"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                  animationDelay: "0.3s",
                }}
              >
                <div
                  onClick={scrollToPricing}
                  style={{
                    padding: "16px 28px",
                    borderRadius: "12px",
                    background:
                      "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                    color: "#0A0B0F",
                    fontSize: "15px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {"Try it free"}
                </div>
                <div
                  onClick={scrollToHow}
                  style={{
                    fontSize: "14.5px",
                    color: "#ABA9B8",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(171,169,184,0.4)",
                    paddingBottom: "2px",
                  }}
                >
                  {"See how it works"}
                </div>
              </div>
            </div>
            <div
              className="reveal"
              style={{
                animationDelay: "0.15s",
                background: "#111219",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "20px",
                boxShadow: "0 40px 100px -30px rgba(0,0,0,0.6)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    background: "#57F2A4",
                  }}
                ></div>
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: "600",
                    color: "#D6D4E0",
                  }}
                >
                  {"AIAutomix Assistant"}
                </span>{" "}
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "11.5px",
                    color: "#6E6C7C",
                  }}
                >
                  {"Live demo"}
                </span>
              </div>
              <div
                ref={chatScrollRef}
                style={{
                  height: "340px",
                  overflowY: "auto",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {chatMessages.map((msg?: any, msgIdx?: any) => (
                  <div key={msgIdx} style={asStyle(msg.bubbleWrapStyle)}>
                    <div style={asStyle(msg.bubbleStyle)}>{msg.text}</div>
                  </div>
                ))}
                {isTyping ? (
                  <div
                    style={{
                      alignSelf: "flex-start",
                      display: "flex",
                      gap: "5px",
                      padding: "12px 16px",
                      background: "#1A1B24",
                      borderRadius: "14px 14px 14px 3px",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#8A87A0",
                        animation: "typingBounce 1.2s ease-in-out infinite",
                      }}
                    ></span>{" "}
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#8A87A0",
                        animation:
                          "typingBounce 1.2s ease-in-out infinite 0.15s",
                      }}
                    ></span>{" "}
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#8A87A0",
                        animation:
                          "typingBounce 1.2s ease-in-out infinite 0.3s",
                      }}
                    ></span>
                  </div>
                ) : null}
              </div>
              {!hasAskedQuestion ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "0 20px 16px",
                  }}
                >
                  {sampleQuestions.map((sq?: any, sqIdx?: any) => (
                    <div
                      key={sqIdx}
                      onClick={sq.onClick}
                      style={{
                        padding: "11px 14px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        fontSize: "13px",
                        color: "#D6D4E0",
                        cursor: "pointer",
                      }}
                    >
                      {sq.text}
                    </div>
                  ))}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  padding: "16px 20px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <input
                  value={chatInputValue}
                  onChange={onChatInputChange}
                  onKeyDown={onChatInputKeyDown}
                  placeholder="Ask a question…"
                  style={{
                    flex: "1",
                    minWidth: "0",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#F4F3F7",
                    fontSize: "14px",
                    fontFamily: "'Inter',sans-serif",
                    outline: "none",
                  }}
                />
                <div
                  onClick={onChatSend}
                  style={{
                    flexShrink: "0",
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="#0A0B0F"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div
            className="reveal"
            style={{
              maxWidth: "1300px",
              margin: "80px auto 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "56px",
              flexWrap: "wrap",
              opacity: "0.55",
              animationDelay: "0.35s",
            }}
          >
            <span
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "19px",
                letterSpacing: "-0.01em",
              }}
            >
              {"Northwind"}
            </span>{" "}
            <span
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "19px",
                letterSpacing: "-0.01em",
              }}
            >
              {"Fernway"}
            </span>{" "}
            <span
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "19px",
                letterSpacing: "-0.01em",
              }}
            >
              {"Lattice Labs"}
            </span>{" "}
            <span
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "19px",
                letterSpacing: "-0.01em",
              }}
            >
              {"Vaultra"}
            </span>{" "}
            <span
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "19px",
                letterSpacing: "-0.01em",
              }}
            >
              {"Corebase"}
            </span>
          </div>
        </div>
        <div style={{ padding: "100px 64px", background: "#0E0F16" }}>
          <div
            style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}
          >
            <div
              className="reveal"
              style={{
                fontSize: "14px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A87A0",
                marginBottom: "18px",
                fontWeight: "600",
              }}
            >
              {"The problem"}
            </div>
            <h2
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(24px,2.8vw,36px)",
                lineHeight: "1.3",
                letterSpacing: "-0.01em",
                margin: "0",
              }}
            >
              {
                " Support teams answer the same 20 questions all day, response times slip past 6 hours, and nights and weekends go completely unstaffed. "
              }
            </h2>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1.05fr 0.95fr",
              gap: "64px",
              alignItems: "center",
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
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"What is an AI chatbot?"}
              </div>
              <h2
                className="reveal"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3.2vw,42px)",
                  lineHeight: "1.18",
                  letterSpacing: "-0.01em",
                  margin: "0 0 22px",
                  animationDelay: "0.05s",
                }}
              >
                {
                  "Not a script. A system that reads your docs and answers like a teammate would."
                }
              </h2>
              <p
                className="reveal"
                style={{
                  fontSize: "15.5px",
                  color: "#B4B2C0",
                  lineHeight: "1.75",
                  margin: "0 0 18px",
                  animationDelay: "0.1s",
                }}
              >
                {
                  ' Older "chatbots" matched keywords to a fixed script — ask anything outside that script, and they broke. An AI chatbot works differently: it reads your help center, product docs, and past conversations, then uses a language model to understand the actual question being asked and generate an answer grounded in your real content. '
                }
              </p>
              <p
                className="reveal"
                style={{
                  fontSize: "15.5px",
                  color: "#B4B2C0",
                  lineHeight: "1.75",
                  margin: "0 0 18px",
                  animationDelay: "0.15s",
                }}
              >
                {
                  " That's the difference between \"I'm sorry, I didn't understand that\" and a genuinely useful answer, in your product's own language, cited back to the source doc it came from. "
                }
              </p>
              <div
                className="reveal"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  marginTop: "28px",
                  animationDelay: "0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color: "#57F2A4",
                      fontSize: "15px",
                      flexShrink: "0",
                    }}
                  >
                    {"✓"}
                  </span>{" "}
                  <span style={{ fontSize: "14px", color: "#D6D4E0" }}>
                    {
                      "Understands intent, not just keywords — paraphrased or misspelled questions still work."
                    }
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color: "#57F2A4",
                      fontSize: "15px",
                      flexShrink: "0",
                    }}
                  >
                    {"✓"}
                  </span>{" "}
                  <span style={{ fontSize: "14px", color: "#D6D4E0" }}>
                    {
                      "Grounded in your content — it can't invent policies or pricing you never wrote."
                    }
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color: "#57F2A4",
                      fontSize: "15px",
                      flexShrink: "0",
                    }}
                  >
                    {"✓"}
                  </span>{" "}
                  <span style={{ fontSize: "14px", color: "#D6D4E0" }}>
                    {
                      "Improves as your docs improve — no retraining, no engineering ticket."
                    }
                  </span>
                </div>
              </div>
            </div>
            <div
              className="reveal"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                animationDelay: "0.12s",
              }}
            >
              <div
                style={{
                  borderRadius: "20px",
                  overflow: "hidden",
                  aspectRatio: "4/3",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_102421_f3e9c91f-75de-428b-a6f7-ccf558a5e2d2.png"
                  alt="Customer typing a question into a website chat widget"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  loading="lazy"
                />
              </div>
              <div
                style={{
                  borderRadius: "20px",
                  overflow: "hidden",
                  aspectRatio: "16/9",
                }}
              >
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_102422_a8e80491-386e-470e-b130-b9bcc069de88.png"
                  alt="Neural network connecting documents and chat"
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
        </div>
        <div style={{ padding: "120px 64px", background: "#0E0F16" }}>
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
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"Advantages of a chatbot"}
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
                {"What it actually changes for a business."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))",
                gap: "24px",
              }}
            >
              {advantages.map((adv?: any, advIdx?: any) => (
                <div
                  key={advIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    padding: "30px 26px",
                    animationDelay: "{{ adv.delay }}",
                  }}
                >
                  <div style={{ fontSize: "26px", marginBottom: "16px" }}>
                    {adv.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16px",
                      fontWeight: "700",
                      marginBottom: "10px",
                    }}
                  >
                    {adv.title}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#8A87A0",
                      lineHeight: "1.55",
                      margin: "0 0 16px",
                    }}
                  >
                    {adv.desc}
                  </p>
                  <div
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      paddingTop: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#8CA0FF",
                        fontWeight: "700",
                        marginBottom: "6px",
                      }}
                    >
                      {"Real example"}
                    </div>
                    <p
                      style={{
                        fontSize: "12.5px",
                        color: "#B4B2C0",
                        lineHeight: "1.55",
                        margin: "0",
                      }}
                    >
                      {adv.example}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
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
                {"With an AI chatbot vs. without one."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0",
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ padding: "36px 32px", background: "#111219" }}>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#8A87A0",
                    marginBottom: "24px",
                  }}
                >
                  {"Traditional business"}
                </div>
                {comparisonRows.map((row?: any, rowIdx?: any) => (
                  <div
                    key={rowIdx}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                      padding: "14px 0",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      style={{
                        color: "#FF8A8A",
                        fontSize: "14px",
                        flexShrink: "0",
                      }}
                    >
                      {"✕"}
                    </span>{" "}
                    <span
                      style={{
                        fontSize: "13.5px",
                        color: "#B4B2C0",
                        lineHeight: "1.5",
                      }}
                    >
                      {row.without}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: "36px 32px",
                  background: "linear-gradient(160deg,#1B1440,#111219)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#8CA0FF",
                    marginBottom: "24px",
                  }}
                >
                  {"With an AI chatbot"}
                </div>
                {comparisonRows.map((row?: any, rowIdx?: any) => (
                  <div
                    key={rowIdx}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                      padding: "14px 0",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span
                      style={{
                        color: "#57F2A4",
                        fontSize: "14px",
                        flexShrink: "0",
                      }}
                    >
                      {"✓"}
                    </span>{" "}
                    <span
                      style={{
                        fontSize: "13.5px",
                        color: "#E7E5F0",
                        lineHeight: "1.5",
                      }}
                    >
                      {row.withBot}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div
          ref={howRef}
          style={{ padding: "120px 64px", background: "#0A0B0F" }}
        >
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
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
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"How it works"}
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
                {"Three steps. No engineers required."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "32px",
              }}
            >
              {howSteps.map((step?: any, stepIdx?: any) => (
                <div
                  key={stepIdx}
                  className="reveal"
                  style={{
                    textAlign: "center",
                    animationDelay: "{{ step.delay }}",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "#111219",
                      border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 20px",
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "20px",
                      fontWeight: "800",
                      color: "#8CA0FF",
                    }}
                  >
                    {step.num}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "700",
                      marginBottom: "10px",
                    }}
                  >
                    {step.title}
                  </div>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#8A87A0",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0E0F16" }}>
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
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"Capabilities"}
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
                {"Built to actually know your product."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: "24px",
              }}
            >
              {capabilities.map((cap?: any, capIdx?: any) => (
                <div
                  key={capIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    padding: "30px 26px",
                    animationDelay: "{{ cap.delay }}",
                  }}
                >
                  <div style={{ fontSize: "26px", marginBottom: "16px" }}>
                    {cap.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16px",
                      fontWeight: "700",
                      marginBottom: "10px",
                    }}
                  >
                    {cap.title}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#8A87A0",
                      lineHeight: "1.55",
                      margin: "0 0 12px",
                    }}
                  >
                    {cap.desc}
                  </p>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#57F2A4",
                      fontWeight: "600",
                    }}
                  >
                    {cap.proof}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "48px" }}
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
                {"Use cases"}
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
                {"Pick where it fits first."}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "40px",
                flexWrap: "wrap",
              }}
            >
              {useCaseTabs.map((tab?: any, tabIdx?: any) => (
                <div
                  key={tabIdx}
                  onClick={tab.onClick}
                  style={asStyle(tab.tabStyle)}
                >
                  {tab.label}
                </div>
              ))}
            </div>
            <div
              className="reveal"
              style={{
                background: "#111219",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "40px 44px",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontSize: "20px",
                  fontWeight: "700",
                  marginBottom: "14px",
                }}
              >
                {activeUseCase.title}
              </div>
              <p
                style={{
                  fontSize: "14.5px",
                  color: "#B4B2C0",
                  lineHeight: "1.7",
                  margin: "0",
                }}
              >
                {activeUseCase.desc}
              </p>
            </div>
          </div>
        </div>
        <div style={{ padding: "100px 64px", background: "#0E0F16" }}>
          <div
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div
              className="reveal"
              style={{
                fontSize: "14px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A87A0",
                marginBottom: "18px",
                fontWeight: "600",
              }}
            >
              {"Integrations"}
            </div>
            <h2
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(26px,3vw,38px)",
                letterSpacing: "-0.01em",
                margin: "0 0 48px",
              }}
            >
              {"Works where your team already is."}
            </h2>
            <div
              className="reveal"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: "16px",
              }}
            >
              {integrations.map((intg?: any, intgIdx?: any) => (
                <div
                  key={intgIdx}
                  style={{
                    padding: "22px 16px",
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#D6D4E0",
                  }}
                >
                  {intg}
                </div>
              ))}
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
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"Social proof"}
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
                {"Teams that made the switch."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
                gap: "24px",
              }}
            >
              {testimonials.map((t?: any, tIdx?: any) => (
                <div
                  key={tIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    padding: "30px",
                    animationDelay: "{{ t.delay }}",
                  }}
                >
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: "800",
                      color: "#57F2A4",
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      marginBottom: "14px",
                    }}
                  >
                    {t.stat}
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#D6D4E0",
                      lineHeight: "1.6",
                      margin: "0 0 20px",
                    }}
                  >
                    {'"'}
                    {t.quote}
                    {'"'}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <img
                      src={t.avatarSrc}
                      alt={t.name}
                      style={{
                        width: "40px",
                        height: "40px",
                        flexShrink: "0",
                        objectFit: "cover",
                        display: "block",
                        borderRadius: "50%",
                      }}
                      loading="lazy"
                    />
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: "700" }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#8A87A0" }}>
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "100px 64px", background: "#0E0F16" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "48px" }}
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
                {"Security & data handling"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3vw,38px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Your data is yours. Full stop."}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: "20px",
              }}
            >
              <div
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "16px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"SOC 2 Type II"}
                </div>
                <p
                  style={{ fontSize: "12.5px", color: "#8A87A0", margin: "0" }}
                >
                  {"Independently audited annually."}
                </p>
              </div>
              <div
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "16px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"GDPR compliant"}
                </div>
                <p
                  style={{ fontSize: "12.5px", color: "#8A87A0", margin: "0" }}
                >
                  {"EU data residency available."}
                </p>
              </div>
              <div
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "16px",
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {"Not used for training"}
                </div>
                <p
                  style={{ fontSize: "12.5px", color: "#8A87A0", margin: "0" }}
                >
                  {"Your conversations never improve our models."}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div
          ref={pricingRef}
          style={{ padding: "120px 64px", background: "#0A0B0F" }}
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
                  color: "#8A87A0",
                  marginBottom: "18px",
                  fontWeight: "600",
                }}
              >
                {"Pricing"}
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
                {"Simple, transparent, no surprises."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "24px",
              }}
            >
              {pricingTiers.map((tier?: any, tierIdx?: any) => (
                <div
                  key={tierIdx}
                  className="reveal"
                  style={asStyle(tier.cardStyle)}
                >
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16px",
                      fontWeight: "700",
                      marginBottom: "12px",
                    }}
                  >
                    {tier.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "6px",
                      marginBottom: "20px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Bricolage Grotesque',sans-serif",
                        fontSize: "36px",
                        fontWeight: "800",
                      }}
                    >
                      {tier.price}
                    </span>{" "}
                    <span style={{ fontSize: "13px", color: "#8A87A0" }}>
                      {tier.period}
                    </span>
                  </div>
                  <div style={asStyle(tier.ctaStyle)} onClick={tier.onClick}>
                    {tier.cta}
                  </div>
                  <div
                    style={{
                      marginTop: "24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {tier.features.map((f?: any, fIdx?: any) => (
                      <div
                        key={fIdx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "13px",
                          color: "#B4B2C0",
                        }}
                      >
                        <span style={{ color: "#57F2A4" }}>{"✓"}</span>
                        {f}{" "}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "100px 64px", background: "#0E0F16" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "48px" }}
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
                {"FAQ"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3vw,38px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Questions people actually ask."}
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
                  <span style={{ fontSize: "15px", fontWeight: "600" }}>
                    {faq.q}
                  </span>{" "}
                  <span
                    style={{
                      fontSize: "18px",
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
                      fontSize: "13.5px",
                      color: "#8A87A0",
                      lineHeight: "1.65",
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
            padding: "130px 64px",
            background: "linear-gradient(180deg,#0A0B0F 0%,#12143A 100%)",
            textAlign: "center",
          }}
        >
          <div
            className="reveal"
            style={{ maxWidth: "600px", margin: "0 auto" }}
          >
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(28px,3.6vw,46px)",
                lineHeight: "1.12",
                letterSpacing: "-0.02em",
                margin: "0 0 24px",
              }}
            >
              {"Answer 70% of tickets instantly."}
            </h2>
            <p
              style={{
                fontSize: "15.5px",
                color: "#ABA9B8",
                margin: "0 0 32px",
              }}
            >
              {"Free to try. No credit card. Live in minutes."}
            </p>
            <div
              onClick={scrollToPricing}
              style={{
                display: "inline-block",
                padding: "17px 32px",
                borderRadius: "12px",
                background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                color: "#0A0B0F",
                fontSize: "15px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {"Try it free"}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "56px 64px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <span style={{ fontSize: "13px", color: "#6E6C7C" }}>
            {"© 2026 AIAutomix."}
          </span>
          <div
            style={{
              display: "flex",
              gap: "24px",
              fontSize: "13px",
              color: "#8A87A0",
            }}
          >
            <Link href="/">{"Docs"}</Link> <Link href="/">{"Changelog"}</Link>{" "}
            <Link href="/">{"Contact"}</Link> <Link href="/">{"Legal"}</Link>
          </div>
        </div>
      </div>
    </>
  );
}
