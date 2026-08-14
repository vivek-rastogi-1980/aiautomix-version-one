import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getGtmDetail, getGtmSources } from "@/features/marketing/data";
import { getGtmAccess } from "@/features/marketing/permissions";
import { MarketingAccessNotice } from "@/features/marketing/marketing-access-notice";
import { GtmStagePipeline } from "@/features/marketing/stage-pipeline";
import {
  AcquisitionPanel,
  CampaignsPanel,
  ChannelsPanel,
  ClaimsPanel,
  FunnelPanel,
  GtmDashboard,
  PersonasPanel,
  PlanPanel,
  PositioningPanel,
  SourcesPanel,
} from "@/features/marketing/marketing-views";
import { gtmStatusLabel } from "@/features/marketing/progress";
import {
  CHANNEL_LABELS,
  GTM_STAGE_LABELS,
  isChannel,
} from "@/features/marketing/types";
import { isCurrencyCode, type CurrencyCode } from "@/features/financials/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Marketing plan" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Narrow a stored `structured_content` blob to an object, or null. */
function content(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default async function MarketingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const access = await getGtmAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <MarketingAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const detail = await getGtmDetail(access.workspace.id, id);
  if (!detail) notFound();

  const {
    project,
    progress,
    personas,
    channels,
    funnelSteps,
    campaigns,
    planActions,
    claims,
    results,
  } = detail;

  const sources = await getGtmSources(project.id);

  const currency: CurrencyCode = isCurrencyCode(project.currency)
    ? project.currency
    : "USD";

  const icp = content(
    results.get("ideal_customer_profile")?.structured_content,
  );
  const positioning = content(results.get("positioning")?.structured_content);
  const messaging = content(results.get("messaging")?.structured_content);
  const channelSection = content(
    results.get("channel_strategy")?.structured_content,
  );
  const contentSection = content(
    results.get("content_strategy")?.structured_content,
  );
  const economics = content(
    results.get("acquisition_economics")?.structured_content,
  );
  const budget = content(results.get("marketing_budget")?.structured_content);
  const planSection = content(
    results.get("ninety_day_plan")?.structured_content,
  );

  const status = gtmStatusLabel(progress, project.status);

  const rubric = Array.isArray(channelSection?.rubric)
    ? (channelSection.rubric as Record<string, unknown>[]).map((entry) => ({
        key: String(entry.key ?? ""),
        label: String(entry.label ?? ""),
        weightBps: numeric(entry.weightBps) ?? 0,
        inverted: entry.inverted === true,
        meaning: String(entry.meaning ?? ""),
      }))
    : [];

  const channelNames = (priority: string): string[] =>
    channels
      .filter((channel) => channel.priority === priority)
      .map((channel) =>
        isChannel(channel.channel)
          ? CHANNEL_LABELS[channel.channel]
          : channel.channel,
      );

  const firstActions = Array.isArray(planSection?.firstActions)
    ? (planSection.firstActions as unknown[])
        .map((item) => text(item))
        .filter((item): item is string => item !== null)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <BackLink />

      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-violet">
              Go-To-Market Plan
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {project.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Created {formatDate(project.created_at)} · {currency}
              {project.geography ? ` · ${project.geography}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              {!access.canCreate ? (
                <Badge variant="neutral">Read-only</Badge>
              ) : null}
            </div>
          </div>

          {progress.isComplete ? (
            <Link
              href={`/marketing/${project.id}/report`}
              className={cn(buttonVariants({ size: "md" }))}
            >
              <FileText className="size-4" /> View report
            </Link>
          ) : null}
        </div>
      </Card>

      <GtmStagePipeline
        projectId={project.id}
        progress={progress}
        canRun={access.canCreate}
      />

      <GtmDashboard
        figures={{
          currency,
          motion: project.motion,
          status: project.status,
          currentStageLabel: progress.nextStage
            ? GTM_STAGE_LABELS[progress.nextStage]
            : "Complete",
          icpSummary: text(icp?.summary),
          primaryChannels: channelNames("PRIMARY"),
          secondaryChannels: channelNames("SECONDARY"),
          positioningStatement: text(positioning?.positioningStatement),
          budgetMinor: numeric(economics?.budgetMinor),
          allowableCacMinor: numeric(economics?.allowableCacMinor),
          targetNewCustomers: project.target_new_customers,
          targetHorizonMonths: project.target_horizon_months,
          planActionCount: planActions.length,
        }}
      />

      <PersonasPanel personas={personas} />
      <PositioningPanel positioning={positioning} messaging={messaging} />
      <ChannelsPanel channels={channels} rubric={rubric} />
      <CampaignsPanel campaigns={campaigns} content={contentSection} />
      <FunnelPanel steps={funnelSteps} computed={economics} />
      <AcquisitionPanel
        economics={economics}
        budget={budget}
        currency={currency}
      />
      <PlanPanel actions={planActions} firstActions={firstActions} />
      <ClaimsPanel claims={claims} />
      <SourcesPanel sources={sources} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/marketing"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to marketing plans
    </Link>
  );
}
