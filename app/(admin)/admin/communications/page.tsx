import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import { listTemplates } from "@/features/admin/communications";
import { emailProviderConfigured } from "@/features/communications/service";
import { mailerSender } from "@/features/communications/mailer";
import { PageHeader, EmptyState, TableShell, Th, Td } from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Email templates" };
export const dynamic = "force-dynamic";

/**
 * Admin → Communications → Email templates.
 *
 * ---------------------------------------------------------------------------
 * The "wired" column is the important one
 * ---------------------------------------------------------------------------
 * A template existing does not mean anything sends it. Fifteen triggers are
 * seeded by migration 0019; only some of them are raised by code in this
 * repository, and two of them (activation, password reset) are sent by Supabase
 * Auth itself and cannot be changed from here at all.
 *
 * Showing all fifteen without saying which is which would let an operator spend
 * an afternoon perfecting a 24-hour reminder that nothing will ever fire,
 * discover it weeks later, and reasonably stop trusting the rest of the panel.
 * So each row states its wiring, drawn from `TRIGGER_STATUS`, which the smoke
 * suite checks against the actual call sites so it cannot drift into optimism.
 */
export default async function AdminCommunicationsPage() {
  const { has } = await requirePermission("communications.read");

  const templates = await listTemplates();
  const providerConfigured = emailProviderConfigured();
  // The From address, not the credentials. Worth showing because a mismatched
  // sender is the most common cause of mail being accepted here and rejected
  // by the server — seeing it beats guessing what is configured.
  const sender = mailerSender();

  const active = templates.filter((t) => t.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        title="Email templates"
        description="What the platform says to customers, and when."
        actions={
          <Link
            href="/admin/communications/logs"
            className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-3"
          >
            Delivery log →
          </Link>
        }
      />

      {!providerConfigured ? (
        <Card className="mb-6 p-5">
          <p className="text-sm font-medium text-foreground">
            No email provider is configured.
          </p>
          <p className="mt-1 text-sm text-muted">
            Templates can be written, previewed and activated, and every attempt
            is recorded — but nothing is delivered until{" "}
            <code className="font-mono text-xs">SMTP_HOST</code>,{" "}
            <code className="font-mono text-xs">SMTP_USER</code> and{" "}
            <code className="font-mono text-xs">SMTP_PASS</code> are set.
            Attempts appear in the log as{" "}
            <span className="font-medium">skipped</span> rather than sent, so
            &ldquo;we chose not to send&rdquo; stays distinguishable from
            &ldquo;we tried and failed&rdquo;.
          </p>
        </Card>
      ) : (
        <Card className="mb-6 p-5">
          <p className="text-sm font-medium text-foreground">
            Sending over SMTP.
          </p>
          <p className="mt-1 text-sm text-muted">
            Customer mail leaves as{" "}
            <code className="font-mono text-xs">{sender}</code>. That address
            must be a real mailbox on the authenticated domain — a mismatch is
            rejected by the mail server, not by this application, and shows in
            the delivery log as{" "}
            <code className="font-mono text-xs">SMTP_ENVELOPE_REJECTED</code>.
          </p>
        </Card>
      )}

      {templates.length === 0 ? (
        <EmptyState
          title="No templates."
          hint="Migration 0019 seeds fifteen. If this is empty, that migration has not been applied to this database."
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Template</Th>
                <Th>Trigger</Th>
                <Th>Status</Th>
                <Th>Version</Th>
                <Th>Automation</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="align-top hover:bg-fill-1">
                  <Td>
                    <Link
                      href={`/admin/communications/${template.id}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {template.name}
                    </Link>
                    {template.description ? (
                      <span className="block max-w-md text-xs text-muted">
                        {template.description}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-xs text-muted">
                    {template.trigger}
                  </Td>
                  <Td>
                    <Badge
                      variant={
                        template.status === "ACTIVE"
                          ? "active"
                          : template.status === "ARCHIVED"
                            ? "archived"
                            : "neutral"
                      }
                    >
                      {template.status}
                    </Badge>
                  </Td>
                  <Td className="text-muted">
                    {template.current_version > 0
                      ? `v${template.current_version}`
                      : "—"}
                  </Td>
                  <Td className="max-w-sm">
                    <Badge variant={template.wired ? "completed" : "neutral"}>
                      {template.wired ? "Wired" : "Not wired"}
                    </Badge>
                    <span className="mt-1 block text-xs text-muted">
                      {template.wiredNote}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(template.updated_at)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          <p className="mt-4 text-sm text-muted">
            {active} of {templates.length} templates are active. A trigger with
            no active template sends nothing and logs the decision as{" "}
            <span className="font-medium">skipped</span> — which is the normal
            state after a fresh migration, not a fault.
          </p>
        </>
      )}

      {!has("communications.write") ? (
        <p className="mt-6 text-sm text-muted">
          You can read templates but not change them. Editing needs{" "}
          <code className="font-mono text-xs">communications.write</code>.
        </p>
      ) : null}
    </>
  );
}
