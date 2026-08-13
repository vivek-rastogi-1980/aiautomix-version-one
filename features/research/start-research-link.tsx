import Link from "next/link";
import { Microscope } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Start market research" from a business idea or a business plan.
 *
 * It links to `/research/new` with the id in the query string rather than
 * creating anything. Two reasons: the user must be able to edit the scope
 * before committing credits, and a GET that creates a row is a link a browser
 * prefetch can fire by accident.
 *
 * The link is not hidden when the workspace lacks the entitlement. `/research/new`
 * resolves the caller's plan and shows the upgrade panel — one place that
 * decides, and a user who cannot use the feature learns why rather than finding
 * a button that quietly does not exist.
 */
export function StartResearchLink({
  ideaId,
  planId,
  className,
}: {
  ideaId?: string;
  planId?: string;
  className?: string;
}) {
  const query = ideaId
    ? `?ideaId=${ideaId}`
    : planId
      ? `?planId=${planId}`
      : "";

  return (
    <Link
      href={`/research/new${query}`}
      className={cn(
        buttonVariants({ variant: "secondary", size: "md" }),
        className,
      )}
    >
      <Microscope className="size-4" /> Start market research
    </Link>
  );
}
