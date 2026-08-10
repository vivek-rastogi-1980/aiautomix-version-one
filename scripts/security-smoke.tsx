/**
 * Security and authorization regression tests (Sprint 5.5, Phase 8).
 *
 * The existing suites cover the AI engine, report model and PDF output. Nothing
 * covered authorization, workspace isolation or the security-critical pure
 * functions — which is where a silent regression is most expensive, because a
 * broken authorization check does not throw. It just lets someone through.
 *
 * Everything here runs without a database, network or API key, so it stays in
 * the default `npm test` path rather than becoming a suite nobody runs.
 *
 * The one test that could not exist without reading the filesystem is the
 * role-parity check: it parses migration 0004 and asserts the TypeScript role
 * predicates match the SQL. `features/workspaces/roles.ts` documents that the
 * database is the enforcement point and "if these two ever disagree, the SQL
 * wins and this file is the bug" — this makes that a failing test rather than a
 * comment nobody re-reads.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { canEdit, canManage } from "@/features/workspaces/roles";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types/database";
import { safeRedirectPath } from "@/lib/site";
import { toPdfFilename } from "@/features/ai/pdf/filename";
import { rateLimit } from "@/lib/rate-limit";
import { leadSchema } from "@/lib/validations/lead";
import { PRIVATE_PREFIXES, PUBLIC_ROUTES } from "@/lib/seo/routes";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  const status = condition ? "PASS" : "FAIL";
  if (!condition) failures += 1;
  results.push(`${status} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Pull the role list out of a `security definer` SQL helper in migration 0004. */
function sqlRolesFor(sql: string, fn: string): string[] {
  const body = sql.split(`function public.${fn}(`)[1] ?? "";
  const match = body.slice(0, 400).match(/in \(([^)]*)\)/);
  if (!match) return [];
  return [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

function main(): void {
  // --- Workspace role parity: TypeScript must mirror the SQL ---------------
  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/0004_sprint5_workspaces_and_plans.sql",
    ),
    "utf8",
  );

  const sqlEditRoles = sqlRolesFor(migration, "can_edit_workspace");
  const tsEditRoles = WORKSPACE_ROLES.filter((role) => canEdit(role));

  check(
    "can_edit_workspace roles match the SQL",
    sqlEditRoles.length > 0 &&
      sqlEditRoles.slice().sort().join(",") ===
        tsEditRoles.slice().sort().join(","),
    `sql=[${sqlEditRoles}] ts=[${tsEditRoles}]`,
  );

  // Viewer is the whole point of the role model: read-only must stay read-only.
  check("viewer cannot edit", canEdit("viewer") === false);
  check("viewer cannot manage", canManage("viewer") === false);
  check("member can edit", canEdit("member") === true);
  check("member cannot manage", canManage("member") === false);
  check("admin can manage", canManage("admin") === true);
  check("owner can manage", canManage("owner") === true);

  // A null role means "not a member of this workspace". Treating that as
  // permissive would grant edit rights to any authenticated stranger.
  check("null role cannot edit", canEdit(null) === false);
  check("null role cannot manage", canManage(null) === false);

  // Guards against a role being added to the enum but not considered here.
  const unknown = "superuser" as WorkspaceRole;
  check("unknown role cannot edit", canEdit(unknown) === false);
  check("unknown role cannot manage", canManage(unknown) === false);

  // --- Open redirect -------------------------------------------------------
  // `redirectTo` is attacker-controllable via the login URL.
  check(
    "protocol-relative URL rejected",
    safeRedirectPath("//evil.com") === "/dashboard",
  );
  check(
    "absolute URL rejected",
    safeRedirectPath("https://evil.com") === "/dashboard",
  );
  check(
    "backslash-prefixed URL rejected",
    safeRedirectPath("\\\\evil.com") === "/dashboard",
  );
  check("null falls back", safeRedirectPath(null) === "/dashboard");
  check("empty string falls back", safeRedirectPath("") === "/dashboard");
  check(
    "legitimate internal path preserved",
    safeRedirectPath("/plans/abc") === "/plans/abc",
  );

  // --- Content-Disposition header injection --------------------------------
  // The plan title is user-supplied and lands in a response header.
  const nasty = toPdfFilename(
    'evil"; attachment; filename="hack.exe',
    "report",
  );
  check("filename strips quotes", !nasty.includes('"'), nasty);
  check("filename strips semicolons", !nasty.includes(";"), nasty);
  check("filename is slug-safe", /^[a-z0-9-]+\.pdf$/.test(nasty), nasty);
  check("CRLF stripped", !/[\r\n]/.test(toPdfFilename("a\r\nb", "report")));
  check(
    "empty title falls back",
    toPdfFilename("", "report") === "aiautomix-report.pdf",
    toPdfFilename("", "report"),
  );
  check(
    "path traversal neutralised",
    !toPdfFilename("../../etc/passwd", "report").includes(".."),
  );

  // --- Rate limiting -------------------------------------------------------
  const key = `test:${Date.now()}`;
  const allowed = Array.from({ length: 3 }, () => rateLimit(key, 3, 60_000));
  check(
    "requests within budget succeed",
    allowed.every((r) => r.success),
  );
  const blocked = rateLimit(key, 3, 60_000);
  check("request over budget blocked", blocked.success === false);
  check(
    "blocked response carries a retry delay",
    blocked.retryAfterSeconds > 0,
    `${blocked.retryAfterSeconds}s`,
  );
  check(
    "limits are per-key, not global",
    rateLimit(`${key}:other`, 3, 60_000).success === true,
  );

  // --- Lead intake ---------------------------------------------------------
  check(
    "lead rejects malformed email",
    leadSchema.safeParse({ email: "nope", source: "contact" }).success ===
      false,
  );
  check(
    "lead rejects unknown source",
    leadSchema.safeParse({ email: "a@b.com", source: "evil" }).success ===
      false,
  );
  check(
    "lead accepts a minimal valid submission",
    leadSchema.safeParse({ email: "a@b.com", source: "contact" }).success ===
      true,
  );

  // Regression: the honeypot must PASS validation so the route can discard it
  // silently. An earlier version used `.max(0)`, which returned a 422 naming
  // `website` — telling a bot exactly which field to leave alone next time.
  const trapped = leadSchema.safeParse({
    email: "bot@spam.com",
    source: "contact",
    website: "http://spam.example",
  });
  check(
    "honeypot value passes validation (discarded by the route, not rejected)",
    trapped.success === true,
  );
  check(
    "honeypot value is preserved for the route to inspect",
    trapped.success === true && trapped.data.website === "http://spam.example",
  );

  check(
    "oversized message rejected",
    leadSchema.safeParse({
      email: "a@b.com",
      source: "contact",
      message: "x".repeat(5000),
    }).success === false,
  );

  // --- SEO surface consistency ---------------------------------------------
  // A public route that is also disallowed in robots.txt is a crawl error; a
  // private route missing from the disallow list leaks crawl budget. Both files
  // read this module, so the invariant is testable.
  const conflicts = PUBLIC_ROUTES.filter((route) =>
    PRIVATE_PREFIXES.some((prefix) => route.path.startsWith(prefix)),
  );
  check(
    "no sitemap route is disallowed by robots",
    conflicts.length === 0,
    conflicts.map((c) => c.path).join(", "),
  );
  check(
    "every private area has a disallow prefix",
    ["/dashboard", "/settings", "/api/", "/login"].every((p) =>
      PRIVATE_PREFIXES.some((prefix) => p.startsWith(prefix)),
    ),
  );
  check(
    "robots does not block rendering assets",
    !PRIVATE_PREFIXES.some((p) => p.startsWith("/_next") || p === "/assets"),
  );

  // --- Report -------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  const passed = total - failures;

  if (failures > 0) {
    console.error(`\n${passed}/${total} checks passed — SECURITY SMOKE FAILED`);
    process.exit(1);
  }
  console.log(`\n${passed}/${total} checks passed — SECURITY SMOKE PASSED`);
}

main();
