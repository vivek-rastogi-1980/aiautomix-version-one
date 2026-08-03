import type { Metadata } from "next";
import { SaasProductDevelopmentView } from "@/features/dev-services/saas-product-development/saas-product-development-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "SaaS Product Development Company | AI-Powered SaaS Development | AIAutomix",
  },
  description:
    "Launch your SaaS product faster with AIAutomix. We validate your idea, build your MVP, develop scalable SaaS platforms, integrate AI, automate workflows, and help you grow.",
  keywords:
    "SaaS Product Development, AI SaaS Development, SaaS MVP Development, SaaS Application Development, Build SaaS Product, SaaS Startup Development, SaaS Development Company, SaaS Software Development, SaaS Product Consulting, SaaS MVP Services, AI SaaS Solutions",
  alternates: { canonical: "/saas-product-development" },
  openGraph: {
    type: "website",
    title:
      "SaaS Product Development Company | AI-Powered SaaS Development | AIAutomix",
    description:
      "From idea validation to MVP development and enterprise-scale SaaS platforms, AIAutomix helps founders launch smarter, faster, and with less risk.",
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <SaasProductDevelopmentView />
    </>
  );
}
