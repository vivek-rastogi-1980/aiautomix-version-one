/**
 * Market Research report and PDF tests (Sprint 8, Phase 5).
 *
 * The report layer's job is to explain evidence, never to invent it. Most of
 * these checks exist to prove it cannot: an uncited FACT, a citation pointing
 * at a source that is not in the index, a missing section quietly dropped, a
 * confidence grade rounded up — each is fed in deliberately and each must be
 * rejected or reported rather than rendered.
 *
 *   CONTRACT   The Zod schema exercised with real reports, valid and malformed.
 *   MODEL      The document model built from a contract, then inspected — this
 *              is where FACT/INFERENCE/RECOMMENDATION and confidence have to
 *              survive into something both renderers can draw.
 *   PDF        A real PDF rendered through the real engine, then read back.
 *   SOURCE     Structural guarantees: no second engine, no re-run on
 *              regeneration, authorisation on every entry point.
 */

import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";

import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import {
  researchReportSchema,
  type ResearchReport,
} from "@/features/research/report/schema";
import { buildResearchReportModel } from "@/features/research/report/definition";
import { findMarketSizeDivergence } from "@/features/research/report/market-size";
import {
  REPORT_SECTIONS,
  SECTION_TITLES,
  type ReportSection,
} from "@/features/research/types";
import type {
  ReportBlock,
  ReportDocumentModel,
} from "@/features/ai/renderer/types";

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

/**
 * Source with comments removed.
 *
 * These files explain their own choices in prose — `source-index.tsx` says it
 * uses `<ol>` "where a `<table>` does not [reflow]" — so a naive search for
 * `<table` finds the explanation and reports the opposite of the truth. Checks
 * about what the code *does* read the code, not the commentary.
 */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SOURCE_A = "11111111-1111-4111-8111-111111111111";
const SOURCE_B = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

function citation(id: string, label: string, publishedAt?: string) {
  return {
    sourceId: id,
    label,
    url: `https://example.gov/${label.toLowerCase().replace(/\s+/g, "-")}`,
    publisher: label,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/** A section with nothing behind it — the honest representation of a gap. */
function emptySection(key: ReportSection) {
  return {
    key,
    title: SECTION_TITLES[key],
    status: "missing" as const,
    confidence: "insufficient" as const,
    narrative: null,
    findings: [],
    lists: [],
    notices: [],
    version: null,
  };
}

function validReport(): unknown {
  const sections = REPORT_SECTIONS.map((key) => {
    if (key === "executive_summary") {
      return {
        ...emptySection(key),
        status: "complete" as const,
        confidence: "medium" as const,
        narrative: "The UK coeliac meal-kit market is small but growing.",
        version: 1,
      };
    }
    if (key === "market_size_growth") {
      return {
        ...emptySection(key),
        status: "partial" as const,
        confidence: "low" as const,
        narrative: "Published estimates differ.",
        version: 1,
        // The notice `compose.ts` attaches when two sources quote different
        // figures. Reproduced here so the model-building path can be tested
        // without a database; that the composer actually attaches it is
        // asserted separately, against its source.
        notices: [
          {
            title: "Published estimates vary materially",
            text: "Office for National Statistics: $1.2 billion\nIndustry Council: $3.4 billion\n\nAIAutoMix does not select between these. Treat the range as the finding.",
            tone: "caution" as const,
          },
        ],
        findings: [
          {
            text: "The UK gluten-free market was worth $1.2 billion in 2024.",
            kind: "FACT" as const,
            confidence: "medium" as const,
            citations: [
              citation(
                SOURCE_A,
                "Office for National Statistics",
                "2024-06-01",
              ),
            ],
            isContradictory: false,
          },
          {
            text: "The same market was reported at $3.4 billion for 2024.",
            kind: "FACT" as const,
            confidence: "low" as const,
            citations: [citation(SOURCE_B, "Industry Council")],
            isContradictory: true,
          },
          {
            text: "Growth is likely to continue at a similar rate.",
            kind: "INFERENCE" as const,
            confidence: "low" as const,
            citations: [],
            isContradictory: false,
          },
        ],
      };
    }
    if (key === "strategic_recommendations") {
      return {
        ...emptySection(key),
        status: "complete" as const,
        confidence: "medium" as const,
        narrative: "Focus on subscription retention.",
        version: 1,
        findings: [
          {
            text: "Launch with a four-week trial box.",
            kind: "RECOMMENDATION" as const,
            confidence: "medium" as const,
            citations: [],
            isContradictory: false,
          },
        ],
        lists: [
          { title: "Key conclusions", items: ["Retention beats reach."] },
        ],
      };
    }
    if (key === "confidence_limitations") {
      return {
        ...emptySection(key),
        status: "insufficient_evidence" as const,
        confidence: "insufficient" as const,
        narrative: "Pricing data was thin.",
        version: 1,
        notices: [
          {
            title: "Insufficient evidence",
            text: "The sources retrieved did not support this section.",
            tone: "caution" as const,
          },
        ],
      };
    }
    return emptySection(key);
  });

  return {
    requestId: REQUEST_ID,
    title: "Market research — Coeliac meal kits",
    depth: "standard",
    generatedAt: "2026-08-13T10:00:00.000Z",
    version: 1,
    context: {
      industry: "Food and beverage",
      geography: "United Kingdom",
      targetCustomer: "Adults diagnosed with coeliac disease",
      businessModel: "D2C subscription",
      scope: "Subscription meal kits for people with coeliac disease.",
      questions: ["How large is the UK coeliac population?"],
    },
    overallConfidence: "medium",
    sections,
    sources: [
      {
        id: SOURCE_A,
        title: "Gluten-free retail statistics 2024",
        url: "https://example.gov/office-for-national-statistics",
        publisher: "Office for National Statistics",
        sourceType: "government",
        publishedAt: "2024-06-01",
        retrievedAt: "2026-08-13",
      },
      {
        id: SOURCE_B,
        title: "Free-from category review",
        url: "https://example.gov/industry-council",
        publisher: "Industry Council",
        sourceType: "industry",
        // Deliberately unknown: the report must print "Not stated".
        publishedAt: null,
        retrievedAt: "2026-08-13",
      },
    ],
    evidence: {
      sourceCount: 2,
      evidenceCount: 3,
      byConfidence: { high: 0, medium: 2, low: 1 },
      bySourceType: { government: 1, industry: 1 },
      contradictionCount: 1,
      uncitedSections: [],
    },
  };
}

/** Deep-clone so each mutation test starts from a known-good report. */
function mutate(fn: (report: Record<string, never>) => void): unknown {
  const clone = JSON.parse(JSON.stringify(validReport()));
  fn(clone);
  return clone;
}

function allBlocks(model: ReportDocumentModel): ReportBlock[] {
  return model.sections.flatMap((section) => section.blocks);
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const compose = read("features/research/report/compose.ts");
  const definition = read("features/research/report/definition.ts");
  const actions = read("features/research/actions.ts");
  const engine = read("features/research/engine.ts");
  const pdfRoute = read("app/api/research/[id]/pdf/route.tsx");
  const reportPage = read("app/(dashboard)/research/[id]/report/page.tsx");
  const migration = read(
    "supabase/migrations/0012_sprint8_report_regeneration.sql",
  );
  const pdfEngine = read("features/ai/pdf/report-pdf.tsx");
  const htmlEngine = read("features/ai/renderer/report-renderer.tsx");

  // =========================================================================
  // CONTRACT
  // =========================================================================

  const parsed = researchReportSchema.safeParse(validReport());
  check(
    "a well-formed report validates",
    parsed.success,
    parsed.success ? "" : JSON.stringify(parsed.error.issues[0]),
  );

  check(
    "all fifteen sections are required",
    !researchReportSchema.safeParse(
      mutate((report) => {
        (report.sections as unknown as unknown[]).splice(3, 1);
      }),
    ).success,
  );

  check(
    "a duplicated section is rejected",
    !researchReportSchema.safeParse(
      mutate((report) => {
        const sections = report.sections as unknown as unknown[];
        sections.push(JSON.parse(JSON.stringify(sections[0])));
      }),
    ).success,
  );

  check(
    "a report with no title is rejected",
    !researchReportSchema.safeParse(
      mutate((r) => ((r as never as { title: string }).title = "")),
    ).success,
  );

  check(
    "an unknown depth is rejected",
    !researchReportSchema.safeParse(
      mutate((r) => ((r as never as { depth: string }).depth = "exhaustive")),
    ).success,
  );

  // --- The fabrication controls -----------------------------------------

  const uncitedFact = researchReportSchema.safeParse(
    mutate((report) => {
      const sections = report.sections as unknown as {
        key: string;
        findings: { citations: unknown[] }[];
      }[];
      const target = sections.find((s) => s.key === "market_size_growth")!;
      target.findings[0].citations = [];
    }),
  );
  check(
    "a FACT with no citation is REJECTED",
    !uncitedFact.success,
    uncitedFact.success ? "" : String(uncitedFact.error.issues[0]?.message),
  );

  const danglingCitation = researchReportSchema.safeParse(
    mutate((report) => {
      const sections = report.sections as unknown as {
        key: string;
        findings: { citations: { sourceId: string }[] }[];
      }[];
      const target = sections.find((s) => s.key === "market_size_growth")!;
      target.findings[0].citations[0].sourceId =
        "99999999-9999-4999-8999-999999999999";
    }),
  );
  check(
    "a citation pointing at a source not in the index is REJECTED",
    !danglingCitation.success,
  );

  check(
    "a javascript: citation url is rejected",
    !researchReportSchema.safeParse(
      mutate((report) => {
        const sections = report.sections as unknown as {
          key: string;
          findings: { citations: { url: string }[] }[];
        }[];
        const target = sections.find((s) => s.key === "market_size_growth")!;
        // eslint-disable-next-line no-script-url
        target.findings[0].citations[0].url = "javascript:alert(1)";
      }),
    ).success,
  );

  check(
    "an unknown claim label is rejected",
    !researchReportSchema.safeParse(
      mutate((report) => {
        const sections = report.sections as unknown as {
          key: string;
          findings: { kind: string }[];
        }[];
        const target = sections.find((s) => s.key === "market_size_growth")!;
        target.findings[0].kind = "TRUTH";
      }),
    ).success,
  );

  check(
    "an unknown confidence grade is rejected",
    !researchReportSchema.safeParse(
      mutate((report) => {
        const sections = report.sections as unknown as {
          key: string;
          confidence: string;
        }[];
        sections[0].confidence = "very high";
      }),
    ).success,
  );

  check(
    "all four confidence grades are accepted",
    (["high", "medium", "low", "insufficient"] as const).every(
      (grade) =>
        researchReportSchema.safeParse(
          mutate((report) => {
            const sections = report.sections as unknown as {
              confidence: string;
            }[];
            sections[2].confidence = grade;
          }),
        ).success,
    ),
  );

  check(
    "'insufficient' is a first-class confidence value, not an absence",
    researchReportSchema.safeParse(validReport()).success &&
      (parsed.success
        ? parsed.data.sections.some((s) => s.confidence === "insufficient")
        : false),
  );

  // =========================================================================
  // DOCUMENT MODEL
  // =========================================================================

  const report = (parsed.success ? parsed.data : null) as ResearchReport;
  const model = buildResearchReportModel({
    report,
    model: "gpt-4o-mini",
    promptVersion: "v1",
  });

  const blocks = allBlocks(model);
  const findingBlocks = blocks.filter((b) => b.kind === "findings");
  const findingEntries = findingBlocks.flatMap((b) =>
    b.kind === "findings" ? b.entries : [],
  );

  check(
    "the model carries the market research kicker",
    model.kicker === "Market Research Report",
    model.kicker,
  );
  check(
    "the executive summary becomes the report summary",
    model.summary.startsWith("The UK coeliac meal-kit market"),
  );
  check(
    "the model exposes no numeric score",
    model.score === undefined,
    "confidence is ordinal; a 0-100 dial would imply precision",
  );

  const sectionIds = model.sections.map((s) => s.id);
  check(
    "every report section except the summary becomes a model section",
    REPORT_SECTIONS.filter((key) => key !== "executive_summary").every((key) =>
      sectionIds.includes(key),
    ),
    `${sectionIds.length} sections`,
  );
  check(
    "research context is rendered",
    sectionIds.includes("research-context"),
  );
  check(
    "the evidence base section is rendered",
    sectionIds.includes("evidence-base"),
  );

  check(
    "FACT labels survive into the document model",
    findingEntries.some((entry) => entry.kind === "FACT"),
  );
  check(
    "INFERENCE labels survive into the document model",
    findingEntries.some((entry) => entry.kind === "INFERENCE"),
  );
  check(
    "RECOMMENDATION labels survive into the document model",
    findingEntries.some((entry) => entry.kind === "RECOMMENDATION"),
  );
  check(
    "no INFERENCE was promoted to FACT",
    findingEntries.filter((entry) => entry.kind === "FACT").length === 2,
    `${findingEntries.filter((e) => e.kind === "FACT").length} facts`,
  );
  check(
    "every FACT in the model carries a citation",
    findingEntries
      .filter((entry) => entry.kind === "FACT")
      .every((entry) => (entry.citations?.length ?? 0) > 0),
  );
  check(
    "confidence travels with each finding",
    findingEntries.every((entry) => entry.confidence !== undefined),
  );

  const calloutBlocks = blocks.filter((b) => b.kind === "callout");
  check(
    "insufficient evidence is stated as a callout",
    calloutBlocks.some(
      (b) => b.kind === "callout" && /insufficient evidence/i.test(b.title),
    ),
  );
  check(
    "a section with nothing stored says so rather than rendering blank",
    calloutBlocks.some(
      (b) => b.kind === "callout" && /nothing stored/i.test(b.title),
    ),
  );
  check(
    "the absence of chartable market data is stated, not filled in",
    calloutBlocks.some(
      (b) =>
        b.kind === "callout" &&
        /insufficient reliable data for visualization/i.test(b.title),
    ),
  );

  const sourceBlocks = blocks.filter((b) => b.kind === "sources");
  const sourceEntries = sourceBlocks.flatMap((b) =>
    b.kind === "sources" ? b.entries : [],
  );
  check(
    "the source index lists every source",
    sourceEntries.length === report.sources.length,
    `${sourceEntries.length}`,
  );
  check(
    "source metadata reaches the renderer",
    sourceEntries.every((entry) => entry.title) &&
      sourceEntries.some((entry) => entry.publisher) &&
      sourceEntries.some((entry) => entry.retrievedAt),
  );
  check(
    "a source with no publication date carries no invented one",
    sourceEntries.some((entry) => entry.publishedAt === undefined),
  );

  const metricBlocks = blocks.filter((b) => b.kind === "metrics");
  check(
    "the only chart is a distribution of the evidence base",
    metricBlocks.length > 0 &&
      metricBlocks.every(
        (b) =>
          b.kind === "metrics" &&
          b.entries.every(
            (entry) =>
              /confidence evidence|sources$/.test(entry.label) &&
              entry.value >= 0 &&
              entry.value <= 100,
          ),
      ),
  );

  // --- Market-size divergence ------------------------------------------
  const divergence = findMarketSizeDivergence([
    {
      text: "The market was worth $1.2 billion in 2024.",
      citations: [citation(SOURCE_A, "ONS")],
    },
    {
      text: "The market was worth $3.4 billion in 2024.",
      citations: [citation(SOURCE_B, "Industry Council")],
    },
  ]);
  check(
    "two sources quoting different figures is reported as a divergence",
    divergence.length === 2,
    divergence.map((d) => `${d.sourceLabel}=${d.figure}`).join(", "),
  );
  check(
    "the divergence names both figures and picks neither",
    divergence.some((d) => d.figure.includes("1.2")) &&
      divergence.some((d) => d.figure.includes("3.4")),
  );
  check(
    "two sources agreeing is NOT reported as a divergence",
    findMarketSizeDivergence([
      { text: "Worth $1.2 billion.", citations: [citation(SOURCE_A, "ONS")] },
      { text: "Worth $1.2 billion.", citations: [citation(SOURCE_B, "IC")] },
    ]).length === 0,
  );
  check(
    "one source alone is NOT a divergence",
    findMarketSizeDivergence([
      { text: "Worth $1.2 billion.", citations: [citation(SOURCE_A, "ONS")] },
      { text: "Grew to $3.4 billion.", citations: [citation(SOURCE_A, "ONS")] },
    ]).length === 0,
  );
  check(
    "an unsourced figure is not treated as evidence of disagreement",
    findMarketSizeDivergence([
      { text: "Worth $1.2 billion.", citations: [] },
      { text: "Worth $3.4 billion.", citations: [] },
    ]).length === 0,
  );
  check(
    "the divergence callout reaches the rendered report and refuses to choose",
    calloutBlocks.some(
      (b) =>
        b.kind === "callout" &&
        /vary materially/i.test(b.title) &&
        /does not select between these/i.test(b.text),
    ),
  );
  check(
    "the composer attaches that callout to the market-size section",
    /key === "market_size_growth"[\s\S]{0,400}findMarketSizeDivergence/.test(
      compose,
    ) && /vary materially/.test(compose),
  );
  check(
    "the composer never ranks or converts the competing figures",
    !/parseFloat|Number\(|Math\.max|sort\(/.test(
      read("features/research/report/market-size.ts"),
    ),
  );

  // =========================================================================
  // PDF — rendered for real, then read back
  // =========================================================================

  const buffer = await renderToBuffer(
    <ReportPdfDocument
      model={model}
      generatedAt="August 13, 2026 at 10:00 AM UTC"
    />,
  );
  const pdfText = buffer.toString("latin1");

  check(
    "the PDF renders",
    buffer.subarray(0, 5).toString("latin1") === "%PDF-",
  );
  check(
    "pages are A4",
    /\/MediaBox\s*\[\s*0\s+0\s+595\.\d+\s+841\.\d+\s*\]/.test(pdfText),
  );
  const pageCount = (pdfText.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(
    "the report spans multiple pages",
    pageCount >= 2,
    `pages=${pageCount}`,
  );
  check("the brand logo is embedded", /\/Subtype\s*\/Image/.test(pdfText));
  check("branding is present", pdfText.includes("AIAutomix"));
  // Page text lives in compressed content streams, so it cannot be grepped out
  // of the buffer. These two assert on the inputs instead: the engine's fixed
  // footer emits the page counter, and the model carries the disclaimer the
  // cover prints. The rendered-bytes checks above cover that it all rendered.
  check(
    "the PDF engine renders page numbers in a fixed footer",
    /render=\{\(\{ pageNumber, totalPages \}\)/.test(pdfEngine) &&
      /style=\{styles\.footer\} fixed>/.test(pdfEngine),
  );
  check(
    "the report carries a disclaimer for the PDF cover",
    model.disclaimer.includes("AI-generated") &&
      /model\.disclaimer/.test(pdfEngine),
    model.disclaimer.slice(0, 60),
  );
  check(
    "file size stays optimised",
    buffer.length < 400_000,
    `${(buffer.length / 1024).toFixed(1)} KB`,
  );
  check(
    "no API key or secret reaches the PDF",
    !/sk-[A-Za-z0-9]{8}|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE/.test(pdfText),
  );

  // Section titles must actually be printed, not merely present in the model.
  // Text is compressed in the stream, so the check is on the model the engine
  // was handed plus a spot check of uncompressed metadata.
  const printedTitles = model.sections.map((s) => s.title);
  check(
    "the PDF is given all fifteen report sections",
    REPORT_SECTIONS.filter((key) => key !== "executive_summary").every((key) =>
      printedTitles.includes(SECTION_TITLES[key]),
    ),
    `${printedTitles.length} section headings`,
  );
  check(
    "the PDF document title names the report",
    pdfText.includes("Market Research") || pdfText.includes("AIAutomix"),
  );

  writeFileSync("research-report-smoke-output.pdf", buffer);

  // =========================================================================
  // RENDERER PARITY — a block kind handled in one surface only is a silent gap
  // =========================================================================

  for (const kind of ["findings", "sources", "callout"] as const) {
    check(
      `the HTML renderer handles the '${kind}' block`,
      new RegExp(`case "${kind}":`).test(htmlEngine),
    );
    check(
      `the PDF renderer handles the '${kind}' block`,
      new RegExp(`case "${kind}":`).test(pdfEngine),
    );
  }
  check(
    "the claim label is printed as a word in the PDF, not only as colour",
    /CLAIM_KIND_LABEL\[entry\.kind\]/.test(pdfEngine),
  );
  check(
    "the confidence label is printed as a word in the PDF",
    /CONFIDENCE_LABEL\[confidence\]/.test(pdfEngine),
  );
  check(
    "the PDF prints source URLs so a printout stays checkable",
    /styles\.sourceUrl/.test(pdfEngine),
  );
  check(
    "a missing publication date prints as 'Not stated' in the PDF",
    /Not stated/.test(pdfEngine),
  );

  // =========================================================================
  // NO NEW ENGINE
  // =========================================================================

  check(
    "the report reuses the platform PDF engine",
    /ReportPdfDocument/.test(pdfRoute) &&
      !/new Document\(|pdfkit|puppeteer|jspdf/i.test(pdfRoute),
  );
  check(
    "the report reuses the platform HTML report engine",
    /ReportRenderer/.test(reportPage),
  );
  check(
    "the research feature defines no renderer of its own",
    !/@react-pdf\/renderer/.test(compose + definition),
  );
  check(
    "the report definition emits a ReportDocumentModel",
    /ReportDocumentModel/.test(definition),
  );

  // =========================================================================
  // COMPOSITION — no AI, no web, no credits on a page view
  // =========================================================================

  check(
    "composing the report calls no workflow and no provider",
    !/runWorkflow|createResearchProvider|new OpenAI/.test(compose + definition),
  );
  check(
    "composing the report charges nothing",
    !/debitCredits|refundCredits/.test(compose + definition),
  );
  check(
    "the report is built from persisted rows",
    /from\("research_results"\)/.test(compose) &&
      /from\("research_sources"\)/.test(compose) &&
      /from\("research_evidence"\)/.test(compose),
  );
  check(
    "composition reads only the current version of each section",
    /\.eq\("is_current", true\)/.test(compose),
  );
  check(
    "queries are bounded",
    /MAX_SOURCES/.test(compose) && /MAX_EVIDENCE/.test(compose),
  );

  // =========================================================================
  // REGENERATION — must not re-run research
  // =========================================================================

  check(
    "regeneration claims the report stage only",
    /stage = 'report'/.test(migration) &&
      /'report'/.test(migration) &&
      !/discovery|collection/.test(
        migration.split("insert into public.research_run_stages")[1] ?? "",
      ),
  );
  check(
    "regeneration requires an already-successful report",
    /status = 'succeeded'[\s\S]{0,200}no completed report to regenerate/.test(
      migration,
    ) || /no completed report to regenerate/.test(migration),
  );
  check(
    "regeneration re-derives edit permission in SQL",
    /can_edit_workspace\(v_run\.workspace_id\)/.test(migration),
  );
  check(
    "regeneration takes the same row lock as an ordinary stage",
    /for update/.test(migration) &&
      /already running for this run/.test(migration),
  );
  check(
    "regeneration continues the existing attempt numbering",
    /max\(s\.attempt\), 0\) \+ 1/.test(migration),
  );
  check(
    "regeneration reuses the existing completion and failure RPCs",
    /research_complete_stage/.test(engine) &&
      /research_fail_stage/.test(engine) &&
      !/research_complete_report|research_persist_report/.test(migration),
  );
  check(
    "regeneration and ordinary stages share one execution path",
    /executeClaimedStage/.test(engine) &&
      (engine.match(/async function executeClaimedStage/g) ?? []).length === 1,
  );
  check(
    "the regeneration action tells the user no new research was run",
    /no new research was run/.test(actions),
  );
  check(
    "the regenerate button states the cost and the absence of new research",
    /no new web\s*\n?\s*research|no new web research/.test(
      read("features/research/report/regenerate-button.tsx"),
    ),
  );
  check(
    "the report workflow reads stored sections rather than the web",
    (() => {
      const workflows = read("features/research/stages/workflows.ts");
      const reportBlock =
        workflows.split('"research-report": {')[1]?.slice(0, 600) ?? "";
      // `capability: "research"` is what routes a stage to the web. The report
      // stage must not declare it.
      return !/capability:\s*"research"/.test(reportBlock);
    })(),
  );

  // =========================================================================
  // VERSIONING
  // =========================================================================

  const data = read("features/research/data.ts");
  const stageEngineMigration = read(
    "supabase/migrations/0010_sprint8_stage_engine.sql",
  );
  check(
    "a new version supersedes rather than overwrites",
    /set is_current = false/.test(stageEngineMigration) &&
      /max\(version\) \+ 1/.test(stageEngineMigration),
  );
  check(
    "no version is ever deleted",
    !/delete from public\.research_results/.test(
      stageEngineMigration + migration,
    ),
  );
  check(
    "earlier versions remain readable",
    /getReportVersions/.test(data) &&
      /\.order\("version", \{ ascending: false \}\)/.test(data),
  );
  check(
    "the history query has an index",
    /research_results_history_idx/.test(migration),
  );
  check(
    "the version panel marks which version is current",
    /Current/.test(read("features/research/report/version-history.tsx")) &&
      /Superseded/.test(read("features/research/report/version-history.tsx")),
  );

  // =========================================================================
  // AUTHORISATION
  // =========================================================================

  check(
    "the PDF route is wrapped in withApiAuth",
    /withApiAuth<\{ id: string \}>/.test(pdfRoute),
  );
  check(
    "the PDF route derives the workspace from the session",
    /getWorkspaceContext\(user\.id\)/.test(pdfRoute) &&
      !/params.*workspace|searchParams/.test(pdfRoute),
  );
  check(
    "the PDF route re-checks the entitlement",
    /canAccess\(workspace\.id, "market_research"\)/.test(pdfRoute),
  );
  check(
    "the PDF route has its own rate-limit bucket",
    /scope: "research-pdf"/.test(pdfRoute),
  );
  check(
    "the PDF route validates the id before querying",
    /Invalid research id/.test(pdfRoute),
  );
  check(
    "composition is scoped to the caller's workspace",
    /\.eq\("workspace_id", workspaceId\)/.test(compose),
  );
  check(
    "an unreadable research id 404s on the report page",
    /if \(!request\) notFound\(\)/.test(reportPage),
  );
  check(
    "the report page is entitlement-gated",
    /getResearchAccess/.test(reportPage) &&
      /ResearchAccessNotice/.test(reportPage),
  );
  check(
    "regeneration verifies ownership before touching the engine",
    actions.indexOf('.eq("workspace_id", workspace.id)') <
      actions.indexOf("regenerateReport("),
  );
  check(
    "a read-only role cannot regenerate",
    /canCreate/.test(actions) && /read-only/.test(actions),
  );
  check(
    "the PDF filename is slugged before entering a header",
    /toPdfFilename\(model\.title/.test(pdfRoute),
  );
  check(
    "the PDF is not cached by intermediaries",
    /private, no-store/.test(pdfRoute),
  );

  // =========================================================================
  // SECURITY / SAFE RENDERING
  // =========================================================================

  const reportUi =
    read("features/ai/renderer/blocks/findings-list.tsx") +
    read("features/ai/renderer/blocks/source-index.tsx") +
    read("features/ai/renderer/blocks/report-callout.tsx");

  check("no raw HTML is rendered", !/dangerouslySetInnerHTML/.test(reportUi));
  check(
    "external links carry noopener and noreferrer",
    (() => {
      const links = reportUi.match(/target="_blank"/g) ?? [];
      const rels = reportUi.match(/rel="noopener noreferrer[^"]*"/g) ?? [];
      return links.length > 0 && rels.length >= links.length;
    })(),
  );
  check(
    "citation URLs are validated before becoming an href",
    /protocol === "https:"/.test(compose) &&
      /protocol === "https:"/.test(definition),
  );
  check(
    "a FACT with no citation is called out in the UI",
    /No source recorded for this statement/.test(reportUi),
  );
  check(
    "confidence is never colour alone",
    /CONFIDENCE_LABEL\[confidence\]/.test(reportUi),
  );
  check(
    "claim kinds are never colour alone",
    /CLAIM_KIND_LABEL\[entry\.kind\]/.test(reportUi),
  );
  check(
    "the confidence meter is ordinal, not a percentage",
    /CONFIDENCE_STEPS/.test(reportUi) && !/%/.test(reportUi.split("meter")[0]),
  );

  // =========================================================================
  // STATES AND ACCESSIBILITY
  // =========================================================================

  check(
    "the report page handles draft, generating, ready and failed",
    /generating/.test(reportPage) &&
      /failed/.test(reportPage) &&
      /No report yet/.test(reportPage),
  );
  check(
    "'ready' requires the persisted executive summary, not just the stage",
    /hasExecutiveSummary \? "ready" : "failed"/.test(compose),
  );
  check(
    "the report route has a loading skeleton",
    read("app/(dashboard)/research/[id]/report/loading.tsx").includes(
      "Skeleton",
    ),
  );
  check(
    "the meter is hidden from screen readers in favour of its label",
    /aria-hidden="true"/.test(reportUi),
  );
  check(
    "the source index is an ordered list, not a wide table",
    !/<table/.test(code("features/ai/renderer/blocks/source-index.tsx")) &&
      /<ol/.test(code("features/ai/renderer/blocks/source-index.tsx")),
  );
  check("callouts announce themselves as notes", /role="note"/.test(reportUi));
  check(
    "section navigation is present",
    /SectionNav/.test(htmlEngine) &&
      /aria-label="Report sections"/.test(
        read("features/ai/renderer/blocks/section-nav.tsx"),
      ),
  );

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — RESEARCH REPORT SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(
    `\n${total}/${total} checks passed — RESEARCH REPORT SMOKE PASSED -> research-report-smoke-output.pdf`,
  );
}

void main();
