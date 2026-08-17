import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Globe,
  Lock,
  PlugZap,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import {
  ACTION_STATE_LABELS,
  ACTION_STATE_MEANING,
  AUDIT_EVENT_LABELS,
  EFFORT_LABELS,
  ERROR_CODE_LABELS,
  PLAN_STATUS_LABELS,
  SIDE_EFFECT_LABELS,
  SIDE_EFFECT_MEANING,
  isRetryable,
  type ActionState,
  type AuditEvent,
  type EffortLevel,
  type ErrorCode,
  type PlanStatus,
  type SideEffect,
} from "@/features/execution/types";
import type { ExecutionActionView } from "@/features/execution/data";
import type { ExecutionAuditLogRow } from "@/types/database";

/**
 * The Business Execution views.
 *
 * ---------------------------------------------------------------------------
 * The rule this interface follows
 * ---------------------------------------------------------------------------
 * §25 forbids hiding important consequences, and the way to obey that is not a
 * warning banner — it is to make the consequence the most prominent thing on
 * the approval card, above the content and above the buttons. A person about to
 * approve a public post should read "this becomes visible to anyone" before
 * they read the post.
 *
 * So every approval-required action shows four things before its buttons:
 * WHAT will happen, WHERE it will happen, WHAT DATA is sent, and WHICH
 * INTEGRATION carries it out. All four come from the registry, so they cannot
 * drift from what the provider is actually handed.
 */

// ---------------------------------------------------------------------------
// State presentation
// ---------------------------------------------------------------------------

const STATE_META: Record<
  ActionState,
  {
    icon: typeof CheckCircle2;
    variant:
      "active" | "completed" | "paused" | "neutral" | "archived" | "brand";
    tone: string;
  }
> = {
  DRAFT: { icon: CircleDashed, variant: "neutral", tone: "text-muted-strong" },
  READY: { icon: CircleDashed, variant: "brand", tone: "text-brand-violet" },
  AWAITING_APPROVAL: {
    icon: ShieldAlert,
    variant: "paused",
    tone: "text-accent-lime",
  },
  APPROVED: { icon: CheckCircle2, variant: "completed", tone: "text-accent" },
  EXECUTING: { icon: Clock, variant: "completed", tone: "text-accent" },
  COMPLETED: {
    icon: CheckCircle2,
    variant: "active",
    tone: "text-brand-green",
  },
  FAILED: { icon: XCircle, variant: "archived", tone: "text-danger-soft" },
  CANCELLED: { icon: XCircle, variant: "archived", tone: "text-muted-strong" },
};

export function ActionStateBadge({ state }: { state: ActionState }) {
  const meta = STATE_META[state];
  return (
    <Badge variant={meta.variant} title={ACTION_STATE_MEANING[state]}>
      {ACTION_STATE_LABELS[state]}
    </Badge>
  );
}

const SIDE_EFFECT_ICON: Record<SideEffect, typeof Globe> = {
  INTERNAL_DRAFT: Lock,
  EXTERNAL_MUTATION: PlugZap,
  PUBLIC_VISIBLE: Globe,
};

export function SideEffectBadge({ sideEffect }: { sideEffect: SideEffect }) {
  const Icon = SIDE_EFFECT_ICON[sideEffect];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        sideEffect === "PUBLIC_VISIBLE"
          ? "border-danger/30 bg-danger/10 text-danger-soft"
          : sideEffect === "EXTERNAL_MUTATION"
            ? "border-accent-lime/30 bg-accent-lime/10 text-accent-lime"
            : "border-white/10 bg-fill-2 text-muted",
      )}
      title={SIDE_EFFECT_MEANING[sideEffect]}
    >
      <Icon className="size-3" aria-hidden="true" />
      {SIDE_EFFECT_LABELS[sideEffect]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Plan header
// ---------------------------------------------------------------------------

export function PlanSummary({
  status,
  totals,
}: {
  status: PlanStatus;
  totals: {
    total: number;
    completed: number;
    awaiting: number;
    failed: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Actions" value={String(totals.total)} />
      <Stat label="Completed" value={String(totals.completed)} />
      <Stat
        label="Awaiting approval"
        value={String(totals.awaiting)}
        emphasise={totals.awaiting > 0}
      />
      <Stat
        label="Plan status"
        value={PLAN_STATUS_LABELS[status]}
        sub={
          status === "PAUSED"
            ? "No action in this plan can run while it is paused."
            : undefined
        }
        emphasise={status === "PAUSED"}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasise,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasise?: boolean;
}) {
  return (
    <Card className={cn("p-4", emphasise ? "border-accent-lime/40" : null)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold tracking-tight text-foreground">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Execution preview (§26)
// ---------------------------------------------------------------------------

/**
 * What would be sent, rendered readably.
 *
 * The payload is shown in full rather than summarised. An approval screen that
 * hides half the data is asking someone to vouch for something they cannot see,
 * and a person who has been asked to do that twice stops reading the other half
 * too.
 */
export function ExecutionPreview({ view }: { view: ExecutionActionView }) {
  const destination = readDestination(view.row.input);

  return (
    <div className="rounded-xl border border-line bg-fill-1 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        Preview — what would happen
      </p>

      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <PreviewRow label="Action" value={view.displayName} />
        <PreviewRow
          label="Target"
          value={
            destination ?? "Inside AIAutoMix — nothing leaves this workspace"
          }
        />
        <PreviewRow label="Carried out by" value={view.requiredIntegration} />
        <PreviewRow label="Expected result" value={view.consequence} />
      </dl>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-strong">
          Data that would be sent
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-fill-2 p-3 text-xs text-foreground">
          {JSON.stringify(view.row.input, null, 2)}
        </pre>
      </details>

      {!view.providerConfigured ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-accent-lime/30 bg-accent-lime/10 px-3 py-2 text-xs text-accent-lime">
          <PlugZap className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {view.providerNote ??
            "That integration is not connected yet. This action can be approved, but running it will not reach anything."}
        </p>
      ) : null}
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="shrink-0 font-semibold text-muted-strong sm:w-40">
        {label}
      </dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  );
}

function readDestination(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;

  const destination = record.destination;
  if (destination && typeof destination === "object") {
    const label = (destination as Record<string, unknown>).label;
    if (typeof label === "string" && label.trim()) return label.trim();
  }

  const network = record.network;
  if (typeof network === "string") return network;

  return null;
}

// ---------------------------------------------------------------------------
// Attempt history (§16, §33)
// ---------------------------------------------------------------------------

export function RunHistory({ view }: { view: ExecutionActionView }) {
  if (view.runs.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        Attempts
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {view.runs.map((run) => (
          <li
            key={run.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-fill-2 px-3 py-2 text-xs"
          >
            <span className="font-semibold text-foreground">
              Attempt {run.attempt}
            </span>
            <Badge
              variant={
                run.status === "SUCCEEDED"
                  ? "active"
                  : run.status === "FAILED"
                    ? "archived"
                    : "completed"
              }
            >
              {run.status}
            </Badge>
            <span className="text-muted">{run.provider}</span>
            {run.duration_ms !== null ? (
              <span className="text-muted">
                {formatDuration(run.duration_ms)}
              </span>
            ) : null}
            {run.external_execution_id ? (
              <span className="text-muted-strong">
                id {run.external_execution_id}
              </span>
            ) : null}
            {run.result_summary ? (
              <span className="w-full text-muted">{run.result_summary}</span>
            ) : null}
            {run.error_message ? (
              <span className="w-full text-danger-soft">
                {run.error_code
                  ? `${ERROR_CODE_LABELS[run.error_code as ErrorCode] ?? run.error_code}: `
                  : ""}
                {run.error_message}
                {isRetryable(run.error_code)
                  ? " (retryable)"
                  : " (not retryable)"}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action card
// ---------------------------------------------------------------------------

export function ActionCard({
  view,
  children,
}: {
  view: ExecutionActionView;
  /** Controls injected by the page so this stays a server component. */
  children?: React.ReactNode;
}) {
  const meta = STATE_META[view.state];
  const Icon = meta.icon;
  const needsApproval = view.row.approval_required;
  const showPreview =
    view.state === "AWAITING_APPROVAL" ||
    view.state === "READY" ||
    view.state === "APPROVED";

  return (
    <Card
      className={cn(
        "p-5",
        view.state === "AWAITING_APPROVAL" ? "border-accent-lime/40" : null,
        view.state === "FAILED" ? "border-danger/30" : null,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-fill-2",
          )}
        >
          <Icon className={cn("size-4", meta.tone)} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold tracking-tight text-foreground">
              {view.row.title}
            </h3>
            <ActionStateBadge state={view.state} />
            <SideEffectBadge sideEffect={view.sideEffect as SideEffect} />
            {needsApproval ? (
              <Badge
                variant="neutral"
                title="A human must approve this before it can run."
              >
                Approval required
              </Badge>
            ) : (
              <Badge
                variant="neutral"
                title="Produces a draft that stays inside AIAutoMix."
              >
                No approval needed
              </Badge>
            )}
          </div>

          <p className="mt-1 text-sm text-muted">{view.displayName}</p>
          {view.row.description ? (
            <p className="mt-1 text-sm text-foreground">
              {view.row.description}
            </p>
          ) : null}

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-strong">
            <span>Integration: {view.requiredIntegration}</span>
            <span>Effort: {EFFORT_LABELS[view.effort as EffortLevel]}</span>
            <span>
              Attempts: {view.row.retry_count} of {view.attemptsAllowed}
            </span>
            {view.row.approved_at ? (
              <span className="text-brand-green">
                Approved {formatDateTime(view.row.approved_at)}
              </span>
            ) : null}
          </p>

          {/* THE consequence, above the content and above the buttons. §25. */}
          {needsApproval && showPreview ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-fill-2 px-3 py-2 text-sm text-foreground">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-accent-lime"
                aria-hidden="true"
              />
              {view.consequence}
            </p>
          ) : null}

          {showPreview ? (
            <div className="mt-3">
              <ExecutionPreview view={view} />
            </div>
          ) : null}

          {view.row.error ? (
            <p className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger-soft">
              {view.row.error_code
                ? `${ERROR_CODE_LABELS[view.row.error_code as ErrorCode] ?? view.row.error_code}: `
                : ""}
              {view.row.error}
            </p>
          ) : null}

          {view.row.revision_of ? (
            <p className="mt-2 text-xs text-muted-strong">
              This is a revision of an earlier completed action.
            </p>
          ) : null}

          <RunHistory view={view} />

          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Audit trail (§8)
// ---------------------------------------------------------------------------

export function AuditTrail({ entries }: { entries: ExecutionAuditLogRow[] }) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="execution-audit" className="flex flex-col gap-3">
      <div>
        <h2
          id="execution-audit"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Audit trail
        </h2>
        <p className="text-sm text-muted">
          Every decision, who made it and when. These records cannot be edited
          or deleted by anyone, including an administrator.
        </p>
      </div>

      <Card className="divide-y divide-line p-0">
        {entries.slice(0, 50).map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm"
          >
            <span className="font-semibold text-foreground">
              {AUDIT_EVENT_LABELS[entry.event as AuditEvent] ?? entry.event}
            </span>
            {entry.previous_state && entry.new_state ? (
              <span className="text-muted">
                {entry.previous_state} → {entry.new_state}
              </span>
            ) : null}
            <span className="text-muted-strong">as {entry.actor_role}</span>
            <span className="ml-auto text-xs text-muted-strong">
              {formatDateTime(entry.created_at)}
            </span>
            {entry.reason ? (
              <span className="w-full text-xs text-muted">{entry.reason}</span>
            ) : null}
          </div>
        ))}
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyActions() {
  return (
    <Card className="px-6 py-10 text-center">
      <p className="font-display text-base font-bold text-foreground">
        No actions in this plan yet
      </p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-muted">
        Add an action to turn part of your strategy into something executable.
        Anything that leaves AIAutoMix will need your approval before it runs.
      </p>
    </Card>
  );
}

/** Shared by the list page and the detail page so counts cannot disagree. */
export function planTotals(actions: ExecutionActionView[]): {
  total: number;
  completed: number;
  awaiting: number;
  failed: number;
} {
  return {
    total: actions.length,
    completed: actions.filter((view) => view.state === "COMPLETED").length,
    awaiting: actions.filter((view) => view.state === "AWAITING_APPROVAL")
      .length,
    failed: actions.filter((view) => view.state === "FAILED").length,
  };
}

export { formatDate };
