import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The advisor's entry point on the customer dashboard (§12).
 *
 * Deliberately a link rather than an inline ask box. A question spends the
 * customer's advisor allowance and produces an answer with actions worth
 * reading properly — squeezing that into a dashboard tile would either truncate
 * the response or turn the dashboard into the advisor page.
 *
 * The copy changes with what the advisor can actually see, so a customer with
 * no plan is told what would make it useful instead of being invited to ask a
 * question it cannot ground in anything.
 */
export function AdvisorEntryPanel({
  hasBusinessPlan,
}: {
  hasBusinessPlan: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="flex items-start gap-4">
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet sm:flex">
          <MessagesSquare className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            AI Business Advisor
          </h2>
          <p className="mt-1 text-sm text-muted">
            {hasBusinessPlan
              ? "Ask questions about your business, strategy or next steps. Your advisor understands your plan and your current progress."
              : "Validate an idea and create a business plan, and your advisor can give guidance grounded in your own business."}
          </p>
        </div>
      </div>

      <Link
        href="/advisor"
        className={cn(
          buttonVariants({
            variant: hasBusinessPlan ? "primary" : "secondary",
            size: "md",
          }),
          "shrink-0",
        )}
      >
        {hasBusinessPlan ? "Ask AI Advisor" : "Open advisor"}
      </Link>
    </Card>
  );
}
