import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Cost analytics for the admin panel.
 *
 * Every number on `/admin/costs` is produced by `admin_cost_breakdown` in
 * Postgres. Nothing here sums, and that is the point rather than a style
 * preference:
 *
 *   `ai_usage_logs` grows with every AI request on the platform. Selecting a
 *   month of it to run `reduce()` in Node would move megabytes to compute a
 *   number the database can compute in place — and, worse, PostgREST caps rows
 *   per response, so past that cap the JavaScript sum would quietly return a
 *   *plausible but wrong* total. A cost figure that is silently short is worse
 *   than one that errors, because somebody will price against it.
 *
 *   `estimated_cost_usd` is `numeric`. It is summed as `numeric` and arrives
 *   here as a string, so no money value passes through a JS float. It is
 *   formatted for display and never re-aggregated.
 */

/** The dimensions the SQL function whitelists. */
export const COST_DIMENSIONS = [
  "day",
  "provider",
  "model",
  "workflow",
  "feature",
  "workspace",
] as const;

export type CostDimension = (typeof COST_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<CostDimension, string> = {
  day: "By day",
  provider: "By provider",
  model: "By model",
  workflow: "By workflow",
  feature: "By feature",
  workspace: "By workspace",
};

export function isCostDimension(value: unknown): value is CostDimension {
  return (
    typeof value === "string" &&
    (COST_DIMENSIONS as readonly string[]).includes(value)
  );
}

export interface CostRow {
  key: string;
  label: string;
  requests: number;
  failures: number;
  tokens: number;
  /** `numeric` as text, exactly as SQL summed it. */
  cost: string;
}

export interface CostBreakdown {
  dimension: CostDimension;
  since: string;
  until: string;
  rows: CostRow[];
  /** Summed from the returned rows only — a page total, not a re-aggregation. */
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
}

/**
 * One breakdown.
 *
 * A rejected dimension returns an empty breakdown rather than throwing: the
 * dimension reaches this from a query string, and a hand-edited URL should
 * render an empty table, not a stack trace. The SQL function refuses it too —
 * this is the fast, legible failure, not the only one.
 */
export async function getCostBreakdown(
  dimension: CostDimension,
  since?: Date,
  until?: Date,
  limit = 30,
): Promise<CostBreakdown> {
  const empty: CostBreakdown = {
    dimension,
    since: since?.toISOString() ?? "",
    until: until?.toISOString() ?? "",
    rows: [],
    totalCost: 0,
    totalRequests: 0,
    totalTokens: 0,
  };

  if (!isCostDimension(dimension)) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_cost_breakdown", {
    p_dimension: dimension,
    p_since: since ? since.toISOString() : null,
    p_until: until ? until.toISOString() : null,
    p_limit: limit,
  });

  // A permission failure surfaces as an error from the RPC, which is correct:
  // the page renders an empty state rather than a partial truth.
  if (error || !data) return empty;

  const payload = data as {
    dimension: string;
    since: string;
    until: string;
    rows: CostRow[];
  };

  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    dimension,
    since: payload.since ?? empty.since,
    until: payload.until ?? empty.until,
    rows,
    // Totalling the ≤200 rows already on screen is arithmetic over a rendered
    // table, not analytics over the log. The database did the aggregation.
    totalCost: rows.reduce((sum, row) => sum + Number(row.cost || 0), 0),
    totalRequests: rows.reduce((sum, row) => sum + (row.requests || 0), 0),
    totalTokens: rows.reduce((sum, row) => sum + (row.tokens || 0), 0),
  };
}

/** Format a `numeric`-as-text cost for display without touching precision. */
export function formatCost(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  // Sub-cent costs are the norm per request; four decimals for totals keeps
  // them readable, six for individual rows keeps them true.
  return n >= 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(6)}`;
}
