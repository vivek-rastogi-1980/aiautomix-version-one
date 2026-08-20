"use client";

import { useState, useTransition } from "react";

import { ActionForm } from "@/features/admin/action-form";
import {
  addLeadNote,
  setBookingStatus,
  setLeadStatus,
} from "@/features/admin/actions";
import type { ActionResult } from "@/features/admin/actions";
import { LEAD_STATUS_LABELS } from "@/features/admin/lead-vocabulary";
import { LEAD_STATUSES, type LeadStatus } from "@/types/database";
import { cn } from "@/lib/utils";

/**
 * Client wrappers for the lead and booking mutations.
 *
 * Same arrangement as `user-controls.tsx`: the detail pages stay Server
 * Components and only these small controls ship JavaScript. None of them
 * decides anything — the permission check happens in the Server Action and
 * then again inside Postgres, and the audit row is written by the RPC in the
 * same transaction as the change.
 */

const CONTROL =
  "h-10 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground focus:border-brand-violet focus:outline-none";

/**
 * Move a lead to a new stage.
 *
 * A select plus a note rather than eight buttons: the lifecycle is a sequence,
 * and rendering it as a row of equal-weight buttons invites the misclick that
 * jumps a lead from NEW to CUSTOMER. The note is optional here — unlike a
 * suspension, advancing a lead is routine and requiring a justification for
 * every step trains people to type "moving on".
 */
export function LeadStatusControl({
  leadId,
  current,
}: {
  leadId: string;
  current: LeadStatus;
}) {
  const [status, setStatus] = useState<LeadStatus>(current);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = status !== current;

  function submit() {
    startTransition(async () => {
      const res = await setLeadStatus({ leadId, status, reason: note.trim() });
      setResult(res);
      if (res.ok) setNote("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Stage
        </span>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as LeadStatus);
            setResult(null);
          }}
          className={cn(CONTROL, "w-full")}
        >
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Note (optional)
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="What changed?"
          className="rounded-lg border border-line-strong bg-fill-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none"
        />
        <span className="text-xs text-muted-strong">
          Recorded on the timeline and in the audit log. It cannot be edited
          later.
        </span>
      </label>

      <button
        type="button"
        disabled={!changed || pending}
        onClick={submit}
        className="self-start rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-fill-6 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Saving…" : "Update stage"}
      </button>

      {result ? (
        <p
          role="status"
          className={cn("text-sm", result.ok ? "text-accent" : "text-red-300")}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

/** Append-only note. Separate control from the stage change on purpose. */
export function LeadNoteControl({ leadId }: { leadId: string }) {
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await addLeadNote({ leadId, note: note.trim() });
      setResult(res);
      if (res.ok) setNote("");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Call summary, next step, anything the next person needs."
        className="rounded-lg border border-line-strong bg-fill-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none"
      />
      <button
        type="button"
        disabled={note.trim().length === 0 || pending}
        onClick={submit}
        className="self-start rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-3 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Adding…" : "Add note"}
      </button>
      {result ? (
        <p
          role="status"
          className={cn("text-sm", result.ok ? "text-accent" : "text-red-300")}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Booking lifecycle.
 *
 * Confirm and complete are ordinary operational acts and need no
 * justification. Cancelling reaches the customer — it raises
 * `BOOKING_CANCELLED` — so it is the one that arms first and asks why, and the
 * reason it collects is the text that ends up in the audit log.
 */
export function BookingStatusControls({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const settled = status === "CANCELLED" || status === "COMPLETED";

  return (
    <div className="flex flex-wrap items-start gap-2">
      {status === "PENDING" ? (
        <ActionForm
          label="Confirm"
          confirmTitle="Confirm this session?"
          confirmBody="Marks the slot as agreed. Add the meeting link if you have one — it is checked as an http(s) URL before it is stored."
          confirmLabel="Confirm booking"
          reasonRequired={false}
          reasonPlaceholder="Meeting link, or a note for the record"
          onSubmit={({ reason }) =>
            setBookingStatus({
              bookingId,
              status: "CONFIRMED",
              // A pasted link goes in as the meeting URL; anything else is kept
              // as the reason. The action rejects a non-http(s) value rather
              // than storing it.
              ...(/^https?:\/\//i.test(reason.trim())
                ? { meetingUrl: reason.trim() }
                : { reason }),
            })
          }
        />
      ) : null}

      {!settled ? (
        <>
          <ActionForm
            label="Mark completed"
            confirmTitle="Mark this session completed?"
            confirmBody="Records that the call happened. If the lead was at 'Strategy booked' it advances to 'Strategy completed' automatically."
            confirmLabel="Mark completed"
            reasonRequired={false}
            reasonPlaceholder="How did it go?"
            onSubmit={({ reason }) =>
              setBookingStatus({ bookingId, status: "COMPLETED", reason })
            }
          />
          <ActionForm
            label="No show"
            confirmTitle="Record a no-show?"
            confirmBody="Records that the customer did not attend. No email is sent."
            confirmLabel="Record no-show"
            reasonRequired={false}
            onSubmit={({ reason }) =>
              setBookingStatus({ bookingId, status: "NO_SHOW", reason })
            }
          />
          <ActionForm
            label="Cancel"
            destructive
            confirmTitle="Cancel this session?"
            confirmBody="The customer is emailed if a BOOKING_CANCELLED template is active. The booking is kept, not deleted."
            confirmLabel="Cancel session"
            reasonPlaceholder="Why is it being cancelled?"
            onSubmit={({ reason }) =>
              setBookingStatus({ bookingId, status: "CANCELLED", reason })
            }
          />
        </>
      ) : null}
    </div>
  );
}
