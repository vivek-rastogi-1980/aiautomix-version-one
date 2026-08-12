import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/features/admin/guard";
import {
  getWorkspaceDetail,
  listCreditTransactions,
  listAuditLogs,
} from "@/features/admin/data";
import { pageParams } from "@/features/admin/query";
import { PageHeader, Stat, NoPermission } from "@/features/admin/ui";
import {
  WorkspaceSuspendControl,
  CreditControls,
} from "@/features/admin/user-controls";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/features/commerce/subscriptions";
import { ROLE_LABELS as WORKSPACE_ROLE_LABELS } from "@/features/workspaces/roles";
import type { WorkspaceRole } from "@/types/database";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

export default async function AdminWorkspaceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("workspaces.read");
  const { id } = await params;

  const detail = await getWorkspaceDetail(id);
  if (!detail) notFound();

  const {
    workspace,
    members,
    subscription,
    plan,
    credits,
    projectCount,
    usage,
  } = detail;

  const [ledger, history] = await Promise.all([
    context.has("credits.read")
      ? listCreditTransactions(pageParams("1", "10"), { workspaceId: id })
      : Promise.resolve(null),
    context.has("audit.read")
      ? listAuditLogs(pageParams("1", "10"), {
          entityType: "workspace",
          entityId: id,
        })
      : Promise.resolve(null),
  ]);

  const suspended = Boolean(workspace.suspended_at);

  return (
    <>
      <PageHeader
        title={workspace.name}
        description={`${workspace.slug} · ${workspace.is_personal ? "personal" : "shared"} workspace`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={members.length} />
        <Stat label="Projects" value={projectCount} />
        <Stat
          label="AI runs"
          value={context.has("ai.read") ? usage.runs : null}
          sub={context.has("ai.read") ? `${usage.failures} failed` : undefined}
          unavailableNote="Requires ai.read"
        />
        <Stat
          label="Credit balance"
          value={context.has("credits.read") ? (credits?.balance ?? 0) : null}
          unavailableNote="Requires credits.read"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* --- Plan & subscription ------------------------------------- */}
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Plan &amp; subscription
            </h2>
            {subscription ? (
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">
                    Plan
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {plan?.name ?? subscription.plan_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">
                    Status
                  </dt>
                  <dd className="mt-1">
                    <Badge
                      variant={
                        subscription.status === "active" ? "active" : "neutral"
                      }
                    >
                      {subscription.status.replace("_", " ")}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">
                    Price
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {plan
                      ? formatPrice(plan.price_monthly, plan.currency)
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted">
                No subscription record for this workspace.
              </p>
            )}
          </Card>

          {/* --- Members -------------------------------------------------- */}
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Members
            </h2>
            {members.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No members.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      {context.has("users.read") ? (
                        <Link
                          href={`/admin/users/${member.user_id}`}
                          className="truncate text-sm font-medium text-accent hover:underline"
                        >
                          {member.profile?.full_name?.trim() || "Unnamed user"}
                        </Link>
                      ) : (
                        <span className="truncate text-sm text-foreground">
                          {member.profile?.full_name?.trim() || "Unnamed user"}
                        </span>
                      )}
                      <p className="text-xs text-muted">
                        joined {formatDate(member.created_at)}
                        {member.user_id === workspace.owner_id
                          ? " · owner"
                          : ""}
                      </p>
                    </div>
                    <Badge variant="neutral">
                      {WORKSPACE_ROLE_LABELS[member.role as WorkspaceRole] ??
                        member.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* --- Credit ledger -------------------------------------------- */}
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Credit ledger
            </h2>
            {!context.has("credits.read") ? (
              <div className="mt-4">
                <NoPermission permission="credits.read" />
              </div>
            ) : !ledger || ledger.rows.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No credit activity.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {ledger.rows.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-4 py-3"
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
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold ${
                          tx.amount > 0 ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toLocaleString("en-US")}
                      </p>
                      <p className="text-xs text-muted">
                        balance {tx.balance_after.toLocaleString("en-US")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {history ? (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Admin actions on this workspace
              </h2>
              {history.rows.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Nothing recorded.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {history.rows.map((entry) => (
                    <li key={entry.id} className="py-3">
                      <p className="text-sm font-medium text-foreground">
                        {entry.action}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTime(entry.created_at)} · {entry.actor_role}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* --- Actions ---------------------------------------------------- */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Workspace
            </h2>
            {suspended ? (
              <p className="mt-3 text-sm text-muted">
                Suspended {formatDateTime(workspace.suspended_at as string)}
                {workspace.suspended_reason
                  ? ` — ${workspace.suspended_reason}`
                  : ""}
              </p>
            ) : null}
            <div className="mt-4">
              {context.has("workspaces.manage") ? (
                <WorkspaceSuspendControl
                  workspaceId={workspace.id}
                  suspended={suspended}
                />
              ) : (
                <p className="text-sm text-muted">
                  Your role is read-only for workspaces.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Credits
            </h2>
            <p className="mt-1 text-sm text-muted">
              Balance {(credits?.balance ?? 0).toLocaleString("en-US")}
            </p>
            <div className="mt-4">
              {context.has("credits.adjust") ? (
                <CreditControls workspaceId={workspace.id} />
              ) : (
                <p className="text-sm text-muted">
                  Your role cannot change credit balances.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
