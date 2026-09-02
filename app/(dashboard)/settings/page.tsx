import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { signOutAction } from "@/features/auth/actions";
import { getProfile } from "@/features/profile/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { getEntitlementUsage } from "@/features/commerce/enforcement";
import { getPlan } from "@/features/commerce/subscriptions";
import { AccountPanel } from "@/features/settings/account-panel";
import { UpdateEmailForm } from "@/features/settings/update-email-form";
import { UpdatePasswordForm } from "@/features/settings/update-password-form";
import type { PlanId } from "@/features/commerce/types";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

  // Same resolution order the dashboard uses: the commercial state is
  // workspace-scoped, so the workspace resolves first. `getWorkspaceContext`
  // provisions the personal workspace on first read, so a customer arriving
  // here before visiting the dashboard still sees a workspace rather than a
  // gap.
  const { workspace } = await getWorkspaceContext(user.id);

  const [profile, planUsage] = await Promise.all([
    getProfile(user.id),
    getEntitlementUsage(workspace.id),
  ]);

  // The catalog name, not a label map — a renamed plan renames here too.
  const plan = planUsage?.plan ? await getPlan(planUsage.plan as PlanId) : null;

  // A suspended workspace is the more important fact about an account than its
  // subscription status, so it wins when both apply.
  const status = workspace.suspended_at
    ? "suspended"
    : (planUsage?.status ?? null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="text-muted">Manage your account and security.</p>
      </div>

      <div className="flex flex-col gap-6">
        <AccountPanel
          name={profile?.full_name ?? null}
          email={user.email ?? null}
          workspaceName={workspace.name}
          planName={plan?.name ?? planUsage?.plan ?? null}
          status={status}
        />

        <UpdateEmailForm currentEmail={user.email ?? ""} />
        <UpdatePasswordForm />

        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Session
            </h2>
            <p className="mt-1 text-sm text-muted">
              Account created {formatDate(user.created_at)}.
            </p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              <LogOut className="size-4" /> Sign out
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
