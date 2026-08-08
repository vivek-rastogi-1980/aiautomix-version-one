import type { Metadata } from "next";
import { CreateMarketingPlanView } from "@/features/solutions/create-marketing-plan/create-marketing-plan-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "Create a Marketing Plan with AI | Channel-by-Channel Strategy | AIAutomix",
  },
  description:
    "Get a complete, channel-by-channel marketing plan — positioning, messaging, ad angles, and a content calendar — matched to your audience and budget, backed by real market data. Free to start.",
  keywords:
    "AI marketing plan generator, create marketing plan, marketing strategy AI, content calendar generator, ad strategy plan",
  alternates: { canonical: "/create-marketing-plan" },
  openGraph: {
    type: "website",
    title: "Create a Marketing Plan with AI | AIAutomix",
    description:
      "Describe your business and AIAutomix drafts a full marketing plan — channels, messaging, and a content calendar — in minutes.",
    images: ["/assets/logo-ice2.png"],
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
            name: "AIAutomix Marketing Plan Generator",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "AI-generated marketing plans — channel strategy, messaging, ad angles, and content calendars matched to audience and budget.",
          }),
        }}
      />
      <CreateMarketingPlanView />
    </>
  );
}
