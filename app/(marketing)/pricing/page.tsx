import type { Metadata } from "next";

import {
  PricingView,
  type EntitlementMatrix,
} from "@/features/commerce/pricing-view";
import { listPlans } from "@/features/commerce/subscriptions";
import { getPlanEntitlements } from "@/features/commerce/entitlements";
import type { PlanId } from "@/features/commerce/types";

const TITLE = "Pricing — AI Automation Plans | AIAutoMix";
const DESCRIPTION =
  "Simple plans for validating, planning and automating your business with AI. Start free, upgrade when the work does.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    url: "/pricing",
    siteName: "AIAutoMix",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/**
 * The plan catalog is read from the database at request time, so a price or
 * limit change is a SQL update rather than a deploy — which is what
 * PRICING-SPEC.md means by "prices and limits must be centrally configured".
 *
 * Public: `plans` and `plan_entitlements` carry an anon SELECT policy scoped to
 * `is_public`, so this renders without a session and leaks nothing else.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const plans = await listPlans();

  // Entitlements per plan, fetched in parallel rather than in a loop.
  const matrix: EntitlementMatrix = {};
  const results = await Promise.all(
    plans.map(async (plan) => ({
      id: plan.id,
      entitlements: await getPlanEntitlements(plan.id as PlanId),
    })),
  );
  for (const result of results) matrix[result.id] = result.entitlements;

  return <PricingView plans={plans} entitlements={matrix} />;
}
