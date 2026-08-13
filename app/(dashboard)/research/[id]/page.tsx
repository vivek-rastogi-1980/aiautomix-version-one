import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Lightbulb, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getResearchDetail,
  getResearchEvidence,
  getResearchSources,
} from "@/features/research/data";
import { getResearchAccess } from "@/features/research/permissions";
import { buildRunProgress, statusLabel } from "@/features/research/progress";
import { ResearchAccessNotice } from "@/features/research/research-access-notice";
import { ResearchEvidence } from "@/features/research/research-evidence";
import { ResearchResults } from "@/features/research/research-results";
import { ResearchSources } from "@/features/research/research-sources";
import { StagePipeline } from "@/features/research/stage-pipeline";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Market research",
  description: "Run, resume and read an evidence-backed research project.",
};

/**
 * `/research/[id]` — the research workspace.
 *
 * Every number, status and stage on this page comes from a row. The page is a
 * Server Component that reads the run, its stage attempts, its sections, its
 * sources and its evidence on each request, which is what makes resuming work:
 * close the tab mid-run, come back a week later, and the pipeline draws itself
 * from `current_stage` exactly where it stopped. There is no client-side
 * progress state to lose.
 *
 * A request from another workspace returns no row under RLS and becomes a 404
 * rather than a 403, so ids cannot be probed.
 */
export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getResearchAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink />
        <ResearchAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const detail = await getResearchDetail(access.workspace.id, id);
  if (!detail) notFound();

  const { request, run, attempts, results, sourceCount, evidenceCount } =
    detail;

  const progress = buildRunProgress({
    currentStage: run?.current_stage ?? null,
    runStatus: run?.status ?? null,
    requestStatus: request.status,
    attempts,
  });
  const status = statusLabel(progress, request.status);

  // Only fetched when there is something to show. A draft request would
  // otherwise issue two counting queries to render two empty states.
  const [sources, evidence] = await Promise.all([
    sourceCount > 0
      ? getResearchSources(id)
      : Promise.resolve({ rows: [], total: 0, page: 0, pageSize: 25 }),
    evidenceCount > 0
      ? getResearchEvidence(id)
      : Promise.resolve({ rows: [], total: 0, page: 0, pageSize: 25 }),
  ]);

  const questions = Array.isArray(request.questions)
    ? (request.questions as unknown[]).filter(
        (q): q is string => typeof q === "string",
      )
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {request.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Created {formatDate(request.created_at)} · Updated{" "}
              {formatDate(request.updated_at)}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {/* Provenance — a reference back, never a copy of the source record. */}
        {detail.idea || detail.plan ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Research based on:</span>
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

      <Brief
        request={request}
        questions={questions}
        sourceCount={sourceCount}
        evidenceCount={evidenceCount}
        creditsCharged={run?.credits_charged ?? 0}
        creditsRefunded={run?.credits_refunded ?? 0}
      />

      <StagePipeline
        requestId={request.id}
        progress={progress}
        canRun={access.canCreate}
      />

      {/*
        The report link appears only when the report stage has a succeeded
        attempt row. Offering it earlier would send the user to a page that can
        only tell them to come back.
      */}
      {progress.stages.find((s) => s.stage === "report")?.status ===
      "complete" ? (
        <ReportReadyCard researchId={request.id} />
      ) : null}

      <ResearchResults results={results} />

      <ResearchEvidence page={evidence} />

      <ResearchSources page={sources} />
    </div>
  );
}

function ReportReadyCard({ researchId }: { researchId: string }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 border-brand-violet/30 bg-brand-violet/5 p-6 sm:p-7">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Market research report
        </h2>
        <p className="mt-1 text-sm text-muted">
          All fifteen sections, with every finding labelled and traced to the
          source it came from. Exportable as a branded PDF.
        </p>
      </div>
      <Link
        href={`/research/${researchId}/report`}
        className={cn(buttonVariants({ size: "md" }))}
      >
        <FileText className="size-4" /> Open report
      </Link>
    </Card>
  );
}

function BackLink() {
  return (
    <Link
      href="/research"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to research
    </Link>
  );
}

function Brief({
  request,
  questions,
  sourceCount,
  evidenceCount,
  creditsCharged,
  creditsRefunded,
}: {
  request: NonNullable<
    Awaited<ReturnType<typeof getResearchDetail>>
  >["request"];
  questions: string[];
  sourceCount: number;
  evidenceCount: number;
  creditsCharged: number;
  creditsRefunded: number;
}) {
  const facts: { term: string; value: string }[] = [
    { term: "Industry", value: request.industry || "Not specified" },
    { term: "Geography", value: request.geography || "Not specified" },
    {
      term: "Target customer",
      value: request.target_customer || "Not specified",
    },
    {
      term: "Business model",
      value: request.business_model || "Not specified",
    },
    { term: "Depth", value: request.depth },
    {
      term: "Credits used",
      value:
        creditsRefunded > 0
          ? `${creditsCharged} (${creditsRefunded} refunded)`
          : String(creditsCharged),
    },
    { term: "Sources", value: String(sourceCount) },
    { term: "Evidence", value: String(evidenceCount) },
  ];

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        Brief
      </h2>

      {request.scope ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
          {request.scope}
        </p>
      ) : null}

      {/* A definition list rather than a table: it reflows to one column on a
          phone without any horizontal scrolling. */}
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.term}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
              {fact.term}
            </dt>
            <dd className="mt-1 break-words text-sm text-foreground">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {questions.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Research questions
          </h3>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
            {questions.map((question, index) => (
              <li key={index} className="text-sm leading-relaxed text-muted">
                {question}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Card>
  );
}
