import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/features/admin/guard";
import { getAiUsageDetail } from "@/features/admin/data";
import { safePreview } from "@/features/admin/redact";
import { PageHeader, Stat } from "@/features/admin/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "AI request" };
export const dynamic = "force-dynamic";

/**
 * One AI request in detail, including failure information.
 *
 * Everything textual on this page goes through `safePreview`, which redacts
 * credential-shaped strings before truncating. The order matters: truncating
 * first could split a key and leave a fragment the patterns no longer match but
 * a reader still recognises.
 *
 * Provider credentials are never read here in the first place — the API key
 * lives in a server env var that no query touches. Redaction covers the case
 * where a key ended up *inside* recorded content: a user pasting their own
 * config into a prompt, or an error string carrying an Authorization header.
 */
export default async function AdminAiDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("ai.read");
  const { id } = await params;

  const event = await getAiUsageDetail(id);
  if (!event) notFound();

  const failed = event.status !== "success";
  const errorPreview = safePreview(
    (event as unknown as { error_message?: string }).error_message ?? null,
    1200,
  );

  return (
    <>
      <PageHeader
        title={event.workflow}
        description={`${formatDateTime(event.created_at)} · ${event.model}`}
        actions={
          <Link
            href="/admin/ai"
            className="text-sm text-accent hover:underline"
          >
            ← All requests
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status" value={event.status} />
        <Stat label="Total tokens" value={event.total_tokens ?? null} />
        <Stat
          label="Duration"
          value={event.duration_ms ? formatDuration(event.duration_ms) : null}
        />
        <Stat
          label="Estimated cost"
          value={
            event.estimated_cost_usd !== null &&
            event.estimated_cost_usd !== undefined
              ? `$${Number(event.estimated_cost_usd).toFixed(6)}`
              : null
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Request
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Workflow
              </dt>
              <dd className="mt-1 text-sm text-foreground">{event.workflow}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Provider
              </dt>
              <dd className="mt-1 text-sm text-foreground">{event.provider}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Model
              </dt>
              <dd className="mt-1 text-sm text-foreground">{event.model}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Prompt version
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {event.prompt_version}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Prompt tokens
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {event.prompt_tokens?.toLocaleString("en-US") ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Output tokens
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {event.output_tokens?.toLocaleString("en-US") ?? "—"}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-xs text-muted-strong">
            Provider credentials are never loaded by this page and never stored
            with a request.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Outcome
          </h2>
          <div className="mt-3">
            <Badge variant={failed ? "neutral" : "active"}>
              {event.status}
            </Badge>
          </div>

          {failed ? (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-muted">
                Failure detail
              </p>
              {errorPreview.text ? (
                <>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-fill-1 p-3 text-xs text-foreground">
                    {errorPreview.text}
                  </pre>
                  {errorPreview.hadSecret ? (
                    <p className="mt-2 text-xs text-red-300">
                      A credential-shaped value was found in this text and has
                      been redacted. Worth investigating how it got there.
                    </p>
                  ) : null}
                  {errorPreview.truncated ? (
                    <p className="mt-2 text-xs text-muted-strong">
                      Truncated for display.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  No error text was recorded with this request. The usage log
                  stores the outcome and metrics; full error bodies are not
                  persisted.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              This request completed successfully.
            </p>
          )}

          {/*
            Prompt and response bodies are not shown. `ai_usage_logs` records
            metrics rather than content, and the panel does not join to the
            response tables to fetch it. Displaying customer business plans to
            staff is a privacy decision that deserves its own review, not a
            side effect of building a debugging screen.
          */}
          <p className="mt-5 text-xs text-muted-strong">
            Prompt and response content is not displayed in the admin panel.
          </p>
        </Card>
      </div>
    </>
  );
}
