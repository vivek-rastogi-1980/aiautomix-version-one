import type { Metadata } from "next";
import { LandingPageDesignView } from "@/features/dev-services/landing-page-design/landing-page-design-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "High-Converting Landing Page Design Services | AI-Powered Landing Pages | AIAutomix",
  },
  description:
    "Increase leads, sales, and conversions with high-converting landing pages from AIAutomix. We combine persuasive copywriting, premium design, AI automation, and CRO strategies to maximize your ROI.",
  keywords:
    "High-Converting Landing Page Design, Landing Page Design Services, Landing Page Development, Conversion Rate Optimization, Sales Landing Pages, Lead Generation Landing Pages, AI Landing Page Design, Landing Page Agency, Landing Page Optimization, High-Converting Website Design, Custom Landing Page Development",
  alternates: { canonical: "/landing-page-design" },
  openGraph: {
    type: "website",
    title: "High-Converting Landing Page Design Services | AIAutomix",
    description:
      "More than beautiful designs — we create AI-powered, conversion-focused landing pages that capture leads, increase sales, and maximize your marketing ROI.",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <LandingPageDesignView />
    </>
  );
}
