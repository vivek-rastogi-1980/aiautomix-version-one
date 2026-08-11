import type { Metadata } from "next";

import { requirePermission } from "@/features/admin/guard";
import { listAllPlans, listAllEntitlements } from "@/features/admin/data";
import {
  PageHeader,
  TableShell,
  Th,
  Td,
  EmptyState,
} from "@/features/admin/ui";
import { EntitlementEditor } from "@/features/admin/plan-controls";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Entitlements" };
export const dynamic = "force-dynamic";

/**
 * What each plan includes.
 *
 * The three states a cell can hold are deliberately distinct, and the display
 * keeps them distinct:
 *
 *   Unlimited   `limit_value IS NULL` and enabled
 *   A cap       a number
 *   Not included disabled, or a limit of 0
 *
 * Collapsing "unlimited" and "denied" into a falsy check is the classic bug in
 * entitlement systems — it silently gives away the most expensive tier.
 */
export default async function AdminEntitlementsPage() {
  const context = await requirePermission("entitlements.read");
  const [plans, entitlements] = await Promise.all([
    listAllPlans(),
    listAllEntitlements(),
  ]);

  const canManage = context.has("entitlements.manage");

  // feature -> planId -> entitlement
  const byFeature = new Map<
    string,
    Map<string, { is_enabled: boolean; limit_value: number | null }>
  >();
  for (const entitlement of entitlements) {
    if (!byFeature.has(entitlement.feature)) {
      byFeature.set(entitlement.feature, new Map());
    }
    byFeature.get(entitlement.feature)?.set(entitlement.plan_id, {
      is_enabled: entitlement.is_enabled,
      limit_value: entitlement.limit_value,
    });
  }

  const features = [...byFeature.keys()].sort();

  return (
    <>
      <PageHeader
        title="Entitlements"
        description="Feature access and limits per plan. Blank means unlimited; zero means not included."
      />

      {features.length === 0 ? (
        <EmptyState title="No entitlements configured." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Feature</Th>
              {plans.map((plan) => (
                <Th key={plan.id}>{plan.name}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature} className="hover:bg-white/[0.02]">
                <Td className="font-medium">{feature.replace(/_/g, " ")}</Td>
                {plans.map((plan) => {
                  const entry = byFeature.get(feature)?.get(plan.id);
                  const denied =
                    !entry || !entry.is_enabled || entry.limit_value === 0;

                  return (
                    <Td key={plan.id} className="align-top">
                      {denied ? (
                        <span className="text-muted-strong">Not included</span>
                      ) : entry.limit_value === null ? (
                        <span className="text-brand-cyan">Unlimited</span>
                      ) : (
                        <span>{entry.limit_value.toLocaleString("en-US")}</span>
                      )}
                      {canManage && entry ? (
                        <div className="mt-1.5">
                          <EntitlementEditor
                            planId={plan.id}
                            feature={feature}
                            enabled={entry.is_enabled}
                            limit={entry.limit_value}
                          />
                        </div>
                      ) : null}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {!canManage ? (
        <Card className="mt-6 p-5">
          <p className="text-sm text-muted">
            Editing entitlements requires{" "}
            <code className="text-foreground">entitlements.manage</code>, held
            by super admins only.
          </p>
        </Card>
      ) : null}
    </>
  );
}
