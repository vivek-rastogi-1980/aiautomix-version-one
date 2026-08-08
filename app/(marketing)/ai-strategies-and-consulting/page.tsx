import type { Metadata } from "next";
import { AiStrategiesConsultingView } from "@/features/solutions/ai-strategies-and-consulting/ai-strategies-and-consulting-view";

export const metadata: Metadata = {
  title: {
    absolute: "AI Strategies & Consulting | Roadmap for Automation | AIAutomix",
  },
  description:
    "Sit down with an AI strategist that knows your market, competitors, and numbers cold — get a clear roadmap for where automation pays off first and how to prioritize spend.",
  keywords:
    "AI strategy consulting, automation roadmap, AI transformation strategy, digital strategy consulting, AI advisory",
  alternates: { canonical: "/ai-strategies-and-consulting" },
  openGraph: {
    type: "website",
    title: "AI Strategies & Consulting | AIAutomix",
    description:
      "A clear roadmap for where automation pays off first — backed by cited data.",
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
            "@type": "Service",
            name: "AIAutomix AI Strategy & Consulting",
            serviceType: "AI Strategy Consulting",
            description:
              "AI strategy consulting sessions delivering a prioritized automation roadmap grounded in market and competitor data.",
            areaServed: "Global",
          }),
        }}
      />
      <AiStrategiesConsultingView />
    </>
  );
}
