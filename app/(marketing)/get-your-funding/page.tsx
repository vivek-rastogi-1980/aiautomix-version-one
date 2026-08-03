import type { Metadata } from "next";
import { GetYourFundingView } from "@/features/solutions/get-your-funding/get-your-funding-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "Get Your Funding | Investor-Ready Pitch Deck with AI | AIAutomix",
  },
  description:
    "Turn your validated idea into an investor-ready package — a pitch deck, financial model, and cited market data assembled automatically, so you walk into every conversation with numbers you can defend.",
  keywords:
    "pitch deck generator, investor ready business plan, startup funding, AI pitch deck, financial model generator, fundraising deck",
  alternates: { canonical: "/get-your-funding" },
  openGraph: {
    type: "website",
    title: "Get Your Funding | AIAutomix",
    description:
      "An investor-ready pitch deck, financial model, and cited market data — assembled automatically.",
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
            name: "AIAutomix Funding Package Generator",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "AI-generated investor pitch decks, financial models, and cited market data for startup fundraising.",
          }),
        }}
      />
      <GetYourFundingView />
    </>
  );
}
