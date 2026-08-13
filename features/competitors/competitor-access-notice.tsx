import Link from "next/link";
import { Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CompetitorAccess } from "@/features/competitors/permissions";

/**
 * What a user sees when Competitor Intelligence is not available to them.
 *
 * The copy says what they can do about it and nothing else. It does not name
 * the plan, the entitlement key, the subscription status or which lookup
 * failed — a denial message is a place users report bugs from, so it must not
 * become a description of the billing schema.
 */
export function CompetitorAccessNotice({
  reason,
}: {
  reason: NonNullable<CompetitorAccess["denialReason"]>;
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
          Your role in this workspace lets you read competitor research but not
          start it. Ask an owner or admin to change your role.
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
        Competitor Intelligence is not on your plan
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted">
        Competitor Intelligence finds real competitors from live web sources,
        verifies each one exists, and separates what a company claims from what
        the evidence shows. Upgrade to switch it on for this workspace.
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
