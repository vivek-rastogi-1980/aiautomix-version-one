import Link from "next/link";
import { Calculator } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function FinancialNotFound() {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
        <Calculator className="size-7" />
      </span>
      <h1 className="mt-5 font-display text-lg font-bold text-foreground">
        Financial model not found
      </h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        It may have been deleted, or it belongs to a different workspace.
      </p>
      <Link
        href="/financials"
        className={cn(buttonVariants({ size: "md" }), "mt-6")}
      >
        Back to financial models
      </Link>
    </div>
  );
}
