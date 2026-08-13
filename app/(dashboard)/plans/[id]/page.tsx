import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-message";
import { DownloadPdfButton } from "@/features/ai/pdf/download-pdf-button";
import { SectionNav } from "@/features/ai/renderer/blocks/section-nav";
import { getBusinessPlan } from "@/features/business-plans/data";
import { getPlanSection } from "@/features/business-plans/sections";
import { SectionEditor } from "@/features/business-plans/section-editor";
import { StartResearchLink } from "@/features/research/start-research-link";
import { StartCompetitorsLink } from "@/features/competitors/start-competitors-link";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Business plan" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);
  const result = await getBusinessPlan(workspace.id, id);

  if (!result) notFound();

  const { plan, sections, history } = result;
  const editable = canEdit(role);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/plans"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to plans
      </Link>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-violet">
              Business Plan
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {plan.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Generated {formatDate(plan.created_at)} · model {plan.model} ·
              prompt {plan.prompt_version}
            </p>
            {!editable ? (
              <div className="mt-4">
                <Badge variant="neutral">Read-only</Badge>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StartResearchLink planId={plan.id} />
            <StartCompetitorsLink planId={plan.id} />
            {sections.length > 0 ? (
              <DownloadPdfButton
                href={`/api/business-plans/${plan.id}/pdf`}
                title={plan.title}
                suffix="aiautomix-business-plan"
              />
            ) : null}
          </div>
        </div>
      </Card>

      {plan.status === "failed" ? (
        <FormAlert variant="error">
          Generating this plan failed, so some sections may be missing. Start a
          new plan to try again.
        </FormAlert>
      ) : null}

      {sections.length === 0 ? (
        <FormAlert variant="error">This plan has no sections yet.</FormAlert>
      ) : (
        <>
          <SectionNav
            sections={sections.map((section) => ({
              id: section.section_key,
              label: section.title,
            }))}
          />

          {sections.map((section) => {
            const definition = getPlanSection(section.section_key);
            return (
              <SectionEditor
                key={section.id}
                section={section}
                history={history.get(section.id) ?? []}
                icon={definition?.icon}
                hint={definition?.hint}
                editable={editable}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
