"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, HelpCircle, Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createTaskFromAdvice } from "@/features/advisor/actions";
import { businessAdvisorResponseSchema } from "@/features/ai/schemas/business-advisor";
import { cn } from "@/lib/utils";

/**
 * One advisor answer, rendered with hierarchy rather than as a chat bubble.
 *
 * §27: the recommendation leads, the reasoning follows, the actions are a list
 * you can act on. A wall of prose would bury the one sentence the customer
 * actually needs.
 *
 * The stored response is re-validated before rendering, the same way every
 * other stored AI document in this codebase is: an answer written by an older
 * prompt version degrades to its plain text rather than crashing the thread.
 */
export function AdviceCard({
  response,
  fallbackText,
  canCreateTasks,
}: {
  response: unknown;
  fallbackText: string;
  canCreateTasks: boolean;
}) {
  const parsed = businessAdvisorResponseSchema.safeParse(response);

  if (!parsed.success) {
    return (
      <Card className="p-5 sm:p-6">
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {fallbackText}
        </p>
      </Card>
    );
  }

  const advice = parsed.data;

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-bold tracking-tight text-foreground">
            {advice.recommendation ? "Recommendation" : "Answer"}
          </h3>
          {advice.priority ? (
            <Badge variant={advice.priority === "HIGH" ? "active" : "neutral"}>
              {advice.priority}
            </Badge>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {advice.recommendation ?? advice.answer}
        </p>
        {advice.recommendation ? (
          <p className="mt-2 text-sm text-muted">{advice.answer}</p>
        ) : null}
      </div>

      {advice.reasoning ? (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted">Why</h4>
          <p className="mt-1 text-sm text-muted">{advice.reasoning}</p>
        </div>
      ) : null}

      {advice.actions.length > 0 ? (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted">
            Next actions
          </h4>
          <ol className="mt-2 flex flex-col gap-3">
            {advice.actions.map((action, index) => (
              <li
                key={action.title}
                className="flex flex-col gap-2 rounded-xl border border-line-strong p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {action.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{action.reason}</p>
                </div>
                {canCreateTasks ? (
                  <CreateTaskButton
                    title={action.title}
                    reason={action.reason}
                    priority={action.priority}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {advice.risks.length > 0 ? (
        <div>
          <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
            <AlertTriangle className="size-3.5" /> Risks
          </h4>
          <ul className="mt-1 flex flex-col gap-1">
            {advice.risks.map((risk) => (
              <li key={risk} className="text-sm text-muted">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {advice.metrics.length > 0 ? (
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted">
            What to measure
          </h4>
          <ul className="mt-1 flex flex-col gap-1">
            {advice.metrics.map((metric) => (
              <li key={metric} className="text-sm text-muted">
                {metric}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* The honest-uncertainty channel. Shown plainly so the customer can see
          what the advice was NOT based on. */}
      {advice.missing_context.length > 0 ? (
        <div className="rounded-xl border border-line-strong bg-fill-1 p-3">
          <h4 className="text-xs uppercase tracking-wider text-muted">
            Not enough information about
          </h4>
          <ul className="mt-1 flex flex-col gap-1">
            {advice.missing_context.map((item) => (
              <li key={item} className="text-sm text-muted">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {advice.follow_up_question ? (
        <p className="flex items-start gap-2 text-sm text-muted">
          <HelpCircle className="mt-0.5 size-4 shrink-0 text-brand-violet" />
          {advice.follow_up_question}
        </p>
      ) : null}
    </Card>
  );
}

/** Adds one recommended action to the existing roadmap. */
function CreateTaskButton({
  title,
  reason,
  priority,
}: {
  title: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  if (result?.ok) {
    return (
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm text-accent">
        <Check className="size-4" /> Added
      </span>
    );
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(await createTaskFromAdvice({ title, reason, priority }));
          })
        }
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm text-foreground transition-colors hover:bg-fill-3 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        Create task
      </button>
      {result && !result.ok ? (
        <p role="status" className="mt-1 max-w-48 text-xs text-red-300">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
