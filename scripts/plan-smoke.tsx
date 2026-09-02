/**
 * Business Plan smoke test (Sprint 5).
 *
 * Covers the parts of the plan feature that need no database: the section
 * catalog, the mapping from a generated document to storable rows, the report
 * model, and both renderers. Workflow *execution* is covered by
 * `npm run test:engine`, which runs under the react-server condition.
 *
 * Run with:  npm run test:plan
 */
import { writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { renderToStaticMarkup } from "react-dom/server";

import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { businessPlanSectionsSchema } from "@/features/ai/schemas/business-plan";
import { buildBusinessPlanReportModel } from "@/features/business-plans/report-definition";
import {
  PLAN_SECTION_COUNT,
  PLAN_SECTIONS,
  getPlanSection,
  toPlanSectionContents,
} from "@/features/business-plans/sections";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { BusinessValidatorReport } from "@/features/ai/schemas/business-validator";
import { validationReportToBusinessPlanInput } from "@/features/business-plans/from-validation";
import { VALID_PLAN_DOCUMENT } from "@/scripts/fixtures";
import type { BusinessPlan, BusinessPlanSection } from "@/types/database";

const results: string[] = [];
function check(name: string, condition: boolean, detail = "") {
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
  if (!condition) process.exitCode = 1;
}

const PLAN: BusinessPlan = {
  id: "plan-1",
  workspace_id: "ws-1",
  user_id: "user-1",
  project_id: null,
  business_idea_id: null,
  // Migration 0030. Null here on purpose: this fixture is a plan created
  // directly, which is the case that must keep working unchanged.
  validation_report_id: null,
  title: VALID_PLAN_DOCUMENT.title,
  summary: VALID_PLAN_DOCUMENT.sections.executiveSummary,
  status: "ready",
  input_json: {},
  workflow: "business-plan",
  prompt_version: "v1",
  model: "gpt-4o-mini",
  ai_request_id: null,
  created_at: "2026-08-03T10:00:00.000Z",
  updated_at: "2026-08-03T10:00:00.000Z",
  deleted_at: null,
};

/** Build the section rows exactly as the service persists them. */
function toSectionRows(): BusinessPlanSection[] {
  return toPlanSectionContents(VALID_PLAN_DOCUMENT.sections).map(
    (section, index) => ({
      ...section,
      id: `section-${index}`,
      plan_id: PLAN.id,
      workspace_id: PLAN.workspace_id,
      current_version: 1,
      source: "ai" as const,
      created_at: PLAN.created_at,
      updated_at: PLAN.created_at,
    }),
  );
}

async function main(): Promise<void> {
  // --- Section catalog ------------------------------------------------------
  const schemaFields = Object.keys(businessPlanSectionsSchema.shape);

  check(
    "catalog holds the eleven spec sections",
    PLAN_SECTION_COUNT === 11,
    `count=${PLAN_SECTION_COUNT}`,
  );
  check(
    "catalog covers every schema field",
    schemaFields.every((field) =>
      PLAN_SECTIONS.some((section) => section.field === field),
    ) && schemaFields.length === PLAN_SECTION_COUNT,
  );
  check(
    "section keys are unique",
    new Set(PLAN_SECTIONS.map((section) => section.key)).size ===
      PLAN_SECTION_COUNT,
  );
  check(
    "section icons are distinct",
    new Set(PLAN_SECTIONS.map((section) => section.icon)).size ===
      PLAN_SECTION_COUNT,
  );
  check(
    "sections are positioned in order",
    PLAN_SECTIONS.every((section, index) => section.position === index),
  );
  check(
    "sections are addressable by key",
    getPlanSection("executive-summary")?.title === "Executive Summary" &&
      getPlanSection("nope") === undefined,
  );

  // --- Storable rows --------------------------------------------------------
  const sections = toSectionRows();
  check(
    "every section maps to a row",
    sections.length === PLAN_SECTION_COUNT,
    `rows=${sections.length}`,
  );
  check(
    "row content comes from the matching schema field",
    sections[0].content === VALID_PLAN_DOCUMENT.sections.executiveSummary,
  );

  // --- Report model ---------------------------------------------------------
  const model = buildBusinessPlanReportModel({ plan: PLAN, sections });

  check("model names its workflow", model.workflow === "business-plan");
  check("model has no score", model.score === undefined);
  check(
    "executive summary lifted into the summary slot",
    model.summary === VALID_PLAN_DOCUMENT.sections.executiveSummary,
  );
  check(
    "executive summary is not also a section",
    !model.sections.some((section) => section.id === "executive-summary"),
  );
  check(
    "remaining ten sections carried over",
    model.sections.length === PLAN_SECTION_COUNT - 1,
    `sections=${model.sections.length}`,
  );
  check(
    "prose split into paragraph blocks",
    model.sections[0].blocks.length === 2,
    `blocks=${model.sections[0].blocks.length}`,
  );
  check(
    "provenance recorded",
    model.meta.model === "gpt-4o-mini" && model.meta.promptVersion === "v1",
  );

  // --- Report Engine (HTML) -------------------------------------------------
  const html = renderToStaticMarkup(<ReportRenderer model={model} />);
  check(
    "renders a non-trivial document",
    html.length > 4000,
    `${html.length} chars`,
  );
  check("renders the plan title", html.includes(PLAN.title));
  check("renders the executive summary", html.includes(model.summary));
  check("renders a later section", html.includes("Roadmap"));
  check(
    "section anchors emitted",
    model.sections.every((section) => html.includes(`id="${section.id}"`)),
  );
  check("renders the disclaimer", html.includes("not professional financial"));

  // --- PDF Engine -----------------------------------------------------------
  const buffer = await renderToBuffer(
    <ReportPdfDocument
      model={model}
      generatedAt="August 3, 2026 at 10:00 AM UTC"
    />,
  );
  const text = buffer.toString("latin1");
  const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const isA4 = /\/MediaBox\s*\[\s*0\s+0\s+595\.\d+\s+841\.\d+\s*\]/.test(text);

  console.log("PDF bytes     :", buffer.length);
  console.log("Page objects  :", pageCount);

  check(
    "output is a PDF",
    buffer.subarray(0, 5).toString("latin1") === "%PDF-",
  );
  check("pages are A4", isA4);
  check("plan spans multiple pages", pageCount >= 3, `pages=${pageCount}`);
  check("brand logo embedded", /\/Subtype\s*\/Image/.test(text));
  check(
    "file size stays optimised",
    buffer.length < 120_000,
    `${(buffer.length / 1024).toFixed(1)} KB`,
  );

  writeFileSync("plan-smoke-output.pdf", buffer);

  // =========================================================================
  // Validation report -> business plan (migration 0030)
  //
  // The mapping is a pure function, so these are real unit tests rather than
  // source assertions. The security, entitlement and idempotency properties
  // live in other files and are asserted by parsing them, the same way the
  // commerce suite does.
  // =========================================================================

  const REPORT: BusinessValidatorReport = {
    overallScore: 82,
    recommendation: "go",
    summary: "Strong demand among small clinics.",
    problemStatement: "Scheduling is manual and error-prone.",
    targetMarket: "UK dental practices with 2-10 chairs.",
    customerPersona: "Practice managers who own the diary.",
    marketOpportunity: "Roughly 12,000 practices, low software penetration.",
    scoreBreakdown: {
      marketDemand: 84,
      problemSeverity: 80,
      revenuePotential: 78,
      competition: 60,
      feasibility: 88,
      innovation: 70,
      risk: 65,
    },
    swot: {
      strengths: ["Clear pain point", "Founder is a dentist"],
      weaknesses: ["No engineering team"],
      opportunities: ["NHS digitisation push"],
      threats: ["Incumbent PMS vendors"],
    },
    revenueModels: [
      {
        name: "Per-seat SaaS",
        description: "Monthly per practice.",
        potential: "high",
      },
    ],
    risks: [
      {
        title: "Data protection",
        description: "Patient data is sensitive.",
        severity: "high",
        mitigation: "UK-hosted, DPA in place.",
      },
    ],
    recommendations: [
      {
        title: "Interview 20 practices",
        description: "Confirm willingness to pay.",
        priority: "high",
      },
    ],
    nextSteps: [
      {
        title: "Build a prototype",
        description: "One clinic, one diary.",
        timeframe: "6 weeks",
      },
    ],
  };

  const IDEA_PAYLOAD = {
    businessName: "DentalFlow AI",
    ideaDescription:
      "An AI scheduling assistant for dental practices that fills cancellations automatically and keeps the diary full.",
    industry: "Healthcare software",
    country: "United Kingdom",
    targetAudience: "Independent dental practices",
    businessModel: "saas",
    currentStage: "idea",
    estimatedBudget: 25000,
    timeline: "6 months",
    competitors: "Dentally, Software of Excellence",
    additionalNotes: "Founder is a practising dentist.",
  };

  const prefill = validationReportToBusinessPlanInput({
    report: REPORT,
    ideaPayload: IDEA_PAYLOAD,
    businessIdeaId: "11111111-1111-4111-8111-111111111111",
    ideaTitle: "DentalFlow AI",
  });

  // --- The customer's own submission is carried across verbatim ------------
  for (const field of [
    "businessName",
    "ideaDescription",
    "industry",
    "country",
    "targetAudience",
    "businessModel",
    "currentStage",
    "estimatedBudget",
    "timeline",
    "competitors",
  ] as const) {
    check(
      `prefill carries ${field} from the original submission`,
      prefill.values[field] === IDEA_PAYLOAD[field],
      "the customer's own words must not be replaced by generated prose",
    );
  }
  check(
    "prefill links the source business idea",
    prefill.values.businessIdeaId === "11111111-1111-4111-8111-111111111111",
  );

  // --- Report findings reach the brief -------------------------------------
  const notes = prefill.values.additionalNotes ?? "";
  check("findings include the score", notes.includes("82/100"));
  check(
    "findings include the problem statement",
    notes.includes("Scheduling is manual"),
  );
  check(
    "findings include SWOT",
    notes.includes("STRENGTHS") && notes.includes("THREATS"),
  );
  check(
    "findings include recommendations",
    notes.includes("Interview 20 practices"),
  );
  check(
    "the customer's own notes survive alongside the findings",
    notes.includes("Founder is a practising dentist."),
  );
  check(
    "the brief stays inside the schema's 2,000 character ceiling",
    notes.length <= 2_000,
    `${notes.length} chars`,
  );

  // --- Nothing is fabricated ------------------------------------------------
  check(
    "fundingGoal is left blank rather than invented",
    prefill.values.fundingGoal === undefined &&
      prefill.blank.includes("fundingGoal"),
  );
  check(
    "teamSummary is left blank rather than invented",
    prefill.values.teamSummary === undefined &&
      prefill.blank.includes("teamSummary"),
  );

  // --- A legacy payload degrades instead of throwing -----------------------
  const legacy = validationReportToBusinessPlanInput({
    report: REPORT,
    ideaPayload: { businessName: "Old Shape" },
    businessIdeaId: null,
    ideaTitle: "Old Shape",
  });
  check(
    "a partial idea payload still yields a usable prefill",
    legacy.values.businessName === "Old Shape" &&
      (legacy.values.additionalNotes ?? "").includes("82/100"),
    "an old stored payload must not crash the page",
  );
  const empty = validationReportToBusinessPlanInput({
    report: REPORT,
    ideaPayload: null,
    businessIdeaId: null,
    ideaTitle: null,
  });
  check(
    "a missing idea payload does not throw",
    typeof empty.values.additionalNotes === "string",
  );

  // --- Security, entitlement and idempotency properties --------------------
  const read = (rel: string) =>
    readFileSync(path.join(process.cwd(), rel), "utf8");
  const planActions = read("features/business-plans/actions.ts");
  const planService = read("features/ai/services/business-plan.ts");
  const ctaSource = read(
    "features/business-plans/create-plan-from-validation-link.tsx",
  );
  const newPage = read("app/(dashboard)/plans/new/page.tsx");
  const linkMigration = read(
    "supabase/migrations/0030_business_plan_validation_report_link.sql",
  );

  check(
    "the posted validation_report_id is re-read under the caller's session",
    planActions.includes("getReport(user.id, parsed.data.validationReportId)"),
    "a browser-supplied report id is a claim, not a fact",
  );
  check(
    "an unresolvable report id drops the link instead of widening access",
    planActions.includes(
      "validationReportId = source ? parsed.data.validationReportId : undefined",
    ),
  );
  check(
    "the prefill page resolves the report through the user-scoped reader",
    newPage.includes("getReport(user.id, requestedReportId)"),
  );
  check(
    "the CTA creates nothing - it is a link, not a mutation",
    !/useTransition|fetch\(|method="post"/i.test(ctaSource) &&
      ctaSource.includes("/plans/new?validation_report_id="),
    "no write on click means double-clicks cannot duplicate a plan",
  );
  check(
    "plan generation still consumes the existing entitlement",
    planService.includes("consumeEntitlement(") &&
      planService.includes('"business_plan"'),
  );
  check(
    "entitlement is still reserved BEFORE the model call",
    (() => {
      const consume = planService.indexOf("consumeEntitlement(");
      const run = planService.indexOf("await runWorkflow");
      return consume !== -1 && run !== -1 && consume < run;
    })(),
    "the validation path must not become an entitlement bypass",
  );
  check(
    "the validation path adds no second entitlement mechanism",
    !/usage_counters|entitlement_consume|usage_reservations/.test(
      planActions,
    ) && !/usage_counters/.test(newPage),
  );
  check(
    "the duplicate check is scoped to the workspace, not just the report",
    /getPlansForValidationReport\(\s*workspace\.id/.test(newPage),
  );
  check(
    "deleting a validation report never deletes the plan built from it",
    linkMigration.includes("on delete set null"),
  );
  check(
    "the link column is indexed for the lookups the product performs",
    linkMigration.includes(
      "create index if not exists business_plans_validation_report_idx",
    ),
  );
  check(
    "no separate source column duplicates the link",
    !/add column if not exists source/.test(linkMigration),
  );

  console.log("\n" + results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(
    `\n${results.length - failed}/${results.length} checks passed` +
      (failed
        ? " — PLAN SMOKE TEST FAILED"
        : " — PLAN SMOKE TEST PASSED -> plan-smoke-output.pdf"),
  );
}

main().catch((error) => {
  console.error("PLAN SMOKE TEST FAILED:", error);
  process.exit(1);
});
