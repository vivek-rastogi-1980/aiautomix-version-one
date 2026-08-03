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
    @keyframes failFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    @keyframes processFlash { 0%,7% { left: -60%; } 15%,100% { left: 130%; } }
    .reveal { opacity: 0; animation: riseIn 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @keyframes relatedServicesMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
    @media (max-width: 900px) {
      .r-grid2 { grid-template-columns: 1fr !important; }
      .r-grid3 { grid-template-columns: 1fr 1fr !important; }
      .r-grid4 { grid-template-columns: 1fr 1fr !important; }
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

  const heroFlowDefs = [
    "👤 Founder",
    "🤖 AI Agents",
    "📐 Wireframe",
    "💻 Code",
    "☁️ Cloud",
    "👥 Users",
  ];
  const heroFlow = heroFlowDefs.map((s, i) => {
    const [icon, ...rest] = s.split(" ");
    return {
      icon,
      label: rest.join(" "),
      showArrow: i < heroFlowDefs.length - 1,
    };
  });

  const failReasons = [
    "No Product Validation",
    "Building Wrong Features",
    "Poor User Experience",
    "No Market Research",
    "Budget Overruns",
    "Slow Development",
    "Weak Architecture",
    "No Go-to-Market Strategy",
  ].map((text, i) => ({
    text,
    delay: i * 0.05 + "s",
    floatDur: 4.5 + (i % 3) * 0.6 + "s",
    floatDelay: i * 0.15 + "s",
  }));

  const processDefs = [
    { title: "Business Idea Validation", icon: "💡" },
    { title: "Market Research", icon: "📊" },
    { title: "Product Roadmap", icon: "🗺️" },
    { title: "UI/UX Design", icon: "🎨" },
    { title: "MVP Development", icon: "⚙️" },
    { title: "AI Integration", icon: "🤖" },
    { title: "Testing", icon: "🧪" },
    { title: "Deployment", icon: "🚀" },
    { title: "Growth & Scaling", icon: "📈" },
  ];
  const processSteps = processDefs.map((s, i) => ({
    title: s.title,
    icon: s.icon,
    num: i + 1,
    numPad: String(i + 1).padStart(2, "0"),
    delay: i * 0.05 + "s",
    dotWrapStyle: {
      width: "48px",
      height: "48px",
      borderRadius: "12px",
      background: "rgba(232,90,44,0.12)",
      border: "1.5px solid rgba(232,90,44,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
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
        "linear-gradient(100deg, transparent, rgba(232,90,44,0.28), transparent)",
      animation: "processFlash 8.1s ease-in-out infinite",
      animationDelay: i * 0.9 + "s",
      pointerEvents: "none",
    },
  }));

  const saasServiceDefs = [
    {
      name: "Product Discovery",
      icon: "🔍",
      items: [
        "Business validation",
        "Customer research",
        "Problem validation",
        "Market opportunity",
        "Pricing strategy",
      ],
    },
    {
      name: "SaaS Consulting",
      icon: "🧭",
      items: [
        "Architecture",
        "Technology selection",
        "Scalability planning",
        "Cloud strategy",
        "Roadmap",
      ],
    },
    {
      name: "UI/UX Design",
      icon: "🎨",
      items: [
        "Modern interfaces",
        "User journey",
        "Wireframes",
        "Prototypes",
        "Design system",
      ],
    },
    {
      name: "MVP Development",
      icon: "⚙️",
      items: [
        "Launch within weeks",
        "Core functionality",
        "Rapid iteration",
        "Customer feedback",
      ],
    },
    {
      name: "AI Integration",
      icon: "🤖",
      items: [
        "ChatGPT",
        "Claude",
        "AI Agents",
        "Voice AI",
        "Automation",
        "Predictive analytics",
      ],
    },
    {
      name: "Backend Development",
      icon: "🗄️",
      items: [
        "Microservices",
        "API Development",
        "Authentication",
        "Payment Gateway",
        "Database",
        "Cloud",
      ],
    },
    {
      name: "Frontend Development",
      icon: "💻",
      items: [
        "Next.js",
        "React",
        "Responsive",
        "Performance optimized",
        "SEO friendly",
        "Accessibility",
      ],
    },
    {
      name: "DevOps",
      icon: "🐳",
      items: ["Docker", "CI/CD", "AWS", "Azure", "GCP", "Monitoring"],
    },
    {
      name: "Maintenance",
      icon: "🛠️",
      items: [
        "Security",
        "Feature upgrades",
        "Performance",
        "Scaling",
        "Support",
      ],
    },
  ];
  const saasServices = saasServiceDefs.map((s, i) => ({
    ...s,
    delay: i * 0.05 + "s",
  }));

  const industries = [
    "Healthcare",
    "Education",
    "Real Estate",
    "Finance",
    "Retail",
    "Manufacturing",
    "Travel",
    "Legal",
    "HR",
    "CRM",
    "ERP",
    "Marketplace",
    "AI Products",
  ];

  const techGroupDefs = [
    { title: "Frontend", items: ["Next.js", "React", "Vue", "Angular"] },
    { title: "Backend", items: ["Node", "Laravel", "Python", ".NET"] },
    { title: "Database", items: ["PostgreSQL", "MySQL", "MongoDB", "Redis"] },
    { title: "Cloud", items: ["AWS", "Azure", "Google Cloud"] },
    { title: "AI", items: ["OpenAI", "Claude", "Gemini", "LangChain", "n8n"] },
  ];
  const techGroups = techGroupDefs.map((g, i) => ({
    ...g,
    delay: i * 0.06 + "s",
  }));

  const traditionalSteps = ["Writes code", "Delivers project", "Ends support"];
  const aiautomixSteps = [
    "Validates business",
    "Plans product",
    "Designs UX",
    "Develops MVP",
    "Adds AI",
    "Automates workflows",
    "Launches",
    "Scales",
    "Provides ongoing growth support",
  ];

  const packageDefs = [
    {
      name: "Startup MVP",
      items: [
        "Product validation",
        "UI Design",
        "MVP",
        "Authentication",
        "Dashboard",
        "Admin Panel",
        "API",
        "Deployment",
      ],
      cardStyle: {
        background: "#111219",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "18px",
        padding: "30px 26px",
      },
    },
    {
      name: "Growth Package",
      items: [
        "Everything in MVP",
        "AI Features",
        "CRM",
        "Automation",
        "Analytics",
        "Performance",
        "SEO",
      ],
      cardStyle: {
        background: "linear-gradient(160deg,#1B1440,#111219)",
        border: "1.5px solid rgba(140,92,255,0.4)",
        borderRadius: "18px",
        padding: "30px 26px",
        boxShadow: "0 20px 50px -20px rgba(124,92,255,0.35)",
      },
    },
    {
      name: "Enterprise",
      items: [
        "Everything",
        "Custom AI",
        "Advanced Security",
        "SSO",
        "Microservices",
        "Multi-tenant",
        "Global Deployment",
        "Priority Support",
      ],
      cardStyle: {
        background: "#111219",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "18px",
        padding: "30px 26px",
      },
    },
  ];
  const packages = packageDefs;

  const caseStudies = [
    "AI CRM",
    "Healthcare SaaS",
    "Education Platform",
    "Real Estate SaaS",
    "Food Delivery SaaS",
    "Marketplace",
    "Inventory Management",
    "HR Platform",
  ];

  const faqDefs = [
    {
      q: "How long does it take to build a SaaS product?",
      a: "A typical MVP can be launched in 8–12 weeks, while more complex SaaS platforms may take longer depending on features and integrations.",
    },
    {
      q: "Can you build an MVP first?",
      a: "Yes. We recommend starting with an MVP to validate your product with real users before investing in advanced functionality.",
    },
    {
      q: "Can you integrate AI into my SaaS?",
      a: "Absolutely. We build AI-powered features such as chatbots, voice assistants, recommendation engines, workflow automation, document intelligence, and predictive analytics.",
    },
    {
      q: "Which technologies do you use?",
      a: "We use modern stacks including Next.js, React, Node.js, Laravel, Python, PostgreSQL, Supabase, Docker, AWS, and AI platforms like OpenAI, Claude, and Gemini.",
    },
    {
      q: "Will my SaaS be scalable?",
      a: "Yes. We design cloud-native, scalable architectures that support growing users, data, and business needs.",
    },
    {
      q: "Do you provide post-launch support?",
      a: "Yes. We offer ongoing maintenance, feature enhancements, performance optimization, security updates, and growth consulting.",
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
    { label: "AI Automation Services", href: "/ai-agents" },
    { label: "Website Development", href: "/website-development" },
    { label: "Mobile App Development", href: "/services" },
    { label: "CRM Development", href: "/crm" },
    { label: "AI Voice Agent", href: "/ai-strategies-and-consulting" },
    { label: "Workflow Automation", href: "/ai-agents" },
    { label: "Business Plan Generator", href: "/create-a-business-plan" },
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
    heroFlow,
    failReasons,
    processSteps,
    saasServices,
    industries,
    techGroups,
    traditionalSteps,
    aiautomixSteps,
    packages,
    caseStudies,
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

export function SaasProductDevelopmentView() {
  const {
    goConsult,
    heroFlow,
    failReasons,
    processSteps,
    saasServices,
    industries,
    techGroups,
    traditionalSteps,
    aiautomixSteps,
    packages,
    caseStudies,
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
              {"SaaS Product Development"}
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
              {" Build Your SaaS Product Faster"}
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {"with AI"}
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
                " From idea validation to MVP development and enterprise-scale SaaS platforms, AIAutomix helps founders launch smarter, faster, and with less risk. "
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
                {"Build My SaaS"}
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
                {"Book Free Consultation"}
              </div>
            </div>
          </div>
          <div
            className="reveal"
            style={{
              maxWidth: "960px",
              margin: "64px auto 0",
              position: "relative",
              zIndex: "1",
              animationDelay: "0.32s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                flexWrap: "wrap",
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "20px",
                padding: "32px 24px",
              }}
            >
              {heroFlow.map((hf, hfIdx) => (
                <div
                  key={hfIdx}
                  style={{ display: "flex", alignItems: "center", gap: "14px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "14px",
                        background: "#111219",
                        border: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                      }}
                    >
                      {hf.icon}
                    </div>
                    <span
                      style={{
                        fontSize: "11.5px",
                        color: "#8A87A0",
                        fontWeight: "600",
                      }}
                    >
                      {hf.label}
                    </span>
                  </div>
                  {hf.showArrow ? (
                    <span style={{ color: "#4A4858", fontSize: "16px" }}>
                      {"→"}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "100px 64px",
            background: "rgb(244, 241, 234)",
            color: "#1C160E",
            textAlign: "center",
          }}
        >
          <div
            className="reveal"
            style={{ maxWidth: "800px", margin: "0 auto" }}
          >
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(28px,3.4vw,44px)",
                letterSpacing: "-0.01em",
                margin: "0 0 20px",
                color: "#1C160E",
              }}
            >
              {"From Idea to Successful SaaS"}
            </h2>
            <p
              style={{
                fontSize: "16px",
                color: "#5C5847",
                lineHeight: "1.75",
                margin: "0 0 14px",
              }}
            >
              {
                "Every successful SaaS begins with solving a real customer problem."
              }
            </p>
            <p
              style={{
                fontSize: "16px",
                color: "#5C5847",
                lineHeight: "1.75",
                margin: "0",
              }}
            >
              {
                " At AIAutomix, we help founders transform ideas into scalable software products using AI-driven validation, rapid MVP development, cloud-native architecture, and intelligent automation. Whether you're a startup, entrepreneur, or enterprise, our end-to-end SaaS development process helps reduce risk, accelerate time-to-market, and build products customers love. "
              }
            </p>
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
                {"Why Most SaaS Startups Fail"}
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
                    border: "1px solid rgba(255,90,90,0.25)",
                    borderRadius: "12px",
                    animation:
                      "riseIn 0.7s cubic-bezier(0.22,1,0.36,1) forwards, failFloat {{ r.floatDur }} ease-in-out infinite {{ r.floatDelay }}",
                    animationDelay: "{{ r.delay }}, {{ r.floatDelay }}",
                    boxShadow: "0 0 20px -6px rgba(255,90,90,0.35)",
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
              {"We solve these problems before they become expensive mistakes."}
            </p>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0E0F16" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
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
                {"Our AI-Powered SaaS Development Process"}
              </h2>
            </div>
            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "20px",
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
                    padding: "26px 22px",
                    position: "relative",
                    overflow: "hidden",
                    animationDelay: "{{ s.delay }}",
                  }}
                >
                  <div style={asStyle(s.flashStyle)}></div>
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "14px",
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "52px",
                      fontWeight: "800",
                      color: "rgba(232,90,44,0.1)",
                      lineHeight: "1",
                    }}
                  >
                    {s.numPad}
                  </div>
                  <div style={asStyle(s.dotWrapStyle)}>{s.icon}</div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16px",
                      fontWeight: "700",
                      marginTop: "16px",
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
                {"Complete SaaS Development Services"}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: "20px",
              }}
            >
              {saasServices.map((s, sIdx) => (
                <div
                  key={sIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    padding: "28px 24px",
                    animationDelay: "{{ s.delay }}",
                    position: "relative",
                    overflow: "hidden",
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
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: "rgba(124,92,255,0.12)",
                      border: "1px solid rgba(124,92,255,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      marginBottom: "18px",
                    }}
                  >
                    {s.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "16.5px",
                      fontWeight: "700",
                      marginBottom: "14px",
                      color: "#F4F3F7",
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}
                  >
                    {s.items.map((item, itemIdx) => (
                      <span
                        key={itemIdx}
                        style={{
                          fontSize: "12px",
                          color: "#B4B2C0",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "100px",
                          padding: "5px 11px",
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
                {"SaaS Solutions For"}
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
        <div
          style={{
            padding: "100px 64px",
            background:
              "radial-gradient(circle at 50% 20%, rgba(140,60,30,0.28), #0A0B0F 60%)",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
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
                gridTemplateColumns: "repeat(5,1fr)",
                gap: "16px",
              }}
            >
              {techGroups.map((g, gIdx) => (
                <div
                  key={gIdx}
                  className="reveal"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.1)",
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
                      color: "#F4F3F7",
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
                        style={{ fontSize: "12.5px", color: "#ABA9B8" }}
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
        <div
          style={{
            padding: "120px 64px",
            background: "rgb(244, 241, 234)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-10%",
              right: "5%",
              width: "420px",
              height: "420px",
              background:
                "radial-gradient(circle, rgba(124,92,255,0.1), transparent 70%)",
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
                  color: "#000000",
                  marginBottom: "16px",
                  fontWeight: "700",
                }}
              >
                {"The difference"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                  color: "#1C160E",
                }}
              >
                {"Why Choose AIAutomix"}
              </h2>
            </div>
            <div
              className="r-grid2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
                alignItems: "stretch",
              }}
            >
              <div
                className="reveal"
                style={{
                  background:
                    "linear-gradient(160deg, rgb(42, 14, 10), rgb(26, 9, 6))",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "20px",
                  padding: "36px 30px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#B4A89C",
                    fontWeight: "700",
                    marginBottom: "22px",
                  }}
                >
                  {"Traditional Agency"}
                </div>
                {traditionalSteps.map((t, tIdx) => (
                  <div
                    key={tIdx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 0",
                      borderTop: "1px solid rgba(212,175,55,0.35)",
                    }}
                  >
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#B4A89C",
                        fontSize: "13px",
                        flexShrink: "0",
                      }}
                    >
                      {"•"}
                    </span>{" "}
                    <span style={{ fontSize: "14.5px", color: "#C9BEB2" }}>
                      {t}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="reveal"
                style={{
                  background:
                    "linear-gradient(160deg, rgb(42, 14, 10), rgb(26, 9, 6))",
                  border: "1.5px solid rgba(124,92,255,0.35)",
                  borderRadius: "20px",
                  padding: "36px 30px",
                  boxShadow: "0 30px 70px -30px rgba(124,92,255,0.25)",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#F4F3F7",
                    fontWeight: "700",
                    marginBottom: "22px",
                  }}
                >
                  {"AIAutomix"}
                </div>
                {aiautomixSteps.map((t, tIdx) => (
                  <div
                    key={tIdx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 0",
                      borderTop: "1px solid rgba(212,175,55,0.35)",
                    }}
                  >
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "rgba(87,242,164,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#57F2A4",
                        fontSize: "12px",
                        flexShrink: "0",
                      }}
                    >
                      {"✓"}
                    </span>{" "}
                    <span
                      style={{
                        fontSize: "14.5px",
                        color: "#F4F3F7",
                        fontWeight: "500",
                      }}
                    >
                      {t}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
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
              {"Packages"}
            </h2>
          </div>
          <div
            className="r-grid3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: "20px",
            }}
          >
            {packages.map((p, pIdx) => (
              <div key={pIdx} className="reveal" style={asStyle(p.cardStyle)}>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "19px",
                    fontWeight: "800",
                    marginBottom: "18px",
                    color: "#F4F3F7",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {p.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                      }}
                    >
                      <span style={{ color: "#57F2A4", flexShrink: "0" }}>
                        {"✓"}
                      </span>{" "}
                      <span style={{ fontSize: "13.5px", color: "#D6D4E0" }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "100px 64px", background: "rgb(244, 241, 234)" }}>
        <div
          style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}
        >
          <div className="reveal" style={{ marginBottom: "44px" }}>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(26px,3.2vw,42px)",
                letterSpacing: "-0.01em",
                margin: "0",
                color: "#1C160E",
              }}
            >
              {"Case Studies"}
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
            {caseStudies.map((c, cIdx) => (
              <div
                key={cIdx}
                style={{
                  padding: "16px 22px",
                  background: "#FFFFFF",
                  border: "1px solid rgba(24,26,14,0.1)",
                  borderRadius: "14px",
                  fontSize: "14px",
                  color: "#3A3D28",
                  fontWeight: "600",
                }}
              >
                {c}
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
            {"Ready to Build Your SaaS Product?"}
          </h2>
          <p style={{ fontSize: "16px", color: "#ABA9B8", margin: "0 0 36px" }}>
            {
              "Transform your idea into a scalable, AI-powered SaaS platform with a partner who supports you from concept to growth."
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
              {"Start My SaaS Project"}
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
              {"Schedule a Free Strategy Call"}
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
    </>
  );
}
