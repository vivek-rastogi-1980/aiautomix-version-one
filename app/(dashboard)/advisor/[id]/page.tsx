import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AdviceCard } from "@/features/advisor/advice-card";
import { AdvisorForm } from "@/features/advisor/advisor-form";
import {
  getBusinessAdvisorContext,
  suggestedQuestions,
} from "@/features/advisor/context";
import { getConversationDetail } from "@/features/advisor/data";
import { isPlatformConfigured } from "@/features/ai";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "AI Business Advisor" };

export default async function AdvisorConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  // §17: the conversation is resolved against the caller's own workspace. One
  // belonging to another workspace comes back null and becomes a 404 — the same
  // response as an id that never existed, so an id cannot be probed.
  const detail = await getConversationDetail(workspace.id, id);
  if (!detail) notFound();

  const context = await getBusinessAdvisorContext(user.id, workspace.id);
  const editable = canEdit(role);
  const { conversation, messages } = detail;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/advisor"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to advisor
      </Link>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-violet">
          AI Business Advisor
        </p>
        <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {conversation.title}
        </h1>
      </div>

      <ol className="flex flex-col gap-4">
        {messages.map((message) =>
          message.role === "user" ? (
            <li key={message.id} className="flex justify-end">
              <Card className="max-w-2xl bg-fill-1 p-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {message.content}
                </p>
              </Card>
            </li>
          ) : (
            <li key={message.id}>
              <AdviceCard
                response={message.response}
                fallbackText={message.content}
                // Adding a task needs an existing roadmap; the action says so
                // clearly when there is none, so the button stays available
                // rather than silently disappearing.
                canCreateTasks={editable && context.availability.roadmap}
              />
            </li>
          ),
        )}
      </ol>

      <AdvisorForm
        conversationId={conversation.id}
        suggestions={suggestedQuestions(context)}
        disabled={!editable || !isPlatformConfigured()}
      />
    </div>
  );
}
