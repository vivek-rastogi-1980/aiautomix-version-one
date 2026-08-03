import type { Metadata } from "next";
import { FileText, FolderKanban, Lightbulb, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getWorkspaceContext,
  getWorkspaceMembers,
  getWorkspaceStats,
} from "@/features/workspaces/data";
import { RenameWorkspaceForm } from "@/features/workspaces/rename-workspace-form";
import {
  canManage,
  ROLE_BADGE,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Your workspace, its members and what it contains.",
};

/**
 * Workspace overview (WORKSPACE-ARCHITECTURE.md).
 *
 * The visible half of the workspace foundation: which workspace you are in,
 * what role you hold, who else is in it, and what it contains. Invitations and
 * role changes are collaboration features and are out of scope for this sprint.
 */
export default async function WorkspacePage() {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  const [members, stats] = await Promise.all([
    getWorkspaceMembers(workspace.id),
    getWorkspaceStats(workspace.id),
  ]);

  const counts = [
    { label: "Projects", value: stats.projects, icon: FolderKanban },
    { label: "Business ideas", value: stats.ideas, icon: Lightbulb },
    { label: "Business plans", value: stats.plans, icon: NotebookPen },
    { label: "Validation reports", value: stats.reports, icon: FileText },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Workspace
        </h1>
        <p className="text-muted">
          Everything you create — projects, ideas, plans and reports — belongs
          to a workspace.
        </p>
      </div>

      <Card className="flex flex-col gap-6 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              {workspace.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Created {formatDate(workspace.created_at)}
              {workspace.is_personal ? " · Personal workspace" : ""}
            </p>
          </div>
          <div className="text-right">
            <Badge variant={ROLE_BADGE[role]}>
              Your role: {ROLE_LABELS[role]}
            </Badge>
            <p className="mt-1.5 max-w-xs text-xs text-muted">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
        </div>

        {canManage(role) ? (
          <div className="border-t border-white/[0.06] pt-6">
            <RenameWorkspaceForm name={workspace.name} />
          </div>
        ) : null}
      </Card>

      <section
        aria-labelledby="contents-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="contents-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Contents
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {counts.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                  <Icon className="size-[18px]" />
                </span>
                <dt className="text-sm font-medium text-muted">{label}</dt>
              </div>
              <dd className="mt-3 font-display text-2xl font-bold tabular-nums text-foreground">
                {value}
              </dd>
            </Card>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="members-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="members-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Members
        </h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[24rem] text-left text-sm">
            <caption className="sr-only">Workspace members and roles</caption>
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-muted-strong">
                <th scope="col" className="px-5 py-3 font-medium">
                  Member
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Role
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-white/[0.05] last:border-0"
                >
                  <th
                    scope="row"
                    className="px-5 py-3 font-medium text-foreground"
                  >
                    {member.user_id === user.id ? "You" : "Workspace member"}
                  </th>
                  <td className="px-5 py-3">
                    <Badge variant={ROLE_BADGE[member.role]}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {formatDate(member.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-sm text-muted">
          Inviting people and changing roles arrives with collaboration; the
          role model and its permissions are already enforced in the database.
        </p>
      </section>
    </div>
  );
}
