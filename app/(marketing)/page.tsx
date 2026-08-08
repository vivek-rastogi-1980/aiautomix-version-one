import type { Metadata } from "next";
import { HomeView } from "@/features/home/home-view";

const TITLE = "AI Automation Agency & AI Business Solutions | AIAutoMix";
const DESCRIPTION =
  "Transform your business with AI automation, AI agents, CRM, voice AI, business intelligence, and custom AI solutions. AIAutoMix helps businesses automate, grow, and scale.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AIAutoMix",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function Page() {
  return (
    <>
      <HomeView />
    </>
  );
}
