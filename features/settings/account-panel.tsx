import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * The customer's account at a glance.
 *
 * ---------------------------------------------------------------------------
 * Read-only, and that is the design
 * ---------------------------------------------------------------------------
 * Name, email and password are the customer's to change, and the forms below
 * this panel do that. Workspace, plan and status are NOT: they are set by the
 * platform, and a customer changing their own plan is exactly the thing §13 of
 * the brief forbids.
 *
 * There is no control here to change them and, more to the point, no server
 * path that would accept one. `subscriptions` grants no INSERT, UPDATE or
 * DELETE policy to any client role (migration 0007); the only writer is
 * `admin_change_workspace_plan`, which demands `plans.manage` inside Postgres.
 * So this panel being display-only is not what enforces it — the database is.
 * Rendering it read-only just means the screen tells the truth.
 *
 * The plan NAME comes from the `plans` catalog rather than a label map in this
 * file, so a renamed plan renames here too without a deploy.
 */
export function AccountPanel({
  name,
  email,
  workspaceName,
  planName,
  status,
}: {
  name: string | null;
  email: string | null;
  workspaceName: string | null;
  planName: string | null;
  /** Subscription status, or "suspended" when the workspace is suspended. */
  status: string | null;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: name?.trim() || "Not set" },
    { label: "Email", value: email || "Not set" },
    { label: "Workspace", value: workspaceName || "—" },
    { label: "Plan", value: planName || "—" },
  ];

  const healthy = status === "active" || status === "trialing";

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        Account
      </h2>
      <p className="mt-1 text-sm text-muted">
        Your plan and workspace are managed by AIAutomix. Contact us to change
        them.
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wider text-muted">
              {row.label}
            </dt>
            <dd className="mt-1 break-words text-sm text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">
            Status
          </dt>
          <dd className="mt-1">
            {status ? (
              <Badge variant={healthy ? "active" : "archived"}>
                {status.replace("_", " ")}
              </Badge>
            ) : (
              <span className="text-sm text-muted">—</span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
