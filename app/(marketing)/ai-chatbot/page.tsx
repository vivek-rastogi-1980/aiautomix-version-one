import type { Metadata } from "next";
import { AiChatbotView } from "@/features/solutions/ai-chatbot/ai-chatbot-view";

export const metadata: Metadata = {
  title: { absolute: "AI Chatbot for Instant Customer Support | AIAutomix" },
  description:
    "Answer 70% of support tickets instantly with an AI chatbot trained on your own docs. Free trial, no card required. Embed on your site, Slack, WhatsApp, or Zendesk in minutes.",
  keywords:
    "AI chatbot, customer support automation, AI support agent, help desk chatbot, conversational AI",
  alternates: { canonical: "/ai-chatbot" },
  openGraph: {
    type: "website",
    title: "AI Chatbot for Instant Customer Support | AIAutomix",
    description:
      "Answer 70% of support tickets instantly. Trained on your docs, live in minutes.",
    images: ["https://staging.aiautomix.com/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return (
    <>
      <AiChatbotView />
    </>
  );
}
