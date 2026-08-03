import type { Metadata } from "next";
import { GenerateLeadsView } from "@/features/solutions/generate-leads/generate-leads-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "Generate Leads with AI | Fill Your Pipeline Automatically | AIAutomix",
  },
  description:
    "Automated lead generation and scoring that fills your pipeline with qualified prospects — sourced, scored, and routed to your team automatically, 24/7.",
  keywords:
    "AI lead generation, lead scoring automation, sales pipeline automation, qualified leads, B2B lead gen AI",
  alternates: { canonical: "/generate-leads" },
  openGraph: {
    type: "website",
    title: "Generate Leads with AI | AIAutomix",
    description:
      "Fill your pipeline automatically — AI-sourced, scored, and routed leads, 24/7.",
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
            "@type": "Service",
            name: "AIAutomix Lead Generation",
            serviceType: "AI Sales Automation",
            description:
              "Automated lead sourcing, scoring, and routing that fills your sales pipeline with qualified prospects.",
            areaServed: "Global",
          }),
        }}
      />
      <GenerateLeadsView />
    </>
  );
}
