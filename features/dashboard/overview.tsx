import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FolderKanban,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Profile, Project, ProjectStatus } from "@/types/database";

interface OverviewProps {
  name: string;
  profile: Profile | null;
  projects: Project[];
  reportCount: number;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof FolderKanban;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="flex size-11 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}

export function Overview({
  name,
  profile,
  projects,
  reportCount,
}: OverviewProps) {
  const activeCount = projects.filter((p) => p.status === "active").length;
  const recent = projects.slice(0, 5);

  const profileComplete = Boolean(profile?.full_name && profile?.company_name);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back, {name.split(" ")[0]}
        </h1>
        <p className="text-muted">Here&apos;s a snapshot of your workspace.</p>
      </div>

      {/* Primary call to action for the flagship AI workflow. */}
      <Card className="flex flex-col gap-4 border-brand-violet/25 bg-brand-violet/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Validate a business idea
          </h2>
          <p className="mt-1 text-sm text-muted">
            Get a scored, structured AI analysis with SWOT, risks and next
            steps.
          </p>
        </div>
        <Link
          href="/validator"
          className={cn(buttonVariants({ size: "md" }), "shrink-0")}
        >
          <Sparkles className="size-4" /> Start validation
        </Link>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total projects"
          value={projects.length}
          icon={FolderKanban}
        />
        <StatCard label="Active projects" value={activeCount} icon={Sparkles} />
        <StatCard label="Reports" value={reportCount} icon={FileText} />
        <StatCard
          label="Profile"
          value={profileComplete ? "Complete" : "Incomplete"}
          icon={UserRound}
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Recent projects
            </h2>
            <p className="text-sm text-muted">
              Your most recently created work.
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            View all <ArrowRight className="size-4" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
              <FolderKanban className="size-6" />
            </span>
            <p className="mt-4 font-medium text-foreground">No projects yet</p>
            <p className="mt-1 text-sm text-muted">
              Create your first project to get started.
            </p>
            <Link
              href="/projects"
              className={cn(buttonVariants({ size: "sm" }), "mt-5")}
            >
              <Plus className="size-4" /> New project
            </Link>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-line">
            {recent.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {project.name}
                  </p>
                  <p className="text-xs text-muted">
                    Created {formatDate(project.created_at)}
                  </p>
                </div>
                <Badge variant={project.status}>
                  {STATUS_LABEL[project.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
