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
    a { color: #8CA0FF; }
    a:hover { color: #B4C2FF; }
    input::placeholder, textarea::placeholder { color: #6E6C7C; }
    @keyframes riseIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    @keyframes servicesMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes marketingMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes devFloat1 { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-12px) scale(1); } }
    @keyframes devFloat2 { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-16px) scale(1); } }
    .reveal { opacity: 0; animation: riseIn 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
    [style*="cursor:pointer"], [style*="cursor: pointer"] { transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), filter 0.22s ease; }
    [style*="cursor:pointer"]:hover, [style*="cursor: pointer"]:hover { transform: scale(1.03); filter: brightness(1.05); }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; } }
  .site-menu-link:hover { background: #E4E3FA; }
      @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
`;

const INITIAL_STATE = {
  devHover: null as number | null,
  devRevealed: [false, false, false, false],
  devTypedLen: [0, 0, 0, 0],
  servicesMarqueeHovered: false,
  marketingMarqueeHovered: false,
  auHover: null as number | null,
  auFlipped: [false, false, false, false],
};
type PageState = typeof INITIAL_STATE;

class ServicesController {
  [k: string]: any;
  state: any;
  setState: (u: any) => void;
  props: Record<string, any> = {};
  constructor(state: PageState, setState: (u: any) => void) {
    this.state = state;
    this.setState = setState;
  }
  _devTypeTimers: any = {};
  _auIO: any =
    typeof window === "undefined"
      ? null
      : new IntersectionObserver(
          (entries?: any) => {
            entries.forEach((entry?: any) => {
              const idx = Number(entry.target.getAttribute("data-au-card"));
              const goingIn = entry.isIntersecting;
              const delay = goingIn ? idx * 180 : 0;
              clearTimeout(this._auTimers && this._auTimers[idx]);
              this._auTimers = this._auTimers || {};
              this._auTimers[idx] = setTimeout(() => {
                this.setState((s?: any) => {
                  const next = s.auFlipped.slice();
                  next[idx] = goingIn;
                  return { auFlipped: next };
                });
              }, delay);
            });
          },
          { threshold: 0.3 },
        );
  auCardRef: any = (el?: any) => {
    if (el) this._auIO.observe(el);
  };
  _devIO: any =
    typeof window === "undefined"
      ? null
      : new IntersectionObserver(
          (entries?: any) => {
            entries.forEach((entry?: any) => {
              if (entry.isIntersecting) {
                const idx = Number(entry.target.getAttribute("data-dev-card"));
                const delay = idx * 220; // stagger by card order
                setTimeout(() => {
                  this.setState((s?: any) => {
                    const next = s.devRevealed.slice();
                    next[idx] = true;
                    return { devRevealed: next };
                  });
                  this._startDevTyping(idx);
                }, delay);
                this._devIO.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.2 },
        );
  devCardRef: any = (el?: any) => {
    if (el) this._devIO.observe(el);
  };
  _devTitles: any = [
    "Website Development",
    "SaaS Platforms",
    "Mobile Applications",
    "High-Converting Landing Pages",
  ];
  _startDevTyping: any = (idx?: any) => {
    const full = this._devTitles[idx];
    let i = 0;
    this._devTypeTimers[idx] = setInterval(() => {
      i++;
      this.setState((s?: any) => {
        const next = s.devTypedLen.slice();
        next[idx] = i;
        return { devTypedLen: next };
      });
      if (i >= full.length) clearInterval(this._devTypeTimers[idx]);
    }, 40);
  };
  componentWillUnmount() {
    Object.values(this._devTypeTimers).forEach((t?: any) => clearInterval(t));
  }
  renderVals() {
    const serviceDefs = [
      {
        name: "Validate Your Idea",
        desc: "Five specialist AI agents pressure-test your idea against real market data — one honest verdict, fully cited.",
        link: "/validate-your-idea",
        placeholder: "Founder reviewing validation data",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155234_0136d1d2-89e6-41b7-b3f1-fbd459735cac.png",
      },
      {
        name: "Create a Business Plan",
        desc: "Market sizing, positioning, go-to-market, and revenue model — a complete plan from one idea.",
        link: "/create-a-business-plan",
        placeholder: "Business plan document",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155235_b885ebc9-4e33-4b9b-9427-b61a0478ceb2.png",
      },
      {
        name: "Create Marketing Plan",
        desc: "Channel-by-channel plans — positioning, messaging, ad angles, and a content calendar.",
        link: "/create-marketing-plan",
        placeholder: "Marketing campaign strategy board",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_141830_3185fd5f-98f8-40f5-ba89-c5fd182da676.png",
      },
      {
        name: "Get Your Funding",
        desc: "An investor-ready pitch deck, financial model, and cited market data, assembled automatically.",
        link: "/get-your-funding",
        placeholder: "Investor pitch meeting",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155239_3fcfacb5-da9a-4312-8369-69020f144fe9.png",
      },
      {
        name: "Generate Leads",
        desc: "Automated sourcing and scoring fills your pipeline with qualified prospects, 24/7.",
        link: "/generate-leads",
        placeholder: "Sales pipeline filling with leads",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155340_8af144e5-f6c2-4b02-8cfb-a685163885d4.png",
      },
      {
        name: "24×7 Working AI Agents",
        desc: "Reception, sales, support, and scheduling handled by AI agents that never clock out.",
        link: "/ai-agents",
        placeholder: "AI agents working around the clock",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155237_a3104645-e762-4202-a656-20bd55e14dbc.png",
      },
      {
        name: "AI Strategies & Consulting",
        desc: "A clear, prioritized roadmap for where automation pays off first — backed by cited data.",
        link: "/ai-strategies-and-consulting",
        placeholder: "AI strategy consulting session",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_083639_233bcc3c-b1e6-451c-9a3b-c48ba31895c6.png",
      },
      {
        name: "CRM",
        desc: "A CRM that updates itself — deals, contacts, and follow-ups logged by your AI agents.",
        link: "/crm",
        placeholder: "CRM pipeline dashboard",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_083643_b68a4c73-16f6-4a6e-ad8e-6c33a51ae0ef.png",
      },
      {
        name: "Growth Plan",
        desc: "Retention, expansion, and referral loops surfaced by a standing AI analyst, every week.",
        link: "/growth-plan",
        placeholder: "Business growth chart trending upward",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_141936_ce61d0f0-6c75-49a0-a579-d345cd7a18f1.png",
      },
    ];
    const services = serviceDefs.map((s?: any, i?: any) => ({
      name: s.name,
      desc: s.desc,
      link: s.link,
      placeholder: s.placeholder,
      imgSrc: s.imgSrc,
      slotId: "service-card-" + i,
      num: String(i + 1).padStart(2, "0"),
      cardStyle: {
        display: "block",
        background: "#111219",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "18px",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        transition:
          "transform 0.3s cubic-bezier(0.22,1,0.36,1), border-color 0.3s ease",
      },
      cardHoverStyle: {
        transform: "translateY(-6px)",
        borderColor: "rgba(124,92,255,0.4)",
      },
      imgWrapStyle: {
        position: "relative",
        width: "100%",
        aspectRatio: "16/10",
      },
      numBadgeStyle: {
        position: "absolute",
        top: "14px",
        left: "14px",
        padding: "5px 11px",
        borderRadius: "100px",
        background: "rgba(10,11,15,0.6)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.16)",
        fontSize: "11.5px",
        fontWeight: 700,
        color: "#F4F3F7",
        zIndex: 2,
      },
    }));
    const flowSteps = [
      {
        n: "01",
        title: "Describe your idea",
        desc: "One sentence is enough to start the whole system.",
        delay: "0s",
      },
      {
        n: "02",
        title: "Get validated data",
        desc: "Market size, competitors, and feasibility, cited and scored.",
        delay: "0.1s",
      },
      {
        n: "03",
        title: "Build on that data",
        desc: "Plans, funding decks, and marketing all reference the same facts.",
        delay: "0.2s",
      },
      {
        n: "04",
        title: "Run it with AI agents",
        desc: "CRM, leads, and support stay live and current, automatically.",
        delay: "0.3s",
      },
    ];
    const devDefs = [
      {
        title: "Website Development",
        placeholder: "Modern responsive website on laptop and phone",
        imgSrc: "./assets/web-development-aiautomix.jpg",
        link: "./Website Development.dc.html",
      },
      {
        title: "SaaS Platforms",
        placeholder: "SaaS dashboard interface glowing on a monitor",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_122955_60299777-1052-4054-aaa9-a8663b62633f.png",
        link: "/saas-product-development",
      },
      {
        title: "Mobile Applications",
        placeholder: "Smartphone showing a sleek mobile app interface",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_140206_e9d85a97-6548-433e-b0c4-6123685ffa7e.png",
        link: "/mobile-app-development",
      },
      {
        title: "High-Converting Landing Pages",
        placeholder: "Bold landing page hero mockup on laptop",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_123056_2fe84ee5-50cf-4e4c-9591-80f82b520a2b.png",
        link: "/landing-page-design",
      },
    ];
    const devCards = devDefs.map((d?: any, i?: any) => {
      const hovered = this.state.devHover === i;
      const revealed = this.state.devRevealed[i];
      const floatAnim = revealed
        ? (i % 2 === 0 ? "devFloat1" : "devFloat2") +
          " " +
          (5 + i * 0.6) +
          "s ease-in-out infinite " +
          (i * 0.3 + 0.9) +
          "s"
        : "none";
      const isLeftCol = i % 2 === 0; // left column slides in from center-right; right column slides in from center-left
      const typedLen = this.state.devTypedLen[i];
      const onCardClick = d.link
        ? () => {
            window.location.href = d.link;
          }
        : undefined;
      return {
        onCardClick,
        title: d.title,
        placeholder: d.placeholder,
        imgSrc: d.imgSrc,
        slotId: "dev-card-" + i,
        cardIndex: i,
        cardRef: this.devCardRef,
        typedTitle: d.title.slice(0, typedLen),
        captionRowStyle: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "18px",
        },
        arrowTextStyle: { fontSize: "18px", color: "#7C5CFF" },
        typedTitleStyle: {
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontWeight: 700,
          fontSize: "clamp(19px,2vw,26px)",
          color: "#F4F3F7",
          letterSpacing: "-0.01em",
        },
        typeCursorStyle: {
          animation: "typeCursorBlink 0.9s step-end infinite",
          color: "#7C5CFF",
          opacity: typedLen >= d.title.length ? 0 : 1,
        },
        onEnter: () => this.setState({ devHover: i }),
        onLeave: () => this.setState({ devHover: null }),
        cardStyle: {
          position: "relative",
          borderRadius: "24px",
          overflow: "hidden",
          aspectRatio: "4/3",
          cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.08)",
          opacity: revealed ? 1 : 0,
          filter: revealed ? "blur(0px)" : "blur(12px)",
          transform: revealed
            ? "translateX(0) scale(1)"
            : isLeftCol
              ? "translateX(220px) scale(0.94)"
              : "translateX(-220px) scale(0.94)",
          transition: revealed
            ? "transform 0.9s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s ease, filter 0.5s ease"
            : "none",
          animation: floatAnim,
        },
        imgStyle: {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transform: hovered ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.6s cubic-bezier(0.16,1,0.3,1)",
        },
        scrimStyle: {
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(0deg, rgba(10,11,15,0.3) 0%, transparent 55%)",
        },
      };
    });
    const servicesLooped = [...services, ...services].map(
      (s?: any, i?: any) => ({
        ...s,
        cardStyle: { ...s.cardStyle, flexShrink: 0, width: "300px" },
        slotId: s.slotId + "-loop" + i,
      }),
    );
    const servicesMarqueeMaskStyle = {
      position: "relative",
      width: "100%",
      overflow: "hidden",
      maskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      WebkitMaskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      padding: "0 64px",
    };
    const servicesMarqueeTrackStyle = {
      display: "flex",
      gap: "24px",
      width: "max-content",
      animation: "servicesMarquee 42s linear infinite",
      animationPlayState: this.state.servicesMarqueeHovered
        ? "paused"
        : "running",
    };
    const channelDefs = [
      {
        icon: "📱",
        name: "Social Media Marketing",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_075556_109184f9-a45c-403e-9f59-84a71dcca16f.png",
      },
      {
        icon: "✉️",
        name: "Email Marketing",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_075559_244b69c7-dd4e-4cd4-b81a-533909d0c8eb.png",
      },
      {
        icon: "💬",
        name: "WhatsApp Marketing",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_075601_2bfec871-0591-488d-8278-b921e1995b5b.png",
      },
      {
        icon: "🎬",
        name: "Animated Videos Marketing",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_075603_7a341130-fa08-44f1-815f-7b5bb631dde1.png",
      },
      {
        icon: "⭐",
        name: "Reputation Management",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_075657_1029c547-cbac-4cf7-828b-0b3f106ea75b.png",
      },
      {
        icon: "🔍",
        name: "SEO",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_075659_f4a2c84a-a24b-4ec2-aa8a-b5883b299782.png",
      },
      {
        icon: "⚙️",
        name: "Content Automation",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260728_075701_e1675ce0-66e5-4597-a555-b93ce672f9c4.png",
      },
    ];
    const marketingChannels = channelDefs.map((c?: any, i?: any) => ({
      icon: c.icon,
      name: c.name,
      imgSrc: c.imgSrc,
      slotId: "mkt-card-" + i,
      cardStyle: {
        position: "relative",
        flexShrink: 0,
        width: "230px",
        height: "340px",
        borderRadius: "18px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
      },
      scrimStyle: {
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, transparent 55%, rgba(10,11,15,0.9) 100%)",
      },
      iconBadgeStyle: {
        position: "absolute",
        left: "50%",
        bottom: "52px",
        transform: "translateX(-50%)",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: "rgba(10,11,15,0.7)",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "17px",
      },
      labelStyle: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "16px",
        textAlign: "center",
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontSize: "14px",
        fontWeight: 700,
        color: "#F4F3F7",
        padding: "0 10px",
      },
    }));
    const marketingLooped = [...marketingChannels, ...marketingChannels].map(
      (c?: any, i?: any) => ({ ...c, slotId: c.slotId + "-loop" + i }),
    );
    const marketingMarqueeMaskStyle = {
      position: "relative",
      width: "100%",
      overflow: "hidden",
      maskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      WebkitMaskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      padding: "0 64px",
    };
    const marketingMarqueeTrackStyle = {
      display: "flex",
      gap: "20px",
      width: "max-content",
      animation: "marketingMarquee 38s linear infinite",
      animationPlayState: this.state.marketingMarqueeHovered
        ? "paused"
        : "running",
    };
    const automationDefs = [
      {
        icon: "💬",
        name: "AI Chatbots",
        desc: "Instant, on-brand answers on your site and socials, day or night.",
      },
      {
        icon: "📞",
        name: "Voice AI Agents",
        desc: "Natural-sounding calls that book, qualify, and support customers.",
      },
      {
        icon: "📇",
        name: "CRM & Lead Automation",
        desc: "Contacts enriched and deals moved without anyone touching a keyboard.",
      },
      {
        icon: "⚙️",
        name: "Workflow Automation",
        desc: "The repetitive back-office tasks, connected and running themselves.",
      },
    ];
    const backImgs = [
      "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_145722_83b414f5-da48-4b23-aa40-72cd9557536c.png",
      "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_144746_e1cfc0ba-880e-47d1-9eb5-8c52960efa14.png",
      "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_144748_12d517ca-4b6d-4971-b3ca-e3189d92e8a4.png",
      "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_144750_031e3af4-f286-4c3b-b67d-852b71a5e425.png",
    ];
    const monograms = ["C", "V", "R", "W"];
    const rotations = [-9, -3, 3, 9];
    const lifts = [18, 0, 0, 18];
    const automationItems = automationDefs.map((a?: any, i?: any) => {
      const flipped = this.state.auFlipped[i];
      const hovered = this.state.auHover === i;
      return {
        name: a.name,
        desc: a.desc,
        mono: monograms[i],
        idx: i,
        cardRef: this.auCardRef,
        backImg: backImgs[i],
        onEnter: () => this.setState({ auHover: i }),
        onLeave: () => this.setState({ auHover: null }),
        outerStyle: {
          position: "relative",
          width: "230px",
          height: "320px",
          marginLeft: i === 0 ? "0" : "-36px",
          zIndex: hovered ? 10 : i,
          transform:
            "rotate(" +
            rotations[i] +
            "deg) translateY(" +
            (lifts[i] - (hovered ? 22 : 0)) +
            "px)",
          transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1)",
        },
        innerStyle: {
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        },
        backFaceStyle: {
          position: "absolute",
          inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          borderRadius: "18px",
          overflow: "hidden",
          background: "#2C3EFF",
          border: "2px solid rgba(255,255,255,0.7)",
          boxShadow: "0 20px 45px -18px rgba(0,0,0,0.6)",
          opacity: flipped ? 0 : 1,
          pointerEvents: flipped ? "none" : "auto",
          transition: "opacity 0.3s ease",
        },
        backImgWrapStyle: { position: "absolute", inset: 0 },
        backScrimStyle: {
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(44,62,255,0.15) 0%, rgba(10,11,15,0.55) 100%)",
        },
        backMonogramStyle: {
          position: "absolute",
          top: "16px",
          left: "16px",
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: "rgba(10,11,15,0.55)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontSize: "16px",
          fontWeight: 800,
          color: "#F4F3F7",
        },
        frontFaceStyle: {
          position: "absolute",
          inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          borderRadius: "18px",
          background: "#FFFFFF",
          border: "2px solid rgba(20,15,8,0.1)",
          boxShadow: "0 20px 45px -18px rgba(0,0,0,0.4)",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          opacity: flipped ? 1 : 0,
          pointerEvents: flipped ? "auto" : "none",
          transition: "opacity 0.3s ease 0.35s",
        },
        frontHeaderStyle: {
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "18px",
        },
        frontNameStyle: {
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontWeight: 800,
          fontSize: "16px",
          color: "#0A0B0F",
          textTransform: "uppercase",
          letterSpacing: "0.01em",
          lineHeight: 1.2,
        },
        monoBadgeStyle: {
          flexShrink: 0,
          width: "30px",
          height: "30px",
          borderRadius: "8px",
          background: "#0A0B0F",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "14px",
        },
        frontDescStyle: {
          fontSize: "12.5px",
          color: "#5C5847",
          lineHeight: 1.55,
          margin: "0",
          flex: 1,
        },
        frontFooterStyle: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "14px",
          borderTop: "1px dashed rgba(20,15,8,0.15)",
        },
        monoSmallStyle: {
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontWeight: 800,
          fontSize: "13px",
          color: "#0A0B0F",
        },
        upsideNameStyle: {
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontWeight: 700,
          fontSize: "11.5px",
          color: "#8A8676",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          transform: "rotate(180deg)",
        },
      };
    });
    const howItWorksSteps = [
      {
        num: "1",
        title: "Discovery Call",
        desc: "We map your business processes, identify automation opportunities, and define your ROI goals.",
      },
      {
        num: "2",
        title: "Strategy & Build",
        desc: "Our team designs and builds your custom automation stack, integrated with your existing tools.",
      },
      {
        num: "3",
        title: "Test & Launch",
        desc: "Rigorous testing across all scenarios before going live. Full training provided to your team.",
      },
      {
        num: "4",
        title: "Optimise & Scale",
        desc: "Ongoing monitoring, monthly reporting, and continuous optimisation to maximise your ROI.",
      },
    ].map((s?: any, i?: any) => ({ ...s, delay: i * 0.1 + "s" }));
    return {
      services,
      flowSteps,
      devCards,
      marketingChannels,
      howItWorksSteps,
      marketingLooped,
      marketingMarqueeMaskStyle,
      marketingMarqueeTrackStyle,
      onMarketingMarqueeEnter: () =>
        this.setState({ marketingMarqueeHovered: true }),
      onMarketingMarqueeLeave: () =>
        this.setState({ marketingMarqueeHovered: false }),
      servicesLooped,
      servicesMarqueeMaskStyle,
      servicesMarqueeTrackStyle,
      onServicesMarqueeEnter: () =>
        this.setState({ servicesMarqueeHovered: true }),
      onServicesMarqueeLeave: () =>
        this.setState({ servicesMarqueeHovered: false }),
      automationItems,
    };
  }
}
function usePageVals() {
  const [state, setState] = useMergedState<PageState>(INITIAL_STATE);
  const ref = useRef<ServicesController | null>(null);
  if (!ref.current) ref.current = new ServicesController(state, setState);
  const ctrl = ref.current;
  ctrl.state = state;
  ctrl.setState = setState;
  useEffect(() => {
    // no mount hook
    return () => ctrl.componentWillUnmount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ctrl.renderVals();
}

export function ServicesView() {
  const {
    services,
    flowSteps,
    devCards,
    howItWorksSteps,
    marketingLooped,
    marketingMarqueeMaskStyle,
    marketingMarqueeTrackStyle,
    onMarketingMarqueeEnter,
    onMarketingMarqueeLeave,
    servicesLooped,
    servicesMarqueeMaskStyle,
    servicesMarqueeTrackStyle,
    onServicesMarqueeEnter,
    onServicesMarqueeLeave,
    automationItems,
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
            padding: "120px 64px 90px",
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
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              textAlign: "center",
              position: "relative",
              zIndex: "1",
            }}
          >
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
              {" Nine services · One connected system "}
            </div>
            <h1
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(38px,5.5vw,72px)",
                lineHeight: "1.04",
                letterSpacing: "-0.02em",
                margin: "0 0 24px",
                animationDelay: "0.1s",
              }}
            >
              {" Everything your business needs"}
              <br />
              {"to "}
              <span
                style={{
                  background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {"launch, fund, and scale."}
              </span>
            </h1>
            <p
              className="reveal"
              style={{
                fontSize: "17.5px",
                color: "#ABA9B8",
                maxWidth: "640px",
                margin: "0 auto 44px",
                lineHeight: "1.6",
                animationDelay: "0.2s",
              }}
            >
              {
                " AIAutomix isn't one tool — it's the full stack, from validating your first idea to running a business with AI agents doing the repeatable work. Every service is grounded in the same cited, real-world data. "
              }
            </p>
            <div className="reveal" style={{ animationDelay: "0.3s" }}>
              <Link
                href="/validate-your-idea"
                style={{
                  display: "inline-block",
                  padding: "16px 28px",
                  borderRadius: "12px",
                  background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  color: "#0A0B0F",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                {"Start with a free validation →"}
              </Link>
            </div>
          </div>
        </div>
        <div style={{ padding: "100px 64px 120px", background: "#0E0F16" }}>
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
                  color: "#8A87A0",
                  marginBottom: "20px",
                  fontWeight: "600",
                }}
              >
                {"The full stack"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(30px,3.8vw,50px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"Nine services. One idea to grow from."}
              </h2>
            </div>
          </div>
          <div
            style={asStyle(servicesMarqueeMaskStyle)}
            onMouseEnter={onServicesMarqueeEnter}
            onMouseLeave={onServicesMarqueeLeave}
          >
            <div style={asStyle(servicesMarqueeTrackStyle)}>
              {servicesLooped.map((svc?: any, svcIdx?: any) => (
                <a
                  key={svcIdx}
                  href={svc.link}
                  style={asStyle(svc.cardStyle)}
                  onMouseEnter={(e?: any) =>
                    Object.assign(e.currentTarget.style, svc.cardHoverStyle)
                  }
                  onMouseLeave={(e?: any) =>
                    Object.assign(e.currentTarget.style, svc.cardStyle)
                  }
                >
                  <div style={asStyle(svc.imgWrapStyle)}>
                    <img
                      src={svc.imgSrc}
                      alt={svc.placeholder}
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
                    <div style={asStyle(svc.numBadgeStyle)}>{svc.num}</div>
                  </div>
                  <div style={{ padding: "22px 22px 26px" }}>
                    <div
                      style={{
                        fontFamily: "'Bricolage Grotesque',sans-serif",
                        fontSize: "18px",
                        fontWeight: "700",
                        color: "#F4F3F7",
                        marginBottom: "8px",
                      }}
                    >
                      {svc.name}
                    </div>
                    <p
                      style={{
                        fontSize: "13.5px",
                        color: "#8A87A0",
                        lineHeight: "1.55",
                        margin: "0 0 16px",
                      }}
                    >
                      {svc.desc}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#8CA0FF",
                      }}
                    >
                      {" Explore "}
                      <span>{"→"}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 64px",
            background: "rgb(251, 235, 216)",
            color: "#1C160E",
          }}
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
                  color: "#8A7458",
                  marginBottom: "20px",
                  fontWeight: "600",
                }}
              >
                {"Why it's a system, not a toolbox"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  lineHeight: "1.15",
                  letterSpacing: "-0.02em",
                  margin: "0",
                  color: "#1C160E",
                }}
              >
                {"One idea, one data foundation, every service."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "24px",
              }}
            >
              {flowSteps.map((step?: any, stepIdx?: any) => (
                <div
                  key={stepIdx}
                  className="reveal"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(28,22,14,0.08)",
                    borderRadius: "18px",
                    padding: "28px 24px",
                    animationDelay: "{{ step.delay }}",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "26px",
                      fontWeight: "800",
                      color: "#E8792C",
                      marginBottom: "14px",
                    }}
                  >
                    {step.n}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "15.5px",
                      fontWeight: "700",
                      marginBottom: "8px",
                      color: "#1C160E",
                    }}
                  >
                    {step.title}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#7A6A54",
                      lineHeight: "1.5",
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
        <div style={{ padding: "120px 64px", background: "#0A0B0F" }}>
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
                  color: "#8A87A0",
                  marginBottom: "20px",
                  fontWeight: "600",
                }}
              >
                {"Beyond automation"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(30px,3.8vw,50px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"Development."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,1fr)",
                gap: "24px",
              }}
            >
              {devCards.map((dev?: any, devIdx?: any) => (
                <div key={devIdx}>
                  <div
                    ref={dev.cardRef}
                    data-dev-card={dev.cardIndex}
                    style={asStyle(dev.cardStyle)}
                    onMouseEnter={dev.onEnter}
                    onMouseLeave={dev.onLeave}
                    onClick={dev.onCardClick}
                  >
                    <img
                      src={dev.imgSrc}
                      alt={dev.placeholder}
                      style={{ objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                    <div style={asStyle(dev.scrimStyle)}></div>
                  </div>
                  <div style={asStyle(dev.captionRowStyle)}>
                    <span style={asStyle(dev.arrowTextStyle)}>{"→"}</span>{" "}
                    <span style={asStyle(dev.typedTitleStyle)}>
                      {dev.typedTitle}
                      <span style={asStyle(dev.typeCursorStyle)}>{"|"}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "120px 0",
            background: "#0E0F16",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: "1300px",
              margin: "0 auto 64px",
              padding: "0 64px",
            }}
          >
            <div className="reveal" style={{ textAlign: "center" }}>
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
                {"Content & Marketing"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(30px,3.8vw,50px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"Dominate Every"}
                <br />
                {"Marketing Channel."}
              </h2>
            </div>
          </div>
          <div
            style={asStyle(marketingMarqueeMaskStyle)}
            onMouseEnter={onMarketingMarqueeEnter}
            onMouseLeave={onMarketingMarqueeLeave}
          >
            <div style={asStyle(marketingMarqueeTrackStyle)}>
              {marketingLooped.map((ch?: any, chIdx?: any) => (
                <div key={chIdx} style={asStyle(ch.cardStyle)}>
                  <img
                    src={ch.imgSrc}
                    alt={ch.name}
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
                  <div style={asStyle(ch.scrimStyle)}></div>
                  <div style={asStyle(ch.iconBadgeStyle)}>{ch.icon}</div>
                  <div style={asStyle(ch.labelStyle)}>{ch.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "140px 64px 160px",
            background: "linear-gradient(180deg,#0A0B0F 0%,#12143A 100%)",
            overflow: "hidden",
          }}
        >
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{ textAlign: "center", marginBottom: "80px" }}
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
                {"AI Automation"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(30px,3.8vw,50px)",
                  lineHeight: "1.08",
                  letterSpacing: "-0.02em",
                  margin: "0",
                  color: "#F4F3F7",
                }}
              >
                {"Intelligent Systems"}
                <br />
                {"That Work 24/7."}
              </h2>
            </div>
            <div
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-end",
                gap: "0",
                perspective: "2200px",
                padding: "20px 0 40px",
              }}
            >
              <svg
                width="100%"
                height="90"
                viewBox="0 0 1200 90"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  top: "-30px",
                  left: "0",
                  opacity: "0.5",
                  pointerEvents: "none",
                }}
              >
                <path
                  d="M0,80 C300,10 900,10 1200,80"
                  stroke="#8CA0FF"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                ></path>
              </svg>
              {automationItems.map((au?: any, auIdx?: any) => (
                <div
                  key={auIdx}
                  ref={au.cardRef}
                  data-au-card={au.idx}
                  style={asStyle(au.outerStyle)}
                  onMouseEnter={au.onEnter}
                  onMouseLeave={au.onLeave}
                >
                  <div style={asStyle(au.innerStyle)}>
                    <div style={asStyle(au.backFaceStyle)}>
                      <img
                        src={au.backImg}
                        alt={`${au.name} illustration`}
                        style={{ objectFit: "cover", display: "block" }}
                        loading="lazy"
                      />
                      <div style={asStyle(au.backScrimStyle)}></div>
                      <div style={asStyle(au.backMonogramStyle)}>{au.mono}</div>
                    </div>
                    <div style={asStyle(au.frontFaceStyle)}>
                      <div style={asStyle(au.frontHeaderStyle)}>
                        <span style={asStyle(au.frontNameStyle)}>
                          {au.name}
                        </span>{" "}
                        <span style={asStyle(au.monoBadgeStyle)}>
                          {au.mono}
                        </span>
                      </div>
                      <p style={asStyle(au.frontDescStyle)}>{au.desc}</p>
                      <div style={asStyle(au.frontFooterStyle)}>
                        <span style={asStyle(au.monoSmallStyle)}>
                          {au.mono}
                        </span>{" "}
                        <span style={asStyle(au.upsideNameStyle)}>
                          {au.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "140px 64px",
            background: "#FBEBD8",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-10%",
              left: "8%",
              width: "420px",
              height: "420px",
              background:
                "radial-gradient(circle, rgba(232,121,44,0.22), transparent 70%)",
              pointerEvents: "none",
            }}
          ></div>
          <div
            style={{
              maxWidth: "1200px",
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
                  color: "#E8792C",
                  marginBottom: "20px",
                  fontWeight: "700",
                }}
              >
                {"How it works"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(30px,4vw,52px)",
                  lineHeight: "1.12",
                  letterSpacing: "-0.02em",
                  margin: "0",
                  color: "#1C160E",
                }}
              >
                {" From Strategy to"}
                <br />
                <span style={{ color: "#E8792C" }}>{"Live in 14 Days"}</span>
              </h2>
            </div>
            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "24px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "36px",
                  left: "12.5%",
                  right: "12.5%",
                  height: "1px",
                  background: "rgba(28,22,14,0.15)",
                  zIndex: "0",
                }}
              ></div>
              {howItWorksSteps.map((step?: any, stepIdx?: any) => (
                <div
                  key={stepIdx}
                  className="reveal"
                  style={{
                    position: "relative",
                    zIndex: "1",
                    textAlign: "center",
                    padding: "0 8px",
                    animationDelay: "{{ step.delay }}",
                  }}
                >
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      background: "#FBEBD8",
                      border: "2px solid #E8792C",
                      boxShadow: "0 0 26px rgba(232,121,44,0.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 24px",
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "26px",
                      fontWeight: "800",
                      color: "#E8792C",
                    }}
                  >
                    {step.num}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "#1C160E",
                      marginBottom: "12px",
                    }}
                  >
                    {step.title}
                  </div>
                  <p
                    style={{
                      fontSize: "13.5px",
                      color: "#7A6A54",
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
        <div
          style={{
            padding: "120px 64px",
            background: "#F4F1EA",
            color: "#0A0B0F",
            textAlign: "center",
          }}
        >
          <div
            className="reveal"
            style={{ maxWidth: "640px", margin: "0 auto" }}
          >
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(28px,3.6vw,48px)",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                margin: "0 0 20px",
              }}
            >
              {"Pick a starting point. We'll handle the rest."}
            </h2>
            <p
              style={{
                fontSize: "16px",
                color: "#5C5847",
                lineHeight: "1.6",
                margin: "0 0 36px",
              }}
            >
              {
                "Most founders start with a free validation — everything downstream, from plan to funding to growth, builds on that same data."
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
              <Link
                href="/validate-your-idea"
                style={{
                  padding: "17px 30px",
                  borderRadius: "100px",
                  background: "#0A0B0F",
                  color: "#F4F1EA",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                {"Validate your idea free →"}
              </Link>{" "}
              <Link
                href="/"
                style={{
                  padding: "17px 30px",
                  borderRadius: "100px",
                  background: "transparent",
                  border: "1.5px solid rgba(10,11,15,0.25)",
                  color: "#0A0B0F",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                {"Back to home"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
