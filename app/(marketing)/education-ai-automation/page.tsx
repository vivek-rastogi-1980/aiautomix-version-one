import type { Metadata } from "next";
import { EducationAiAutomationView } from "@/features/industries/education-ai-automation/education-ai-automation-view";

export const metadata: Metadata = {
  title: { absolute: "How AI Automation Transforms Education | AIAutomix" },
  description:
    "Education is a $1 trillion industry still run on manual processes. See the five biggest gaps AI automation closes — personalized tutoring, instant grading, dropout prediction, admissions, and 24/7 support — plus fundable SaaS ideas to build now.",
  keywords:
    "AI in education, education automation, AI tutoring, automated grading, edtech AI, dropout prediction, admissions chatbot, education SaaS ideas",
  alternates: { canonical: "/education-ai-automation" },
  openGraph: {
    type: "article",
    title: "How AI Automation Transforms Education | AIAutomix",
    description:
      "Education is a $1 trillion industry still run on manual processes. See how AI automation closes the five biggest gaps — and the SaaS ideas worth building.",
    images: ["https://staging.aiautomix.com/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <EducationAiAutomationView />
    </>
  );
}
