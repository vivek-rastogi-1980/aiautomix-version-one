/**
 * PDF Engine smoke test (AI-PLATFORM-TEST-CASES.md: "PDF exports").
 *
 * Renders the same document model the Report Engine renders and asserts we get
 * a real, multi-page, branded A4 PDF back — no signed-in session and no live
 * model call required.
 *
 * Run with:  npm run test:pdf
 */
import { writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";

import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import { buildBusinessValidatorReportModel } from "@/features/reports/report-definition";
import { REPORT_SOURCE } from "@/scripts/fixtures";

const results: string[] = [];
function check(name: string, condition: boolean, detail = "") {
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
  if (!condition) process.exitCode = 1;
}

async function main(): Promise<void> {
  const model = buildBusinessValidatorReportModel({ ...REPORT_SOURCE });

  const buffer = await renderToBuffer(
    <ReportPdfDocument
      model={model}
      generatedAt="August 2, 2026 at 10:00 AM UTC"
    />,
  );

  const text = buffer.toString("latin1");
  const header = buffer.subarray(0, 5).toString("latin1");
  const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  // A4 in PDF points is 595.28 x 841.89.
  const isA4 = /\/MediaBox\s*\[\s*0\s+0\s+595\.\d+\s+841\.\d+\s*\]/.test(text);
  const hasImage = /\/Subtype\s*\/Image/.test(text);

  console.log("PDF header    :", JSON.stringify(header));
  console.log("Bytes         :", buffer.length);
  console.log("Page objects  :", pageCount);
  console.log("A4 MediaBox   :", isA4);
  console.log("Logo embedded :", hasImage);

  check("output is a PDF", header === "%PDF-", header);
  check("pages are A4", isA4);
  check("report spans multiple pages", pageCount >= 3, `pages=${pageCount}`);
  check("brand logo embedded", hasImage);
  check("title metadata set", text.includes("AIAutomix"));
  check(
    "file size stays optimised",
    buffer.length < 120_000,
    `${(buffer.length / 1024).toFixed(1)} KB`,
  );

  writeFileSync("pdf-smoke-output.pdf", buffer);

  console.log("\n" + results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(
    `\n${results.length - failed}/${results.length} checks passed` +
      (failed
        ? " — PDF SMOKE TEST FAILED"
        : " — PDF SMOKE TEST PASSED -> pdf-smoke-output.pdf"),
  );
}

main().catch((error) => {
  console.error("PDF SMOKE TEST FAILED:", error);
  process.exit(1);
});
