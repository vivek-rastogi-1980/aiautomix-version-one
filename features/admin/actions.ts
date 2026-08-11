"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, assertPermission } from "@/features/admin/guard";

/**
 * Admin mutations.
 *
 * Every action follows the same four steps, in this order:
 *
 *   1. `requireAdmin()`    — resolve identity server-side from `auth.uid()`.
 *   2. `assertPermission()`— fail fast with a legible message.
 *   3. Validate the input with Zod.
 *   4. Call the matching `security definer` RPC.
 *
 * Step 4 is where authorization is actually *enforced*: each RPC re-checks the
 * permission inside Postgres and writes the audit row in the same transaction
 * as the change. Steps 1–3 exist to give a good error, not to be the gate. If
 * every line of this file were deleted, the database would still refuse an
 * unauthorized credit adjustment — that is the property worth having.
 *
 * The corollary is that these actions never compute a new balance, never write
 * an audit row themselves, and never accept a role or permission from the
 * client.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Turn a Postgres error into something an operator can act on.
 *
 * The raw message can carry schema detail, so only the recognised, safe cases
 * are surfaced verbatim; anything else becomes a generic failure. The full
 * error still reaches the server log.
 */
function toResult(
  error: { message: string } | null,
  success: string,
): ActionResult {
  if (!error) return { ok: true, message: success };

  const raw = error.message ?? "";
  if (/permission denied/i.test(raw)) {
    return { ok: false, message: "You do not have permission to do that." };
  }
  if (/reason is required/i.test(raw)) {
    return { ok: false, message: "A reason is required." };
  }
  if (/insufficient credits/i.test(raw)) {
    return { ok: false, message: "That would put the balance below zero." };
  }
  if (/not found/i.test(raw)) {
    return { ok: false, message: "That record no longer exists." };
  }

  console.error("[admin] action failed", raw);
  return {
    ok: false,
    message: "That did not work. The error has been logged.",
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const suspendUserSchema = z.object({
  userId: z.string().uuid(),
  suspended: z.boolean(),
  // Required to suspend, ignored when restoring. The database enforces this
  // too — this is the friendly copy of the same rule.
  reason: z.string().trim().max(500).optional(),
});

export async function setUserSuspended(
  input: z.infer<typeof suspendUserSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "users.manage");

  const parsed = suspendUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const { userId, suspended, reason } = parsed.data;
  if (suspended && !reason) {
    return { ok: false, message: "A reason is required to suspend a user." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_suspended", {
    p_user_id: userId,
    p_suspended: suspended,
    p_reason: reason ?? null,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return toResult(error, suspended ? "User suspended." : "User restored.");
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

const suspendWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export async function setWorkspaceSuspended(
  input: z.infer<typeof suspendWorkspaceSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "workspaces.manage");

  const parsed = suspendWorkspaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const { workspaceId, suspended, reason } = parsed.data;
  if (suspended && !reason) {
    return {
      ok: false,
      message: "A reason is required to suspend a workspace.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_workspace_suspended", {
    p_workspace_id: workspaceId,
    p_suspended: suspended,
    p_reason: reason ?? null,
  });

  revalidatePath("/admin/workspaces");
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return toResult(
    error,
    suspended ? "Workspace suspended." : "Workspace restored.",
  );
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

const creditSchema = z.object({
  workspaceId: z.string().uuid(),
  kind: z.enum(["GRANT", "ADJUSTMENT", "REFUND"]),
  // Bounded on both sides. An unbounded integer here is a typo away from
  // granting a billion credits, and the ledger is append-only — the mistake
  // would have to be corrected, never erased.
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, "Amount cannot be zero.")
    .refine((n) => Math.abs(n) <= 1_000_000, "Amount is implausibly large."),
  reason: z.string().trim().min(3, "A reason is required.").max(500),
});

export async function applyCredits(
  input: z.infer<typeof creditSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "credits.adjust");

  const parsed = creditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { workspaceId, kind, amount, reason } = parsed.data;

  // GRANT and REFUND add; ADJUSTMENT may go either way. Normalising the sign
  // here means the operator types a magnitude and picks an intent, rather than
  // having to reason about whether a refund is negative.
  const signed = kind === "ADJUSTMENT" ? amount : Math.abs(amount);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_apply_credits", {
    p_workspace_id: workspaceId,
    p_kind: kind,
    p_amount: signed,
    p_reason: reason,
  });

  revalidatePath("/admin/credits");
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return toResult(
    error,
    "Credit change applied and recorded in the audit log.",
  );
}

// ---------------------------------------------------------------------------
// Plans & entitlements  (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

const planSchema = z.object({
  planId: z.string().min(1).max(50),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
  priceMonthly: z.number().int().min(0).max(10_000_00).nullable(),
  monthlyCredits: z.number().int().min(0).max(10_000_000),
  isPublic: z.boolean(),
  reason: z.string().trim().min(3, "A reason is required.").max(500),
});

export async function updatePlan(
  input: z.infer<typeof planSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "plans.manage");

  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const p = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_plan", {
    p_plan_id: p.planId,
    p_name: p.name,
    p_description: p.description,
    p_price_monthly: p.priceMonthly,
    p_monthly_credits: p.monthlyCredits,
    p_is_public: p.isPublic,
    p_reason: p.reason,
  });

  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return toResult(error, "Plan updated.");
}

const entitlementSchema = z.object({
  planId: z.string().min(1).max(50),
  feature: z.string().min(1).max(60),
  enabled: z.boolean(),
  // null = unlimited, 0 = denied. The distinction is load-bearing, so the
  // field is nullable rather than defaulted.
  limit: z.number().int().min(0).max(1_000_000).nullable(),
  reason: z.string().trim().min(3, "A reason is required.").max(500),
});

export async function updateEntitlement(
  input: z.infer<typeof entitlementSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "entitlements.manage");

  const parsed = entitlementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const e = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_entitlement", {
    p_plan_id: e.planId,
    p_feature: e.feature,
    p_enabled: e.enabled,
    p_limit: e.limit,
    p_reason: e.reason,
  });

  revalidatePath("/admin/entitlements");
  revalidatePath("/pricing");
  return toResult(error, "Entitlement updated.");
}
