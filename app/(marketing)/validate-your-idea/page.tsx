import type { Metadata } from "next";
import { ValidateYourIdeaView } from "@/features/solutions/validate-your-idea/validate-your-idea-view";

export const metadata: Metadata = {
  title: { absolute: "Validate Your Business Idea Free | AIAutomix" },
  description:
    "Get a free, citation-backed validation score for your business idea in minutes. Five specialist AI agents analyze market size, competition, feasibility, revenue, and deliver one honest verdict.",
  keywords:
    "validate business idea, startup idea validation, AI market research, business plan validator, idea feasibility",
  alternates: { canonical: "/validate-your-idea" },
  openGraph: {
    type: "website",
    title: "Validate Your Business Idea Free | AIAutomix",
    description:
      "Five AI agents. One honest verdict. Validate your business idea free in minutes.",
    images: ["/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <ValidateYourIdeaView />
    </>
  );
}
