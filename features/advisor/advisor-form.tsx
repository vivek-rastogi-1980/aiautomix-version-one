"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { askAdvisorAction } from "@/features/advisor/actions";
import { idleState } from "@/lib/forms/action-state";
import { ADVISOR_QUESTION_MAX } from "@/lib/validations/business-advisor";

/**
 * The ask box.
 *
 * `SubmitButton` disables itself for the duration through `useFormStatus`, so a
 * question cannot be double-submitted by an impatient click. That is a
 * convenience rather than the guarantee — each question is a genuinely separate
 * billable turn, so the server does not try to deduplicate them; it just must
 * not be easy to fire two by accident.
 *
 * The loading copy names what is actually happening (§29) and never implies a
 * person is typing.
 */
export function AdvisorForm({
  conversationId,
  suggestions,
  disabled,
}: {
  conversationId?: string;
  suggestions?: string[];
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(askAdvisorAction, idleState);
  const [question, setQuestion] = useState("");

  return (
    <Card className="p-5 sm:p-6">
      <form action={formAction} className="flex flex-col gap-3">
        {conversationId ? (
          <input type="hidden" name="conversationId" value={conversationId} />
        ) : null}

        <label
          htmlFor="advisor-question"
          className="font-display text-base font-bold tracking-tight text-foreground"
        >
          What would you like help with?
        </label>

        <Textarea
          id="advisor-question"
          name="question"
          rows={3}
          maxLength={ADVISOR_QUESTION_MAX}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What should I focus on this week?"
          disabled={disabled}
          aria-describedby="advisor-question-hint"
        />

        {state.status === "error" ? (
          <FormAlert variant="error">{state.message}</FormAlert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="advisor-question-hint" className="text-xs text-muted">
            Your advisor reads your validation, plan, roadmap and progress.
          </p>
          <SubmitButton
            size="md"
            disabled={disabled || question.trim().length < 5}
            pendingText="Analysing your business context…"
          >
            <Sparkles className="size-4" /> Ask advisor
          </SubmitButton>
        </div>
      </form>

      {suggestions && suggestions.length > 0 ? (
        <div className="mt-5 border-t border-line-strong pt-4">
          <p className="text-xs uppercase tracking-wider text-muted">
            Suggested questions
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={disabled}
                // Fills the box rather than submitting: §22's spirit is that the
                // customer stays in control of what gets asked, and a one-click
                // spend of their allowance is not that.
                onClick={() => setQuestion(suggestion)}
                className="min-h-11 rounded-full border border-line-strong px-3.5 text-left text-sm text-muted transition-colors hover:bg-fill-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
