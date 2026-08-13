import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import { pageParams, first } from "@/features/admin/query";
import {
  listResearchRuns,
  researchFacets,
  getResearchStats,
} from "@/features/admin/research-ops";
import {
  PageHeader,
  Stat,
  TableShell,
  Th,
  Td,
  EmptyState,
  Pagination,
  FilterBar,
  Field,
  SelectFilter,
  DateFilter,
  TextFilter,
} from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS, isResearchStage } from "@/features/research/types";
import { formatDateTime, formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "Research operations" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Market Research monitoring.
 *
 * Metadata only — no research content, no evidence text, no source bodies.
 * Operators need to know which runs are stuck, which stage they stopped at and
 * what they cost; none of that requires reading a customer's market analysis.
 *
 * Every filter is a database predicate and every page is a `range()`, so this
 * stays responsive as the run count grows. The stat cards come from
 * `admin_research_stats`, which counts in SQL and omits blocks the caller's
 * role may not see.
 */
export default async function AdminResearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("ai.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);

  const status = first(sp.status);
  const depth = first(sp.depth);
  const stage = first(sp.stage);
  const workspaceId = first(sp.workspace);
  const from = first(sp.from);
  const to = first(sp.to);

  const facets = researchFacets();
  const since = from ? new Date(`${from}T00:00:00Z`) : undefined;

  const [result, stats] = await Promise.all([
    listResearchRuns(params, {
      status: status || undefined,
      depth: depth || undefined,
      stage: stage || undefined,
      // A malformed workspace id would make PostgREST reject the whole query,
      // so it is only applied when it looks like a uuid.
      workspaceId:
        workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId)
          ? workspaceId
          : undefined,
      since: since?.toISOString(),
      until: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
    }),
    getResearchStats(since),
  ]);

  const num = (key: string): number | null => {
    const value = stats?.[key];
    return typeof value === "number" ? value : null;
  };

  return (
    <>
      <PageHeader
        title="Research operations"
        description="Every market research run. Metadata only — open a run for its stage timeline."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Runs" value={num("research_runs")} />
        <Stat
          label="Completed"
          value={num("research_completed")}
          sub={
            num("research_runs")
              ? `${(((num("research_completed") ?? 0) / (num("research_runs") || 1)) * 100).toFixed(0)}% of runs`
              : undefined
          }
        />
        <Stat
          label="Failed stage attempts"
          value={num("stage_failures")}
          sub="Refunded automatically"
        />
        <Stat
          label="Credits charged"
          value={num("research_credits_charged")}
          sub={
            num("research_credits_refunded") !== null
              ? `${num("research_credits_refunded")} refunded`
              : undefined
          }
          unavailableNote="Requires credits.read"
        />
      </div>

      <FilterBar action="/admin/research">
        <Field label="Status">
          <SelectFilter
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "All" },
              ...facets.statuses.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Field>
        <Field label="Depth">
          <SelectFilter
            name="depth"
            defaultValue={depth}
            options={[
              { value: "", label: "All" },
              ...facets.depths.map((d) => ({ value: d, label: d })),
            ]}
          />
        </Field>
        <Field label="Current stage">
          <SelectFilter
            name="stage"
            defaultValue={stage}
            options={[
              { value: "", label: "All" },
              ...facets.stages.map((s) => ({
                value: s,
                label: isResearchStage(s) ? STAGE_LABELS[s] : s,
              })),
            ]}
          />
        </Field>
        <Field label="Workspace ID">
          <TextFilter
            name="workspace"
            defaultValue={workspaceId}
            placeholder="uuid"
          />
        </Field>
        <Field label="From">
          <DateFilter name="from" defaultValue={from} />
        </Field>
        <Field label="To">
          <DateFilter name="to" defaultValue={to} />
        </Field>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState
          title="No research runs match these filters."
          hint="Runs appear here as soon as a workspace starts the first stage."
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Started</Th>
                <Th>Research</Th>
                <Th>Workspace</Th>
                <Th>Depth</Th>
                <Th>Status</Th>
                <Th>Stage</Th>
                <Th>Attempts</Th>
                <Th>Sources</Th>
                <Th>Evidence</Th>
                <Th>Credits</Th>
                <Th>Cost</Th>
                <Th>Duration</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((run) => (
                <tr key={run.runId} className="hover:bg-fill-1">
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(run.createdAt)}
                  </Td>
                  <Td className="max-w-[220px] truncate font-medium">
                    {run.title}
                  </Td>
                  <Td className="max-w-[160px] truncate text-muted">
                    {run.workspaceName ?? run.workspaceId}
                  </Td>
                  <Td className="text-muted">{run.depth}</Td>
                  <Td>
                    <Badge
                      variant={
                        run.status === "completed"
                          ? "active"
                          : run.status === "failed"
                            ? "archived"
                            : run.status === "running"
                              ? "completed"
                              : "neutral"
                      }
                    >
                      {run.status}
                    </Badge>
                  </Td>
                  <Td className="text-muted">
                    {isResearchStage(run.currentStage)
                      ? STAGE_LABELS[run.currentStage]
                      : "—"}
                  </Td>
                  <Td className="text-muted">
                    {run.attempts}
                    {run.failedAttempts > 0 ? (
                      <span className="ml-1 text-danger-soft">
                        ({run.failedAttempts} failed)
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted">{run.sourceCount}</Td>
                  <Td className="text-muted">{run.evidenceCount}</Td>
                  <Td className="text-muted">
                    {run.creditsCharged}
                    {run.creditsRefunded > 0 ? (
                      <span className="ml-1 text-brand-green">
                        (−{run.creditsRefunded})
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted">
                    {run.estimatedCostUsd > 0
                      ? `$${run.estimatedCostUsd.toFixed(6)}`
                      : "—"}
                  </Td>
                  <Td className="text-muted">
                    {formatDuration(run.durationMs)}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/research/${run.runId}`}
                      className="text-sm text-accent hover:underline"
                    >
                      Timeline
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          <Pagination
            page={result}
            basePath="/admin/research"
            params={{
              status,
              depth,
              stage,
              workspace: workspaceId,
              from,
              to,
              size: first(sp.size),
            }}
          />
        </>
      )}
    </>
  );
}
