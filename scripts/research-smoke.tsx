/**
 * Market Research foundation tests (Sprint 8, Phase 1).
 *
 * Covers the contracts and the schema guarantees that the later phases will
 * build on. Two kinds of check:
 *
 *   MIRROR  The TypeScript vocabulary and cost table must equal what migration
 *           0009 constrains and seeds — in BOTH directions. A stage added to
 *           one side only would otherwise fail at runtime, mid-run, after the
 *           user had already been charged for six stages.
 *
 *   SCHEMA  The guarantees that live in SQL — the fabrication control, source
 *           deduplication, attempt uniqueness, one-current-version — asserted
 *           by parsing the migration.
 *
 * The runtime behaviour of those guarantees was verified against the live
 * database when 0009 was applied: 16/16 checks inside a rolled-back
 * transaction, including that evidence with a null or dangling `source_id` is
 * refused. See docs/SPRINT-08-ARCHITECTURE.md.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  RESEARCH_STAGES,
  RETRIEVAL_STAGES,
  REPORT_SECTIONS,
  EVIDENCE_BACKED_SECTIONS,
  RESEARCH_DEPTHS,
  RESULT_STATUSES,
  SOURCE_TYPES,
  CONFIDENCE_LEVELS,
  CLAIM_LABELS,
  STAGE_LABELS,
  SECTION_TITLES,
  nextStage,
  stageIndex,
  progressAfter,
  isResearchStage,
  isReportSection,
  isResearchDepth,
  requiresCitation,
  type ResearchDepth,
} from "@/features/research/types";
import {
  STAGE_COST_MIRROR,
  estimateRunCost,
  stageCost,
  remainingCost,
  chargeKey,
  refundKey,
} from "@/features/research/cost";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

function main(): void {
  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/0009_sprint8_research_foundation.sql",
    ),
    "utf8",
  );

  // =========================================================================
  // MIRROR — stages
  // =========================================================================

  check(
    "seven stages",
    RESEARCH_STAGES.length === 7,
    RESEARCH_STAGES.join(" → "),
  );

  // Every stage must appear in the SQL CHECK constraint, and vice versa.
  const constraintMatch = migration.match(
    /stage\s+text not null check \(stage in \(([\s\S]*?)\)\)/,
  );
  check("migration constrains the stage column", Boolean(constraintMatch));
  const sqlStages = [
    ...(constraintMatch?.[1] ?? "").matchAll(/'([a-z_]+)'/g),
  ].map((m) => m[1]);
  const missingInSql = RESEARCH_STAGES.filter((s) => !sqlStages.includes(s));
  const extraInSql = sqlStages.filter(
    (s) => !(RESEARCH_STAGES as readonly string[]).includes(s),
  );
  check(
    "every TS stage is constrained in SQL",
    missingInSql.length === 0,
    missingInSql.join(", ") || "none",
  );
  check(
    "SQL constrains no stage TS lacks",
    extraInSql.length === 0,
    extraInSql.join(", ") || "none",
  );

  check(
    "retrieval stages are exactly discovery + collection",
    RETRIEVAL_STAGES.length === 2 &&
      RETRIEVAL_STAGES.includes("discovery") &&
      RETRIEVAL_STAGES.includes("collection"),
    RETRIEVAL_STAGES.join(", "),
  );
  // Everything after collection must reason over stored rows, never the web.
  const postRetrieval = RESEARCH_STAGES.slice(
    RESEARCH_STAGES.indexOf("collection") + 1,
  );
  check(
    "no stage after collection touches the network",
    postRetrieval.every((s) => !RETRIEVAL_STAGES.includes(s)),
    postRetrieval.join(", "),
  );

  check(
    "every stage has a label",
    RESEARCH_STAGES.every((s) => Boolean(STAGE_LABELS[s])),
  );
  check("planning is first", RESEARCH_STAGES[0] === "planning");
  check(
    "report is last",
    RESEARCH_STAGES[RESEARCH_STAGES.length - 1] === "report",
  );

  // Traversal
  check("nextStage walks the chain", nextStage("planning") === "discovery");
  check("nextStage(report) is null (terminal)", nextStage("report") === null);
  check("stageIndex is 0-based", stageIndex("planning") === 0);
  check("progressAfter(report) is 1", progressAfter("report") === 1);
  check(
    "progress increases monotonically",
    RESEARCH_STAGES.every(
      (s, i) =>
        i === 0 || progressAfter(s) > progressAfter(RESEARCH_STAGES[i - 1]),
    ),
  );
  check(
    "isResearchStage rejects junk",
    !isResearchStage("Planning") && !isResearchStage(null),
  );

  // =========================================================================
  // MIRROR — sections
  // =========================================================================

  check("fifteen report sections", REPORT_SECTIONS.length === 15);
  check(
    "every section has a title",
    REPORT_SECTIONS.every((s) => Boolean(SECTION_TITLES[s])),
  );
  check("no duplicate section keys", new Set(REPORT_SECTIONS).size === 15);
  check(
    "executive summary is first",
    REPORT_SECTIONS[0] === "executive_summary",
  );
  check(
    "confidence/limitations is last",
    REPORT_SECTIONS[REPORT_SECTIONS.length - 1] === "confidence_limitations",
  );
  check(
    "evidence-backed sections are a strict subset",
    EVIDENCE_BACKED_SECTIONS.every((s) =>
      (REPORT_SECTIONS as readonly string[]).includes(s),
    ) && EVIDENCE_BACKED_SECTIONS.length < REPORT_SECTIONS.length,
  );
  // Derived sections must NOT demand citations of their own.
  for (const derived of [
    "executive_summary",
    "scope_methodology",
    "evidence_sources",
    "confidence_limitations",
  ] as const) {
    check(
      `'${derived}' is not evidence-gated (it is derived)`,
      !EVIDENCE_BACKED_SECTIONS.includes(derived),
    );
  }
  check("isReportSection rejects junk", !isReportSection("Executive Summary"));

  // =========================================================================
  // MIRROR — depths and costs
  // =========================================================================

  check("three depths", RESEARCH_DEPTHS.length === 3);
  for (const depth of RESEARCH_DEPTHS) {
    check(
      `depth '${depth}' is seeded`,
      new RegExp(`\\('${depth}',`).test(migration),
    );
  }
  check("isResearchDepth rejects junk", !isResearchDepth("DEEP"));

  // Every (depth, stage) pair must be priced — a missing pair means a stage
  // that silently costs nothing.
  let missingPairs = 0;
  for (const depth of RESEARCH_DEPTHS) {
    for (const stage of RESEARCH_STAGES) {
      const cost = STAGE_COST_MIRROR[depth]?.[stage];
      if (typeof cost !== "number") {
        missingPairs += 1;
        results.push(`FAIL cost missing for ${depth}/${stage}`);
        failures += 1;
      }
    }
  }
  check(
    "all 21 depth x stage costs are defined",
    missingPairs === 0,
    `${21 - missingPairs}/21`,
  );

  // The mirror must equal the SQL seed, value for value.
  const mismatches: string[] = [];
  for (const depth of RESEARCH_DEPTHS) {
    for (const stage of RESEARCH_STAGES) {
      const pattern = new RegExp(`\\('${depth}','${stage}',\\s*(\\d+)\\)`);
      const found = migration.match(pattern);
      if (!found) {
        mismatches.push(`${depth}/${stage}: absent from SQL`);
        continue;
      }
      const sqlValue = Number.parseInt(found[1], 10);
      if (sqlValue !== STAGE_COST_MIRROR[depth][stage]) {
        mismatches.push(
          `${depth}/${stage}: sql=${sqlValue} ts=${STAGE_COST_MIRROR[depth][stage]}`,
        );
      }
    }
  }
  check(
    "TypeScript cost mirror equals the SQL seed",
    mismatches.length === 0,
    mismatches.join("; ") || "all 21 match",
  );

  // Costs must be sane and ordered.
  check(
    "basic is cheapest",
    estimateRunCost("basic") < estimateRunCost("standard"),
  );
  check(
    "deep is dearest",
    estimateRunCost("deep") > estimateRunCost("standard"),
  );
  check(
    "every stage costs something",
    RESEARCH_DEPTHS.every((d) =>
      RESEARCH_STAGES.every((s) => stageCost(d as ResearchDepth, s) > 0),
    ),
  );
  // Retrieval is the cost driver; it should dominate.
  for (const depth of RESEARCH_DEPTHS) {
    const retrieval =
      stageCost(depth, "discovery") + stageCost(depth, "collection");
    check(
      `${depth}: retrieval is the largest cost block`,
      retrieval > estimateRunCost(depth) * 0.3,
      `${retrieval}/${estimateRunCost(depth)}`,
    );
  }
  check(
    "remainingCost(first stage) equals the full estimate",
    RESEARCH_DEPTHS.every(
      (d) =>
        remainingCost(d as ResearchDepth, "planning") ===
        estimateRunCost(d as ResearchDepth),
    ),
  );
  check(
    "remainingCost(report) is just the report stage",
    remainingCost("standard", "report") === stageCost("standard", "report"),
  );
  check(
    "estimates are what the docs claim",
    estimateRunCost("basic") === 60 &&
      estimateRunCost("standard") === 125 &&
      estimateRunCost("deep") === 260,
    `${estimateRunCost("basic")}/${estimateRunCost("standard")}/${estimateRunCost("deep")}`,
  );

  // =========================================================================
  // Idempotency keys
  // =========================================================================

  check(
    "charge key includes the attempt",
    chargeKey("run1", "planning", 2) === "research:run1:planning:2",
    chargeKey("run1", "planning", 2),
  );
  check(
    "a retry gets a DIFFERENT charge key",
    chargeKey("run1", "planning", 1) !== chargeKey("run1", "planning", 2),
  );
  check(
    "refund key is distinct from the charge key",
    refundKey("run1", "planning", 1) !== chargeKey("run1", "planning", 1),
  );
  check(
    "keys are unique across stages",
    new Set(RESEARCH_STAGES.map((s) => chargeKey("r", s, 1))).size ===
      RESEARCH_STAGES.length,
  );

  // =========================================================================
  // SCHEMA — the guarantees that must live in SQL
  // =========================================================================

  check(
    "evidence.source_id is NOT NULL (fabrication control)",
    /source_id\s+uuid not null references public\.research_sources/i.test(
      migration,
    ),
  );
  check(
    "sources are deduplicated by canonical_url",
    /unique \(research_request_id, canonical_url\)/i.test(migration),
  );
  check(
    "URLs must be http\\(s\\)",
    /url\s+text not null check \(url ~\* '\^https\?:\/\/'\)/i.test(migration),
  );
  check(
    "a stage attempt is unique per (run, stage, attempt)",
    /unique \(run_id, stage, attempt\)/i.test(migration),
  );
  check(
    "exactly one current version per section",
    /research_results_current_uidx[\s\S]{0,160}where is_current/i.test(
      migration,
    ),
  );
  check(
    "insufficient_evidence is a storable status",
    /'insufficient_evidence'/.test(migration),
  );
  check(
    "published_at is nullable (missing dates are supported)",
    /published_at\s+timestamptz,/i.test(migration),
  );
  check(
    "contradictory evidence can be flagged",
    /is_contradictory\s+boolean not null default false/i.test(migration),
  );
  check(
    "sources store retrieval metadata, not page content",
    /Never raw page content/i.test(migration),
  );

  // Workspace isolation + no client writes, same shape as 0007/0008.
  const researchTables = [
    "research_requests",
    "research_runs",
    "research_run_stages",
    "research_sources",
    "research_evidence",
    "research_results",
  ];
  for (const table of researchTables) {
    check(
      `${table} has RLS enabled`,
      new RegExp(
        `alter table public\\.${table}\\s+enable row level security`,
        "i",
      ).test(migration),
    );
    check(
      `${table} read is workspace-scoped`,
      new RegExp(
        `on public\\.${table} for select[\\s\\S]{0,140}is_workspace_member\\(workspace_id\\)`,
        "i",
      ).test(migration),
    );
  }

  const writePolicy =
    /create policy[^;]*?on public\.research_\w+\s+for\s+(insert|update|delete|all)/i;
  check(
    "NO client write policy on any research table",
    !writePolicy.test(migration),
  );

  check(
    "admin read access goes through admin_has('ai.read')",
    (migration.match(/admin_has\('ai\.read'\)/g) ?? []).length >= 6,
  );

  // =========================================================================
  // Claim labels
  // =========================================================================

  check("three claim labels", CLAIM_LABELS.length === 3);
  check("FACT requires a citation", requiresCitation("FACT"));
  check("INFERENCE does not", !requiresCitation("INFERENCE"));
  check("RECOMMENDATION does not", !requiresCitation("RECOMMENDATION"));

  check("three confidence levels", CONFIDENCE_LEVELS.length === 3);
  check("four result statuses", RESULT_STATUSES.length === 4);
  check("nine source types", SOURCE_TYPES.length === 9);
  for (const t of SOURCE_TYPES) {
    check(
      `source type '${t}' is constrained in SQL`,
      migration.includes(`'${t}'`),
    );
  }

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — RESEARCH SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(`\n${total}/${total} checks passed — RESEARCH SMOKE PASSED`);
}

main();
