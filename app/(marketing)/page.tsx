import type { Metadata } from "next";
import { HomeView } from "@/features/home/home-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "AIAutomix — AI-Powered Business Strategy, Automation & Validation",
  },
  description:
    "Validate your business idea, build investor-ready plans, automate operations, and deploy 24/7 AI agents. AIAutomix helps you innovate, automate, and scale with confidence.",
  keywords:
    "AI business automation, AI business validation, AI consulting, business plan generator, AI agents, CRM automation, lead generation",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "AIAutomix — AI-Powered Business Strategy, Automation & Validation",
    description:
      "Validate your business idea, build investor-ready plans, automate operations, and deploy 24/7 AI agents.",
    images: ["/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <HomeView />
    </>
  );
}
