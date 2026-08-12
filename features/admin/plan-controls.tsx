"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { updatePlan, updateEntitlement } from "@/features/admin/actions";
import type { ActionResult } from "@/features/admin/actions";

/**
 * Edit forms for plans and entitlements.
 *
 * Rendered only for SUPER_ADMIN — but that is a courtesy. `plans.manage` and
 * `entitlements.manage` are checked in the Server Action and again inside the
 * `security definer` function, so a lesser role that reached these controls
 * (by any route) still cannot commit a change.
 *
 * Both forms require a reason for the same reason credit changes do: a price
 * change is a commercial act that someone will later need to explain.
 */

const INPUT =
  "h-10 w-full rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none";

function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={cn("mt-2 text-sm", result.ok ? "text-accent" : "text-red-300")}
    >
      {result.message}
    </p>
  );
}

export function PlanEditor({
  plan,
}: {
  plan: {
    id: string;
    name: string;
    description: string;
    price_monthly: number | null;
    monthly_credits: number;
    is_public: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  // Prices are stored in minor units; the operator edits whole currency units.
  const [price, setPrice] = useState(
    plan.price_monthly === null ? "" : String(plan.price_monthly / 100),
  );
  const [credits, setCredits] = useState(String(plan.monthly_credits));
  const [isPublic, setIsPublic] = useState(plan.is_public);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-foreground hover:bg-fill-3"
        >
          Edit
        </button>
        <Result result={result} />
      </>
    );
  }

  const priceMinor =
    price.trim() === "" ? null : Math.round(Number.parseFloat(price) * 100);
  const creditsValue = Number.parseInt(credits, 10);

  const valid =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    reason.trim().length >= 3 &&
    Number.isFinite(creditsValue) &&
    creditsValue >= 0 &&
    (priceMinor === null || (Number.isFinite(priceMinor) && priceMinor >= 0));

  return (
    <div className="rounded-xl border border-line-strong p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-muted">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-muted">
            Price / month (blank = quote only)
          </span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="29"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs uppercase tracking-wider text-muted">
            Description
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-muted">
            Monthly credits
          </span>
          <input
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            inputMode="numeric"
            className={INPUT}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="size-4 rounded border-white/20 bg-fill-1"
          />
          <span className="text-sm text-foreground">
            Show on the pricing page
          </span>
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted">
          Reason (required)
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Q3 pricing review"
          className={INPUT}
        />
      </label>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!valid || pending}
          onClick={() =>
            start(async () => {
              const res = await updatePlan({
                planId: plan.id,
                name: name.trim(),
                description: description.trim(),
                priceMonthly: priceMinor,
                monthlyCredits: creditsValue,
                isPublic,
                reason: reason.trim(),
              });
              setResult(res);
              if (res.ok) setOpen(false);
            })
          }
          className="rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-6 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save plan"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <Result result={result} />
    </div>
  );
}

export function EntitlementEditor({
  planId,
  feature,
  enabled,
  limit,
}: {
  planId: string;
  feature: string;
  enabled: boolean;
  limit: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);
  // "" means unlimited (NULL). "0" means denied. The two are different states
  // and the input keeps them distinguishable rather than collapsing to falsy.
  const [limitValue, setLimitValue] = useState(
    limit === null ? "" : String(limit),
  );
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-accent hover:underline"
        >
          Edit
        </button>
        <Result result={result} />
      </>
    );
  }

  const parsed =
    limitValue.trim() === "" ? null : Number.parseInt(limitValue, 10);
  const valid =
    reason.trim().length >= 3 &&
    (parsed === null || (Number.isFinite(parsed) && parsed >= 0));

  return (
    <div className="rounded-lg border border-line-strong p-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
          className="size-4 rounded border-white/20 bg-fill-1"
        />
        <span className="text-sm text-foreground">Enabled</span>
      </label>

      <label className="mt-2 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-muted">
          Limit (blank = unlimited, 0 = denied)
        </span>
        <input
          value={limitValue}
          onChange={(e) => setLimitValue(e.target.value)}
          inputMode="numeric"
          placeholder="unlimited"
          className={cn(INPUT, "w-40")}
        />
      </label>

      <label className="mt-2 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-muted">
          Reason
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={INPUT}
        />
      </label>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!valid || pending}
          onClick={() =>
            start(async () => {
              const res = await updateEntitlement({
                planId,
                feature,
                enabled: isEnabled,
                limit: parsed,
                reason: reason.trim(),
              });
              setResult(res);
              if (res.ok) setOpen(false);
            })
          }
          className="rounded-full bg-fill-5 px-3.5 py-1.5 text-sm text-foreground hover:bg-fill-6 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <Result result={result} />
    </div>
  );
}
