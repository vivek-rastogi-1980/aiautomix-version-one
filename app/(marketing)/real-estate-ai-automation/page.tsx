import type { Metadata } from "next";
import { RealEstateAiAutomationView } from "@/features/industries/real-estate-ai-automation/real-estate-ai-automation-view";

export const metadata: Metadata = {
  title: { absolute: "How AI Automation Transforms Real Estate | AIAutomix" },
  description:
    "Real estate is a $300+ trillion asset class still run on manual workflows. See the real data behind AI automation in property search, valuation, lead conversion, and property management — plus SaaS ideas worth building.",
  keywords:
    "AI in real estate, real estate automation, proptech AI, AI property valuation, real estate lead conversion, virtual staging AI, property management automation",
  alternates: { canonical: "/real-estate-ai-automation" },
  openGraph: {
    type: "article",
    title: "How AI Automation Transforms Real Estate | AIAutomix",
    description:
      "Real estate is a $300+ trillion asset class still run on manual workflows. See how AI automation closes the biggest gaps — with real data.",
    images: ["/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <RealEstateAiAutomationView />
    </>
  );
}
