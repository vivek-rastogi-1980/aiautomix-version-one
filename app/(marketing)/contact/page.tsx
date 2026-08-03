import type { Metadata } from "next";
import { ContactView } from "@/features/contact/contact-view";

export const metadata: Metadata = {
  title: { absolute: "Contact Us | AIAutomix" },
  description:
    "Get in touch with AIAutomix — questions about AI business validation, strategy, automation, or any of our solutions. We usually respond within 24 hours.",
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return (
    <>
      <ContactView />
    </>
  );
}
