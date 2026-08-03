"use client";

import { Fragment, type ChangeEvent, useRef } from "react";
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
    @keyframes pulseDot { 0%,100% { box-shadow: 0 0 0 0 rgba(87,242,164,0.4); } 50% { box-shadow: 0 0 0 6px rgba(87,242,164,0); } }
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
    form: { name: "", email: "", idea: "" },
    nameError: "",
    emailError: "",
    submitted: false,
  });
  const formNodeRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = (node: HTMLDivElement | null) => {
    formNodeRef.current = node;
  };
  const scrollToForm = () => {
    formNodeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const iconSvgs = {
    phone:
      '<path d="M6 3.5c-1.4 0-2.5 1.1-2.5 2.5 0 8 6.5 14.5 14.5 14.5 1.4 0 2.5-1.1 2.5-2.5v-2.1c0-.6-.4-1.1-1-1.3l-3.4-1c-.5-.1-1 0-1.4.4l-1 1.2c-2-1-3.6-2.6-4.6-4.6l1.2-1c.4-.4.5-.9.4-1.4l-1-3.4c-.2-.6-.7-1-1.3-1H6z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>',
    dollar:
      '<path d="M12 3v18M16.5 7.5c0-1.9-2-3-4.5-3s-4.5 1.1-4.5 2.9c0 3.9 9 1.6 9 5.7 0 1.9-2 3-4.5 3s-4.9-1.1-4.9-3" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    chat: '<path d="M4 5.5h16v10H9l-4 3.5v-3.5H4v-10z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>',
    calendar:
      '<rect x="4" y="5" width="16" height="15" rx="2.2" fill="none" stroke="#fff" stroke-width="1.7"/><path d="M4 9.5h16M8 3v3.4M16 3v3.4" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
    star: '<path d="M12 3.3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.6l6-.7L12 3.3z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>',
  };
  const aiTeamDefs = [
    {
      iconKey: "phone",
      name: "AI Receptionist",
      desc: "Handles all inbound calls 24/7",
      stat1Val: "∞",
      stat1Label: "Calls/day",
      stat2Val: "160h",
      stat2Label: "Saved/mo",
      iconBg: "linear-gradient(135deg,#4F7DF2,#3D5FE0)",
      chat: [
        {
          q: "Tables free tonight at 8pm for 4?",
          a: "Yes — booked for 4 at 8:00pm, confirmation texted.",
        },
        {
          q: "Do you take walk-ins too?",
          a: "We do, though reservations are seated first.",
        },
        {
          q: "Can I add a birthday note?",
          a: "Added! We'll bring a candle with dessert.",
        },
      ],
    },
    {
      iconKey: "dollar",
      name: "AI Sales Agent",
      desc: "Qualifies & nurtures leads automatically",
      stat1Val: "340%",
      stat1Label: "More Leads",
      stat2Val: "4 min",
      stat2Label: "Response",
      iconBg: "linear-gradient(135deg,#B75CF2,#8B3FE0)",
      chat: [
        {
          q: "What does the Pro plan include?",
          a: "Unlimited automations, priority support, onboarding call.",
        },
        {
          q: "Any discount for annual billing?",
          a: "Yes — 20% off, locked in for 12 months.",
        },
        {
          q: "Can I upgrade later?",
          a: "Anytime, prorated instantly — no lock-in.",
        },
      ],
    },
    {
      iconKey: "chat",
      name: "AI Customer Support",
      desc: "Resolves 80% of tickets automatically",
      stat1Val: "80%",
      stat1Label: "Auto-Resolved",
      stat2Val: "24/7",
      stat2Label: "Availability",
      iconBg: "linear-gradient(135deg,#4FA8F2,#2E8CE0)",
      chat: [
        {
          q: "My order hasn't arrived — 5 days late.",
          a: "It's with the carrier, arriving tomorrow by 5pm.",
        },
        {
          q: "Can I get a refund instead?",
          a: "Added a $10 credit — full refund if it's late again.",
        },
        {
          q: "How do I track future orders?",
          a: "You'll get live tracking links by email from now on.",
        },
      ],
    },
    {
      iconKey: "calendar",
      name: "AI Appointment Setter",
      desc: "Fills your calendar automatically",
      stat1Val: "3x",
      stat1Label: "More Bookings",
      stat2Val: "0%",
      stat2Label: "No-Shows*",
      iconBg: "linear-gradient(135deg,#B75CF2,#7C3FE0)",
      chat: [
        {
          q: "Move Thursday to Friday?",
          a: "Done — same time Friday, calendar updated.",
        },
        {
          q: "Can you send me a reminder?",
          a: "I'll text you 1 hour before the appointment.",
        },
        {
          q: "What if I need to cancel?",
          a: 'Just reply "cancel" anytime, no call needed.',
        },
      ],
    },
    {
      iconKey: "star",
      name: "AI Lead Qualifier",
      desc: "Separates hot leads from tire-kickers",
      stat1Val: "5x",
      stat1Label: "Better Quality",
      stat2Val: "90%",
      stat2Label: "Accuracy",
      iconBg: "linear-gradient(135deg,#F2924F,#E8792C)",
      chat: [
        {
          q: "What's your budget and timeline?",
          a: "$15k budget, launching in 6 weeks.",
        },
        {
          q: "Are you the final decision maker?",
          a: "Yes — flagged as hot, specialist calling within the hour.",
        },
        {
          q: "Any competitors you're considering?",
          a: "Noted for the specialist to address directly.",
        },
      ],
    },
  ];
  const aiTeamCards = aiTeamDefs.map((c, i) => {
    const hovered = (state as unknown as Record<string, boolean>)[
      "aiTeamHover_" + i
    ];
    return {
      name: c.name,
      desc: c.desc,
      stat1Val: c.stat1Val,
      stat1Label: c.stat1Label,
      stat2Val: c.stat2Val,
      stat2Label: c.stat2Label,
      iconSvgObj: { __html: iconSvgs[c.iconKey as keyof typeof iconSvgs] },
      onEnter: () => setState({ ["aiTeamHover_" + i]: true }),
      onLeave: () => setState({ ["aiTeamHover_" + i]: false }),
      flipOuterStyle: {
        position: "relative",
        height: "350px",
        borderRadius: "20px",
        maxWidth: "100%",
        boxShadow: hovered
          ? "0 24px 48px -18px rgba(20,15,8,0.3)"
          : "0 6px 18px -10px rgba(20,15,8,0.1)",
        transition: "box-shadow 0.4s ease",
      },
      flipInnerStyle: {
        position: "relative",
        width: "100%",
        height: "100%",
        textAlign: "center",
        transformStyle: "preserve-3d",
        transition: "transform 0.9s cubic-bezier(0.22,1,0.36,1)",
        transform: hovered ? "rotateY(180deg)" : "rotateY(0deg)",
      },
      frontFaceStyle: {
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        background: "#FFFFFF",
        borderRadius: "20px",
        border: "1px solid rgba(20,15,8,0.08)",
        padding: "22px 16px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: hovered ? 0 : 1,
        pointerEvents: hovered ? "none" : "auto",
        transition: "opacity 0.35s ease",
      },
      backFaceStyle: {
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        background: "#241812",
        borderRadius: "20px",
        padding: "14px 14px",
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        overflow: "hidden",
        opacity: hovered ? 1 : 0,
        pointerEvents: hovered ? "auto" : "none",
        transition: "opacity 0.35s ease",
      },
      iconWrapStyle: {
        width: "56px",
        height: "56px",
        borderRadius: "50%",
        background: c.iconBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        margin: "0 auto 14px",
        boxShadow: "0 8px 18px -6px rgba(0,0,0,0.35)",
      },
      nameStyle: {
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontWeight: 700,
        fontSize: "13px",
        color: "#1C160E",
        marginBottom: "2px",
      },
      descStyle: {
        fontSize: "12px",
        color: "#8A7C68",
        lineHeight: 1.4,
        marginBottom: "16px",
      },
      statsRowStyle: {
        display: "flex",
        justifyContent: "center",
        gap: "24px",
        paddingTop: "14px",
        borderTop: "1px solid rgba(20,15,8,0.08)",
        width: "100%",
      },
      statValStyle: {
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontWeight: 800,
        fontSize: "19px",
        color: "#E8792C",
      },
      statLabelStyle: { fontSize: "11px", color: "#8A7C68", marginTop: "2px" },
      hoverHintStyle: {
        marginTop: "auto",
        paddingTop: "18px",
        fontSize: "11.5px",
        color: "#C99A6B",
      },
      chatWrapStyle: {
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        marginTop: "6px",
        overflow: "hidden",
        flex: 1,
      },
      chatTurns: c.chat.map((t) => ({
        q: t.q,
        a: t.a,
        qStyle: {
          alignSelf: "flex-end",
          background: "rgba(255,255,255,0.1)",
          color: "#F0E8DC",
          fontSize: "10.5px",
          lineHeight: 1.25,
          padding: "4px 8px",
          borderRadius: "10px 10px 3px 10px",
          maxWidth: "92%",
        },
        aStyle: {
          alignSelf: "flex-start",
          background: "#3D2A1E",
          color: "#F7EFE3",
          fontSize: "10.5px",
          lineHeight: 1.25,
          padding: "4px 8px",
          borderRadius: "10px 10px 10px 3px",
          maxWidth: "96%",
        },
      })),
    };
  });

  const steps = [
    {
      n: "01",
      title: "Tell us the workflow",
      desc: "Calls, support, scheduling, lead follow-up — describe what should run itself.",
      delay: "0s",
    },
    {
      n: "02",
      title: "We configure & test",
      desc: "Your agent is trained on your business, tested against real scenarios before going live.",
      delay: "0.1s",
    },
    {
      n: "03",
      title: "Go live, monitor, refine",
      desc: "Live in 14 days, with a dashboard showing every conversation and outcome.",
      delay: "0.2s",
    },
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
  const fieldSetter =
    (field: keyof typeof state.form) => (e: ChangeEvent<FieldElement>) =>
      setState((s) => ({ form: { ...s.form, [field]: e.target.value } }));
  return {
    scrollToForm: scrollToForm,
    formSectionRef: formSectionRef,
    aiTeamCards,
    steps,
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

export function AiAgentsView() {
  const {
    scrollToForm,
    formSectionRef,
    aiTeamCards,
    steps,
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
                    animation: "pulseDot 2s ease-in-out infinite",
                  }}
                ></span>
                {" Deployed in 14 days "}
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
                {" Add 24×7 working"}
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
                  {"AI Agents."}
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
                  " Automate the repeatable parts of your business — support, lead follow-up, scheduling, data entry — with AI agents that work around the clock, so your team spends time on what actually needs a human. "
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
                <div
                  onClick={scrollToForm}
                  style={{
                    padding: "16px 26px",
                    borderRadius: "12px",
                    background:
                      "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                    color: "#0A0B0F",
                    fontSize: "15px",
                    fontWeight: "700",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {"Build my AI team →"}
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
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_104643_a2ff80b7-8944-4692-87d5-fbb31011fcf6.png"
                  alt="Glowing AI agent icons around automation dashboard"
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
              {"∞"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"Calls handled per day"}
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
              {"160h"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"Saved per month"}
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
              {"80%"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"Tickets auto-resolved"}
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
              {"14 days"}
            </div>
            <div
              style={{ fontSize: "13px", color: "#8A87A0", marginTop: "6px" }}
            >
              {"To full deployment"}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "100px 64px 120px",
            background: "rgb(244, 241, 234)",
            color: "#1C160E",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              className="reveal"
              style={{
                fontSize: "13px",
                fontWeight: "700",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#E8792C",
                marginBottom: "20px",
              }}
            >
              {"Your AI Team"}
            </div>
            <h2
              className="reveal"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(30px,4vw,48px)",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                margin: "0 0 28px",
              }}
            >
              {"Five agents. Hired in minutes."}
            </h2>
            <p
              className="reveal"
              style={{
                fontSize: "16px",
                color: "#5C5040",
                maxWidth: "520px",
                margin: "0 auto 64px",
                lineHeight: "1.6",
              }}
            >
              {"Hover any card to see a sample conversation."}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: "20px",
                alignItems: "stretch",
                perspective: "1600px",
              }}
            >
              {aiTeamCards.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  style={asStyle(card.flipOuterStyle)}
                  onMouseEnter={card.onEnter}
                  onMouseLeave={card.onLeave}
                >
                  <div style={asStyle(card.flipInnerStyle)}>
                    <div style={asStyle(card.frontFaceStyle)}>
                      <div style={asStyle(card.iconWrapStyle)}>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          dangerouslySetInnerHTML={card.iconSvgObj}
                        ></svg>
                      </div>
                      <div style={asStyle(card.nameStyle)}>{card.name}</div>
                      <div style={asStyle(card.descStyle)}>{card.desc}</div>
                      <div style={asStyle(card.statsRowStyle)}>
                        <div>
                          <div style={asStyle(card.statValStyle)}>
                            {card.stat1Val}
                          </div>
                          <div style={asStyle(card.statLabelStyle)}>
                            {card.stat1Label}
                          </div>
                        </div>
                        <div>
                          <div style={asStyle(card.statValStyle)}>
                            {card.stat2Val}
                          </div>
                          <div style={asStyle(card.statLabelStyle)}>
                            {card.stat2Label}
                          </div>
                        </div>
                      </div>
                      <div style={asStyle(card.hoverHintStyle)}>
                        {"Hover to see sample conversation →"}
                      </div>
                    </div>
                    <div style={asStyle(card.backFaceStyle)}>
                      <div style={asStyle(card.nameStyle)}>{card.name}</div>
                      <div style={asStyle(card.chatWrapStyle)}>
                        {card.chatTurns.map((turn, turnIdx) => (
                          <Fragment key={turnIdx}>
                            <div style={asStyle(turn.qStyle)}>{turn.q}</div>
                            <div style={asStyle(turn.aStyle)}>{turn.a}</div>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "120px 64px", background: "#0E0F16" }}>
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
                  fontSize: "clamp(28px,3.6vw,48px)",
                  lineHeight: "1.1",
                  letterSpacing: "-0.02em",
                  margin: "0",
                }}
              >
                {"From signup to live agent in three steps."}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "32px",
              }}
            >
              {steps.map((step, stepIdx) => (
                <div
                  key={stepIdx}
                  className="reveal"
                  style={{
                    background: "#111219",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    padding: "32px 28px",
                    animationDelay: "{{ step.delay }}",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "32px",
                      fontWeight: "800",
                      color: "#57F2A4",
                      marginBottom: "16px",
                    }}
                  >
                    {step.n}
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
                      fontSize: "14px",
                      color: "#8A87A0",
                      lineHeight: "1.55",
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
                {"Every conversation, one dashboard."}
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
                src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_104646_7622526b-0a6b-454a-85c4-0d4efd75c513.png"
                alt="AI agent dashboard with live chat conversations"
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
              {"Build your AI team."}
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
                  {" to plan your AI team."}
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
                  placeholder="What should your AI agents handle?"
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
                  {"Build my AI team →"}
                </div>
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#6E6C7C",
                    textAlign: "center",
                    margin: "8px 0 0",
                  }}
                >
                  {"Free consultation. No credit card required."}
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
