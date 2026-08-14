import Link from "next/link";
import { Megaphone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Build GTM plan" from a business idea or a business plan.
 *
 * Links to `/marketing/new` with the id in the query string rather than
 * creating anything: the user must be able to set the currency and link a
 * financial model before anything is committed, and a GET that creates a row is
 * a link a browser prefetch can fire by accident.
 */
export function StartMarketingLink({
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
      href={`/marketing/new${query}`}
      className={cn(
        buttonVariants({ variant: "secondary", size: "md" }),
        className,
      )}
    >
      <Megaphone className="size-4" /> Build GTM plan
    </Link>
  );
}
