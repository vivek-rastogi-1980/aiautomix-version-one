import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FormAlert } from "@/components/ui/form-message";
import { isPlatformConfigured } from "@/features/ai";
import { PlanForm } from "@/features/business-plans/plan-form";
import { getBusinessIdeas } from "@/features/reports/data";
import { getProjects } from "@/features/projects/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "New business plan",
  description: "Generate an eleven-section business plan from a short brief.",
};

export default async function NewPlanPage() {
  const user = await requireUser();
  const { role } = await getWorkspaceContext(user.id);

  const [projects, ideas] = await Promise.all([
    getProjects(user.id),
    getBusinessIdeas(user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/plans"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to plans
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          New business plan
        </h1>
        <p className="text-muted">
          One brief in, a full plan out — then edit any section and keep its
          history.
        </p>
      </div>

      {!canEdit(role) ? (
        <FormAlert variant="error">
          Your role in this workspace is read-only, so you cannot generate
          plans.
        </FormAlert>
      ) : (
        <>
          {!isPlatformConfigured() ? (
            <FormAlert variant="error">
              The AI service is not configured. Add <code>OPENAI_API_KEY</code>{" "}
              to your environment to generate a plan.
            </FormAlert>
          ) : null}
          <PlanForm projects={projects} ideas={ideas} />
        </>
      )}
    </div>
  );
}
