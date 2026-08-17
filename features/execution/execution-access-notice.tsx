import Link from "next/link";
import { Eye, Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Why a user cannot do something, said plainly.
 *
 * The read-only wording is careful: a Viewer CAN see every plan, every action
 * and the whole audit trail. That transparency is deliberate — an audit trail
 * only a privileged few can read is not much of a check on them.
 */
export function ExecutionAccessNotice({
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
          You can read every plan, every action and the full audit trail.
          Creating, approving and running actions changes things outside this
          workspace, so those need an Editor role or above.
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
        Business Execution is not on your plan
      </p>
      <p className="mt-1 max-w-md text-sm text-muted">
        Turn a go-to-market strategy into specific actions, approve the ones
        that reach the outside world, and keep a permanent record of who decided
        what.
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
