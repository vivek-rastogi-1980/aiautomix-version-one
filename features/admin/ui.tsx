import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Paged } from "@/features/admin/query";

/**
 * Presentational primitives shared by the admin pages.
 *
 * Server Components — no client JavaScript. The admin panel is a set of tables
 * and read views; shipping a bundle to render them would buy nothing.
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

/**
 * A KPI card.
 *
 * `value === null` renders "Unavailable" rather than a zero.
 * ADMIN-DASHBOARD-SPEC.md: "Clearly mark unavailable metrics." A metric the
 * caller's role cannot see, or that the platform genuinely cannot measure, must
 * not be displayed as `0` — an operator would read that as "none happened" and
 * act on it.
 */
export function Stat({
  label,
  value,
  sub,
  unavailableNote,
}: {
  label: string;
  value: string | number | null;
  sub?: string;
  unavailableNote?: string;
}) {
  const unavailable = value === null || value === undefined;

  return (
    <Card className="flex flex-col gap-1 p-5">
      {unavailable ? (
        <>
          <p className="text-lg font-semibold text-muted-strong">Unavailable</p>
          <p className="text-sm text-muted">{label}</p>
          {unavailableNote ? (
            <p className="text-xs text-muted-strong">{unavailableNote}</p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {typeof value === "number" ? value.toLocaleString("en-US") : value}
          </p>
          <p className="text-sm text-muted">{label}</p>
          {sub ? <p className="text-xs text-muted-strong">{sub}</p> : null}
        </>
      )}
    </Card>
  );
}

/** Table wrapper that scrolls itself rather than the page. */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-line px-4 py-3 text-foreground",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </Card>
  );
}

/**
 * Shown when a role lacks the permission for a section of a page.
 *
 * The page still renders what the role *can* see. Refusing the whole screen
 * because one panel is off-limits would push operators toward asking for a
 * bigger role than they need, which is how least privilege erodes.
 */
export function NoPermission({ permission }: { permission: string }) {
  return (
    <Card className="p-6">
      <p className="text-sm text-muted">
        Your role does not include{" "}
        <code className="rounded bg-fill-3 px-1.5 py-0.5 text-xs text-foreground">
          {permission}
        </code>
        , so this section is hidden.
      </p>
    </Card>
  );
}

/** Prev/next pagination that preserves the current filters. */
export function Pagination<T>({
  page,
  basePath,
  params,
}: {
  page: Paged<T>;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (page.pageCount <= 1) return null;

  const build = (n: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") qs.set(k, v);
    }
    qs.set("page", String(n));
    return `${basePath}?${qs.toString()}`;
  };

  const first = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.page * page.pageSize, page.total);

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className="text-sm text-muted">
        {first.toLocaleString("en-US")}–{last.toLocaleString("en-US")} of{" "}
        {page.total.toLocaleString("en-US")}
      </p>
      <div className="flex items-center gap-2">
        {page.page > 1 ? (
          <Link
            href={build(page.page - 1)}
            className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-foreground hover:bg-fill-3"
          >
            Previous
          </Link>
        ) : null}
        {page.page < page.pageCount ? (
          <Link
            href={build(page.page + 1)}
            className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-foreground hover:bg-fill-3"
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * GET search/filter bar.
 *
 * A plain form with `method="get"` — no client state, no JavaScript. It also
 * means every filtered view has a shareable URL, which matters when an operator
 * is pasting a link into an incident thread.
 */
export function FilterBar({
  action,
  children,
}: {
  action: string;
  children: ReactNode;
}) {
  return (
    <form
      method="get"
      action={action}
      className="mb-4 flex flex-wrap items-end gap-3"
    >
      {children}
      <button
        type="submit"
        className="rounded-full bg-fill-4 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-5"
      >
        Apply
      </button>
    </form>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const CONTROL =
  "h-10 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground placeholder:text-muted-strong focus:border-brand-violet focus:outline-none";

export function TextFilter({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={cn(CONTROL, "w-56")}
    />
  );
}

export function SelectFilter({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className={cn(CONTROL, "w-44")}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function DateFilter({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      className={cn(CONTROL, "w-40")}
    />
  );
}
