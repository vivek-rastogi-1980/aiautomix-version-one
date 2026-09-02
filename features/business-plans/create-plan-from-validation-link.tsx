import Link from "next/link";
import { NotebookPen } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Create business plan" from a completed validation report.
 *
 * Deliberately a LINK to `/plans/new?validation_report_id=…`, not a button that
 * creates something. This mirrors `StartResearchLink`, and the reasoning is the
 * same in both places, with one addition that matters more here:
 *
 *   1. The customer must be able to edit the brief before committing a plan
 *      from their monthly allowance.
 *   2. A GET that writes is a request a browser prefetch can fire by accident.
 *   3. Because the click creates nothing, double-clicking, refreshing,
 *      restoring the tab or opening it three times cannot produce duplicate
 *      plans. There is no request to make idempotent — the only write is the
 *      existing form submission, which already reserves its allowance
 *      atomically through `entitlement_consume`.
 *
 * The link is not hidden when the workspace is out of plan allowance.
 * `/plans/new` and the Server Action behind it resolve the caller's
 * entitlement and say so — one place decides, and a customer who cannot
 * proceed learns why instead of finding a button that quietly does nothing.
 */
export function CreatePlanFromValidationLink({
  validationReportId,
  existingPlanId,
  className,
}: {
  validationReportId: string;
  /** When set, this report already produced a plan; offer that instead. */
  existingPlanId?: string;
  className?: string;
}) {
  if (existingPlanId) {
    return (
      <Link
        href={`/plans/${existingPlanId}`}
        className={cn(
          buttonVariants({ variant: "secondary", size: "md" }),
          className,
        )}
      >
        <NotebookPen className="size-4" /> View business plan
      </Link>
    );
  }

  return (
    <Link
      href={`/plans/new?validation_report_id=${validationReportId}`}
      className={cn(buttonVariants({ size: "md" }), className)}
    >
      <NotebookPen className="size-4" /> Create business plan
    </Link>
  );
}
