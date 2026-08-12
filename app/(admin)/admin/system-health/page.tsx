import type { Metadata } from "next";

import { requirePermission } from "@/features/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { isPlatformConfigured } from "@/features/ai";
import { getWorkflowCatalog } from "@/features/ai/registry/catalog";
import { recentFailures } from "@/features/admin/data";
import { PageHeader, Stat } from "@/features/admin/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "System health" };
export const dynamic = "force-dynamic";

/**
 * Safe operational health.
 *
 * The rule this page is built around: report **presence and reachability, never
 * values**. "OpenAI key configured" is useful to an operator; the key itself is
 * useful to an attacker. So every check below answers a yes/no question, and no
 * environment variable is ever interpolated into the output.
 *
 * `isPlatformConfigured()` returns a boolean derived from server-side env vars.
 * The variables themselves are not `NEXT_PUBLIC_*` and never reach the client.
 */
export default async function AdminSystemHealthPage() {
  await requirePermission("system.read");

  // Database reachability is measured, not assumed — a trivial query, timed.
  const started = Date.now();
  let dbOk = false;
  let dbLatency: number | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("plans")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    dbOk = !error;
    dbLatency = Date.now() - started;
  } catch {
    dbOk = false;
  }

  const [catalog, failures] = await Promise.all([
    getWorkflowCatalog().catch(() => []),
    recentFailures(5).catch(() => []),
  ]);

  const aiConfigured = isPlatformConfigured();
  const activeWorkflows = catalog.filter((entry) => entry.isActive).length;

  return (
    <>
      <PageHeader
        title="System health"
        description="Reachability and configuration. No secret values are displayed anywhere on this page."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Application"
          value="Running"
          sub="This page rendered server-side"
        />
        <Stat
          label="Database"
          value={dbOk ? "Reachable" : "Unreachable"}
          sub={dbLatency !== null ? `${dbLatency} ms round trip` : undefined}
        />
        <Stat
          label="AI provider"
          value={aiConfigured ? "Configured" : "Not configured"}
          sub="Credential presence only"
        />
        <Stat
          label="Active workflows"
          value={catalog.length > 0 ? activeWorkflows : null}
          sub={
            catalog.length > 0 ? `of ${catalog.length} registered` : undefined
          }
          unavailableNote="Workflow registry unreadable"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Workflow registry
          </h2>
          {catalog.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No workflows registered, or the registry could not be read.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {catalog.map((entry) => (
                <li
                  key={entry.slug}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {entry.label}
                    </p>
                    <p className="text-xs text-muted">
                      {entry.slug} · {entry.provider} · prompt{" "}
                      {entry.activePromptVersion}
                    </p>
                  </div>
                  <Badge variant={entry.isActive ? "active" : "neutral"}>
                    {entry.isActive ? "active" : "inactive"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Recent failures
          </h2>
          {failures.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No AI failures recorded recently.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {failures.map((event) => (
                <li key={event.id} className="py-3">
                  <p className="text-sm font-medium text-foreground">
                    {event.workflow}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(event.created_at)} · {event.model}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          What this page deliberately does not show
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            API keys, connection strings and tokens — presence is reported,
            values never are.
          </li>
          <li>
            Provider account balance or quota. The application holds no
            credential permitting that query, and adding one to render a status
            card would widen what a compromised server could reach.
          </li>
          <li>
            Background job state. There is no queue or scheduler in this
            deployment; a green tile for something that does not exist would be
            worse than its absence.
          </li>
        </ul>
      </Card>
    </>
  );
}
