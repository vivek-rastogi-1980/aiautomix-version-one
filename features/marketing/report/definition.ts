import "server-only";

import {
  AI_REPORT_DISCLAIMER,
  type ReportBlock,
  type ReportDocumentModel,
  type ReportIconName,
  type ReportSection as ReportModelSection,
  type SourceEntry,
} from "@/features/ai/renderer/types";
import { createClient } from "@/lib/supabase/server";
import {
  formatBps,
  formatMoney,
  isCurrencyCode,
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
  COST_BAND_LABELS,
  FUNNEL_STAGE_LABELS,
  GTM_MOTION_LABELS,
  GTM_SECTION_TITLES,
  KPI_LABELS,
  OWNER_ROLE_LABELS,
  PLAN_PERIODS,
  PLAN_PERIOD_LABELS,
  isChannel,
  isFunnelStageKey,
  isGtmMotion,
  isKpiKey,
  type ClaimKind,
  type GtmReportSection,
} from "@/features/marketing/types";
import { SCORING_MODEL } from "@/features/marketing/scoring";
import type {
  GtmCampaignRow,
  GtmChannelRow,
  GtmClaimRow,
  GtmFunnelStepRow,
  GtmPersonaRow,
  GtmPlanActionRow,
} from "@/types/database";

/**
 * The Marketing Intelligence report definition.
 *
 * Composes the sixteen sections from stored rows into the platform's
 * `ReportDocumentModel`, so the existing Report Engine renders it as HTML and
 * the existing PDF Engine renders it as A4. No new report engine, no new PDF
 * system, and no arithmetic — every figure here was calculated by
 * `calc/acquisition.ts` or scored by `scoring.ts` and persisted before this
 * file ran.
 *
 * ---------------------------------------------------------------------------
 * Mapping six claim kinds onto three
 * ---------------------------------------------------------------------------
 * The renderer's `ClaimKind` has three values; this feature distinguishes six.
 * Collapsing them would lose the distinction the whole phase is built on, so
 * the precise word is written into the finding's TEXT as a prefix and the
 * three-way kind is used only to pick the icon and colour:
 *
 *   FACT, EVIDENCE          → FACT           (something is behind it)
 *   INFERENCE, ASSUMPTION   → INFERENCE      (reasoning, not observation)
 *   RECOMMENDATION, TARGET  → RECOMMENDATION (a choice, not a finding)
 *
 * A reader of the PDF still sees "Assumption: …" and "Target: …" spelled out,
 * which is what matters.
 */

const SECTION_ICON: Record<GtmReportSection, ReportIconName> = {
  executive_summary: "clipboard",
  business_context: "clipboard",
  ideal_customer_profile: "users",
  buyer_personas: "users",
  positioning: "target",
  messaging: "lightbulb",
  channel_strategy: "route",
  content_strategy: "grid",
  campaign_strategy: "grid",
  sales_funnel: "trending",
  acquisition_economics: "gauge",
  marketing_budget: "coins",
  kpi_framework: "checklist",
  ninety_day_plan: "route",
  risks_assumptions: "shield",
  sources_limitations: "shield",
};

/** See the note above: the label survives in the text, the kind picks the icon. */
const RENDERER_KIND: Record<
  ClaimKind,
  "FACT" | "INFERENCE" | "RECOMMENDATION"
> = {
  FACT: "FACT",
  EVIDENCE: "FACT",
  INFERENCE: "INFERENCE",
  ASSUMPTION: "INFERENCE",
  RECOMMENDATION: "RECOMMENDATION",
  TARGET: "RECOMMENDATION",
};

function labelled(kind: ClaimKind, text: string): string {
  return `${CLAIM_KIND_LABELS[kind]}: ${text}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(value: unknown, max = 8000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function strList(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item, 2000))
    .filter((item): item is string => item !== null)
    .slice(0, max);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rows(value: unknown, max = 40): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .slice(0, max);
}

function safeUrl(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function claimKind(value: unknown): ClaimKind {
  return typeof value === "string" && value in CLAIM_KIND_LABELS
    ? (value as ClaimKind)
    : "ASSUMPTION";
}

export interface GtmReportStatus {
  ready: boolean;
  reason: string;
}

export interface ComposedGtmReport {
  model: ReportDocumentModel;
  version: number;
  generatedAt: string;
  currency: CurrencyCode;
}

/**
 * Build the report, or explain why it is not ready.
 *
 * `ready` requires a stored executive summary AND at least one ranked channel.
 * A go-to-market report with no channel strategy is a page of opinions about a
 * customer, and printing it under AIAutoMix branding as a GTM plan would
 * misrepresent what it is.
 */
export async function composeGtmReport(
  workspaceId: string,
  projectId: string,
): Promise<ComposedGtmReport | GtmReportStatus> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("gtm_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project) {
    return { ready: false, reason: "This marketing plan could not be found." };
  }

  const [
    results,
    personas,
    channels,
    funnelSteps,
    campaigns,
    actions,
    claims,
    sources,
  ] = await Promise.all([
    supabase
      .from("gtm_results")
      .select(
        "section_key, structured_content, confidence, status, version, updated_at",
      )
      .eq("project_id", projectId)
      .eq("is_current", true),
    supabase
      .from("gtm_personas")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order"),
    supabase
      .from("gtm_channels")
      .select("*")
      .eq("project_id", projectId)
      .order("score_bps", { ascending: false }),
    supabase
      .from("gtm_funnel_steps")
      .select("*")
      .eq("project_id", projectId)
      .order("step_order"),
    supabase
      .from("gtm_campaigns")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order"),
    supabase
      .from("gtm_plan_actions")
      .select("*")
      .eq("project_id", projectId)
      .order("period")
      .order("display_order"),
    supabase
      .from("gtm_claims")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at"),
    supabase
      .from("gtm_sources")
      .select("*")
      .eq("project_id", projectId)
      .order("retrieved_at", { ascending: false }),
  ]);

  const sections = new Map<string, Record<string, unknown>>();
  const statuses = new Map<string, string>();
  let version = 1;
  let generatedAt = new Date(0).toISOString();

  for (const row of results.data ?? []) {
    sections.set(
      row.section_key,
      (row.structured_content ?? {}) as Record<string, unknown>,
    );
    statuses.set(row.section_key, row.status);
    version = Math.max(version, row.version);
    if (row.updated_at > generatedAt) generatedAt = row.updated_at;
  }

  const summary = str(sections.get("executive_summary")?.summary);
  const channelRows = channels.data ?? [];

  if (!summary) {
    return {
      ready: false,
      reason:
        "The 90-day plan stage has not produced an executive summary yet. Run the remaining stages first.",
    };
  }
  if (channelRows.length === 0) {
    return {
      ready: false,
      reason:
        "No channels have been assessed. A go-to-market report without a channel strategy would misrepresent what it is.",
    };
  }

  const currency: CurrencyCode = isCurrencyCode(project.currency)
    ? project.currency
    : "USD";
  const fmt = (minor: number | null): string =>
    minor === null ? "—" : formatMoney(money(minor, currency));

  const built: ReportModelSection[] = [];

  const push = (
    key: GtmReportSection,
    blocks: ReportBlock[],
    layout?: "full" | "half",
  ) => {
    if (blocks.length === 0) return;
    built.push({
      id: key,
      title: GTM_SECTION_TITLES[key],
      icon: SECTION_ICON[key],
      blocks,
      ...(layout ? { layout } : {}),
    });
  };

  // --- 1. Executive summary ------------------------------------------------
  push("executive_summary", [{ kind: "paragraph", text: summary }]);

  // --- 2. Business context -------------------------------------------------
  const context = sections.get("business_context") ?? {};
  const motion = isGtmMotion(project.motion) ? project.motion : null;
  push("business_context", [
    ...(str(context.offering)
      ? [{ kind: "paragraph" as const, text: str(context.offering)! }]
      : []),
    {
      kind: "keyValues",
      entries: [
        { label: "Currency", value: currency },
        ...(motion
          ? [{ label: "Selling motion", value: GTM_MOTION_LABELS[motion] }]
          : []),
        ...(str(context.motionRationale)
          ? [{ label: "Why this motion", value: str(context.motionRationale)! }]
          : []),
        ...(str(context.targetGeography)
          ? [{ label: "Geography", value: str(context.targetGeography)! }]
          : []),
        ...(str(context.businessObjective)
          ? [{ label: "Objective", value: str(context.businessObjective)! }]
          : []),
        {
          label: "Customer target",
          value: `${project.target_new_customers} over ${project.target_horizon_months} months (a target, not a forecast)`,
        },
      ],
    },
    ...(strList(context.openQuestions, 8).length > 0
      ? [
          {
            kind: "callout" as const,
            tone: "caution" as const,
            title: "Open questions",
            text: strList(context.openQuestions, 8).join(" · "),
          },
        ]
      : []),
  ]);

  // --- 3. ICP --------------------------------------------------------------
  const icp = sections.get("ideal_customer_profile") ?? {};
  const qualifying = rows(icp.qualifyingSignals, 10);
  const disqualifying = rows(icp.disqualifyingSignals, 10);
  push("ideal_customer_profile", [
    ...(str(icp.summary)
      ? [{ kind: "paragraph" as const, text: str(icp.summary)! }]
      : []),
    {
      kind: "keyValues",
      entries: [
        ...(strList(icp.industries, 8).length
          ? [
              {
                label: "Industries",
                value: strList(icp.industries, 8).join(", "),
              },
            ]
          : []),
        ...(strList(icp.businessTypes, 8).length
          ? [
              {
                label: "Business types",
                value: strList(icp.businessTypes, 8).join(", "),
              },
            ]
          : []),
        ...(strList(icp.geographies, 8).length
          ? [
              {
                label: "Geographies",
                value: strList(icp.geographies, 8).join(", "),
              },
            ]
          : []),
        ...(str(icp.sizeBand)
          ? [{ label: "Size", value: str(icp.sizeBand)! }]
          : []),
      ],
    },
    ...(qualifying.length > 0
      ? [
          {
            kind: "findings" as const,
            entries: qualifying.map((entry) => ({
              text: labelled(
                claimKind(entry.kind),
                `Qualifies — ${str(entry.statement) ?? ""}`,
              ),
              kind: RENDERER_KIND[claimKind(entry.kind)],
            })),
          },
        ]
      : []),
    ...(disqualifying.length > 0
      ? [
          {
            kind: "findings" as const,
            entries: disqualifying.map((entry) => ({
              text: labelled(
                claimKind(entry.kind),
                `Disqualifies — ${str(entry.statement) ?? ""}`,
              ),
              kind: RENDERER_KIND[claimKind(entry.kind)],
            })),
          },
        ]
      : []),
  ]);

  // --- 4. Personas ---------------------------------------------------------
  push("buyer_personas", personaBlocks(personas.data ?? []));

  // --- 5 & 6. Positioning and messaging ------------------------------------
  const positioning = sections.get("positioning") ?? {};
  push("positioning", positioningBlocks(positioning));
  push("messaging", messagingBlocks(sections.get("messaging") ?? {}));

  // --- 7. Channels ---------------------------------------------------------
  push("channel_strategy", channelBlocks(channelRows));

  // --- 8 & 9. Content and campaigns ----------------------------------------
  push(
    "content_strategy",
    contentBlocks(sections.get("content_strategy") ?? {}),
  );
  push("campaign_strategy", campaignBlocks(campaigns.data ?? []));

  // --- 10. Funnel ----------------------------------------------------------
  const economics = sections.get("acquisition_economics") ?? {};
  push("sales_funnel", funnelBlocks(funnelSteps.data ?? [], economics));

  // --- 11 & 12. Acquisition economics and budget ---------------------------
  push("acquisition_economics", economicsBlocks(economics, fmt));
  push(
    "marketing_budget",
    budgetBlocks(sections.get("marketing_budget") ?? {}, fmt),
  );

  // --- 13. KPIs ------------------------------------------------------------
  push(
    "kpi_framework",
    kpiBlocks(
      sections.get("kpi_framework") ?? {},
      sections.get("ninety_day_plan") ?? {},
    ),
  );

  // --- 14. 90-day plan -----------------------------------------------------
  push(
    "ninety_day_plan",
    planBlocks(actions.data ?? [], sections.get("ninety_day_plan") ?? {}),
  );

  // --- 15. Risks and assumptions -------------------------------------------
  push(
    "risks_assumptions",
    riskBlocks(sections.get("risks_assumptions") ?? {}, claims.data ?? []),
  );

  // --- 16. Sources and limitations -----------------------------------------
  const sourceEntries: SourceEntry[] = (sources.data ?? []).map((source) => ({
    title: source.title ?? source.url,
    ...(source.publisher ? { publisher: source.publisher } : {}),
    ...(safeUrl(source.canonical_url ?? source.url)
      ? { url: safeUrl(source.canonical_url ?? source.url) }
      : {}),
    ...(source.published_at ? { publishedAt: source.published_at } : {}),
    retrievedAt: source.retrieved_at,
  }));

  const limitations = strList(
    (sections.get("risks_assumptions") ?? {}).limitations,
    10,
  );

  push("sources_limitations", [
    {
      kind: "callout",
      tone: "neutral",
      title: "How to read this report",
      text: "Statements are labelled Fact, Evidence, Inference, Assumption, Recommendation or Target. Only a Fact is backed by a retrieved source. Channel scores are AIAutoMix analysis computed from a published rubric, and every money figure was calculated, not written.",
    },
    ...(limitations.length > 0
      ? [{ kind: "bullets" as const, items: limitations }]
      : []),
    ...(sourceEntries.length > 0
      ? [{ kind: "sources" as const, entries: sourceEntries }]
      : [
          {
            kind: "callout" as const,
            tone: "caution" as const,
            title: "No external sources",
            text: "Only the channel stage reaches the web. If it surfaced nothing, every claim in this report is inference or assumption over the records this workspace already holds.",
          },
        ]),
  ]);

  return {
    model: {
      workflow: "gtm-plan",
      kicker: "Go-To-Market Plan",
      title: project.title,
      summary,
      sections: built,
      meta: {
        workflowLabel: "Marketing & Go-To-Market Intelligence",
        model: "multi-stage",
        promptVersion: "v1",
        generatedAt,
      },
      disclaimer: AI_REPORT_DISCLAIMER,
    },
    version,
    generatedAt,
    currency,
  };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function personaBlocks(personas: GtmPersonaRow[]): ReportBlock[] {
  if (personas.length === 0) return [];

  const blocks: ReportBlock[] = [];

  for (const persona of personas) {
    blocks.push({
      kind: "keyValues",
      entries: [
        { label: "Persona", value: persona.name },
        { label: "Role", value: persona.role },
        ...(persona.segment
          ? [{ label: "Segment", value: persona.segment }]
          : []),
        {
          label: "Decides?",
          value: persona.is_decision_maker
            ? "Signs the purchase"
            : "Influences, does not sign",
        },
      ],
    });

    const attributes: { label: string; value: unknown }[] = [
      { label: "Pain", value: persona.pain_points },
      { label: "Goal", value: persona.goals },
      { label: "Trigger", value: persona.buying_triggers },
      { label: "Objection", value: persona.objections },
      { label: "Criterion", value: persona.decision_criteria },
    ];

    const entries = attributes.flatMap(({ label, value }) =>
      rows(value, 8).map((entry) => ({
        text: labelled(
          claimKind(entry.kind),
          `${label} — ${str(entry.statement) ?? ""}`,
        ),
        kind: RENDERER_KIND[claimKind(entry.kind)],
      })),
    );

    if (entries.length > 0) blocks.push({ kind: "findings", entries });
  }

  return blocks;
}

function positioningBlocks(content: Record<string, unknown>): ReportBlock[] {
  const statement = str(content.positioningStatement);
  if (!statement) return [];

  const differentiators = rows(content.differentiators, 8);
  const pillars = rows(content.messagingPillars, 6);
  const notClaimed = strList(content.notClaimed, 8);

  return [
    { kind: "paragraph", text: statement },
    {
      kind: "keyValues",
      entries: [
        ...(str(content.valueProposition)
          ? [
              {
                label: "Value proposition",
                value: str(content.valueProposition)!,
              },
            ]
          : []),
        ...(str(content.primaryBenefit)
          ? [{ label: "Primary benefit", value: str(content.primaryBenefit)! }]
          : []),
        ...(str(content.elevatorPitch)
          ? [{ label: "Elevator pitch", value: str(content.elevatorPitch)! }]
          : []),
      ],
    },
    ...(differentiators.length > 0
      ? [
          {
            kind: "findings" as const,
            entries: differentiators.map((entry) => ({
              text:
                entry.claimedUnique === true
                  ? `Verified unique: ${str(entry.statement) ?? ""}`
                  : labelled(
                      claimKind(entry.kind),
                      `${str(entry.statement) ?? ""}${
                        str(entry.note) ? ` — ${str(entry.note)}` : ""
                      }`,
                    ),
              kind:
                entry.claimedUnique === true
                  ? ("FACT" as const)
                  : RENDERER_KIND[claimKind(entry.kind)],
            })),
          },
        ]
      : []),
    ...(pillars.length > 0
      ? [
          {
            kind: "ranked" as const,
            levelLabel: "Messaging pillars",
            entries: pillars.map((pillar) => ({
              title: str(pillar.pillar) ?? "Pillar",
              description: str(pillar.explanation) ?? "",
            })),
          },
        ]
      : []),
    ...(notClaimed.length > 0
      ? [
          {
            kind: "callout" as const,
            tone: "neutral" as const,
            title: "Deliberately not claimed",
            text: notClaimed.join(" · "),
          },
        ]
      : []),
  ];
}

function messagingBlocks(content: Record<string, unknown>): ReportBlock[] {
  const hero = (content.websiteHero ?? {}) as Record<string, unknown>;
  const email = (content.email ?? {}) as Record<string, unknown>;
  const outreach = (content.salesOutreach ?? {}) as Record<string, unknown>;

  const entries = [
    ...(str(hero.headline)
      ? [{ label: "Website headline", value: str(hero.headline)! }]
      : []),
    ...(str(hero.subheadline)
      ? [{ label: "Subheadline", value: str(hero.subheadline)! }]
      : []),
    ...(str(hero.callToAction)
      ? [{ label: "Call to action", value: str(hero.callToAction)! }]
      : []),
    ...(str(content.linkedin)
      ? [{ label: "LinkedIn", value: str(content.linkedin)! }]
      : []),
    ...(str(email.subject)
      ? [{ label: "Email subject", value: str(email.subject)! }]
      : []),
    ...(str(email.body)
      ? [{ label: "Email body", value: str(email.body)! }]
      : []),
    ...(str(outreach.opener)
      ? [{ label: "Outreach opener", value: str(outreach.opener)! }]
      : []),
    ...(str(outreach.followUp)
      ? [{ label: "Follow-up", value: str(outreach.followUp)! }]
      : []),
  ];

  return entries.length > 0 ? [{ kind: "keyValues", entries }] : [];
}

function channelBlocks(channels: GtmChannelRow[]): ReportBlock[] {
  if (channels.length === 0) return [];

  return [
    {
      kind: "callout",
      tone: "neutral",
      title: "How these scores were produced",
      text: `AIAutoMix analysis. Each channel was rated 0–5 on ${SCORING_MODEL.length} dimensions, then scored by fixed weights: ${SCORING_MODEL.map(
        (dimension) =>
          `${dimension.label} ${formatBps(dimension.weightBps, 0)}${
            dimension.inverted ? " (inverted)" : ""
          }`,
      ).join(
        ", ",
      )}. At most two channels can be primary, and a channel with no evidence behind it cannot be primary at all.`,
    },
    {
      kind: "ranked",
      levelLabel: "Priority",
      entries: channels.map((channel) => {
        const key = channel.channel;
        const label = isChannel(key) ? CHANNEL_LABELS[key] : key;
        const priority =
          channel.priority in CHANNEL_PRIORITY_LABELS
            ? CHANNEL_PRIORITY_LABELS[
                channel.priority as keyof typeof CHANNEL_PRIORITY_LABELS
              ]
            : channel.priority;
        const cost =
          channel.cost_band in COST_BAND_LABELS
            ? COST_BAND_LABELS[
                channel.cost_band as keyof typeof COST_BAND_LABELS
              ]
            : channel.cost_band;

        return {
          title: `${label} — ${priority} (${formatBps(channel.score_bps, 0)})`,
          description: [
            channel.rationale ?? "",
            `Effort ${channel.effort}. Cost ${cost}. Confidence ${channel.confidence}.`,
            channel.priority_note ?? "",
          ]
            .filter(Boolean)
            .join(" "),
          ...(channel.evidence_host
            ? {
                footnote: {
                  label: "Evidence",
                  value: channel.evidence_host,
                },
              }
            : {
                footnote: {
                  label: "Evidence",
                  value: "No retrieved source — rated on assumption",
                },
              }),
        };
      }),
    },
  ];
}

function contentBlocks(content: Record<string, unknown>): ReportBlock[] {
  const pillars = rows(content.pillars, 6);
  const plan = rows(content.initialContentPlan, 12);
  if (pillars.length === 0 && plan.length === 0) return [];

  return [
    ...(pillars.length > 0
      ? [
          {
            kind: "ranked" as const,
            levelLabel: "Content pillars",
            entries: pillars.map((pillar) => ({
              title: str(pillar.pillar) ?? "Pillar",
              description: [
                str(pillar.goal) ?? "",
                str(pillar.audience) ? `Audience: ${str(pillar.audience)}` : "",
                str(pillar.frequency)
                  ? `Cadence: ${str(pillar.frequency)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
            })),
          },
        ]
      : []),
    ...(plan.length > 0
      ? [
          {
            kind: "bullets" as const,
            items: plan.map((item) =>
              [
                str(item.title) ?? "",
                str(item.format) ? `(${str(item.format)})` : "",
                str(item.channel) ? `→ ${str(item.channel)}` : "",
              ]
                .filter(Boolean)
                .join(" "),
            ),
          },
        ]
      : []),
  ];
}

function campaignBlocks(campaigns: GtmCampaignRow[]): ReportBlock[] {
  if (campaigns.length === 0) return [];

  return [
    {
      kind: "ranked",
      levelLabel: "Campaigns",
      entries: campaigns.map((campaign) => ({
        title: `${campaign.name} — ${
          CAMPAIGN_OBJECTIVE_LABELS[
            campaign.objective as keyof typeof CAMPAIGN_OBJECTIVE_LABELS
          ] ?? campaign.objective
        }`,
        description: [
          campaign.audience ?? "",
          campaign.message ?? "",
          campaign.offer ? `Offer: ${campaign.offer}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        footnote: {
          label: "Measured by",
          value: isKpiKey(campaign.measurement_kpi)
            ? KPI_LABELS[campaign.measurement_kpi]
            : campaign.measurement_kpi,
        },
      })),
    },
  ];
}

function funnelBlocks(
  steps: GtmFunnelStepRow[],
  economics: Record<string, unknown>,
): ReportBlock[] {
  if (steps.length === 0) return [];

  const computed = rows(economics.funnel, 12);

  return [
    {
      kind: "findings",
      entries: steps.map((step, index) => {
        const from = isFunnelStageKey(step.from_stage)
          ? FUNNEL_STAGE_LABELS[step.from_stage]
          : step.from_stage;
        const to = isFunnelStageKey(step.to_stage)
          ? FUNNEL_STAGE_LABELS[step.to_stage]
          : step.to_stage;
        const volume = num(computed[index]?.requiredFrom);

        return {
          text: labelled(
            claimKind(step.kind),
            `${from} → ${to} at ${formatBps(step.rate_bps, 2)}${
              volume !== null
                ? `, which requires ${volume.toLocaleString()} at this step`
                : ""
            }`,
          ),
          kind: RENDERER_KIND[claimKind(step.kind)],
        };
      }),
    },
    {
      kind: "callout",
      tone: "caution",
      title: "These are conversion assumptions",
      text: "Every rate above is an assumption unless labelled otherwise, and the volumes derived from them are what the target would require — not a prediction of what will happen.",
    },
  ];
}

function economicsBlocks(
  content: Record<string, unknown>,
  fmt: (minor: number | null) => string,
): ReportBlock[] {
  const allowable = num(content.allowableCacMinor);
  if (allowable === null) return [];

  const binding = str(content.bindingConstraint);
  const notes = strList(content.notes, 6);

  return [
    {
      kind: "keyValues",
      entries: [
        { label: "Allowable CAC", value: fmt(allowable) },
        {
          label: "Payback ceiling",
          value: `${fmt(num(content.paybackAllowableCacMinor))} (${
            num(content.paybackMonths) ?? "—"
          } months of gross profit)`,
        },
        {
          label: "LTV:CAC ceiling",
          value: `${fmt(num(content.ltvAllowableCacMinor))}${
            num(content.targetLtvToCacBps) !== null
              ? ` at ${(num(content.targetLtvToCacBps)! / 10_000).toFixed(1)}x`
              : ""
          }`,
        },
        {
          label: "Binding constraint",
          value:
            binding === "ltv_ratio"
              ? "The LTV:CAC target — it is lower than the payback ceiling"
              : "The payback window — it is lower than the LTV:CAC ceiling",
        },
        {
          label: "Gross profit per customer per month",
          value: fmt(num(content.grossProfitPerMonthMinor)),
        },
        {
          label: "Lifetime value",
          value:
            num(content.lifetimeValueMinor) === null
              ? "Not calculated — the financial model reports no bounded lifetime"
              : fmt(num(content.lifetimeValueMinor)),
        },
        {
          label: "Top of funnel required",
          value:
            num(content.requiredTopOfFunnel)?.toLocaleString() ??
            "Unreachable at these rates",
        },
        {
          label: "One customer per",
          value:
            num(content.oneCustomerPer)?.toLocaleString() ??
            "— (no reachable path)",
        },
        { label: "Budget", value: fmt(num(content.budgetMinor)) },
      ],
    },
    ...(notes.length > 0 ? [{ kind: "bullets" as const, items: notes }] : []),
  ];
}

function budgetBlocks(
  content: Record<string, unknown>,
  fmt: (minor: number | null) => string,
): ReportBlock[] {
  const scenarios = rows(content.scenarios, 3);
  const allocation = rows(content.allocation, 13);
  if (scenarios.length === 0 && allocation.length === 0) return [];

  return [
    ...(scenarios.length > 0
      ? [
          {
            kind: "ranked" as const,
            levelLabel: "Scenario",
            entries: scenarios.map((scenario) => {
              const key = str(scenario.scenario) ?? "";
              const adjustments = (scenario.adjustments ?? {}) as Record<
                string,
                unknown
              >;
              return {
                title: `${
                  key in BUDGET_SCENARIO_LABELS
                    ? BUDGET_SCENARIO_LABELS[
                        key as keyof typeof BUDGET_SCENARIO_LABELS
                      ]
                    : key
                } — ${fmt(num(scenario.budgetMinor))}`,
                description: `Target ${
                  num(scenario.targetNewCustomers) ?? "—"
                } customers, requiring ${
                  num(scenario.requiredTopOfFunnel)?.toLocaleString() ??
                  "an unreachable volume"
                } at the top of the funnel.`,
                footnote: {
                  label: "Adjustments applied",
                  value: `conversion ${formatBps(
                    num(adjustments.conversionDeltaBps),
                    0,
                  )}, target ${formatBps(num(adjustments.targetDeltaBps), 0)}`,
                },
              };
            }),
          },
          {
            kind: "callout" as const,
            tone: "neutral" as const,
            title: "Scenarios are recalculated, not scaled",
            text: "Each scenario changes the assumptions above and re-runs the whole calculation. None of them is the base case multiplied by a percentage, which is why an optimistic case can need fewer impressions than the base case despite a higher target.",
          },
        ]
      : []),
    ...(allocation.length > 0
      ? [
          {
            kind: "keyValues" as const,
            entries: allocation.map((line) => {
              const key = str(line.channel) ?? "";
              return {
                label: isChannel(key) ? CHANNEL_LABELS[key] : key,
                value: `${formatBps(num(line.shareBps), 1)} · ${fmt(
                  num(line.amountMinor),
                )}`,
              };
            }),
          },
        ]
      : []),
  ];
}

function kpiBlocks(
  content: Record<string, unknown>,
  plan: Record<string, unknown>,
): ReportBlock[] {
  const kpis = strList(content.kpis, 12);
  const targets = rows(plan.kpiTargets, 12);
  if (kpis.length === 0 && targets.length === 0) return [];

  return [
    ...(kpis.length > 0
      ? [
          {
            kind: "bullets" as const,
            items: kpis.map((kpi) => (isKpiKey(kpi) ? KPI_LABELS[kpi] : kpi)),
          },
        ]
      : []),
    ...(str(content.note)
      ? [
          {
            kind: "callout" as const,
            tone: "neutral" as const,
            title: "Why these KPIs",
            text: str(content.note)!,
          },
        ]
      : []),
    ...(targets.length > 0
      ? [
          {
            kind: "findings" as const,
            entries: targets.map((entry) => {
              const kpi = str(entry.kpi) ?? "";
              return {
                text: labelled(
                  "TARGET",
                  `${isKpiKey(kpi) ? KPI_LABELS[kpi] : kpi} — ${
                    str(entry.target) ?? ""
                  }`,
                ),
                kind: "RECOMMENDATION" as const,
              };
            }),
          },
        ]
      : []),
  ];
}

function planBlocks(
  actions: GtmPlanActionRow[],
  content: Record<string, unknown>,
): ReportBlock[] {
  const firstActions = strList(content.firstActions, 10);
  if (actions.length === 0 && firstActions.length === 0) return [];

  const blocks: ReportBlock[] = [];

  if (firstActions.length > 0) {
    blocks.push({
      kind: "ranked",
      levelLabel: "Start here",
      entries: firstActions.map((action, index) => ({
        title: `${index + 1}. ${action}`,
        description: "",
      })),
    });
  }

  const timeline = PLAN_PERIODS.flatMap((period) =>
    actions
      .filter((action) => action.period === period)
      .map((action) => ({
        title: action.action,
        description: [
          action.objective,
          `Owner: ${
            OWNER_ROLE_LABELS[
              action.owner_role as keyof typeof OWNER_ROLE_LABELS
            ] ?? action.owner_role
          }`,
          `KPI: ${isKpiKey(action.kpi) ? KPI_LABELS[action.kpi] : action.kpi}`,
          `Priority: ${
            ACTION_PRIORITY_LABELS[
              action.priority as keyof typeof ACTION_PRIORITY_LABELS
            ] ?? action.priority
          }`,
          action.dependency ? `After: ${action.dependency}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        timeframe:
          PLAN_PERIOD_LABELS[period as keyof typeof PLAN_PERIOD_LABELS] ??
          period,
      })),
  );

  if (timeline.length > 0) blocks.push({ kind: "timeline", entries: timeline });

  return blocks;
}

function riskBlocks(
  content: Record<string, unknown>,
  claims: GtmClaimRow[],
): ReportBlock[] {
  const risks = rows(content.risks, 12);
  const assumptions = claims.filter((claim) => claim.kind === "ASSUMPTION");

  const blocks: ReportBlock[] = [];

  if (risks.length > 0) {
    blocks.push({
      kind: "ranked",
      levelLabel: "Risk",
      entries: risks.map((risk) => ({
        title: str(risk.summary) ?? "Risk",
        description: str(risk.mitigation) ?? "",
        ...(str(risk.assumptionRef)
          ? {
              footnote: {
                label: "Driven by",
                value: str(risk.assumptionRef)!,
              },
            }
          : {}),
      })),
    });
  }

  if (assumptions.length > 0) {
    blocks.push({
      kind: "findings",
      entries: assumptions.slice(0, 30).map((claim) => ({
        text: labelled("ASSUMPTION", claim.statement),
        kind: "INFERENCE" as const,
      })),
    });
    blocks.push({
      kind: "callout",
      tone: "caution",
      title: `${assumptions.length} assumptions underpin this plan`,
      text: "Each one is written down so it can be tested cheaply. Test the ones the budget depends on first.",
    });
  }

  return blocks;
}
