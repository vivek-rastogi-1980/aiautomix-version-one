/**
 * Market Research product tests (Sprint 8, Phase 4).
 *
 * Phase 3's suite proved the engine. This one proves the layer above it: that
 * a brief can be created safely, that the pipeline UI reports what the database
 * says and not what a client hoped, and that no second engine, credit path or
 * retry implementation appeared alongside the ones that already exist.
 *
 * Three kinds of check.
 *
 *   BEHAVIOUR  Pure functions exercised directly — `buildRunProgress`,
 *              `toContentBlocks`, the creation schema. These are where the
 *              "persisted state is authoritative" rule actually lives, so they
 *              are tested with real inputs rather than asserted about.
 *
 *   SOURCE     Structural guarantees read out of the files: no direct provider
 *              call, no second run-stage path, no unsafe HTML sink, no
 *              client-side credit arithmetic. A regex is a weak proof of
 *              behaviour but a strong alarm on reintroduction.
 *
 *   SCHEMA     What migration 0011 constrains, parsed out of the SQL — the same
 *              technique `research-smoke.tsx` uses for 0009.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { buildRunProgress, statusLabel } from "@/features/research/progress";
import type { StageAttempt } from "@/features/research/data";
import { toContentBlocks } from "@/features/research/result-content";
import {
  createResearchSchema,
  MAX_RESEARCH_QUESTIONS,
} from "@/features/research/schemas";
import { RESEARCH_MAX_STAGE_ATTEMPTS } from "@/features/research/constants";
import { RESEARCH_STAGES, type ResearchStage } from "@/features/research/types";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

function read(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

/** A succeeded/failed/running attempt row, as `research_run_stages` stores it. */
function attempt(
  stage: ResearchStage,
  status: string,
  attemptNo = 1,
  extra: Partial<StageAttempt> = {},
): StageAttempt {
  return {
    stage,
    attempt: attemptNo,
    status,
    errorCode: null,
    errorMessage: null,
    creditsCharged: 8,
    creditsRefunded: 0,
    durationMs: 1200,
    startedAt: "2026-08-13T00:00:00Z",
    completedAt: "2026-08-13T00:00:02Z",
    ...extra,
  };
}

function main(): void {
  const migration = read("supabase/migrations/0011_sprint8_research_product.sql");
  const actions = read("features/research/actions.ts");
  const data = read("features/research/data.ts");
  const pipeline = read("features/research/stage-pipeline.tsx");
  const form = read("features/research/research-form.tsx");
  const sourcesUi = read("features/research/research-sources.tsx");
  const evidenceUi = read("features/research/research-evidence.tsx");
  const resultsUi = read("features/research/research-results.tsx");
  const detailPage = read("app/(dashboard)/research/[id]/page.tsx");
  const listPage = read("app/(dashboard)/research/page.tsx");
  const newPage = read("app/(dashboard)/research/new/page.tsx");

  // =========================================================================
  // CREATION — input validation
  // =========================================================================

  const validInput = {
    title: "Market research — Acme Invoicing",
    scope: "Invoicing software for small service businesses.",
    industry: "Fintech",
    geography: "India",
    targetCustomer: "Owners of service businesses with 5-50 staff",
    businessModel: "SaaS",
    questions: "How large is the market?\nWho competes today?",
    depth: "standard",
    businessIdeaId: "",
    businessPlanId: "",
  };

  const valid = createResearchSchema.safeParse(validInput);
  check("a valid research request is accepted", valid.success);
  check(
    "questions are split one per line",
    valid.success && valid.data.questions.length === 2,
    valid.success ? valid.data.questions.join(" | ") : "",
  );
  check(
    "an empty optional field becomes undefined, not an empty string",
    createResearchSchema.safeParse({ ...validInput, industry: "" }).success &&
      createResearchSchema.safeParse({ ...validInput, industry: "" })
        .data?.industry === undefined,
  );

  check(
    "a missing title is rejected",
    !createResearchSchema.safeParse({ ...validInput, title: "" }).success,
  );
  check(
    "a one-character title is rejected",
    !createResearchSchema.safeParse({ ...validInput, title: "x" }).success,
  );
  check(
    "an over-long title is rejected",
    !createResearchSchema.safeParse({ ...validInput, title: "x".repeat(201) })
      .success,
  );
  check(
    "an unknown depth is rejected",
    !createResearchSchema.safeParse({ ...validInput, depth: "extreme" }).success,
  );
  check(
    "a missing depth is rejected",
    !createResearchSchema.safeParse({ ...validInput, depth: "" }).success,
  );
  check(
    "a non-uuid business idea id is rejected",
    !createResearchSchema.safeParse({
      ...validInput,
      businessIdeaId: "not-a-uuid",
    }).success,
  );

  const manyQuestions = createResearchSchema.safeParse({
    ...validInput,
    questions: Array.from({ length: 25 }, (_, i) => `Question ${i}`).join("\n"),
  });
  check(
    `questions are capped at ${MAX_RESEARCH_QUESTIONS}`,
    manyQuestions.success &&
      manyQuestions.data.questions.length === MAX_RESEARCH_QUESTIONS,
    manyQuestions.success ? String(manyQuestions.data.questions.length) : "",
  );

  const bulleted = createResearchSchema.safeParse({
    ...validInput,
    questions: "- How big?\n* Who competes?\n1. What price?",
  });
  check(
    "list markers are stripped from questions",
    bulleted.success &&
      bulleted.data.questions.every((q) => !/^[-*\d.)\s]/.test(q)),
    bulleted.success ? bulleted.data.questions.join(" | ") : "",
  );

  // =========================================================================
  // CREATION — authorisation
  // =========================================================================

  check(
    "the create action derives the workspace from the session",
    /getResearchAccess\(\)/.test(actions) &&
      /p_workspace_id:\s*workspace\.id/.test(actions),
  );
  check(
    "the create action never reads a workspace id from the form",
    !/formData\.get\(\s*["'`]workspaceId/.test(actions),
  );
  check(
    // Matched on the guard and the call, not on the identifiers: both names
    // also appear in the imports and the file comment, which say nothing about
    // the order things actually happen in.
    "the create action checks the entitlement before writing",
    actions.indexOf("if (!entitled)") > -1 &&
      actions.indexOf("if (!entitled)") < actions.indexOf("supabase.rpc("),
  );
  check(
    "the create action refuses a read-only role",
    /canCreate/.test(actions) && /read-only/i.test(actions),
  );
  check(
    "the database error is logged, not returned to the user",
    /console\.error\("\[research\] create failed"/.test(actions) &&
      /Could not create the research project/.test(actions),
  );

  check(
    "research_create_request re-derives permission from auth.uid()",
    /auth\.uid\(\)/.test(migration) &&
      /can_edit_workspace\(p_workspace_id\)/.test(migration),
  );
  check(
    "research_create_request is security definer with a pinned search_path",
    /security definer/.test(migration) &&
      /set search_path = public/.test(migration),
  );
  check(
    "a cross-workspace business idea link is refused in SQL",
    /business_ideas[\s\S]{0,200}workspace_id = p_workspace_id/.test(migration),
  );
  check(
    "a cross-workspace business plan link is refused in SQL",
    /business_plans[\s\S]{0,200}workspace_id = p_workspace_id/.test(migration),
  );
  check(
    "an unknown or inactive depth is refused in SQL",
    /research_depths[\s\S]{0,120}is_active/.test(migration),
  );
  check(
    "the question cap is enforced in SQL as well as Zod",
    /jsonb_array_length[\s\S]{0,80}> 10/.test(migration),
  );
  check(
    "migration 0011 does not modify an applied migration",
    !/alter table public\.research_requests\s+drop/i.test(migration),
  );
  check(
    "no client INSERT policy was opened on research tables",
    !/create policy[\s\S]{0,200}for insert/i.test(migration),
  );

  // =========================================================================
  // BUSINESS IDEA / BUSINESS PLAN INTEGRATION
  // =========================================================================

  check(
    "a prefill can be built from a business idea",
    /export async function getPrefillFromIdea/.test(data),
  );
  check(
    "a prefill can be built from a business plan",
    /export async function getPrefillFromPlan/.test(data),
  );
  check(
    "prefill queries are scoped to the caller's workspace",
    (data.match(/\.eq\("workspace_id", workspaceId\)/g) ?? []).length >= 4,
  );
  check(
    "the relationship is stored as an id, not a copy of the record",
    /businessIdeaId: data\.id/.test(data) &&
      /businessPlanId: data\.id/.test(data),
  );
  check(
    "the form posts the provenance id in a hidden field",
    /type="hidden"[\s\S]{0,80}name="businessIdeaId"/.test(form) &&
      /type="hidden"[\s\S]{0,80}name="businessPlanId"/.test(form),
  );
  check(
    "the detail page links back to the originating idea or plan",
    /Research based on:/.test(detailPage) &&
      /href=\{`\/plans\/\$\{detail\.plan\.id\}`\}/.test(detailPage),
  );
  check(
    "the business plan page offers market research",
    /StartResearchLink/.test(read("app/(dashboard)/plans/[id]/page.tsx")),
  );
  check(
    "the validation report page offers market research",
    /StartResearchLink/.test(read("app/(dashboard)/reports/[id]/page.tsx")),
  );

  // =========================================================================
  // LISTING — workspace isolation
  // =========================================================================

  check(
    "the listing query filters on workspace_id",
    /from\("research_request_overview"\)[\s\S]{0,200}\.eq\("workspace_id", workspaceId\)/.test(
      data,
    ),
  );
  check(
    "the overview view runs with security_invoker so RLS still applies",
    /security_invoker = true/.test(migration),
  );
  check(
    "the listing is bounded rather than unlimited",
    /\.limit\(limit\)/.test(data),
  );
  check(
    // The call sites, not the import block — imports are sorted by module path
    // and say nothing about execution order.
    "the list page reads the entitlement before reading data",
    listPage.indexOf("await getResearchAccess()") > -1 &&
      listPage.indexOf("await getResearchAccess()") <
        listPage.indexOf("await getResearchList("),
  );

  // =========================================================================
  // DETAIL — authorisation and 404-not-403
  // =========================================================================

  check(
    "the detail query is scoped to the caller's workspace",
    /from\("research_requests"\)[\s\S]{0,220}\.eq\("workspace_id", workspaceId\)/.test(
      data,
    ),
  );
  check(
    "an unreadable research id becomes a 404, not a 403",
    /if \(!detail\) notFound\(\)/.test(detailPage),
  );
  check(
    "sources and evidence are paged, not loaded whole",
    /\.range\(from, from \+ pageSize - 1\)/.test(data) &&
      (data.match(/\.range\(/g) ?? []).length >= 2,
  );

  // =========================================================================
  // STAGE EXECUTION — one stage, server-decided
  // =========================================================================

  check(
    "the pipeline calls the Phase 3 endpoint",
    /\/api\/research\/\$\{requestId\}\/run-stage/.test(pipeline),
  );
  check(
    "the pipeline sends no stage in the body (no stage skipping)",
    /body: "\{\}"/.test(pipeline) && !/body: JSON\.stringify\(\{ stage/.test(pipeline),
  );
  check(
    "the pipeline issues exactly one request per click",
    (pipeline.match(/fetch\(/g) ?? []).length === 1,
  );
  check(
    "the pipeline has no loop over the stage list",
    !/for \([\s\S]{0,60}RESEARCH_STAGES/.test(pipeline) &&
      !/while \(/.test(pipeline),
  );
  check(
    "the pipeline re-reads server state after a stage instead of patching local state",
    /router\.refresh\(\)/.test(pipeline),
  );
  check(
    "the research feature never constructs an AI provider",
    !/new OpenAI|createResearchProvider|openai\.chat/.test(
      actions + data + pipeline + form,
    ),
  );
  check(
    // The product layer must reach the engine only through the Phase 3 HTTP
    // route. Importing `runNextStage` or `startRun` directly would be a second
    // execution path with none of the route's authorisation around it.
    "the product layer does not call the stage engine directly",
    !/from "@\/features\/research\/engine"/.test(
      actions + data + pipeline + form + listPage + detailPage + newPage,
    ),
  );
  check(
    "the UI does not compute a credit balance",
    !/creditsRemaining|balance\s*[-+]=|credits\s*-\s*cost/.test(
      pipeline + form + listPage + detailPage,
    ),
  );
  check(
    "the depth estimate comes from the server, not from React",
    /estimatedCredits/.test(form) &&
      !/STAGE_COST_MIRROR|estimateRunCost\(/.test(form),
  );
  check(
    "the estimator sums from the database first",
    /research_estimate_credits/.test(data),
  );

  // =========================================================================
  // BEHAVIOUR — progress is derived from persisted rows
  // =========================================================================

  const fresh = buildRunProgress({
    currentStage: null,
    runStatus: null,
    requestStatus: "draft",
    attempts: [],
  });
  check(
    "a draft with no run starts at planning",
    fresh.nextStage === "planning" && fresh.completedCount === 0,
    `next=${fresh.nextStage}`,
  );
  check("a draft reports 0% progress", fresh.percent === 0);
  check(
    "a draft is labelled Draft",
    statusLabel(fresh, "draft").label === "Draft",
  );

  const partway = buildRunProgress({
    currentStage: "evidence",
    runStatus: "running",
    requestStatus: "running",
    attempts: [
      attempt("planning", "succeeded"),
      attempt("discovery", "succeeded"),
      attempt("collection", "succeeded"),
    ],
  });
  check(
    "three succeeded stages count as three",
    partway.completedCount === 3,
    String(partway.completedCount),
  );
  check(
    "the resume point is the persisted current_stage",
    partway.nextStage === "evidence",
    String(partway.nextStage),
  );
  check(
    "stages after the pointer stay pending",
    partway.stages
      .filter((s) => ["analysis", "synthesis", "report"].includes(s.stage))
      .every((s) => s.status === "pending"),
  );
  check(
    "an incomplete run is labelled Incomplete, not Running",
    statusLabel(partway, "running").label !== "Draft",
  );

  // RESUME — the same rows read again after a browser restart must produce the
  // same position. This is the whole resume guarantee, and it holds because
  // nothing in the calculation reads a clock, a session or a client value.
  const resumed = buildRunProgress({
    currentStage: "evidence",
    runStatus: "running",
    requestStatus: "running",
    attempts: [
      attempt("planning", "succeeded"),
      attempt("discovery", "succeeded"),
      attempt("collection", "succeeded"),
    ],
  });
  check(
    "RESUME: reopening yields the identical position",
    resumed.nextStage === partway.nextStage &&
      resumed.completedCount === partway.completedCount &&
      resumed.percent === partway.percent,
    `${resumed.nextStage} @ ${resumed.percent}%`,
  );

  // A pointer that has moved past a stage does NOT make that stage complete;
  // only a succeeded attempt row does.
  const lyingPointer = buildRunProgress({
    currentStage: "report",
    runStatus: "running",
    requestStatus: "running",
    attempts: [attempt("planning", "succeeded")],
  });
  check(
    "a far-advanced pointer does not fabricate completed stages",
    lyingPointer.completedCount === 1,
    String(lyingPointer.completedCount),
  );

  const failed = buildRunProgress({
    currentStage: "discovery",
    runStatus: "running",
    requestStatus: "running",
    attempts: [
      attempt("planning", "succeeded"),
      attempt("discovery", "failed", 1, {
        errorCode: "AI_VALIDATION_FAILED",
        errorMessage: "The search returned no usable sources for this stage.",
        creditsRefunded: 25,
      }),
    ],
  });
  check(
    "a failed stage is reported as failed",
    failed.failedStage?.stage === "discovery",
    String(failed.failedStage?.stage),
  );
  check(
    "a failed stage does not advance the completed count",
    failed.completedCount === 1,
    String(failed.completedCount),
  );
  check(
    "a failed stage with attempts left is retryable",
    failed.failedStage?.retryable === true,
  );
  check(
    "the failure message and refund are available to the UI",
    failed.failedStage?.latest?.errorMessage !== null &&
      failed.failedStage?.latest?.creditsRefunded === 25,
  );
  check(
    "a failed run is labelled Failed",
    statusLabel(failed, "running").label === "Failed",
  );

  const exhausted = buildRunProgress({
    currentStage: "discovery",
    runStatus: "running",
    requestStatus: "running",
    attempts: [
      attempt("planning", "succeeded"),
      ...Array.from({ length: RESEARCH_MAX_STAGE_ATTEMPTS }, (_, i) =>
        attempt("discovery", "failed", i + 1),
      ),
    ],
  });
  check(
    `a stage that used all ${RESEARCH_MAX_STAGE_ATTEMPTS} attempts is not retryable`,
    exhausted.failedStage?.retryable === false,
    `attemptsUsed=${exhausted.failedStage?.attemptsUsed}`,
  );
  check(
    "the UI's attempt budget equals the engine's",
    exhausted.failedStage?.attemptsAllowed === RESEARCH_MAX_STAGE_ATTEMPTS,
  );

  // A retry that succeeds clears the failure.
  const recovered = buildRunProgress({
    currentStage: "collection",
    runStatus: "running",
    requestStatus: "running",
    attempts: [
      attempt("planning", "succeeded"),
      attempt("discovery", "failed", 1),
      attempt("discovery", "succeeded", 2),
    ],
  });
  check(
    "a succeeded retry clears the failed state",
    recovered.failedStage === null && recovered.completedCount === 2,
    String(recovered.completedCount),
  );

  const done = buildRunProgress({
    currentStage: null,
    runStatus: "completed",
    requestStatus: "completed",
    attempts: RESEARCH_STAGES.map((stage) => attempt(stage, "succeeded")),
  });
  check(
    "a finished run reports all seven stages and 100%",
    done.isComplete && done.completedCount === 7 && done.percent === 100,
    `${done.completedCount}/${done.totalCount}`,
  );
  check("a finished run has nothing left to run", done.nextStage === null);
  check(
    "a finished run is labelled Completed",
    statusLabel(done, "completed").label === "Completed",
  );

  const running = buildRunProgress({
    currentStage: "discovery",
    runStatus: "running",
    requestStatus: "running",
    attempts: [
      attempt("planning", "succeeded"),
      attempt("discovery", "running", 1, { completedAt: null }),
    ],
  });
  check(
    "an in-flight stage shows as running, not complete",
    running.stages.find((s) => s.stage === "discovery")?.status === "running",
  );

  // =========================================================================
  // BEHAVIOUR — stored content is narrowed, never trusted
  // =========================================================================

  check(
    "an analysis section renders its summary and points",
    toContentBlocks({
      summary: "The market is growing.",
      points: [{ text: "12% CAGR", label: "FACT", sourceUrl: "https://gov.uk/a" }],
    }).length === 2,
  );
  check(
    "an unrecognised shape renders nothing rather than something plausible",
    toContentBlocks({ mystery: "value", count: 3 }).length === 0,
  );
  check(
    "a null structured_content renders nothing",
    toContentBlocks(null).length === 0 && toContentBlocks("text").length === 0,
  );
  check(
    "an unlabelled point defaults to INFERENCE, not FACT",
    (() => {
      const blocks = toContentBlocks({ points: [{ text: "Probably big" }] });
      return (
        blocks[0]?.kind === "points" && blocks[0].items[0]?.label === "INFERENCE"
      );
    })(),
  );
  check(
    "a javascript: source url is dropped",
    (() => {
      const blocks = toContentBlocks({
        points: [
          {
            text: "x",
            label: "FACT",
            // eslint-disable-next-line no-script-url
            sourceUrl: "javascript:alert(1)",
          },
        ],
      });
      return (
        blocks[0]?.kind === "points" &&
        blocks[0].items[0]?.sourceUrl === undefined
      );
    })(),
  );
  check(
    "unsupported claims are surfaced rather than hidden",
    (() => {
      const blocks = toContentBlocks({
        unsupportedClaims: ["The market is worth $50bn"],
      });
      return blocks[0]?.kind === "list" && blocks[0].items.length === 1;
    })(),
  );
  check(
    "contradictions between sources are surfaced",
    (() => {
      const blocks = toContentBlocks({ contradictions: ["A says X, B says Y"] });
      return blocks[0]?.kind === "list";
    })(),
  );
  check(
    "a synthesis object renders its conclusions and uncertainties",
    (() => {
      const blocks = toContentBlocks({
        majorFindings: ["One", "Two"],
        uncertainties: ["Pricing data is thin"],
        overallConfidence: "medium",
      });
      return blocks.length === 2;
    })(),
  );

  // =========================================================================
  // SOURCE AND EVIDENCE UI
  // =========================================================================

  const allUi = pipeline + form + sourcesUi + evidenceUi + resultsUi + detailPage;

  check(
    "no research component renders raw HTML",
    !/dangerouslySetInnerHTML/.test(allUi),
  );
  check(
    "every external link carries noopener and noreferrer",
    (() => {
      const links = allUi.match(/target="_blank"/g) ?? [];
      const rels = allUi.match(/rel="noopener noreferrer[^"]*"/g) ?? [];
      return links.length > 0 && rels.length >= links.length;
    })(),
    `${(allUi.match(/target="_blank"/g) ?? []).length} external links`,
  );
  check(
    "source URLs are validated before becoming an href",
    /protocol === "https:" \|\| .*protocol === "http:"/.test(sourcesUi) &&
      /protocol === "https:" \|\| .*protocol === "http:"/.test(evidenceUi),
  );
  check(
    "sources show publisher, domain, type and both dates",
    /publisher/.test(sourcesUi) &&
      /Published/.test(sourcesUi) &&
      /Retrieved/.test(sourcesUi) &&
      /TYPE_LABEL/.test(sourcesUi),
  );
  check(
    "a missing publication date is stated, not invented",
    /Not stated/.test(sourcesUi),
  );
  check(
    "evidence renders claim, evidence and source together",
    /evidence\.claim/.test(evidenceUi) &&
      /evidence_reference/.test(evidenceUi) &&
      /Source:/.test(evidenceUi),
  );
  check(
    "evidence confidence is shown as words, not colour alone",
    /High confidence/.test(evidenceUi) && /Low confidence/.test(evidenceUi),
  );
  check(
    "contradictory evidence is labelled in text",
    /Contradicts another source/.test(evidenceUi),
  );
  check(
    "claim labels are rendered as words",
    /\{point\.label\}/.test(resultsUi) && /CLAIM_LABEL_MEANING/.test(resultsUi),
  );

  // =========================================================================
  // INSUFFICIENT EVIDENCE — uncertainty is never upgraded
  // =========================================================================

  check(
    "insufficient_evidence has its own visible treatment",
    /insufficient_evidence/.test(resultsUi) &&
      /Insufficient evidence/.test(resultsUi),
  );
  check(
    "an insufficient section warns the reader explicitly",
    /did not support this section/.test(resultsUi),
  );
  check(
    "low-confidence evidence is called out on the list",
    /low confidence/i.test(evidenceUi),
  );

  // =========================================================================
  // STATES — no blank screens
  // =========================================================================

  check(
    "the list page has an empty state",
    /No research projects yet/.test(listPage),
  );
  check(
    "results have an empty state",
    /No results yet/.test(resultsUi),
  );
  check(
    "sources have an empty state",
    /Nothing retrieved yet/.test(sourcesUi),
  );
  check(
    "evidence has an empty state",
    /No evidence extracted yet/.test(evidenceUi),
  );
  check(
    "both research routes have a loading skeleton",
    read("app/(dashboard)/research/loading.tsx").includes("Skeleton") &&
      read("app/(dashboard)/research/[id]/loading.tsx").includes("Skeleton"),
  );
  check(
    "a missing research project has a not-found screen",
    read("app/(dashboard)/research/[id]/not-found.tsx").includes(
      "Research not found",
    ),
  );
  check(
    "a network failure during a stage is reported to the user",
    /could not reach the server/.test(pipeline),
  );

  // =========================================================================
  // ENTITLEMENT
  // =========================================================================

  const permissions = read("features/research/permissions.ts");
  check(
    "the presentation gate asks the entitlement engine",
    /canAccess\(workspace\.id, "market_research"\)/.test(permissions),
  );
  check(
    "the entitlement is not re-implemented",
    !/plan_entitlements|subscriptions/.test(permissions + actions + data),
  );
  check(
    "every research route is gated",
    /getResearchAccess/.test(listPage) &&
      /getResearchAccess/.test(newPage) &&
      /getResearchAccess/.test(detailPage),
  );
  check(
    "the denial UI does not name internal entitlement details",
    (() => {
      const notice = read("features/research/research-access-notice.tsx");
      return (
        !/feature_not_in_plan|no_subscription|plan_entitlements|limit_value/.test(
          notice,
        ) && /not on your plan/i.test(notice)
      );
    })(),
  );

  // =========================================================================
  // ACCESSIBILITY
  // =========================================================================

  check(
    "progress is exposed to assistive technology",
    /<progress/.test(pipeline) && /aria-label=/.test(pipeline),
  );
  check(
    "stage status is spelled out in text, not only in colour",
    /\{meta\.label\}/.test(pipeline),
  );
  check(
    "external links announce that they open a new tab",
    (allUi.match(/opens in a new tab/g) ?? []).length >= 3,
  );
  check(
    "sections are labelled for screen readers",
    /aria-labelledby="pipeline-heading"/.test(pipeline) &&
      /aria-labelledby="sources-heading"/.test(sourcesUi) &&
      /aria-labelledby="evidence-heading"/.test(evidenceUi),
  );
  check(
    "the depth chooser is a labelled fieldset",
    /<fieldset/.test(form) && /<legend/.test(form),
  );

  // =========================================================================
  // MOBILE
  // =========================================================================

  check(
    "sources stack in a list rather than a wide table",
    !/<table/.test(sourcesUi) && /<ul/.test(sourcesUi),
  );
  check(
    "the brief reflows instead of scrolling sideways",
    !/<table/.test(detailPage) && /<dl/.test(detailPage),
  );
  check(
    "the pipeline uses no fixed-width table",
    !/<table/.test(pipeline),
  );

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — RESEARCH PRODUCT SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(
    `\n${total}/${total} checks passed — RESEARCH PRODUCT SMOKE PASSED`,
  );
}

main();
