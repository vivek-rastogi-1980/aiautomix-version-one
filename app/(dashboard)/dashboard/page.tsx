import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/features/profile/data";
import { getProjects } from "@/features/projects/data";
import { getReports } from "@/features/reports/data";
import { Overview } from "@/features/dashboard/overview";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [profile, projects, reports] = await Promise.all([
    getProfile(user.id),
    getProjects(user.id),
    getReports(user.id),
  ]);

  const name =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "there";

  return (
    <Overview
      name={name}
      profile={profile}
      projects={projects}
      reportCount={reports.length}
    />
  );
}
