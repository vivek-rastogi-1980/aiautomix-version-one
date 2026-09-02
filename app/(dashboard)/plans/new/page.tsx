import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-message";
import { isPlatformConfigured } from "@/features/ai";
import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";
import { PlanForm } from "@/features/business-plans/plan-form";
import { getPlansForValidationReport } from "@/features/business-plans/data";
import { validationReportToBusinessPlanInput } from "@/features/business-plans/from-validation";
import { getBusinessIdeas, getReport } from "@/features/reports/data";
import { getProjects } from "@/features/projects/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import type { BusinessPlanInput } from "@/lib/validations/business-plan";

export const metadata: Metadata = {
  title: "New business plan",
  description: "Generate an eleven-section business plan from a short brief.",
};

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ validation_report_id?: string }>;
}) {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);
  const { validation_report_id: requestedReportId } = await searchParams;

  const [projects, ideas] = await Promise.all([
    getProjects(user.id),
    getBusinessIdeas(user.id),
  ]);

  // -------------------------------------------------------------------------
  // Optional prefill from a validation report.
  //
  // The id arrives in the query string, so it is a request, not a fact.
  // `getReport` filters on `user_id` and runs under RLS, which is what turns it
  // into one: another customer's report — or another workspace's — resolves to
  // null and the page simply renders the ordinary empty form. There is
  // deliberately no "you are not allowed to see this" branch, because
  // confirming that an id exists is itself a disclosure.
  // -------------------------------------------------------------------------
  let initial: Partial<BusinessPlanInput> | undefined;
  let sourceTitle: string | null = null;
  let sourceScore: number | null = null;
  let validationReportId: string | undefined;
  let existingPlanId: string | undefined;
  let unreadableReport = false;

  if (requestedReportId) {
    const source = await getReport(user.id, requestedReportId);

    if (source) {
      // A stored report written by an older prompt version may no longer match
      // today's schema. Re-parsing rather than trusting means the page degrades
      // to an empty form instead of crashing.
      const parsed = businessValidatorReportSchema.safeParse(
        source.report.report_json,
      );

      if (parsed.success) {
        validationReportId = source.report.id;
        sourceTitle = source.idea?.title ?? null;
        sourceScore = source.report.score;

        const prefill = validationReportToBusinessPlanInput({
          report: parsed.data,
          ideaPayload: source.idea?.payload_json ?? null,
          businessIdeaId: source.report.business_idea_id,
          ideaTitle: source.idea?.title ?? null,
        });
        initial = prefill.values;

        // Duplicate awareness, not duplicate prevention. The customer is told a
        // plan already exists and given a link to it, but the form stays
        // available: re-planning a validated idea after revising the brief is a
        // legitimate thing to want, and it consumes allowance like any other
        // plan.
        const existing = await getPlansForValidationReport(
          workspace.id,
          source.report.id,
        );
        existingPlanId = existing[0]?.id;
      } else {
        unreadableReport = true;
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={
            validationReportId ? `/reports/${validationReportId}` : "/plans"
          }
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />{" "}
          {validationReportId ? "Back to validation report" : "Back to plans"}
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          New business plan
        </h1>
        <p className="text-muted">
          One brief in, a full plan out — then edit any section and keep its
          history.
        </p>
      </div>

      {!canEdit(role) ? (
        <FormAlert variant="error">
          Your role in this workspace is read-only, so you cannot generate
          plans.
        </FormAlert>
      ) : (
        <>
          {!isPlatformConfigured() ? (
            <FormAlert variant="error">
              The AI service is not configured. Add <code>OPENAI_API_KEY</code>{" "}
              to your environment to generate a plan.
            </FormAlert>
          ) : null}

          {unreadableReport ? (
            <FormAlert variant="error">
              That validation report was saved in a format this version of the
              app can no longer read, so the brief below has not been
              pre-filled. You can still write it yourself.
            </FormAlert>
          ) : null}

          {initial ? (
            <Card className="flex flex-col gap-2 border-brand-violet/40 p-5 sm:p-6">
              <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold tracking-tight text-foreground">
                <Sparkles className="size-4 shrink-0 text-accent" />
                Based on your validated idea
                {sourceTitle ? (
                  <span className="text-muted">· {sourceTitle}</span>
                ) : null}
                {sourceScore !== null ? (
                  <span className="text-muted">· {sourceScore}/100</span>
                ) : null}
              </p>
              <p className="text-sm text-muted">
                We have pre-filled this brief from your validation report,
                including its findings. Edit anything below before you generate
                — nothing here is fixed. Funding goal and team are left for you
                to fill in.
              </p>
              {existingPlanId ? (
                <p className="text-sm text-muted">
                  You have already created{" "}
                  <Link
                    href={`/plans/${existingPlanId}`}
                    className="font-medium text-accent underline underline-offset-2"
                  >
                    a business plan
                  </Link>{" "}
                  from this report. Generating another will use one more plan
                  from your monthly allowance.
                </p>
              ) : null}
            </Card>
          ) : null}

          <PlanForm
            projects={projects}
            ideas={ideas}
            initial={initial}
            validationReportId={validationReportId}
          />
        </>
      )}
    </div>
  );
}
