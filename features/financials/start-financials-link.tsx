import Link from "next/link";
import { Calculator } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Build financials" from a business idea or a business plan.
 *
 * Links to `/financials/new` with the id in the query string rather than
 * creating anything: the user must be able to set the currency and revenue
 * model before anything is committed, and a GET that creates a row is a link a
 * browser prefetch can fire by accident.
 */
export function StartFinancialsLink({
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
      href={`/financials/new${query}`}
      className={cn(
        buttonVariants({ variant: "secondary", size: "md" }),
        className,
      )}
    >
      <Calculator className="size-4" /> Build financials
    </Link>
  );
}
