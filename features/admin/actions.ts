"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, assertPermission } from "@/features/admin/guard";
import { BOOKING_STATUSES } from "@/features/admin/lead-vocabulary";
import { TEMPLATE_STATUSES } from "@/features/communications/events";
import { formatBookingSlot } from "@/features/communications/booking-format";
import {
  emitCommunicationEvent,
  sendTemplateTest,
} from "@/features/communications/service";
import {
  safeUrl,
  validateTemplate,
} from "@/features/communications/template-engine";
import { LEAD_STATUSES } from "@/types/database";

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

// ---------------------------------------------------------------------------
// Leads  (migration 0019)
// ---------------------------------------------------------------------------

const leadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Move a lead through the lifecycle.
 *
 * `lead_set_status` writes three things in one transaction: the new status, a
 * `STATUS_CHANGED` row on the lead's own timeline, and an entry in the shared
 * `admin_audit_logs`. That is why the note is worth typing — it is the only
 * part of the record that says *why*, and it cannot be edited afterwards.
 */
export async function setLeadStatus(
  input: z.infer<typeof leadStatusSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "leads.update");

  const parsed = leadStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const { leadId, status, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_set_status", {
    p_lead_id: leadId,
    p_status: status,
    p_note: reason && reason.trim() ? reason.trim() : null,
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  return toResult(error, "Lead status updated.");
}

const leadNoteSchema = z.object({
  leadId: z.string().uuid(),
  note: z.string().trim().min(1, "Write something first.").max(4000),
});

/** Append a note to the lead's timeline. Nothing is ever overwritten. */
export async function addLeadNote(
  input: z.infer<typeof leadNoteSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "leads.update");

  const parsed = leadNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { leadId, note } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_record_event", {
    p_lead_id: leadId,
    p_event: "NOTE_ADDED",
    p_note: note,
    p_metadata: {},
  });

  revalidatePath(`/admin/leads/${leadId}`);
  return toResult(error, "Note added to the timeline.");
}

// ---------------------------------------------------------------------------
// Bookings  (migration 0019)
// ---------------------------------------------------------------------------

const bookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(BOOKING_STATUSES),
  reason: z.string().trim().max(1000).optional(),
  meetingUrl: z.string().trim().max(2000).optional(),
});

/**
 * Move a booking through its state machine, and tell the customer.
 *
 * The email is raised as an EVENT rather than composed here — §9 — so changing
 * what a cancellation says is an edit in Admin → Communications, not a code
 * change. It runs AFTER the status change has committed and its failure is
 * swallowed: a provider outage must not leave the operator believing the
 * cancellation did not take effect when it did.
 *
 * Only CANCELLED raises mail. CONFIRMED and COMPLETED have no template that
 * says anything a customer needs, and inventing one here to make the feature
 * look fuller is exactly the "pretending an automation exists" the brief warns
 * against.
 */
export async function setBookingStatus(
  input: z.infer<typeof bookingStatusSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "bookings.update");

  const parsed = bookingStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const { bookingId, status, reason, meetingUrl } = parsed.data;

  // A meeting link goes into an email and then into a browser. Reject anything
  // that is not http(s) here rather than discovering it in someone's inbox.
  if (meetingUrl && !safeUrl(meetingUrl)) {
    return {
      ok: false,
      message: "That meeting link is not a valid http or https URL.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("booking_set_status", {
    p_booking_id: bookingId,
    p_status: status,
    p_reason: reason && reason.trim() ? reason.trim() : null,
    p_meeting_url: meetingUrl && meetingUrl.trim() ? meetingUrl.trim() : null,
  });

  if (!error && status === "CANCELLED") {
    const { data: booking } = await supabase
      .from("bookings")
      .select("email, full_name, timezone, scheduled_at, user_id, lead_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (booking) {
      void emitCommunicationEvent("BOOKING_CANCELLED", {
        recipientEmail: booking.email,
        userId: booking.user_id,
        leadId: booking.lead_id,
        bookingId,
        variables: {
          "user.first_name": booking.full_name.split(/\s+/)[0] ?? "",
          "user.email": booking.email,
          ...formatBookingSlot(booking.scheduled_at, booking.timezone),
        },
      }).catch((sendError) => {
        console.error("[admin] cancellation email failed", sendError);
      });
    }
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/leads");
  return toResult(error, "Booking updated.");
}

// ---------------------------------------------------------------------------
// Email templates  (migration 0019)
// ---------------------------------------------------------------------------

const templateSaveSchema = z.object({
  templateId: z.string().uuid(),
  subject: z.string().trim().min(1, "A subject is required.").max(300),
  bodyHtml: z.string().trim().min(1, "The body cannot be empty.").max(200_000),
  bodyText: z.string().max(200_000).optional(),
});

/**
 * Save a template, which always creates a NEW version.
 *
 * There is no update path for content and there cannot be one: an append-only
 * trigger on `email_template_versions` rejects UPDATE and DELETE for every
 * role, including super admin, and including a connection that bypasses RLS. A
 * version that has been sent stays exactly as it was sent — otherwise "what did
 * we tell that customer?" becomes unanswerable.
 *
 * Validation runs here before the write so a typo'd `{{user.frist_name}}` is
 * refused at save time rather than shipping as a blank to everyone on the list.
 * It runs AGAIN at send time, because the vocabulary can tighten in between.
 */
export async function saveEmailTemplate(
  input: z.infer<typeof templateSaveSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "communications.write");

  const parsed = templateSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { templateId, subject, bodyHtml, bodyText } = parsed.data;

  const issues = [
    ...validateTemplate(subject).issues,
    ...validateTemplate(bodyHtml).issues,
    ...(bodyText ? validateTemplate(bodyText).issues : []),
  ];
  if (issues.length > 0) {
    return { ok: false, message: issues.map((i) => i.message).join(" ") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("email_template_save", {
    p_template_id: templateId,
    p_subject: subject,
    p_body_html: bodyHtml,
    p_body_text: bodyText && bodyText.trim() ? bodyText : null,
  });

  revalidatePath("/admin/communications");
  revalidatePath(`/admin/communications/${templateId}`);
  return toResult(
    error,
    typeof data === "number"
      ? `Saved as version ${data}. Earlier versions are unchanged.`
      : "Template saved as a new version.",
  );
}

const templateStatusSchema = z.object({
  templateId: z.string().uuid(),
  status: z.enum(TEMPLATE_STATUSES),
});

/**
 * DRAFT / ACTIVE / ARCHIVED.
 *
 * Activating is the consequential one: it is the moment a template starts
 * reaching real customers. The database enforces one ACTIVE template per
 * trigger and demotes any other in the same transaction, so there is never a
 * window in which two could fire.
 *
 * Nothing here deletes. §7 — a template that has been used is versioned, never
 * removed — and there is no delete control anywhere in this feature.
 */
export async function setEmailTemplateStatus(
  input: z.infer<typeof templateStatusSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "communications.write");

  const parsed = templateStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const { templateId, status } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("email_template_set_status", {
    p_template_id: templateId,
    p_status: status,
  });

  if (error && /save some content/i.test(error.message)) {
    return {
      ok: false,
      message: "Save a subject and body before activating this template.",
    };
  }

  revalidatePath("/admin/communications");
  revalidatePath(`/admin/communications/${templateId}`);
  return toResult(error, `Template is now ${status.toLowerCase()}.`);
}

const testSendSchema = z.object({
  templateId: z.string().uuid(),
  recipient: z.string().trim().email("That is not a valid email address."),
});

/**
 * Send a test.
 *
 * §"Send test email" imposes four rules, and each is enforced somewhere below
 * or in `sendTemplateTest`:
 *
 *   explicitly requested   — only reachable by clicking this control
 *   shows TEST in subject  — prefixed after rendering
 *   uses sample data       — `PREVIEW_CONTEXT`, never a real customer's row
 *   triggers no automation — raises no event, writes no `lead_events` row, and
 *                            logs with `is_test = true` so it can never be
 *                            mistaken for customer traffic
 *
 * It sends the version the operator is looking at rather than whatever happens
 * to be ACTIVE: testing a template you cannot see is not a test.
 *
 * `communications.send_test` is a separate grant from `communications.write`
 * because this is the one action in the feature that leaves the building.
 */
export async function sendTestEmail(
  input: z.infer<typeof testSendSchema>,
): Promise<ActionResult> {
  const context = await requireAdmin();
  await assertPermission(context, "communications.send_test");

  const parsed = testSendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { templateId, recipient } = parsed.data;
  const result = await sendTemplateTest(templateId, recipient);

  revalidatePath(`/admin/communications/${templateId}`);

  if (result.status === "SENT") {
    return { ok: true, message: `Test sent to ${recipient}.` };
  }
  return {
    ok: false,
    message:
      result.reason ?? "The test could not be sent. The attempt is in the log.",
  };
}
