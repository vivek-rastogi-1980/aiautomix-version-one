import type { Metadata } from "next";
import { CrmView } from "@/features/solutions/crm/crm-view";

export const metadata: Metadata = {
  title: { absolute: "AI-Powered CRM | Every Deal, One Pipeline | AIAutomix" },
  description:
    "A CRM that updates itself — deals, contacts, and follow-ups logged automatically by your AI agents, with a pipeline that always reflects reality.",
  keywords:
    "AI CRM, automated CRM, sales pipeline software, deal tracking automation, customer relationship management AI",
  alternates: { canonical: "/crm" },
  openGraph: {
    type: "website",
    title: "AI-Powered CRM | AIAutomix",
    description:
      "A CRM that updates itself — deals, contacts, and follow-ups logged automatically.",
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
            name: "AIAutomix CRM",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "AI-powered CRM that automatically logs deals, contacts, and follow-ups from every conversation.",
          }),
        }}
      />
      <CrmView />
    </>
  );
}
