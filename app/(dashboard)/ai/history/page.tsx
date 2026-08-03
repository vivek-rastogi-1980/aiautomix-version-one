import type { Metadata } from "next";

import { getAiRuns } from "@/features/ai/history/data";
import { RunList } from "@/features/ai/history/run-list";
import { getUsageSummary } from "@/features/ai/usage/data";
import { UsageSummaryPanel } from "@/features/ai/usage/usage-summary";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "AI activity",
  description: "Every AI workflow run, with usage and cost metrics.",
};

/**
 * AI History + Usage (AI-HISTORY-SPEC.md, USAGE-TRACKING-SPEC.md).
 *
 * Platform-level, not product-level: every workflow that runs through the
 * Workflow Manager appears here, so future AI products need no history UI of
 * their own.
 */
export default async function AiHistoryPage() {
  const user = await requireUser();

  const [runs, usage] = await Promise.all([
    getAiRuns(user.id),
    getUsageSummary(user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          AI activity
        </h1>
        <p className="text-muted">
          Every workflow the AI platform has run for you, with the prompt
          version, model and cost behind it.
        </p>
      </div>

      <UsageSummaryPanel summary={usage} />

      <section
        aria-labelledby="history-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="history-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Execution history
        </h2>
        <RunList runs={runs} />
      </section>
    </div>
  );
}
