import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canManage } from "@/features/workspaces/roles";
import { getWorkspaceUsage, getUsageSummary } from "@/features/commerce/usage";
import { getWorkflowCatalog } from "@/features/ai/registry/catalog";
import { isPlatformConfigured } from "@/features/ai";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "Diagnostics" };
export const dynamic = "force-dynamic";

/**
 * Minimal operational diagnostics — deliberately NOT an admin panel.
 *
 * Scope is exactly what the sprint asks for: AI requests, failed workflows,
 * usage and workflow status. It is workspace-scoped and gated on the Owner/Admin
 * role, so it shows an operator their own workspace rather than the platform.
 *
 * A real admin panel would need to cross workspace boundaries, which means new
 * RLS policies that deliberately break the isolation every other table
 * enforces. That is a security design task in its own right, not a page — and
 * it is explicitly out of scope here. Building the read-only, in-boundary
 * version now avoids creating a privilege model nobody reviewed.
 */
export default async function DiagnosticsPage() {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  // Server-side authorisation. A Viewer or Member reaching this URL sees the
  // refusal, not the data — the check is not a UI affordance.
  if (!canManage(role)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Diagnostics
        </h1>
        <Card className="p-6">
          <p className="text-sm text-muted">
            Diagnostics are available to workspace owners and admins. Your role
            in this workspace is{" "}
            <strong className="text-foreground">{role ?? "none"}</strong>.
          </p>
        </Card>
      </div>
    );
  }

  const [summary, events, catalog] = await Promise.all([
    getUsageSummary(workspace.id),
    getWorkspaceUsage(workspace.id, 25),
    getWorkflowCatalog(),
  ]);

  const failures = events.filter((event) => event.status !== "success");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Diagnostics
        </h1>
        <p className="text-muted">
          Operational view of {workspace.name}. Read-only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <p className="text-2xl font-bold text-foreground">
            {summary.totalRuns}
          </p>
          <p className="text-sm text-muted">Total AI runs</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-foreground">
            {summary.successfulRuns}
          </p>
          <p className="text-sm text-muted">Succeeded</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-foreground">
            {summary.failedRuns}
          </p>
          <p className="text-sm text-muted">Failed</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-foreground">
            {isPlatformConfigured() ? "Ready" : "Not configured"}
          </p>
          <p className="text-sm text-muted">AI provider</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Registered workflows
        </h2>
        <ul className="mt-5 divide-y divide-line">
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
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Failed runs
        </h2>
        {failures.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No failures recorded.</p>
        ) : (
          <ul className="mt-5 divide-y divide-line">
            {failures.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {event.workflow}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(event.created_at)} · {event.model} ·{" "}
                    {formatDuration(event.duration_ms)}
                  </p>
                </div>
                <Badge variant="neutral">{event.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
