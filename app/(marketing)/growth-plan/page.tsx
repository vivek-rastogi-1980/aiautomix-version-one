import type { Metadata } from "next";
import { GrowthPlanView } from "@/features/solutions/growth-plan/growth-plan-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "Growth Plan with AI | Retention, Expansion & Referrals | AIAutomix",
  },
  description:
    "Track what's working and double down — retention, expansion, and referral loops surfaced from your real usage data, with a standing AI analyst flagging the next highest-leverage move each week.",
  keywords:
    "AI growth plan, retention automation, revenue expansion strategy, referral loop growth, growth analytics AI",
  alternates: { canonical: "/growth-plan" },
  openGraph: {
    type: "website",
    title: "Growth Plan with AI | AIAutomix",
    description:
      "An AI analyst that finds your next highest-leverage growth move every week.",
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
            name: "AIAutomix Growth Plan",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "AI-driven growth analysis surfacing retention, expansion, and referral opportunities from real usage data.",
          }),
        }}
      />
      <GrowthPlanView />
    </>
  );
}
