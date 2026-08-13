import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Microscope } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getResearchList } from "@/features/research/data";
import { getResearchAccess } from "@/features/research/permissions";
import { ResearchAccessNotice } from "@/features/research/research-access-notice";
import {
  RESEARCH_STAGES,
  STAGE_LABELS,
  isResearchStage,
} from "@/features/research/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Market research",
  description:
    "Evidence-backed market research projects in your workspace.",
};

/**
 * `/research` — every research project in the workspace.
 *
 * Progress on each card is read from the persisted run: `current_stage` only
 * moves when a stage commits, so its index is the number of stages that
 * genuinely finished. Nothing here estimates, extrapolates or animates toward a
 * number the database has not confirmed.
 */
export default async function ResearchPage() {
  const access = await getResearchAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <Header workspaceName={access.workspace.name} canCreate={false} />
        <ResearchAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const projects = await getResearchList(access.workspace.id);

  return (
    <div className="flex flex-col gap-8">
      <Header
        workspaceName={access.workspace.name}
        canCreate={access.canCreate}
      />

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <Microscope className="size-7" />
          </span>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            No research projects yet
          </p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Market research runs in seven stages — planning, discovery,
            collection, evidence, analysis, synthesis and report. Every
            conclusion is tied to a source you can open.
          </p>
          {access.canCreate ? (
            <Link
              href="/research/new"
              className={cn(buttonVariants({ size: "md" }), "mt-6")}
            >
              <Microscope className="size-4" /> Start market research
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ResearchCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Header({
  workspaceName,
  canCreate,
}: {
  workspaceName: string;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Market research
        </h1>
        <p className="text-muted">
          Evidence-backed research in {workspaceName}. Every claim cites a
          source.
        </p>
      </div>
      {canCreate ? (
        <Link href="/research/new" className={cn(buttonVariants({ size: "md" }))}>
          <Microscope className="size-4" /> New research
        </Link>
      ) : null}
    </div>
  );
}

/** Derived from the persisted status, never from elapsed time or a guess. */
function cardStatus(
  status: string,
  runStatus: string | null,
  completedStages: number,
): { label: string; variant: "active" | "completed" | "archived" | "neutral" | "paused" } {
  if (status === "completed") return { label: "Completed", variant: "active" };
  if (status === "failed" || runStatus === "failed") {
    return { label: "Failed", variant: "archived" };
  }
  if (status === "cancelled") return { label: "Cancelled", variant: "archived" };
  if (runStatus === "running") return { label: "Running", variant: "completed" };
  if (completedStages > 0) return { label: "Incomplete", variant: "paused" };
  return { label: "Draft", variant: "neutral" };
}

function ResearchCard({
  project,
}: {
  project: Awaited<ReturnType<typeof getResearchList>>[number];
}) {
  const status = cardStatus(
    project.status,
    project.run_status,
    project.completedStages,
  );
  const total = RESEARCH_STAGES.length;
  const stageName = isResearchStage(project.current_stage)
    ? STAGE_LABELS[project.current_stage]
    : null;

  const facts = [project.industry, project.geography].filter(Boolean);

  return (
    <Link
      href={`/research/${project.id}`}
      className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
    >
      <Card className="flex h-full items-start gap-5 p-5 transition-colors group-hover:border-white/20">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
          <Microscope className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-bold tracking-tight text-foreground">
            {project.title}
          </h2>

          <p className="mt-1 text-xs text-muted">
            {facts.length ? `${facts.join(" · ")} · ` : ""}
            {project.depth} depth
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-xs text-muted-strong">
              {project.completedStages} of {total} stages
              {stageName && status.label !== "Completed"
                ? ` · next: ${stageName}`
                : ""}
            </span>
          </div>

          {/*
            The bar duplicates the sentence above rather than replacing it, so
            the progress is legible without colour or shape.
          */}
          <progress
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-gradient [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-fill-2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand-gradient"
            value={project.completedStages}
            max={total}
            aria-label={`${project.completedStages} of ${total} stages complete`}
          />

          <p className="mt-2 text-xs text-muted-strong">
            Created {formatDate(project.created_at)} · Updated{" "}
            {formatDate(project.updated_at)}
            {project.source_count
              ? ` · ${project.source_count} sources`
              : ""}
          </p>
        </div>

        <ArrowRight className="mt-1 size-5 shrink-0 text-muted-strong transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Card>
    </Link>
  );
}
