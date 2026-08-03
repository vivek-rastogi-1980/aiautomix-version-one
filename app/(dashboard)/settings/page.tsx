import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { signOutAction } from "@/features/auth/actions";
import { UpdateEmailForm } from "@/features/settings/update-email-form";
import { UpdatePasswordForm } from "@/features/settings/update-password-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="text-muted">Manage your account and security.</p>
      </div>

      <div className="flex flex-col gap-6">
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
