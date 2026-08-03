"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { Project, ProjectStatus } from "@/types/database";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate font-display text-lg font-bold tracking-tight text-foreground">
          {project.name}
        </h3>
        <Badge variant={project.status}>{STATUS_LABEL[project.status]}</Badge>
      </div>

      <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm text-muted">
        {project.description || "No description yet."}
      </p>

      {project.website ? (
        <a
          href={project.website}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-cyan hover:underline"
        >
          <ExternalLink className="size-3.5" />
          <span className="truncate">
            {project.website.replace(/^https?:\/\//, "")}
          </span>
        </a>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <span className="text-xs text-muted-strong">
          {formatDate(project.created_at)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(project)}
            aria-label={`Edit ${project.name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(project)}
            aria-label={`Delete ${project.name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger-soft"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
