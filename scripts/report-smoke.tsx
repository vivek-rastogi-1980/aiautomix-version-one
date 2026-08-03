/**
 * Report Engine smoke test (AI-PLATFORM-TEST-CASES.md: "Report renders").
 *
 * Builds the shared document model from a validated report fixture and renders
 * it to static HTML, so the Report Engine is verifiable without a signed-in
 * session, a database, or a live model call.
 *
 * Run with:  npm run test:report
 */
import { renderToStaticMarkup } from "react-dom/server";

import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { navigableSections } from "@/features/ai/renderer/types";
import { buildBusinessValidatorReportModel } from "@/features/reports/report-definition";
import { REPORT_SOURCE } from "@/scripts/fixtures";

const results: string[] = [];
function check(name: string, condition: boolean, detail = "") {
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
  if (!condition) process.exitCode = 1;
}

function main(): void {
  const model = buildBusinessValidatorReportModel({ ...REPORT_SOURCE });

  // --- Document model -------------------------------------------------------
  check("model names its workflow", model.workflow === "business-validator");
  check("model carries a score", model.score?.value === 74);
  check("score band resolved", model.score?.label === "Strong");
  check("verdict resolved", model.score?.verdict?.label === "Go");
  check(
    "all report sections present",
    model.sections.length === 10,
    `sections=${model.sections.length}`,
  );
  check(
    "section ids are unique",
    new Set(model.sections.map((s) => s.id)).size === model.sections.length,
  );
  check(
    "navigation covers every section",
    navigableSections(model).length === model.sections.length,
  );
  check(
    "provenance recorded",
    model.meta.model === "gpt-4o-mini" && model.meta.promptVersion === "v1",
  );

  // --- HTML rendering -------------------------------------------------------
  const html = renderToStaticMarkup(<ReportRenderer model={model} />);

  check(
    "renders a non-trivial document",
    html.length > 4000,
    `${html.length} chars`,
  );
  check("renders the title", html.includes("Acme Invoicing"));
  check("renders the executive summary", html.includes(model.summary));
  check("renders the score", html.includes(">74<"));
  check("renders SWOT content", html.includes("Low switching cost"));
  check("renders ranked items", html.includes("Interview 20 SMB owners"));
  check("renders risk mitigations", html.includes("Mitigation"));
  check("renders the timeline", html.includes("Week 3-4"));
  check("renders metric weights", html.includes("20% weight"));
  check("renders the disclaimer", html.includes("not professional financial"));
  check(
    "section anchors emitted",
    model.sections.every((section) => html.includes(`id="${section.id}"`)),
  );
  check(
    "accessible score label",
    html.includes('role="img"') && html.includes("aria-label"),
  );

  console.log("\n" + results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(
    `\n${results.length - failed}/${results.length} checks passed` +
      (failed ? " — REPORT SMOKE TEST FAILED" : " — REPORT SMOKE TEST PASSED"),
  );
}

main();
