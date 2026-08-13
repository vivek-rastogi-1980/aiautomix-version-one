/**
 * Admin & AI Operations Center tests (Sprint 8, Phase 6).
 *
 * Sprint 7's suite proved the RBAC foundation. This one proves the operations
 * surface built on it: that research and cost monitoring expose what is
 * happening without weakening the boundaries protecting customer workspaces.
 *
 * Four kinds of check.
 *
 *   SQL       Aggregation happens in Postgres. Asserted against the migration
 *             and against the absence of `reduce()` over the AI log in the
 *             feature modules — a JavaScript sum over a capped result set
 *             returns a plausible but short total, which is the worst possible
 *             failure mode for a cost figure.
 *   SECURITY  Every route guarded server-side, every dimension whitelisted,
 *             no service-role client, no secrets, no client-controlled query.
 *   BOUNDED   Every list paged, every filter a database predicate, every
 *             unbounded input clamped.
 *   PURE      Dimension validation, cost formatting and pagination clamping,
 *             exercised in-process.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  COST_DIMENSIONS,
  DIMENSION_LABELS,
  isCostDimension,
  formatCost,
} from "@/features/admin/cost-ops";
import { researchFacets } from "@/features/admin/research-ops";
import { ADMIN_NAV } from "@/features/admin/nav";
import { ROLE_PERMISSIONS } from "@/features/admin/permissions";
import { pageParams, MAX_PAGE_SIZE } from "@/features/admin/query";
import { RESEARCH_STAGES } from "@/features/research/types";

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

/** Source with comments stripped, for checks about behaviour not commentary. */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

function main(): void {
  const migration = read(
    "supabase/migrations/0013_sprint8_admin_operations.sql",
  );
  const researchOps = read("features/admin/research-ops.ts");
  const costOps = read("features/admin/cost-ops.ts");
  const researchPage = read("app/(admin)/admin/research/page.tsx");
  const researchDetail = read("app/(admin)/admin/research/[id]/page.tsx");
  const costsPage = read("app/(admin)/admin/costs/page.tsx");
  const dashboard = read("app/(admin)/admin/page.tsx");
  const guard = read("features/admin/guard.ts");

  // =========================================================================
  // ROUTES AND NAVIGATION
  // =========================================================================

  for (const href of ["/admin/research", "/admin/costs"]) {
    check(
      `${href} is registered in the admin navigation`,
      ADMIN_NAV.some((item) => item.href === href),
    );
    check(
      `${href} declares the permission it needs`,
      Boolean(ADMIN_NAV.find((item) => item.href === href)?.permission),
    );
  }
  check(
    "the Sprint 7 navigation is unchanged",
    [
      "/admin",
      "/admin/users",
      "/admin/workspaces",
      "/admin/ai",
      "/admin/usage",
      "/admin/credits",
      "/admin/plans",
      "/admin/entitlements",
      "/admin/audit-logs",
      "/admin/system-health",
      "/admin/settings",
    ].every((href) => ADMIN_NAV.some((item) => item.href === href)),
  );
  check(
    "every nav icon resolves in the shell",
    (() => {
      const shell = read("features/admin/admin-shell.tsx");
      const map =
        shell
          .split("const ICONS: Record<string, LucideIcon> = {")[1]
          ?.split("};")[0] ?? "";
      return ADMIN_NAV.every((item) => map.includes(item.icon));
    })(),
  );

  // =========================================================================
  // AUTHORIZATION — server-side, on every new surface
  // =========================================================================

  check(
    "the research list requires ai.read server-side",
    /await requirePermission\("ai\.read"\)/.test(researchPage),
  );
  check(
    "the research detail requires ai.read server-side",
    /await requirePermission\("ai\.read"\)/.test(researchDetail),
  );
  check(
    "cost analytics requires usage.read server-side",
    /await requirePermission\("usage\.read"\)/.test(costsPage),
  );
  check(
    "the guard runs before any data is read on each new page",
    [researchPage, researchDetail, costsPage].every(
      (page) =>
        (page.indexOf("requirePermission") > -1 &&
          page.indexOf("requirePermission") <
            page.indexOf("await Promise.all")) ||
        page.indexOf("requirePermission") <
          page.indexOf("getResearchRunDetail") ||
        page.indexOf("requirePermission") < page.indexOf("getCostBreakdown"),
    ),
  );
  check(
    "no new page relies on hidden navigation for security",
    !/ADMIN_NAV/.test(researchPage + researchDetail + costsPage),
  );
  check(
    "the guard fails closed on an RPC error",
    /if \(error\) return null;/.test(guard),
  );

  // Permission gating is enforced a second time in SQL.
  check(
    "admin_research_stats refuses a non-admin",
    /if not public\.is_admin\(\) then[\s\S]{0,120}insufficient_privilege/.test(
      migration,
    ),
  );
  check(
    "admin_cost_breakdown requires usage.read in SQL",
    /admin_has\('usage\.read'\)[\s\S]{0,200}insufficient_privilege/.test(
      migration,
    ),
  );
  check(
    "research counters are gated on ai.read in SQL",
    /admin_has\('ai\.read'\)[\s\S]{0,200}research_requests/.test(migration),
  );
  check(
    "research credit figures are gated on credits.read in SQL",
    /admin_has\('credits\.read'\)[\s\S]{0,200}research_credits_charged/.test(
      migration,
    ),
  );
  check(
    "both new functions are security definer with a pinned search_path",
    (migration.match(/security definer/g) ?? []).length >= 2 &&
      (migration.match(/set search_path = public/g) ?? []).length >= 2,
  );
  check(
    "anon is granted nothing",
    (migration.match(/revoke all on function[\s\S]{0,120}from anon/g) ?? [])
      .length >= 2,
  );

  // Role reachability: ANALYST is the role that exists to answer cost
  // questions, and must not gain PII or credit sight by doing so.
  check(
    "ANALYST can reach cost analytics",
    ROLE_PERMISSIONS.ANALYST.includes("usage.read"),
  );
  check(
    "ANALYST can reach research operations",
    ROLE_PERMISSIONS.ANALYST.includes("ai.read"),
  );
  check(
    "ANALYST still sees no customer PII",
    !ROLE_PERMISSIONS.ANALYST.includes("users.read"),
  );
  check(
    "ANALYST still sees no credit movements",
    !ROLE_PERMISSIONS.ANALYST.includes("credits.read"),
  );
  check(
    "the research detail gates the owner name on users.read",
    /canSeeOwner = context\.has\("users\.read"\)/.test(researchDetail),
  );
  check(
    "the research detail gates credit figures on credits.read",
    /canSeeCredits = context\.has\("credits\.read"\)/.test(researchDetail),
  );
  check(
    "no permission was added without a migration",
    // Phase 6 adds surfaces, not grants. A new permission string here would
    // have to be seeded in SQL too, and this suite would not catch that.
    !/ADMIN_PERMISSIONS/.test(migration),
  );

  // =========================================================================
  // SQL AGGREGATION — not JavaScript
  // =========================================================================

  check(
    "cost is summed in SQL",
    /sum\(s\.estimated_cost_usd\)/.test(migration) &&
      /sum\(s\.total_tokens\)/.test(migration),
  );
  check(
    "the cost module never aggregates the AI log itself",
    !/from\("ai_usage_logs"\)/.test(costOps),
  );
  check(
    "the cost module calls the SQL aggregate",
    /rpc\("admin_cost_breakdown"/.test(costOps),
  );
  check(
    "the costs page does not query the AI log directly",
    !/ai_usage_logs/.test(costsPage),
  );
  check(
    "research counters are counted in SQL, not fetched and reduced",
    /rpc\("admin_research_stats"/.test(researchOps) &&
      !/from\("research_runs"\)[\s\S]{0,200}reduce\(/.test(researchOps),
  );
  check(
    "money stays numeric through SQL and arrives as text",
    /coalesce\(sum\(s\.estimated_cost_usd\), 0\)::numeric/.test(migration) &&
      /g\.cost::text/.test(migration),
  );
  check(
    "the only JS arithmetic over costs is totalling the rendered page",
    (() => {
      const stripped = code("features/admin/cost-ops.ts");
      const reduces = stripped.match(/\.reduce\(/g) ?? [];
      // Three: cost, requests, tokens — over `rows`, which the SQL already
      // aggregated and limited.
      return reduces.length === 3 && /rows\.reduce/.test(stripped);
    })(),
  );

  // =========================================================================
  // CLIENT PARAMETERS CANNOT RESHAPE A QUERY
  // =========================================================================

  check(
    "the cost dimension is whitelisted in SQL",
    /p_dimension not in \('day', 'provider', 'model', 'workflow', 'feature', 'workspace'\)/.test(
      migration,
    ),
  );
  check(
    "there is no dynamic SQL in the aggregate",
    !/execute\s+format|execute\s+'/.test(migration.toLowerCase()),
  );
  check(
    "the dimension is validated before the RPC too",
    /isCostDimension/.test(costsPage) && /isCostDimension/.test(costOps),
  );
  check(
    "an unknown dimension falls back rather than reaching SQL",
    /isCostDimension\(rawDimension\) \? rawDimension : "day"/.test(costsPage),
  );
  check(
    "a malformed workspace filter is not sent to PostgREST",
    /\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(workspaceId\)/.test(researchPage),
  );
  check(
    // Compared against the CALL site: `getResearchRunDetail` also appears in
    // the import block, which is above everything and says nothing about the
    // order things happen in.
    "a malformed run id 404s before any query",
    /\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(id\)/.test(researchDetail) &&
      researchDetail.indexOf("notFound()") <
        researchDetail.indexOf("await getResearchRunDetail("),
  );
  check(
    "the SQL limit is clamped inside the function",
    /least\(greatest\(coalesce\(p_limit, 30\), 1\), 200\)/.test(migration),
  );

  // Pure: the clamp the admin lists rely on.
  check(
    "an absurd page size is clamped",
    pageParams("1", "100000").pageSize === MAX_PAGE_SIZE,
    String(pageParams("1", "100000").pageSize),
  );
  check("a negative page falls back to the first", pageParams("-5").page === 1);
  check(
    "a non-numeric page falls back to the first",
    pageParams("'; drop table--").page === 1,
  );

  // =========================================================================
  // BOUNDED LISTS AND SERVER-SIDE FILTERING
  // =========================================================================

  check(
    "the research list is paged in the database",
    /\.range\(params\.from, params\.to\)/.test(researchOps),
  );
  check(
    "the research list requests an exact count for pagination",
    /count: "exact"/.test(researchOps),
  );
  check(
    "every research filter is a database predicate",
    [
      '\\.eq\\("status", filters\\.status\\)',
      '\\.eq\\("depth", filters\\.depth\\)',
      '\\.eq\\("current_stage", filters\\.stage\\)',
      '\\.eq\\("workspace_id", filters\\.workspaceId\\)',
      '\\.gte\\("created_at", filters\\.since\\)',
      '\\.lte\\("created_at", filters\\.until\\)',
    ].every((pattern) => new RegExp(pattern).test(researchOps)),
  );
  check(
    "no research filtering happens in React",
    !/\.filter\(/.test(code("app/(admin)/admin/research/page.tsx")),
  );
  check(
    "attempt counts are fetched once for the page, not per row",
    /\.in\("run_id", runIds\)/.test(researchOps) &&
      !/for \([\s\S]{0,80}await supabase/.test(researchOps),
  );
  check(
    "the research list renders pagination controls",
    /<Pagination/.test(researchPage),
  );
  check(
    "facet lists are constants, not a distinct query",
    /export function researchFacets\(\)/.test(researchOps) &&
      !/researchFacets[\s\S]{0,300}await/.test(researchOps),
  );
  check(
    "the stage facet covers all seven stages",
    researchFacets().stages.length === RESEARCH_STAGES.length,
  );

  // =========================================================================
  // INDEXES — justified, not speculative
  // =========================================================================

  check(
    "the AI log gains an index for the admin default ordering",
    /create index if not exists ai_usage_logs_created_idx[\s\S]{0,120}\(created_at desc\)/.test(
      migration,
    ),
  );
  check(
    "the status filter is indexed",
    /ai_usage_logs_status_created_idx[\s\S]{0,120}\(status, created_at desc\)/.test(
      migration,
    ),
  );
  check(
    "the workflow and model filters are indexed",
    /ai_usage_logs_workflow_created_idx/.test(migration) &&
      /ai_usage_logs_model_created_idx/.test(migration),
  );
  check(
    "already-indexed tables are not re-indexed",
    !/create index[^\n]*credit_transactions/.test(migration) &&
      !/create index[^\n]*admin_audit_logs/.test(migration),
  );
  check(
    "no index is created on a research table already covered by 0009",
    !/create index[^\n]*research_runs/.test(migration) &&
      !/create index[^\n]*research_run_stages/.test(migration),
  );

  // =========================================================================
  // NO APPLIED MIGRATION IS TOUCHED, NO WRITE PATH IS OPENED
  // =========================================================================

  check("migration 0013 alters no table", !/alter table/i.test(migration));
  check(
    "migration 0013 drops nothing",
    !/\bdrop (table|policy|function|column)/i.test(migration),
  );
  check(
    "migration 0013 opens no write policy",
    !/create policy/i.test(migration),
  );
  check(
    "migration 0013 does not redefine admin_platform_stats",
    !/function public\.admin_platform_stats/.test(migration),
  );
  check(
    "the new functions are read-only (stable)",
    (migration.match(/\bstable\b/g) ?? []).length >= 2 &&
      !/\bvolatile\b/.test(migration),
  );
  check(
    "Phase 6 adds no destructive admin control",
    !/deleteUser|deleteWorkspace|admin_delete|purge/i.test(
      researchOps + costOps + researchPage + researchDetail + costsPage,
    ),
  );
  check(
    "the research detail offers no stage execution control",
    !/runNextStage|run-stage|regenerateReport|<form/.test(researchDetail),
  );

  // =========================================================================
  // SECRETS AND SERVICE-ROLE
  // =========================================================================

  const allNew =
    researchOps + costOps + researchPage + researchDetail + costsPage;

  check(
    "no service-role key is referenced anywhere in the new code",
    !/SERVICE_ROLE|service_role|createServiceClient/.test(allNew),
  );
  check(
    "the admin panel reads as the caller, under RLS",
    /createClient\(\)/.test(researchOps) && /createClient\(\)/.test(costOps),
  );
  check(
    "stage error text is redacted before display",
    /redactSecrets\(attempt\.errorMessage\)/.test(researchDetail),
  );
  check(
    // The property is that no customer research CONTENT is read from a row —
    // matched on field access, not on the words. A bare /claim/ also matches
    // the phrase "has not been claimed" in an empty-state hint, which is UI
    // copy about stage locking and reports the opposite of the truth.
    "no research content is read into the operations views",
    !/\.structured_content|\.claim\b|\.evidence_reference|research_results|research_evidence|research_sources/.test(
      code("app/(admin)/admin/research/page.tsx") +
        code("app/(admin)/admin/research/[id]/page.tsx") +
        code("features/admin/research-ops.ts"),
    ),
  );
  check("no raw HTML is rendered", !/dangerouslySetInnerHTML/.test(allNew));
  check(
    "no environment variable is read in the new admin code",
    !/process\.env/.test(allNew),
  );

  // =========================================================================
  // HONEST NUMBERS
  // =========================================================================

  check(
    "an omitted metric renders Unavailable rather than zero",
    /typeof value === "number" \? value : null/.test(researchPage) &&
      /typeof value === "number" \? value : null/.test(dashboard),
  );
  check(
    "credit stats on the research page say which grant they need",
    /unavailableNote="Requires credits\.read"/.test(researchPage),
  );
  check(
    "the dashboard adds product output without changing the Sprint 7 cards",
    /Product output/.test(dashboard) &&
      /admin_research_stats|getResearchStats/.test(dashboard) &&
      /getPlatformStats\(\)/.test(dashboard),
  );
  check(
    "the cost page always states the window it is showing",
    /rangeLabel/.test(costsPage) && /Showing/.test(costsPage),
  );
  check(
    "the cost page offers Today / 7 days / 30 days",
    /"Today"/.test(costsPage) &&
      /"7 days"/.test(costsPage) &&
      /"30 days"/.test(costsPage),
  );
  check(
    "cost is labelled a provider estimate, not revenue",
    /not billed revenue|provider's own estimate|Provider estimate/.test(
      costsPage,
    ) && /do not represent revenue or margin/.test(costsPage),
  );
  check(
    "no revenue or margin figure is invented",
    !/revenue:|margin:|profit/i.test(costOps + migration),
  );

  // =========================================================================
  // EMPTY / ERROR STATES
  // =========================================================================

  check(
    "the research list has an empty state",
    /<EmptyState/.test(researchPage),
  );
  check("the cost page has an empty state", /<EmptyState/.test(costsPage));
  check(
    "the research detail handles a run with no executed stage",
    /No stage has executed yet/.test(researchDetail),
  );
  check(
    "a failed query degrades to an empty page rather than throwing",
    /if \(error\) return paged<ResearchOpsRow>\(\[\], 0, params\)/.test(
      researchOps,
    ) && /if \(error \|\| !data\) return empty/.test(costOps),
  );
  check("no raw database error reaches the UI", !/error\.message/.test(allNew));

  // =========================================================================
  // PURE — dimensions and formatting
  // =========================================================================

  check("six cost dimensions", COST_DIMENSIONS.length === 6);
  check(
    "every dimension has a label",
    COST_DIMENSIONS.every((d) => Boolean(DIMENSION_LABELS[d])),
  );
  check(
    "every dimension is accepted by the SQL whitelist",
    COST_DIMENSIONS.every((d) => migration.includes(`'${d}'`)),
  );
  check("a known dimension validates", isCostDimension("workspace"));
  check("an unknown dimension is refused", !isCostDimension("secret"));
  check("a non-string dimension is refused", !isCostDimension(42));
  check(
    "cost formatting keeps sub-cent precision",
    formatCost("0.000123") === "$0.000123",
    formatCost("0.000123"),
  );
  check(
    "larger costs round to four places",
    formatCost("12.3456789") === "$12.3457",
    formatCost("12.3456789"),
  );
  check("a null cost renders a dash", formatCost(null) === "—");
  check("a non-numeric cost renders a dash", formatCost("abc") === "—");

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — ADMIN OPS SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(`\n${total}/${total} checks passed — ADMIN OPS SMOKE PASSED`);
}

main();
