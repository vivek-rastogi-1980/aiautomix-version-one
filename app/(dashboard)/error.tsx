"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for every dashboard route. Keeps the shell intact and offers a
 * retry rather than dropping the user on a blank page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] route error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-danger/30 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger-soft">
        <AlertCircle className="size-7" />
      </span>
      <h1 className="mt-5 font-display text-lg font-bold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        We couldn&apos;t load this page. Try again — if the problem persists,
        please contact support.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
