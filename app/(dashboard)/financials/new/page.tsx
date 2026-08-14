import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FormAlert } from "@/components/ui/form-message";
import { isPlatformConfigured } from "@/features/ai";
import {
  getFinancialContextOptions,
  getPrefillFromIdea,
  getPrefillFromPlan,
  getRunEstimate,
  type FinancialPrefill,
} from "@/features/financials/data";
import { getFinancialAccess } from "@/features/financials/permissions";
import { FinancialAccessNotice } from "@/features/financials/financial-access-notice";
import { FinancialForm } from "@/features/financials/financial-form";

export const metadata: Metadata = {
  title: "New financial model",
  description: "Build a deterministic financial forecast from assumptions.",
};

/**
 * `/financials/new` — the brief.
 *
 * Opens blank, or pre-filled from `?ideaId=` / `?planId=`. The prefill is
 * resolved server-side against the caller's own workspace, so an id belonging
 * to another workspace produces a blank form rather than leaking a title.
 */
export default async function NewFinancialModelPage({
  searchParams,
}: {
  searchParams: Promise<{ ideaId?: string; planId?: string }>;
}) {
  const access = await getFinancialAccess();

  if (access.denialReason) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader />
        <FinancialAccessNotice reason={access.denialReason} />
      </div>
    );
  }

  const { ideaId, planId } = await searchParams;

  // A plan is the richer brief, so it wins when both are supplied.
  let prefill: FinancialPrefill | null = null;
  if (planId) {
    prefill = await getPrefillFromPlan(access.workspace.id, planId);
  } else if (ideaId) {
    prefill = await getPrefillFromIdea(access.workspace.id, ideaId);
  }

  const [estimate, context] = await Promise.all([
    getRunEstimate(),
    prefill
      ? Promise.resolve({ ideas: [], plans: [], research: [], competitors: [] })
      : getFinancialContextOptions(access.workspace.id),
  ]);

  const requestedPrefill = Boolean(ideaId || planId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader />

      {!isPlatformConfigured() ? (
        <FormAlert variant="error">
          The AI service is not configured, so the assumption stages cannot run
          yet. You can still create the model.
        </FormAlert>
      ) : null}

      {requestedPrefill && !prefill ? (
        <FormAlert variant="error">
          That business idea or plan could not be found in this workspace, so
          the form has been left blank.
        </FormAlert>
      ) : null}

      <FinancialForm
        prefill={prefill}
        estimatedCredits={estimate}
        ideas={context.ideas}
        plans={context.plans}
        research={context.research}
        competitors={context.competitors}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <Link
        href="/financials"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to financial models
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        New financial model
      </h1>
      <p className="text-muted">
        Describe the business. AIAutoMix proposes the assumptions, and a
        deterministic engine calculates the forecast — so every figure traces
        back to an input you can change.
      </p>
    </div>
  );
}
