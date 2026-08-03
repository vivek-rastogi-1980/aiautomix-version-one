import type { Metadata } from "next";
import { TravelAiAutomationView } from "@/features/industries/travel-ai-automation/travel-ai-automation-view";

export const metadata: Metadata = {
  title: { absolute: "How AI Automation Transforms Travel | AIAutomix" },
  description:
    "Travel is a $9 trillion industry still run on manual itinerary building and call-center support. See the real data behind AI automation in booking, pricing, support, and personalization — plus SaaS ideas worth building.",
  keywords:
    "AI in travel, travel automation, AI travel concierge, dynamic pricing AI, travel chatbot, personalized itinerary AI, travel SaaS ideas",
  alternates: { canonical: "/travel-ai-automation" },
  openGraph: {
    type: "article",
    title: "How AI Automation Transforms Travel | AIAutomix",
    description:
      "Travel is a $9 trillion industry still run on manual processes. See how AI automation closes the biggest gaps — with real data.",
    images: ["https://staging.aiautomix.com/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <TravelAiAutomationView />
    </>
  );
}
