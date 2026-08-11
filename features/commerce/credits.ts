import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  CreditAccount,
  CreditKind,
  CreditTransaction,
} from "@/features/commerce/types";

/**
 * Credit engine (CREDIT-ENGINE-SPEC.md).
 *
 * Every mutation goes through one database function,
 * `public.apply_credit_transaction`, which row-locks the account, rejects an
 * overdraw, writes the immutable ledger and absorbs retries by idempotency key.
 *
 * This module is a thin, typed wrapper over that function and does no
 * arithmetic of its own. That is the important property: balance maths in
 * TypeScript would be a read-modify-write across a network boundary, and two
 * concurrent debits would race. Doing it in SQL under `for update` is what
 * makes "atomic" true rather than aspirational.
 *
 * Nothing here is callable from a browser. Migration 0007 grants no write
 * policy on `credit_accounts` or `credit_transactions` to any client role, so
 * a tampered request cannot move a balance even if it reaches the database.
 */

export interface CreditMutation {
  workspaceId: string;
  /** Positive credits the account, negative debits it. Never zero. */
  amount: number;
  reason?: string;
  workflow?: string;
  aiRequestId?: string;
  /** The acting user, when there is one. Null for system operations. */
  createdBy?: string;
  /**
   * Stable key for a retryable operation. Reusing it returns the original
   * balance instead of applying the change twice — which is what stops a
   * network retry from charging a customer twice for one AI run.
   */
  idempotencyKey?: string;
}

export type CreditResult =
  | { ok: true; balance: number }
  | { ok: false; error: "insufficient_credits" | "failed"; message: string };

async function applyTransaction(
  kind: CreditKind,
  mutation: CreditMutation,
): Promise<CreditResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("apply_credit_transaction", {
    p_workspace_id: mutation.workspaceId,
    p_kind: kind,
    p_amount: mutation.amount,
    p_reason: mutation.reason ?? null,
    p_workflow: mutation.workflow ?? null,
    p_ai_request_id: mutation.aiRequestId ?? null,
    p_created_by: mutation.createdBy ?? null,
    p_idempotency_key: mutation.idempotencyKey ?? null,
  });

  if (error) {
    // The function raises with errcode check_violation on an overdraw. Map it
    // to a distinct result so callers can tell "no money" from "broken", which
    // are very different things to show a user.
    const insufficient =
      error.code === "23514" || /insufficient credits/i.test(error.message);
    return insufficient
      ? {
          ok: false,
          error: "insufficient_credits",
          message: "Not enough credits for this operation.",
        }
      : {
          ok: false,
          error: "failed",
          message: "Could not apply the credit change.",
        };
  }

  return { ok: true, balance: data as number };
}

/** Add credits — a plan allowance, a purchased pack, or goodwill. */
export function grantCredits(mutation: CreditMutation): Promise<CreditResult> {
  return applyTransaction("GRANT", {
    ...mutation,
    amount: Math.abs(mutation.amount),
  });
}

/** Spend credits. Rejected rather than allowed to go negative. */
export function debitCredits(mutation: CreditMutation): Promise<CreditResult> {
  return applyTransaction("DEBIT", {
    ...mutation,
    amount: -Math.abs(mutation.amount),
  });
}

/** Return credits after a failed or reversed operation. */
export function refundCredits(mutation: CreditMutation): Promise<CreditResult> {
  return applyTransaction("REFUND", {
    ...mutation,
    amount: Math.abs(mutation.amount),
  });
}

/**
 * Manual correction, in either direction.
 *
 * The ledger cannot be edited or deleted, so this is how a mistake is undone —
 * by adding a compensating row that says what happened and why, leaving the
 * original visible. `reason` is required for exactly that reason.
 */
export function adjustCredits(
  mutation: CreditMutation & { reason: string },
): Promise<CreditResult> {
  return applyTransaction("ADJUSTMENT", mutation);
}

/** Expire unused credits at the end of a period. */
export function expireCredits(mutation: CreditMutation): Promise<CreditResult> {
  return applyTransaction("EXPIRATION", {
    ...mutation,
    amount: -Math.abs(mutation.amount),
  });
}

/**
 * Read the balance. Server-side only — a browser-supplied balance is never
 * trusted anywhere in this codebase, and there is no endpoint that accepts one.
 */
export async function getCreditAccount(
  workspaceId: string,
): Promise<CreditAccount | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_accounts")
    .select("workspace_id, balance, lifetime_granted, lifetime_spent")
    .eq("workspace_id", workspaceId)
    .maybeSingle<CreditAccount>();
  return data ?? null;
}

/** Recent ledger entries, newest first. */
export async function getCreditHistory(
  workspaceId: string,
  limit = 20,
): Promise<CreditTransaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_transactions")
    .select(
      "id, workspace_id, kind, amount, balance_after, reason, workflow, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CreditTransaction[];
}
