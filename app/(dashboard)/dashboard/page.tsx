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

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  // The commercial state is workspace-scoped, so the workspace must resolve
  // first. `getWorkspaceContext` provisions the personal workspace on first
  // read, which is the same path activation uses — one way for a workspace to
  // come into existence.
  const { workspace } = await getWorkspaceContext(user.id);

  const [profile, projects, reports, funnel, planUsage] = await Promise.all([
    getProfile(user.id),
    getProjects(user.id),
    getReports(user.id),
    // The customer's own funnel state: idea, validation status, score, booking.
    getDashboardFunnel(user.id),
    getEntitlementUsage(workspace.id),
  ]);

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
      <Overview
        name={name}
        profile={profile}
        projects={projects}
        reportCount={reports.length}
      />
    </>
  );
}
