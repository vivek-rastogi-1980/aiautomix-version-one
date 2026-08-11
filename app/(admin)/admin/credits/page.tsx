import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import {
  listCreditAccounts,
  listCreditTransactions,
} from "@/features/admin/data";
import { pageParams, first } from "@/features/admin/query";
import {
  PageHeader,
  TableShell,
  Th,
  Td,
  EmptyState,
  Pagination,
  FilterBar,
  Field,
  SelectFilter,
} from "@/features/admin/ui";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Credits" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Platform-wide credit view.
 *
 * Read-only by design. Granting, refunding and adjusting happen on a specific
 * workspace's page, where the operator can see the balance, the ledger and the
 * account they are about to change. A bulk credit control on a list screen
 * makes it too easy to act on the wrong row.
 */
export default async function AdminCreditsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("credits.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const kind = first(sp.kind);
  const view = first(sp.view) === "ledger" ? "ledger" : "accounts";

  const [accounts, ledger] = await Promise.all([
    view === "accounts" ? listCreditAccounts(params) : Promise.resolve(null),
    view === "ledger"
      ? listCreditTransactions(params, { kind: kind || undefined })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Credits"
        description="Balances and the append-only ledger. Changes are made from a workspace."
      />

      <div className="mb-4 flex gap-2">
        <Link
          href="/admin/credits"
          className={`rounded-full px-4 py-1.5 text-sm ${
            view === "accounts"
              ? "bg-white/[0.12] font-medium text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Balances
        </Link>
        <Link
          href="/admin/credits?view=ledger"
          className={`rounded-full px-4 py-1.5 text-sm ${
            view === "ledger"
              ? "bg-white/[0.12] font-medium text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Ledger
        </Link>
      </div>

      {view === "accounts" && accounts ? (
        accounts.rows.length === 0 ? (
          <EmptyState title="No credit accounts yet." />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Workspace</Th>
                  <Th>Balance</Th>
                  <Th>Lifetime granted</Th>
                  <Th>Lifetime spent</Th>
                  <Th className="text-right">&nbsp;</Th>
                </tr>
              </thead>
              <tbody>
                {accounts.rows.map((account) => (
                  <tr key={account.id} className="hover:bg-white/[0.02]">
                    <Td className="font-medium">
                      {account.workspace?.name ?? "—"}
                    </Td>
                    <Td>{account.balance.toLocaleString("en-US")}</Td>
                    <Td className="text-muted">
                      {account.lifetime_granted.toLocaleString("en-US")}
                    </Td>
                    <Td className="text-muted">
                      {account.lifetime_spent.toLocaleString("en-US")}
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/workspaces/${account.workspace_id}`}
                        className="text-sm text-brand-cyan hover:underline"
                      >
                        Manage
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <Pagination
              page={accounts}
              basePath="/admin/credits"
              params={{ size: first(sp.size) }}
            />
          </>
        )
      ) : null}

      {view === "ledger" && ledger ? (
        <>
          <FilterBar action="/admin/credits">
            <input type="hidden" name="view" value="ledger" />
            <Field label="Kind">
              <SelectFilter
                name="kind"
                defaultValue={kind}
                options={[
                  { value: "", label: "All" },
                  { value: "GRANT", label: "Grant" },
                  { value: "DEBIT", label: "Debit" },
                  { value: "REFUND", label: "Refund" },
                  { value: "ADJUSTMENT", label: "Adjustment" },
                  { value: "EXPIRATION", label: "Expiration" },
                ]}
              />
            </Field>
          </FilterBar>

          {ledger.rows.length === 0 ? (
            <EmptyState title="No transactions match." />
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Kind</Th>
                    <Th>Amount</Th>
                    <Th>Balance after</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02]">
                      <Td className="whitespace-nowrap text-muted">
                        {formatDateTime(tx.created_at)}
                      </Td>
                      <Td className="font-medium">{tx.kind}</Td>
                      <Td
                        className={
                          tx.amount > 0 ? "text-brand-cyan" : "text-foreground"
                        }
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toLocaleString("en-US")}
                      </Td>
                      <Td className="text-muted">
                        {tx.balance_after.toLocaleString("en-US")}
                      </Td>
                      <Td className="max-w-xs truncate text-muted">
                        {tx.reason ?? "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              <Pagination
                page={ledger}
                basePath="/admin/credits"
                params={{ view: "ledger", kind, size: first(sp.size) }}
              />
            </>
          )}
        </>
      ) : null}

      <Card className="mt-6 p-5">
        <p className="text-sm text-muted">
          The ledger is append-only. A correction is a new entry, never an edit
          — so a mistaken grant stays visible alongside the adjustment that
          reversed it.
        </p>
      </Card>
    </>
  );
}
