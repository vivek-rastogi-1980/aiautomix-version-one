import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getGtmProjects } from "@/features/marketing/data";
import { getGtmAccess } from "@/features/marketing/permissions";
import { MarketingAccessNotice } from "@/features/marketing/marketing-access-notice";
import {
  GTM_MOTION_LABELS,
  GTM_STAGES,
  GTM_STAGE_LABELS,
  isGtmMotion,
} from "@/features/marketing/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Marketing plans",
  description:
    "Evidence-backed go-to-market plans with deterministic channel scoring and acquisition economics.",
};

/**
 * `/marketing` — every go-to-market plan in the workspace.
 *
 * Progress is read from the persisted run: `current_stage` only moves when a
 * stage commits, so its index is the number of stages that genuinely finished.
 */
export default async function MarketingPage() {
  const access = await getGtmAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <Header workspaceName={access.workspace.name} canCreate={false} />
        <MarketingAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const projects = await getGtmProjects(access.workspace.id);

  return (
    <div className="flex flex-col gap-8">
      <Header
        workspaceName={access.workspace.name}
        canCreate={access.canCreate}
      />

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <Megaphone className="size-7" />
          </span>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            No go-to-market plans yet
          </p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Who to target, why they buy, what to say, where to reach them, what
            it should cost and what to do first. Every statement is labelled
            fact, evidence, inference or assumption, and every number is
            calculated rather than written.
          </p>
          {access.canCreate ? (
            <Link
              href="/marketing/new"
              className={cn(buttonVariants({ size: "md" }), "mt-6")}
            >
              <Megaphone className="size-4" /> Build a GTM plan
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
          Marketing plans
        </h1>
        <p className="text-muted">
          Go-to-market plans in {workspaceName}. AI proposes; the rubric ranks
          and the engine calculates.
        </p>
      </div>
      {canCreate ? (
        <Link
          href="/marketing/new"
          className={cn(buttonVariants({ size: "md" }))}
        >
          <Megaphone className="size-4" /> New plan
        </Link>
      ) : null}
    </div>
  );
}

function cardStatus(
  status: string,
  runStatus: string | null,
  completed: number,
): {
  label: string;
  variant: "active" | "completed" | "archived" | "neutral" | "paused";
} {
  if (status === "completed") return { label: "Completed", variant: "active" };
  if (runStatus === "failed") return { label: "Failed", variant: "archived" };
  if (status === "cancelled")
    return { label: "Cancelled", variant: "archived" };
  if (runStatus === "running")
    return { label: "Running", variant: "completed" };
  if (completed > 0) return { label: "Incomplete", variant: "paused" };
  return { label: "Draft", variant: "neutral" };
}

function ProjectCard({
  project,
}: {
  project: Awaited<ReturnType<typeof getGtmProjects>>[number];
}) {
  const status = cardStatus(
    project.status,
    project.runStatus,
    project.completedCount,
  );
  const total = GTM_STAGES.length;
  const stageName = project.currentStage
    ? GTM_STAGE_LABELS[project.currentStage]
    : null;

  return (
    <Link
      href={`/marketing/${project.id}`}
      className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
    >
      <Card className="flex h-full items-start gap-5 p-5 transition-colors group-hover:border-white/20">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
          <Megaphone className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-bold tracking-tight text-foreground">
            {project.title}
          </h2>

          <p className="mt-1 text-xs text-muted">
            {/* Currency is always visible — a budget figure without one is a
                number a reader will misinterpret. */}
            <span className="font-semibold text-foreground">
              {project.currency}
            </span>
            {project.motion && isGtmMotion(project.motion)
              ? ` · ${GTM_MOTION_LABELS[project.motion]}`
              : ""}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-xs text-muted-strong">
              {project.completedCount} of {total} stages
              {stageName && status.label !== "Completed"
                ? ` · next: ${stageName}`
                : ""}
            </span>
          </div>

          <progress
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-gradient [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-fill-2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand-gradient"
            value={project.completedCount}
            max={total}
            aria-label={`${project.completedCount} of ${total} stages complete`}
          />

          <p className="mt-2 text-xs text-muted-strong">
            {project.primaryChannelCount > 0
              ? `${project.primaryChannelCount} primary channel${
                  project.primaryChannelCount === 1 ? "" : "s"
                } · `
              : ""}
            Created {formatDate(project.createdAt)}
          </p>
        </div>

        <ArrowRight className="mt-1 size-5 shrink-0 text-muted-strong transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Card>
    </Link>
  );
}
