import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/features/admin/guard";
import {
  getPlatformStats,
  recentFailures,
  recentWorkspaces,
  recentCreditActivity,
} from "@/features/admin/data";
import {
  getResearchStats,
  getCompetitorStats,
  getFinancialStats,
  getGtmStats,
  getExecutionStats,
} from "@/features/admin/research-ops";
import {
  buildFunnel,
  getCommandCenterStats,
  getFunnelStats,
  type WorkflowUsage,
} from "@/features/admin/leads";
import { FunnelPanel, WorkflowUsagePanel } from "@/features/admin/funnel-panel";
import { isPlatformConfigured } from "@/features/ai";
import { PageHeader, Stat, EmptyState } from "@/features/admin/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Operational dashboard.
 *
 * Every number here is a real count from `admin_platform_stats()`. Nothing is
 * estimated, sampled or extrapolated. Where a metric is absent — either because
 * the caller's role cannot see it, or because the platform does not measure it
 * — the card says **Unavailable** rather than showing a zero.
 *
 * That distinction is the whole point of the card component: `0 AI failures` and
 * `failures not visible to your role` are different facts, and an operator who
 * confuses them will conclude the platform is healthy when they simply cannot
 * see it.
 */
export default async function AdminDashboard() {
  const { has, role } = await requireAdmin();

  const [
    stats,
    research,
    competitors,
    financials,
    marketing,
    execution,
    funnel,
    command,
    failures,
    workspaces,
    credits,
  ] = await Promise.all([
    getPlatformStats(),
    // Additive RPCs rather than redefinitions: each phase adds its own
    // counters without changing what an already-deployed
    // `admin_platform_stats` returns.
    getResearchStats(),
    getCompetitorStats(),
    getFinancialStats(),
    getGtmStats(),
    getExecutionStats(),
    // Gated inside the RPC per block, so a role without `leads.read` gets an
    // object missing those keys rather than an error or a zero.
    getFunnelStats(),
    // Phase 12: aggregates the older stat RPCs do not provide — active users,
    // today's leads, per-workflow AI spend, funnel stages. Counted in SQL.
    getCommandCenterStats(),
    has("ai.read") ? recentFailures(6) : Promise.resolve([]),
    has("workspaces.read") ? recentWorkspaces(5) : Promise.resolve([]),
    has("credits.read") ? recentCreditActivity(6) : Promise.resolve([]),
  ]);

  /** A stat is `null` (→ "Unavailable") when the RPC omitted the key. */
  const num = (key: string): number | null => {
    const value = stats?.[key];
    return typeof value === "number" ? value : null;
  };

  const researchNum = (key: string): number | null => {
    const value = research?.[key];
    return typeof value === "number" ? value : null;
  };

  const competitorNum = (key: string): number | null => {
    const value = competitors?.[key];
    return typeof value === "number" ? value : null;
  };

  const financialNum = (key: string): number | null => {
    const value = financials?.[key];
    return typeof value === "number" ? value : null;
  };

  const marketingNum = (key: string): number | null => {
    const value = marketing?.[key];
    return typeof value === "number" ? value : null;
  };

  const executionNum = (key: string): number | null => {
    const value = execution?.[key];
    return typeof value === "number" ? value : null;
  };

  const commandNum = (key: string): number | null => {
    const value = command?.[key];
    return typeof value === "number" ? value : null;
  };

  /** A text value from the command stats, or null. Money stays a string. */
  const commandText = (key: string): string | null => {
    const value = command?.[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  };

  const funnelStages = buildFunnel(command);
  const workflowUsage: WorkflowUsage[] = Array.isArray(command?.["by_workflow"])
    ? (command["by_workflow"] as WorkflowUsage[])
    : [];

  const funnelNum = (key: string): number | null => {
    const value = funnel?.[key];
    return typeof value === "number" ? value : null;
  };

  const requests = num("ai_requests");
  const successes = num("ai_successes");
  const successRate =
    requests !== null && successes !== null && requests > 0
      ? `${((successes / requests) * 100).toFixed(1)}%`
      : requests === 0
        ? "—"
        : null;

  const cost = stats?.["estimated_cost"];
  const since = stats?.["since"];

  return (
    <>
      <PageHeader
        title="Platform overview"
        description={
          since
            ? `Real counts across every workspace since ${formatDate(String(since))}.`
            : "Real counts across every workspace."
        }
      />

      {/* --- KPI cards ---------------------------------------------------- */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total users"
            value={num("total_users")}
            sub={
              num("new_users_30d") !== null
                ? `${num("new_users_30d")} new in period`
                : undefined
            }
            unavailableNote="Requires users.read"
          />
          <Stat
            label="Workspaces"
            value={num("total_workspaces")}
            sub={
              num("new_workspaces_30d") !== null
                ? `${num("new_workspaces_30d")} new in period`
                : undefined
            }
            unavailableNote="Requires workspaces.read"
          />
          <Stat
            label="AI requests"
            value={requests}
            sub={
              num("ai_failures") !== null
                ? `${num("ai_failures")} failed`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="AI success rate"
            value={successRate}
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Tokens used"
            value={num("total_tokens")}
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Estimated AI cost"
            value={
              typeof cost === "number" || typeof cost === "string"
                ? `$${Number(cost).toFixed(4)}`
                : null
            }
            sub="Provider estimate, not billed spend"
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Credits outstanding"
            value={num("credits_outstanding")}
            sub={
              num("credits_spent_30d") !== null
                ? `${num("credits_spent_30d")} spent in period`
                : undefined
            }
            unavailableNote="Requires credits.read"
          />
          <Stat
            label="Active subscriptions"
            value={num("active_subscriptions")}
            sub="active or trialing"
            unavailableNote="Requires workspaces.read"
          />
        </div>

        {/*
          "Active users" was previously reported as unmeasurable because
          nothing recorded a session. `auth.users.last_sign_in_at` does, so the
          metric now has a real source — and the definition is printed with it,
          because an unlabelled "active" invites every reader to assume a
          different meaning.
        */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Active users"
            value={commandNum("active_users")}
            sub="Signed in within the period"
            unavailableNote="Requires users.read"
          />
          <Stat
            label="Signed in today"
            value={commandNum("signed_in_today")}
            unavailableNote="Requires users.read"
          />
          <Stat
            label="Never signed in"
            value={commandNum("never_signed_in")}
            sub="Provisioned but not yet activated"
            unavailableNote="Requires users.read"
          />
          <Stat
            label="New leads today"
            value={commandNum("new_leads_today")}
            unavailableNote="Requires leads.read"
          />
        </div>
      </section>

      {/* --- Client funnel --------------------------------------------------
          Counted by `admin_funnel_stats` in SQL rather than by reducing over a
          PostgREST page: a JavaScript total over a capped result set is a
          plausible-looking wrong number, which is worse than no number. */}
      <section aria-label="Client funnel" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Client funnel
          </h2>
          {has("leads.read") ? (
            <Link
              href="/admin/leads"
              className="text-sm text-accent hover:underline"
            >
              All leads →
            </Link>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total leads"
            value={funnelNum("total_leads")}
            sub={
              funnelNum("new_leads") !== null
                ? `${funnelNum("new_leads")} not yet contacted`
                : undefined
            }
            unavailableNote="Requires leads.read"
          />
          <Stat
            label="Accounts activated"
            value={funnelNum("accounts_created")}
            sub="Leads that followed the activation link"
            unavailableNote="Requires leads.read"
          />
          <Stat
            label="Validated ideas"
            value={funnelNum("validated_ideas")}
            unavailableNote="Requires leads.read"
          />
          <Stat
            label="Reports viewed"
            value={funnelNum("reports_viewed")}
            sub={
              funnelNum("reports_downloaded") !== null
                ? `${funnelNum("reports_downloaded")} downloaded`
                : undefined
            }
            unavailableNote="Requires leads.read"
          />
          <Stat
            label="Sessions booked"
            value={funnelNum("sessions_booked")}
            sub={
              funnelNum("sessions_completed") !== null
                ? `${funnelNum("sessions_completed")} completed`
                : undefined
            }
            unavailableNote="Requires bookings.read"
          />
          <Stat
            label="Qualified leads"
            value={funnelNum("qualified_leads")}
            unavailableNote="Requires leads.read"
          />
          <Stat
            label="Customers"
            value={funnelNum("customers")}
            unavailableNote="Requires leads.read"
          />
          <Stat
            label="Emails sent"
            value={funnelNum("emails_sent")}
            sub={
              funnelNum("emails_failed") !== null
                ? `${funnelNum("emails_failed")} failed`
                : undefined
            }
            unavailableNote="Requires communications.read"
          />
        </div>

        {/* --- The funnel itself, with drop-off ------------------------- */}
        <div className="mt-4">
          <FunnelPanel stages={funnelStages} />
        </div>

        <p className="mt-3 text-xs text-muted-strong">
          Stage counts come from the lead timeline, so a stage only appears once
          something writes its event. Leads captured before an event was
          instrumented have no row for it and are counted at zero rather than
          being back-filled from a proxy — which is why historical leads can
          show a later stage without the earlier one.
        </p>
      </section>

      {/* --- AI platform detail -------------------------------------------
          The aggregates the older stat RPCs do not provide. Cost is a decimal
          string summed as `numeric` in SQL — never float arithmetic. */}
      {has("ai.read") ? (
        <section aria-label="AI platform" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              AI platform
            </h2>
            <Link
              href="/admin/costs"
              className="text-sm text-accent hover:underline"
            >
              Cost analytics →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Most used model"
              value={commandText("most_used_model")}
              unavailableNote="No AI usage in period"
            />
            <Stat
              label="Most used feature"
              value={commandText("most_used_workflow")}
              unavailableNote="No AI usage in period"
            />
            <Stat
              label="Avg cost / request"
              value={
                commandText("avg_cost_per_request")
                  ? `$${commandText("avg_cost_per_request")}`
                  : null
              }
              sub="Provider estimate"
              unavailableNote="No AI usage in period"
            />
            <Stat
              label="AI failure rate"
              value={
                commandText("ai_failure_rate")
                  ? `${commandText("ai_failure_rate")}%`
                  : null
              }
              unavailableNote="No AI usage in period"
            />
          </div>
          <div className="mt-4">
            <WorkflowUsagePanel rows={workflowUsage} />
          </div>
        </section>
      ) : null}

      {/* --- Product output ------------------------------------------------      {/* --- Product output ------------------------------------------------
          What the platform actually produced in the period. Counted by
          `admin_research_stats` in SQL and gated per block there, so a role
          without `ai.read` sees Unavailable rather than zero. */}
      <section aria-label="Product output" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Product output
          </h2>
          {has("ai.read") ? (
            <Link
              href="/admin/research"
              className="text-sm text-accent hover:underline"
            >
              Research operations →
            </Link>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Research runs"
            value={researchNum("research_runs")}
            sub={
              researchNum("research_completed") !== null
                ? `${researchNum("research_completed")} completed`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Failed stage attempts"
            value={researchNum("stage_failures")}
            sub="Refunded automatically"
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Validator runs"
            value={researchNum("validator_runs")}
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Business plans"
            value={researchNum("business_plans")}
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Competitor runs"
            value={competitorNum("competitor_runs")}
            sub={
              competitorNum("competitor_completed") !== null
                ? `${competitorNum("competitor_completed")} completed`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Competitors found"
            value={competitorNum("competitors_found")}
            sub={
              competitorNum("competitors_verified") !== null
                ? `${competitorNum("competitors_verified")} verified`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Financial models"
            value={financialNum("financial_projects")}
            sub={
              financialNum("financial_runs") !== null
                ? `${financialNum("financial_runs")} runs`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Funding options found"
            value={financialNum("funding_options")}
            sub="Citation-backed only"
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="GTM plans"
            value={marketingNum("gtm_projects")}
            sub={
              marketingNum("gtm_runs") !== null
                ? `${marketingNum("gtm_runs")} runs`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Execution actions"
            value={executionNum("execution_actions")}
            sub={
              executionNum("actions_awaiting_approval") !== null
                ? `${executionNum("actions_awaiting_approval")} awaiting approval`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="Execution runs"
            value={executionNum("execution_runs")}
            sub={
              executionNum("runs_failed") !== null &&
              executionNum("runs_retried") !== null
                ? `${executionNum("runs_failed")} failed · ${executionNum("runs_retried")} retried`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
          <Stat
            label="GTM claims"
            value={marketingNum("gtm_claims")}
            sub={
              marketingNum("gtm_facts") !== null &&
              marketingNum("gtm_assumptions") !== null
                ? `${marketingNum("gtm_facts")} cited facts · ${marketingNum("gtm_assumptions")} assumptions`
                : undefined
            }
            unavailableNote="Requires ai.read"
          />
        </div>
      </section>

      {/* --- Recent failures ---------------------------------------------- */}
      {has("ai.read") ? (
        <section aria-label="Recent failures" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Recent AI failures
            </h2>
            <Link
              href="/admin/ai?status=failed"
              className="text-sm text-accent hover:underline"
            >
              View all →
            </Link>
          </div>
          {failures.length === 0 ? (
            <EmptyState title="No failures recorded." />
          ) : (
            <Card className="divide-y divide-line p-0">
              {failures.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/ai/${event.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-fill-1"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.workflow}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(event.created_at)} · {event.model}
                    </p>
                  </div>
                  <Badge variant="neutral">{event.status}</Badge>
                </Link>
              ))}
            </Card>
          )}
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* --- New workspaces --------------------------------------------- */}
        {has("workspaces.read") ? (
          <section aria-label="New workspaces">
            <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-foreground">
              Newest workspaces
            </h2>
            {workspaces.length === 0 ? (
              <EmptyState title="No workspaces yet." />
            ) : (
              <Card className="divide-y divide-line p-0">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/admin/workspaces/${workspace.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-fill-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {workspace.name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(workspace.created_at)}
                      </p>
                    </div>
                    {workspace.suspended_at ? (
                      <Badge variant="neutral">suspended</Badge>
                    ) : null}
                  </Link>
                ))}
              </Card>
            )}
          </section>
        ) : null}

        {/* --- Credit activity -------------------------------------------- */}
        {has("credits.read") ? (
          <section aria-label="Credit activity">
            <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-foreground">
              Recent credit activity
            </h2>
            {credits.length === 0 ? (
              <EmptyState title="No credit movements yet." />
            ) : (
              <Card className="divide-y divide-line p-0">
                {credits.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {tx.kind}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {formatDateTime(tx.created_at)}
                        {tx.reason ? ` · ${tx.reason}` : ""}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        tx.amount > 0 ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount.toLocaleString("en-US")}
                    </p>
                  </div>
                ))}
              </Card>
            )}
          </section>
        ) : null}
      </div>

      {/* --- System health snapshot --------------------------------------- */}
      {has("system.read") ? (
        <section aria-label="System health" className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-foreground">
            System health
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Database"
              value="Reachable"
              sub="This page read from it"
            />
            <Stat
              label="AI provider"
              value={isPlatformConfigured() ? "Configured" : "Not configured"}
              sub="Credential presence only"
            />
            <Stat label="Your role" value={role} />
          </div>
          <Link
            href="/admin/system-health"
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Full health detail →
          </Link>
        </section>
      ) : null}
    </>
  );
}
