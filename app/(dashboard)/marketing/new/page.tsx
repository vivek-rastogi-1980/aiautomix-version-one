import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  getGtmContextOptions,
  getPrefillFromPlan,
  getRunEstimate,
  type GtmPrefill,
} from "@/features/marketing/data";
import { getGtmAccess } from "@/features/marketing/permissions";
import { MarketingAccessNotice } from "@/features/marketing/marketing-access-notice";
import { MarketingForm } from "@/features/marketing/marketing-form";

export const metadata: Metadata = { title: "New marketing plan" };

interface PageProps {
  searchParams: Promise<{ planId?: string; ideaId?: string }>;
}

/**
 * `/marketing/new` — the brief.
 *
 * Nothing is created by loading this page. A GET that writes a row is a link a
 * browser prefetch can fire by accident, and this one costs credits to run.
 */
export default async function NewMarketingPage({ searchParams }: PageProps) {
  const access = await getGtmAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <MarketingAccessNotice reason="not_entitled" />
      </div>
    );
  }

  if (!access.canCreate) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <MarketingAccessNotice reason="read_only" />
      </div>
    );
  }

  const { planId } = await searchParams;

  const [prefill, options, estimatedCredits] = await Promise.all([
    planId
      ? getPrefillFromPlan(access.workspace.id, planId)
      : Promise.resolve<GtmPrefill | null>(null),
    getGtmContextOptions(access.workspace.id),
    getRunEstimate(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          New go-to-market plan
        </h1>
        <p className="mt-1 max-w-prose text-muted">
          Eight stages: context, ICP and personas, positioning and messaging,
          channel research, content and campaigns, the sales funnel, acquisition
          economics, and a ninety-day plan. Only the channel stage reaches the
          web; acquisition economics is calculated and costs nothing.
        </p>
      </div>

      <MarketingForm
        prefill={prefill}
        estimatedCredits={estimatedCredits}
        options={options}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/marketing"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to marketing plans
    </Link>
  );
}
