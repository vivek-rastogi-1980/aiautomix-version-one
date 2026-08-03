import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { getProjects } from "@/features/projects/data";
import { ProjectsView } from "@/features/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await getProjects(user.id);

  return <ProjectsView projects={projects} />;
}
