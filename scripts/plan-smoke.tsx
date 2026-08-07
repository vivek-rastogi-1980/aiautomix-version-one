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
