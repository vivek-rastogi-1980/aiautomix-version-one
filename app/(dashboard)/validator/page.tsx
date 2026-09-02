import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getProjects } from "@/features/projects/data";
import { IdeaForm } from "@/features/business-ideas/idea-form";
import { getIdeaDraft } from "@/features/business-ideas/draft";
import { isPlatformConfigured } from "@/features/ai";
import { FormAlert } from "@/components/ui/form-message";

export const metadata: Metadata = {
  title: "Business Idea Validator",
  description:
    "Validate your business idea with an AI-generated analysis and score.",
};

export default async function ValidatorPage() {
  const user = await requireUser();
  // Two independent reads; no reason to await them in series.
  const [projects, draft] = await Promise.all([
    getProjects(user.id),
    getIdeaDraft(user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Business Idea Validator
          </h1>
          <p className="text-muted">
            Get a structured, scored analysis of your idea in under a minute.
          </p>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <History className="size-4" /> Report history
        </Link>
      </div>

      {!isPlatformConfigured() ? (
        <FormAlert variant="error">
          The AI service is not configured. Add <code>OPENAI_API_KEY</code> to
          your environment to run a validation.
        </FormAlert>
      ) : null}

      <IdeaForm projects={projects} draft={draft} />
    </div>
  );
}
