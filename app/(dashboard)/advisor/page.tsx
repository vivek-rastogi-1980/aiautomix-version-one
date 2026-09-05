import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-message";
import { isPlatformConfigured } from "@/features/ai";
import { AdvisorForm } from "@/features/advisor/advisor-form";
import {
  getBusinessAdvisorContext,
  hasUsableContext,
  suggestedQuestions,
} from "@/features/advisor/context";
import { getConversations } from "@/features/advisor/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "AI Business Advisor",
  description:
    "Practical business guidance based on your validated idea, business plan and execution progress.",
};

export default async function AdvisorPage() {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  // The context is assembled from the caller's own workspace. Nothing about
  // which business is loaded comes from the request.
  const [context, conversations] = await Promise.all([
    getBusinessAdvisorContext(user.id, workspace.id),
    getConversations(workspace.id),
  ]);

  const usable = hasUsableContext(context);
  const editable = canEdit(role);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          AI Business Advisor
        </h1>
        <p className="text-muted">
          Practical guidance based on your validated idea, business plan and
          execution progress.
        </p>
      </div>

      {!isPlatformConfigured() ? (
        <FormAlert variant="error">
          Your AI Advisor is temporarily unavailable.
        </FormAlert>
      ) : null}

      {/* --- What the advisor can actually see ------------------------- */}
      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-base font-bold tracking-tight text-foreground">
          Your advisor understands your
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Validated idea", ok: context.availability.validation },
            { label: "Business plan", ok: context.availability.business_plan },
            { label: "Execution roadmap", ok: context.availability.roadmap },
          ].map((item) => (
            <li
              key={item.label}
              className={cn(
                "flex items-center gap-2 text-sm",
                item.ok ? "text-foreground" : "text-muted",
              )}
            >
              <span aria-hidden className={item.ok ? "text-accent" : ""}>
                {item.ok ? "✓" : "—"}
              </span>
              {item.label}
              {!item.ok ? (
                <span className="text-xs text-muted-strong">not yet</span>
              ) : null}
            </li>
          ))}
        </ul>
        {context.execution ? (
          <p className="mt-3 text-sm text-muted">
            Currently {context.execution.progress_percent}% through your roadmap
            · {context.execution.completed_tasks} of{" "}
            {context.execution.total_tasks} tasks completed.
          </p>
        ) : null}
      </Card>

      {/* --- §25 empty state ------------------------------------------- */}
      {!usable ? (
        <Card className="flex flex-col items-start gap-4 p-6 sm:p-7">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <Sparkles className="size-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Your advisor works best when it understands your business
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Start by validating your idea and creating a business plan. Until
              then the advisor has nothing specific to your business to reason
              about, and we would rather say so than give you generic advice.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/validator"
              className={cn(buttonVariants({ size: "md" }))}
            >
              Validate your idea
            </Link>
            <Link
              href="/plans/new"
              className={cn(
                buttonVariants({ variant: "secondary", size: "md" }),
              )}
            >
              Create a business plan
            </Link>
          </div>
        </Card>
      ) : (
        <AdvisorForm
          suggestions={suggestedQuestions(context)}
          disabled={!editable || !isPlatformConfigured()}
        />
      )}

      {/* --- Previous conversations ------------------------------------ */}
      {conversations.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Previous conversations
          </h2>
          <ul className="flex flex-col gap-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/advisor/${conversation.id}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
                >
                  <Card className="flex items-center gap-3 p-4 transition-colors group-hover:border-white/20">
                    <MessageSquare className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {conversation.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDate(conversation.updated_at)}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
