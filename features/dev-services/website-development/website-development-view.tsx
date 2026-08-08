"use client";

import { Fragment, type ChangeEvent } from "react";
import Link from "next/link";
import { asStyle } from "@/lib/styles";
import { submitLead } from "@/lib/leads/submit";
import { useMergedState } from "@/hooks/use-merged-state";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    ::selection { background: #7C5CFF; color: #fff; }
    a { color: #8CA0FF; text-decoration: none; }
    a:hover { color: #B4C2FF; }
    input::placeholder, textarea::placeholder { color: #6E6C7C; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
    .reveal { opacity: 0; animation: riseIn 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @keyframes relatedServicesMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
    @media (max-width: 900px) {
      .r-grid2 { grid-template-columns: 1fr !important; }
      .r-grid3 { grid-template-columns: 1fr 1fr !important; }
    }
    @media (max-width: 640px) {
      .r-grid3 { grid-template-columns: 1fr !important; }
      [style*="padding:20px 64px"] { padding-left: 20px !important; padding-right: 20px !important; }
    }
`;

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function usePageVals() {
  const [state, setState] = useMergedState({
    faqOpenIdx: null as number | null,
    cName: "",
    cEmail: "",
    cMsg: "",
    contactSubmitted: false,
    contactError: "",
    menuOpen: false,
  });
  const goConsult = () => {
    window.location.href = "/contact";
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 4px",
    borderRadius: "0",
    border: "none",
    borderBottom: "1px solid rgba(24,26,14,0.14)",
    background: "transparent",
    color: "#181A0E",
    fontSize: "14.5px",
    outline: "none",
    fontFamily: "'Inter',sans-serif",
  };
  const textareaStyle = {
    ...inputStyle,
    minHeight: "80px",
    resize: "vertical",
    fontFamily: "inherit",
  };
  const submitBtnStyle = {
    marginTop: "10px",
    padding: "16px",
    borderRadius: "12px",
    background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
    color: "#0A0B0F",
    fontSize: "14.5px",
    fontWeight: 700,
    textAlign: "center",
    cursor: "pointer",
  };

  const trustDefs = [
    {
      text: "AI-Powered Website Strategy",
      desc: "Every site starts with a data-backed strategy for positioning, messaging, and conversion — not guesswork.",
      icon: "📊",
      bg: "#DCEBFB",
    },
    {
      text: "Mobile-First Responsive Design",
      desc: "Built to look and perform flawlessly on any device, starting from the smallest screen up.",
      icon: "📱",
      bg: "#EDE3FB",
    },
    {
      text: "SEO Optimized",
      desc: "Clean structure, fast markup, and proper metadata so your site is built to rank from day one.",
      icon: "🔍",
      bg: "#FBEADC",
    },
    {
      text: "Lightning Fast Performance",
      desc: "Optimized assets and code mean visitors never wait — and neither does Google.",
      icon: "⚡",
      bg: "#FDF3D1",
    },
    {
      text: "AI Chatbot Integration",
      desc: "A trained assistant that answers visitor questions instantly, day or night.",
      icon: "💬",
      bg: "#DDF3E8",
    },
    {
      text: "CRM Integration",
      desc: "Every lead and conversation flows straight into your CRM automatically.",
      icon: "🗂️",
      bg: "#DCEBFB",
    },
    {
      text: "Lead Generation Focus",
      desc: "Every page, form, and CTA is designed around turning visitors into qualified leads.",
      icon: "🎯",
      bg: "#FBE0E0",
    },
    {
      text: "Scalable Architecture",
      desc: "A technical foundation that grows with you — from a landing page to a full platform.",
      icon: "🏗️",
      bg: "#EDE3FB",
    },
  ];
  const trustPoints = trustDefs.map((t, i) => ({
    text: t.text,
    desc: t.desc,
    icon: t.icon,
    num: String(i + 1).padStart(2, "0"),
    cardStyle: {
      position: "relative",
      background: "#FFFFFF",
      border: "1px solid rgba(24,26,14,0.06)",
      borderRadius: "18px",
      padding: "28px 24px",
      boxShadow: "0 14px 34px -20px rgba(24,26,14,0.14)",
      animationDelay: i * 0.06 + "s",
    },
    numStyle: {
      position: "absolute",
      top: "20px",
      right: "22px",
      fontSize: "12px",
      fontWeight: 700,
      color: "#B6B2A0",
      fontFamily: "'Bricolage Grotesque',sans-serif",
    },
    iconWrapStyle: {
      width: "52px",
      height: "52px",
      borderRadius: "14px",
      background: t.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "22px",
      marginBottom: "20px",
    },
  }));
  const problems = [
    "Load slowly",
    "Rank poorly on Google",
    "Don't generate leads",
    "Lack automation",
    "Aren't mobile-friendly",
    "Don't convert visitors into customers",
  ].map((text, i) => ({
    text,
    pillStyle: {
      padding: "18px 28px",
      borderRadius: "100px",
      background: "linear-gradient(160deg, #2A0E0A, #1A0906)",
      border: "1px solid rgba(255,120,60,0.35)",
      boxShadow: "0 0 22px rgba(232,90,44,0.22)",
      fontSize: "14.5px",
      fontWeight: 700,
      color: "#F4F3F7",
      opacity: 1,
      animation:
        "floatSlow " +
        (4.5 + i * 0.4) +
        "s ease-in-out infinite " +
        i * 0.25 +
        "s",
    },
    pillHoverStyle: {
      boxShadow: "0 0 32px rgba(232,90,44,0.4)",
      transform: "translateY(-2px)",
    },
  }));

  const webServiceDefs = [
    {
      icon: "🏢",
      name: "Business Websites",
      desc: "Corporate websites designed for credibility and growth.",
    },
    {
      icon: "🚀",
      name: "Startup Websites",
      desc: "Modern websites that help startups launch faster.",
    },
    {
      icon: "🛒",
      name: "E-commerce Development",
      desc: "Sell products online with secure and scalable platforms.",
    },
    {
      icon: "🎯",
      name: "Landing Pages",
      desc: "High-converting landing pages for advertising campaigns.",
    },
    {
      icon: "💼",
      name: "Portfolio Websites",
      desc: "Showcase your expertise professionally.",
    },
    {
      icon: "🤖",
      name: "AI Website Development",
      desc: "AI chatbots, voice assistants, AI search, smart forms, AI recommendations.",
    },
    {
      icon: "♻️",
      name: "Website Redesign",
      desc: "Transform outdated websites into modern business assets.",
    },
  ];
  const webServices = webServiceDefs.map((s, i) => ({
    ...s,
    delay: i * 0.06 + "s",
  }));

  const features = [
    "Responsive Design",
    "SEO Friendly",
    "Fast Loading",
    "AI Chatbot",
    "WhatsApp Integration",
    "Lead Forms",
    "CRM Integration",
    "Analytics Dashboard",
    "Google Maps",
    "Appointment Booking",
    "Payment Gateway",
    "Blog",
    "CMS",
    "Security",
    "SSL",
    "Backup",
  ];
  const industries = [
    "Healthcare",
    "Real Estate",
    "Education",
    "Restaurants",
    "Retail",
    "Finance",
    "Manufacturing",
    "Travel",
    "Construction",
    "Legal",
    "Wellness",
    "NGOs",
  ];

  const processDefs = [
    { title: "Discovery", desc: "Understand your business goals." },
    { title: "Strategy", desc: "Plan user experience and SEO." },
    { title: "Design", desc: "Create modern UI/UX." },
    { title: "Development", desc: "Build responsive website." },
    { title: "AI Integration", desc: "Chatbot, CRM, Automation." },
    { title: "Testing", desc: "Performance and security testing." },
    { title: "Launch", desc: "Deploy live." },
    { title: "Support", desc: "Continuous improvement." },
  ];
  const processSteps = processDefs.map((p, i) => {
    const isLeft = i % 2 === 0;
    return {
      title: p.title,
      desc: p.desc,
      num: String(i + 1).padStart(2, "0"),
      delay: i * 0.08 + "s",
      rowStyle: {
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "48px",
        alignItems: "center",
        padding: "28px 0",
        animationDelay: i * 0.08 + "s",
      },
      cardStyle: {
        gridColumn: isLeft ? "1" : "2",
        textAlign: isLeft ? "right" : "left",
        background: "linear-gradient(160deg, #2A0E0A, #1A0906)",
        border: "1px solid rgba(255,120,60,0.25)",
        borderRadius: "16px",
        padding: "22px 24px",
      },
      numStyle: {
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontWeight: 800,
        fontSize: "13px",
        color: "#8CA0FF",
        letterSpacing: "0.05em",
        marginBottom: "8px",
      },
      dotStyle: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        background: "#B8481F",
        boxShadow:
          "0 0 0 4px rgba(232,90,44,0.25), 0 0 20px rgba(232,90,44,0.7)",
        zIndex: 2,
      },
      spacerStyle: { gridColumn: isLeft ? "2" : "1" },
    };
  });

  const technologies = [
    "Next.js",
    "React",
    "Laravel",
    "PHP",
    "Node.js",
    "WordPress",
    "Supabase",
    "MySQL",
    "MongoDB",
    "Tailwind CSS",
    "HTML5",
    "CSS3",
    "JavaScript",
    "Cloud Hosting",
  ];

  const aiFeatureDefs = [
    { icon: "💬", name: "AI Chatbot", desc: "24×7 customer support." },
    {
      icon: "📞",
      name: "AI Voice Agent",
      desc: "Answer customer calls automatically.",
    },
    {
      icon: "🎯",
      name: "AI Lead Qualification",
      desc: "Capture and score leads automatically.",
    },
    {
      icon: "📅",
      name: "AI Appointment Booking",
      desc: "Automate scheduling.",
    },
    {
      icon: "✉️",
      name: "AI Email Automation",
      desc: "Follow up with prospects.",
    },
    { icon: "🗂️", name: "AI CRM", desc: "Organize customer interactions." },
    { icon: "📊", name: "AI Analytics", desc: "Understand customer behavior." },
  ];
  const aiFeatures = aiFeatureDefs.map((a, i) => ({
    ...a,
    delay: i * 0.06 + "s",
  }));

  const ecosystem = [
    "Website",
    "CRM",
    "AI Automation",
    "Lead Generation",
    "Email Marketing",
    "Voice Agents",
    "WhatsApp Automation",
    "Business Analytics",
  ];

  const faqDefs = [
    {
      q: "How much does a website cost?",
      a: "Pricing depends on scope — from a focused landing page to a full AI-integrated business platform. Share your requirements on a free consultation call and we'll give you a clear quote.",
    },
    {
      q: "How long does development take?",
      a: "Most business websites launch in 3–6 weeks depending on complexity, content readiness, and AI integrations required.",
    },
    {
      q: "Will my website be SEO friendly?",
      a: "Yes — every site we build follows on-page SEO best practices: fast load times, clean structure, mobile-first design, and proper metadata.",
    },
    {
      q: "Can you redesign my existing website?",
      a: "Absolutely. We audit your current site, keep what works, and rebuild the rest for speed, conversions, and modern design.",
    },
    {
      q: "Can AI be integrated?",
      a: "Yes — chatbots, voice agents, lead qualification, CRM, and automated follow-ups can all be built into your website from day one.",
    },
    {
      q: "Do you provide maintenance?",
      a: "Yes, ongoing support plans cover updates, backups, security monitoring, and performance improvements.",
    },
    {
      q: "Can I update content myself?",
      a: "Yes — we build on a CMS so your team can update text, images, and blog posts without touching code.",
    },
  ];
  const faqs = faqDefs.map((f, i) => ({
    q: f.q,
    a: f.a,
    isOpen: state.faqOpenIdx === i,
    toggleSymbol: state.faqOpenIdx === i ? "−" : "+",
    onClick: () =>
      setState((s) => ({ faqOpenIdx: s.faqOpenIdx === i ? null : i })),
  }));

  return {
    menuOpen: state.menuOpen,
    toggleMenu: () => setState((s) => ({ menuOpen: !s.menuOpen })),
    goConsult: goConsult,
    trustPoints,
    problems,
    webServices,
    features,
    industries,
    processSteps,
    technologies,
    aiFeatures,
    ecosystem,
    faqs,
    inputStyle,
    textareaStyle,
    submitBtnStyle,
    cName: state.cName,
    cEmail: state.cEmail,
    cMsg: state.cMsg,
    onCName: (e: ChangeEvent<FieldElement>) =>
      setState({ cName: e.target.value }),
    onCEmail: (e: ChangeEvent<FieldElement>) =>
      setState({ cEmail: e.target.value }),
    onCMsg: (e: ChangeEvent<FieldElement>) =>
      setState({ cMsg: e.target.value }),
    contactSubmitted: state.contactSubmitted,
    submitContact: () => {
      if (!state.cName.trim() || !state.cEmail.trim()) return;

      // Was a `mailto:` handoff that reported success regardless of whether
      // anything was sent. Persists through /api/leads now.
      setState({ contactSubmitted: true, contactError: "" });

      void submitLead("contact", {
        name: state.cName,
        email: state.cEmail,
        message: state.cMsg,
      }).then((result) => {
        if (result.ok) return;
        setState({ contactSubmitted: false, contactError: result.message });
      });
    },
  };
}

export function WebsiteDevelopmentView() {
  const {
    menuOpen,
    toggleMenu,
    goConsult,
    trustPoints,
    problems,
    webServices,
    features,
    industries,
    processSteps,
    technologies,
    aiFeatures,
    ecosystem,
    faqs,
    inputStyle,
    textareaStyle,
    submitBtnStyle,
    cName,
    cEmail,
    cMsg,
    onCName,
    onCEmail,
    onCMsg,
    contactSubmitted,
    submitContact,
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
        <div
          style={{
            position: "sticky",
            top: "0",
            zIndex: "9500",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 64px",
            background: "rgba(10,11,15,0.75)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "52px",
                height: "52px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-220px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "0",
                  height: "0",
                  borderLeft: "76px solid transparent",
                  borderRight: "76px solid transparent",
                  borderTop: "240px solid rgba(255,255,255,0.13)",
                  filter: "blur(16px)",
                  mixBlendMode: "screen",
                  animation: "beamFlicker 3.2s ease-in-out infinite",
                  pointerEvents: "none",
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: "-220px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "0",
                  height: "0",
                  borderLeft: "14px solid transparent",
                  borderRight: "14px solid transparent",
                  borderTop: "230px solid rgba(255,255,255,0.6)",
                  filter: "blur(2.5px)",
                  mixBlendMode: "screen",
                  animation: "beamFlicker 3.2s ease-in-out infinite 0.15s",
                  pointerEvents: "none",
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: "-62px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "96px",
                  height: "90px",
                  background:
                    "radial-gradient(ellipse 48px 90px at 50% 0%, rgba(255,255,255,0.4), transparent 72%)",
                  mixBlendMode: "screen",
                  pointerEvents: "none",
                }}
              ></div>
              <img
                src="/assets/logo-ice2.png"
                style={{
                  position: "relative",
                  width: "52px",
                  height: "52px",
                  objectFit: "contain",
                  zIndex: "2",
                  filter:
                    "drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1)",
                  animation: "navLogoFloat 4.5s ease-in-out infinite",
                }}
                alt=""
              />
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link
              href="/contact"
              style={{
                padding: "11px 20px",
                borderRadius: "100px",
                background: "#181A0E",
                color: "#F4F1EA",
                fontSize: "13px",
                fontWeight: "600",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {"Let's Talk"}
            </Link>
            <div
              onClick={toggleMenu}
              style={{
                padding: "11px 22px",
                borderRadius: "100px",
                background: "#FFFFFF",
                color: "#181A0E",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {!menuOpen ? <>{"MENU"}</> : null}
              {menuOpen ? <>{"CLOSE"}</> : null}
            </div>
          </div>
        </div>
        {menuOpen ? (
          <div
            style={{
              position: "fixed",
              inset: "0",
              zIndex: "9400",
              background: "#E9F2C6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <Link
                href="/"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(28px,4.2vw,48px)",
                  color: "#181A0E",
                  textDecoration: "none",
                  padding: "6px 24px",
                  borderRadius: "12px",
                }}
              >
                {"Home"}
              </Link>{" "}
              <Link
                href="/services"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(28px,4.2vw,48px)",
                  color: "#181A0E",
                  textDecoration: "none",
                  padding: "6px 24px",
                  borderRadius: "12px",
                }}
              >
                {"Services"}
              </Link>{" "}
              <Link
                href="/contact"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(28px,4.2vw,48px)",
                  color: "#181A0E",
                  textDecoration: "none",
                  padding: "6px 24px",
                  borderRadius: "12px",
                }}
              >
                {"About"}
              </Link>{" "}
              <Link
                href="/news"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(28px,4.2vw,48px)",
                  color: "#181A0E",
                  textDecoration: "none",
                  padding: "6px 24px",
                  borderRadius: "12px",
                }}
              >
                {"News"}
              </Link>{" "}
              <Link
                href="/contact"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(28px,4.2vw,48px)",
                  color: "#181A0E",
                  textDecoration: "none",
                  padding: "6px 24px",
                  borderRadius: "12px",
                }}
              >
                {"Contact"}
              </Link>
            </div>
          </div>
        ) : null}
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
              maxWidth: "840px",
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
              {"Website Development"}
            </div>
            <h1
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(32px,4.6vw,58px)",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                margin: "0 0 24px",
                animationDelay: "0.08s",
              }}
            >
              {" Build Websites That Don't Just Look Great"}
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {"They Grow Your Business"}
              </span>
            </h1>
            <p
              className="reveal"
              style={{
                fontSize: "16.5px",
                color: "#ABA9B8",
                maxWidth: "640px",
                margin: "0 auto 36px",
                lineHeight: "1.7",
                animationDelay: "0.16s",
              }}
            >
              {
                " We design high-performance, AI-powered websites that attract visitors, generate leads, automate customer engagement, and help your business grow faster. "
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
                onClick={goConsult}
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
                {"Get Free Consultation"}
              </div>
              <div
                onClick={goConsult}
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
                {"Request a Quote"}
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background: "rgb(244,241,234)",
            color: "#181A0E",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-10%",
              right: "5%",
              width: "380px",
              height: "380px",
              background:
                "radial-gradient(circle, rgba(87,199,255,0.18), transparent 70%)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "1300px",
              margin: "0 auto",
              position: "relative",
              zIndex: "1",
            }}
          >
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "64px" }}
            >
              <div
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8A8676",
                  marginBottom: "16px",
                  fontWeight: "600",
                }}
              >
                {"Trusted approach"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.6vw,46px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Why Businesses Choose AIAutoMix"}
              </h2>
            </div>
            <div
              className="r-grid2"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "20px",
              }}
            >
              {trustPoints.map((t, tIdx) => (
                <div key={tIdx} className="reveal" style={asStyle(t.cardStyle)}>
                  <span style={asStyle(t.numStyle)}>{t.num}</span>
                  <div style={asStyle(t.iconWrapStyle)}>{t.icon}</div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16.5px",
                      fontWeight: "700",
                      color: "#181A0E",
                      marginBottom: "10px",
                    }}
                  >
                    {t.text}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#7A7663",
                      lineHeight: "1.6",
                      margin: "0",
                    }}
                  >
                    {t.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "140px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(140,60,30,0.28), #0A0B0F 60%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: "960px",
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
                fontSize: "clamp(28px,3.6vw,46px)",
                lineHeight: "1.2",
                letterSpacing: "-0.01em",
                margin: "0 0 20px",
              }}
            >
              {"Is Your Website Costing You Customers?"}
            </h2>
            <p
              className="reveal"
              style={{
                fontSize: "16px",
                color: "#ABA9B8",
                margin: "0 0 44px",
                animationDelay: "0.05s",
              }}
            >
              {
                "Many business websites fall short in the exact places that cost you customers:"
              }
            </p>
            <div
              className="r-grid3"
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "16px",
              }}
            >
              {problems.map((p, pIdx) => (
                <div
                  key={pIdx}
                  style={asStyle(p.pillStyle)}
                  onMouseEnter={(e) =>
                    Object.assign(e.currentTarget.style, p.pillHoverStyle)
                  }
                  onMouseLeave={(e) =>
                    Object.assign(e.currentTarget.style, p.pillStyle)
                  }
                >
                  {p.text}
                </div>
              ))}
            </div>
            <p
              className="reveal"
              style={{
                fontSize: "15.5px",
                color: "#F4F3F7",
                fontWeight: "600",
                margin: "44px 0 0",
              }}
            >
              {
                "AIAutomix fixes every one of these before your next customer leaves."
              }
            </p>
          </div>
        </div>
        <div
          style={{
            padding: "100px 64px",
            background: "rgb(244,241,234)",
            textAlign: "center",
          }}
        >
          <div
            className="reveal"
            style={{ maxWidth: "760px", margin: "0 auto" }}
          >
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(28px,3.4vw,44px)",
                letterSpacing: "-0.01em",
                margin: "0 0 20px",
                color: "#181A0E",
              }}
            >
              {"Websites Built for Growth"}
            </h2>
            <p
              style={{
                fontSize: "16.5px",
                color: "#5C5847",
                lineHeight: "1.7",
                margin: "0",
              }}
            >
              {
                " At AIAutoMix, we combine beautiful design with AI, automation, SEO, and conversion optimization to create websites that become your 24/7 sales engine. "
              }
            </p>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(140,60,30,0.28), #0A0B0F 60%)",
          }}
        >
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
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
                {"Services"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: "20px",
              }}
            >
              {webServices.map((s, sIdx) => (
                <div
                  key={sIdx}
                  className="reveal"
                  style={{
                    background: "rgba(255,246,240,0.06)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,120,60,0.2)",
                    borderRadius: "16px",
                    padding: "26px 24px",
                    animationDelay: "{{ s.delay }}",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "14px" }}>
                    {s.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16px",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    {s.name}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#8A87A0",
                      lineHeight: "1.5",
                      margin: "0",
                    }}
                  >
                    {s.desc}
                  </p>
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
              style={{ textAlign: "center", marginBottom: "56px" }}
            >
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                  color: "#181A0E",
                }}
              >
                {"Website Features"}
              </h2>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
              }}
            >
              {features.map((f, fIdx) => (
                <div
                  key={fIdx}
                  style={{
                    padding: "11px 18px",
                    background: "#FFFFFF",
                    border: "1px solid rgba(24,26,14,0.1)",
                    borderRadius: "100px",
                    fontSize: "13px",
                    color: "#3A3D28",
                    fontWeight: "500",
                  }}
                >
                  {f}
                </div>
              ))}
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
            <div className="reveal" style={{ marginBottom: "36px" }}>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3vw,38px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Industries We Serve"}
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
              {industries.map((ind, indIdx) => (
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
          style={{
            padding: "140px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(140,60,30,0.28), #0A0B0F 60%)",
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
              width: "600px",
              height: "600px",
              background:
                "radial-gradient(circle, rgba(124,92,255,0.12), transparent 70%)",
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
              style={{ textAlign: "center", marginBottom: "80px" }}
            >
              <div
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8CA0FF",
                  marginBottom: "16px",
                  fontWeight: "700",
                }}
              >
                {"From idea to launch"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.6vw,46px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Development Process"}
              </h2>
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "0",
                  bottom: "0",
                  width: "1px",
                  background:
                    "linear-gradient(180deg,transparent,rgba(232,90,44,0.45),transparent)",
                  transform: "translateX(-50%)",
                }}
              ></div>
              {processSteps.map((s, sIdx) => (
                <div key={sIdx} className="reveal" style={asStyle(s.rowStyle)}>
                  <div style={asStyle(s.cardStyle)}>
                    <div style={asStyle(s.numStyle)}>{s.num}</div>
                    <div
                      style={{
                        fontFamily: "'Bricolage Grotesque',sans-serif",
                        fontSize: "17px",
                        fontWeight: "700",
                        marginBottom: "6px",
                        color: "#F4F3F7",
                      }}
                    >
                      {s.title}
                    </div>
                    <p
                      style={{
                        fontSize: "13.5px",
                        color: "#8A87A0",
                        margin: "0",
                        lineHeight: "1.55",
                      }}
                    >
                      {s.desc}
                    </p>
                  </div>
                  <div style={asStyle(s.dotStyle)}></div>
                  <div style={asStyle(s.spacerStyle)}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{ padding: "100px 64px", background: "rgb(244, 241, 234)" }}
        >
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div className="reveal" style={{ marginBottom: "36px" }}>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3vw,38px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                  color: "#181A0E",
                }}
              >
                {"Technologies We Use"}
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
              {technologies.map((tech, techIdx) => (
                <div
                  key={techIdx}
                  style={{
                    padding: "11px 18px",
                    background: "#FFFFFF",
                    border: "1px solid rgba(24,26,14,0.1)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    color: "#3A3D28",
                    fontWeight: "600",
                  }}
                >
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(140,60,30,0.28), #0A0B0F 60%)",
          }}
        >
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "56px" }}
            >
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
                {"What sets us apart"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.6vw,48px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"AI Features"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: "20px",
              }}
            >
              {aiFeatures.map((a, aIdx) => (
                <div
                  key={aIdx}
                  className="reveal"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    padding: "26px 22px",
                    animationDelay: "{{ a.delay }}",
                  }}
                >
                  <div style={{ fontSize: "22px", marginBottom: "12px" }}>
                    {a.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "15.5px",
                      fontWeight: "700",
                      marginBottom: "6px",
                    }}
                  >
                    {a.name}
                  </div>
                  <p
                    style={{
                      fontSize: "12.5px",
                      color: "#ABA9B8",
                      margin: "0",
                      lineHeight: "1.5",
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
            padding: "140px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(140,60,30,0.28), #0A0B0F 60%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: "-10%",
              left: "10%",
              width: "500px",
              height: "500px",
              background:
                "radial-gradient(circle, rgba(124,92,255,0.16), transparent 70%)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            className="r-grid2"
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "0.9fr 1.1fr",
              gap: "56px",
              alignItems: "center",
              position: "relative",
              zIndex: "1",
            }}
          >
            <div className="reveal">
              <div
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8CA0FF",
                  marginBottom: "16px",
                  fontWeight: "700",
                }}
              >
                {"Beyond a website"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  lineHeight: "1.15",
                  letterSpacing: "-0.01em",
                  margin: "0 0 20px",
                }}
              >
                {"Why AIAutomix"}
              </h2>
              <p
                style={{
                  fontSize: "15.5px",
                  color: "#ABA9B8",
                  lineHeight: "1.7",
                  margin: "0",
                }}
              >
                {
                  "Instead of only creating websites, we build complete digital business ecosystems."
                }
              </p>
            </div>
            <div
              className="reveal"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "20px",
                padding: "28px",
                display: "grid",
                gridTemplateColumns: "repeat(2,1fr)",
                gap: "14px",
              }}
            >
              {ecosystem.map((e, eIdx) => (
                <div
                  key={eIdx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "10px",
                  }}
                >
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "rgba(87,242,164,0.15)",
                      color: "#57F2A4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      flexShrink: "0",
                    }}
                  >
                    {"✓"}
                  </span>{" "}
                  <span
                    style={{
                      fontSize: "13.5px",
                      color: "#E7E5F0",
                      fontWeight: "600",
                    }}
                  >
                    {e}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(140,60,30,0.28), #0A0B0F 60%)",
          }}
        >
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
            {faqs.map((faq, faqIdx) => (
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
              {"Ready to Build a Website That Grows Your Business?"}
            </h2>
            <p
              style={{ fontSize: "16px", color: "#ABA9B8", margin: "0 0 36px" }}
            >
              {
                "Let's create an AI-powered website that attracts visitors, converts leads, and scales with your business."
              }
            </p>
            <div
              onClick={goConsult}
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
              {"Schedule Free Consultation"}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "80px 0",
            background: "#0E0F16",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto 32px",
              padding: "0 64px",
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontSize: "12.5px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A87A0",
                fontWeight: "600",
              }}
            >
              {"Explore related services"}
            </div>
          </div>
          <div
            style={{
              position: "relative",
              width: "100%",
              overflow: "hidden",
              maskImage:
                "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "14px",
                width: "max-content",
                animation: "relatedServicesMarquee 30s linear infinite",
              }}
            >
              <Link
                href="/ai-agents"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"AI Automation"}
              </Link>{" "}
              <Link
                href="/ai-chatbot"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"AI Chatbots"}
              </Link>{" "}
              <Link
                href="/ai-strategies-and-consulting"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"AI Voice Agents"}
              </Link>{" "}
              <Link
                href="/crm"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"CRM Solutions"}
              </Link>{" "}
              <Link
                href="/generate-leads"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"Lead Generation"}
              </Link>{" "}
              <Link
                href="/services"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"Mobile App Development"}
              </Link>{" "}
              <Link
                href="/create-marketing-plan"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"Digital Marketing"}
              </Link>{" "}
              <Link
                href="/services"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"SEO Services"}
              </Link>{" "}
              <Link
                href="/ai-agents"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"AI Automation"}
              </Link>{" "}
              <Link
                href="/ai-chatbot"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"AI Chatbots"}
              </Link>{" "}
              <Link
                href="/ai-strategies-and-consulting"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"AI Voice Agents"}
              </Link>{" "}
              <Link
                href="/crm"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"CRM Solutions"}
              </Link>{" "}
              <Link
                href="/generate-leads"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"Lead Generation"}
              </Link>{" "}
              <Link
                href="/services"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"Mobile App Development"}
              </Link>{" "}
              <Link
                href="/create-marketing-plan"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"Digital Marketing"}
              </Link>{" "}
              <Link
                href="/services"
                style={{
                  padding: "10px 18px",
                  borderRadius: "100px",
                  background: "#161826",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13.5px",
                  color: "#D6D4E0",
                  whiteSpace: "nowrap",
                }}
              >
                {"SEO Services"}
              </Link>
            </div>
          </div>
        </div>
        <div
          style={{ padding: "100px 64px", background: "rgb(244, 241, 234)" }}
        >
          <div
            className="r-grid2"
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "56px",
              alignItems: "start",
            }}
          >
            <div className="reveal">
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(24px,2.8vw,36px)",
                  letterSpacing: "-0.01em",
                  margin: "0 0 24px",
                  color: "#181A0E",
                }}
              >
                {"Let's Talk About Your Website"}
              </h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <a
                  href="mailto:contact@aiautomix.com"
                  style={{ fontSize: "14.5px", color: "#3A3D28" }}
                >
                  {"✉️ contact@aiautomix.com"}
                </a>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <a
                    href="https://www.linkedin.com/company/aiautomix"
                    target="_blank"
                    rel="noopener"
                    style={{ fontSize: "13px", color: "#7A7663" }}
                  >
                    {"LinkedIn"}
                  </a>{" "}
                  <a
                    href="https://www.instagram.com/aiautomationmix"
                    target="_blank"
                    rel="noopener"
                    style={{ fontSize: "13px", color: "#7A7663" }}
                  >
                    {"Instagram"}
                  </a>{" "}
                  <a
                    href="https://www.youtube.com/@AIAutomix"
                    target="_blank"
                    rel="noopener"
                    style={{ fontSize: "13px", color: "#7A7663" }}
                  >
                    {"YouTube"}
                  </a>
                </div>
              </div>
            </div>
            <div
              className="reveal"
              style={{
                background: "#FFFFFF",
                border: "none",
                borderRadius: "20px",
                padding: "36px",
                boxShadow: "0 24px 60px -24px rgba(24,26,14,0.2)",
              }}
            >
              {contactSubmitted ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>
                    {"✓"}
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: "600",
                      color: "#181A0E",
                    }}
                  >
                    {"Thanks! We'll be in touch shortly."}
                  </div>
                </div>
              ) : null}
              {!contactSubmitted ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "22px",
                  }}
                >
                  <input
                    value={cName}
                    onChange={onCName}
                    placeholder="Your name"
                    style={asStyle(inputStyle)}
                  />
                  <input
                    value={cEmail}
                    onChange={onCEmail}
                    placeholder="Email address"
                    style={asStyle(inputStyle)}
                  />
                  <textarea
                    value={cMsg}
                    onChange={onCMsg}
                    placeholder="Tell us about your project…"
                    style={asStyle(textareaStyle)}
                  ></textarea>
                  <div onClick={submitContact} style={asStyle(submitBtnStyle)}>
                    {"Send Message"}
                  </div>
                </div>
              ) : null}
            </div>
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
