"use client";

import { Fragment, type MouseEvent } from "react";
import Link from "next/link";
import { asStyle } from "@/lib/styles";
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
    @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    @keyframes processFlash { 0%,7% { left: -60%; } 15%,100% { left: 130%; } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
    @media (max-width: 900px) {
      .r-grid2 { grid-template-columns: 1fr !important; }
      .r-grid3 { grid-template-columns: 1fr 1fr !important; }
      .r-grid4 { grid-template-columns: 1fr 1fr !important; }
      .r-hero-visual { display: none !important; }
    }
    @media (max-width: 640px) {
      .r-grid3 { grid-template-columns: 1fr !important; }
      .r-grid4 { grid-template-columns: 1fr !important; }
      [style*="padding:20px 64px"] { padding-left: 20px !important; padding-right: 20px !important; }
    }
`;

function usePageVals() {
  const [state, setState] = useMergedState({
    faqOpenIdx: null as number | null,
    menuOpen: false,
  });
  const goConsult = () => {
    window.location.href = "/contact";
  };
  const toggleMenu = () => setState((s) => ({ menuOpen: !s.menuOpen }));
  const onMenuLinkEnter = (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "#E4E3FA";
    e.currentTarget.style.transform = "translateX(4px)";
    e.currentTarget.style.paddingLeft = "20px";
  };
  const onMenuLinkLeave = (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.transform = "translateX(0)";
    e.currentTarget.style.paddingLeft = "16px";
  };

  const floatDefs = [
    {
      icon: "📊",
      label: "Analytics",
      top: "0%",
      left: "0%",
      anchor: "left",
      dur: "5.5s",
    },
    {
      icon: "🔔",
      label: "Lead Notification",
      top: "8%",
      right: "0%",
      anchor: "right",
      dur: "6.2s",
    },
    {
      icon: "🤖",
      label: "AI Optimizer",
      top: "30%",
      left: "0%",
      anchor: "left",
      dur: "5s",
    },
    {
      icon: "🎯",
      label: "Conversion Funnel",
      top: "30%",
      right: "0%",
      anchor: "right",
      dur: "6.8s",
    },
    {
      icon: "👆",
      label: "CTA Click",
      top: "56%",
      left: "0%",
      anchor: "left",
      dur: "5.9s",
    },
    {
      icon: "👥",
      label: "Live Visitors",
      top: "82%",
      right: "30%",
      anchor: "right",
      dur: "6.4s",
    },
    {
      icon: "🗂️",
      label: "CRM Sync",
      top: "90%",
      left: "8%",
      anchor: "left",
      dur: "5.2s",
    },
    {
      icon: "⚙️",
      label: "Automation",
      top: "92%",
      right: "20%",
      anchor: "right",
      dur: "6.1s",
    },
  ];
  const floatCards = floatDefs.map((f, i) => ({
    icon: f.icon,
    label: f.label,
    style: {
      position: "absolute",
      top: f.top,
      ...(f.anchor === "right" ? { right: f.right } : { left: f.left }),
      maxWidth: "46%",
      zIndex: 2,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 14px",
      borderRadius: "100px",
      background: "rgba(255,255,255,0.06)",
      backdropFilter: "blur(14px)",
      border: "1px solid rgba(255,255,255,0.14)",
      fontSize: "12.5px",
      fontWeight: 600,
      color: "#F4F3F7",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      animation: "floatSlow " + f.dur + " ease-in-out infinite",
      animationDelay: i * 0.3 + "s",
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.4)",
    },
  }));

  const trustMetrics = [
    "Conversion-Focused Design",
    "Mobile-First Experience",
    "Lightning-Fast Performance",
    "SEO Optimized",
    "AI Ready",
    "Analytics Integrated",
  ];

  const failReasons = [
    "Confusing Headlines",
    "Weak Call-to-Action",
    "Slow Loading Speed",
    "Poor Mobile Experience",
    "No Trust Signals",
    "Low Conversion Rates",
    "Generic Messaging",
    "No A/B Testing",
  ].map((text, i) => ({ text, delay: i * 0.05 + "s" }));

  const landingServiceDefs = [
    {
      name: "Strategic Messaging",
      desc: "Communicate the right value proposition with clear, benefit-driven copy.",
    },
    {
      name: "Premium UI/UX Design",
      desc: "Modern, engaging layouts that guide users toward conversion.",
    },
    {
      name: "AI-Powered Personalization",
      desc: "Deliver smarter user experiences with AI-driven recommendations and dynamic content.",
    },
    {
      name: "Lead Capture Optimization",
      desc: "High-converting forms designed to maximize qualified leads.",
    },
    {
      name: "Conversion Copywriting",
      desc: "Persuasive headlines, compelling CTAs, and trust-building content.",
    },
    {
      name: "Speed Optimization",
      desc: "Fast-loading pages optimized for performance and Core Web Vitals.",
    },
    {
      name: "SEO Optimization",
      desc: "Search-engine-friendly landing pages with optimized structure and metadata.",
    },
    {
      name: "Marketing Integrations",
      desc: "Connect seamlessly with CRMs, email marketing tools, analytics, and automation platforms.",
    },
    {
      name: "A/B Testing",
      desc: "Continuously improve conversion rates with data-driven experimentation.",
    },
  ];
  const landingServices = landingServiceDefs.map((s, i) => ({
    ...s,
    delay: i * 0.05 + "s",
  }));

  const pageTypes = [
    "Lead Generation Landing Pages",
    "SaaS Landing Pages",
    "Product Launch Pages",
    "Startup MVP Pages",
    "Webinar Registration Pages",
    "Event Landing Pages",
    "Mobile App Landing Pages",
    "AI Product Landing Pages",
    "E-commerce Sales Pages",
    "Service Business Landing Pages",
    "Real Estate Landing Pages",
    "Healthcare Landing Pages",
    "Course Sales Pages",
    "Franchise Landing Pages",
    "B2B Landing Pages",
    "Local Business Landing Pages",
  ];

  const processDefs = [
    { title: "Business Discovery", icon: "🔍" },
    { title: "Audience Research", icon: "👥" },
    { title: "Conversion Strategy", icon: "🎯" },
    { title: "Wireframing", icon: "📐" },
    { title: "Copywriting", icon: "✍️" },
    { title: "UI Design", icon: "🎨" },
    { title: "Development", icon: "⚙️" },
    { title: "AI & CRM Integration", icon: "🤖" },
    { title: "Testing & Optimization", icon: "🧪" },
    { title: "Launch & Improvement", icon: "🚀" },
  ];
  const processSteps = processDefs.map((s, i) => ({
    title: s.title,
    icon: s.icon,
    numPad: String(i + 1).padStart(2, "0"),
    delay: i * 0.04 + "s",
    iconWrapStyle: {
      width: "40px",
      height: "40px",
      borderRadius: "11px",
      background: "rgba(124,92,255,0.12)",
      border: "1.5px solid rgba(124,92,255,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "17px",
      position: "relative",
      zIndex: 1,
    },
    flashStyle: {
      position: "absolute",
      top: 0,
      left: "-60%",
      width: "60%",
      height: "100%",
      background:
        "linear-gradient(100deg, transparent, rgba(124,92,255,0.25), transparent)",
      animation: "processFlash 9s ease-in-out infinite",
      animationDelay: i * 0.85 + "s",
      pointerEvents: "none",
    },
  }));

  const featureGroupDefs = [
    {
      title: "Conversion Optimization",
      items: [
        "Clear CTAs",
        "Benefit-driven messaging",
        "Social proof",
        "Trust badges",
      ],
    },
    {
      title: "User Experience",
      items: [
        "Responsive design",
        "Intuitive navigation",
        "Accessible layouts",
        "Mobile-first approach",
      ],
    },
    {
      title: "Performance",
      items: [
        "Fast loading",
        "Core Web Vitals optimization",
        "Image optimization",
        "CDN compatibility",
      ],
    },
    {
      title: "Integrations",
      items: [
        "CRM",
        "Email Marketing",
        "Analytics",
        "Payment Gateways",
        "Calendars",
        "AI Chatbots",
      ],
    },
  ];
  const featureGroups = featureGroupDefs.map((g, i) => ({
    ...g,
    delay: i * 0.06 + "s",
  }));

  const comparisonRows = [
    { old: "Attractive designs", newer: "Conversion-driven experiences" },
    { old: "Standard templates", newer: "Custom strategy for every campaign" },
    { old: "Basic development", newer: "AI-enhanced landing pages" },
    { old: "Limited analytics", newer: "Continuous optimization" },
    { old: "One-time delivery", newer: "Ongoing performance improvements" },
    { old: "Generic forms", newer: "Smart lead capture & automation" },
  ];

  const industries = [
    "SaaS",
    "AI Startups",
    "Real Estate",
    "Healthcare",
    "Education",
    "Finance",
    "Retail",
    "Manufacturing",
    "Professional Services",
    "Coaching & Consulting",
    "E-commerce",
    "Hospitality",
  ];

  const benefits = [
    "Increase lead generation",
    "Improve conversion rates",
    "Reduce cost per acquisition",
    "Deliver better user experiences",
    "Strengthen brand credibility",
    "Capture more qualified leads",
    "Integrate seamlessly with marketing tools",
    "Scale campaigns with confidence",
    "Optimize for SEO and paid advertising",
    "Drive measurable business growth",
  ];

  const successMetrics = [
    "Higher Conversion Rates",
    "Lower Bounce Rates",
    "Faster Load Times",
    "Increased Qualified Leads",
    "Better Ad ROI",
    "Improved Customer Engagement",
  ];

  const faqDefs = [
    {
      q: "What makes a landing page different from a website?",
      a: "A landing page is designed around a single objective — such as generating leads or sales — while a website typically serves multiple purposes and audiences.",
    },
    {
      q: "Can you create landing pages for Google Ads and Meta Ads?",
      a: "Yes. We build campaign-specific landing pages optimized for paid advertising, helping improve Quality Scores, reduce acquisition costs, and increase conversions.",
    },
    {
      q: "Will my landing page be mobile-friendly?",
      a: "Absolutely. Every landing page is fully responsive and optimized for smartphones, tablets, and desktops.",
    },
    {
      q: "Can you integrate CRM and marketing tools?",
      a: "Yes. We integrate with leading CRMs, email marketing platforms, analytics tools, calendars, payment gateways, and AI automation solutions.",
    },
    {
      q: "Do you offer A/B testing?",
      a: "Yes. We help test headlines, layouts, CTAs, forms, and other elements to continuously improve conversion performance.",
    },
    {
      q: "How long does it take to build a landing page?",
      a: "A standard high-converting landing page can often be designed and launched within 1–3 weeks, depending on the complexity and required integrations.",
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

  const relatedLinks = [
    {
      label: "AI Business Idea Validation",
      href: "/ai-business-idea-validation",
    },
    { label: "SaaS Product Development", href: "/saas-product-development" },
    { label: "Mobile App Development", href: "/mobile-app-development" },
    { label: "Website Development", href: "/website-development" },
    { label: "AI Automation Services", href: "/ai-agents" },
    { label: "CRM Development", href: "/crm" },
    { label: "Lead Generation", href: "/generate-leads" },
    { label: "AI Chatbot Solutions", href: "/ai-chatbot" },
    { label: "Contact Us", href: "/contact" },
  ];
  const relatedLinksLooped = [...relatedLinks, ...relatedLinks];

  const menuOverlayStyle = {
    position: "fixed",
    top: "76px",
    right: "64px",
    zIndex: 9000,
    width: "290px",
    overflow: "hidden",
    transformOrigin: "top right",
    transform: state.menuOpen ? "scaleY(1)" : "scaleY(0)",
    opacity: state.menuOpen ? 1 : 0,
    transition:
      "transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease",
    pointerEvents: state.menuOpen ? "auto" : "none",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };
  const menuLinkListStyle = {
    display: "flex",
    flexDirection: "column",
    background: "#FFFFFF",
    borderRadius: "16px",
    padding: "10px",
    boxShadow: "0 30px 70px -20px rgba(0,0,0,0.35)",
  };
  const menuLinkStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontFamily: "'Bricolage Grotesque',sans-serif",
    fontWeight: 700,
    fontSize: "15px",
    color: "#181A0E",
    textDecoration: "none",
    padding: "14px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    transition:
      "background 0.25s ease, transform 0.25s ease, padding-left 0.25s ease",
  };
  const menuLinkArrowStyle = {
    fontSize: "15px",
    color: "#8A87A0",
    transition: "transform 0.25s ease",
  };

  return {
    goConsult: goConsult,
    floatCards,
    trustMetrics,
    failReasons,
    landingServices,
    pageTypes,
    processSteps,
    featureGroups,
    comparisonRows,
    industries,
    benefits,
    successMetrics,
    faqs,
    relatedLinksLooped,
    menuOpen: state.menuOpen,
    toggleMenu: toggleMenu,
    menuOverlayStyle,
    menuLinkListStyle,
    menuLinkStyle,
    menuLinkArrowStyle,
    onMenuLinkEnter: onMenuLinkEnter,
    onMenuLinkLeave: onMenuLinkLeave,
  };
}

export function LandingPageDesignView() {
  const {
    goConsult,
    floatCards,
    trustMetrics,
    failReasons,
    landingServices,
    pageTypes,
    processSteps,
    featureGroups,
    comparisonRows,
    industries,
    benefits,
    successMetrics,
    faqs,
    relatedLinksLooped,
    menuOpen,
    toggleMenu,
    menuOverlayStyle,
    menuLinkListStyle,
    menuLinkStyle,
    menuLinkArrowStyle,
    onMenuLinkEnter,
    onMenuLinkLeave,
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
            padding: "22px 64px",
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
            <div
              onClick={goConsult}
              style={{
                padding: "11px 20px",
                borderRadius: "100px",
                background: "#F4F1EA",
                color: "#181A0E",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {"Let's Talk"}
            </div>
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
        <div style={asStyle(menuOverlayStyle)}>
          <div style={asStyle(menuLinkListStyle)}>
            <Link
              href="/"
              style={asStyle(menuLinkStyle)}
              onMouseEnter={onMenuLinkEnter}
              onMouseLeave={onMenuLinkLeave}
            >
              <span>{"Home"}</span>
              <span style={asStyle(menuLinkArrowStyle)}>{"→"}</span>
            </Link>{" "}
            <Link
              href="/services"
              style={asStyle(menuLinkStyle)}
              onMouseEnter={onMenuLinkEnter}
              onMouseLeave={onMenuLinkLeave}
            >
              <span>{"Services"}</span>
              <span style={asStyle(menuLinkArrowStyle)}>{"→"}</span>
            </Link>{" "}
            <span
              onClick={goConsult}
              style={asStyle(menuLinkStyle)}
              onMouseEnter={onMenuLinkEnter}
              onMouseLeave={onMenuLinkLeave}
            >
              <span>{"About"}</span>
              <span style={asStyle(menuLinkArrowStyle)}>{"→"}</span>
            </span>{" "}
            <Link
              href="/#news"
              style={asStyle(menuLinkStyle)}
              onMouseEnter={onMenuLinkEnter}
              onMouseLeave={onMenuLinkLeave}
            >
              <span>{"News"}</span>
              <span style={asStyle(menuLinkArrowStyle)}>{"→"}</span>
            </Link>{" "}
            <Link
              href="/contact"
              style={asStyle(menuLinkStyle)}
              onMouseEnter={onMenuLinkEnter}
              onMouseLeave={onMenuLinkLeave}
            >
              <span>{"Contact"}</span>
              <span style={asStyle(menuLinkArrowStyle)}>{"→"}</span>
            </Link>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            padding: "120px 64px 60px",
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
                "radial-gradient(ellipse at center, rgba(124,92,255,0.2), transparent 65%)",
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
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "56px",
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
                  marginBottom: "20px",
                  fontWeight: "600",
                }}
              >
                {"Landing Page Design"}
              </div>
              <h1
                className="reveal"
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(32px,4.4vw,54px)",
                  lineHeight: "1.12",
                  letterSpacing: "-0.02em",
                  margin: "0 0 24px",
                  animationDelay: "0.08s",
                }}
              >
                {" Landing Pages That Turn"}
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
                  {"Visitors Into Customers"}
                </span>
              </h1>
              <p
                className="reveal"
                style={{
                  fontSize: "16px",
                  color: "#ABA9B8",
                  maxWidth: "560px",
                  margin: "0 0 36px",
                  lineHeight: "1.7",
                  animationDelay: "0.16s",
                }}
              >
                {
                  " More than beautiful designs — we create AI-powered, conversion-focused landing pages that capture leads, increase sales, and maximize your marketing ROI. "
                }
              </p>
              <div
                className="reveal"
                style={{
                  display: "flex",
                  alignItems: "center",
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
                    background:
                      "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                    color: "#0A0B0F",
                    fontSize: "15px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {"Build My Landing Page"}
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
                  {"Get a Free Conversion Audit"}
                </div>
              </div>
            </div>
            <div
              className="r-hero-visual reveal"
              style={{
                position: "relative",
                height: "440px",
                animationDelay: "0.3s",
              }}
            >
              <div
                style={{
                  boxSizing: "border-box",
                  position: "absolute",
                  left: "8%",
                  top: "10%",
                  width: "70%",
                  height: "210px",
                  borderRadius: "16px",
                  background: "linear-gradient(160deg,#161826,#0E0F16)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 40px 90px -30px rgba(0,0,0,0.6)",
                  overflow: "hidden",
                  padding: "16px",
                }}
              >
                <div
                  style={{ display: "flex", gap: "6px", marginBottom: "14px" }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#FF6B6B",
                    }}
                  ></span>{" "}
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#F2C957",
                    }}
                  ></span>{" "}
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#57F2A4",
                    }}
                  ></span>
                </div>
                <div
                  style={{
                    width: "55%",
                    height: "14px",
                    borderRadius: "4px",
                    background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                    marginBottom: "12px",
                  }}
                ></div>
                <div
                  style={{
                    width: "80%",
                    height: "8px",
                    borderRadius: "4px",
                    background: "rgba(255,255,255,0.1)",
                    marginBottom: "8px",
                  }}
                ></div>
                <div
                  style={{
                    width: "65%",
                    height: "8px",
                    borderRadius: "4px",
                    background: "rgba(255,255,255,0.1)",
                    marginBottom: "20px",
                  }}
                ></div>
                <div
                  style={{
                    width: "130px",
                    height: "32px",
                    borderRadius: "8px",
                    background:
                      "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  }}
                ></div>
              </div>
              <div
                style={{
                  boxSizing: "border-box",
                  position: "absolute",
                  right: "10%",
                  bottom: "2%",
                  width: "110px",
                  height: "200px",
                  borderRadius: "24px",
                  background: "linear-gradient(160deg,#1B1440,#111219)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 30px 70px -20px rgba(0,0,0,0.55)",
                  overflow: "hidden",
                  padding: "14px 10px",
                }}
              >
                <div
                  style={{
                    width: "36%",
                    height: "5px",
                    borderRadius: "3px",
                    background: "rgba(255,255,255,0.3)",
                    margin: "0 auto 14px",
                  }}
                ></div>
                <div
                  style={{
                    width: "60%",
                    height: "10px",
                    borderRadius: "3px",
                    background: "linear-gradient(90deg,#57C7FF,#7C5CFF)",
                    marginBottom: "10px",
                  }}
                ></div>
                <div
                  style={{
                    width: "85%",
                    height: "6px",
                    borderRadius: "3px",
                    background: "rgba(255,255,255,0.1)",
                    marginBottom: "6px",
                  }}
                ></div>
                <div
                  style={{
                    width: "70%",
                    height: "6px",
                    borderRadius: "3px",
                    background: "rgba(255,255,255,0.1)",
                    marginBottom: "16px",
                  }}
                ></div>
                <div
                  style={{
                    width: "100%",
                    height: "24px",
                    borderRadius: "6px",
                    background:
                      "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  }}
                ></div>
              </div>
              {floatCards.map((fc, fcIdx) => (
                <div key={fcIdx} style={asStyle(fc.style)}>
                  {fc.icon} {fc.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "80px 64px", background: "#0E0F16" }}>
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <h2
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(24px,2.8vw,36px)",
                letterSpacing: "-0.01em",
                margin: "0 0 14px",
              }}
            >
              {"Designed to Convert, Not Just Impress"}
            </h2>
            <p
              className="reveal"
              style={{
                fontSize: "15.5px",
                color: "#ABA9B8",
                maxWidth: "640px",
                margin: "0 auto 36px",
                lineHeight: "1.7",
                animationDelay: "0.05s",
              }}
            >
              {
                "Every landing page we build is based on proven conversion principles, user psychology, and AI-driven optimization."
              }
            </p>
            <div
              className="reveal"
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "12px",
                animationDelay: "0.1s",
              }}
            >
              {trustMetrics.map((t, tIdx) => (
                <div
                  key={tIdx}
                  style={{
                    padding: "12px 20px",
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "100px",
                    fontSize: "13.5px",
                    color: "#D6D4E0",
                    fontWeight: "600",
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "48px" }}
            >
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.6vw,46px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Why Most Landing Pages Fail"}
              </h2>
            </div>
            <div
              className="r-grid4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "16px",
              }}
            >
              {failReasons.map((r, rIdx) => (
                <div
                  key={rIdx}
                  className="reveal"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "16px 18px",
                    background: "#111219",
                    border: "1px solid rgba(255,90,90,0.2)",
                    borderRadius: "12px",
                    boxShadow: "0 0 18px -6px rgba(255,90,90,0.3)",
                    animationDelay: "{{ r.delay }}",
                  }}
                >
                  <span style={{ color: "#FF6B6B" }}>{"✕"}</span>{" "}
                  <span
                    style={{
                      fontSize: "13.5px",
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
              {
                "A great landing page doesn't just attract visitors — it persuades them to take action."
              }
            </p>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(124,92,255,0.2), #0E0F16 60%)",
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
                {"Landing Pages Built for Maximum Conversions"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: "20px",
              }}
            >
              {landingServices.map((s, sIdx) => (
                <div
                  key={sIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    padding: "26px 24px",
                    position: "relative",
                    overflow: "hidden",
                    animationDelay: "{{ s.delay }}",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "0",
                      left: "0",
                      right: "0",
                      height: "3px",
                      background:
                        "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                    }}
                  ></div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16px",
                      fontWeight: "700",
                      marginBottom: "10px",
                      marginTop: "8px",
                    }}
                  >
                    {s.name}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#8A87A0",
                      lineHeight: "1.55",
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
                {"Landing Pages We Build"}
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
              {pageTypes.map((p, pIdx) => (
                <div
                  key={pIdx}
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
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0E0F16" }}>
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
                  marginBottom: "16px",
                  fontWeight: "700",
                }}
              >
                {"Our process"}
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
                {"From Click to Conversion"}
              </h2>
            </div>
            <div
              className="r-grid4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: "18px",
              }}
            >
              {processSteps.map((s, sIdx) => (
                <div
                  key={sIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    padding: "22px 18px",
                    position: "relative",
                    overflow: "hidden",
                    animationDelay: "{{ s.delay }}",
                  }}
                >
                  <div style={asStyle(s.flashStyle)}></div>
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "12px",
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "40px",
                      fontWeight: "800",
                      color: "rgba(124,92,255,0.1)",
                      lineHeight: "1",
                    }}
                  >
                    {s.numPad}
                  </div>
                  <div style={asStyle(s.iconWrapStyle)}>{s.icon}</div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "14.5px",
                      fontWeight: "700",
                      marginTop: "14px",
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
        <div style={{ padding: "100px 64px", background: "#0A0B0F" }}>
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "48px" }}
            >
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3.2vw,42px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Essential Features"}
              </h2>
            </div>
            <div
              className="r-grid4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "16px",
              }}
            >
              {featureGroups.map((g, gIdx) => (
                <div
                  key={gIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "22px 20px",
                    animationDelay: "{{ g.delay }}",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "14.5px",
                      fontWeight: "700",
                      marginBottom: "14px",
                      color: "#8CA0FF",
                    }}
                  >
                    {g.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {g.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        style={{ fontSize: "12.5px", color: "#B4B2C0" }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0E0F16" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
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
                {"Why Choose AIAutomix"}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div
                  style={{
                    padding: "18px 24px",
                    background: "#111219",
                    fontSize: "13px",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#8A87A0",
                    fontWeight: "700",
                  }}
                >
                  {"Traditional Web Agency"}
                </div>
                <div
                  style={{
                    padding: "18px 24px",
                    background: "linear-gradient(160deg,#1B1440,#111219)",
                    fontSize: "13px",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#8CA0FF",
                    fontWeight: "700",
                  }}
                >
                  {"AIAutomix"}
                </div>
              </div>
              {comparisonRows.map((row, rowIdx) => (
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
                      fontSize: "13.5px",
                      color: "#8A87A0",
                    }}
                  >
                    {row.old}
                  </div>
                  <div
                    style={{
                      padding: "18px 24px",
                      fontSize: "13.5px",
                      color: "#E7E5F0",
                      background: "rgba(124,92,255,0.05)",
                      fontWeight: "500",
                    }}
                  >
                    {row.newer}
                  </div>
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
                  color: "#1C160E",
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
                    background: "#FFFFFF",
                    border: "1px solid rgba(24,26,14,0.1)",
                    borderRadius: "100px",
                    fontSize: "13.5px",
                    color: "#3A3D28",
                    fontWeight: "500",
                  }}
                >
                  {ind}
                </div>
              ))}
            </div>
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
                {"Why Businesses Choose Our Landing Pages"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: "18px",
              }}
            >
              {benefits.map((b, bIdx) => (
                <div
                  key={bIdx}
                  className="reveal"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "18px 20px",
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                  }}
                >
                  <span style={{ color: "#57F2A4" }}>{"✓"}</span>{" "}
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#D6D4E0",
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
        <div
          style={{
            padding: "100px 64px",
            background: "linear-gradient(180deg,#0E0F16 0%,#12143A 100%)",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div className="reveal" style={{ marginBottom: "44px" }}>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(26px,3.2vw,42px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Success Metrics"}
              </h2>
            </div>
            <div
              className="reveal"
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "14px",
              }}
            >
              {successMetrics.map((m, mIdx) => (
                <div
                  key={mIdx}
                  style={{
                    padding: "16px 22px",
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "14px",
                    fontSize: "14px",
                    color: "#D6D4E0",
                    fontWeight: "600",
                  }}
                >
                  {m}
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
                "radial-gradient(ellipse at center, rgba(124,92,255,0.18), transparent 65%)",
              filter: "blur(45px)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            className="reveal"
            style={{
              maxWidth: "700px",
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
              {"Ready to Turn More Visitors Into Customers?"}
            </h2>
            <p
              style={{ fontSize: "16px", color: "#ABA9B8", margin: "0 0 36px" }}
            >
              {
                "Whether you're launching a new product, running paid ads, or growing your business, AIAutomix builds landing pages engineered for measurable results."
              }
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
                {"Build My Landing Page"}
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
                {"Book a Free Strategy Session"}
              </div>
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
              {relatedLinksLooped.map((rl, rlIdx) => (
                <a
                  key={rlIdx}
                  href={rl.href}
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
                  {rl.label}
                </a>
              ))}
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
