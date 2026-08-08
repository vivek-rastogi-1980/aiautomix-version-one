import type { Metadata } from "next";
import { HospitalAiAutomationView } from "@/features/industries/hospital-ai-automation/hospital-ai-automation-view";

export const metadata: Metadata = {
  title: { absolute: "How AI Automation Transforms Hospitals | AIAutomix" },
  description:
    "Healthcare is a $10 trillion industry still run on manual scheduling and paperwork. See the real data behind AI automation in patient intake, diagnostics, staffing, and billing — plus SaaS ideas worth building.",
  keywords:
    "AI in healthcare, hospital automation, AI patient intake, medical billing automation, clinical documentation AI, hospital staffing AI, healthcare SaaS ideas",
  alternates: { canonical: "/hospital-ai-automation" },
  openGraph: {
    type: "article",
    title: "How AI Automation Transforms Hospitals | AIAutomix",
    description:
      "Healthcare is a $10 trillion industry still run on manual processes. See how AI automation closes the biggest gaps — with real data.",
    images: ["/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <HospitalAiAutomationView />
    </>
  );
}
