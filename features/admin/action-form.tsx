"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import type { ActionResult } from "@/features/admin/actions";

/**
 * Confirmation form for a sensitive admin mutation.
 *
 * Two deliberate frictions, both from ADMIN-SECURITY-SPEC.md ("Safe
 * confirmation for sensitive mutations") and ADMIN-AUDIT-LOG-SPEC.md ("Manual
 * credit mutations require a reason"):
 *
 *   1. The destructive variant is not armed until the operator clicks once to
 *      reveal it. A misclick on a table row cannot suspend an account.
 *   2. The reason is typed, not chosen from a list. It lands verbatim in the
 *      audit row, and boilerplate options would produce an audit trail where
 *      every entry says "other".
 *
 * Neither is a security control. The database refuses the same operation
 * without a reason or without the permission — this is the part that makes the
 * refusal unlikely to be needed.
 */

interface ActionFormProps {
  /** Button label in the resting state. */
  label: string;
  /** Heading shown once the form is armed. */
  confirmTitle: string;
  confirmBody: string;
  /** Submit label in the armed state. */
  confirmLabel: string;
  /** Red styling for suspend/removal; neutral otherwise. */
  destructive?: boolean;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  /** Extra numeric input, used by the credit form. */
  amount?: {
    label: string;
    placeholder?: string;
    allowNegative?: boolean;
  };
  onSubmit: (input: {
    reason: string;
    amount?: number;
  }) => Promise<ActionResult>;
}

export function ActionForm({
  label,
  confirmTitle,
  confirmBody,
  confirmLabel,
  destructive = false,
  reasonRequired = true,
  reasonPlaceholder = "Why are you doing this?",
  amount,
  onSubmit,
}: ActionFormProps) {
  const [armed, setArmed] = useState(false);
  const [reason, setReason] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedAmount = amount ? Number.parseInt(amountValue, 10) : undefined;
  const amountValid =
    !amount ||
    (Number.isFinite(parsedAmount) &&
      parsedAmount !== 0 &&
      (amount.allowNegative || (parsedAmount ?? 0) > 0));

  const canSubmit =
    (!reasonRequired || reason.trim().length >= 3) && amountValid && !pending;

  function submit() {
    startTransition(async () => {
      const res = await onSubmit({
        reason: reason.trim(),
        amount: parsedAmount,
      });
      setResult(res);
      if (res.ok) {
        setArmed(false);
        setReason("");
        setAmountValue("");
      }
    });
  }

  if (!armed) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setArmed(true);
            setResult(null);
          }}
          className={cn(
            "self-start rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            destructive
              ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
              : "border-line-strong text-foreground hover:bg-fill-3",
          )}
        >
          {label}
        </button>
        {result ? (
          <p
            role="status"
            className={cn(
              "text-sm",
              result.ok ? "text-accent" : "text-red-300",
            )}
          >
            {result.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        destructive
          ? "border-red-500/30 bg-red-500/[0.04]"
          : "border-line-strong",
      )}
    >
      <p className="text-sm font-semibold text-foreground">{confirmTitle}</p>
      <p className="mt-1 text-sm text-muted">{confirmBody}</p>

      {amount ? (
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            {amount.label}
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={amountValue}
            onChange={(e) => setAmountValue(e.target.value)}
            placeholder={amount.placeholder}
            className="h-10 w-48 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground focus:border-brand-violet focus:outline-none"
          />
        </label>
      ) : null}

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Reason {reasonRequired ? "(required)" : "(optional)"}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={reasonPlaceholder}
          className="rounded-lg border border-line-strong bg-fill-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none"
        />
        <span className="text-xs text-muted-strong">
          Recorded permanently in the audit log. It cannot be edited later.
        </span>
      </label>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            destructive
              ? "bg-red-500/90 text-white hover:bg-red-500"
              : "bg-fill-5 text-foreground hover:bg-fill-6",
          )}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setArmed(false);
            setReason("");
            setAmountValue("");
          }}
          className="rounded-full px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {result && !result.ok ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
