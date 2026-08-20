"use client";

import { useMemo, useState, useTransition } from "react";

import {
  saveEmailTemplate,
  sendTestEmail,
  setEmailTemplateStatus,
} from "@/features/admin/actions";
import type { ActionResult } from "@/features/admin/actions";
import {
  PREVIEW_CONTEXT,
  TEMPLATE_VARIABLES,
  renderTemplate,
  validateTemplate,
} from "@/features/communications/template-engine";
import type { TemplateStatus } from "@/features/communications/events";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The email template editor.
 *
 * ---------------------------------------------------------------------------
 * Why this is a textarea and not a rich text editor
 * ---------------------------------------------------------------------------
 * §"Email editor" asks for a rich text editor and then, two lines later, says
 * "do not overbuild the editor, keep it maintainable". Those pull in opposite
 * directions and the second one wins here, for a reason specific to email:
 * every WYSIWYG editor emits HTML for a browser, and email clients are not
 * browsers. Outlook drops `<div>` margins, Gmail strips `<style>` blocks, and
 * the table-based markup that survives both is not something a contenteditable
 * surface will produce. An editor that generates markup which then breaks in
 * half the world's inboxes is worse than a textarea that shows exactly what
 * will be sent.
 *
 * So: the source is authored directly, the preview is live, and the variable
 * picker removes the part that actually causes mistakes — typing
 * `{{user.frist_name}}` by hand.
 *
 * ---------------------------------------------------------------------------
 * Why the preview is a sandboxed iframe
 * ---------------------------------------------------------------------------
 * The preview shows admin-authored HTML, which is the point — an email body IS
 * markup. But `dangerouslySetInnerHTML` here would execute that markup inside
 * the admin panel, in the session of whoever opens the page. An ADMIN holds
 * `communications.write`; a SUPER_ADMIN reviewing their draft holds everything.
 * That is a privilege escalation path from "can edit copy" to "can act as super
 * admin", opened by a preview feature.
 *
 * `<iframe sandbox srcDoc>` with no `allow-scripts` renders the layout exactly
 * and executes nothing — no script, no form submission, no navigation, and a
 * unique opaque origin with no access to the parent document.
 */

const VALIDATION_HINT =
  "Only the variables listed below may be used. Anything else is refused when you save, rather than shipping as a blank.";

export function TemplateEditor({
  templateId,
  trigger,
  initialSubject,
  initialBodyHtml,
  initialBodyText,
  status,
  currentVersion,
  canWrite,
  canSendTest,
  providerConfigured,
}: {
  templateId: string;
  trigger: string;
  initialSubject: string;
  initialBodyHtml: string;
  initialBodyText: string;
  status: TemplateStatus;
  currentVersion: number;
  canWrite: boolean;
  canSendTest: boolean;
  providerConfigured: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [testTo, setTestTo] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  /** Which textarea a variable click should insert into. */
  const [focused, setFocused] = useState<"subject" | "html" | "text">("html");

  const dirty =
    subject !== initialSubject ||
    bodyHtml !== initialBodyHtml ||
    bodyText !== initialBodyText;

  /**
   * Validation and preview, recomputed as you type.
   *
   * The exact same `validateTemplate` the Server Action runs before saving and
   * the send path runs again before delivering. One implementation, three call
   * sites — the editor cannot drift into accepting something the server will
   * reject.
   */
  const { issues, preview, previewSubject } = useMemo(() => {
    const found = [
      ...validateTemplate(subject).issues,
      ...validateTemplate(bodyHtml).issues,
      ...(bodyText ? validateTemplate(bodyText).issues : []),
    ];
    return {
      issues: found,
      previewSubject: renderTemplate(subject, PREVIEW_CONTEXT, { html: false })
        .output,
      preview: renderTemplate(bodyHtml, PREVIEW_CONTEXT, { html: true }).output,
    };
  }, [subject, bodyHtml, bodyText]);

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    if (focused === "subject") setSubject((value) => value + token);
    else if (focused === "text") setBodyText((value) => value + token);
    else setBodyHtml((value) => value + token);
  }

  function save() {
    startTransition(async () => {
      setResult(
        await saveEmailTemplate({ templateId, subject, bodyHtml, bodyText }),
      );
    });
  }

  function changeStatus(next: TemplateStatus) {
    startTransition(async () => {
      setResult(await setEmailTemplateStatus({ templateId, status: next }));
    });
  }

  function sendTest() {
    startTransition(async () => {
      setResult(await sendTestEmail({ templateId, recipient: testTo.trim() }));
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* --- Editor ------------------------------------------------------- */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              Subject
            </span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              onFocus={() => setFocused("subject")}
              disabled={!canWrite}
              maxLength={300}
              placeholder="Your validation report is ready — {{validation.score}}/100"
              className="h-10 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              HTML body
            </span>
            <textarea
              value={bodyHtml}
              onChange={(event) => setBodyHtml(event.target.value)}
              onFocus={() => setFocused("html")}
              disabled={!canWrite}
              rows={16}
              className="rounded-lg border border-line-strong bg-fill-1 px-3 py-2 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              Plain text fallback (optional)
            </span>
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              onFocus={() => setFocused("text")}
              disabled={!canWrite}
              rows={5}
              className="rounded-lg border border-line-strong bg-fill-1 px-3 py-2 font-mono text-xs leading-relaxed text-foreground focus:border-brand-violet focus:outline-none disabled:opacity-60"
            />
            <span className="text-xs text-muted-strong">
              Sent alongside the HTML. Clients that cannot render HTML show this
              instead of nothing.
            </span>
          </label>

          {issues.length > 0 ? (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/[0.04] p-3"
            >
              <p className="text-sm font-medium text-red-300">
                This will not save yet:
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-red-300">
                {issues.map((issue) => (
                  <li key={`${issue.variable}-${issue.message}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending || issues.length > 0 || !dirty}
                className="rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-6 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Working…" : "Save as new version"}
              </button>

              {status !== "ACTIVE" ? (
                <button
                  type="button"
                  onClick={() => changeStatus("ACTIVE")}
                  disabled={pending || currentVersion < 1 || dirty}
                  title={
                    dirty
                      ? "Save your changes first — activating publishes the saved version, not the one on screen."
                      : undefined
                  }
                  className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Activate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => changeStatus("DRAFT")}
                  disabled={pending}
                  className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Deactivate
                </button>
              )}

              {status !== "ARCHIVED" ? (
                <button
                  type="button"
                  onClick={() => changeStatus("ARCHIVED")}
                  disabled={pending}
                  className="rounded-full px-4 py-2 text-sm text-muted hover:text-foreground disabled:opacity-40"
                >
                  Archive
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">
              You can read this template but not change it. Editing needs{" "}
              <code className="font-mono text-xs">communications.write</code>.
            </p>
          )}

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
        </Card>

        {/* --- Variable picker ------------------------------------------- */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground">Variables</p>
          <p className="mt-1 text-sm text-muted">{VALIDATION_HINT}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable.key}
                type="button"
                disabled={!canWrite}
                onClick={() => insertVariable(variable.key)}
                title={`${variable.label}${variable.isUrl ? " — checked as an http(s) URL before it is used" : ""}`}
                className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs text-muted hover:bg-fill-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {`{{${variable.key}}}`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-strong">
            Values are HTML-escaped on the way in, with no opt-out, and the four
            link variables are parsed and rejected unless they are http or
            https. A business idea containing markup arrives as text.
          </p>
        </Card>
      </div>

      {/* --- Preview and test ---------------------------------------------- */}
      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Preview</p>
            <p className="text-xs text-muted-strong">Sample data only</p>
          </div>

          <p className="mt-3 text-xs uppercase tracking-wider text-muted">
            Subject
          </p>
          <p className="mt-1 break-words text-sm text-foreground">
            {previewSubject || (
              <span className="text-muted-strong">(no subject yet)</span>
            )}
          </p>

          <p className="mt-4 text-xs uppercase tracking-wider text-muted">
            Body
          </p>
          {/*
            sandbox with no allow-scripts: the markup renders, nothing in it
            runs. See the note at the top of this file — the preview must not
            become a way for one admin to execute script in another's session.
          */}
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;background:#fff;color:#1a1a1a;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6">${preview}</body>`}
            className="mt-2 h-[420px] w-full rounded-lg border border-line bg-white"
          />

          <p className="mt-3 text-xs text-muted-strong">
            Filled with obviously fictional sample values. No real customer
            record is read to build this.
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground">
            Send a test email
          </p>
          {canSendTest ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Sends the saved version {currentVersion || "—"} with sample
                data, subject prefixed <code className="font-mono">[TEST]</code>
                . It raises no event, touches no lead timeline, and is flagged
                as a test in the delivery log.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={testTo}
                  onChange={(event) => setTestTo(event.target.value)}
                  placeholder="you@example.com"
                  className="h-10 w-64 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none"
                />
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={pending || currentVersion < 1 || !testTo.includes("@")}
                  className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Sending…" : "Send test"}
                </button>
              </div>
              {!providerConfigured ? (
                <p className="mt-3 text-sm text-muted">
                  No email provider is configured, so nothing will actually be
                  delivered. The attempt is still recorded as{" "}
                  <span className="font-medium">skipped</span> in the log, which
                  is how you can tell &ldquo;we chose not to send&rdquo; from
                  &ldquo;we tried and failed&rdquo;.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Sending a test needs{" "}
              <code className="font-mono text-xs">
                communications.send_test
              </code>
              . It is a separate grant from editing because it is the one action
              here that leaves the building.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground">
            About this trigger
          </p>
          <p className="mt-1 font-mono text-xs text-muted">{trigger}</p>
        </Card>
      </div>
    </div>
  );
}
