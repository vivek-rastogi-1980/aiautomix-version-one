import Link from "next/link";
import { Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FinancialAccess } from "@/features/financials/permissions";

/**
 * What a user sees when Financial Intelligence is not available to them.
 *
 * Says what they can do about it and nothing else — no plan name, no
 * entitlement key, no subscription status.
 */
export function FinancialAccessNotice({
  reason,
}: {
  reason: NonNullable<FinancialAccess["denialReason"]>;
}) {
  if (reason === "read_only") {
    return (
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-fill-2 text-muted-strong">
          <Lock className="size-5" />
        </span>
        <h2 className="mt-4 font-display text-lg font-bold text-foreground">
          Read-only access
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Your role in this workspace lets you read financial models but not
          build one or change its assumptions. Ask an owner or admin to change
          your role.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
        <Lock className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-foreground">
        Financial Intelligence is not on your plan
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted">
        Financial Intelligence turns your business into an explicit set of
        assumptions and then calculates the forecast, unit economics, break-even
        and runway from them — deterministically, so every figure traces back to
        a number you can see and change.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/usage" className={cn(buttonVariants({ size: "md" }))}>
          View plans
        </Link>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
        >
          Back to dashboard
        </Link>
      </div>
    </Card>
  );
}
