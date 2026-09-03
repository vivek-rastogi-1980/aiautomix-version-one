import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/features/profile/data";
import { getProjects } from "@/features/projects/data";
import { getReports } from "@/features/reports/data";
import { Overview } from "@/features/dashboard/overview";
import { getDashboardFunnel } from "@/features/dashboard/funnel-data";
import { IdeaPanel } from "@/features/dashboard/idea-panel";
import { PlanPanel } from "@/features/dashboard/plan-panel";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { getEntitlementUsage } from "@/features/commerce/enforcement";
import { getBusinessPlans } from "@/features/business-plans/data";
import { getLatestRoadmapSummary } from "@/features/roadmaps/data";
import { ExecutionStatusPanel } from "@/features/roadmaps/execution-status-panel";
import { AdvisorEntryPanel } from "@/features/advisor/advisor-entry-panel";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  // The commercial state is workspace-scoped, so the workspace must resolve
  // first. `getWorkspaceContext` provisions the personal workspace on first
  // read, which is the same path activation uses — one way for a workspace to
  // come into existence.
  const { workspace } = await getWorkspaceContext(user.id);

  const [profile, projects, reports, funnel, planUsage, plans, roadmap] =
    await Promise.all([
      getProfile(user.id),
      getProjects(user.id),
      getReports(user.id),
      // The customer's own funnel state: idea, validation status, score, booking.
      getDashboardFunnel(user.id),
      getEntitlementUsage(workspace.id),
      getBusinessPlans(workspace.id),
      getLatestRoadmapSummary(workspace.id),
    ]);

  // Phase 15: the next step after planning. The roadmap the panel links to is
  // the one belonging to the newest plan when both exist; when a plan exists
  // with no roadmap the panel prompts for one, and with no plan at all it
  // renders nothing rather than showing an execution status for work that has
  // not been planned.
  const latestPlan = plans[0] ?? null;
  const roadmapMatchesLatestPlan =
    roadmap?.roadmap.business_plan_id === latestPlan?.id;

  const name =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "there";

  return (
    <>
      {/* The funnel panel leads, because "what is happening to my idea?" is the
          question a customer opens this page with. The existing Overview keeps
          everything it already showed, below it. */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <IdeaPanel funnel={funnel} />
        <PlanPanel usage={planUsage} />
      </div>
      <div className="mb-6">
        <ExecutionStatusPanel
          businessPlanId={latestPlan?.id ?? null}
          planTitle={latestPlan?.title ?? null}
          progress={
            roadmap && roadmapMatchesLatestPlan ? roadmap.progress : null
          }
        />
      </div>

      <div className="mb-6">
        <AdvisorEntryPanel hasBusinessPlan={latestPlan !== null} />
      </div>

      <Overview
        name={name}
        profile={profile}
        projects={projects}
        reportCount={reports.length}
      />
    </>
  );
}
