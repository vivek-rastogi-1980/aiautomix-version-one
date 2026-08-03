import type { Metadata } from "next";
import { ServicesView } from "@/features/services/services-view";

export const metadata: Metadata = {
  title: {
    absolute: "Services | AI Strategy, Automation & Growth | AIAutomix",
  },
  description:
    "From idea validation to 24/7 AI agents — explore every AIAutomix service: business plans, marketing, funding, CRM, lead generation, growth, and AI strategy consulting, all grounded in cited data.",
  keywords:
    "AIAutomix services, AI business automation, AI consulting services, business plan generator, AI CRM, AI lead generation, AI growth strategy",
  alternates: { canonical: "/services" },
  openGraph: {
    type: "website",
    title: "Services | AIAutomix",
    description:
      "Everything your business needs to launch, fund, and scale — powered by AI.",
    images: ["https://staging.aiautomix.com/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "AIAutomix Services",
            itemListElement: [
              {
                "@type": "Service",
                position: 1,
                name: "Validate Your Idea",
                description:
                  "Five AI agents validate your business idea against real market data.",
              },
              {
                "@type": "Service",
                position: 2,
                name: "Create a Business Plan",
                description:
                  "A full, citation-backed business plan drafted from one idea.",
              },
              {
                "@type": "Service",
                position: 3,
                name: "Create Marketing Plan",
                description:
                  "Channel-by-channel marketing plans matched to audience and budget.",
              },
              {
                "@type": "Service",
                position: 4,
                name: "Get Your Funding",
                description:
                  "Investor-ready pitch deck, financial model, and cited market data.",
              },
              {
                "@type": "Service",
                position: 5,
                name: "Generate Leads",
                description:
                  "Automated lead sourcing, scoring, and routing that fills your pipeline.",
              },
              {
                "@type": "Service",
                position: 6,
                name: "24x7 Working AI Agents",
                description:
                  "AI agents for reception, sales, support, and scheduling, working around the clock.",
              },
              {
                "@type": "Service",
                position: 7,
                name: "AI Strategies & Consulting",
                description:
                  "A prioritized automation roadmap grounded in market and competitor data.",
              },
              {
                "@type": "Service",
                position: 8,
                name: "CRM",
                description:
                  "A CRM that updates itself from every AI agent conversation.",
              },
              {
                "@type": "Service",
                position: 9,
                name: "Growth Plan",
                description:
                  "Retention, expansion, and referral loops surfaced by a weekly AI analyst.",
              },
            ],
          }),
        }}
      />
      <ServicesView />
    </>
  );
}
