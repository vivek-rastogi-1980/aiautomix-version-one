"use client";

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Layout effect on the client, plain effect on the server (where neither runs).
 * The mount work adopts the real viewport; doing it in a layout effect applies
 * it before paint, so a narrow visitor never sees a frame of desktop layout.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
import Link from "next/link";
import { asStyle } from "@/lib/styles";
import { trackEvent } from "@/lib/analytics/events";
import { submitLead } from "@/lib/leads/submit";
import { useMergedState } from "@/hooks/use-merged-state";
import { AuthNavLinks } from "@/components/layout/auth-nav-links";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- faithful re-host of the design's imperative animation controller; see MIGRATION-NOTES.md */

const PAGE_CSS = `
@keyframes orbPulse { 0%,100% { transform: scale(1) translate(0,0); } 50% { transform: scale(1.06) translate(6px,-8px); } }
    @keyframes floatSlow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
    @keyframes floatCard1 { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-18px) rotate(-2deg); } }
    @keyframes floatCard2 { 0%,100% { transform: translateY(0) rotate(3deg); } 50% { transform: translateY(-22px) rotate(5deg); } }
    @keyframes floatCard3 { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-14px) rotate(0deg); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
    @keyframes logoDrop { 0% { opacity: 0; transform: translateY(-40px) scale(0.85); } 55% { opacity: 1; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes fillBar { from { width: 0%; } }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
    @keyframes typeLoop { 0%, 4% { width: 0; } 55%, 78% { width: 34ch; } 96%, 100% { width: 0; } }
    @keyframes caretBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
    @keyframes agentActive {
      0%, 6% { border-color: rgba(255,255,255,0.1); box-shadow: none; transform: translateY(0); }
      12%, 26% { border-color: rgba(124,92,255,0.75); box-shadow: 0 0 40px -6px rgba(124,92,255,0.5); transform: translateY(-6px); }
      34%, 100% { border-color: rgba(255,255,255,0.1); box-shadow: none; transform: translateY(0); }
    }
    @keyframes agentDot {
      0%, 6% { background: #4A4858; box-shadow: none; }
      12%, 26% { background: #57F2A4; box-shadow: 0 0 10px rgba(87,242,164,0.7); }
      34%, 100% { background: #4A4858; box-shadow: none; }
    }
    @keyframes lineSweep { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes newsMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes newsMarqueeReverse { from { transform: translateX(-50%); } to { transform: translateX(0); } }
    @keyframes footerGlobePan { from { background-position: 0% center; } to { background-position: -200% center; } }
    [data-trend-card]:hover .explore-btn { opacity: 1 !important; transform: translate(-50%,-50%) scale(1) !important; }
    [data-trend-card]:hover .rocket-plume { transform: translateX(-50%) scaleY(1); opacity: 1; animation: plumeFlicker 0.35s ease-in-out infinite; }
    [data-rocket-btn]:hover .rocket-icon { transform: translateY(-30px) scale(2.4); }
    [data-rocket-btn]:hover .rocket-plume { transform: translateX(-50%) scaleY(1); opacity: 1; animation: plumeFlicker 0.35s ease-in-out infinite; }
    @keyframes plumeFlicker { 0%,100% { height: 20px; } 50% { height: 26px; } }

    /* --- Branded scrollbar for scrollable overlays (the modals) -------------
       The default OS scrollbar renders as a grey system chrome bar against the
       dark modal, which is the one un-designed surface in the overlay. This
       keeps the same affordance — real scrollbar, real drag target, native
       keyboard and wheel behaviour — and only restyles it: brand gradient
       thumb, inset track, and a widen-plus-brighten transition on hover so it
       recedes while reading and becomes obvious the moment you reach for it. */
    .aim-scroll { scrollbar-width: thin; scrollbar-color: rgba(124,92,255,0.55) transparent; }
    .aim-scroll::-webkit-scrollbar { width: 10px; }
    .aim-scroll::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.03);
      border-radius: 100px;
      margin: 8px 0;
    }
    .aim-scroll::-webkit-scrollbar-thumb {
      border-radius: 100px;
      background: linear-gradient(180deg, #7C5CFF 0%, #F0219E 100%);
      /* Transparent border + background-clip insets the thumb inside the track
         without changing the hit area, so it stays easy to grab. */
      border: 3px solid transparent;
      background-clip: content-box;
      transition: background 0.25s ease, border-width 0.2s ease;
    }
    .aim-scroll::-webkit-scrollbar-thumb:hover {
      border-width: 2px;
      background: linear-gradient(180deg, #9B80FF 0%, #FF3FB4 100%);
      background-clip: content-box;
    }
    .aim-scroll::-webkit-scrollbar-thumb:active {
      border-width: 1px;
      background: linear-gradient(180deg, #B7A3FF 0%, #FF63C6 100%);
      background-clip: content-box;
    }
    @media (prefers-reduced-motion: reduce) {
      .aim-scroll::-webkit-scrollbar-thumb { transition: none; }
    }
    @keyframes strategySweep {
      0% { transform: translateX(-160%) skewX(-20deg); opacity: 0; }
      4% { opacity: 1; }
      22% { transform: translateX(160%) skewX(-20deg); opacity: 1; }
      27% { opacity: 0; }
      50% { transform: translateX(-160%) skewX(-20deg); opacity: 0; }
      54% { opacity: 1; }
      72% { transform: translateX(160%) skewX(-20deg); opacity: 1; }
      77%, 100% { opacity: 0; transform: translateX(160%) skewX(-20deg); }
    }
    body { margin: 0; background: #0A0B0F; }
    ::selection { background: #7C5CFF; color: #fff; }
    textarea::placeholder, input::placeholder { color: #6E6C7C; }
    textarea:focus, input:focus, select:focus { border-color: rgba(124,92,255,0.5) !important; }
    [style*="cursor:pointer"], [style*="cursor: pointer"] { transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), filter 0.22s ease, box-shadow 0.22s ease; }
    [style*="cursor:pointer"]:hover, [style*="cursor: pointer"]:hover { transform: scale(1.045); filter: brightness(1.06); }
    [style*="cursor:pointer"]:active, [style*="cursor: pointer"]:active { transform: scale(0.97); }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
    }
    @media (max-width: 900px) {
      .r-stat3 { flex-direction: column !important; }
      .r-stat3 > div { border-right: none !important; border-bottom: 1px solid rgba(10,11,15,0.14) !important; }
      .r-report2 { grid-template-columns: 1fr !important; }
      /* Grid items default to min-width:auto, so they refuse to shrink below
         their min-content and spill out of the single column instead. */
      .r-report2 > * { min-width: 0 !important; }
      .r-team5 { grid-template-columns: repeat(2,1fr) !important; }
      .r-solutions { grid-template-columns: 1fr !important; }
      .r-solutions > div:first-child { font-size: 40px !important; }
      .r-footer4 { grid-template-columns: 1fr 1fr !important; }
    }
    @media (max-width: 640px) {
      .r-team5 { grid-template-columns: 1fr !important; }
      .r-footer4 { grid-template-columns: 1fr !important; }
      [style*="padding:22px 64px"] { padding-left: 20px !important; padding-right: 20px !important; }
      /* The product section and its report card keep desktop side padding
         (64px + 48px = 224px of gutter), which on a 320px screen leaves less
         room than the card's own content needs and pushes it past the right
         edge. Same treatment as the nav rule above. */
      [style*="padding:120px 64px 160px"] { padding-left: 20px !important; padding-right: 20px !important; }
      [style*="padding:56px 48px"] { padding-left: 24px !important; padding-right: 24px !important; }
    }
    @media (max-width: 640px) {
      /* The carousel arrows take 42px each plus their 16px gaps — 116px of
         a 335px row, which left the track narrower than one card and made
         the section read as a cropped strip. Touch scrolls the track
         directly, so the arrows are redundant on a phone. */
      .r-trending-arrow { display: none !important; }
      /* The hero subheading reserves 200px below itself for the ticket
         cards to fly into. Those cards are not rendered below 1100px, so
         on a phone it is 200px of nothing between the subheading and the
         paragraph that follows. */
      [style*="margin:0 0 200px"] { margin-bottom: 72px !important; }
    }
    @media (max-height: 700px) {
      [data-zoom-img] { display: none !important; }
    }
    @media (max-width: 640px) {
      [data-zoom-img] { display: none !important; }
    }
`;

const INITIAL_STATE = {
  ideaInput: "",
  ideaInputEcho: "",
  waitlistEmail: "",
  showValidation: false,
  waitlistJoined: false,
  strategyModalOpen: false,
  strategySubmitted: false,
  // `website` is the honeypot: hidden from users, so a human always leaves it
  // empty and a naive bot fills it. Kept in form state so the existing field
  // setters work on it unchanged.
  strategyForm: {
    name: "",
    email: "",
    company: "",
    phone: "",
    goal: "",
    website: "",
  },
  strategyNameError: "",
  strategyEmailError: "",
  strategySubmitError: "",
  validateModalOpen: false,
  validateSubmitted: false,
  validateForm: {
    name: "",
    email: "",
    idea: "",
    industry: "",
    website: "",
  },
  validateNameError: "",
  validateEmailError: "",
  validateSubmitError: "",
  strategyBtnTop: 0,
  deferredReady: false,
  heroCardsReady: false,
  // Must NOT read `window` here. This object is the initial state for both the
  // server render and the client's hydration render; branching on `typeof
  // window` makes the two disagree (server 1920, client whatever the visitor's
  // viewport is), and React reports a hydration mismatch it refuses to patch —
  // leaving desktop-sized hero cards on a phone. The real viewport is applied
  // in `componentDidMount`, after hydration has matched.
  viewportWidth: 1920,
  viewportHeight: 1080,
  heroTraveled: 0,
  activeAgentIndex: 0,
  mutedMap: {} as Record<string, any>,
  newsMarqueeHovered: false,
  menuOpen: false,
  cursorHover: false,
  spinningRestart: null as number | null,
  trendingInput: "",
};
type PageState = typeof INITIAL_STATE;

class HomeController {
  [k: string]: any;
  state: any;
  setState: (u: any) => void;
  props: Record<string, any> = {};
  constructor(state: PageState, setState: (u: any) => void) {
    this.state = state;
    this.setState = setState;
  }
  trendingTrackRef: any = (node?: any) => {
    this._trendingTrack = node;
    if (node && !this._trendingAutoScroll) {
      this._trendingAutoScroll = setInterval(() => {
        if (!this._trendingTrack || this._trendingPaused) return;
        const el = this._trendingTrack;
        if (el.scrollLeft <= 0) el.scrollLeft = el.scrollWidth - el.clientWidth;
        else el.scrollLeft -= 1.2;
        this._tiltTickCount = (this._tiltTickCount || 0) + 1;
        if (this._tiltTickCount % 3 === 0) this._updateTrendingTilt(); // throttle forced-layout reads to ~16fps, not 50fps
      }, 20);
    }
  };
  trendingCardRef: any = (i?: any) => (node?: any) => {
    this.trendingCardRefs[i] = node;
  };
  onTrendingEnter: any = () => {
    this._trendingPaused = true;
  };
  onTrendingLeave: any = () => {
    this._trendingPaused = false;
  };
  trendingCardRefs: any = [];
  _updateTrendingTilt() {
    const track = this._trendingTrack;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    const halfWidth = trackRect.width / 2;
    this.trendingCardRefs.forEach((node?: any) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const delta = Math.max(
        -1,
        Math.min(1, (cardCenter - centerX) / halfWidth),
      );
      const rotate = delta * 12; // left cards tilt left (negative), right cards tilt right
      const scale = 1 - Math.abs(delta) * 0.12;
      node.style.transform = "rotate(" + rotate + "deg) scale(" + scale + ")";
    });
  }
  carouselSectionRef: any = (node?: any) => {
    if (!node || this._carouselObserver) return;
    this._carouselObserver = new IntersectionObserver(
      (entries?: any) => {
        if (!entries[0].isIntersecting) {
          // section left the viewport — mute every video and resume the normal auto-advance
          this.setState({ mutedMap: {} });
          this._startAgentTimer(true);
        }
      },
      { threshold: 0.15 },
    );
    this._carouselObserver.observe(node);
  };
  videoRefs: any = {};
  getVideoRef(i?: any, videoSrc?: any, initialMuted?: any) {
    if (!this._videoRefFns) this._videoRefFns = {};
    if (!this._videoRefFns[i]) {
      this._videoRefFns[i] = (node?: any) => {
        if (node && node.getAttribute("src") !== videoSrc) {
          node.src = videoSrc;
          node.muted = initialMuted;
          node.loop = true;
          node.preload = "metadata"; // don't force full decode/buffer for off-screen carousel videos
        }
      };
    }
    return this._videoRefFns[i];
  }
  REVEAL_DISTANCE: any = 860;
  heroPinRef: any = (node?: any) => {
    if (node) {
      this._heroNode = node;
      this._heroTop = node.offsetTop;
    }
  };
  solutionsSpotlightRef: any = (node?: any) => {
    this._solutionsNode = node;
  };
  strategySpotlightRef: any = (node?: any) => {
    this._strategySpotNode = node;
  };
  fundingSpotlightRef: any = (node?: any) => {
    this._fundingSpotNode = node;
  };
  marketingSpotlightRef: any = (node?: any) => {
    this._marketingSpotNode = node;
  };
  launchSpotlightRef: any = (node?: any) => {
    this._launchSpotNode = node;
  };
  agentsSpotlightRef: any = (node?: any) => {
    this._agentsSpotNode = node;
  };
  growthSpotlightRef: any = (node?: any) => {
    this._growthSpotNode = node;
  };
  businessPlanRef: any = (node?: any) => {
    this._businessPlanNode = node;
  };
  footerRef: any = (node?: any) => {
    this._footerNode = node;
  };
  onFooterMouseMove: any = (e?: any) => {
    if (!this._footerNode) return;
    const rect = this._footerNode.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    this.setState({ footerGlobeOffset: { x: px * 60, y: py * 60 } });
  };
  onFooterMouseLeave: any = () => {
    this.setState({ footerGlobeOffset: { x: 0, y: 0 } });
  };
  finalCtaRef: any = (node?: any) => {
    this._finalCtaNode = node;
  };
  strategyBtnRef: any = (node?: any) => {
    this._strategyBtnNode = node;
  };
  heroInnerRef: any = (node?: any) => {
    this._heroInnerNode = node;
  };
  componentDidMount() {
    this._measureBtn = () => {
      if (this._strategyBtnNode && this._heroInnerNode) {
        const btnRect = this._strategyBtnNode.getBoundingClientRect();
        const innerRect = this._heroInnerNode.getBoundingClientRect();
        const btnTop = Math.round(btnRect.top - innerRect.top);
        if (btnTop !== this.state.strategyBtnTop)
          this.setState({ strategyBtnTop: btnTop });
      }
    };
    this._onResize = () => {
      // `clientWidth` is the layout viewport; `window.innerWidth` also counts
      // the vertical scrollbar. Sizing elements from innerWidth overshoots by
      // the scrollbar width and pushes the widest ones past the right edge —
      // measured here as a 323px card inside a 320px viewport.
      const doc = document.documentElement;
      this.setState({
        viewportWidth: doc.clientWidth || window.innerWidth,
        viewportHeight: doc.clientHeight || window.innerHeight,
      });
      requestAnimationFrame(this._measureBtn);
    };
    window.addEventListener("resize", this._onResize);
    // Adopt the visitor's actual viewport now that hydration is done. Without
    // this the page would stay at the 1920x1080 SSR assumption until the first
    // resize event — which on a phone never comes.
    this._onResize();
    requestAnimationFrame(this._measureBtn);
    // Below-the-fold image/video components (business plan, trending, news — 30+ image-slot
    // custom elements) all mounting in the SAME initial commit as the hero can overwhelm first paint.
    // Stage them across a few macrotasks so no single commit constructs them all at once:
    // hero tickets (11 slots) shortly after first paint, then trending/news (18 slots) after that.
    requestAnimationFrame(() =>
      setTimeout(() => this.setState({ heroCardsReady: true }), 60),
    );
    setTimeout(() => this.setState({ deferredReady: true }), 400);
    // Force-mute every video on each hot-reload during editing so audio never
    // resumes from a prior unmuted interaction while changes are being made.
    this.setState({ mutedMap: {} });
    document.querySelectorAll("video").forEach((v?: any) => {
      v.muted = true;
    });
    // Measure the pinned hero's own on-screen position every frame instead of relying on a
    // 'scroll' event target — the page may scroll via window OR an ancestor container
    // (non-bubbling scroll events would otherwise be missed entirely), but
    // getBoundingClientRect() always reflects the true visual position either way.
    this._running = true;
    const tick = () => {
      if (!this._running) return;
      const now = performance.now();
      if (this._lastScrollTick && now - this._lastScrollTick < 32) {
        this._raf = requestAnimationFrame(tick);
        return;
      }
      this._lastScrollTick = now;
      const node =
        this._heroNode || (document.getElementById("hero-pin-wrap") as any);
      if (node) {
        this._heroNode = node;
        const rect = node.getBoundingClientRect();
        const traveled = Math.round(-rect.top);
        if (traveled !== this.state.heroTraveled)
          this.setState({ heroTraveled: traveled });
      }
      // Zoom-in reveal for Solutions-stack images/headings: plain rAF + getBoundingClientRect
      // check (IntersectionObserver callbacks don't fire in this sandboxed preview iframe).
      if (!this._zoomEls)
        this._zoomEls = document.querySelectorAll(
          "[data-zoom-img], [data-zoom-heading]",
        );
      const vhZoom = window.innerHeight;
      this._zoomEls.forEach((el?: any) => {
        if (el.dataset.zoomed) return;
        const r = el.getBoundingClientRect();
        if (r.top < vhZoom * 0.85 && r.bottom > 0) {
          el.style.transform = "scale(1)";
          el.style.opacity = "1";
          el.dataset.zoomed = "1";
        }
      });
      // Solutions-squeeze: as the Business Plan panel rises up over the sticky
      // Solutions panel, shrink + fade the latter directly via style (no setState —
      // this runs every tick, a re-render storm here is exactly what caused the
      // earlier freeze). Direct DOM writes only.
      if (this._solutionsNode && this._strategySpotNode) {
        const stTop = this._strategySpotNode.getBoundingClientRect().top;
        const vh2 = window.innerHeight;
        const progress = Math.max(0, Math.min(1, 1 - stTop / vh2));
        this._solutionsNode.style.transform =
          "scale(" +
          (1 - progress * 0.16) +
          ") rotate(" +
          -progress * 3 +
          "deg)";
        this._solutionsNode.style.opacity = String(1 - progress);
      }
      if (this._strategySpotNode && this._fundingSpotNode) {
        const fsTop = this._fundingSpotNode.getBoundingClientRect().top;
        const vh3 = window.innerHeight;
        const progress2 = Math.max(0, Math.min(1, 1 - fsTop / vh3));
        this._strategySpotNode.style.transform =
          "scale(" +
          (1 - progress2 * 0.16) +
          ") rotate(" +
          -progress2 * 3 +
          "deg)";
        this._strategySpotNode.style.opacity = String(1 - progress2);
      }
      if (this._fundingSpotNode && this._marketingSpotNode) {
        const msTop = this._marketingSpotNode.getBoundingClientRect().top;
        const vh4 = window.innerHeight;
        const progress3 = Math.max(0, Math.min(1, 1 - msTop / vh4));
        this._fundingSpotNode.style.transform =
          "scale(" +
          (1 - progress3 * 0.16) +
          ") rotate(" +
          -progress3 * 3 +
          "deg)";
        this._fundingSpotNode.style.opacity = String(1 - progress3);
      }
      if (this._marketingSpotNode && this._launchSpotNode) {
        const lsTop = this._launchSpotNode.getBoundingClientRect().top;
        const vh5 = window.innerHeight;
        const progress4 = Math.max(0, Math.min(1, 1 - lsTop / vh5));
        this._marketingSpotNode.style.transform =
          "scale(" +
          (1 - progress4 * 0.16) +
          ") rotate(" +
          -progress4 * 3 +
          "deg)";
        this._marketingSpotNode.style.opacity = String(1 - progress4);
      }
      if (this._launchSpotNode && this._agentsSpotNode) {
        const agTop = this._agentsSpotNode.getBoundingClientRect().top;
        const vh6 = window.innerHeight;
        const progress5 = Math.max(0, Math.min(1, 1 - agTop / vh6));
        this._launchSpotNode.style.transform =
          "scale(" +
          (1 - progress5 * 0.16) +
          ") rotate(" +
          -progress5 * 3 +
          "deg)";
        this._launchSpotNode.style.opacity = String(1 - progress5);
      }
      if (this._agentsSpotNode && this._growthSpotNode) {
        const grTop = this._growthSpotNode.getBoundingClientRect().top;
        const vh7 = window.innerHeight;
        const progress6 = Math.max(0, Math.min(1, 1 - grTop / vh7));
        this._agentsSpotNode.style.transform =
          "scale(" +
          (1 - progress6 * 0.16) +
          ") rotate(" +
          -progress6 * 3 +
          "deg)";
        this._agentsSpotNode.style.opacity = String(1 - progress6);
      }
      if (this._growthSpotNode && this._finalCtaNode) {
        const fcTop = this._finalCtaNode.getBoundingClientRect().top;
        const vh8 = window.innerHeight;
        const progress7 = Math.max(0, Math.min(1, 1 - fcTop / vh8));
        this._growthSpotNode.style.transform =
          "scale(" +
          (1 - progress7 * 0.22) +
          ") rotate(" +
          -progress7 * 4 +
          "deg)";
        this._growthSpotNode.style.opacity = String(
          Math.max(0, 1 - progress7 * 1.3),
        );
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
    this._startAgentTimer();
  }
  _startAgentTimer(enable?: any) {
    if (this._agentTimer) clearInterval(this._agentTimer);
    if (enable === false) return; // paused while an unmuted video plays out
    this._agentTimer = setInterval(() => {
      this.setState((s: any) => ({
        activeAgentIndex: (s.activeAgentIndex + 1) % 5,
        mutedMap: {},
      }));
    }, 12000);
  }
  componentWillUnmount() {
    this._running = false;
    if (this._carouselObserver) this._carouselObserver.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._agentTimer) clearInterval(this._agentTimer);
    if (this._trendingAutoScroll) clearInterval(this._trendingAutoScroll);
    window.removeEventListener("resize", this._onResize);
  }
  renderVals() {
    const accentStops = this.props.accentPalette ?? [
      "#57C7FF",
      "#7C5CFF",
      "#C86CFF",
    ];
    const gradient =
      "linear-gradient(90deg, " +
      accentStops[0] +
      " 0%, " +
      accentStops[1] +
      " 60%, " +
      accentStops[2] +
      " 100%)";
    const glowColor = accentStops[1];
    const motionEnergy = this.props.ticketMotion ?? "energetic";
    const motionScale =
      motionEnergy === "calm" ? 0.4 : motionEnergy === "bold" ? 1.6 : 1;
    const motionDurScale =
      motionEnergy === "calm" ? 1.7 : motionEnergy === "bold" ? 0.7 : 1;
    const scaleAnimDuration = (anim?: any, scale?: any) =>
      anim.replace(
        /([\d.]+)s/,
        (_?: any, s?: any) => (parseFloat(s) * scale).toFixed(2) + "s",
      );
    const glowIntensity = this.props.glowIntensity ?? "signature";
    const glowMult =
      glowIntensity === "subtle" ? 0.35 : glowIntensity === "vivid" ? 1.9 : 1;

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
    const aiTeamCards = aiTeamDefs.map((c?: any, i?: any) => {
      const hovered = this.state["aiTeamHover_" + i];
      return {
        name: c.name,
        desc: c.desc,
        stat1Val: c.stat1Val,
        stat1Label: c.stat1Label,
        stat2Val: c.stat2Val,
        stat2Label: c.stat2Label,
        iconSvgObj: { __html: iconSvgs[c.iconKey as keyof typeof iconSvgs] },
        chatTurns: c.chat.map((t: any) => ({
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
        onEnter: () => this.setState({ ["aiTeamHover_" + i]: true }),
        onLeave: () => this.setState({ ["aiTeamHover_" + i]: false }),
        flipOuterStyle: {
          position: "relative",
          height: "350px",
          borderRadius: "20px",
          maxWidth: "100%",
          boxShadow: hovered
            ? "0 32px 60px -18px rgba(20,15,8,0.35)"
            : "0 6px 18px -10px rgba(20,15,8,0.1)",
          transform: hovered ? "scale(1.03)" : "scale(1)",
          transition:
            "box-shadow 0.4s ease, transform 0.9s cubic-bezier(0.22,1,0.36,1)",
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
        // backface-visibility isn't reliably hiding the reverse face in this runtime, so
        // visibility is driven explicitly by opacity/pointer-events (not just the 3D transform) —
        // the rotateY is kept purely for the visual flip flourish.
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
        statLabelStyle: {
          fontSize: "11px",
          color: "#8A7C68",
          marginTop: "2px",
        },
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
      };
    });

    const navStageWrapStyle = {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      position: "relative",
      overflow: "visible",
      cursor: "pointer",
      pointerEvents: "auto",
    };
    const navIconStageStyle = {
      position: "relative",
      width: "76px",
      height: "76px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    };
    const navBeamWideStyle = {
      position: "absolute",
      top: "-320px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "0",
      height: "0",
      borderLeft: "110px solid transparent",
      borderRight: "110px solid transparent",
      borderTop: "350px solid rgba(255,255,255,0.13)",
      filter: "blur(16px)",
      mixBlendMode: "screen",
      animation: "beamFlicker 3.2s ease-in-out infinite",
      pointerEvents: "none",
    };
    const navBeamCoreStyle = {
      position: "absolute",
      top: "-320px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "0",
      height: "0",
      borderLeft: "20px solid transparent",
      borderRight: "20px solid transparent",
      borderTop: "335px solid rgba(255,255,255,0.6)",
      filter: "blur(2.5px)",
      mixBlendMode: "screen",
      animation: "beamFlicker 3.2s ease-in-out infinite 0.15s",
      pointerEvents: "none",
    };
    const navHazeStyle = {
      position: "absolute",
      top: "-90px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "140px",
      height: "130px",
      background:
        "radial-gradient(ellipse 70px 130px at 50% 0%, rgba(255,255,255,0.4), transparent 72%)",
      mixBlendMode: "screen",
      pointerEvents: "none",
    };
    const navStageLogoStyle = {
      position: "relative",
      width: "76px",
      height: "76px",
      objectFit: "contain",
      zIndex: 2,
      filter:
        "drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1)",
      animation: "navLogoFloat 4.5s ease-in-out infinite",
    };

    const ctaSmallStyle = {
      padding: "9px 18px",
      borderRadius: "9px",
      background: gradient,
      color: "#0A0B0F",
      fontSize: "13px",
      fontWeight: 700,
      cursor: "pointer",
    };

    const ctaMainStyle = {
      padding: "17px 30px",
      borderRadius: "12px",
      background: gradient,
      color: "#0A0B0F",
      fontSize: "15px",
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
    };

    const gradientTextStyle = {
      background: gradient,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
    };

    const heroGlowStyle = {
      position: "absolute",
      top: "-20%",
      left: "50%",
      transform: "translateX(-50%)",
      width: "1100px",
      height: "700px",
      background: `radial-gradient(ellipse at center, ${glowColor}${Math.round(
        Math.min(0.22 * glowMult, 0.9) * 255,
      )
        .toString(16)
        .padStart(2, "0")}, transparent 65%)`,
      filter: "blur(40px)",
      pointerEvents: "none",
      zIndex: 0,
    };

    const ctaGlowStyle = {
      position: "absolute",
      top: "10%",
      left: "50%",
      transform: "translateX(-50%)",
      width: "900px",
      height: "600px",
      background: `radial-gradient(ellipse at center, ${glowColor}${Math.round(
        Math.min(0.16 * glowMult, 0.85) * 255,
      )
        .toString(16)
        .padStart(2, "0")}, transparent 65%)`,
      filter: "blur(40px)",
      pointerEvents: "none",
      zIndex: 0,
    };

    const aivaMiniStyle = {
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: gradient,
      boxShadow: "0 0 20px rgba(124,92,255,0.5)",
      animation: "orbPulse 2.4s ease-in-out infinite",
      flexShrink: 0,
    };

    const scoreDialStyle = {
      width: "200px",
      height: "200px",
      borderRadius: "50%",
      border: "10px solid rgba(87,242,164,0.85)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.02)",
    };

    const reportBadgeStyle = {
      padding: "10px 18px",
      borderRadius: "10px",
      background: "rgba(87,242,164,0.12)",
      color: "#57F2A4",
      fontWeight: 700,
      fontSize: "18px",
      border: "1px solid rgba(87,242,164,0.3)",
    };

    const vw = this.state.viewportWidth;
    const vh = this.state.viewportHeight;
    const rScale =
      vw < 640 ? 0 : vw < 1100 ? 0 : vw < 1400 ? 0.55 : vw < 1700 ? 0.8 : 1;
    const pad = 48;
    // Scroll-linked reveal: cards start stacked behind the title (center, tiny, invisible)
    // and travel out to their resting spot — 4 above the title, 2 flanking its sides — as the
    // page scrolls through the hero.
    const p = Math.min(
      Math.max(this.state.heroTraveled / this.REVEAL_DISTANCE, 0),
      1,
    );
    const eased = 1 - Math.pow(1 - p, 3);

    // The hero pins itself for REVEAL_DISTANCE extra pixels so the flanking
    // ticket cards can travel out from behind the title as the page scrolls.
    //
    // That stage is `display: none` whenever rScale is 0 — every viewport
    // under 1100px. The pin was not made conditional with it, so on a phone
    // the first 860px of scrolling moved nothing: the visitor swipes two or
    // three times against a hero that will not budge, decides the page is
    // broken, and only then reaches real content. Pin only where the reveal
    // it exists for is actually rendered; everywhere else the hero is an
    // ordinary block that scrolls on the first swipe.
    const heroReveals = rScale > 0;
    const heroPinWrapStyle = {
      position: "relative",
      width: "100%",
      boxSizing: "border-box",
      height: heroReveals
        ? "calc(clamp(950px, 100vh + 100px, 2400px) + " +
          this.REVEAL_DISTANCE +
          "px)"
        : "auto",
    };
    const heroInnerStyle = {
      position: heroReveals ? "sticky" : "relative",
      top: 0,
      width: "100%",
      height: heroReveals
        ? "clamp(950px, calc(100vh + 100px), 2400px)"
        : "auto",
      // Without the pinned height the hero should still fill the first screen
      // rather than ending halfway up it.
      minHeight: heroReveals ? undefined : "calc(100vh - 80px)",
      overflow: "hidden",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: heroReveals ? "72px 24px 100px" : "56px 20px 72px",
      textAlign: "center",
    };

    // Tickets flank the heading directly — 3 stacked down the left edge, 3 down the right
    // edge, both columns confined to the hero's own box (hero clips overflow, so nothing
    // spills past its border). They glide out from behind the heading as the hero scrolls.
    const PAD = Math.max(Math.round(28 * rScale), 1);
    const colGap = Math.round(36 * rScale);
    const colTop = 116; // clears the sticky nav/header by 100px+
    const colH = Math.min(vh - colTop - 40, 1560) * 1.5;
    const cardH = Math.round((colH - colGap * 5) / 6) + 10;
    const cardWSide = Math.round(375 * rScale);
    const stageStyle = {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      pointerEvents: "none",
      display: rScale === 0 ? "none" : "block",
    };

    const cardDefs = [
      {
        title: "Validate Your Idea",
        placeholder: "Founder reviewing data on a laptop",
        col: "left",
        row: 0,
        rotate: -5,
        anim: "floatCard1 7s ease-in-out infinite",
        delay: "0s",
        link: "/ai-business-idea-validation",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155234_0136d1d2-89e6-41b7-b3f1-fbd459735cac.png",
      },
      {
        title: "Create Your Business Plan",
        placeholder: "Grounded business plan document",
        col: "left",
        row: 1,
        rotate: 3,
        anim: "floatCard2 8s ease-in-out infinite",
        delay: "0.5s",
        link: "/create-a-business-plan",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155235_b885ebc9-4e33-4b9b-9427-b61a0478ceb2.png",
      },
      {
        title: "Create Marketing Plan",
        placeholder: "Marketing campaign strategy board",
        col: "left",
        row: 2,
        rotate: -2,
        anim: "floatCard1 7.4s ease-in-out infinite",
        delay: "0.8s",
        link: "/create-marketing-plan",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_141830_3185fd5f-98f8-40f5-ba89-c5fd182da676.png",
      },
      {
        title: "Add 24×7 Working AI Agents",
        placeholder: "AI agents working around the clock",
        col: "left",
        row: 3,
        rotate: -3,
        anim: "floatCard3 6.5s ease-in-out infinite",
        delay: "0.9s",
        pinBottom: true,
        link: "/ai-agents",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155237_a3104645-e762-4202-a656-20bd55e14dbc.png",
      },
      {
        title: "Get Your Funding",
        placeholder: "Investor pitch meeting",
        col: "right",
        row: 0,
        rotate: 4,
        anim: "floatCard1 7.5s ease-in-out infinite",
        delay: "0.3s",
        link: "/get-your-funding",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155239_3fcfacb5-da9a-4312-8369-69020f144fe9.png",
      },
      {
        title: "Generate Leads",
        placeholder: "Sales pipeline filling with leads",
        col: "right",
        row: 1,
        rotate: -4,
        anim: "floatCard2 7s ease-in-out infinite",
        delay: "0.7s",
        link: "/generate-leads",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260720_155340_8af144e5-f6c2-4b02-8cfb-a685163885d4.png",
      },
      {
        title: "Growth Plan",
        placeholder: "Business growth chart trending upward",
        col: "right",
        row: 2,
        rotate: 4,
        anim: "floatCard3 7.6s ease-in-out infinite",
        delay: "1.1s",
        link: "/growth-plan",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_141936_ce61d0f0-6c75-49a0-a579-d345cd7a18f1.png",
      },
      {
        title: "AI Strategies & Consulting",
        placeholder: "AI strategy consulting session",
        col: "right",
        row: 3,
        rotate: -5,
        anim: "floatCard2 6.8s ease-in-out infinite",
        delay: "1.5s",
        pinBottom: true,
        link: "/ai-strategies-and-consulting",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_083639_233bcc3c-b1e6-451c-9a3b-c48ba31895c6.png",
      },
      {
        title: "Voice Agent & Chatbot",
        placeholder: "Voice AI agent and chatbot interface",
        col: "left",
        row: 4,
        rotate: -4,
        anim: "floatCard3 7.2s ease-in-out infinite",
        delay: "1.7s",
        pinBottom: true,
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_083641_19198ac7-e5bd-4e05-9e9c-baa5f7fcb9a5.png",
      },
      {
        title: "CRM",
        placeholder: "CRM pipeline dashboard",
        col: "right",
        row: 4,
        rotate: 3,
        anim: "floatCard1 8.2s ease-in-out infinite",
        delay: "1.9s",
        pinBottom: true,
        link: "/crm",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260724_083643_b68a4c73-16f6-4a6e-ad8e-6c33a51ae0ef.png",
      },
    ];
    const scrollDrift = eased * 70; // tickets keep easing further downward as you scroll, not just outward
    const pinnedLeft = cardDefs.filter(
      (c: any) => c.pinBottom && c.col === "left",
    );
    const pinnedRight = cardDefs.filter(
      (c: any) => c.pinBottom && c.col === "right",
    );
    const heroCards = (this.state.heroCardsReady ? cardDefs : []).map(
      (c?: any, i?: any) => {
        const w = cardWSide,
          h = cardH;
        let finalTop;
        if (c.pinBottom) {
          const list = c.col === "left" ? pinnedLeft : pinnedRight;
          const orderFromBottom = list.length - 1 - list.indexOf(c); // last in array = closest to button
          const btnAnchor = this.state.strategyBtnTop
            ? this.state.strategyBtnTop - (h - 50) / 2
            : colTop + colH - h;
          const tightGap = 22; // CRM/Voice Agent sit flush against the button; earlier pinned tickets stack above with a wider gap
          finalTop =
            orderFromBottom === 0
              ? btnAnchor
              : btnAnchor -
                h -
                tightGap -
                (orderFromBottom - 1) * (h + tightGap);
        } else {
          finalTop = colTop + c.row * (cardH + colGap) + scrollDrift;
        }
        const finalLeft = c.col === "left" ? PAD : vw - PAD - w;
        // Origin sits up behind the heading (z-index below the text), so tickets appear to
        // emerge from behind it and glide out to their resting spot in the side column.
        const centerLeft = vw / 2 - w / 2;
        const centerTop = colTop - h / 2;
        const dx = centerLeft - finalLeft;
        const dy = centerTop - finalTop;
        return {
          title: c.title,
          placeholder: c.placeholder,
          imgSrc: c.imgSrc,
          slotId: "hero-card-" + i,
          onCardClick: c.link
            ? () => {
                window.location.href = c.link;
              }
            : undefined,
          wrapStyle: {
            position: "absolute",
            left: finalLeft + "px",
            top: finalTop + "px",
            width: w + "px",
            height: h + "px",
            transform:
              "translate(" +
              dx * (1 - eased) +
              "px, " +
              dy * (1 - eased) +
              "px) scale(" +
              (0.5 + 0.5 * eased) +
              ")",
            transition: "transform 0.08s linear, opacity 0.15s linear",
            opacity: Math.min(eased * 1.4, 1),
            zIndex: 0,
            pointerEvents: eased > 0.5 ? "auto" : "none",
            cursor: c.link ? "pointer" : "default",
          },
          innerStyle: {
            width: "100%",
            height: "205px",
            borderRadius: "16px",
            overflow: "visible",
            position: "relative",
            transform: "rotate(" + c.rotate * motionScale + "deg)",
            animation:
              rScale > 0 ? scaleAnimDuration(c.anim, motionDurScale) : "none",
            animationDelay: c.delay,
          },
          scrimStyle: {
            position: "absolute",
            inset: 0,
            borderRadius: "16px",
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, transparent 55%, rgba(10,11,15,0.9) 100%)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow:
              "0 24px 60px -20px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(124,92,255,0.12)",
          },
          pillStyle: {
            position: "absolute",
            top: "12px",
            left: "12px",
            right: "12px",
            padding: "7px 10px",
            borderRadius: "10px",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            background: "rgba(10,11,15,0.55)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.16)",
            fontSize: rScale < 0.8 ? "10.5px" : "12.5px",
            lineHeight: 1.25,
            fontWeight: 600,
            color: "#F4F3F7",
            fontFamily: "'Inter',sans-serif",
            zIndex: 2,
          },
        };
      },
    );

    const reportCardWrapStyle = {
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gap: "48px",
      alignItems: "center",
      marginTop: "80px",
      background: "#0F0F17",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "24px",
      padding: "48px",
      color: "#F4F3F7",
    };
    const reportScoreDialStyle = {
      position: "relative",
      width: "150px",
      height: "150px",
    };
    const scoreDashOffset = 414.7 * (1 - 72 / 100);
    const scoreNumberWrapStyle = {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "2px",
    };
    const scoreNumberStyle = {
      fontFamily: "'Bricolage Grotesque',sans-serif",
      fontSize: "40px",
      fontWeight: 700,
      color: "#F4F3F7",
    };
    const scoreMaxStyle = {
      fontSize: "14px",
      color: "#8A87A0",
      alignSelf: "flex-end",
      marginBottom: "6px",
    };
    const reportRightColStyle = {
      display: "flex",
      flexDirection: "column",
      gap: "20px",
    };
    const reportVerdictStyle = {
      fontFamily: "'Bricolage Grotesque',sans-serif",
      fontStyle: "italic",
      fontWeight: 500,
      fontSize: "19px",
      color: "#E7E5F0",
      margin: 0,
    };
    const reportBarsWrapStyle = {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    };
    const reportRowDefs = [
      { label: "Market demand", score: 19, max: 25 },
      { label: "Growth", score: 11, max: 15 },
      { label: "Competition", score: 9, max: 15 },
      { label: "Feasibility", score: 8, max: 10 },
      { label: "Revenue", score: 15, max: 20 },
      { label: "Capital", score: 7, max: 10 },
      { label: "Risk", score: 3, max: 5 },
    ];
    const reportRows = reportRowDefs.map((r: any) => ({
      label: r.label,
      score: r.score,
      max: r.max,
      barStyle: {
        height: "100%",
        width: (r.score / r.max) * 100 + "%",
        borderRadius: "4px",
        background: gradient,
      },
    }));
    const reportRowStyle = {
      display: "grid",
      gridTemplateColumns: "110px 1fr 46px",
      alignItems: "center",
      gap: "14px",
    };
    const reportLabelStyle = { fontSize: "14px", color: "#B4B2C0" };
    const reportBarTrackStyle = {
      height: "6px",
      borderRadius: "4px",
      background: "rgba(255,255,255,0.08)",
      overflow: "hidden",
    };
    const reportScoreStyle = {
      fontSize: "13px",
      color: "#7A7887",
      textAlign: "right",
    };
    const reportFooterStyle = {
      fontSize: "11px",
      letterSpacing: "0.08em",
      color: "#5C5A68",
      marginTop: "4px",
    };

    const problemCtaWrapStyle = {
      display: "flex",
      justifyContent: "center",
      marginTop: "64px",
    };
    const problemPillStyle = {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      width: "100%",
      maxWidth: "560px",
      padding: "10px 10px 10px 22px",
      borderRadius: "28px",
      background: "#15161F",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 20px 50px -20px rgba(0,0,0,0.35)",
    };
    const problemInputWrapStyle = {
      position: "relative",
      flex: "1 1 0%",
      minWidth: 0,
      overflow: "hidden",
    };
    const problemInputStyle = {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      color: "#E7E5F0",
      fontSize: "15px",
      fontFamily: "'Inter',sans-serif",
      position: "relative",
      zIndex: 2,
      padding: "13px 0",
      lineHeight: "1.4",
      boxSizing: "border-box",
    };
    const typeMaskStyle = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      overflow: "hidden",
      textAlign: "left",
      pointerEvents: "none",
      zIndex: 1,
    };
    // The reveal div — not the text — is what's animated 0%→100%, always as a percentage of
    // this already-resolved real container, so it can never exceed the pill's actual width
    // at any viewport size. The text inside is unconstrained/auto-width and simply gets
    // clipped by the reveal div's own overflow:hidden.
    const typeRevealStyle = {
      height: "100%",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      width: 0,
      animation: "typeLoop 6s steps(34, end) infinite",
      minHeight: "24px",
    };
    const typeTextStyle = {
      display: "block",
      whiteSpace: "nowrap",
      flexShrink: 0,
      paddingRight: "3px",
      borderRight: "2px solid #7C5CFF",
      color: "#8A87A0",
      fontSize: "15px",
      fontFamily: "'Inter',sans-serif",
    };
    const problemArrowStyle = {
      position: "relative",
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      flexShrink: 0,
      background: gradient,
      color: "#0A0B0F",
      fontSize: "18px",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      overflow: "visible",
      transition: "box-shadow 0.35s ease",
      zIndex: 3,
    };
    const problemArrowStyleHover = {
      boxShadow: "0 12px 30px -6px rgba(124,92,255,0.75)",
    };
    const rocketIconStyle = {
      position: "relative",
      zIndex: 2,
      width: "20px",
      height: "20px",
      objectFit: "contain",
      transition: "transform 0.6s cubic-bezier(0.3,0.9,0.3,1)",
    };
    const rocketPlumeStyle = {
      position: "absolute",
      bottom: "2px",
      left: "50%",
      transform: "translateX(-50%) scaleY(0)",
      transformOrigin: "top",
      width: "6px",
      height: "22px",
      borderRadius: "3px",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(124,92,255,0) 90%)",
      filter: "blur(1.5px)",
      opacity: 0,
      zIndex: 1,
      transition: "transform 0.5s ease, opacity 0.3s ease",
    };

    // OpenArt-style showcase: a large centered active card flanked by two peeking side
    // cards, cycling through the 5 agents on a timer — each slot computed relative to its
    // circular distance from the active index.
    const agentRoleDefs = [
      {
        tag: "Market Agent",
        caption:
          "Market Agent analyzes market demand, industry trends, customer needs, and market opportunities to evaluate the commercial potential of your business idea",
        placeholder: "Market data dashboard glowing on screen",
        isVideo: true,
        videoSrc: "./assets/market-agent.mp4",
      },
      {
        tag: "Competition Agent",
        caption:
          "Competition Agent evaluates competitors, pricing, products, and market strategies to strengthen your business position",
        placeholder: "Competitor landscape board",
        isVideo: true,
        videoSrc: "./assets/competition-agent.mp4",
      },
      {
        tag: "Feasibility & Cost Agent",
        caption: "Pressure-testing team, time, and capital required to build",
        placeholder: "Engineering cost breakdown",
        isVideo: true,
        videoSrc: "./assets/feasibility-agent.mp4",
      },
      {
        tag: "Revenue Agent",
        caption: "Modeling realistic pricing, margins, and revenue potential",
        placeholder: "Revenue projection chart",
        isVideo: true,
        videoSrc: "./assets/revenue-agent.mp4",
      },
      {
        tag: "Synthesis Agent",
        caption: "Weighing every finding into one honest, cited verdict",
        placeholder: "Final validation report",
        isVideo: true,
        videoSrc: "./assets/synthesis-agent.mp4",
      },
    ];
    const active = this.state.activeAgentIndex;
    const n = agentRoleDefs.length;
    // The 340px gutter is a desktop assumption: it reserves room for the
    // flanking ticket columns and the peeking side cards. Below 1100px the
    // tickets are hidden (rScale === 0), so reserving that space no longer buys
    // anything — it just starves the stage. `vw - 340` gave an 88px-wide card at
    // 428px and went negative under 340px, which is why the hero looked broken
    // on phones. Clamp to something that always fits the viewport instead.
    const isCompactStage = vw < 1100;
    const stageGutter = isCompactStage ? 48 : 340;
    const stageMainW = Math.min(Math.max(vw - stageGutter, 240), 980);
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
          this._startAgentTimer(false); // unmuting: hold on this slide until video ends
          const node = document.getElementById(
            "agent-video-0" + (idx + 1),
          ) as any;
          if (node) {
            node.currentTime = 0;
            node.play();
          } // restart from the top on unmute
        } else {
          this._startAgentTimer(true);
        }
        return { mutedMap: { ...s.mutedMap, [idx]: nowMuted } };
      });
    };
    const onVideoEnded = (idx?: any) => () => {
      if (this.state.mutedMap[idx] === false) {
        const nextIdx = (idx + 1) % n;
        // carry the unmuted state to the next slide and auto-play it with sound
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
      background: "rgba(15,16,24,0.65)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(255,255,255,0.18)",
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
      background: "rgba(15,16,24,0.65)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(255,255,255,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "transform 0.2s ease, background 0.2s ease",
    };
    const restartBtnStyleActive = {
      transform: "scale(0.85)",
      background: "rgba(124,92,255,0.5)",
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
      // On desktop the neighbours rest at ±62% of the stage so they peek in from
      // the edges. On compact they are hidden, so that offset buys nothing and
      // costs a lot: `transform` is transitioned, so each advance drags the
      // incoming card in from ±471px — right across and past a 428px screen,
      // and the stage does not clip. Cross-fade in place instead: no card ever
      // travels outside the stage.
      const sideOffset = isCompactStage ? 0 : mainW * 0.62;
      const isMain = rel === 0;
      // The side cards sit at ±62% of the stage width and the stage deliberately
      // does not clip, so on desktop they peek in from the edges. On a narrow
      // screen there is no margin for them to peek into — they are what pushes
      // artwork past the right edge — so the compact layout shows only the
      // active card. `within` also drives opacity, hit-testing and the click
      // handler, so clearing it here retires the side cards completely rather
      // than leaving invisible tap targets over the page.
      const within = Math.abs(rel) <= 1 && !isCompactStage;
      const scale = isMain ? 1 : 0.8;
      const opacity = isMain ? 1 : within ? 0.45 : 0;
      const zIndex = isMain ? 3 : 2 - Math.abs(rel);
      const rotate = isMain ? 0 : rel > 0 ? 6 : -6;
      return {
        slotId: "agent-card-" + i,
        tag: a.tag,
        caption: a.caption,
        placeholder: a.placeholder,
        imgSrc: a.imgSrc,
        isVideo: a.isVideo === true,
        isImage: a.isVideo !== true,
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
        tagStyle: {
          position: "absolute",
          top: "20px",
          left: "20px",
          padding: "7px 16px",
          borderRadius: "100px",
          background: "rgba(15,16,24,0.7)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.14)",
          fontSize: "12.5px",
          fontWeight: 600,
          color: "#EDEBF7",
          fontFamily: "'Inter',sans-serif",
          opacity: isMain ? 1 : 0,
          transition: "opacity 0.4s ease",
        },
        captionBarStyle: {
          position: "absolute",
          left: "20px",
          right: "20px",
          bottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          padding: "14px 16px",
          borderRadius: "14px",
          background: "rgba(15,16,24,0.72)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.1)",
          opacity: isMain ? 1 : 0,
          transition: "opacity 0.4s ease",
        },
        captionTextStyle: {
          fontSize: "13.5px",
          color: "#D6D4E0",
          fontFamily: "'Inter',sans-serif",
          lineHeight: 1.4,
        },
        captionPillStyle: {
          flexShrink: 0,
          padding: "7px 14px",
          borderRadius: "100px",
          background: gradient,
          color: "#0A0B0F",
          fontSize: "11.5px",
          fontWeight: 700,
          whiteSpace: "nowrap",
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

    const trendingSectionStyle = {
      padding: "48px 64px 100px",
      position: "relative",
      background: "#0A0B0F",
      overflow: "hidden",
    };
    const trendingTaglineStyle = {
      fontSize: "14px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#8A87A0",
      fontWeight: 600,
      textAlign: "center",
      marginBottom: "20px",
    };
    const trendingTitleStyle = {
      fontFamily: "'Bricolage Grotesque',sans-serif",
      fontWeight: 800,
      textAlign: "center",
      fontSize: "clamp(34px,5vw,60px)",
      letterSpacing: "-0.02em",
      margin: "0 0 64px",
      background: gradient,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
    const trendingRowWrapStyle = {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      maxWidth: "1400px",
      margin: "0 auto",
    };
    const trendingTrackStyle = {
      display: "flex",
      gap: "20px",
      overflowX: "auto",
      scrollBehavior: "auto",
      flex: 1,
      padding: "10px 4px 24px",
      scrollbarWidth: "none",
    };
    const trendingArrowStyle = (side?: any) => ({
      flexShrink: 0,
      width: "42px",
      height: "42px",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      zIndex: 2,
    });
    const trendingDefs = [
      {
        label: "Restaurant",
        icon: "🍽",
        rotate: -3,
        placeholder: "Restaurant AI solution photo",
        imgSrc: "./assets/trending-restaurant.jpeg",
        link: "/restaurant-ai-automation",
      },
      {
        label: "Hospital",
        icon: "🏥",
        rotate: -1.5,
        placeholder: "Hospital AI solution photo",
        imgSrc: "./assets/trending-hospital.png",
        link: "/hospital-ai-automation",
      },
      {
        label: "Education",
        icon: "🎓",
        rotate: 0,
        placeholder: "Education AI solution photo",
        imgSrc: "./assets/trending-education.jpeg",
        link: "/education-ai-automation",
      },
      {
        label: "Real Estate",
        icon: "🏠",
        rotate: 1.5,
        placeholder: "Real estate AI solution photo",
        imgSrc: "./assets/trending-realestate.jpeg",
        link: "/real-estate-ai-automation",
      },
      {
        label: "Travel",
        icon: "✈️",
        rotate: 3,
        placeholder: "Travel AI solution photo",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_131423_070022f4-04f1-4230-a27d-8edcc0e65d4d.png",
        link: "/travel-ai-automation",
      },
      {
        label: "Gym",
        icon: "🏋️",
        rotate: 4.5,
        placeholder: "Gym AI solution photo",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_131424_66130b83-aa75-481a-ade0-2b5e2ead34d0.png",
        // No dedicated gym page exists yet, and an "Explore Now" that does
        // nothing reads as broken. Services is the nearest real destination
        // until a gym page is written.
        link: "/services",
      },
    ];
    // A 440px card with flexShrink 0 is wider than the phone it is being
    // shown on, so the carousel spilled past the right edge and the arrows
    // scrolled a track the viewport could not contain. Cap the card to the
    // space actually available — the section gutter drops to 20px a side
    // below 640px, so that is what the card has to fit inside.
    const trendingGutter = vw < 640 ? 20 : vw < 1024 ? 32 : 64;
    const trendingCardW = Math.max(Math.min(440, vw - trendingGutter * 2 - 16), 200);
    const trendingImgH = Math.round(trendingCardW * (320 / 440));
    const trendingCards = trendingDefs.map((t?: any, i?: any) => ({
      label: t.label,
      icon: t.icon,
      placeholder: t.placeholder,
      imgSrc: t.imgSrc,
      slotId: "trending-card-" + i,
      link: t.link || null,
      onCardClick: t.link
        ? () => {
            window.location.href = t.link;
          }
        : undefined,
      cardRef: this.trendingCardRef(i),
      cardStyle: {
        flexShrink: 0,
        width: trendingCardW + "px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transformOrigin: "center center",
        transition: "transform 0.12s linear",
      },
      imgWrapStyle: {
        position: "relative",
        width: "100%",
        height: trendingImgH + "px",
        borderRadius: "18px",
        overflow: "hidden",
        background: "#14151f",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 30px 60px -24px rgba(0,0,0,0.7)",
        cursor: "pointer",
      },
      scrimStyle: {
        position: "absolute",
        inset: 0,
        borderRadius: "18px",
        pointerEvents: "none",
        background:
          "linear-gradient(180deg, transparent 55%, rgba(10,11,15,0.6) 100%)",
      },
      topTitleStyle: {
        position: "absolute",
        top: "16px",
        left: "16px",
        right: "16px",
        zIndex: 2,
        padding: "8px 16px",
        borderRadius: "100px",
        background: "rgba(15,16,24,0.7)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.14)",
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontSize: "15px",
        fontWeight: 700,
        color: "#F4F3F7",
        textAlign: "center",
        width: "fit-content",
        margin: "0 auto",
      },
      labelRowStyle: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        justifyContent: "center",
      },
      iconWrapStyle: {
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        background: "#1A1B24",
        border: "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
      },
      labelTextStyle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#E7E5F0",
        fontFamily: "'Inter',sans-serif",
      },
      exploreBtnStyle: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%) scale(0.85)",
        opacity: 0,
        transition: "opacity 0.3s ease, transform 0.3s ease",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#fff",
        color: "#0A0B0F",
        padding: "12px 22px",
        borderRadius: "100px",
        fontWeight: 700,
        fontSize: "14px",
        fontFamily: "'Inter',sans-serif",
        boxShadow: "0 12px 30px -6px rgba(0,0,0,0.5)",
        zIndex: 3,
        textDecoration: "none",
        cursor: "pointer",
      },
      exploreTextStyle: { whiteSpace: "nowrap" },
      exploreRocketWrapStyle: {
        position: "relative",
        width: "16px",
        height: "16px",
        flexShrink: 0,
      },
      exploreRocketPlumeStyle: {
        position: "absolute",
        bottom: "0px",
        left: "50%",
        transform: "translateX(-50%) scaleY(0)",
        transformOrigin: "top",
        width: "5px",
        height: "16px",
        borderRadius: "3px",
        background:
          "linear-gradient(180deg, rgba(124,92,255,0.9), rgba(124,92,255,0) 90%)",
        filter: "blur(1px)",
        opacity: 0,
      },
      exploreRocketIconStyle: {
        position: "relative",
        width: "16px",
        height: "16px",
        objectFit: "contain",
        zIndex: 2,
      },
    }));
    const trendingScrollLeft = () => {
      if (this._trendingTrack)
        this._trendingTrack.scrollBy({ left: -260, behavior: "smooth" });
    };
    const trendingScrollRight = () => {
      if (this._trendingTrack)
        this._trendingTrack.scrollBy({ left: 260, behavior: "smooth" });
    };
    const trendingCtaWrapStyle = {
      display: "flex",
      justifyContent: "center",
      marginTop: "48px",
    };
    const trendingPillStyle = {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      width: "100%",
      maxWidth: "560px",
      padding: "10px 10px 10px 22px",
      borderRadius: "100px",
      background: "#15161F",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 20px 50px -20px rgba(0,0,0,0.35)",
    };
    const trendingInputStyle = {
      flex: "1 1 0%",
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "#E7E5F0",
      fontSize: "15px",
      fontFamily: "'Inter',sans-serif",
    };
    const trendingSubmitStyle = {
      position: "relative",
      overflow: "visible",
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      flexShrink: 0,
      background: gradient,
      color: "#0A0B0F",
      fontSize: "18px",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    };

    const newsMarqueeMaskStyle2 = {
      position: "relative",
      width: "100%",
      overflow: "hidden",
      marginTop: "24px",
      maskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      WebkitMaskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      padding: "0 64px",
    };
    const newsMarqueeTrackStyle2 = {
      display: "flex",
      alignItems: "flex-start",
      gap: "24px",
      width: "max-content",
      animation: "newsMarqueeReverse 34s linear infinite",
      animationPlayState: this.state.newsMarqueeHovered ? "paused" : "running",
    };
    const newsMarqueeMaskStyle = {
      position: "relative",
      width: "100%",
      overflow: "hidden",
      maskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      WebkitMaskImage:
        "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      padding: "0 64px",
    };
    const newsMarqueeTrackStyle = {
      display: "flex",
      alignItems: "flex-start",
      gap: "24px",
      width: "max-content",
      animation: "newsMarquee 34s linear infinite",
      animationPlayState: this.state.newsMarqueeHovered ? "paused" : "running",
    };
    const newsDefsBase = [
      {
        category: "Funding",
        date: "Jul 18",
        headline:
          "AI-native validation tools see a surge in seed-stage investor interest.",
        placeholder: "Investor funding news photo",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_133814_161eb87b-c147-4a00-a2f1-fcbf3e942660.png",
      },
      {
        category: "Research",
        date: "Jul 15",
        headline:
          "New study finds most startup failures were visible in the data months earlier.",
        placeholder: "Research and data news photo",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_133816_3eaa44e5-365a-402f-9a86-7950ce2beaaa.png",
      },
      {
        category: "Product",
        date: "Jul 11",
        headline:
          "Multi-agent systems are replacing single-model tools for business analysis.",
        placeholder: "AI product news photo",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_133818_a5189429-6e95-47e7-9f0a-728054148417.png",
      },
      {
        category: "Industry",
        date: "Jul 6",
        headline:
          "Founders are asking AI for a second opinion before writing a business plan.",
        placeholder: "Industry trend news photo",
        imgSrc:
          "https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260723_133820_ae79ca9e-bfc7-4fc9-a23d-8c7233a5f5bb.png",
      },
    ];
    const newsDefs = [...newsDefsBase, ...newsDefsBase]; // duplicated for a seamless loop
    const newsCards = newsDefs.map((item?: any, i?: any) => ({
      category: item.category,
      headline: item.headline,
      date: item.date,
      author: item.author || "Emily Watterson",
      imgSrc: item.imgSrc,
      placeholder: item.placeholder,
      slotId: "news-row1-" + i,
      cardStyle: {
        flexShrink: 0,
        width: "300px",
        background: "#111219",
        borderRadius: "18px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        cursor: "pointer",
      },
      imgWrapStyle: { position: "relative", width: "100%", aspectRatio: "4/3" },
      bodyStyle: {
        padding: "20px 22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      },
      dateStyle: { fontSize: "12.5px", color: "#7A7887" },
      headlineStyle: {
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontSize: "17px",
        fontWeight: 700,
        lineHeight: 1.35,
        color: "#F4F3F7",
      },
      footerRowStyle: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginTop: "6px",
        flexWrap: "wrap",
      },
      catPillStyle: {
        flexShrink: 0,
        padding: "5px 12px",
        borderRadius: "100px",
        background: "rgba(124,92,255,0.16)",
        fontSize: "10.5px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#B49CFF",
        whiteSpace: "nowrap",
      },
      authorStyle: { fontSize: "12.5px", color: "#7A7887" },
    }));
    const newsCardsRow2 = [...newsDefs]
      .reverse()
      .map((item?: any, i?: any) => ({
        category: item.category,
        headline: item.headline,
        date: item.date,
        author: item.author || "Emily Watterson",
        imgSrc: item.imgSrc,
        placeholder: item.placeholder,
        slotId: "news-row2-" + i,
        cardStyle: {
          flexShrink: 0,
          width: "300px",
          background: "#111219",
          borderRadius: "18px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer",
        },
        imgWrapStyle: {
          position: "relative",
          width: "100%",
          aspectRatio: "4/3",
        },
        bodyStyle: {
          padding: "20px 22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        },
        dateStyle: { fontSize: "12.5px", color: "#7A7887" },
        headlineStyle: {
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontSize: "17px",
          fontWeight: 700,
          lineHeight: 1.35,
          color: "#F4F3F7",
        },
        footerRowStyle: {
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginTop: "6px",
          flexWrap: "wrap",
        },
        catPillStyle: {
          flexShrink: 0,
          padding: "5px 12px",
          borderRadius: "100px",
          background: "rgba(124,92,255,0.16)",
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#B49CFF",
          whiteSpace: "nowrap",
        },
        authorStyle: { fontSize: "12.5px", color: "#7A7887" },
      }));

    const agentDefs = [
      { name: "Market", pct: 100, color: "#57F2A4", status: "Done" },
      { name: "Competition", pct: 100, color: "#57F2A4", status: "Done" },
      {
        name: "Feasibility & cost",
        pct: 100,
        color: "#57F2A4",
        status: "Done",
      },
      { name: "Revenue", pct: 70, color: "#7C5CFF", status: "Running" },
      { name: "Synthesis", pct: 15, color: "#4A4858", status: "Queued" },
    ];
    const agentRows = agentDefs.map((a: any) => ({
      name: a.name,
      status: a.status,
      dotStyle: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: a.color,
        flexShrink: 0,
      },
      barStyle: {
        height: "100%",
        width: a.pct + "%",
        borderRadius: "4px",
        background: gradient,
      },
    }));

    const catDefs = [
      { name: "Market demand", score: 22, max: 25 },
      { name: "Growth potential", score: 12, max: 15 },
      { name: "Competition", score: 10, max: 15 },
      { name: "Feasibility", score: 8, max: 10 },
      { name: "Revenue potential", score: 16, max: 20 },
      { name: "Capital efficiency", score: 7, max: 10 },
      { name: "Risk", score: 3, max: 5 },
    ];
    const scoreCategories = catDefs.map((c: any) => ({
      ...c,
      barStyle: {
        height: "100%",
        width: (c.score / c.max) * 100 + "%",
        borderRadius: "4px",
        background: gradient,
      },
    }));

    const competitors = [
      { name: "ShipNode", stage: "Series A" },
      { name: "Cartway", stage: "Seed" },
      { name: "FleetKit", stage: "Bootstrapped" },
    ];

    const stageDefs = [
      {
        number: "01",
        title: "Validator",
        desc: "Free, citation-backed idea scoring. Your entry point.",
        status: "live",
      },
      {
        number: "02",
        title: "Planner",
        desc: "A grounded business plan built from your validation data.",
        status: "phase 2",
      },
      {
        number: "03",
        title: "Growth Systems",
        desc: "Digital infrastructure, CRM, AI agents, marketing engine.",
        status: "phase 3",
      },
      {
        number: "04",
        title: "Funding",
        desc: "Investor readiness, pitch deck, curated matching.",
        status: "phase 4",
      },
    ];
    const roadmapStages = stageDefs.map((s: any) => ({
      number: s.number,
      title: s.title,
      desc: s.desc,
      statusLabel: s.status === "live" ? "Live now" : s.status,
      statusColor: s.status === "live" ? "#57F2A4" : "#7A7887",
      cellStyle: {
        background: "#0D0E15",
        padding: "40px 32px",
        minHeight: "220px",
        display: "flex",
        flexDirection: "column",
      },
      numberStyle: {
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontSize: "13px",
        fontWeight: 700,
        color: "#7C5CFF",
        letterSpacing: "0.05em",
      },
    }));

    const strategyBtnWrapStyle = {
      position: "relative",
      display: "inline-flex",
      borderRadius: "28px",
      marginTop: "15px",
      marginBottom: "50px",
      zIndex: 2,
    };
    const strategySweepStyle = {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: "40%",
      background:
        "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
      animation: "strategySweep 4.5s ease-in-out infinite",
      pointerEvents: "none",
    };
    const strategyCtaStyle = {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "17px 28px",
      borderRadius: "28px",
      background: "#F0219E",
      color: "#FFFFFF",
      overflow: "hidden",
      fontSize: "14.5px",
      fontWeight: "700",
      cursor: "pointer",
      zIndex: 2,
      boxShadow: "0 12px 32px -8px rgba(240,33,158,0.55)",
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
    };
    const modalTextareaStyle = {
      ...modalInputStyle,
      minHeight: "80px",
      resize: "vertical",
      fontFamily: "inherit",
    };
    const modalIdeaSubmitBtnStyle = {
      flexShrink: 0,
      width: "46px",
      height: "46px",
      borderRadius: "10px",
      background: gradient,
      color: "#0A0B0F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      fontWeight: "700",
      cursor: "pointer",
    };
    const modalSelectStyle = {
      ...modalInputStyle,
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      cursor: "pointer",
      paddingRight: "38px",
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238A87A0' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 16px center",
    };
    const industryOptions = [
      "Real Estate",
      "Healthcare / Hospital",
      "Education",
      "Travel & Hospitality",
      "Restaurant & Food",
      "Fitness & Gym",
      "Retail & E-commerce",
      "Finance & Banking",
      "Legal",
      "Manufacturing",
      "Logistics & Supply Chain",
      "Marketing & Advertising",
      "Human Resources",
      "SaaS / Technology",
      "Other",
    ];
    const modalSubmitStyle = {
      marginTop: "6px",
      padding: "15px",
      borderRadius: "10px",
      background: gradient,
      color: "#0A0B0F",
      fontSize: "15px",
      fontWeight: "700",
      textAlign: "center",
      cursor: "pointer",
    };
    const strategyFieldSetter = (field?: any) => (e?: any) =>
      this.setState((s: any) => ({
        strategyForm: { ...s.strategyForm, [field]: e.target.value },
      }));
    const validateFieldSetter = (field?: any) => (e?: any) =>
      this.setState((s: any) => ({
        validateForm: { ...s.validateForm, [field]: e.target.value },
      }));
    const errorBorderStyle = {
      ...modalInputStyle,
      border: "1px solid #FF6B6B",
    };
    const fieldErrorStyle = {
      margin: "-8px 0 0",
      fontSize: "12.5px",
      color: "#FF8A8A",
    };
    return {
      heroPinRef: this.heroPinRef,
      heroPinWrapStyle,
      heroInnerStyle,
      heroInnerRef: this.heroInnerRef,
      stageStyle,
      solutionsSpotlightRef: this.solutionsSpotlightRef,
      businessPlanRef: this.businessPlanRef,
      scrollToTop: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      menuOpen: this.state.menuOpen,
      toggleMenu: () => this.setState((s: any) => ({ menuOpen: !s.menuOpen })),
      menuOverlayStyle: {
        position: "fixed",
        top: "76px",
        right: "64px",
        zIndex: 9000,
        width: "290px",
        overflow: "hidden",
        transformOrigin: "top right",
        transform: this.state.menuOpen ? "scaleY(1)" : "scaleY(0)",
        opacity: this.state.menuOpen ? 1 : 0,
        transition:
          "transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease",
        pointerEvents: this.state.menuOpen ? "auto" : "none",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      },
      menuLinkListStyle: {
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        borderRadius: "16px",
        padding: "10px",
        boxShadow: "0 30px 70px -20px rgba(0,0,0,0.35)",
      },
      menuLinkStyle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "'Bricolage Grotesque',sans-serif",
        fontWeight: 700,
        fontSize: "15px",
        color: "#181A0E",
        textDecoration: "none",
        cursor: "pointer",
        padding: "13px 16px",
        borderRadius: "10px",
        transition:
          "background 0.25s ease, transform 0.25s ease, padding-left 0.25s ease",
      },
      menuLinkArrowStyle: {
        fontSize: "15px",
        color: "#8A87A0",
        transition: "transform 0.25s ease",
      },
      onMenuLinkEnter: (e?: any) => {
        e.currentTarget.style.background = "#E4E3FA";
        e.currentTarget.style.transform = "translateX(4px)";
        e.currentTarget.style.paddingLeft = "20px";
      },
      onMenuLinkLeave: (e?: any) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.transform = "translateX(0)";
        e.currentTarget.style.paddingLeft = "16px";
      },
      menuNewsletterCardStyle: {
        background: "#FFFFFF",
        borderRadius: "16px",
        padding: "22px",
        boxShadow: "0 30px 70px -20px rgba(0,0,0,0.35)",
      },
      footerRef: this.footerRef,
      onFooterMouseMove: this.onFooterMouseMove,
      onFooterMouseLeave: this.onFooterMouseLeave,
      footerGlobeWrapStyle: {
        position: "absolute",
        left: "64px",
        bottom: "30px",
        width: "400px",
        height: "400px",
        borderRadius: "50%",
        overflow: "hidden",
        opacity: 0.6,
        pointerEvents: "none",
        zIndex: 0,
        boxShadow: "0 0 80px rgba(124,92,255,0.25)",
        transform:
          "translateX(" +
          (this.state.footerGlobeOffset ? this.state.footerGlobeOffset.x : 0) +
          "px) translateY(" +
          (this.state.footerGlobeOffset ? this.state.footerGlobeOffset.y : 0) +
          "px)",
        transition: "transform 0.3s ease-out",
      },
      finalCtaRef: this.finalCtaRef,
      onSpotlightEnter: (e?: any) => {
        const img = e.currentTarget.querySelector("[data-zoom-img]");
        if (img) {
          img.style.transition = "transform 0.5s cubic-bezier(0.16,1,0.3,1)";
          img.style.transform = "scale(1.06)";
        }
      },
      onSpotlightLeave: (e?: any) => {
        const img = e.currentTarget.querySelector("[data-zoom-img]");
        if (img) {
          img.style.transform = "scale(1)";
        }
      },
      strategySpotlightRef: this.strategySpotlightRef,
      fundingSpotlightRef: this.fundingSpotlightRef,
      marketingSpotlightRef: this.marketingSpotlightRef,
      launchSpotlightRef: this.launchSpotlightRef,
      agentsSpotlightRef: this.agentsSpotlightRef,
      growthSpotlightRef: this.growthSpotlightRef,
      navStageWrapStyle,
      navIconStageStyle,
      navBeamWideStyle,
      navBeamCoreStyle,
      navHazeStyle,
      navStageLogoStyle,
      navTitleOpacity: this.state.heroTraveled > 40 ? 0 : 1,
      ctaSmallStyle,
      ctaMainStyle,
      gradientTextStyle,
      heroGlowStyle,
      ctaGlowStyle,
      heroCards,
      aivaMiniStyle,
      reportCardWrapStyle,
      reportScoreDialStyle,
      scoreDashOffset,
      scoreNumberWrapStyle,
      scoreNumberStyle,
      scoreMaxStyle,
      reportRightColStyle,
      reportVerdictStyle,
      reportBarsWrapStyle,
      reportRows,
      reportRowStyle,
      reportLabelStyle,
      reportBarTrackStyle,
      reportScoreStyle,
      reportFooterStyle,
      problemCtaWrapStyle,
      problemPillStyle,
      problemInputWrapStyle,
      problemInputStyle,
      typeMaskStyle,
      typeRevealStyle,
      typeTextStyle,
      problemArrowStyle,
      problemArrowStyleHover,
      rocketIconStyle,
      rocketPlumeStyle,
      carouselSectionRef: this.carouselSectionRef,
      carouselStageStyle,
      carouselDotsStyle,
      agentCarouselCards,
      pauseAgentTimer,
      resumeAgentTimer,
      goToAgent,
      restartBtnStyleActive,
      muteBtnStyle,
      trendingTrackRef: this.trendingTrackRef,
      trendingSectionStyle,
      trendingTaglineStyle,
      trendingTitleStyle,
      trendingRowWrapStyle,
      trendingTrackStyle,
      trendingArrowStyle,
      trendingCards,
      trendingScrollLeft,
      trendingScrollRight,
      onTrendingEnter: this.onTrendingEnter,
      onTrendingLeave: this.onTrendingLeave,
      trendingCtaWrapStyle,
      trendingPillStyle,
      trendingInputStyle,
      trendingSubmitStyle,
      trendingInput: this.state.trendingInput,
      onTrendingInputChange: (e?: any) =>
        this.setState({ trendingInput: e.target.value }),
      submitTrendingIdea: () => {
        const idea = this.state.trendingInput;
        this.setState((s: any) => ({
          validateModalOpen: true,
          validateSubmitted: false,
          validateForm: {
            ...s.validateForm,
            idea: idea || s.validateForm.idea,
          },
        }));
      },
      submitProblemIdea: () => {
        const idea = this.state.ideaInput;
        this.setState((s: any) => ({
          validateModalOpen: true,
          validateSubmitted: false,
          validateForm: {
            ...s.validateForm,
            idea: idea || s.validateForm.idea,
          },
        }));
      },
      newsMarqueeMaskStyle,
      newsMarqueeTrackStyle,
      newsCards,
      aiTeamCards,
      newsMarqueeMaskStyle2,
      newsMarqueeTrackStyle2,
      newsCardsRow2,
      onNewsEnter: () => this.setState({ newsMarqueeHovered: true }),
      onNewsLeave: () => this.setState({ newsMarqueeHovered: false }),

      scoreDialStyle,
      reportBadgeStyle,
      ideaInput: this.state.ideaInput,
      ideaInputEcho:
        this.state.ideaInputEcho || "A subscription box for artisanal coffee",
      onIdeaChange: (e?: any) => this.setState({ ideaInput: e.target.value }),
      showValidation: this.state.showValidation,
      runValidation: () =>
        this.setState((s: any) => ({
          showValidation: true,
          ideaInputEcho:
            s.ideaInput || "A subscription box for artisanal coffee",
        })),
      agentRows,
      overallScore: 78,
      scoreCategories,
      competitors,
      roadmapStages,
      waitlistEmail: this.state.waitlistEmail,
      onWaitlistChange: (e?: any) =>
        this.setState({ waitlistEmail: e.target.value }),
      waitlistCtaLabel: this.state.waitlistJoined
        ? "You're in →"
        : "Join waitlist",
      joinWaitlist: () => this.setState({ waitlistJoined: true }),
      strategyModalOpen: this.state.strategyModalOpen,
      strategySubmitted: this.state.strategySubmitted,
      strategyFormVisible: !this.state.strategySubmitted,
      strategyForm: this.state.strategyForm,
      strategyCtaStyle,
      strategyBtnWrapStyle,
      strategySweepStyle,
      modalOverlayStyle,
      modalCardStyle,
      modalCloseStyle,
      modalInputStyle,
      modalTextareaStyle,
      modalSubmitStyle,
      modalIdeaSubmitBtnStyle,
      nameInputStyle: this.state.strategyNameError
        ? errorBorderStyle
        : modalInputStyle,
      emailInputStyle: this.state.strategyEmailError
        ? errorBorderStyle
        : modalInputStyle,
      nameError: this.state.strategyNameError,
      emailError: this.state.strategyEmailError,
      fieldErrorStyle,
      openStrategyModal: () => {
        // Paired with `book_consultation` on success, so GA4 shows the drop-off
        // between opening the form and completing it.
        trackEvent("ai_demo_started", { source: "strategy-session" });
        this.setState({
          strategyModalOpen: true,
          strategySubmitted: false,
          strategyNameError: "",
          strategyEmailError: "",
        });
      },
      strategyBtnRef: this.strategyBtnRef,
      closeStrategyModal: () => this.setState({ strategyModalOpen: false }),
      stopPropagation: (e?: any) => e.stopPropagation(),
      onStrategyField_name: strategyFieldSetter("name"),
      onStrategyField_email: strategyFieldSetter("email"),
      onStrategyField_company: strategyFieldSetter("company"),
      onStrategyField_phone: strategyFieldSetter("phone"),
      onStrategyField_goal: strategyFieldSetter("goal"),
      submitStrategyForm: () => {
        const f = this.state.strategyForm;
        const nameErr = f.name.trim() ? "" : "Please enter your name.";
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
        const emailErr = f.email.trim()
          ? emailValid
            ? ""
            : "Please enter a valid email address."
          : "Please enter your email.";
        if (nameErr || emailErr) {
          this.setState({
            strategyNameError: nameErr,
            strategyEmailError: emailErr,
          });
          return;
        }
        // Optimistic: show the confirmation immediately, then persist. The
        // previous handler did the same thing but via `mailto:`, which meant
        // the success state was shown even when no mail client existed and the
        // lead was simply lost. Now the success state is provisional and gets
        // corrected if the request actually fails.
        this.setState({
          strategySubmitted: true,
          strategyNameError: "",
          strategyEmailError: "",
          strategySubmitError: "",
        });

        void submitLead(
          "strategy-session",
          {
            name: f.name,
            email: f.email,
            company: f.company,
            phone: f.phone,
            message: f.goal,
          },
          f.website,
        ).then((result) => {
          if (result.ok) {
            // Fired on confirmed persistence, not on click — an event that
            // counts attempts rather than captured leads would overstate the
            // conversion rate. Carries no field values; see lib/analytics.
            trackEvent("book_consultation", { source: "strategy-session" });
            return;
          }
          // Reopen the form with the error rather than leaving the visitor
          // believing a lost lead was received.
          this.setState({
            strategySubmitted: false,
            strategySubmitError: result.message,
          });
        });
      },
      validateModalOpen: this.state.validateModalOpen,
      validateSubmitted: this.state.validateSubmitted,
      validateFormVisible: !this.state.validateSubmitted,
      validateForm: this.state.validateForm,
      validateNameError: this.state.validateNameError,
      validateEmailError: this.state.validateEmailError,
      validateNameInputStyle: this.state.validateNameError
        ? errorBorderStyle
        : modalInputStyle,
      validateEmailInputStyle: this.state.validateEmailError
        ? errorBorderStyle
        : modalInputStyle,
      openValidateModal: () => {
        trackEvent("idea_validator_started", { source: "home-validate-modal" });
        this.setState((s: any) => ({
          validateModalOpen: true,
          validateSubmitted: false,
          validateNameError: "",
          validateEmailError: "",
          validateForm: {
            ...s.validateForm,
            idea: s.ideaInput || s.validateForm.idea,
          },
        }));
      },
      closeValidateModal: () => this.setState({ validateModalOpen: false }),
      onValidateField_name: validateFieldSetter("name"),
      onValidateField_email: validateFieldSetter("email"),
      onValidateField_idea: validateFieldSetter("idea"),
      onValidateField_industry: validateFieldSetter("industry"),
      industryOptions,
      modalSelectStyle,
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
          validateSubmitError: "",
        });

        // Posts to /api/leads via `submitLead`, deliberately.
        //
        // That endpoint mints the activation link for the two funnel sources
        // itself — see the note in app/api/leads/route.ts — so this modal does
        // get the visitor into the product. Routing it at
        // /api/onboarding/validate-idea instead would work too and would carry
        // the funnel's extra fields, its idempotency key and its IDEA_SUBMITTED
        // event, but that is a change of approach rather than a bug fix and it
        // is not made here.
        void submitLead(
          "idea-validation",
          {
            name: f.name,
            email: f.email,
            company: f.industry,
            message: f.idea,
          },
          f.website,
        ).then((result) => {
          if (result.ok) {
            trackEvent("idea_validator_completed", {
              source: "home-validate-modal",
            });
            return;
          }
          this.setState({
            validateSubmitted: false,
            validateSubmitError: result.message,
          });
        });
      },
    };
  }
}
function usePageVals() {
  const [state, setState] = useMergedState<PageState>(INITIAL_STATE);
  const ref = useRef<HomeController | null>(null);
  if (!ref.current) ref.current = new HomeController(state, setState);
  const ctrl = ref.current;
  ctrl.state = state;
  ctrl.setState = setState;
  useIsomorphicLayoutEffect(() => {
    ctrl.componentDidMount();
    return () => ctrl.componentWillUnmount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ctrl.renderVals();
}

export function HomeView() {
  const {
    heroPinRef,
    heroPinWrapStyle,
    heroInnerStyle,
    heroInnerRef,
    stageStyle,
    solutionsSpotlightRef,
    scrollToTop,
    menuOpen,
    toggleMenu,
    menuOverlayStyle,
    menuLinkListStyle,
    menuLinkStyle,
    menuLinkArrowStyle,
    onMenuLinkEnter,
    onMenuLinkLeave,
    menuNewsletterCardStyle,
    footerRef,
    onFooterMouseMove,
    onFooterMouseLeave,
    finalCtaRef,
    onSpotlightEnter,
    onSpotlightLeave,
    strategySpotlightRef,
    fundingSpotlightRef,
    marketingSpotlightRef,
    launchSpotlightRef,
    agentsSpotlightRef,
    growthSpotlightRef,
    navStageWrapStyle,
    navIconStageStyle,
    navBeamWideStyle,
    navBeamCoreStyle,
    navHazeStyle,
    navStageLogoStyle,
    navTitleOpacity,
    gradientTextStyle,
    heroGlowStyle,
    ctaGlowStyle,
    heroCards,
    aivaMiniStyle,
    reportScoreDialStyle,
    scoreDashOffset,
    problemCtaWrapStyle,
    problemPillStyle,
    problemInputWrapStyle,
    problemInputStyle,
    typeMaskStyle,
    typeRevealStyle,
    typeTextStyle,
    problemArrowStyle,
    problemArrowStyleHover,
    rocketIconStyle,
    rocketPlumeStyle,
    carouselSectionRef,
    carouselStageStyle,
    carouselDotsStyle,
    agentCarouselCards,
    pauseAgentTimer,
    resumeAgentTimer,
    restartBtnStyleActive,
    muteBtnStyle,
    trendingTrackRef,
    trendingSectionStyle,
    trendingTaglineStyle,
    trendingTitleStyle,
    trendingRowWrapStyle,
    trendingTrackStyle,
    trendingArrowStyle,
    trendingCards,
    trendingScrollLeft,
    trendingScrollRight,
    onTrendingEnter,
    onTrendingLeave,
    trendingCtaWrapStyle,
    trendingPillStyle,
    trendingInputStyle,
    trendingSubmitStyle,
    trendingInput,
    onTrendingInputChange,
    submitTrendingIdea,
    submitProblemIdea,
    newsMarqueeMaskStyle,
    newsMarqueeTrackStyle,
    newsCards,
    aiTeamCards,
    onNewsEnter,
    onNewsLeave,
    ideaInput,
    ideaInputEcho,
    onIdeaChange,
    showValidation,
    agentRows,
    scoreCategories,
    competitors,
    waitlistEmail,
    onWaitlistChange,
    joinWaitlist,
    strategyModalOpen,
    strategySubmitted,
    strategyFormVisible,
    strategyForm,
    strategyCtaStyle,
    strategyBtnWrapStyle,
    strategySweepStyle,
    modalOverlayStyle,
    modalCardStyle,
    modalCloseStyle,
    modalInputStyle,
    modalTextareaStyle,
    modalSubmitStyle,
    modalIdeaSubmitBtnStyle,
    nameInputStyle,
    emailInputStyle,
    nameError,
    emailError,
    fieldErrorStyle,
    openStrategyModal,
    strategyBtnRef,
    closeStrategyModal,
    stopPropagation,
    onStrategyField_name,
    onStrategyField_email,
    onStrategyField_company,
    onStrategyField_phone,
    onStrategyField_goal,
    submitStrategyForm,
    validateModalOpen,
    validateSubmitted,
    validateFormVisible,
    validateForm,
    validateNameError,
    validateEmailError,
    validateNameInputStyle,
    validateEmailInputStyle,
    closeValidateModal,
    onValidateField_name,
    onValidateField_email,
    onValidateField_idea,
    onValidateField_industry,
    industryOptions,
    modalSelectStyle,
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
          overflow: "visible",
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
            background: "transparent",
            pointerEvents: "none",
          }}
        >
          <div style={asStyle(navStageWrapStyle)} onClick={scrollToTop}>
            <div style={asStyle(navIconStageStyle)}>
              <div style={asStyle(navBeamWideStyle)}></div>
              <div style={asStyle(navBeamCoreStyle)}></div>
              <div style={asStyle(navHazeStyle)}></div>
              <img
                src="/assets/logo-ice2.png"
                style={asStyle(navStageLogoStyle)}
                alt=""
              />
            </div>
          </div>
          {/*
            The "AI Automation Mix" wordmark used to sit here, centred in the
            nav. It now leads the hero heading instead — see the eyebrow above
            the <h1>. Its opacity was bound to "{{ navTitleOpacity }}", an
            unreplaced template placeholder that is not a valid CSS value, so
            the intended scroll fade never ran and it simply sat at full opacity
            on top of the logo.
          */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              pointerEvents: "auto",
            }}
          >
            <AuthNavLinks />
            <div
              onClick={openStrategyModal}
              style={{
                padding: "11px 20px",
                borderRadius: "100px",
                background: "#181A0E",
                color: "#F4F1EA",
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
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#181A0E",
                }}
              ></span>
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
              onClick={openStrategyModal}
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
          <div style={asStyle(menuNewsletterCardStyle)}>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "22px",
                color: "#181A0E",
                lineHeight: "1.15",
                marginBottom: "18px",
              }}
            >
              {"Subscribe to our newsletter"}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#F4F1EA",
                borderRadius: "100px",
                padding: "6px 6px 6px 18px",
              }}
            >
              <input
                value={waitlistEmail}
                onChange={onWaitlistChange}
                placeholder="Your email"
                style={{
                  flex: "1",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "14px",
                  color: "#181A0E",
                  fontFamily: "'Inter',sans-serif",
                }}
              />
              <div
                onClick={joinWaitlist}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#181A0E",
                  color: "#F4F1EA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: "0",
                }}
              >
                {"→"}
              </div>
            </div>
          </div>
        </div>
        {validateModalOpen ? (
          <div style={asStyle(modalOverlayStyle)} onClick={closeValidateModal}>
            <div
              className="aim-scroll"
              style={asStyle(modalCardStyle)}
              onClick={stopPropagation}
            >
              <div
                onClick={closeValidateModal}
                style={asStyle(modalCloseStyle)}
              >
                {"✕"}
              </div>
              {validateSubmitted ? (
                <div style={{ textAlign: "center", padding: "40px 10px" }}>
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
                    {"We have your idea."}
                  </h3>
                  {/*
                    What this step actually does. The old copy said "Your
                    validation is running" and promised "your free score and
                    full report" by email — neither of which happens here:
                    submitting captures the lead and emails an activation
                    link, and the report exists only once the customer runs
                    the validator from their dashboard.
                  */}
                  <p
                    style={{ fontSize: "15px", color: "#8A87A0", margin: "0" }}
                  >
                    {"Check your inbox — we have sent "}
                    {validateForm.email}
                    {" a secure link to open your workspace."}
                  </p>
                </div>
              ) : null}
              {validateFormVisible ? (
                <div style={{ textAlign: "left" }}>
                  <h3
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "26px",
                      fontWeight: "700",
                      margin: "0 0 8px",
                    }}
                  >
                    {"Validate your business idea"}
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "#8A87A0",
                      margin: "0 0 26px",
                    }}
                  >
                    {
                      "Give us a few details — your idea below carries over automatically."
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
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      <input
                        value={validateForm.idea}
                        onChange={onValidateField_idea}
                        placeholder="Describe your business idea…"
                        type="text"
                        style={asStyle(modalInputStyle)}
                      />
                      <div
                        onClick={submitValidateForm}
                        style={asStyle(modalIdeaSubmitBtnStyle)}
                      >
                        {"→"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {strategyModalOpen ? (
          <div style={asStyle(modalOverlayStyle)} onClick={closeStrategyModal}>
            <div
              className="aim-scroll"
              style={asStyle(modalCardStyle)}
              onClick={stopPropagation}
            >
              <div
                onClick={closeStrategyModal}
                style={asStyle(modalCloseStyle)}
              >
                {"✕"}
              </div>
              {strategySubmitted ? (
                <div style={{ textAlign: "center", padding: "40px 10px" }}>
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
                    {"You're booked in."}
                  </h3>
                  <p
                    style={{ fontSize: "15px", color: "#8A87A0", margin: "0" }}
                  >
                    {
                      "Our team will reach out within 24 hours to confirm your session."
                    }
                  </p>
                </div>
              ) : null}
              {strategyFormVisible ? (
                <div style={{ textAlign: "left" }}>
                  <h3
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "26px",
                      fontWeight: "700",
                      margin: "0 0 8px",
                    }}
                  >
                    {"Book a Free AI Strategy Session"}
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      color: "#8A87A0",
                      margin: "0 0 26px",
                    }}
                  >
                    {
                      "Tell us a bit about your business — we'll tailor the session to you."
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
                      value={strategyForm.name}
                      onChange={onStrategyField_name}
                      placeholder="Full name"
                      style={asStyle(nameInputStyle)}
                    />
                    {nameError ? (
                      <p style={asStyle(fieldErrorStyle)}>{nameError}</p>
                    ) : null}
                    <input
                      value={strategyForm.email}
                      onChange={onStrategyField_email}
                      placeholder="Work email"
                      style={asStyle(emailInputStyle)}
                    />
                    {emailError ? (
                      <p style={asStyle(fieldErrorStyle)}>{emailError}</p>
                    ) : null}
                    <input
                      value={strategyForm.company}
                      onChange={onStrategyField_company}
                      placeholder="Company / business name"
                      style={asStyle(modalInputStyle)}
                    />
                    <input
                      value={strategyForm.phone}
                      onChange={onStrategyField_phone}
                      placeholder="Phone number"
                      style={asStyle(modalInputStyle)}
                    />
                    <textarea
                      value={strategyForm.goal}
                      onChange={onStrategyField_goal}
                      placeholder="What do you want AI to help with?"
                      style={asStyle(modalTextareaStyle)}
                    ></textarea>
                    <div
                      onClick={submitStrategyForm}
                      style={asStyle(modalSubmitStyle)}
                    >
                      {"Book my free session →"}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          id="hero-pin-wrap"
          ref={heroPinRef}
          style={asStyle(heroPinWrapStyle)}
        >
          <div ref={heroInnerRef} style={asStyle(heroInnerStyle)}>
            <div style={asStyle(heroGlowStyle)}></div>
            {/*
              Brand eyebrow, relocated from the nav bar. Sized and spaced to
              read as a kicker above the headline rather than competing with
              it — the <h1> stays the largest thing in the hero.
            */}
            <div
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(13px,1.2vw,16px)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#B9B5C9",
                margin: "0 0 18px",
                zIndex: "2",
              }}
            >
              {"AI Automation Mix"}
            </div>
            <h1
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(36px,5.6vw,80px)",
                lineHeight: "0.96",
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                maxWidth: "820px",
                margin: "0 0 24px",
                zIndex: "2",
              }}
            >
              {" Transform Your Business with"}
              <br />
              <span style={asStyle(gradientTextStyle)}>{"AI-Powered"}</span>
              {" Intelligence"}
              <br />
              {"& Automation "}
            </h1>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "600",
                fontSize: "clamp(18px,2vw,26px)",
                lineHeight: "1.3",
                color: "#D6D4E0",
                maxWidth: "640px",
                margin: "0 0 200px",
                zIndex: "2",
              }}
            >
              {"Start with One Idea. Build an Entire Business with AI."}
            </h2>
            <p
              style={{
                fontSize: "18px",
                lineHeight: "1.6",
                color: "#ABA9B8",
                maxWidth: "560px",
                margin: "0 0 36px",
                zIndex: "2",
              }}
            >
              {
                " Validate your ideas, create investor-ready business plans, automate operations, deploy AI agents, generate leads, and scale confidently with AIAutoMix. "
              }
            </p>
            <div style={asStyle(strategyBtnWrapStyle)}>
              <div
                ref={strategyBtnRef}
                onClick={openStrategyModal}
                style={asStyle(strategyCtaStyle)}
              >
                <div style={asStyle(strategySweepStyle)}></div>
                {" Book a Free AI Strategy Session "}
              </div>
            </div>
            <div style={asStyle(stageStyle)}>
              {heroCards.map((card?: any, cardIdx?: any) => (
                <div
                  key={cardIdx}
                  style={asStyle(card.wrapStyle)}
                  onClick={card.onCardClick}
                >
                  <div style={asStyle(card.innerStyle)}>
                    <img
                      src={card.imgSrc}
                      alt={card.placeholder}
                      style={{
                        position: "absolute",
                        inset: "0",
                        borderRadius: "16px",
                        objectFit: "cover",
                        display: "block",
                      }}
                      loading="lazy"
                    />
                    <div style={asStyle(card.scrimStyle)}></div>
                    <div style={asStyle(card.pillStyle)}>{card.title}</div>
                  </div>
                </div>
              ))}
            </div>
            {showValidation ? (
              <div
                style={{
                  marginTop: "64px",
                  width: "100%",
                  maxWidth: "720px",
                  zIndex: "2",
                  textAlign: "left",
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "36px 40px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "24px",
                  }}
                >
                  <div style={asStyle(aivaMiniStyle)}></div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "600" }}>
                      {"Running your validation…"}
                    </div>
                    <div style={{ fontSize: "13px", color: "#7A7887" }}>
                      {'"'}
                      {ideaInputEcho}
                      {'"'}
                    </div>
                  </div>
                </div>
                {agentRows.map((agent?: any, agentIdx?: any) => (
                  <div
                    key={agentIdx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "10px 0",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={asStyle(agent.dotStyle)}></div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#D6D4E0",
                        width: "150px",
                      }}
                    >
                      {agent.name}
                    </div>
                    <div
                      style={{
                        flex: "1",
                        height: "6px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={asStyle(agent.barStyle)}></div>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#7A7887",
                        width: "70px",
                        textAlign: "right",
                      }}
                    >
                      {agent.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div
          style={{
            background: "#F4F1EA",
            color: "#0A0B0F",
            padding: "96px 64px",
            position: "relative",
          }}
        >
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div
              style={{
                fontSize: "14px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A8676",
                marginBottom: "28px",
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {"Why validation first"}
            </div>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(38px,5.5vw,84px)",
                lineHeight: "1.04",
                letterSpacing: "-0.025em",
                margin: "0 0 48px",
                textAlign: "center",
              }}
            >
              {"9 out of 10 startups fail."}
            </h2>
            <div
              className="r-stat3"
              style={{
                display: "flex",
                gap: "0",
                marginTop: "80px",
                border: "1px solid rgba(10,11,15,0.14)",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  flex: "1",
                  padding: "36px 40px",
                  borderRight: "1px solid rgba(10,11,15,0.14)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "38px",
                    fontWeight: "800",
                    marginBottom: "14px",
                  }}
                >
                  {"~42%"}
                </div>
                <p
                  style={{
                    fontSize: "15px",
                    color: "#8A8676",
                    lineHeight: "1.5",
                    margin: "0",
                  }}
                >
                  {"build something the market never asked for"}
                </p>
              </div>
              <div
                style={{
                  flex: "1",
                  padding: "36px 40px",
                  borderRight: "1px solid rgba(10,11,15,0.14)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "38px",
                    fontWeight: "800",
                    marginBottom: "14px",
                  }}
                >
                  {"~29%"}
                </div>
                <p
                  style={{
                    fontSize: "15px",
                    color: "#8A8676",
                    lineHeight: "1.5",
                    margin: "0",
                  }}
                >
                  {"run out of money before finding what works"}
                </p>
              </div>
              <div style={{ flex: "1", padding: "36px 40px" }}>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontSize: "38px",
                    fontWeight: "800",
                    marginBottom: "14px",
                  }}
                >
                  {"~19%"}
                </div>
                <p
                  style={{
                    fontSize: "15px",
                    color: "#8A8676",
                    lineHeight: "1.5",
                    margin: "0",
                  }}
                >
                  {"get outcompeted by players they never mapped"}
                </p>
              </div>
            </div>
            <div style={asStyle(problemCtaWrapStyle)}>
              <div style={asStyle(problemPillStyle)}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ flexShrink: "0", color: "#8A87A0" }}
                >
                  <path
                    d="M4 6h16v12H4z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M15 9l5-2.5v11L15 15"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  ></path>
                </svg>
                <div style={asStyle(problemInputWrapStyle)}>
                  <input
                    value={ideaInput}
                    onChange={onIdeaChange}
                    placeholder=""
                    style={asStyle(problemInputStyle)}
                  />
                  {!ideaInput ? (
                    <div style={asStyle(typeMaskStyle)}>
                      <div style={asStyle(typeRevealStyle)}>
                        <span style={asStyle(typeTextStyle)}>
                          {"Validate your Business Idea Free"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div
                  data-rocket-btn=""
                  onClick={submitProblemIdea}
                  style={asStyle(problemArrowStyle)}
                  onMouseEnter={(e?: any) =>
                    Object.assign(e.currentTarget.style, problemArrowStyleHover)
                  }
                  onMouseLeave={(e?: any) =>
                    Object.assign(e.currentTarget.style, problemArrowStyle)
                  }
                >
                  <div
                    className="rocket-plume"
                    style={asStyle(rocketPlumeStyle)}
                  ></div>
                  <img
                    className="rocket-icon"
                    src="/assets/rocket.png"
                    style={asStyle(rocketIconStyle)}
                    alt=""
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          ref={carouselSectionRef}
          style={{
            padding: "140px 0",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={asStyle(ctaGlowStyle)}></div>
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
                        onMouseDown={(e?: any) =>
                          Object.assign(
                            e.currentTarget.style,
                            restartBtnStyleActive,
                          )
                        }
                        onMouseUp={(e?: any) =>
                          Object.assign(
                            e.currentTarget.style,
                            agent.restartBtnStyle,
                          )
                        }
                        onMouseLeave={(e?: any) =>
                          Object.assign(
                            e.currentTarget.style,
                            agent.restartBtnStyle,
                          )
                        }
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
                  {agent.isImage ? (
                    <img
                      src={agent.imgSrc}
                      alt={agent.placeholder}
                      style={{
                        position: "absolute",
                        inset: "0",
                        width: "100%",
                        height: "100%",
                        borderRadius: "24px",
                        objectFit: "cover",
                        display: "block",
                      }}
                      loading="lazy"
                    />
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
          style={{
            padding: "120px 64px 160px",
            background: "rgb(244, 241, 234)",
          }}
        >
          <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "80px" }}>
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
                {"The product"}
              </div>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(34px,4.5vw,64px)",
                  lineHeight: "1.05",
                  letterSpacing: "-0.02em",
                  margin: "0 0 20px",
                  color: "#0A0B0F",
                }}
              >
                {"Five agents. One honest verdict."}
              </h2>
              <p
                style={{
                  fontSize: "18px",
                  color: "#5C5847",
                  maxWidth: "560px",
                  margin: "0 auto",
                  lineHeight: "1.6",
                }}
              >
                {
                  " Five specialist AI agents investigate your idea — every claim cited, every gap admitted. Watch what happens when an idea goes in. "
                }
              </p>
            </div>
            <div
              className="r-report2"
              style={{
                display: "grid",
                gridTemplateColumns: "0.85fr 1.15fr",
                gap: "24px",
              }}
            >
              <div
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "24px",
                  padding: "56px 48px",
                }}
              >
                <div style={asStyle(reportScoreDialStyle)}>
                  <svg
                    width="150"
                    height="150"
                    viewBox="0 0 150 150"
                    style={{ transform: "rotate(-90deg)" }}
                  >
                    <circle
                      cx="75"
                      cy="75"
                      r="66"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="10"
                    ></circle>
                    <circle
                      cx="75"
                      cy="75"
                      r="66"
                      fill="none"
                      stroke="url(#scoreGrad2)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray="414.7"
                      strokeDashoffset={scoreDashOffset}
                    ></circle>
                    <defs>
                      <linearGradient
                        id="scoreGrad2"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#57C7FF"></stop>
                        <stop offset="100%" stopColor="#7C5CFF"></stop>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "6px",
                    margin: "32px 0 20px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "52px",
                      fontWeight: "800",
                      color: "#F4F3F7",
                    }}
                  >
                    {"72"}
                  </span>{" "}
                  <span style={{ fontSize: "18px", color: "#8A87A0" }}>
                    {"/100"}
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontStyle: "italic",
                    fontSize: "19px",
                    color: "#D6D4E0",
                    lineHeight: "1.5",
                    margin: "0",
                  }}
                >
                  {"Promising — with one risk to fix first."}
                </p>
              </div>
              <div
                style={{
                  background: "#111219",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "24px",
                  padding: "48px 56px",
                }}
              >
                {scoreCategories.map((cat?: any, catIdx?: any) => (
                  <div
                    key={catIdx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      marginBottom: "20px",
                    }}
                  >
                    <span
                      style={{
                        width: "110px",
                        flexShrink: "0",
                        fontSize: "14px",
                        color: "#ABA9B8",
                      }}
                    >
                      {cat.name}
                    </span>
                    <div
                      style={{
                        flex: "1",
                        height: "8px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={asStyle(cat.barStyle)}></div>
                    </div>
                    <span
                      style={{
                        width: "44px",
                        flexShrink: "0",
                        textAlign: "right",
                        fontSize: "13px",
                        color: "#8A87A0",
                      }}
                    >
                      {cat.score}
                      {"/"}
                      {cat.max}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    marginTop: "28px",
                    paddingTop: "24px",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "11.5px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#5C5A66",
                  }}
                >
                  {"Transparent rubric · every number traceable to a source"}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={asStyle(trendingSectionStyle)}>
          <div style={asStyle(trendingTaglineStyle)}>{"Stay Ahead"}</div>
          <h2 style={asStyle(trendingTitleStyle)}>{"Trending AI Solutions"}</h2>
          <div style={asStyle(trendingRowWrapStyle)}>
            <div
              onClick={trendingScrollLeft}
              className="r-trending-arrow"
              style={asStyle(trendingArrowStyle("left"))}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 4l-8 8 8 8"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
            </div>
            <div
              ref={trendingTrackRef}
              style={asStyle(trendingTrackStyle)}
              onMouseEnter={onTrendingEnter}
              onMouseLeave={onTrendingLeave}
            >
              {trendingCards.map((item?: any, itemIdx?: any) => (
                <div
                  key={itemIdx}
                  ref={item.cardRef}
                  style={asStyle(item.cardStyle)}
                  onClick={item.onCardClick}
                >
                  <div data-trend-card="" style={asStyle(item.imgWrapStyle)}>
                    <img
                      src={item.imgSrc}
                      alt={item.placeholder}
                      style={{
                        position: "absolute",
                        inset: "0",
                        width: "100%",
                        height: "100%",
                        borderRadius: "18px",
                        objectFit: "cover",
                        display: "block",
                      }}
                      loading="lazy"
                    />
                    <div style={asStyle(item.scrimStyle)}></div>
                    <div style={asStyle(item.topTitleStyle)}>{item.label}</div>
                    {item.link ? (
                      <a
                        href={item.link}
                        className="explore-btn"
                        style={asStyle(item.exploreBtnStyle)}
                      >
                        <span style={asStyle(item.exploreTextStyle)}>
                          {"Explore Now"}
                        </span>
                        <div style={asStyle(item.exploreRocketWrapStyle)}>
                          <div
                            className="rocket-plume"
                            style={asStyle(item.exploreRocketPlumeStyle)}
                          ></div>
                          <img
                            className="rocket-icon"
                            src="/assets/rocket.png"
                            style={asStyle(item.exploreRocketIconStyle)}
                            alt=""
                          />
                        </div>
                      </a>
                    ) : null}
                    {!item.link ? (
                      <div
                        className="explore-btn"
                        style={asStyle(item.exploreBtnStyle)}
                      >
                        <span style={asStyle(item.exploreTextStyle)}>
                          {"Explore Now"}
                        </span>
                        <div style={asStyle(item.exploreRocketWrapStyle)}>
                          <div
                            className="rocket-plume"
                            style={asStyle(item.exploreRocketPlumeStyle)}
                          ></div>
                          <img
                            className="rocket-icon"
                            src="/assets/rocket.png"
                            style={asStyle(item.exploreRocketIconStyle)}
                            alt=""
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div style={asStyle(item.labelRowStyle)}>
                    <div style={asStyle(item.iconWrapStyle)}>{item.icon}</div>
                    <span style={asStyle(item.labelTextStyle)}>
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              onClick={trendingScrollRight}
              className="r-trending-arrow"
              style={asStyle(trendingArrowStyle("right"))}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 4l8 8-8 8"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
            </div>
          </div>
          <div style={asStyle(trendingCtaWrapStyle)}>
            <div style={asStyle(trendingPillStyle)}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                style={{ flexShrink: "0", color: "#8A87A0" }}
              >
                <path
                  d="M4 6h16v12H4z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                ></path>
                <path
                  d="M15 9l5-2.5v11L15 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                ></path>
              </svg>
              <input
                value={trendingInput}
                onChange={onTrendingInputChange}
                placeholder="Describe your business — get a tailored AI solution…"
                style={asStyle(trendingInputStyle)}
              />
              <div
                data-rocket-btn=""
                onClick={submitTrendingIdea}
                style={asStyle(trendingSubmitStyle)}
                onMouseEnter={(e?: any) =>
                  Object.assign(e.currentTarget.style, problemArrowStyleHover)
                }
                onMouseLeave={(e?: any) =>
                  Object.assign(e.currentTarget.style, trendingSubmitStyle)
                }
              >
                <div
                  className="rocket-plume"
                  style={asStyle(rocketPlumeStyle)}
                ></div>
                <img
                  className="rocket-icon"
                  src="/assets/rocket.png"
                  style={asStyle(rocketIconStyle)}
                  alt=""
                />
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "100px 0 120px",
            position: "relative",
            background: "#0A0B0F",
            color: "#F4F3F7",
            overflow: "hidden",
          }}
        >
          <div
            style={{ maxWidth: "1300px", margin: "0 auto", padding: "0 64px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "24px",
                marginBottom: "48px",
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "700",
                  fontSize: "clamp(24px,2.4vw,30px)",
                  letterSpacing: "-0.01em",
                  margin: "0",
                }}
              >
                {"Latest Insights"}
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#57F2A4",
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#57F2A4",
                    boxShadow: "0 0 0 4px rgba(87,242,164,0.18)",
                  }}
                ></span>
                {" Live updates "}
              </div>
            </div>
          </div>
          <div
            style={asStyle(newsMarqueeMaskStyle)}
            onMouseEnter={onNewsEnter}
            onMouseLeave={onNewsLeave}
          >
            <div style={asStyle(newsMarqueeTrackStyle)}>
              {newsCards.map((item?: any, itemIdx?: any) => (
                <div key={itemIdx} style={asStyle(item.cardStyle)}>
                  <div style={asStyle(item.imgWrapStyle)}>
                    <img
                      src={item.imgSrc}
                      alt={item.placeholder}
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
                  <div style={asStyle(item.bodyStyle)}>
                    <span style={asStyle(item.dateStyle)}>{item.date}</span>{" "}
                    <span style={asStyle(item.headlineStyle)}>
                      {item.headline}
                    </span>
                    <div style={asStyle(item.footerRowStyle)}>
                      <span style={asStyle(item.catPillStyle)}>
                        {item.category}
                      </span>{" "}
                      <span style={asStyle(item.authorStyle)}>
                        {"By "}
                        {item.author}
                      </span>
                    </div>
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
            color: "#1C160E",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
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
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(34px,4.6vw,56px)",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                margin: "0 0 8px",
              }}
            >
              {"Meet Your New"}
            </h2>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(34px,4.6vw,56px)",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                margin: "0 0 28px",
                color: "#E8792C",
              }}
            >
              {"AI Employee"}
            </h2>
            <p
              style={{
                fontSize: "17px",
                color: "#5C5040",
                maxWidth: "560px",
                margin: "0 auto 72px",
                lineHeight: "1.6",
              }}
            >
              {
                " Hire a full team of AI agents that work 24/7 — no salary, no sick days, no breaks. Just results. "
              }
            </p>
            <div
              className="r-team5"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: "20px",
                alignItems: "stretch",
                perspective: "1600px",
              }}
            >
              {aiTeamCards.map((card?: any, cardIdx?: any) => (
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
                        {card.chatTurns.map((turn?: any, turnIdx?: any) => (
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
            <div style={{ marginTop: "64px" }}>
              <p
                style={{
                  fontSize: "16px",
                  color: "#5C5040",
                  margin: "0 0 24px",
                }}
              >
                {"Ready to hire your AI team? We deploy in 14 days."}
              </p>
              <div
                onClick={openStrategyModal}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "17px 30px",
                  borderRadius: "12px",
                  background: "#E8792C",
                  color: "#FFFFFF",
                  fontSize: "15.5px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                {"Build My AI Team →"}
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseEnter={onSpotlightEnter}
          onMouseLeave={onSpotlightLeave}
          ref={solutionsSpotlightRef}
          style={{
            padding: "100px 64px",
            background: "#E9F2C6",
            color: "#181A0E",
            position: "sticky",
            top: "0",
            zIndex: "1",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h2
              data-zoom-heading=""
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(64px,9vw,140px)",
                lineHeight: "0.95",
                letterSpacing: "-0.03em",
                margin: "0 0 60px",
                transform: "scale(0.85)",
                opacity: "0",
                transition:
                  "transform 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease",
              }}
            >
              {"Solutions"}
            </h2>
            <div
              className="r-solutions"
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.85fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(56px,7vw,96px)",
                  lineHeight: "1",
                  color: "#181A0E",
                  alignSelf: "start",
                }}
              >
                {"01"}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "500",
                    fontSize: "clamp(24px,2.6vw,34px)",
                    lineHeight: "1.25",
                    margin: "0 0 24px",
                  }}
                >
                  {"Create a full business plan from one idea"}
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#3A3D28",
                    margin: "0 0 48px",
                  }}
                >
                  {
                    " Describe your idea in plain language and AIAutomix drafts a complete business plan — market sizing, positioning, go-to-market, revenue model, and a funding-ready summary — grounded in the same citation-backed data as your validation score. Refine any section by chatting. "
                  }
                </p>
              </div>
              <div>
                <div
                  data-zoom-img=""
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    transform: "scale(1.22)",
                    transition: "transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260725_105620_d1b8a1cf-8099-4d22-8eba-26b654ec9b65.png"
                    alt="AI-powered business automation in action"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "24px",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "600",
                    }}
                  >
                    {"See what we create"}
                  </span>{" "}
                  <Link
                    href="/create-a-business-plan"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: "0",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="#181A0E"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseEnter={onSpotlightEnter}
          onMouseLeave={onSpotlightLeave}
          ref={strategySpotlightRef}
          style={{
            padding: "100px 64px",
            background: "#DCEEF5",
            color: "#0F1E24",
            position: "sticky",
            top: "0",
            zIndex: "1",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h2
              data-zoom-heading=""
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(64px,9vw,140px)",
                lineHeight: "0.95",
                letterSpacing: "-0.03em",
                margin: "0 0 60px",
                transform: "scale(0.85)",
                opacity: "0",
                transition:
                  "transform 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease",
              }}
            >
              {"Solutions"}
            </h2>
            <div
              className="r-solutions"
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.85fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(56px,7vw,96px)",
                  lineHeight: "1",
                  color: "#0F1E24",
                  alignSelf: "start",
                }}
              >
                {"02"}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "500",
                    fontSize: "clamp(24px,2.6vw,34px)",
                    lineHeight: "1.25",
                    margin: "0 0 24px",
                  }}
                >
                  {"AI Strategies & Consulting"}
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#2A3E44",
                    margin: "0 0 48px",
                  }}
                >
                  {
                    " Sit down with an AI strategist that knows your market, competitors, and numbers cold — get a clear roadmap for where automation pays off first, what to build next, and how to prioritize spend, all backed by the same cited data as your validation score. "
                  }
                </p>
              </div>
              <div>
                <div
                  data-zoom-img=""
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    transform: "scale(1.22)",
                    transition: "transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260725_111942_64581375-4488-49db-b1b5-9d61fa6eb965.png"
                    alt="AI strategy consulting session"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "24px",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "600",
                    }}
                  >
                    {"See what we create"}
                  </span>{" "}
                  <Link
                    href="/ai-strategies-and-consulting"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: "0",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="#0F1E24"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseEnter={onSpotlightEnter}
          onMouseLeave={onSpotlightLeave}
          ref={fundingSpotlightRef}
          style={{
            padding: "100px 64px",
            background: "#FBE8D6",
            color: "#241A0E",
            position: "sticky",
            top: "0",
            zIndex: "1",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h2
              data-zoom-heading=""
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(64px,9vw,140px)",
                lineHeight: "0.95",
                letterSpacing: "-0.03em",
                margin: "0 0 60px",
                transform: "scale(0.85)",
                opacity: "0",
                transition:
                  "transform 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease",
              }}
            >
              {"Solutions"}
            </h2>
            <div
              className="r-solutions"
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.85fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(56px,7vw,96px)",
                  lineHeight: "1",
                  color: "#241A0E",
                  alignSelf: "start",
                }}
              >
                {"03"}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "500",
                    fontSize: "clamp(24px,2.6vw,34px)",
                    lineHeight: "1.25",
                    margin: "0 0 24px",
                  }}
                >
                  {"Get Your Funding"}
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#4A3826",
                    margin: "0 0 48px",
                  }}
                >
                  {
                    " Turn your validated idea into an investor-ready package — a pitch deck, financial model, and cited market data assembled automatically, so you walk into every conversation with numbers you can defend. "
                  }
                </p>
              </div>
              <div>
                <div
                  data-zoom-img=""
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    transform: "scale(1.22)",
                    transition: "transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260725_112544_9ec5c908-dd83-44b9-b312-e981c354c1a8.png"
                    alt="Investor pitch meeting"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "24px",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "600",
                    }}
                  >
                    {"See what we create"}
                  </span>{" "}
                  <Link
                    href="/get-your-funding"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: "0",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="#241A0E"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseEnter={onSpotlightEnter}
          onMouseLeave={onSpotlightLeave}
          ref={marketingSpotlightRef}
          style={{
            padding: "100px 64px",
            background: "#EAE4F5",
            color: "#1E1826",
            position: "sticky",
            top: "0",
            zIndex: "1",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h2
              data-zoom-heading=""
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(64px,9vw,140px)",
                lineHeight: "0.95",
                letterSpacing: "-0.03em",
                margin: "0 0 60px",
                transform: "scale(0.85)",
                opacity: "0",
                transition:
                  "transform 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease",
              }}
            >
              {"Solutions"}
            </h2>
            <div
              className="r-solutions"
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.85fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(56px,7vw,96px)",
                  lineHeight: "1",
                  color: "#1E1826",
                  alignSelf: "start",
                }}
              >
                {"04"}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "500",
                    fontSize: "clamp(24px,2.6vw,34px)",
                    lineHeight: "1.25",
                    margin: "0 0 24px",
                  }}
                >
                  {"Create Marketing Plan"}
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#3A3244",
                    margin: "0 0 48px",
                  }}
                >
                  {
                    " Get channel-by-channel marketing plans — positioning, messaging, ad angles, and content calendars — matched to your audience and budget, backed by the same market data behind your validation score. "
                  }
                </p>
              </div>
              <div>
                <div
                  data-zoom-img=""
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    transform: "scale(1.22)",
                    transition: "transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260725_113308_dd3936f8-08bc-4a81-9944-8acce7ae7f72.png"
                    alt="Marketing team planning campaign strategy"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "24px",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "600",
                    }}
                  >
                    {"See what we create"}
                  </span>{" "}
                  <Link
                    href="/create-marketing-plan"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: "0",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="#1E1826"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseEnter={onSpotlightEnter}
          onMouseLeave={onSpotlightLeave}
          ref={launchSpotlightRef}
          style={{
            padding: "100px 64px",
            background: "#DCF2E4",
            color: "#0E241A",
            position: "sticky",
            top: "0",
            zIndex: "1",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(64px,9vw,140px)",
                lineHeight: "0.95",
                letterSpacing: "-0.03em",
                margin: "0 0 60px",
              }}
            >
              {"Solutions"}
            </h2>
            <div
              className="r-solutions"
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.85fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(56px,7vw,96px)",
                  lineHeight: "1",
                  color: "#0E241A",
                  alignSelf: "start",
                }}
              >
                {"05"}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "500",
                    fontSize: "clamp(24px,2.6vw,34px)",
                    lineHeight: "1.25",
                    margin: "0 0 24px",
                  }}
                >
                  {"Launch"}
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#26382E",
                    margin: "0 0 48px",
                  }}
                >
                  {
                    " Go from validated plan to live product without the usual scramble — a launch checklist, landing page, and first-customer outreach sequence built for you, so day one actually looks like day one. "
                  }
                </p>
              </div>
              <div>
                <div
                  data-zoom-img=""
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    transform: "scale(1.22)",
                    transition: "transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260725_113654_6ed7bbb2-5051-46bd-b415-ad0c34314ef2.png"
                    alt="Team launching a product"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "24px",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "600",
                    }}
                  >
                    {"See what we create"}
                  </span>{" "}
                  <Link
                    href="/validate-your-idea"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: "0",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="#0E241A"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseEnter={onSpotlightEnter}
          onMouseLeave={onSpotlightLeave}
          ref={agentsSpotlightRef}
          style={{
            padding: "100px 64px",
            background: "#F7E1E8",
            color: "#2A0E17",
            position: "sticky",
            top: "0",
            zIndex: "1",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(64px,9vw,140px)",
                lineHeight: "0.95",
                letterSpacing: "-0.03em",
                margin: "0 0 60px",
              }}
            >
              {"Solutions"}
            </h2>
            <div
              className="r-solutions"
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.85fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(56px,7vw,96px)",
                  lineHeight: "1",
                  color: "#2A0E17",
                  alignSelf: "start",
                }}
              >
                {"06"}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "500",
                    fontSize: "clamp(24px,2.6vw,34px)",
                    lineHeight: "1.25",
                    margin: "0 0 24px",
                  }}
                >
                  {"Add 24×7 Working AI Agents"}
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#402430",
                    margin: "0 0 48px",
                  }}
                >
                  {
                    " Automate the repeatable parts of your business — support, lead follow-up, scheduling, data entry — with AI agents that work around the clock, so your team spends time on what actually needs a human. "
                  }
                </p>
              </div>
              <div>
                <div
                  data-zoom-img=""
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    transform: "scale(1.22)",
                    transition: "transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260725_113811_e47406ae-5dbe-4412-9c73-9a61eeed67e7.png"
                    alt="24/7 AI agents automating workflows"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "24px",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "600",
                    }}
                  >
                    {"See what we create"}
                  </span>{" "}
                  <Link
                    href="/ai-agents"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: "0",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="#2A0E17"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseEnter={onSpotlightEnter}
          onMouseLeave={onSpotlightLeave}
          ref={growthSpotlightRef}
          style={{
            padding: "100px 64px",
            background: "#E4F0E8",
            color: "#0E241A",
            position: "sticky",
            top: "0",
            zIndex: "1",
          }}
        >
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "800",
                fontSize: "clamp(64px,9vw,140px)",
                lineHeight: "0.95",
                letterSpacing: "-0.03em",
                margin: "0 0 60px",
              }}
            >
              {"Solutions"}
            </h2>
            <div
              className="r-solutions"
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.85fr 1fr",
                gap: "40px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: "800",
                  fontSize: "clamp(56px,7vw,96px)",
                  lineHeight: "1",
                  color: "#0E241A",
                  alignSelf: "start",
                }}
              >
                {"07"}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: "500",
                    fontSize: "clamp(24px,2.6vw,34px)",
                    lineHeight: "1.25",
                    margin: "0 0 24px",
                  }}
                >
                  {"Growth"}
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#26382E",
                    margin: "0 0 48px",
                  }}
                >
                  {
                    " Track what's working and double down — retention, expansion, and referral loops surfaced from your real usage data, with a standing AI analyst flagging the next highest-leverage move each week. "
                  }
                </p>
              </div>
              <div>
                <div
                  data-zoom-img=""
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    aspectRatio: "4/3",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    transform: "scale(1.22)",
                    transition: "transform 1.1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_3G7jqbleGK3BkzSMBLQtaF7DTkk/hf_20260727_110949_b3b4c125-993d-445e-b0a1-56eb40fabc60.png"
                    alt="Growth analytics surfacing the next best move"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "24px",
                    maxWidth: "320px",
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontSize: "17px",
                      fontWeight: "600",
                    }}
                  >
                    {"See what we create"}
                  </span>{" "}
                  <Link
                    href="/growth-plan"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: "0",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        stroke="#0E241A"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          ref={finalCtaRef}
          style={{
            padding: "180px 64px",
            background: "#0A0B0F",
            color: "#F4F3F7",
            position: "relative",
            zIndex: "2",
            borderRadius: "36px 36px 0 0",
            boxShadow: "0 -60px 100px -30px rgba(0,0,0,0.4)",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <div
              style={{
                fontSize: "14px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8A87A0",
                marginBottom: "24px",
                fontWeight: "600",
              }}
            >
              {"Ready when you are"}
            </div>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: "700",
                fontSize: "clamp(36px,5.2vw,68px)",
                lineHeight: "1.05",
                letterSpacing: "-0.025em",
                margin: "0 0 28px",
              }}
            >
              {" One idea. A complete"}
              <br />
              {"AI-run business. "}
            </h2>
            <p
              style={{
                fontSize: "17px",
                color: "#ABA9B8",
                maxWidth: "520px",
                margin: "0 auto 44px",
                lineHeight: "1.6",
              }}
            >
              {
                " Validate it, plan it, fund it, launch it, and automate it — all backed by the same citation-grounded data, all from one platform. "
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
                  background: "linear-gradient(90deg,#57C7FF,#7C5CFF,#C86CFF)",
                  color: "#0A0B0F",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {"Validate Your Idea Free →"}
              </Link>
              <div
                onClick={openStrategyModal}
                style={{
                  padding: "17px 30px",
                  borderRadius: "100px",
                  background: "transparent",
                  border: "1.5px solid rgba(255,255,255,0.22)",
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
          ref={footerRef}
          onMouseMove={onFooterMouseMove}
          onMouseLeave={onFooterMouseLeave}
          style={{
            background: "#08090C",
            padding: "140px 64px 40px",
            // These four were previously collapsed into the `borderTop` string,
            // complete with a stray `)`. That made the border value invalid — so
            // no border rendered — and silently discarded the other three, which
            // the footer's absolutely-positioned glow relies on.
            borderTop: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
            zIndex: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: "1300px",
              margin: "0 auto",
              position: "relative",
              zIndex: "1",
            }}
          >
            <div
              className="r-footer4"
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
                gap: "48px",
                paddingBottom: "56px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <img
                    src="/assets/logo-ice2.png"
                    style={{
                      width: "26px",
                      height: "26px",
                      objectFit: "contain",
                    }}
                    alt=""
                  />{" "}
                  <span
                    style={{
                      fontFamily: "'Bricolage Grotesque',sans-serif",
                      fontWeight: "700",
                      fontSize: "18px",
                      color: "#F4F3F7",
                    }}
                  >
                    {"AIAutomix"}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6E6C7C",
                    lineHeight: "1.6",
                    maxWidth: "280px",
                    margin: "0",
                  }}
                >
                  {
                    "AI-driven strategy, automation, and validation for founders and growing businesses."
                  }
                </p>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "12.5px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#6E6C7C",
                    fontWeight: "600",
                    marginBottom: "18px",
                  }}
                >
                  {"Product"}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <Link
                    href="/validate-your-idea"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Validate Your Idea"}
                  </Link>{" "}
                  <span style={{ fontSize: "14px", color: "#B4B2C0" }}>
                    {"AI Strategies & Consulting"}
                  </span>{" "}
                  <span style={{ fontSize: "14px", color: "#B4B2C0" }}>
                    {"24×7 AI Agents"}
                  </span>
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "12.5px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#6E6C7C",
                    fontWeight: "600",
                    marginBottom: "18px",
                  }}
                >
                  {"Solutions"}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <Link
                    href="/restaurant-ai-automation"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Restaurant"}
                  </Link>{" "}
                  <Link
                    href="/hospital-ai-automation"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Hospital"}
                  </Link>{" "}
                  <Link
                    href="/education-ai-automation"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Education"}
                  </Link>{" "}
                  <Link
                    href="/real-estate-ai-automation"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Real Estate"}
                  </Link>{" "}
                  <Link
                    href="/travel-ai-automation"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Travel"}
                  </Link>
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "12.5px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#6E6C7C",
                    fontWeight: "600",
                    marginBottom: "18px",
                  }}
                >
                  {"Company"}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "14px", color: "#B4B2C0" }}>
                    {"About"}
                  </span>{" "}
                  <Link
                    href="/contact"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Contact"}
                  </Link>{" "}
                  <Link
                    href="/privacy-policy"
                    style={{
                      fontSize: "14px",
                      color: "#B4B2C0",
                      textDecoration: "none",
                    }}
                  >
                    {"Privacy Policy"}
                  </Link>
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
                paddingTop: "28px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#6E6C7C" }}>
                {"© 2026 AIAutomix. AI Business Transformation Company."}
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "14px" }}
              >
                <a
                  href="https://www.linkedin.com/company/aiautomix"
                  target="_blank"
                  rel="noopener"
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.9-2.1 3.9-2.1 4.2 0 5 2.8 5 6.3V21h-4v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4V9z"
                      fill="#B4B2C0"
                    ></path>
                  </svg>
                </a>{" "}
                <a
                  href="https://www.instagram.com/aiautomationmix"
                  target="_blank"
                  rel="noopener"
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="5"
                      stroke="#B4B2C0"
                      strokeWidth="1.7"
                    ></rect>
                    <circle
                      cx="12"
                      cy="12"
                      r="4"
                      stroke="#B4B2C0"
                      strokeWidth="1.7"
                    ></circle>
                    <circle cx="17.3" cy="6.7" r="1.1" fill="#B4B2C0"></circle>
                  </svg>
                </a>{" "}
                <a
                  href="https://www.youtube.com/@AIAutomix"
                  target="_blank"
                  rel="noopener"
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="2.5"
                      y="5.5"
                      width="19"
                      height="13"
                      rx="3.5"
                      stroke="#B4B2C0"
                      strokeWidth="1.7"
                    ></rect>
                    <path
                      d="M10.2 9.3v5.4l4.7-2.7-4.7-2.7z"
                      fill="#B4B2C0"
                    ></path>
                  </svg>
                </a>
              </div>
              <div style={{ fontSize: "13px", color: "#6E6C7C" }}>
                {"Made @AI Automation Mix"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
