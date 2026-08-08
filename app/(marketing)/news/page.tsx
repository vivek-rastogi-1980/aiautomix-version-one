import type { Metadata } from "next";

import { NewsIndexView } from "@/features/news/news-index-view";

export const metadata: Metadata = {
  title: { absolute: "News | AIAutomix" },
  description:
    "Product releases, engineering notes and perspective on where AI automation is actually useful — from the AIAutomix team.",
  alternates: { canonical: "/news" },
  openGraph: {
    type: "website",
    title: "News | AIAutomix",
    description:
      "Product releases, engineering notes and perspective on where AI automation is actually useful.",
    images: ["/assets/logo-ice2.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  return <NewsIndexView />;
}
