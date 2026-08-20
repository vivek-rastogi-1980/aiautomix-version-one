import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/features/admin/guard";
import {
  getTemplateDetail,
  EMAIL_STATUS_BADGE,
} from "@/features/admin/communications";
import { TemplateEditor } from "@/features/admin/template-editor";
import { emailProviderConfigured } from "@/features/communications/service";
import { isTemplateStatus } from "@/features/communications/events";
import { PageHeader } from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Email template" };
export const dynamic = "force-dynamic";

/**
 * One template: edit, preview, test, activate, and the version history.
 *
 * The history is the part that makes the rest safe. Saving never overwrites —
 * `email_template_save` always appends a new version, and an append-only
 * trigger rejects UPDATE and DELETE on `email_template_versions` for every
 * role, including a connection that bypasses RLS entirely. Every email log row
 * points at the exact version it sent, so "what did we actually tell that
 * customer in March?" has an answer no amount of later editing can erase.
 *
 * There is deliberately no delete control, and no way to add one that would
 * work.
 */
export default async function AdminTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { has } = await requirePermission("communications.read");
  const { id } = await params;

  const detail = await getTemplateDetail(id);
  if (!detail) notFound();

  const { template, versions, current, recentLogs } = detail;

  return (
    <>
      <PageHeader
        title={template.name}
        description={template.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={template.wired ? "completed" : "neutral"}>
              {template.wired ? "Wired" : "Not wired"}
            </Badge>
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
          </div>
        }
      />

      <Link
        href="/admin/communications"
        className="mb-6 inline-block text-sm text-accent hover:underline"
      >
        ← All templates
      </Link>

      {!template.wired ? (
        <Card className="mb-6 p-5">
          <p className="text-sm font-medium text-foreground">
            Nothing in the application raises this trigger.
          </p>
          <p className="mt-1 text-sm text-muted">{template.wiredNote}</p>
          <p className="mt-1 text-sm text-muted">
            You can still author and activate it — a future release, or an
            operator sending deliberately, will use it. It just will not fire on
            its own today, and saying so here is cheaper than finding out later.
          </p>
        </Card>
      ) : null}

      <TemplateEditor
        templateId={template.id}
        trigger={template.trigger}
        initialSubject={current?.subject ?? ""}
        initialBodyHtml={current?.body_html ?? ""}
        initialBodyText={current?.body_text ?? ""}
        status={
          isTemplateStatus(template.status) ? template.status : "DRAFT"
        }
        currentVersion={template.current_version}
        canWrite={has("communications.write")}
        canSendTest={has("communications.send_test")}
        providerConfigured={emailProviderConfigured()}
      />

      {/* --- Version history ---------------------------------------------- */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Version history
          </h2>
          <p className="mt-1 text-sm text-muted">
            Append-only. A version that has been sent is never rewritten.
          </p>
          {versions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing saved yet. The first save becomes version 1.
            </p>
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {versions.map((version) => (
                <li key={version.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      v{version.version}
                      {version.version === template.current_version ? (
                        <span className="ml-2 text-xs font-normal text-accent">
                          current
                        </span>
                      ) : null}
                    </p>
                    <p className="shrink-0 text-xs text-muted">
                      {formatDateTime(version.created_at)}
                    </p>
                  </div>
                  <p className="mt-1 break-words text-sm text-muted">
                    {version.subject}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Recent sends
          </h2>
          <p className="mt-1 text-sm text-muted">
            The twenty most recent attempts using this template, tests included.
          </p>
          {recentLogs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing sent from this template yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-line">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {log.recipient_email}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(log.created_at)}
                      {log.is_test ? " · test" : ""}
                    </p>
                    {log.error_message ? (
                      <p className="mt-0.5 max-w-md text-xs text-muted-strong">
                        {log.error_message}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={EMAIL_STATUS_BADGE[log.status] ?? "neutral"}>
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </>
  );
}
