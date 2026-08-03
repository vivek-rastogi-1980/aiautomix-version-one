import type { Metadata } from "next";
import { WebsiteDevelopmentView } from "@/features/dev-services/website-development/website-development-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "AI Website Design & Development Company | Custom Business Websites | AIAutoMix",
  },
  description:
    "Build fast, SEO-friendly, AI-powered websites with AIAutoMix. We create custom business websites, eCommerce platforms, landing pages, and AI-integrated web solutions that generate leads and drive business growth.",
  keywords:
    "AI Website Development, Website Design Company, Custom Website Development, Business Website Design, AI Website Solutions, Professional Website Design, Small Business Website, Startup Website Development, Corporate Website, Responsive Website Design, SEO Friendly Website, Lead Generation Website",
  alternates: { canonical: "/website-development" },
  openGraph: {
    type: "website",
    title: "AI Website Design & Development Company | AIAutoMix",
    description:
      "We don't just build websites — we build intelligent business platforms that attract customers, automate engagement, and generate leads.",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <WebsiteDevelopmentView />
    </>
  );
}
