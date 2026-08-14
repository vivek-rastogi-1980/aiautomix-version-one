import { AlertTriangle, ExternalLink, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatBps,
  formatMoney,
  money,
  type CurrencyCode,
} from "@/features/financials/money";
import {
  ACTION_PRIORITY_LABELS,
  BUDGET_SCENARIO_LABELS,
  CAMPAIGN_OBJECTIVE_LABELS,
  CHANNEL_LABELS,
  CHANNEL_PRIORITY_LABELS,
  CLAIM_KIND_LABELS,
  CLAIM_KIND_MEANING,
  COST_BAND_LABELS,
  FUNNEL_BAND_LABELS,
  FUNNEL_STAGE_LABELS,
  GTM_MOTION_DESCRIPTIONS,
  GTM_MOTION_LABELS,
  KPI_LABELS,
  OWNER_ROLE_LABELS,
  PLAN_PERIODS,
  PLAN_PERIOD_LABELS,
  isChannel,
  isFunnelStageKey,
  isGtmMotion,
  isKpiKey,
  type ActionPriority,
  type ChannelPriority,
  type ClaimKind,
  type PlanPeriod,
} from "@/features/marketing/types";
import type {
  GtmCampaignRow,
  GtmChannelRow,
  GtmClaimRow,
  GtmFunnelStepRow,
  GtmPersonaRow,
  GtmPlanActionRow,
  GtmSourceRow,
} from "@/types/database";

/**
 * The read-only Marketing Intelligence views.
 *
 * Two presentation rules carry the phase's principle into the interface, and
 * both are load-bearing rather than decorative:
 *
 *   EVERY CLAIM SHOWS ITS KIND. Not as a colour — as a word, with a tooltip
 *   explaining what the word means. A reader must be able to tell "the research
 *   showed this" from "a model supposed this" at a glance, because the second
 *   is where the plan is weakest and it is the part that reads most fluently.
 *
 *   NO NUMBER APPEARS WITHOUT ITS BASIS. A channel score shows the rubric that
 *   produced it. A budget shows the scenario assumptions. A KPI figure is
 *   labelled a target. §30 forbids unsupported precision, and the way to obey
 *   that is to make the support visible rather than to round the number.
 *
 * This file formats. It does not compute — the one arithmetic operation here is
 * turning a stored basis-point value into a percentage for display, which is
 * presentation, not calculation.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function m(minor: number | null | undefined, currency: CurrencyCode): string {
  if (minor === null || minor === undefined) return "—";
  return formatMoney(money(minor, currency));
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strList(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item))
    .filter((item): item is string => item !== null)
    .slice(0, max);
}

function safeHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/** Claim objects stored inside persona jsonb columns. */
interface StoredClaim {
  statement: string;
  kind: ClaimKind;
  confidence?: string;
  rationale?: string | null;
  sourceUrl?: string | null;
}

function readClaims(value: unknown, max = 8): StoredClaim[] {
  if (!Array.isArray(value)) return [];

  const claims: StoredClaim[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const statement = str(record.statement);
    if (!statement) continue;

    const kind = str(record.kind);
    const confidence = str(record.confidence);
    claims.push({
      statement,
      kind: (kind && kind in CLAIM_KIND_LABELS
        ? kind
        : "ASSUMPTION") as ClaimKind,
      ...(confidence ? { confidence } : {}),
      rationale: str(record.rationale),
      sourceUrl: str(record.sourceUrl),
    });
    if (claims.length >= max) break;
  }
  return claims;
}

const CLAIM_BADGE: Record<
  ClaimKind,
  "brand" | "active" | "completed" | "paused" | "neutral" | "archived"
> = {
  FACT: "active",
  EVIDENCE: "completed",
  INFERENCE: "brand",
  ASSUMPTION: "paused",
  RECOMMENDATION: "neutral",
  TARGET: "archived",
};

/**
 * The label that makes the whole feature legible.
 *
 * `title` carries the meaning so a reader who does not know the vocabulary can
 * hover and learn it, rather than inferring that "inference" is a synonym for
 * "fact" written by someone being modest.
 */
export function ClaimKindBadge({ kind }: { kind: ClaimKind }) {
  return (
    <Badge variant={CLAIM_BADGE[kind]} title={CLAIM_KIND_MEANING[kind]}>
      {CLAIM_KIND_LABELS[kind]}
    </Badge>
  );
}

function ClaimList({ claims }: { claims: StoredClaim[] }) {
  if (claims.length === 0) {
    return <p className="text-sm text-muted">Nothing recorded.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {claims.map((claim, index) => {
        const href = safeHref(claim.sourceUrl ?? null);
        return (
          <li key={index} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-start gap-2">
              <ClaimKindBadge kind={claim.kind} />
              <span className="min-w-0 flex-1 text-sm text-foreground">
                {claim.statement}
              </span>
            </div>
            {claim.rationale ? (
              <p className="pl-1 text-xs text-muted">{claim.rationale}</p>
            ) : null}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex w-fit items-center gap-1 pl-1 text-xs text-accent hover:underline"
              >
                Source <ExternalLink className="size-3" />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SectionHeader({
  id,
  title,
  hint,
}: {
  id: string;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <h2
        id={id}
        className="font-display text-lg font-bold tracking-tight text-foreground"
      >
        {title}
      </h2>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card className="px-6 py-10 text-center">
      <p className="font-display text-base font-bold text-foreground">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-muted">{body}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard  (§28)
// ---------------------------------------------------------------------------

export interface GtmDashboardFigures {
  currency: CurrencyCode;
  motion: string | null;
  status: string;
  currentStageLabel: string;
  icpSummary: string | null;
  primaryChannels: string[];
  secondaryChannels: string[];
  positioningStatement: string | null;
  budgetMinor: number | null;
  allowableCacMinor: number | null;
  targetNewCustomers: number;
  targetHorizonMonths: number;
  planActionCount: number;
}

export function GtmDashboard({ figures }: { figures: GtmDashboardFigures }) {
  const {
    currency,
    motion,
    currentStageLabel,
    icpSummary,
    primaryChannels,
    secondaryChannels,
    positioningStatement,
    budgetMinor,
    allowableCacMinor,
    targetNewCustomers,
    targetHorizonMonths,
    planActionCount,
  } = figures;

  return (
    <section aria-labelledby="gtm-dashboard" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-dashboard"
        title="Go-to-market at a glance"
        hint={`Currently at: ${currentStageLabel}. Every figure below is in ${currency}.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Selling motion"
          value={
            motion && isGtmMotion(motion)
              ? GTM_MOTION_LABELS[motion]
              : "Not set"
          }
          sub={
            motion && isGtmMotion(motion)
              ? GTM_MOTION_DESCRIPTIONS[motion]
              : "Set by the planning stage."
          }
        />
        <Metric
          label="Customer target"
          value={`${targetNewCustomers}`}
          sub={`over ${targetHorizonMonths} months — a target, not a forecast`}
        />
        <Metric
          label="Allowable CAC"
          value={m(allowableCacMinor, currency)}
          sub="Calculated ceiling per customer"
        />
        <Metric
          label="Marketing budget"
          value={m(budgetMinor, currency)}
          sub="Target customers × allowable CAC"
        />
        <Metric
          label="Primary channels"
          value={
            primaryChannels.length > 0 ? primaryChannels.join(", ") : "None yet"
          }
          sub={
            secondaryChannels.length > 0
              ? `Secondary: ${secondaryChannels.join(", ")}`
              : undefined
          }
        />
        <Metric label="90-day actions" value={`${planActionCount}`} />
        <Metric label="Currency" value={currency} />
        <Metric
          label="Positioning"
          value={positioningStatement ? "Defined" : "Not yet"}
          sub={positioningStatement ?? undefined}
        />
      </div>

      {icpSummary ? (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Ideal customer profile
          </p>
          <p className="mt-1.5 text-sm text-foreground">{icpSummary}</p>
        </Card>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
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
// Personas  (§29)
// ---------------------------------------------------------------------------

export function PersonasPanel({ personas }: { personas: GtmPersonaRow[] }) {
  if (personas.length === 0) {
    return (
      <Empty
        title="No personas yet"
        body="The ICP stage produces them. Each attribute will show whether it came from evidence or from an assumption."
      />
    );
  }

  return (
    <section aria-labelledby="gtm-personas" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-personas"
        title="Buyer personas"
        hint="Every attribute is labelled with where it came from. Assumptions are not facts, and the label is how you tell."
      />

      <div className="flex flex-col gap-4">
        {personas.map((persona) => (
          <Card key={persona.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-foreground">
                  {persona.name}
                </h3>
                <p className="mt-0.5 text-sm text-muted">
                  {persona.role}
                  {persona.segment ? ` · ${persona.segment}` : ""}
                  {persona.geography ? ` · ${persona.geography}` : ""}
                </p>
              </div>
              <Badge variant={persona.is_decision_maker ? "active" : "neutral"}>
                {persona.is_decision_maker ? "Decision maker" : "Influencer"}
              </Badge>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PersonaBlock title="Pain points" value={persona.pain_points} />
              <PersonaBlock title="Goals" value={persona.goals} />
              <PersonaBlock
                title="Buying triggers"
                value={persona.buying_triggers}
              />
              <PersonaBlock title="Objections" value={persona.objections} />
              <PersonaBlock
                title="Decision criteria"
                value={persona.decision_criteria}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
                  Urgency & budget
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {persona.urgency ?? "Not established."}
                </p>
                {persona.budget_signals ? (
                  <p className="mt-1 text-sm text-muted">
                    {persona.budget_signals}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function PersonaBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        {title}
      </p>
      <div className="mt-2">
        <ClaimList claims={readClaims(value)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channels  (§30)
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<
  ChannelPriority,
  "brand" | "active" | "completed" | "paused" | "neutral" | "archived"
> = {
  PRIMARY: "active",
  SECONDARY: "completed",
  EXPERIMENTAL: "paused",
  NOT_RECOMMENDED: "archived",
};

interface RubricEntry {
  key: string;
  label: string;
  weightBps: number;
  inverted: boolean;
  meaning: string;
}

export function ChannelsPanel({
  channels,
  rubric,
}: {
  channels: GtmChannelRow[];
  rubric: RubricEntry[];
}) {
  if (channels.length === 0) {
    return (
      <Empty
        title="No channels assessed yet"
        body="The channel stage researches where this audience can be reached, then ranks the options against a published rubric."
      />
    );
  }

  return (
    <section aria-labelledby="gtm-channels" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-channels"
        title="Channel strategy"
        hint="Scores are AIAutoMix analysis, computed from ratings by the fixed weights below. Nothing here was written by a model as a percentage."
      />

      {rubric.length > 0 ? (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            The rubric
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {rubric.map((dimension) => (
              <li key={dimension.key} className="text-sm">
                <span className="font-semibold text-foreground">
                  {dimension.label}
                </span>
                <span className="text-muted">
                  {" "}
                  — {formatBps(dimension.weightBps, 0)} weight
                  {dimension.inverted ? " (inverted)" : ""}
                </span>
                <p className="text-xs text-muted">{dimension.meaning}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        {channels.map((channel) => {
          const key = channel.channel;
          const label = isChannel(key) ? CHANNEL_LABELS[key] : key;
          const priority = (
            channel.priority in PRIORITY_BADGE
              ? channel.priority
              : "NOT_RECOMMENDED"
          ) as ChannelPriority;
          const contributions = Array.isArray(channel.contributions)
            ? (channel.contributions as Record<string, unknown>[])
            : [];
          const evidenceHref = safeHref(channel.evidence_url);

          return (
            <Card key={channel.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold text-foreground">
                      {label}
                    </h3>
                    <Badge variant={PRIORITY_BADGE[priority]}>
                      {CHANNEL_PRIORITY_LABELS[priority]}
                    </Badge>
                    <Badge variant="neutral">
                      Score {formatBps(channel.score_bps, 0)}
                    </Badge>
                  </div>
                  {channel.rationale ? (
                    <p className="mt-1.5 text-sm text-muted">
                      {channel.rationale}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge variant="neutral">Effort {channel.effort}</Badge>
                  <Badge variant="neutral">
                    Cost{" "}
                    {channel.cost_band in COST_BAND_LABELS
                      ? COST_BAND_LABELS[
                          channel.cost_band as keyof typeof COST_BAND_LABELS
                        ]
                      : channel.cost_band}
                  </Badge>
                  <Badge variant="neutral">
                    Confidence {channel.confidence}
                  </Badge>
                </div>
              </div>

              {channel.priority_note ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-fill-2 px-3 py-2 text-xs text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {channel.priority_note}
                </p>
              ) : null}

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
                    Audience
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {channel.target_audience ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
                    How it acquires
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {channel.acquisition_mechanism ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
                    Prerequisites
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {strList(channel.prerequisites, 4).map((item, index) => (
                      <li key={index} className="text-sm text-foreground">
                        {item}
                      </li>
                    ))}
                    {strList(channel.prerequisites).length === 0 ? (
                      <li className="text-sm text-muted">None stated.</li>
                    ) : null}
                  </ul>
                </div>
              </div>

              {contributions.length > 0 ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-strong">
                    Show the working
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead className="text-muted-strong">
                        <tr>
                          <th className="py-1 pr-3 font-semibold">Dimension</th>
                          <th className="py-1 pr-3 font-semibold">Rating</th>
                          <th className="py-1 pr-3 font-semibold">Weight</th>
                          <th className="py-1 font-semibold">Contribution</th>
                        </tr>
                      </thead>
                      <tbody className="text-foreground">
                        {contributions.map((entry, index) => (
                          <tr key={index} className="border-t border-line">
                            <td className="py-1 pr-3">
                              {str(entry.label) ?? str(entry.key) ?? "—"}
                              {entry.inverted === true ? (
                                <span className="text-muted"> (inverted)</span>
                              ) : null}
                            </td>
                            <td className="py-1 pr-3">
                              {num(entry.rating) ?? "—"}/5
                            </td>
                            <td className="py-1 pr-3">
                              {formatBps(num(entry.weightBps), 0)}
                            </td>
                            <td className="py-1">
                              {formatBps(num(entry.contributionBps), 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}

              {evidenceHref ? (
                <a
                  href={evidenceHref}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Evidence source <ExternalLink className="size-3" />
                </a>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  No retrieved source backs this channel — the evidence rating
                  reflects that.
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export function FunnelPanel({
  steps,
  computed,
}: {
  steps: GtmFunnelStepRow[];
  computed: Record<string, unknown> | null;
}) {
  if (steps.length === 0) {
    return (
      <Empty
        title="No funnel yet"
        body="The sales funnel stage builds the funnel this business model actually has, then proposes conversion assumptions for each step."
      />
    );
  }

  const volumes = new Map<
    number,
    { requiredFrom: number; requiredTo: number }
  >();
  if (computed && Array.isArray(computed.funnel)) {
    (computed.funnel as Record<string, unknown>[]).forEach((entry, index) => {
      const from = num(entry.requiredFrom);
      const to = num(entry.requiredTo);
      if (from !== null && to !== null) {
        volumes.set(index, { requiredFrom: from, requiredTo: to });
      }
    });
  }

  return (
    <section aria-labelledby="gtm-funnel" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-funnel"
        title="Sales funnel"
        hint="Conversion rates are assumptions unless labelled otherwise. Volumes are what the target would require, not a prediction."
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted-strong">
            <tr>
              <th className="px-4 py-3 font-semibold">Step</th>
              <th className="px-4 py-3 font-semibold">Rate</th>
              <th className="px-4 py-3 font-semibold">Basis</th>
              <th className="px-4 py-3 font-semibold">Needed at this step</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => {
              const from = isFunnelStageKey(step.from_stage)
                ? FUNNEL_STAGE_LABELS[step.from_stage]
                : step.from_stage;
              const to = isFunnelStageKey(step.to_stage)
                ? FUNNEL_STAGE_LABELS[step.to_stage]
                : step.to_stage;
              const volume = volumes.get(index);

              return (
                <tr
                  key={step.id}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-4 py-3 text-foreground">
                    {from} → {to}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatBps(step.rate_bps, 2)}
                  </td>
                  <td className="px-4 py-3">
                    <ClaimKindBadge
                      kind={
                        (step.kind in CLAIM_KIND_LABELS
                          ? step.kind
                          : "ASSUMPTION") as ClaimKind
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {volume ? volume.requiredFrom.toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Acquisition economics & budget
// ---------------------------------------------------------------------------

export function AcquisitionPanel({
  economics,
  budget,
  currency,
}: {
  economics: Record<string, unknown> | null;
  budget: Record<string, unknown> | null;
  currency: CurrencyCode;
}) {
  if (!economics) {
    return (
      <Empty
        title="Acquisition economics not calculated yet"
        body="This stage runs a deterministic calculation over the funnel assumptions and the linked financial model. No AI is involved and it costs no credits."
      />
    );
  }

  const binding = str(economics.bindingConstraint);
  const scenarios = Array.isArray(budget?.scenarios)
    ? (budget.scenarios as Record<string, unknown>[])
    : [];
  const allocation = Array.isArray(budget?.allocation)
    ? (budget.allocation as Record<string, unknown>[])
    : [];
  const notes = strList(economics.notes, 6);

  return (
    <section aria-labelledby="gtm-acquisition" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-acquisition"
        title="Acquisition economics"
        hint="Calculated, not generated. Two independent ceilings on CAC are computed and the lower one binds."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Allowable CAC"
          value={m(num(economics.allowableCacMinor), currency)}
          sub={
            binding === "ltv_ratio"
              ? "Bound by the LTV:CAC target"
              : "Bound by the payback window"
          }
        />
        <Metric
          label="Payback ceiling"
          value={m(num(economics.paybackAllowableCacMinor), currency)}
          sub={`${num(economics.paybackMonths) ?? "—"} months of gross profit`}
        />
        <Metric
          label="LTV:CAC ceiling"
          value={m(num(economics.ltvAllowableCacMinor), currency)}
          sub={
            num(economics.targetLtvToCacBps) !== null
              ? `at ${(num(economics.targetLtvToCacBps)! / 10_000).toFixed(1)}x`
              : undefined
          }
        />
        <Metric
          label="Budget"
          value={m(num(economics.budgetMinor), currency)}
          sub="Target customers × allowable CAC"
        />
        <Metric
          label="Top of funnel needed"
          value={
            num(economics.requiredTopOfFunnel)?.toLocaleString() ??
            "Unreachable"
          }
        />
        <Metric
          label="One customer per"
          value={num(economics.oneCustomerPer)?.toLocaleString() ?? "—"}
          sub="at the top of the funnel"
        />
        <Metric
          label="Gross profit / customer / month"
          value={m(num(economics.grossProfitPerMonthMinor), currency)}
        />
        <Metric
          label="Lifetime value"
          value={m(num(economics.lifetimeValueMinor), currency)}
          sub={
            num(economics.lifetimeValueMinor) === null
              ? "Unbounded lifetime — not calculated"
              : undefined
          }
        />
      </div>

      {notes.length > 0 ? (
        <Card className="p-5">
          <ul className="flex flex-col gap-2">
            {notes.map((note, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted"
              >
                <Info className="mt-0.5 size-4 shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {scenarios.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionHeader
            id="gtm-budget"
            title="Budget scenarios"
            hint="Each scenario adjusts the assumptions and recalculates. None is base multiplied by a factor — the adjustments are printed so you can see what each label meant."
          />
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted-strong">
                <tr>
                  <th className="px-4 py-3 font-semibold">Scenario</th>
                  <th className="px-4 py-3 font-semibold">Adjustments</th>
                  <th className="px-4 py-3 font-semibold">Customer target</th>
                  <th className="px-4 py-3 font-semibold">Top of funnel</th>
                  <th className="px-4 py-3 font-semibold">Budget</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario, index) => {
                  const key = str(scenario.scenario);
                  const adjustments = (scenario.adjustments ?? {}) as Record<
                    string,
                    unknown
                  >;
                  const conversion = num(adjustments.conversionDeltaBps);
                  const target = num(adjustments.targetDeltaBps);

                  return (
                    <tr
                      key={index}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {key && key in BUDGET_SCENARIO_LABELS
                          ? BUDGET_SCENARIO_LABELS[
                              key as keyof typeof BUDGET_SCENARIO_LABELS
                            ]
                          : key}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        conversion{" "}
                        {conversion !== null ? formatBps(conversion, 0) : "—"}
                        {" · "}
                        target {target !== null ? formatBps(target, 0) : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {num(scenario.targetNewCustomers) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {num(scenario.requiredTopOfFunnel)?.toLocaleString() ??
                          "Unreachable"}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {m(num(scenario.budgetMinor), currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}

      {allocation.length > 0 ? (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Channel allocation
          </p>
          <p className="mt-1 text-xs text-muted">
            {str(budget?.allocationBasis) ??
              "Share of the deterministic channel score."}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {allocation.map((line, index) => {
              const key = str(line.channel);
              return (
                <li
                  key={index}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-foreground">
                    {key && isChannel(key) ? CHANNEL_LABELS[key] : key}
                  </span>
                  <span className="text-sm text-muted">
                    {formatBps(num(line.shareBps), 1)} ·{" "}
                    {m(num(line.amountMinor), currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export function CampaignsPanel({
  campaigns,
  content,
}: {
  campaigns: GtmCampaignRow[];
  content: Record<string, unknown> | null;
}) {
  const pillars = Array.isArray(content?.pillars)
    ? (content.pillars as Record<string, unknown>[])
    : [];

  if (campaigns.length === 0 && pillars.length === 0) {
    return (
      <Empty
        title="No content or campaigns yet"
        body="The content stage produces pillars and campaigns tied to the channels the rubric recommended."
      />
    );
  }

  return (
    <section aria-labelledby="gtm-campaigns" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-campaigns"
        title="Content & campaigns"
        hint="Campaigns state what will be done and how it will be measured. None of them promises a result."
      />

      {pillars.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {pillars.map((pillar, index) => (
            <Card key={index} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  {str(pillar.pillar) ?? "Pillar"}
                </h3>
                {str(pillar.funnelBand) ? (
                  <Badge variant="neutral">
                    {FUNNEL_BAND_LABELS[
                      str(pillar.funnelBand) as keyof typeof FUNNEL_BAND_LABELS
                    ] ?? str(pillar.funnelBand)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1.5 text-sm text-muted">
                {str(pillar.goal) ?? ""}
              </p>
              <dl className="mt-3 grid gap-1 text-xs">
                <Row label="Audience" value={str(pillar.audience)} />
                <Row label="Frequency" value={str(pillar.frequency)} />
                <Row label="Call to action" value={str(pillar.callToAction)} />
              </dl>
            </Card>
          ))}
        </div>
      ) : null}

      {campaigns.length > 0 ? (
        <div className="flex flex-col gap-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  {campaign.name}
                </h3>
                <Badge variant="brand">
                  {CAMPAIGN_OBJECTIVE_LABELS[
                    campaign.objective as keyof typeof CAMPAIGN_OBJECTIVE_LABELS
                  ] ?? campaign.objective}
                </Badge>
                <Badge variant="neutral">
                  {FUNNEL_BAND_LABELS[
                    campaign.funnel_band as keyof typeof FUNNEL_BAND_LABELS
                  ] ?? campaign.funnel_band}
                </Badge>
                {isKpiKey(campaign.measurement_kpi) ? (
                  <Badge variant="completed">
                    Measured by {KPI_LABELS[campaign.measurement_kpi]}
                  </Badge>
                ) : null}
              </div>
              <dl className="mt-3 grid gap-1 text-sm lg:grid-cols-2">
                <Row label="Audience" value={campaign.audience} />
                <Row label="Message" value={campaign.message} />
                <Row label="Offer" value={campaign.offer} />
                <Row label="Call to action" value={campaign.call_to_action} />
              </dl>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-strong">{label}:</dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 90-day plan  (§31)
// ---------------------------------------------------------------------------

const PRIORITY_TONE: Record<
  ActionPriority,
  "active" | "completed" | "neutral"
> = {
  P1: "active",
  P2: "completed",
  P3: "neutral",
};

export function PlanPanel({
  actions,
  firstActions,
}: {
  actions: GtmPlanActionRow[];
  firstActions: string[];
}) {
  if (actions.length === 0 && firstActions.length === 0) {
    return (
      <Empty
        title="No 90-day plan yet"
        body="The final stage sequences the work into three periods, with an owner and a KPI for every action."
      />
    );
  }

  return (
    <section aria-labelledby="gtm-plan" className="flex flex-col gap-5">
      <SectionHeader
        id="gtm-plan"
        title="90-day plan"
        hint="Ordered, owned and bounded. A hundred-task plan is a plan nobody finishes."
      />

      {firstActions.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-violet">
            Start here
          </p>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
            {firstActions.map((action, index) => (
              <li key={index} className="text-sm text-foreground">
                {action}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {PLAN_PERIODS.map((period) => {
        const inPeriod = actions.filter((action) => action.period === period);
        if (inPeriod.length === 0) return null;

        return (
          <div key={period} className="flex flex-col gap-3">
            <h3 className="font-display text-base font-bold text-foreground">
              {PLAN_PERIOD_LABELS[period as PlanPeriod]}
            </h3>

            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted-strong">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Objective</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Channel</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">KPI</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {inPeriod.map((action) => (
                    <tr
                      key={action.id}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-3 text-muted">
                        {action.objective}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {action.action}
                        {action.dependency ? (
                          <span className="block text-xs text-muted">
                            After: {action.dependency}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {action.channel && isChannel(action.channel)
                          ? CHANNEL_LABELS[action.channel]
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {OWNER_ROLE_LABELS[
                          action.owner_role as keyof typeof OWNER_ROLE_LABELS
                        ] ?? action.owner_role}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {isKpiKey(action.kpi)
                          ? KPI_LABELS[action.kpi]
                          : action.kpi}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            PRIORITY_TONE[action.priority as ActionPriority] ??
                            "neutral"
                          }
                        >
                          {ACTION_PRIORITY_LABELS[
                            action.priority as ActionPriority
                          ] ?? action.priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

export function PositioningPanel({
  positioning,
  messaging,
}: {
  positioning: Record<string, unknown> | null;
  messaging: Record<string, unknown> | null;
}) {
  if (!positioning) {
    return (
      <Empty
        title="No positioning yet"
        body="The positioning stage writes what this business claims, and checks each differentiator against competitor evidence before calling it unique."
      />
    );
  }

  const differentiators = Array.isArray(positioning.differentiators)
    ? (positioning.differentiators as Record<string, unknown>[])
    : [];
  const pillars = Array.isArray(positioning.messagingPillars)
    ? (positioning.messagingPillars as Record<string, unknown>[])
    : [];
  const notClaimed = strList(positioning.notClaimed, 8);
  const hero = (messaging?.websiteHero ?? {}) as Record<string, unknown>;

  return (
    <section aria-labelledby="gtm-positioning" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-positioning"
        title="Positioning & messaging"
        hint="A differentiator is only marked unique when competitors were actually checked."
      />

      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
          Positioning statement
        </p>
        <p className="mt-2 text-sm text-foreground">
          {str(positioning.positioningStatement) ?? "—"}
        </p>
        {str(positioning.valueProposition) ? (
          <p className="mt-3 text-sm text-muted">
            {str(positioning.valueProposition)}
          </p>
        ) : null}
      </Card>

      {differentiators.length > 0 ? (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Differentiators
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {differentiators.map((entry, index) => (
              <li key={index} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-start gap-2">
                  {entry.claimedUnique === true ? (
                    <Badge variant="active">Verified unique</Badge>
                  ) : (
                    <Badge variant="paused">Strength</Badge>
                  )}
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    {str(entry.statement)}
                  </span>
                </div>
                {str(entry.note) ? (
                  <p className="flex items-start gap-1.5 pl-1 text-xs text-muted">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    {str(entry.note)}
                  </p>
                ) : null}
                {strList(entry.competitorsChecked, 6).length > 0 ? (
                  <p className="pl-1 text-xs text-muted">
                    Checked against:{" "}
                    {strList(entry.competitorsChecked, 6).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {pillars.length > 0 ? (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Messaging pillars
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {pillars.map((pillar, index) => (
              <li key={index} className="text-sm">
                <span className="font-semibold text-foreground">
                  {str(pillar.pillar)}
                </span>
                <p className="text-muted">{str(pillar.explanation)}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {str(hero.headline) ? (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Website hero
          </p>
          <p className="mt-2 font-display text-lg font-bold text-foreground">
            {str(hero.headline)}
          </p>
          <p className="mt-1 text-sm text-muted">{str(hero.subheadline)}</p>
          {str(hero.callToAction) ? (
            <p className="mt-2 text-sm text-accent">
              CTA: {str(hero.callToAction)}
            </p>
          ) : null}
        </Card>
      ) : null}

      {notClaimed.length > 0 ? (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            Deliberately not claimed
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {notClaimed.map((item, index) => (
              <li key={index} className="text-sm text-muted">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Claims & sources
// ---------------------------------------------------------------------------

export function ClaimsPanel({ claims }: { claims: GtmClaimRow[] }) {
  if (claims.length === 0) return null;

  const counts = claims.reduce<Record<string, number>>((acc, claim) => {
    acc[claim.kind] = (acc[claim.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section aria-labelledby="gtm-claims" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-claims"
        title="Claims & assumptions"
        hint="Everything this plan asserts, with what kind of statement it is."
      />

      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([kind, count]) => (
          <Badge
            key={kind}
            variant={CLAIM_BADGE[kind as ClaimKind] ?? "neutral"}
            title={CLAIM_KIND_MEANING[kind as ClaimKind]}
          >
            {CLAIM_KIND_LABELS[kind as ClaimKind] ?? kind}: {count}
          </Badge>
        ))}
      </div>

      <Card className="divide-y divide-line p-0">
        {claims.slice(0, 60).map((claim) => {
          const href = safeHref(claim.source_url);
          return (
            <div key={claim.id} className="flex flex-col gap-1 px-5 py-3">
              <div className="flex flex-wrap items-start gap-2">
                <ClaimKindBadge
                  kind={
                    (claim.kind in CLAIM_KIND_LABELS
                      ? claim.kind
                      : "ASSUMPTION") as ClaimKind
                  }
                />
                <span className="min-w-0 flex-1 text-sm text-foreground">
                  {claim.statement}
                </span>
              </div>
              {claim.rationale ? (
                <p className="text-xs text-muted">{claim.rationale}</p>
              ) : null}
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex w-fit items-center gap-1 text-xs text-accent hover:underline"
                >
                  {claim.source_host ?? "Source"}{" "}
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          );
        })}
      </Card>
    </section>
  );
}

export function SourcesPanel({ sources }: { sources: GtmSourceRow[] }) {
  if (sources.length === 0) {
    return (
      <Empty
        title="No sources retrieved"
        body="Only the channel stage reaches the web. Everything else reasons over the records this workspace already holds."
      />
    );
  }

  return (
    <section aria-labelledby="gtm-sources" className="flex flex-col gap-4">
      <SectionHeader
        id="gtm-sources"
        title="Sources"
        hint="Retrieved by the research provider. A page the search did not return cannot appear here."
      />
      <Card className="divide-y divide-line p-0">
        {sources.map((source) => {
          const href = safeHref(source.canonical_url ?? source.url);
          return (
            <div key={source.id} className="px-5 py-3">
              <p className="text-sm text-foreground">
                {source.title ?? source.url}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                {source.publisher ? <span>{source.publisher}</span> : null}
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    Open <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

/** Shared by the detail page and the report so the two never diverge. */
export function sectionContent(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export const CLAIM_TONE = CLAIM_BADGE;
export const PANEL_CLASS = cn("flex flex-col gap-6");
