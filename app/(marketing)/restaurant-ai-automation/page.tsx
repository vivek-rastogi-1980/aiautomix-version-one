import type { Metadata } from "next";
import { RestaurantAiAutomationView } from "@/features/industries/restaurant-ai-automation/restaurant-ai-automation-view";

export const metadata: Metadata = {
  title: { absolute: "How AI Automation Transforms Restaurants | AIAutomix" },
  description:
    "The global foodservice industry is worth trillions, yet most restaurants still run on manual ordering, scheduling, and inventory. See the real data behind AI automation in ordering, kitchen ops, staffing, and loyalty — plus SaaS ideas worth building.",
  keywords:
    "AI in restaurants, restaurant automation, AI ordering, kitchen automation, restaurant staffing AI, restaurant inventory AI, restaurant SaaS ideas",
  alternates: { canonical: "/restaurant-ai-automation" },
  openGraph: {
    type: "article",
    title: "How AI Automation Transforms Restaurants | AIAutomix",
    description:
      "Restaurants run on thin margins and manual processes. See how AI automation closes the biggest gaps — with real data.",
    images: ["/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <RestaurantAiAutomationView />
    </>
  );
}
