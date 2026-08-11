import "server-only";

/**
 * Shared list-query plumbing: pagination bounds and search sanitising.
 *
 * ADMIN-DASHBOARD-SPEC.md: "Avoid expensive unbounded queries." Every admin
 * list goes through `pageParams`, so a page size is always applied and cannot
 * be raised past `MAX_PAGE_SIZE` by editing the URL.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
  /** Inclusive Supabase `.range()` bounds. */
  from: number;
  to: number;
}

/**
 * Clamp user-supplied paging into a safe range.
 *
 * `page` and `pageSize` arrive from the query string, so they are attacker-
 * controlled: NaN, negative, fractional and absurdly large values all have to
 * land somewhere sane rather than reaching the database.
 */
export function pageParams(
  rawPage: string | string[] | undefined,
  rawSize?: string | string[] | undefined,
): PageParams {
  const parsed = Number.parseInt(first(rawPage) ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;

  const parsedSize = Number.parseInt(first(rawSize) ?? "", 10);
  const pageSize =
    Number.isFinite(parsedSize) && parsedSize > 0
      ? Math.min(Math.floor(parsedSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

/** Normalise `string | string[] | undefined` from Next's searchParams. */
export function first(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Escape a user search term for use inside a PostgREST `ilike` filter.
 *
 * PostgREST parses commas and parentheses as filter syntax, and `%`/`_` are
 * LIKE wildcards. Passing a raw term through would let a search box alter the
 * shape of the query rather than just its value. Values are sent as bound
 * parameters by the client library, so this is about filter-grammar confusion
 * rather than classic SQL injection — but a search for `a,b` silently becoming
 * a different predicate is still a bug worth closing.
 */
export function escapeSearch(term: string): string {
  return term
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/[(),]/g, " ")
    .trim();
}

/** A trimmed, escaped, length-capped search term — or undefined if empty. */
export function searchTerm(
  raw: string | string[] | undefined,
): string | undefined {
  const value = first(raw)?.trim();
  if (!value) return undefined;
  const escaped = escapeSearch(value.slice(0, 100));
  return escaped.length > 0 ? escaped : undefined;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paged<T>(
  rows: T[],
  total: number,
  params: PageParams,
): Paged<T> {
  return {
    rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Build a querystring preserving existing filters while changing one key. */
export function withParam(
  current: Record<string, string | string[] | undefined>,
  key: string,
  value: string | undefined,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const val = first(v);
    if (val && k !== key) params.set(k, val);
  }
  if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
