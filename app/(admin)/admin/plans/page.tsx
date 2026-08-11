import type { Metadata } from "next";

import { requirePermission } from "@/features/admin/guard";
import { listAllPlans } from "@/features/admin/data";
import {
  PageHeader,
  TableShell,
  Th,
  Td,
  EmptyState,
} from "@/features/admin/ui";
import { PlanEditor } from "@/features/admin/plan-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/features/commerce/subscriptions";

export const metadata: Metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

/**
 * The commercial plan catalog.
 *
 * Reads and writes go through the Sprint 6.5 data model — this page adds no
 * plan logic of its own. Editing calls `admin_update_plan`, which audits the
 * before/after snapshot; `/pricing` reads the same rows at request time, so a
 * change here is live without a deploy.
 */
export default async function AdminPlansPage() {
  const context = await requirePermission("plans.read");
  const plans = await listAllPlans();
  const canManage = context.has("plans.manage");

  return (
    <>
      <PageHeader
        title="Plans"
        description="Centrally configured commercial plans. Changes take effect immediately on the pricing page."
      />

      {plans.length === 0 ? (
        <EmptyState title="No plans configured." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Plan</Th>
              <Th>Price</Th>
              <Th>Credits / month</Th>
              <Th>Visibility</Th>
              {canManage ? <Th className="text-right">&nbsp;</Th> : null}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-white/[0.02]">
                <Td>
                  <span className="font-medium">{plan.name}</span>
                  <p className="mt-0.5 max-w-md text-xs text-muted">
                    {plan.description}
                  </p>
                </Td>
                <Td>{formatPrice(plan.price_monthly, plan.currency)}</Td>
                <Td className="text-muted">
                  {plan.monthly_credits.toLocaleString("en-US")}
                </Td>
                <Td>
                  <Badge variant={plan.is_public ? "active" : "neutral"}>
                    {plan.is_public ? "Public" : "Hidden"}
                  </Badge>
                </Td>
                {canManage ? (
                  <Td className="text-right align-top">
                    <PlanEditor plan={plan} />
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {!canManage ? (
        <Card className="mt-6 p-5">
          <p className="text-sm text-muted">
            Editing plans requires{" "}
            <code className="text-foreground">plans.manage</code>, which is held
            by super admins only. Changing a price affects every prospective
            customer, so it sits outside day-to-day operations.
          </p>
        </Card>
      ) : null}
    </>
  );
}
