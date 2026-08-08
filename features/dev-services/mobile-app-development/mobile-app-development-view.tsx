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
    { icon: "🤖", label: "AI Assistant", top: "0%", left: "0%", dur: "5.5s" },
    { icon: "📊", label: "Analytics", top: "10%", left: "72%", dur: "6.2s" },
    { icon: "💬", label: "Live Chat", top: "30%", left: "2%", dur: "5s" },
    {
      icon: "🔔",
      label: "Notifications",
      top: "46%",
      left: "76%",
      dur: "6.8s",
    },
    { icon: "📍", label: "GPS", top: "62%", left: "4%", dur: "5.9s" },
    { icon: "💳", label: "Payments", top: "78%", left: "70%", dur: "6.4s" },
    { icon: "🎙️", label: "Voice AI", top: "92%", left: "10%", dur: "5.2s" },
    { icon: "☁️", label: "Cloud Sync", top: "94%", left: "58%", dur: "6.1s" },
  ];
  const floatCards = floatDefs.map((f, i) => ({
    icon: f.icon,
    label: f.label,
    style: {
      position: "absolute",
      top: f.top,
      left: f.left,
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
      animation: "floatSlow " + f.dur + " ease-in-out infinite",
      animationDelay: i * 0.3 + "s",
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.4)",
    },
  }));

  const trustMetrics = [
    "100% Custom Development",
    "Android & iOS Experts",
    "AI-Ready Architecture",
    "Secure & Scalable Solutions",
  ];

  const failReasons = [
    "No Market Validation",
    "Poor User Experience",
    "Low User Retention",
    "Weak Performance",
    "Slow Development",
    "Security Issues",
    "No Monetization Strategy",
    "Lack of Scalability",
  ].map((text, i) => ({ text, delay: i * 0.05 + "s" }));

  const mobileServiceDefs = [
    {
      name: "Idea Validation",
      desc: "Validate market demand before development.",
    },
    {
      name: "Product Strategy",
      desc: "Define features, user journeys, and business goals.",
    },
    {
      name: "UI/UX Design",
      desc: "Create intuitive, modern, and engaging app experiences.",
    },
    {
      name: "Android App Development",
      desc: "High-performance native Android applications.",
    },
    {
      name: "iOS App Development",
      desc: "Beautiful, secure, and optimized iPhone and iPad applications.",
    },
    {
      name: "Cross-Platform Development",
      desc: "Launch on Android and iOS with Flutter or React Native.",
    },
    {
      name: "AI Integration",
      desc: "AI chatbots, voice assistants, image recognition, recommendation engines, predictive analytics, AI search, workflow automation.",
    },
    {
      name: "Backend Development",
      desc: "Robust APIs, cloud infrastructure, authentication, and scalable databases.",
    },
    {
      name: "App Testing",
      desc: "Comprehensive testing across devices for performance, security, and reliability.",
    },
    {
      name: "App Store Deployment",
      desc: "Complete publishing support for Google Play and Apple App Store.",
    },
    {
      name: "Maintenance & Growth",
      desc: "Continuous updates, monitoring, optimization, and feature enhancements.",
    },
  ];
  const mobileServices = mobileServiceDefs.map((s, i) => ({
    ...s,
    delay: i * 0.05 + "s",
  }));

  const appTypes = [
    "Business Apps",
    "E-commerce Apps",
    "Food Delivery Apps",
    "Healthcare Apps",
    "Education Apps",
    "Fitness Apps",
    "Real Estate Apps",
    "Booking Apps",
    "CRM Apps",
    "Marketplace Apps",
    "FinTech Apps",
    "Logistics Apps",
    "Travel Apps",
    "Event Apps",
    "Social Networking Apps",
    "AI-Powered Apps",
  ];

  const processDefs = [
    { title: "Business Discovery", icon: "🔍" },
    { title: "AI Idea Validation", icon: "💡" },
    { title: "UX Research", icon: "🧠" },
    { title: "Wireframing", icon: "📐" },
    { title: "UI Design", icon: "🎨" },
    { title: "Development", icon: "⚙️" },
    { title: "AI Integration", icon: "🤖" },
    { title: "Testing", icon: "🧪" },
    { title: "App Store Launch", icon: "🚀" },
    { title: "Growth & Support", icon: "📈" },
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
      background: "rgba(87,199,255,0.12)",
      border: "1.5px solid rgba(87,199,255,0.4)",
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
        "linear-gradient(100deg, transparent, rgba(87,199,255,0.25), transparent)",
      animation: "processFlash 9s ease-in-out infinite",
      animationDelay: i * 0.85 + "s",
      pointerEvents: "none",
    },
  }));

  const techGroupDefs = [
    { title: "Mobile", items: ["Flutter", "React Native", "Kotlin", "Swift"] },
    { title: "Frontend", items: ["React", "Next.js", "TypeScript"] },
    { title: "Backend", items: ["Node.js", "Laravel", "Python", ".NET"] },
    {
      title: "Database",
      items: ["PostgreSQL", "MongoDB", "MySQL", "Firebase", "Supabase"],
    },
    { title: "Cloud", items: ["AWS", "Azure", "Google Cloud"] },
    {
      title: "AI",
      items: ["OpenAI", "Claude", "Gemini", "LangChain", "n8n", "ElevenLabs"],
    },
  ];
  const techGroups = techGroupDefs.map((g, i) => ({
    ...g,
    delay: i * 0.06 + "s",
  }));

  const comparisonRows = [
    {
      old: "Develops what you request",
      newer: "Validates your idea before development",
    },
    { old: "Focuses on coding", newer: "Focuses on business outcomes" },
    { old: "Limited AI capabilities", newer: "AI-first mobile experiences" },
    { old: "Basic UI", newer: "Premium user-centric UX" },
    { old: "Launch-only support", newer: "Ongoing optimization and growth" },
    { old: "Standard development", newer: "End-to-end product partnership" },
  ];

  const industries = [
    "Healthcare",
    "Retail",
    "E-commerce",
    "Education",
    "Finance",
    "Logistics",
    "Travel",
    "Hospitality",
    "Food & Beverage",
    "Manufacturing",
    "Real Estate",
    "Professional Services",
    "AI Startups",
  ];

  const benefits = [
    "Faster time-to-market",
    "Exceptional user experience",
    "AI-powered functionality",
    "Secure and scalable architecture",
    "High performance across devices",
    "Future-ready technology stack",
    "Easy maintenance and updates",
    "Seamless third-party integrations",
    "Analytics-driven improvements",
    "Long-term technical partnership",
  ];

  const successMetrics = [
    "Faster Launch Cycles",
    "Higher User Engagement",
    "Improved App Store Ratings",
    "Increased Customer Retention",
    "Scalable Cloud Infrastructure",
    "AI-Driven User Experiences",
  ];

  const faqDefs = [
    {
      q: "Should I build an Android, iOS, or cross-platform app?",
      a: "The best choice depends on your audience, budget, timeline, and business goals. We help you choose the right technology before development begins.",
    },
    {
      q: "Can you build AI-powered mobile applications?",
      a: "Yes. We integrate conversational AI, voice assistants, recommendation engines, image recognition, predictive analytics, workflow automation, and other intelligent capabilities.",
    },
    {
      q: "How long does it take to develop a mobile app?",
      a: "A basic MVP typically takes 8–12 weeks, while feature-rich applications may require additional time depending on complexity.",
    },
    {
      q: "Will my app be scalable?",
      a: "Absolutely. We design cloud-native architectures that can grow with your users and business requirements.",
    },
    {
      q: "Can you publish my app to the App Store and Google Play?",
      a: "Yes. We manage the complete submission process, including testing, compliance, optimization, and launch.",
    },
    {
      q: "Do you provide maintenance after launch?",
      a: "Yes. We offer ongoing updates, security patches, feature enhancements, performance optimization, and technical support.",
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
    { label: "Website Development", href: "/website-development" },
    { label: "AI Automation Services", href: "/ai-agents" },
    { label: "AI Voice Agent", href: "/ai-strategies-and-consulting" },
    { label: "CRM Development", href: "/crm" },
    { label: "Workflow Automation", href: "/ai-agents" },
    { label: "UI/UX Design", href: "/services" },
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
    mobileServices,
    appTypes,
    processSteps,
    techGroups,
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

export function MobileAppDevelopmentView() {
  const {
    goConsult,
    floatCards,
    trustMetrics,
    failReasons,
    mobileServices,
    appTypes,
    processSteps,
    techGroups,
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
              href="/news"
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
                "radial-gradient(ellipse at center, rgba(87,199,255,0.2), transparent 65%)",
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
                {"Mobile App Development"}
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
                {" Transform Your App Idea into a"}
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
                  {"Powerful Mobile Experience"}
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
                  " From idea validation and UX design to AI integration, development, launch, and continuous growth — we build mobile applications that delight users and drive business results. "
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
                  {"Build My Mobile App"}
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
                  {"Book a Free Strategy Call"}
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
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%,-50%)",
                  width: "220px",
                  height: "400px",
                  borderRadius: "32px",
                  background: "linear-gradient(160deg,#161826,#0E0F16)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 40px 90px -30px rgba(0,0,0,0.6)",
                }}
              ></div>
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
              {"Trusted by Startups, SMEs & Growing Businesses"}
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
                "Build secure, scalable, and AI-powered mobile applications with a partner focused on business success — not just code."
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
                {"Why Most Mobile Apps Fail"}
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
                "Great apps solve real problems — not just technical challenges."
              }
            </p>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(30,80,140,0.25), #0E0F16 60%)",
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
                {"End-to-End Mobile App Development Services"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: "20px",
              }}
            >
              {mobileServices.map((s, sIdx) => (
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
                {"Mobile Apps We Build"}
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
              {appTypes.map((a, aIdx) => (
                <div
                  key={aIdx}
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
                  {a}
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
                {"Our development process"}
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
                {"From Idea to App Store"}
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
                      color: "rgba(87,199,255,0.1)",
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
                {"Technologies We Use"}
              </h2>
            </div>
            <div
              className="r-grid3"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,1fr)",
                gap: "16px",
              }}
            >
              {techGroups.map((g, gIdx) => (
                <div
                  key={gIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "20px 18px",
                    animationDelay: "{{ g.delay }}",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "14px",
                      fontWeight: "700",
                      marginBottom: "12px",
                      color: "#8CA0FF",
                    }}
                  >
                    {g.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
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
                  {"Traditional App Agency"}
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
                {"Why Businesses Choose Our Mobile Apps"}
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
                "radial-gradient(ellipse at center, rgba(87,199,255,0.18), transparent 65%)",
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
              {"Ready to Build Your Mobile Application?"}
            </h2>
            <p
              style={{ fontSize: "16px", color: "#ABA9B8", margin: "0 0 36px" }}
            >
              {
                "Whether you're launching a startup, modernizing an existing business, or creating the next breakthrough app, AIAutomix helps you build intelligent, scalable, and user-focused mobile applications."
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
                {"Start My Mobile App Project"}
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
                {"Schedule a Free Consultation"}
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
