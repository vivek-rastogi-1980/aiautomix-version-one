/**
 * Client Onboarding & Lead Conversion tests.
 *
 * The properties that would be expensive to get wrong, made falsifiable:
 *
 *   TEMPLATE   No eval, no code execution, a closed variable vocabulary, HTML
 *              escaped, dangerous URL schemes refused. This is the one place an
 *              admin-authored string meets the server.
 *   PASSWORDS  No column, no field and no code path stores one.
 *   IDEMPOTENT Keys are derived, not generated; a resubmit collides.
 *   RLS        Leads are not globally readable. Email logs are admin-only.
 *   RBAC       Every new permission exists in both TypeScript and SQL.
 *   PUBLIC API Rate limited, honeypotted, body-capped, no stack traces.
 *   HONESTY    A trigger claimed as "wired" is actually raised somewhere.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  PREVIEW_CONTEXT,
  TEMPLATE_VARIABLES,
  escapeHtml,
  isTemplateVariable,
  isUrlVariable,
  previewTemplate,
  renderTemplate,
  safeUrl,
  validateTemplate,
} from "@/features/communications/template-engine";
import {
  COMMUNICATION_EVENTS,
  EMAIL_TRIGGERS,
  EVENT_TO_TRIGGER,
  TEMPLATE_STATUSES,
  TRIGGER_STATUS,
  isEmailTrigger,
  isTemplateStatus,
  wiredTriggers,
} from "@/features/communications/events";
import {
  bookingIdempotencyKey,
  leadIdempotencyKey,
} from "@/features/onboarding/provisioning";
import {
  BUSINESS_STAGES,
  bookingSchema,
  validateIdeaSchema,
} from "@/lib/validations/onboarding";
import {
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from "@/features/admin/permissions";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

function eq(name: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  check(
    name,
    ok,
    ok ? "" : `expected ${String(expected)}, got ${String(actual)}`,
  );
}

function read(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

/** Source with comments removed, so prose cannot satisfy a structural test. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function main(): void {
  const migration = read("supabase/migrations/0019_client_onboarding.sql");
  const leadsMigration = read("supabase/migrations/0005_leads.sql");
  const engine = read("features/communications/template-engine.ts");
  const service = read("features/communications/service.ts");
  const provisioning = read("features/onboarding/provisioning.ts");
  const ideaRoute = read("app/api/onboarding/validate-idea/route.ts");
  const bookingRoute = read("app/api/onboarding/bookings/route.ts");
  const validations = read("lib/validations/onboarding.ts");
  const mailer = read("features/communications/mailer.ts");
  const ideaPage = read(
    "features/solutions/validate-your-idea/validate-your-idea-view.tsx",
  );
  const ideaSubmit = read("lib/leads/submit-idea.ts");
  const funnelEvents = read("features/onboarding/funnel-events.ts");
  const funnelData = read("features/dashboard/funnel-data.ts");
  const ideaPanel = read("features/dashboard/idea-panel.tsx");
  const bookingForm = read("features/onboarding/booking-form.tsx");
  const reportPage = read("app/(dashboard)/reports/[id]/page.tsx");
  const pdfRoute = read("app/api/reports/[id]/pdf/route.tsx");
  const ownershipMigration = read(
    "supabase/migrations/0022_booking_lead_ownership.sql",
  );
  const contentMigration = read(
    "supabase/migrations/0020_email_template_content.sql",
  );
  // Every file permitted to raise a communication event. The honesty check
  // below scans exactly these, so adding a caller elsewhere and forgetting to
  // list it here shows up as a trigger that claims to be wired and is not.
  const eventCallSites = [
    ideaRoute,
    bookingRoute,
    read("features/onboarding/activation.ts"),
    read("features/onboarding/validation-events.ts"),
    read("features/admin/actions.ts"),
  ].map(code);

  const featureSources = [engine, service, provisioning].join("\n");
  const routes = [ideaRoute, bookingRoute];

  // =========================================================================
  // TEMPLATE ENGINE SECURITY
  // =========================================================================

  check(
    "the engine never evaluates a template as code",
    !/\beval\s*\(|new\s+Function|vm\.runIn|require\s*\(\s*["']vm/.test(
      code(engine),
    ),
    "eval, new Function and vm are all absent",
  );
  check(
    "the engine performs no dynamic import",
    !/import\s*\(/.test(code(engine)),
  );
  check(
    "the engine reaches no network and no filesystem",
    !/fetch\(|readFile|writeFile|child_process/.test(code(engine)),
  );

  // --- Closed vocabulary ---------------------------------------------------
  check(
    "every declared variable is recognised",
    TEMPLATE_VARIABLES.every((variable) => isTemplateVariable(variable.key)),
  );
  check(
    "an invented variable is refused",
    !isTemplateVariable("user.password") &&
      !isTemplateVariable("process.env.SMTP_PASS"),
  );
  check(
    "an unknown variable fails validation rather than rendering blank",
    (() => {
      const result = validateTemplate("Hello {{user.frist_name}}");
      return !result.ok && result.issues[0]!.variable === "user.frist_name";
    })(),
    "a typo must be caught at save time, not discovered by ten thousand recipients",
  );
  check(
    "a valid template passes validation",
    validateTemplate("Hi {{user.first_name}}, score {{validation.score}}").ok,
  );
  check(
    "a malformed placeholder is reported",
    !validateTemplate("Hello {{user.first name}}").ok,
  );
  check(
    "validation reports which variables a template uses",
    validateTemplate("{{user.first_name}} {{dashboard_url}}")
      .used.sort()
      .join(",") === "dashboard_url,user.first_name",
  );

  // --- Escaping ------------------------------------------------------------
  eq(
    "escapeHtml neutralises a script tag",
    escapeHtml("<script>alert(1)</script>"),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
  eq("escapeHtml handles quotes", escapeHtml(`"'`), "&quot;&#39;");
  check(
    "INJECTION: a business idea containing markup renders as text",
    (() => {
      const rendered = renderTemplate(
        "<p>{{business_idea.title}}</p>",
        { "business_idea.title": "<img src=x onerror=alert(1)>" },
        { html: true },
      );
      return (
        !rendered.output.includes("<img") && rendered.output.includes("&lt;img")
      );
    })(),
    "a visitor can type this into a public form",
  );
  check(
    "INJECTION: a name containing a tag cannot break out of the subject",
    !renderTemplate(
      "Welcome {{user.first_name}}",
      { "user.first_name": "</title><script>x</script>" },
      { html: true },
    ).output.includes("<script>"),
  );

  // --- URL schemes ---------------------------------------------------------
  eq(
    "safeUrl accepts https",
    safeUrl("https://example.com/a"),
    "https://example.com/a",
  );
  eq("safeUrl rejects javascript:", safeUrl("javascript:alert(1)"), null);
  eq(
    "safeUrl rejects data:",
    safeUrl("data:text/html,<script>x</script>"),
    null,
  );
  eq("safeUrl rejects vbscript:", safeUrl("vbscript:msgbox"), null);
  eq("safeUrl rejects nonsense", safeUrl("not a url"), null);
  check(
    "INJECTION: a javascript: URL in a link variable is dropped, not rendered",
    (() => {
      const rendered = renderTemplate(
        '<a href="{{dashboard_url}}">Open</a>',
        { dashboard_url: "javascript:alert(1)" },
        { html: true },
      );
      return (
        !rendered.output.includes("javascript:") &&
        rendered.rejectedUrls.includes("dashboard_url")
      );
    })(),
    "escaping alone does nothing to a dangerous scheme",
  );
  check(
    "URL variables are marked as such",
    isUrlVariable("dashboard_url") &&
      isUrlVariable("validation.report_url") &&
      !isUrlVariable("user.first_name"),
  );
  check(
    "a plain-text body still refuses a dangerous scheme",
    !renderTemplate(
      "Open {{dashboard_url}}",
      { dashboard_url: "javascript:x" },
      {
        html: false,
      },
    ).output.includes("javascript:"),
    "mail clients linkify plain text",
  );

  // --- Rendering behaviour -------------------------------------------------
  eq(
    "a known variable is substituted",
    renderTemplate(
      "Hi {{user.first_name}}",
      { "user.first_name": "Ada" },
      {
        html: true,
      },
    ).output,
    "Hi Ada",
  );
  check(
    "an unknown placeholder is left verbatim rather than blanked",
    renderTemplate("Hi {{oops}}", {}, { html: true }).output === "Hi {{oops}}",
    "a visible bug gets fixed; a silent empty string ships",
  );
  check(
    "a missing value is reported",
    renderTemplate(
      "Hi {{user.first_name}}",
      {},
      { html: true },
    ).missing.includes("user.first_name"),
  );

  // --- Preview -------------------------------------------------------------
  check(
    "preview uses obviously fictional data",
    PREVIEW_CONTEXT["user.email"].includes("example.com") &&
      PREVIEW_CONTEXT["business_idea.title"].length > 10,
  );
  check(
    "every variable has a preview value, so a preview never shows a hole",
    TEMPLATE_VARIABLES.every(
      (variable) => PREVIEW_CONTEXT[variable.key] !== undefined,
    ),
  );
  check(
    "preview renders both subject and body",
    (() => {
      const preview = previewTemplate(
        "Score {{validation.score}}/100",
        "<p>Hello {{user.first_name}}</p>",
      );
      return (
        preview.subject === "Score 78/100" &&
        preview.bodyHtml.includes("Vivek") &&
        preview.missing.length === 0
      );
    })(),
  );
  check(
    "no preview value looks like a real person's data",
    !JSON.stringify(PREVIEW_CONTEXT).includes("@aiautomix.com"),
  );

  // =========================================================================
  // PASSWORDS — the absolute rule
  // =========================================================================

  check(
    "no migration column could hold a password",
    (() => {
      const ddl = migration.replace(/--.*$/gm, "");
      const columns = [...ddl.matchAll(/^ {2}([a-z_]+) {2,}/gm)].map(
        (match) => match[1]!,
      );
      return (
        columns.length > 30 &&
        !columns.some((column) =>
          /password|passwd|secret|token|credential/.test(column),
        )
      );
    })(),
    "the schema has nowhere to put one",
  );
  check(
    "no onboarding source generates or stores a password",
    !/temporary_password|plaintext|generatePassword|randomPassword/i.test(
      featureSources + routes.join("\n"),
    ),
  );
  check(
    "provisioning uses the provider's one-time link, not a generated credential",
    /generateLink/.test(provisioning) &&
      /type,\s*$|\["magiclink", "invite"\]/m.test(provisioning),
    "Supabase mints the link; no password is ever created",
  );
  // This invariant USED to be "no service-role client exists anywhere". It
  // cannot be that any more: delivering the activation link over the
  // application's own SMTP requires `auth.admin.generateLink`, which is an
  // admin API. Relying on Supabase to send it instead was tried and failed in
  // production — a two-per-hour cap on the built-in mailer meant real visitors
  // received a confirmation email containing no link at all.
  //
  // So the invariant is narrowed rather than dropped: the key is read in
  // exactly ONE audited module, and no feature source may reach for it. That
  // still fails the moment somebody adds a second caller, which is the
  // property worth keeping.
  check(
    "no feature source reads the service-role key",
    ![provisioning, service, ideaRoute, bookingRoute, engine].some((source) =>
      /SERVICE_ROLE|service_role/.test(code(source)),
    ),
    "only lib/supabase/admin.ts may, and only to mint a link",
  );
  check(
    "the service-role key is read in exactly one module",
    (() => {
      const roots = ["app", "features", "lib"];
      const hits: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.tsx?$/.test(entry.name)) {
            if (/SUPABASE_SERVICE_ROLE_KEY/.test(readFileSync(full, "utf8"))) {
              hits.push(full.split(path.sep).join("/"));
            }
          }
        }
      };
      roots.forEach(walk);
      return hits.length === 1 && hits[0]!.endsWith("lib/supabase/admin.ts");
    })(),
    "a second reader is a real widening of the blast radius",
  );
  check(
    "the admin client is server-only and never persists a session",
    (() => {
      const admin = read("lib/supabase/admin.ts");
      return (
        /import "server-only"/.test(admin) &&
        /persistSession:\s*false/.test(admin) &&
        /autoRefreshToken:\s*false/.test(admin)
      );
    })(),
  );
  check(
    "the activation path never reveals whether an email is registered",
    /enumeration/i.test(provisioning),
    "always reports success, like requestPasswordResetAction",
  );

  // =========================================================================
  // IDEMPOTENCY
  // =========================================================================

  eq(
    "a lead key is derived from source and normalised email",
    leadIdempotencyKey("Ada@Example.COM ", "idea-validation"),
    "lead:idea-validation:ada@example.com",
  );
  check(
    "the same submission derives the same key",
    leadIdempotencyKey("a@b.com", "idea-validation") ===
      leadIdempotencyKey("A@B.COM", "idea-validation"),
    "case and whitespace must not create a second lead",
  );
  check(
    "a different funnel derives a different key",
    leadIdempotencyKey("a@b.com", "idea-validation") !==
      leadIdempotencyKey("a@b.com", "strategy-session"),
  );
  eq(
    "a booking key is the person plus the slot",
    bookingIdempotencyKey("A@B.com", "2026-03-12T15:00:00.000Z"),
    "booking:a@b.com:2026-03-12T15:00:00.000Z",
  );
  check(
    "a different slot is a different booking",
    bookingIdempotencyKey("a@b.com", "2026-03-12T15:00:00.000Z") !==
      bookingIdempotencyKey("a@b.com", "2026-03-13T15:00:00.000Z"),
  );
  check(
    "the lead key column is UNIQUE, so a resubmit collides in the database",
    /leads_idempotency_key_idx[\s\S]{0,120}unique|unique index[\s\S]{0,80}leads \(idempotency_key\)/i.test(
      migration,
    ) ||
      /create unique index if not exists leads_idempotency_key_idx/.test(
        migration,
      ),
  );
  check(
    "the booking key column is UNIQUE too",
    /create unique index if not exists bookings_idempotency_key_idx/.test(
      migration,
    ),
  );
  check(
    "lead_capture returns the existing row rather than inserting a second",
    /was_existing/.test(migration) &&
      /select id into v_id from public\.leads[\s\S]{0,80}idempotency_key/.test(
        migration,
      ),
  );
  check(
    "both public routes derive their key server-side",
    routes.every((route) => /IdempotencyKey\(/.test(route)),
  );
  check(
    "and no request schema has a field a client could supply one through",
    !/idempotency/i.test(code(validations)),
    "a client-supplied key is a client-supplied duplicate",
  );

  // =========================================================================
  // PUBLIC ENDPOINT PROTECTION
  // =========================================================================

  for (const [name, route] of [
    ["validate-idea", ideaRoute],
    ["bookings", bookingRoute],
  ] as const) {
    check(`the ${name} route rate-limits per IP`, /rateLimit\(/.test(route));
    check(
      `the ${name} route caps the body BEFORE parsing`,
      (() => {
        const source = code(route);
        const cap = source.indexOf("MAX_BODY_BYTES");
        const parse = source.indexOf("JSON.parse");
        return cap !== -1 && parse !== -1 && cap < parse;
      })(),
    );
    check(`the ${name} route has a honeypot`, /company_website/.test(route));
    check(
      `the ${name} route validates server-side with Zod`,
      /safeParse/.test(route),
    );
    check(
      `the ${name} route leaks no internal detail on failure`,
      !/error\.message|error\.stack|JSON\.stringify\(error/.test(code(route)),
      "§20 forbids stack traces and database errors reaching a user",
    );
    check(
      `the ${name} route commits durably before attempting email`,
      (() => {
        const source = code(route);
        // The durable write is either the RPC directly, or `captureLead`, which
        // wraps it and adds the fallback for a database without 0019 applied.
        // Either way it must come BEFORE any attempt to send mail.
        const persist = [
          source.indexOf("supabase.rpc("),
          source.indexOf("captureLead("),
        ].filter((index) => index !== -1);
        // The CALL site, not the import above it. The send now lives inside
        // an `after` callback, so that is what has to come second.
        const email = source.indexOf("after(async () =>");
        return (
          persist.length > 0 && email !== -1 && Math.min(...persist) < email
        );
      })(),
      "a provider outage must cost a notification, never the lead",
    );
    check(
      `the ${name} route sends inside after(), not as a floating promise`,
      /import \{ after[,}]/.test(route) &&
        /after\(async \(\) => \{[\s\S]{0,200}emitCommunicationEvent\(/.test(
          code(route),
        ) &&
        !/void emitCommunicationEvent\(/.test(code(route)),
      "a bare void promise is killed when the serverless response returns — " +
        "verified in production: a lead written, zero email_logs rows",
    );
    check(
      `the ${name} route mints the activation link itself`,
      /createActivationLink\(/.test(code(route)) &&
        /activation_url:/.test(code(route)),
      "Supabase's own mailer caps at two an hour and silently sent nothing",
    );
  }

  // =========================================================================
  // ACTIVATION LINKS SURVIVE A MAIL SCANNER
  // =========================================================================
  //
  // The activation link used to point at /auth/confirm, which verifies on GET.
  // Verification is single-use and mail providers prefetch links to scan them,
  // so the scanner spent the token and the recipient was told the link was
  // invalid or expired. These lock in the fix.

  check(
    "the activation link lands on /register, not on a route that verifies on GET",
    /\/register`\)/.test(code(provisioning)) &&
      !/\/auth\/confirm`\)/.test(code(provisioning)),
    "a GET must not be able to spend the token — mail scanners prefetch",
  );
  check(
    "the link carries the token plus prefill for the name and address",
    (() => {
      const source = code(provisioning);
      return ["token_hash", "type", "email", "name"].every((key) =>
        source.includes(`searchParams.set("${key}"`),
      );
    })(),
  );
  check(
    "the token is exchanged in a server action, on submit",
    (() => {
      const actions = code(read("features/auth/actions.ts"));
      const index = actions.indexOf("activateAccountAction");
      return index !== -1 && /verifyOtp\(/.test(actions.slice(index));
    })(),
  );
  check(
    "the register page reads the token but never verifies it",
    (() => {
      const page = code(read("app/(auth)/register/page.tsx"));
      return (
        /token_hash/.test(page) && !/verifyOtp|completeActivation/.test(page)
      );
    })(),
    "verifying during render would put it back on the GET",
  );
  check(
    "activation never calls signUp, so no confirmation email is sent",
    (() => {
      const actions = code(read("features/auth/actions.ts"));
      const start = actions.indexOf(
        "export async function activateAccountAction",
      );
      const body = actions.slice(start);
      return start !== -1 && !/signUp\(/.test(body);
    })(),
    "the emailed token already proves the address",
  );
  check(
    "the activation form takes no email — the token settles the account",
    (() => {
      const auth = read("lib/validations/auth.ts");
      const start = auth.indexOf("activateAccountSchema");
      const body = auth.slice(start, auth.indexOf("});", start));
      return start !== -1 && !/email/.test(body);
    })(),
    "accepting one would imply the form could change which account is claimed",
  );
  check(
    "password setup is cleared AFTER the password is set, not before",
    (() => {
      const actions = code(read("features/auth/actions.ts"));
      const start = actions.indexOf(
        "export async function activateAccountAction",
      );
      const body = actions.slice(start);
      const update = body.indexOf("updateUser(");
      const clear = body.indexOf("password_setup_required");
      return update !== -1 && clear !== -1 && update < clear;
    })(),
    "otherwise a failed update leaves somebody with no password and no prompt",
  );
  check(
    "the honeypot answers success so a bot learns nothing",
    /company_website\)\s*\{[\s\S]{0,200}apiSuccess/.test(ideaRoute),
  );

  // =========================================================================
  // NO AI SPEND FOR AN UNVERIFIED EMAIL
  // =========================================================================

  check(
    "the public funnel starts no AI workflow",
    !routes.some((route) => /runWorkflow|features\/ai\/engine/.test(route)),
    "provisioning for an unverified address is how a form becomes a bill",
  );
  check(
    "lead_capture creates no auth user, workspace or business idea",
    (() => {
      const fn = migration.slice(
        migration.indexOf("create or replace function public.lead_capture"),
        migration.indexOf(
          "create or replace function public.lead_claim_for_user",
        ),
      );
      return (
        !/insert into public\.workspaces/.test(fn) &&
        !/insert into public\.business_ideas/.test(fn) &&
        !/auth\.users/.test(fn)
      );
    })(),
  );
  check(
    "and the reason is written down rather than assumed",
    /unverified/i.test(migration) && /unverified/i.test(provisioning),
  );

  // =========================================================================
  // RLS AND PRIVACY
  // =========================================================================

  check(
    "0005's anonymous-insert-only shape is preserved, not widened",
    /Anyone can submit a lead/.test(leadsMigration) &&
      !/for select[\s\S]{0,40}to anon/.test(migration),
    "leads must not become globally readable",
  );
  check(
    "a signed-in user reads only their OWN lead",
    /on public\.leads for select[\s\S]{0,120}user_id = auth\.uid\(\)/.test(
      migration,
    ),
  );
  check(
    "admins read leads through a permission, not a bypass",
    /admin_has\('leads\.read'\)/.test(migration),
  );
  check(
    "email logs are admin-only — never user-readable",
    /on public\.email_logs for select[\s\S]{0,80}admin_has\('communications\.read'\)/.test(
      migration,
    ) &&
      !/on public\.email_logs for select[\s\S]{0,80}auth\.uid\(\)/.test(
        migration,
      ),
  );
  check(
    "lead_events are admin-only",
    /on public\.lead_events for select[\s\S]{0,80}admin_has\('leads\.read'\)/.test(
      migration,
    ),
  );
  check(
    "a user reads only their own bookings",
    /on public\.bookings for select[\s\S]{0,120}user_id = auth\.uid\(\)/.test(
      migration,
    ),
  );
  check(
    "RLS is enabled on every new table",
    (migration.match(/enable row level security/g) ?? []).length === 5,
  );
  check(
    "there is no client insert or update policy on any new table",
    !/create policy[\s\S]{0,200}on public\.(lead_events|bookings|email_\w+)[\s\S]{0,60}for (insert|update)/i.test(
      migration.replace(/--.*$/gm, ""),
    ),
  );
  check(
    "no migration and no feature source reaches for the service role",
    !/SERVICE_ROLE|service_role/.test(
      migration.replace(/--.*$/gm, "") + code(featureSources),
    ),
    "the one permitted reader is lib/supabase/admin.ts, asserted above",
  );

  // =========================================================================
  // TEMPLATE VERSIONING — history is immutable
  // =========================================================================

  check(
    "template versions cannot be updated or deleted",
    /email_template_versions_no_update/.test(migration) &&
      /email_template_versions_no_delete/.test(migration) &&
      /reject_audit_mutation/.test(migration),
    "reusing 0008's trigger rather than a second mechanism",
  );
  check(
    "saving always creates a new version",
    /coalesce\(max\(version\), 0\) \+ 1/.test(migration),
  );
  check(
    "an email log references the VERSION, not just the template",
    /template_version_id/.test(migration),
    "otherwise 'what did we send them?' stops being answerable",
  );
  check(
    "only one template can be ACTIVE per trigger",
    /create unique index if not exists email_templates_active_trigger_idx/.test(
      migration,
    ),
  );
  check(
    "activating a template deactivates its rivals",
    /set status = 'DRAFT'[\s\S]{0,120}status = 'ACTIVE'/.test(migration),
  );
  check(
    "a template with no content cannot be activated",
    /save some content before activating/.test(migration),
  );
  check(
    "all fifteen templates are seeded",
    (() => {
      const seed = migration.slice(
        migration.indexOf("insert into public.email_templates"),
      );
      return EMAIL_TRIGGERS.every((trigger) => seed.includes(`'${trigger}'`));
    })(),
  );
  check(
    "and every one is seeded as DRAFT",
    (() => {
      const seed = migration.slice(
        migration.indexOf("insert into public.email_templates (trigger"),
        migration.indexOf("-- 18. Admin funnel metrics"),
      );
      return !seed.includes("'ACTIVE'");
    })(),
    "a migration must not start emailing customers",
  );

  // =========================================================================
  // TEST SENDS MUST NOT LOOK LIKE CUSTOMER COMMUNICATION
  // =========================================================================

  check("a test send is flagged in the log", /is_test/.test(migration));
  check(
    "and never writes to a lead's timeline",
    (() => {
      // Asserts the PROPERTY, not one spelling of it. The guard grew a second
      // clause when `email_log_record` was hardened against timeline forgery;
      // matching the old single-line condition would have failed a function
      // that had become stricter, which is the wrong direction for a test to
      // push.
      const start = migration.indexOf(
        "create or replace function public.email_log_record(",
      );
      const body = migration.slice(start, start + 5000);
      const guard = body.indexOf("not p_is_test");
      const insert = body.indexOf("insert into public.lead_events");
      return guard !== -1 && insert !== -1 && guard < insert;
    })(),
    "§23: a test triggers no business automation",
  );

  // =========================================================================
  // EVENT MODEL
  // =========================================================================

  eq("ten communication events", COMMUNICATION_EVENTS.length, 10);
  eq("fifteen email triggers", EMAIL_TRIGGERS.length, 15);
  check(
    "every event maps to a real trigger",
    COMMUNICATION_EVENTS.every((event) =>
      isEmailTrigger(EVENT_TO_TRIGGER[event]),
    ),
  );
  check(
    "every trigger has a wiring status and an explanation",
    EMAIL_TRIGGERS.every(
      (trigger) =>
        TRIGGER_STATUS[trigger] && TRIGGER_STATUS[trigger].note.length > 20,
    ),
  );
  check(
    "a known status validates, an invented one does not",
    isTemplateStatus("ACTIVE") && !isTemplateStatus("SENT"),
  );
  eq("three template statuses", TEMPLATE_STATUSES.length, 3);

  /**
   * THE honesty check. §"Email template types" forbids pretending an automation
   * exists.
   *
   * This used to assert only that a wired trigger MAPPED to an event in
   * `EVENT_TO_TRIGGER` — which every trigger does by construction, so the check
   * passed while six triggers claimed to be wired with no caller anywhere in
   * the codebase. A test that cannot fail is worse than no test: it converts an
   * unexamined claim into an apparently-verified one.
   *
   * So the source is scanned. A trigger is wired if and only if some file in
   * `eventCallSites` raises an event that maps to it. Both directions are
   * asserted, because the failure that actually happened was an over-claim.
   */
  /**
   * An event counts as raised when some file BOTH calls the communication
   * service AND names that event as a string literal.
   *
   * Two conditions rather than one because not every caller passes a literal
   * directly to `emitCommunicationEvent`. `validation-events.ts` dispatches
   * through a shared `raise()` helper, so the literal appears at `raise(...)`
   * and at the helper's parameter type instead — matching only
   * `emitCommunicationEvent("X"` would report four genuinely-wired triggers as
   * unwired, which is the same class of lie in the other direction.
   *
   * The known limit, stated rather than papered over: a file that calls the
   * service and merely MENTIONS an unrelated event name in a string would count
   * it as raised. That is a much smaller hole than the one this replaced — a
   * check that could not fail at all — and it still catches the failure that
   * actually occurred, where six triggers claimed wiring and no file named them
   * anywhere.
   */
  const raisedEvents = new Set(
    COMMUNICATION_EVENTS.filter((event) =>
      eventCallSites.some(
        (source) =>
          source.includes("emitCommunicationEvent(") &&
          (source.includes(`"${event}"`) || source.includes(`'${event}'`)),
      ),
    ),
  );
  const raisedTriggers = new Set(
    [...raisedEvents].map((event) => EVENT_TO_TRIGGER[event]),
  );

  check(
    "something actually raises at least one event",
    raisedEvents.size > 0,
    [...raisedEvents].join(", "),
  );

  for (const trigger of EMAIL_TRIGGERS) {
    const claimed = TRIGGER_STATUS[trigger].wired;
    const actual = raisedTriggers.has(trigger);
    check(
      `'${trigger}' wiring claim matches the source`,
      claimed === actual,
      claimed === actual
        ? ""
        : claimed
          ? "claims wired, but no call site raises it"
          : "is raised in the source but claims to be unwired",
    );
  }
  check(
    "the two reminders are honestly marked unwired — nothing runs on a timer",
    !TRIGGER_STATUS.BOOKING_REMINDER_24H.wired &&
      !TRIGGER_STATUS.BOOKING_REMINDER_1H.wired &&
      /scheduler/i.test(TRIGGER_STATUS.BOOKING_REMINDER_24H.note),
  );
  check(
    "auth-provider emails are marked unwired, because editing them here does nothing",
    !TRIGGER_STATUS.PASSWORD_RESET.wired &&
      !TRIGGER_STATUS.ACCOUNT_ACTIVATION.wired,
  );
  check(
    "at least one trigger IS wired, so the claim is not vacuous",
    wiredTriggers().length >= 5,
    wiredTriggers().join(", "),
  );

  // =========================================================================
  // COMMUNICATION SERVICE
  // =========================================================================

  check(
    "every send path writes a log row",
    (code(service).match(/await record\(|record\(\{/g) ?? []).length >= 3,
  );
  check(
    "a missing provider is SKIPPED, not FAILED",
    /skipped: true/.test(mailer) && /PROVIDER_NOT_CONFIGURED/.test(mailer),
    "'we chose not to send' and 'we tried and failed' are different facts",
  );
  check(
    "and the service still turns that into a SKIPPED log rather than a send",
    /delivery\.skipped \? "SKIPPED"/.test(code(service)),
    "the distinction is worthless if it stops at the transport",
  );

  // =========================================================================
  // SEEDED TEMPLATE CONTENT (migration 0020)
  //
  // 0019 seeded template rows with no content, which meant no email could be
  // sent AND none could be activated (the RPC refuses `current_version < 1`).
  // 0020 writes version 1. These checks exist because a typo in seeded copy is
  // invisible until it reaches a customer as a blank.
  // =========================================================================

  const seededPlaceholders = [
    ...new Set(
      (contentMigration.match(/\{\{\s*[a-z][a-z0-9_.]*\s*\}\}/g) ?? []).map(
        (raw) => raw.replace(/[{}\s]/g, ""),
      ),
    ),
  ];

  check(
    "the seeded templates actually reference variables",
    seededPlaceholders.length >= 8,
    seededPlaceholders.join(", "),
  );
  for (const placeholder of seededPlaceholders) {
    check(
      `seeded copy uses a real variable: {{${placeholder}}}`,
      isTemplateVariable(placeholder),
      "an unknown variable renders blank at send time",
    );
  }
  check(
    "every seeded template passes the same validation the send path runs",
    (() => {
      // The bodies are dollar-quoted in the migration; validate each one.
      const blocks = contentMigration.match(/\$q\$[\s\S]*?\$q\$/g) ?? [];
      return (
        blocks.length > 0 && blocks.every((block) => validateTemplate(block).ok)
      );
    })(),
  );
  check(
    "seeding never overwrites copy an admin has edited",
    /if exists \([\s\S]{0,200}email_template_versions[\s\S]{0,120}continue;/.test(
      contentMigration,
    ),
    "a default must never win over somebody's deliberate edit",
  );
  check(
    "seeding content never changes a template's status",
    !/update public\.email_templates[\s\S]{0,300}?set[\s\S]{0,200}?status\s*=/.test(
      contentMigration,
    ),
    "a migration must not decide to start emailing customers",
  );
  check(
    "provider-owned emails are left unseeded",
    !/\('ACCOUNT_ACTIVATION',\s*\$q\$/.test(contentMigration) &&
      !/\('PASSWORD_RESET',\s*\$q\$/.test(contentMigration),
    "Supabase Auth sends these; content here would imply an edit that does nothing",
  );
  check(
    "the migration activates nothing at all",
    !/'ACTIVE'/.test(
      contentMigration.slice(contentMigration.indexOf("do $seed$")),
    ),
    "content is a migration concern; sending is a human decision",
  );

  // =========================================================================
  // THE PUBLIC FORM ACTUALLY SUBMITS
  //
  // The /validate-your-idea handler used to validate the fields, set
  // `submitted: true` to render "Your validation is running", and return —
  // sending nothing anywhere. Every visitor saw success and their idea was
  // discarded. A form that looks like it worked is worse than one that errors.
  // =========================================================================

  check(
    "the idea form posts its submission somewhere",
    /submitIdea\(/.test(code(ideaPage)),
    "a success screen with no request is a lead silently thrown away",
  );
  check(
    "it posts to the funnel endpoint, not just lead capture",
    /\/api\/onboarding\/validate-idea/.test(code(ideaSubmit)),
    "this page promises a validation, so it needs the endpoint that provisions one",
  );
  check(
    "a failed submission reopens the form instead of showing success",
    /submitted: false/.test(code(ideaPage)) &&
      /submitError/.test(code(ideaPage)),
  );
  check(
    "the idea form has a honeypot and sends it",
    /website/.test(code(ideaPage)) && /company_website/.test(code(ideaSubmit)),
  );
  check(
    "the analytics event fires on confirmed persistence, not on click",
    (() => {
      const source = code(ideaPage);
      const ok = source.indexOf("result.ok");
      const track = source.indexOf("trackEvent(");
      return ok !== -1 && track !== -1 && ok < track;
    })(),
    "counting attempts rather than captures overstates conversion",
  );

  // =========================================================================
  // LEAD CAPTURE IS NEVER LOST
  // =========================================================================

  check(
    "capture degrades to a direct insert when the RPC is missing",
    /PGRST202/.test(code(provisioning)),
    "a pending migration must not cost a real lead",
  );
  check(
    "only a MISSING FUNCTION degrades — other errors stay failures",
    /missingFunction/.test(code(provisioning)) &&
      /if \(!missingFunction\)/.test(code(provisioning)),
    "a fallback that swallows every error turns a broken database into data loss",
  );
  check(
    "the fallback insert never asks for the row back",
    (() => {
      const source = code(provisioning);
      const start = source.indexOf('from("leads")');
      if (start === -1) return false;
      const block = source.slice(start, start + 900);
      // `leads` has an INSERT policy and NO SELECT policy, so a `.select()`
      // makes it INSERT ... RETURNING, which RLS refuses with 42501 — failing
      // the insert and losing the lead.
      return !/\.select\(/.test(block);
    })(),
    "INSERT ... RETURNING is denied by RLS and takes the whole insert with it",
  );
  check(
    "success is reported from `saved`, not from a lead id",
    /saved: boolean/.test(provisioning) &&
      /!capture\.saved/.test(code(ideaRoute)),
    "the degraded path cannot read an id back, so a null id is not a failure",
  );

  // =========================================================================
  // P8/P9 — CUSTOMER DASHBOARD
  // =========================================================================

  check(
    "the dashboard reads validation state from the idea row, not a guess",
    /idea\.status/.test(code(funnelData)) &&
      /"PENDING"|"RUNNING"|"COMPLETED"|"FAILED"/.test(code(funnelData)),
  );
  check(
    "completed-without-a-report is reported as still running",
    /return report \? "COMPLETED" : "RUNNING"/.test(code(funnelData)),
    "offering a View report button that 404s teaches the customer the product is broken",
  );
  check(
    "the score is read from the stored report, never derived",
    /report\.score/.test(code(ideaPanel)) &&
      !/Math\.(random|round|floor)\s*\(/.test(code(ideaPanel)),
    "§8: do not invent scores",
  );
  check(
    "report actions render only when a report row exists",
    /\{report \? \(/.test(ideaPanel),
    "§8: do not display actions that are not currently available",
  );
  check(
    "every dashboard read is scoped to the caller",
    (() => {
      const source = code(funnelData);
      const selects = (source.match(/\.from\(/g) ?? []).length;
      const scoped = (source.match(/\.eq\("user_id", userId\)/g) ?? []).length;
      return selects > 0 && scoped >= 3;
    })(),
  );

  // =========================================================================
  // P19 — FUNNEL EVENTS FIRE ON ACTIONS, NOT RENDERS
  // =========================================================================

  check(
    "REPORT_VIEWED is recorded only after authorisation succeeded",
    (() => {
      const source = code(reportPage);
      const guard = source.indexOf("if (!result) notFound();");
      const event = source.indexOf('recordFunnelEvent("REPORT_VIEWED"');
      return guard !== -1 && event !== -1 && guard < event;
    })(),
    "an unauthorised or missing report must count nothing",
  );
  check(
    "REPORT_DOWNLOADED is recorded only after the PDF actually rendered",
    (() => {
      const source = code(pdfRoute);
      const render = source.indexOf("renderToBuffer(");
      const event = source.indexOf('recordFunnelEvent("REPORT_DOWNLOADED"');
      return render !== -1 && event !== -1 && render < event;
    })(),
    "§19: do not count failed downloads",
  );
  check(
    "STRATEGY_CTA_CLICKED fires from a click handler, not a render",
    (() => {
      const cta = read("features/dashboard/strategy-cta.tsx");
      return /onClick=/.test(cta) && /recordStrategyCtaClick/.test(cta);
    })(),
  );
  check(
    "BOOKING_STARTED fires when the booking workflow opens",
    /useEffect\(/.test(code(bookingForm)) &&
      /recordBookingStarted/.test(code(bookingForm)),
  );
  check(
    "BOOKING_CREATED and BOOKING_COMPLETED come from the database, not the UI",
    /'BOOKING_CREATED'/.test(ownershipMigration) &&
      /'BOOKING_COMPLETED'/.test(migration),
    "one writer per fact, so the UI cannot disagree with the record",
  );
  check(
    "funnel events never throw into a user action",
    !/throw /.test(code(funnelEvents)),
  );
  check(
    "a funnel event cannot be written onto someone else's lead",
    /lead_record_event/.test(code(funnelEvents)) &&
      !/p_lead_id: [a-z]*Id \|\| /.test(code(funnelEvents)),
    "the lead is resolved from auth.uid(), never accepted from the client",
  );

  // =========================================================================
  // P11 — BOOKING IDENTITY AND DUPLICATION
  // =========================================================================

  check(
    "the booking form posts no identity fields",
    !/user_id|workspace_id|leadId|lead_id/.test(code(bookingForm)),
    "§BOOKING SECURITY: the browser must not name the actor",
  );
  check(
    "the request schema no longer accepts a lead id",
    !/^\s*leadId: z/m.test(code(validations)),
    "it was trusted end-to-end and allowed timeline forgery",
  );
  check(
    "the route derives the lead server-side",
    /let leadId: string \| null = null/.test(code(bookingRoute)),
  );
  check(
    "booking_create refuses an unowned lead id (migration 0022)",
    /v_lead_id/.test(ownershipMigration) &&
      /admin_has\('leads\.update'\)/.test(ownershipMigration) &&
      /lower\(btrim\(email\)\) = v_email/.test(ownershipMigration),
    "the RPC is reachable over PostgREST, so a schema is not the boundary",
  );
  check(
    "0022 uses v_lead_id everywhere, never the raw parameter, after the check",
    (() => {
      const body = ownershipMigration.slice(
        ownershipMigration.indexOf("insert into public.bookings"),
      );
      return !/p_lead_id/.test(body);
    })(),
  );
  check(
    "the submit button is disabled while a booking is in flight",
    /disabled=\{!canSubmit\}/.test(code(bookingForm)) &&
      /!pending/.test(code(bookingForm)),
  );
  check(
    "booking failure shows friendly copy, never a provider message",
    /select another available time/.test(bookingForm) &&
      !/error\.message/.test(code(bookingForm)),
  );

  // =========================================================================
  // MIDDLEWARE — protection is declared, not inferred
  //
  // Every one of these lives in the (dashboard) group, so the layout refused an
  // anonymous visitor even before they were listed. What was missing was the
  // `redirectTo`: somebody who clicked through to a protected page logged in
  // and landed on the dashboard, having lost what they were doing.
  // =========================================================================

  const middlewareSource = code(read("lib/supabase/middleware.ts"));
  for (const route of [
    "/strategy-session",
    "/research",
    "/competitors",
    "/financials",
    "/marketing",
    "/execution",
    "/dashboard",
    "/reports",
    "/admin",
  ]) {
    check(
      `'${route}' is an explicitly protected prefix`,
      new RegExp(`"${route}"`).test(middlewareSource),
    );
  }
  check(
    "the bounce preserves the intended destination",
    /searchParams\.set\("redirectTo", pathname\)/.test(middlewareSource),
  );

  // =========================================================================
  // ONE PERSON, ONE LEAD  (migration 0027)
  //
  // lead_capture resolved an existing lead only by idempotency_key, and that
  // key embeds the source. So validating an idea and later booking a session
  // produced TWO leads for one human: counted twice in the funnel, listed
  // twice in Admin -> Leads, with the original stuck at NEW while the
  // duplicate advanced. Verified against the live database before the fix.
  // =========================================================================

  const identityMigration = read(
    "supabase/migrations/0027_one_person_one_lead.sql",
  );

  check(
    "capture resolves an existing lead by EMAIL, not just the idempotency key",
    /lower\(btrim\(email\)\) = v_email/.test(identityMigration),
    "the person is the identity; the source is how they arrived",
  );
  check(
    "the exact-retry check still runs first",
    (() => {
      const key = identityMigration.indexOf(
        "where idempotency_key = p_idempotency_key",
      );
      const email = identityMigration.indexOf("lower(btrim(email)) = v_email");
      return key !== -1 && email !== -1 && key < email;
    })(),
    "a genuine retry is more specific than a returning visitor",
  );
  check(
    "the oldest lead wins, because it carries the history",
    /order by created_at\s+limit 1/.test(identityMigration),
  );
  check(
    "a later submission fills gaps but never erases known data",
    /coalesce\(p_phone, phone\)/.test(identityMigration) &&
      /coalesce\(p_industry, industry\)/.test(identityMigration),
    "somebody who omits a field on a second visit keeps what they gave on the first",
  );
  check(
    "first-touch attribution survives a second entry point",
    !/set[\s\S]{0,400}source\s*=\s*coalesce\(p_source/.test(identityMigration),
    "rewriting source on a later booking destroys where the customer came from",
  );
  check(
    "existing duplicates are not silently merged by the migration",
    !/delete from public\.leads/.test(identityMigration),
    "merging real customer records is a judgement call, not a migration",
  );

  // =========================================================================
  // MANDATORY PASSWORD SETUP  (migration 0026)
  // =========================================================================

  const passwordMigration = read(
    "supabase/migrations/0026_password_setup_required.sql",
  );
  const authActions = read("features/auth/actions.ts");
  const dashboardLayout = read("app/(dashboard)/layout.tsx");

  check(
    "the schema still stores no password, hash or token",
    !/password\s+text|encrypted|hash|token/i.test(
      passwordMigration.replace(/^\s*--.*$/gm, ""),
    ),
    "the flag is a boolean, not a credential",
  );
  check(
    "no default flips existing customers into forced setup",
    /default false/.test(passwordMigration),
  );
  check(
    "every dashboard route is gated, via the shared layout",
    /password_setup_required/.test(code(dashboardLayout)) &&
      /redirect\("\/change-password"\)/.test(code(dashboardLayout)),
    "a per-page check would be one forgotten page away from a hole",
  );
  check(
    "the flag is cleared only AFTER the password is actually set",
    (() => {
      const source = code(authActions);
      const from = source.indexOf("completePasswordSetupAction");
      const body = source.slice(from);
      const update = body.indexOf("auth.updateUser(");
      const clear = body.indexOf("password_setup_required: false");
      return update !== -1 && clear !== -1 && update < clear;
    })(),
    "clearing first would strand somebody with no password and no prompt",
  );
  check(
    "the password is never logged",
    !/console\.(log|error|warn)\([^)]*password[^)]*parsed/i.test(
      code(authActions),
    ),
  );
  check(
    "still no generated or emailed credential anywhere in onboarding",
    !/temporary_password|generatePassword|randomPassword/i.test(
      featureSources + routes.join("\n") + code(authActions),
    ),
    "the magic-link design is intact; this phase added a setup gate, not a credential",
  );

  // =========================================================================
  // MAIL TRANSPORT
  //
  // Delivery is SMTP through a mailbox the business owns. The properties that
  // matter are the ones whose absence is invisible until production: a
  // credential in a log, and a request hanging on a wedged mail server.
  // =========================================================================

  check(
    "the SMTP password is read in exactly one module",
    (() => {
      const others = [service, provisioning, ideaRoute, bookingRoute].join("");
      return /SMTP_PASS/.test(mailer) && !/SMTP_PASS/.test(others);
    })(),
  );
  check(
    "the transport never logs the credential or the raw provider error",
    !/console\.(error|log|warn)\([^)]*(config\.pass|SMTP_PASS|error\b)/.test(
      code(mailer),
    ),
    "an SMTP error can quote the server response, which may echo the envelope",
  );
  check(
    "every connection stage is bounded by a timeout",
    /connectionTimeout:/.test(code(mailer)) &&
      /greetingTimeout:/.test(code(mailer)) &&
      /socketTimeout:/.test(code(mailer)),
    "notifyNewLead is awaited inside a public form POST",
  );
  check(
    "the transport never throws — a failed email must not fail the business fact",
    !/throw new/.test(code(mailer)),
  );
  check(
    "port 465 uses implicit TLS and is not silently downgraded",
    /secure: config\.port === IMPLICIT_TLS_PORT/.test(code(mailer)),
  );
  check(
    "the sender address is pinned to the authenticated mailbox",
    (() => {
      const source = code(mailer);
      return (
        /function senderFor\(/.test(source) &&
        // The display name is kept, but the address is always SMTP_USER.
        /<\$\{user\}>/.test(source) &&
        /from: senderFor\(/.test(source)
      );
    })(),
    "authenticating as one mailbox and sending as another is accepted at login and rejected at send",
  );
  check(
    "and a mismatch is warned about rather than silently rewritten",
    /warnOnce\(/.test(code(mailer)) &&
      /TRANSACTIONAL_EMAIL_FROM is/.test(mailer),
  );
  check(
    "the warning fires once, not once per email",
    /warned\.has\(message\)/.test(code(mailer)),
    "a warning on every send is a warning nobody reads",
  );
  check(
    "an auth failure is reported as a fixable setting, not an outage",
    /SMTP_AUTH_FAILED/.test(mailer) && /EAUTH/.test(mailer),
  );
  check(
    "no third-party email API remains",
    !/api\.resend\.com|sendgrid|postmark|mailgun|brevo/i.test(
      [mailer, service, read("lib/leads/notify.ts")].join("\n"),
    ),
  );
  check(
    "the log never stores the message body",
    !/body_html:/.test(
      code(service).slice(code(service).indexOf("email_log_record")),
    ),
  );
  check(
    "the provider response body is never copied into the log",
    !/await response\.text\(\)/.test(service),
    "it can echo the recipient",
  );
  check(
    "the service never throws — a failed email must not fail the business fact",
    !/throw new/.test(code(service)),
  );
  check(
    "templates are re-validated at send time, not only at save time",
    /validateTemplate\(/.test(service),
  );

  // =========================================================================
  // RBAC
  // =========================================================================

  for (const permission of [
    "leads.read",
    "leads.update",
    "bookings.read",
    "bookings.update",
    "communications.read",
    "communications.write",
    "communications.send_test",
  ] as const) {
    check(
      `permission '${permission}' exists in TypeScript`,
      (ADMIN_PERMISSIONS as readonly string[]).includes(permission),
    );
    check(
      `permission '${permission}' is granted in SQL`,
      migration.includes(`'${permission}'`),
    );
  }
  check(
    "SUPPORT can read leads but cannot change one",
    roleHasPermission("SUPPORT", "leads.read") &&
      !roleHasPermission("SUPPORT", "leads.update"),
  );
  check(
    "SUPPORT cannot author or send communications",
    !roleHasPermission("SUPPORT", "communications.write") &&
      !roleHasPermission("SUPPORT", "communications.send_test"),
  );
  check(
    "ANALYST sees no leads at all — they are customer PII",
    !roleHasPermission("ANALYST", "leads.read"),
  );
  check(
    "ADMIN can work the funnel end to end",
    (
      [
        "leads.read",
        "leads.update",
        "bookings.read",
        "bookings.update",
        "communications.write",
      ] as const
    ).every((permission) => roleHasPermission("ADMIN", permission)),
  );
  check(
    "sending a test is separated from writing a template",
    ROLE_PERMISSIONS.SUPPORT.includes("communications.read") &&
      !ROLE_PERMISSIONS.SUPPORT.includes("communications.send_test"),
  );
  /**
   * Every mutating RPC must consult SOMETHING before it writes.
   *
   * This used to check a hardcoded list of three function names. It passed
   * while `email_log_record` — `security definer`, granted to `authenticated`,
   * and therefore callable by every customer who has ever signed up — wrote to
   * `email_logs` and `lead_events` with no authorization check at all. Any of
   * them could have forged EMAIL_SENT rows onto any lead's timeline.
   *
   * A test named "every" that inspects three is not a weaker test, it is a
   * misleading one: it converts an unexamined function into an apparently
   * verified one. So the list is now DERIVED from the migration. A new function
   * is covered the moment it is written, without anyone remembering to add it.
   */
  const mutatingFunctions = [
    ...migration.matchAll(/create or replace function public\.(\w+)\(/g),
  ]
    .map((match) => match[1]!)
    .filter((name) => {
      const start = migration.indexOf(
        `create or replace function public.${name}(`,
      );
      const body = migration.slice(start, start + 4000);
      // Read-only functions have nothing to authorize at write time.
      return /\binsert into\b|\bupdate public\.|\bdelete from\b/.test(body);
    });

  check(
    "the migration actually defines mutating functions to check",
    mutatingFunctions.length >= 8,
    mutatingFunctions.join(", "),
  );

  for (const fn of mutatingFunctions) {
    const start = migration.indexOf(`create or replace function public.${fn}(`);
    const body = migration.slice(start, start + 5000);
    check(
      `'${fn}' consults a permission or an identity before writing`,
      /admin_has\(|auth\.uid\(\)|is_admin\(/.test(body),
      "security definer bypasses RLS, so the function is the only gate left",
    );
  }

  check(
    "email_log_record cannot forge a timeline entry for someone else's lead",
    (() => {
      const start = migration.indexOf(
        "create or replace function public.email_log_record(",
      );
      const body = migration.slice(start, start + 5000);
      const guard = body.indexOf("admin_has('leads.update')");
      const insert = body.indexOf("insert into public.lead_events");
      return guard !== -1 && insert !== -1 && guard < insert;
    })(),
    "the guard must precede the write, not follow it",
  );

  // =========================================================================
  // LEAD LIFECYCLE
  // =========================================================================

  for (const status of [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "STRATEGY_BOOKED",
    "STRATEGY_COMPLETED",
    "PROPOSAL",
    "CUSTOMER",
    "LOST",
  ]) {
    check(
      `lead status '${status}' is constrained in SQL`,
      migration.includes(`'${status}'`),
    );
  }
  check(
    "historical lowercase statuses are migrated, not orphaned",
    /update public\.leads set status = 'NEW'\s+where status = 'new'/.test(
      migration,
    ),
    "the table holds live rows",
  );
  check(
    "a status change is written to BOTH the lead timeline and the platform audit log",
    (() => {
      const start = migration.indexOf(
        "create or replace function public.lead_set_status",
      );
      const body = migration.slice(start, start + 2000);
      return (
        /insert into public\.lead_events/.test(body) && /admin_log\(/.test(body)
      );
    })(),
    "reusing the existing audit system rather than a second one",
  );
  check(
    "booking states are exactly the five the brief names",
    ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].every(
      (state) => migration.includes(`'${state}'`),
    ),
  );
  check(
    "a customer may cancel their own booking but not confirm it",
    /you can cancel a booking, but not change it to/.test(migration),
  );

  // =========================================================================
  // INPUT VALIDATION
  // =========================================================================

  const validSubmission = {
    firstName: "Ada",
    email: "ada@example.com",
    businessIdea:
      "An AI appointment management platform for dental clinics in India.",
  };
  check(
    "a minimal valid submission parses",
    validateIdeaSchema.safeParse(validSubmission).success,
    "three required fields, because field nine is where people leave",
  );
  check(
    "the email is normalised to lower case",
    (() => {
      const parsed = validateIdeaSchema.safeParse({
        ...validSubmission,
        email: "ADA@Example.COM",
      });
      return parsed.success && parsed.data.email === "ada@example.com";
    })(),
    "so the idempotency key and the account lookup agree",
  );
  check(
    "a bad email is refused",
    !validateIdeaSchema.safeParse({ ...validSubmission, email: "nope" })
      .success,
  );
  check(
    "a one-word idea is refused",
    !validateIdeaSchema.safeParse({ ...validSubmission, businessIdea: "app" })
      .success,
  );
  check(
    "an oversized idea is refused",
    !validateIdeaSchema.safeParse({
      ...validSubmission,
      businessIdea: "x".repeat(5000),
    }).success,
  );
  check(
    "five business stages",
    BUSINESS_STAGES.length === 5,
    BUSINESS_STAGES.join(", "),
  );

  const validBooking = {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    timezone: "Asia/Kolkata",
  };
  check(
    "a valid booking parses",
    bookingSchema.safeParse(validBooking).success,
  );
  check(
    "a booking in the past is refused",
    !bookingSchema.safeParse({
      ...validBooking,
      scheduledAt: new Date(Date.now() - 86_400_000).toISOString(),
    }).success,
  );
  check(
    "an injected timezone is refused",
    !bookingSchema.safeParse({
      ...validBooking,
      timezone: "'; drop table bookings; --",
    }).success,
  );
  check(
    "SQL refuses a past booking too, not only Zod",
    /that time is in the past/.test(migration),
  );

  // =========================================================================
  // REUSE — the brief's first instruction
  // =========================================================================

  check(
    "the existing leads table is EXTENDED, never recreated",
    /alter table public\.leads/.test(migration) &&
      !/create table if not exists public\.leads/.test(migration),
  );
  check(
    "no second rate limiter was introduced",
    /from "@\/lib\/rate-limit"/.test(ideaRoute) &&
      !/class RateLimit|new Map<string, Window>/.test(routes.join("\n")),
  );
  check(
    "no second audit system was introduced",
    /admin_log\(/.test(migration) &&
      !/create table[\s\S]{0,80}audit/i.test(migration),
  );
  check(
    "no second credit system was introduced",
    !/create table[\s\S]{0,60}credit/i.test(migration),
  );
  check(
    "the existing append-only trigger is reused for template versions",
    /reject_audit_mutation/.test(migration),
  );
  check(
    "workspace provisioning reuses the existing personal-workspace path",
    /getWorkspaceContext|already provisions/.test(provisioning),
  );

  // =========================================================================
  // ADMIN METRICS
  // =========================================================================

  check(
    "funnel metrics are counted in SQL, not by paging rows into JavaScript",
    /admin_funnel_stats/.test(migration) &&
      /select count\(\*\) from public\.leads/.test(migration),
  );
  check(
    "and each block is permission-gated",
    /admin_funnel_stats[\s\S]*?admin_has\('leads\.read'\)/.test(migration) &&
      /admin_has\('bookings\.read'\)/.test(migration),
  );
  check(
    "test emails are excluded from the sent count",
    /status = 'SENT' and not is_test/.test(migration),
  );

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — ONBOARDING SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(`\n${total}/${total} checks passed — ONBOARDING SMOKE PASSED`);
}

main();
