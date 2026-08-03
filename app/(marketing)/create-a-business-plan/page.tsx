import type { Metadata } from "next";
import { CreateBusinessPlanView } from "@/features/solutions/create-a-business-plan/create-a-business-plan-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "Create a Business Plan with AI | Investor-Ready in Minutes | AIAutomix",
  },
  description:
    "Turn one idea into a complete, investor-ready business plan — market sizing, positioning, go-to-market, revenue model, and a funding summary, grounded in citation-backed data. Free to start.",
  keywords:
    "AI business plan generator, create business plan, investor ready business plan, startup business plan, business plan software",
  alternates: { canonical: "/create-a-business-plan" },
  openGraph: {
    type: "website",
    title: "Create a Business Plan with AI | AIAutomix",
    description:
      "Describe your idea in plain language and AIAutomix drafts a complete, funding-ready business plan in minutes.",
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
            "@type": "SoftwareApplication",
            name: "AIAutomix Business Plan Generator",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "AI-generated, citation-backed business plans — market sizing, positioning, go-to-market, revenue model, and funding summary from a single idea.",
          }),
        }}
      />
      <CreateBusinessPlanView />
    </>
  );
}
