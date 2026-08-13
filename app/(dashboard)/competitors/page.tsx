import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompetitorProjects } from "@/features/competitors/data";
import { getCompetitorAccess } from "@/features/competitors/permissions";
import { CompetitorAccessNotice } from "@/features/competitors/competitor-access-notice";
import {
  COMPETITOR_STAGES,
  COMPETITOR_STAGE_LABELS,
  isCompetitorStage,
} from "@/features/competitors/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Competitor intelligence",
  description: "Evidence-backed competitor research for your workspace.",
};

/**
 * `/competitors` — every competitor project in the workspace.
 *
 * Progress on each card is read from the persisted run: `current_stage` only
 * moves when a stage commits, so its index is the number of stages that
 * genuinely finished. Nothing here estimates or animates toward a number the
 * database has not confirmed.
 */
export default async function CompetitorsPage() {
  const access = await getCompetitorAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <Header workspaceName={access.workspace.name} canCreate={false} />
        <CompetitorAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const projects = await getCompetitorProjects(access.workspace.id);

  return (
    <div className="flex flex-col gap-8">
      <Header
        workspaceName={access.workspace.name}
        canCreate={access.canCreate}
      />

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <Swords className="size-7" />
          </span>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            No competitor projects yet
          </p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Seven stages find real competitors from live web sources, verify
            each one exists, and separate what a company claims about itself
            from what the evidence actually shows.
          </p>
          {access.canCreate ? (
            <Link
              href="/competitors/new"
              className={cn(buttonVariants({ size: "md" }), "mt-6")}
            >
              <Swords className="size-4" /> Start competitor research
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
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
          Competitor intelligence
        </h1>
        <p className="text-muted">
          Real competitors in {workspaceName}, traced to the sources that found
          them.
        </p>
      </div>
      {canCreate ? (
        <Link
          href="/competitors/new"
          className={cn(buttonVariants({ size: "md" }))}
        >
          <Swords className="size-4" /> New project
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
): {
  label: string;
  variant: "active" | "completed" | "archived" | "neutral" | "paused";
} {
  if (status === "completed") return { label: "Completed", variant: "active" };
  if (status === "failed" || runStatus === "failed") {
    return { label: "Failed", variant: "archived" };
  }
  if (status === "cancelled")
    return { label: "Cancelled", variant: "archived" };
  if (runStatus === "running")
    return { label: "Running", variant: "completed" };
  if (completedStages > 0) return { label: "Incomplete", variant: "paused" };
  return { label: "Draft", variant: "neutral" };
}

function ProjectCard({
  project,
}: {
  project: Awaited<ReturnType<typeof getCompetitorProjects>>[number];
}) {
  const status = cardStatus(
    project.status,
    project.runStatus,
    project.completedStages,
  );
  const total = COMPETITOR_STAGES.length;
  const stageName = isCompetitorStage(project.currentStage)
    ? COMPETITOR_STAGE_LABELS[project.currentStage]
    : null;

  const facts = [project.category, project.geography].filter(Boolean);

  return (
    <Link
      href={`/competitors/${project.id}`}
      className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
    >
      <Card className="flex h-full items-start gap-5 p-5 transition-colors group-hover:border-white/20">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
          <Swords className="size-5" />
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

          {/* The bar duplicates the sentence above rather than replacing it, so
              progress is legible without colour or shape. */}
          <progress
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-gradient [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-fill-2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand-gradient"
            value={project.completedStages}
            max={total}
            aria-label={`${project.completedStages} of ${total} stages complete`}
          />

          <p className="mt-2 text-xs text-muted-strong">
            {project.competitorCount > 0
              ? `${project.competitorCount} competitors · ${project.verifiedCount} verified · `
              : ""}
            Updated {formatDate(project.updatedAt)}
          </p>
        </div>

        <ArrowRight className="mt-1 size-5 shrink-0 text-muted-strong transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Card>
    </Link>
  );
}
