import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FormAlert } from "@/components/ui/form-message";
import { isPlatformConfigured } from "@/features/ai";
import {
  getDepthOptions,
  getPrefillFromIdea,
  getPrefillFromPlan,
  getResearchContextOptions,
  type ResearchPrefill,
} from "@/features/research/data";
import { getResearchAccess } from "@/features/research/permissions";
import { ResearchAccessNotice } from "@/features/research/research-access-notice";
import { ResearchForm } from "@/features/research/research-form";

export const metadata: Metadata = {
  title: "New market research",
  description:
    "Set up an evidence-backed market research project and choose its depth.",
};

/**
 * `/research/new` — the brief.
 *
 * Opens blank, or pre-filled from `?ideaId=` / `?planId=`. The prefill is
 * resolved on the server against the caller's own workspace, so an id for
 * another workspace's idea simply produces a blank form rather than leaking a
 * title into it.
 *
 * Nothing runs from this page. It creates a `draft` request; the first stage is
 * started from the research page, where the pipeline and its cost are visible.
 */
export default async function NewResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ ideaId?: string; planId?: string }>;
}) {
  const access = await getResearchAccess();

  if (access.denialReason) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader />
        <ResearchAccessNotice reason={access.denialReason} />
      </div>
    );
  }

  const { ideaId, planId } = await searchParams;

  // An idea takes precedence when both are given: it is the narrower brief, and
  // a link carrying both is a caller mistake rather than a request to merge.
  let prefill: ResearchPrefill | null = null;
  if (ideaId) {
    prefill = await getPrefillFromIdea(access.workspace.id, ideaId);
  } else if (planId) {
    prefill = await getPrefillFromPlan(access.workspace.id, planId);
  }

  const [depths, context] = await Promise.all([
    getDepthOptions(),
    prefill
      ? Promise.resolve({ ideas: [], plans: [] })
      : getResearchContextOptions(access.workspace.id),
  ]);

  const requestedPrefill = Boolean(ideaId || planId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader />

      {!isPlatformConfigured() ? (
        <FormAlert variant="error">
          The AI service is not configured, so research cannot run yet. You can
          still create the project.
        </FormAlert>
      ) : null}

      {requestedPrefill && !prefill ? (
        <FormAlert variant="error">
          That business idea or plan could not be found in this workspace, so
          the form has been left blank.
        </FormAlert>
      ) : null}

      <ResearchForm
        depths={depths}
        prefill={prefill}
        ideas={context.ideas}
        plans={context.plans}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <Link
        href="/research"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to research
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        New market research
      </h1>
      <p className="text-muted">
        Describe what you need to understand. Seven stages then search, cite and
        analyse — one stage at a time, so you stay in control of what it costs.
      </p>
    </div>
  );
}
