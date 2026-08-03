import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ReportNotFound() {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
        <FileQuestion className="size-7" />
      </span>
      <h1 className="mt-5 font-display text-lg font-bold text-foreground">
        Report not found
      </h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        This report doesn&apos;t exist, or it belongs to another account.
      </p>
      <Link
        href="/reports"
        className={cn(buttonVariants({ size: "md" }), "mt-6")}
      >
        Back to reports
      </Link>
    </div>
  );
}
