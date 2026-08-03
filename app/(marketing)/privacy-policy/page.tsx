import type { Metadata } from "next";
import { PrivacyPolicyView } from "@/features/legal/privacy-policy/privacy-policy-view";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy | AIAutomix" },
  description:
    "AIAutomix privacy policy — how we collect, use, and protect your data.",
  alternates: { canonical: "/privacy-policy" },
};

export default function Page() {
  return (
    <>
      <PrivacyPolicyView />
    </>
  );
}
