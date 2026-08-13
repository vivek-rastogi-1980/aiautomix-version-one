import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FormAlert } from "@/components/ui/form-message";
import { isPlatformConfigured } from "@/features/ai";
import {
  getCompetitorContextOptions,
  getDepthOptions,
  getPrefillFromIdea,
  getPrefillFromPlan,
  type CompetitorPrefill,
} from "@/features/competitors/data";
import { getCompetitorAccess } from "@/features/competitors/permissions";
import { CompetitorAccessNotice } from "@/features/competitors/competitor-access-notice";
import { CompetitorForm } from "@/features/competitors/competitor-form";

export const metadata: Metadata = {
  title: "New competitor project",
  description:
    "Set up evidence-backed competitor research and choose its depth.",
};

/**
 * `/competitors/new` — the brief.
 *
 * Opens blank, or pre-filled from `?ideaId=` / `?planId=`. The prefill is
 * resolved on the server against the caller's own workspace, so an id for
 * another workspace's idea produces a blank form rather than leaking a title
 * into it.
 *
 * Nothing runs from this page. It creates a `draft` project; the first stage is
 * started from the project page, where the pipeline and its cost are visible.
 */
export default async function NewCompetitorProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ ideaId?: string; planId?: string }>;
}) {
  const access = await getCompetitorAccess();

  if (access.denialReason) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader />
        <CompetitorAccessNotice reason={access.denialReason} />
      </div>
    );
  }

  const { ideaId, planId } = await searchParams;

  // An idea takes precedence when both are given: it is the narrower brief, and
  // a link carrying both is a caller mistake rather than a request to merge.
  let prefill: CompetitorPrefill | null = null;
  if (ideaId) {
    prefill = await getPrefillFromIdea(access.workspace.id, ideaId);
  } else if (planId) {
    prefill = await getPrefillFromPlan(access.workspace.id, planId);
  }

  const [depths, context] = await Promise.all([
    getDepthOptions(),
    prefill
      ? Promise.resolve({ ideas: [], plans: [] })
      : getCompetitorContextOptions(access.workspace.id),
  ]);

  const requestedPrefill = Boolean(ideaId || planId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader />

      {!isPlatformConfigured() ? (
        <FormAlert variant="error">
          The AI service is not configured, so competitor research cannot run
          yet. You can still create the project.
        </FormAlert>
      ) : null}

      {requestedPrefill && !prefill ? (
        <FormAlert variant="error">
          That business idea or plan could not be found in this workspace, so
          the form has been left blank.
        </FormAlert>
      ) : null}

      <CompetitorForm
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
        href="/competitors"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to competitor projects
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        New competitor project
      </h1>
      <p className="text-muted">
        Describe what you&apos;re building. Seven stages then search, verify,
        profile and compare — one stage at a time, so you stay in control of
        what it costs.
      </p>
    </div>
  );
}
