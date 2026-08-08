import type { Metadata } from "next";
import { AiAgentsView } from "@/features/solutions/ai-agents/ai-agents-view";

export const metadata: Metadata = {
  title: { absolute: "24×7 Working AI Agents | Hire Your AI Team | AIAutomix" },
  description:
    "Deploy AI agents that handle calls, sales, support, scheduling, and lead qualification around the clock — no salary, no sick days, no breaks. Deployed in 14 days.",
  keywords:
    "AI agents, 24/7 AI employee, AI receptionist, AI sales agent, AI customer support, AI automation team",
  alternates: { canonical: "/ai-agents" },
  openGraph: {
    type: "website",
    title: "24×7 Working AI Agents | AIAutomix",
    description:
      "Hire a full team of AI agents that work around the clock — deployed in 14 days.",
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
            name: "AIAutomix 24/7 AI Agents",
            serviceType: "AI Business Automation",
            description:
              "AI agents for reception, sales, support, appointment setting, and lead qualification, working around the clock.",
            areaServed: "Global",
          }),
        }}
      />
      <AiAgentsView />
    </>
  );
}
