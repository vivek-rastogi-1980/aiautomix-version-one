import type { Metadata } from "next";
import { AiBusinessIdeaValidationView } from "@/features/solutions/ai-business-idea-validation/ai-business-idea-validation-view";

export const metadata: Metadata = {
  title: {
    absolute:
      "AI Business Idea Validation | Validate Your Startup with AI | AIAutomix",
  },
  description:
    "Validate your business idea with AI-powered market research, competitor analysis, revenue forecasting, feasibility assessment, and strategic recommendations before investing time and money.",
  keywords:
    "AI Business Idea Validation, AI Business Validator, Business Idea Validation, Startup Idea Validation, Business Feasibility Analysis, Market Research AI, AI Market Analysis, AI Business Consultant, Validate Business Idea, AI Startup Planning, Business Opportunity Analysis",
  alternates: { canonical: "/ai-business-idea-validation" },
  openGraph: {
    type: "website",
    title: "AI Business Idea Validation | Validate Your Startup with AI",
    description:
      "Validate your business idea with AI-powered market research, competitor analysis, revenue forecasting, and feasibility assessment before you invest.",
    images: ["/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <AiBusinessIdeaValidationView />
    </>
  );
}
