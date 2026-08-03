import type { Metadata } from "next";
import { MobileAppDevelopmentView } from "@/features/dev-services/mobile-app-development/mobile-app-development-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "Mobile App Development Company | AI-Powered Android & iOS Apps | AIAutomix",
  },
  description:
    "Build high-performance Android, iOS, and cross-platform mobile applications with AIAutomix. We validate your idea, design exceptional user experiences, integrate AI, and launch scalable mobile apps.",
  keywords:
    "Mobile App Development, Mobile Application Development, AI Mobile App Development, Android App Development, iOS App Development, Cross Platform App Development, Flutter App Development, React Native App Development, Custom Mobile App Development, Mobile App Development Company, Mobile App Development Services",
  alternates: { canonical: "/mobile-app-development" },
  openGraph: {
    type: "website",
    title:
      "Mobile App Development Company | AI-Powered Android & iOS Apps | AIAutomix",
    description:
      "From idea validation and UX design to AI integration, development, launch, and continuous growth — we build mobile applications that delight users and drive business results.",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <MobileAppDevelopmentView />
    </>
  );
}
