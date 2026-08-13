import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/features/admin/guard";
import { getResearchRunDetail } from "@/features/admin/research-ops";
import { PageHeader, Stat, EmptyState } from "@/features/admin/ui";
import { STAGE_LABELS, STAGE_DESCRIPTIONS } from "@/features/research/types";
import { formatDateTime, formatDuration } from "@/lib/format";
import { redactSecrets } from "@/features/admin/redact";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Research run" };
export const dynamic = "force-dynamic";

/**
 * One research run, as an execution timeline.
 *
 * This page exists to answer one question: **which stage failed, and why.** So
 * all seven stages are listed whether or not they ran — a pipeline that stopped
 * at `discovery` must visibly stop there rather than simply ending — and every
 * attempt is shown with its own duration, credits and error.
 *
 * Read-only, deliberately. There are no re-run or skip controls: the stage
 * engine's authorization is built around a workspace member acting on their own
 * research, and adding an admin bypass would mean a second execution path with
 * different rules around charging and refunds. An operator who needs a stage
 * re-run asks the customer to press Continue.
 *
 * Error text is passed through `redactSecrets` before display. Provider errors
 * are the most likely place for a credential to surface in this panel.
 */
export default async function AdminResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("ai.read");
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const detail = await getResearchRunDetail(id);
  if (!detail) notFound();

  const { run, request, timeline, failedStage } = detail;

  // The owner's name is PII and gated separately: `ai.read` buys operational
  // visibility, not the customer directory. ANALYST holds the former and not
  // the latter, by design.
  const canSeeOwner = context.has("users.read");
  const canSeeCredits = context.has("credits.read");

  return (
    <>
      <Link
        href="/admin/research"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to research operations
      </Link>

      <PageHeader
        title={request.title}
        description={`Run ${run.id} · request ${request.id}`}
      />

      {failedStage ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-soft"
        >
          <strong className="font-semibold">
            Failed at {STAGE_LABELS[failedStage]}.
          </strong>{" "}
          The pointer did not advance, so the customer&apos;s next Continue
          retries this stage. Credits for failed attempts are refunded
          automatically.
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status" value={run.status} />
        <Stat label="Depth" value={run.depth} />
        <Stat label="Sources" value={run.source_count} />
        <Stat label="Evidence" value={run.evidence_count} />
        <Stat label="Tokens" value={run.total_tokens} />
        <Stat
          label="Estimated AI cost"
          value={`$${Number(run.estimated_cost_usd ?? 0).toFixed(6)}`}
          sub="Provider estimate"
        />
        <Stat
          label="Credits charged"
          value={canSeeCredits ? detail.totalCreditsCharged : null}
          unavailableNote="Requires credits.read"
        />
        <Stat
          label="Credits refunded"
          value={canSeeCredits ? detail.totalCreditsRefunded : null}
          unavailableNote="Requires credits.read"
        />
      </div>

      <Card className="mb-6 p-5">
        <h2 className="font-display text-base font-bold tracking-tight text-foreground">
          Context
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Detail
            label="Workspace"
            value={detail.workspaceName ?? run.workspace_id}
          />
          <Detail
            label="Owner"
            value={canSeeOwner ? (detail.ownerName ?? request.user_id) : null}
            unavailable="Requires users.read"
          />
          <Detail label="Industry" value={request.industry} />
          <Detail label="Geography" value={request.geography} />
          <Detail label="Created" value={formatDateTime(run.created_at)} />
          <Detail
            label="Started"
            value={run.started_at ? formatDateTime(run.started_at) : null}
            unavailable="Not started"
          />
          <Detail
            label="Completed"
            value={run.completed_at ? formatDateTime(run.completed_at) : null}
            unavailable="Not completed"
          />
          <Detail
            label="Current stage"
            value={
              run.current_stage
                ? (STAGE_LABELS[
                    run.current_stage as keyof typeof STAGE_LABELS
                  ] ?? run.current_stage)
                : null
            }
            unavailable="None — run finished"
          />
        </dl>
      </Card>

      <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-foreground">
        Execution timeline
      </h2>

      {timeline.every((entry) => entry.attempts.length === 0) ? (
        <EmptyState
          title="No stage has executed yet."
          hint="The run exists but the first stage has not been claimed."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {timeline.map((entry, index) => (
            <li key={entry.stage}>
              <Card
                className={cn(
                  "p-4",
                  entry.outcome === "failed" ? "border-danger/40" : null,
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
                      <span className="text-muted-strong">{index + 1}.</span>{" "}
                      {STAGE_LABELS[entry.stage]}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {STAGE_DESCRIPTIONS[entry.stage]}
                    </p>
                  </div>
                  <Badge
                    variant={
                      entry.outcome === "succeeded"
                        ? "active"
                        : entry.outcome === "failed"
                          ? "archived"
                          : entry.outcome === "running"
                            ? "completed"
                            : "neutral"
                    }
                  >
                    {entry.outcome}
                  </Badge>
                </div>

                {entry.attempts.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-strong">
                    Never executed.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {entry.attempts.map((attempt) => (
                      <li
                        key={attempt.attempt}
                        className="rounded-lg border border-line bg-fill-1 px-3 py-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
                          <span className="font-semibold text-foreground">
                            Attempt {attempt.attempt}
                          </span>
                          <span>{attempt.status}</span>
                          <span>{formatDuration(attempt.durationMs)}</span>
                          {canSeeCredits ? (
                            <span>
                              {attempt.creditsCharged} credits
                              {attempt.creditsRefunded > 0
                                ? ` · ${attempt.creditsRefunded} refunded`
                                : ""}
                            </span>
                          ) : null}
                          {attempt.totalTokens ? (
                            <span>
                              {attempt.totalTokens.toLocaleString("en-US")}{" "}
                              tokens
                            </span>
                          ) : null}
                          <span>{formatDateTime(attempt.startedAt)}</span>
                          {attempt.completedAt ? (
                            <span>→ {formatDateTime(attempt.completedAt)}</span>
                          ) : null}
                        </div>

                        {attempt.errorMessage ? (
                          <p className="mt-1.5 text-danger-soft">
                            <span className="font-semibold">
                              {attempt.errorCode ?? "ERROR"}:
                            </span>{" "}
                            {redactSecrets(attempt.errorMessage)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Detail({
  label,
  value,
  unavailable,
}: {
  label: string;
  value: string | null;
  unavailable?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-strong">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-sm",
          value ? "text-foreground" : "text-muted-strong",
        )}
      >
        {value ?? unavailable ?? "—"}
      </dd>
    </div>
  );
}
