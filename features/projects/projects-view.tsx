"use client";

import { useState } from "react";
import { FolderKanban, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/features/projects/project-card";
import { ProjectFormModal } from "@/features/projects/project-form-modal";
import { DeleteProjectDialog } from "@/features/projects/delete-project-dialog";
import type { Project } from "@/types/database";

interface ProjectsViewProps {
  projects: Project[];
}

export function ProjectsView({ projects }: ProjectsViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Projects
          </h1>
          <p className="text-muted">
            Create and manage the projects in your workspace.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <FolderKanban className="size-7" />
          </span>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            No projects yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Projects help you organise your work. Create your first one to get
            started.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ProjectFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ProjectFormModal
        key={editTarget?.id ?? "edit"}
        open={Boolean(editTarget)}
        project={editTarget}
        onClose={() => setEditTarget(null)}
      />
      <DeleteProjectDialog
        project={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
