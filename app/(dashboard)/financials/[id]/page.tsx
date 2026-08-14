import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getFinancialDetail } from "@/features/financials/data";
import { getFinancialAccess } from "@/features/financials/permissions";
import {
  buildFinancialProgress,
  financialStatusLabel,
} from "@/features/financials/progress";
import { FinancialAccessNotice } from "@/features/financials/financial-access-notice";
import { FinancialStagePipeline } from "@/features/financials/stage-pipeline";
import { AssumptionEditor } from "@/features/financials/assumption-editor";
import {
  AssumptionsPanel,
  BreakEvenPanel,
  CostsPanel,
  FinancialDashboard,
  ForecastTable,
  FundingPanel,
  RisksPanel,
  ScenariosPanel,
} from "@/features/financials/financial-views";
import {
  REVENUE_MODEL_LABELS,
  isRevenueModel,
} from "@/features/financials/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Financial model",
  description: "Assumptions, forecast, scenarios, break-even and funding.",
};

/**
 * `/financials/[id]` — the financial workspace.
 *
 * A Server Component that re-reads every row on each request, so resuming works
 * and the figures always match the database.
 *
 * The layout puts ASSUMPTIONS above the calculated views deliberately. A reader
 * who meets the forecast first treats it as a prediction; a reader who meets
 * the assumptions first understands it as arithmetic over choices they can
 * change — which is what it is.
 */
export default async function FinancialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getFinancialAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink />
        <FinancialAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const detail = await getFinancialDetail(access.workspace.id, id);
  if (!detail) notFound();

  const { project, currency, run, attempts, assumptions, costs, results } =
    detail;

  const progress = buildFinancialProgress({
    currentStage: run?.current_stage ?? null,
    runStatus: run?.status ?? null,
    projectStatus: project.status,
    attempts,
  });
  const status = financialStatusLabel(progress, project.status);

  const section = (key: string) =>
    results.find((row) => row.section_key === key)?.structured_content as
      Record<string, unknown> | undefined;

  const forecast = section("forecast");
  const breakEven = section("break_even");
  const cashFlow = section("cash_flow");
  const capital = section("capital_requirement");
  const unitEconomics = section("unit_economics");
  const scenarios = section("scenarios");
  const risks = section("financial_risks");

  const numOf = (
    source: Record<string, unknown> | undefined,
    key: string,
  ): number | null => {
    const value = source?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const totals = (forecast?.totals ?? {}) as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {project.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {project.currency} ·{" "}
              {isRevenueModel(project.revenue_model)
                ? REVENUE_MODEL_LABELS[project.revenue_model]
                : project.revenue_model}{" "}
              · {project.horizon_months} months · Updated{" "}
              {formatDate(project.updated_at)}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {detail.idea || detail.plan ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Financials for:</span>
            {detail.idea ? (
              <Link
                href="/validator"
                className="inline-flex items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline"
              >
                <Lightbulb
                  className="size-4 text-brand-violet"
                  aria-hidden="true"
                />
                {detail.idea.title}
              </Link>
            ) : null}
            {detail.plan ? (
              <Link
                href={`/plans/${detail.plan.id}`}
                className="inline-flex items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline"
              >
                <NotebookPen
                  className="size-4 text-brand-violet"
                  aria-hidden="true"
                />
                {detail.plan.title}
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Headline figures, once anything has been calculated. */}
      {forecast || breakEven ? (
        <FinancialDashboard
          horizonMonths={project.horizon_months}
          figures={{
            currency,
            revenueMinor: numOf(totals, "revenueMinor"),
            grossProfitMinor: numOf(totals, "grossProfitMinor"),
            operatingProfitMinor: numOf(totals, "operatingProfitMinor"),
            breakEvenMonth: numOf(breakEven, "month"),
            breakEvenRevenueMinor: numOf(breakEven, "revenueMinor"),
            monthlyBurnMinor: numOf(cashFlow, "averageMonthlyBurnMinor"),
            runwayMonths: numOf(cashFlow, "runwayMonths"),
            capitalRequiredMinor: numOf(capital, "capitalRequiredMinor"),
            grossMarginBps: numOf(unitEconomics, "grossMarginBps"),
          }}
        />
      ) : null}

      <FinancialStagePipeline
        projectId={project.id}
        progress={progress}
        canRun={access.canCreate}
      />

      {/* Assumptions come BEFORE the calculated views on purpose. */}
      <AssumptionsPanel assumptions={assumptions} currency={currency}>
        {access.canCreate
          ? (assumption) => (
              <AssumptionEditor
                projectId={project.id}
                assumptionKey={assumption.key}
                label={assumption.label}
                unit={assumption.unit}
                currency={currency}
                currentMinor={assumption.value_minor}
                currentInt={assumption.value_int}
              />
            )
          : undefined}
      </AssumptionsPanel>

      <CostsPanel costs={costs} currency={currency} />

      <BreakEvenPanel
        breakEven={breakEven}
        unitEconomics={unitEconomics}
        currency={currency}
        revenueModel={project.revenue_model}
      />

      <ForecastTable content={forecast} currency={currency} />

      <ScenariosPanel content={scenarios} currency={currency} />

      <FundingPanel
        options={detail.fundingOptions}
        sources={detail.sources}
        currency={currency}
      />

      <RisksPanel content={risks} />

      {progress.isComplete ? (
        <Card className="p-6 text-center sm:p-7">
          <p className="text-sm text-muted">
            This model is complete. Change any assumption above and re-run the
            calculated stages to see the whole forecast update.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/financials"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to financial models
    </Link>
  );
}
