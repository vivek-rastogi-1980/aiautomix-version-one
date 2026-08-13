import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Lightbulb, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getCompetitorDetail,
  getCompetitorEvidence,
  getCompetitorSources,
} from "@/features/competitors/data";
import { getCompetitorAccess } from "@/features/competitors/permissions";
import {
  buildCompetitorProgress,
  competitorStatusLabel,
} from "@/features/competitors/progress";
import { CompetitorAccessNotice } from "@/features/competitors/competitor-access-notice";
import { CompetitorStagePipeline } from "@/features/competitors/stage-pipeline";
import { CompetitorList } from "@/features/competitors/competitor-list";
import { ComparisonMatrix } from "@/features/competitors/comparison-matrix";
import { LandscapeChart } from "@/features/competitors/landscape-chart";
import {
  CompetitorEvidence,
  CompetitorSources,
} from "@/features/competitors/competitor-evidence";
import { GAP_LABELS, GAP_QUALIFIER } from "@/features/competitors/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Competitor project",
  description: "Run, resume and read an evidence-backed competitor analysis.",
};

/**
 * `/competitors/[id]` — the competitor workspace.
 *
 * Every number, status and stage comes from a row. The page is a Server
 * Component that re-reads the run, its stage attempts, its competitors, its
 * sections, its sources and its evidence on each request, which is what makes
 * resuming work: close the tab mid-run, come back later, and the pipeline draws
 * itself from `current_stage` exactly where it stopped.
 *
 * A project from another workspace returns no row under RLS and becomes a 404
 * rather than a 403, so ids cannot be probed.
 */
export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getCompetitorAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink />
        <CompetitorAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const detail = await getCompetitorDetail(access.workspace.id, id);
  if (!detail) notFound();

  const {
    project,
    run,
    attempts,
    competitors,
    results,
    sourceCount,
    evidenceCount,
  } = detail;

  const progress = buildCompetitorProgress({
    currentStage: run?.current_stage ?? null,
    runStatus: run?.status ?? null,
    projectStatus: project.status,
    attempts,
  });
  const status = competitorStatusLabel(progress, project.status);

  // Only fetched when there is something to show.
  const [sources, evidence] = await Promise.all([
    sourceCount > 0
      ? getCompetitorSources(id)
      : Promise.resolve({ rows: [], total: 0, page: 0, pageSize: 25 }),
    evidenceCount > 0
      ? getCompetitorEvidence(id)
      : Promise.resolve({ rows: [], total: 0, page: 0, pageSize: 25 }),
  ]);

  const section = (key: string) =>
    results.find((row) => row.section_key === key)?.structured_content as
      Record<string, unknown> | undefined;

  const comparison = section("feature_comparison");
  const landscapeSection = section("competitor_landscape");
  const gapsSection = section("market_gaps");

  const reportReady =
    progress.stages.find((s) => s.stage === "recommendations")?.status ===
    "complete";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {project.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Created {formatDate(project.created_at)} · Updated{" "}
              {formatDate(project.updated_at)}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {detail.idea || detail.plan ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Competitors for:</span>
            {detail.idea ? (
              <Link
                href="/validator"
                className="inline-flex items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline"
              >
                <Lightbulb
                  className="size-4 text-brand-violet"
                  aria-hidden="true"
                />
                {detail.idea.title}
              </Link>
            ) : null}
            {detail.plan ? (
              <Link
                href={`/plans/${detail.plan.id}`}
                className="inline-flex items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline"
              >
                <NotebookPen
                  className="size-4 text-brand-violet"
                  aria-hidden="true"
                />
                {detail.plan.title}
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* --- Dashboard counters ------------------------------------------ */}
      <Card className="p-6 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Overview
        </h2>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Competitors" value={competitors.length} />
          <Stat label="Verified" value={detail.presentableCount} />
          <Stat label="Direct" value={detail.byType.DIRECT} />
          <Stat label="Indirect" value={detail.byType.INDIRECT} />
          <Stat label="Emerging" value={detail.byType.EMERGING} />
          <Stat label="Sources" value={sourceCount} />
        </dl>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Category" value={project.category} />
          <Fact label="Geography" value={project.geography} />
          <Fact label="Target customer" value={project.target_customer} />
          <Fact label="Depth" value={project.depth} />
        </dl>

        {project.description ? (
          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted">
            {project.description}
          </p>
        ) : null}
      </Card>

      <CompetitorStagePipeline
        projectId={project.id}
        progress={progress}
        canRun={access.canCreate}
      />

      {reportReady ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-brand-violet/30 bg-brand-violet/5 p-6 sm:p-7">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Competitor report
            </h2>
            <p className="mt-1 text-sm text-muted">
              All fifteen sections, with every claim labelled by what the
              competitor says, what the evidence shows, and what AIAutoMix
              infers. Exportable as a branded PDF.
            </p>
          </div>
          <Link
            href={`/competitors/${project.id}/report`}
            className={cn(buttonVariants({ size: "md" }))}
          >
            <FileText className="size-4" /> Open report
          </Link>
        </Card>
      ) : null}

      {/* --- Competitors -------------------------------------------------- */}
      <section
        aria-labelledby="competitors-heading"
        className="flex flex-col gap-4"
      >
        <div>
          <h2
            id="competitors-heading"
            className="font-display text-lg font-bold tracking-tight text-foreground"
          >
            Competitors
          </h2>
          <p className="text-sm text-muted">
            Verified companies first. Unverified names are kept and labelled
            rather than dropped — that a search surfaced them and could not
            confirm them is itself a finding.
          </p>
        </div>
        <CompetitorList competitors={competitors} />
      </section>

      {/* --- Comparison --------------------------------------------------- */}
      {comparison ? (
        <section
          aria-labelledby="comparison-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="comparison-heading"
            className="font-display text-lg font-bold tracking-tight text-foreground"
          >
            Feature comparison
          </h2>
          <ComparisonMatrix
            matrix={comparison.matrix}
            competitors={competitors}
            ownBusinessLabel="Your business"
          />
        </section>
      ) : null}

      {/* --- Landscape ---------------------------------------------------- */}
      {landscapeSection ? (
        <LandscapeChart
          landscape={landscapeSection.landscape}
          available={Boolean(landscapeSection.landscapeAvailable)}
          competitors={competitors}
        />
      ) : null}

      {/* --- Gaps --------------------------------------------------------- */}
      {gapsSection ? <MarketGaps gaps={gapsSection.gaps} /> : null}

      <CompetitorEvidence page={evidence} />

      <CompetitorSources page={sources} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/competitors"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to competitor projects
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-xl font-bold text-foreground">
        {value}
      </dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">
        {value || "Not specified"}
      </dd>
    </div>
  );
}

/**
 * Market gaps.
 *
 * Every one is prefixed "Potential opportunity" and shows the observation
 * behind it. The research examined a sample of the web, not the market, so a
 * gap is a possibility worth testing — never a guaranteed opening.
 */
function MarketGaps({ gaps }: { gaps: unknown }) {
  const rows = (Array.isArray(gaps) ? gaps : []) as {
    kind?: string;
    summary?: string;
    supportingEvidence?: string;
    confidence?: string;
  }[];

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="gaps-heading" className="flex flex-col gap-4">
      <div>
        <h2
          id="gaps-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Market gaps
        </h2>
        <p className="text-sm text-muted">
          Openings the evidence suggests. Each is a possibility to test, not a
          confirmed opening — absence of evidence that someone serves a segment
          is not evidence that nobody does.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((gap, index) => {
          const kind = (gap.kind ?? "feature") as keyof typeof GAP_LABELS;
          if (!gap.summary) return null;
          return (
            <li key={index}>
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="paused">{GAP_LABELS[kind] ?? "Gap"}</Badge>
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent-lime">
                    {GAP_QUALIFIER}
                  </span>
                  {gap.confidence ? (
                    <span className="text-xs text-muted-strong">
                      {gap.confidence} confidence
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                  {gap.summary}
                </p>
                {gap.supportingEvidence ? (
                  <p className="mt-2 border-l-2 border-line pl-3 text-sm text-muted">
                    {gap.supportingEvidence}
                  </p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
