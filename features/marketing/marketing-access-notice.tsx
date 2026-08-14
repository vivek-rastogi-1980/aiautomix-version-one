import Link from "next/link";
import { Lock, Eye } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Why a user cannot do something, said plainly.
 *
 * Two different refusals with two different remedies. Collapsing them into one
 * "access denied" would send a Viewer to the pricing page to buy a plan their
 * workspace already has.
 */
export function MarketingAccessNotice({
  reason,
}: {
  reason: "not_entitled" | "read_only";
}) {
  if (reason === "read_only") {
    return (
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-fill-2 text-muted-strong">
          <Eye className="size-6" />
        </span>
        <p className="mt-4 font-display text-lg font-bold text-foreground">
          Read-only access
        </p>
        <p className="mt-1 max-w-md text-sm text-muted">
          You can read every go-to-market plan in this workspace. Running a
          stage spends the workspace&apos;s credits, so it needs an Editor role
          or above.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
        <Lock className="size-6" />
      </span>
      <p className="mt-4 font-display text-lg font-bold text-foreground">
        Marketing Intelligence is not on your plan
      </p>
      <p className="mt-1 max-w-md text-sm text-muted">
        Eight stages that turn your research, competitor and financial work into
        an evidence-backed go-to-market plan: who to target, what to say, where
        to reach them, what it should cost, and what to do in the first ninety
        days.
      </p>
      <Link
        href="/usage"
        className={cn(buttonVariants({ size: "md" }), "mt-6")}
      >
        View plans
      </Link>
    </Card>
  );
}
