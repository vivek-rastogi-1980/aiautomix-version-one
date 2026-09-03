"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AiError, isPlatformConfigured, toAiError } from "@/features/ai";
import { askBusinessAdvisor } from "@/features/ai/services/business-advisor";
import {
  getBusinessAdvisorContext,
  hasUsableContext,
} from "@/features/advisor/context";
import { getConversation, getMessages } from "@/features/advisor/data";
import { getRoadmapForPlan } from "@/features/roadmaps/data";
import { EntitlementError } from "@/features/commerce/errors";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { errorState, type ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";
import { ADVISOR_QUESTION_MAX } from "@/lib/validations/business-advisor";

/**
 * AI Business Advisor Server Actions (Phase 16).
 *
 * The security shape of this feature is one sentence: the workspace comes from
 * the session and nothing else. No action here accepts a workspace id, business
 * plan id, validation report id or roadmap id as context — the only id a client
 * may send is a conversation id, and that is re-resolved against the caller's
 * own workspace before it is used. So there is no request a browser can compose
 * that points the advisor at another customer's business.
 */

const READ_ONLY = "Your role in this workspace is read-only.";

const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Ask a question of at least a few words")
    .max(ADVISOR_QUESTION_MAX, "That question is too long"),
  conversationId: z.string().uuid().optional(),
});

/**
 * Ask the advisor a question.
 *
 * The business context is assembled server-side from the caller's workspace
 * immediately before the model call, so the advice is always about the account
 * as it is now rather than as some earlier page render believed it to be.
 */
export async function askAdvisorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return errorState(READ_ONLY);

  const rawConversationId = formData.get("conversationId");
  const parsed = askSchema.safeParse({
    question: formData.get("question"),
    conversationId:
      typeof rawConversationId === "string" && rawConversationId.length > 0
        ? rawConversationId
        : undefined,
  });

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Please ask a question.",
    );
  }

  if (!isPlatformConfigured()) {
    return errorState(new AiError("AI_NOT_CONFIGURED").userMessage);
  }

  const context = await getBusinessAdvisorContext(user.id, workspace.id);

  // §25: without a validated idea or a plan there is no business to advise on,
  // and answering anyway would be a generic chatbot pretending to know them.
  if (!hasUsableContext(context)) {
    return errorState(
      "We need a little more information about your business before we can give a useful recommendation. Validate your idea or create a business plan first.",
    );
  }

  // A conversation id from the client is re-resolved against this workspace.
  // One belonging to anyone else comes back null and the turn simply starts a
  // new thread rather than joining theirs.
  let conversationId: string | null = null;
  let history: Awaited<ReturnType<typeof getMessages>> = [];
  if (parsed.data.conversationId) {
    const existing = await getConversation(
      workspace.id,
      parsed.data.conversationId,
    );
    if (existing) {
      conversationId = existing.id;
      history = await getMessages(workspace.id, existing.id);
    }
  }

  let targetConversationId: string;
  try {
    const outcome = await askBusinessAdvisor({
      userId: user.id,
      workspaceId: workspace.id,
      question: parsed.data.question,
      context,
      conversationId,
      history,
    });
    targetConversationId = outcome.conversation.id;
  } catch (error) {
    // An entitlement refusal is a product outcome and already carries copy
    // naming the usage, the limit and what to do next.
    if (error instanceof EntitlementError) {
      return errorState(error.message);
    }

    const aiError = toAiError(error);
    console.error("[advisor] question failed", {
      code: aiError.code,
      message: aiError.message,
    });
    return errorState(
      "Your AI Advisor is temporarily unavailable. Please try again.",
    );
  }

  revalidatePath("/advisor");
  redirect(`/advisor/${targetConversationId}`);
}

const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  reason: z.string().trim().max(600).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export interface CreateTaskResult {
  ok: boolean;
  message: string;
}

/**
 * Turn an advisor recommendation into a roadmap task (§23).
 *
 * Reuses the Phase 15 task system rather than introducing a second one: the
 * row goes into `execution_roadmap_tasks` on the customer's existing roadmap,
 * so it appears on the roadmap page, counts toward progress, and can be ticked
 * off like any other task.
 *
 * Added to the 30-day period, because an action the advisor recommended in
 * response to "what should I do now?" belongs in the immediate horizon. Sort
 * order puts it at the end of that period rather than displacing generated
 * work.
 */
export async function createTaskFromAdvice(
  input: z.infer<typeof createTaskSchema>,
): Promise<CreateTaskResult> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return { ok: false, message: READ_ONLY };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That task could not be created." };
  }

  // The roadmap is found from the caller's own workspace — the client never
  // names one.
  const context = await getBusinessAdvisorContext(user.id, workspace.id);
  if (!context.businessPlanId) {
    return {
      ok: false,
      message: "Create a business plan before adding tasks.",
    };
  }

  const roadmap = await getRoadmapForPlan(workspace.id, context.businessPlanId);
  if (!roadmap) {
    return {
      ok: false,
      message: "Create an execution roadmap before adding tasks.",
    };
  }

  const supabase = await createClient();

  // Append after whatever is already in the 30-day period.
  const { data: last } = await supabase
    .from("execution_roadmap_tasks")
    .select("sort_order")
    .eq("workspace_id", workspace.id)
    .eq("roadmap_id", roadmap.id)
    .eq("period", "30")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("execution_roadmap_tasks").insert({
    roadmap_id: roadmap.id,
    workspace_id: workspace.id,
    period: "30" as const,
    title: parsed.data.title,
    description: parsed.data.reason ?? null,
    // The advisor recommends work; it does not classify it by department.
    // GENERAL is the honest label rather than a guessed one.
    category: "GENERAL" as const,
    priority: parsed.data.priority,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (error) {
    console.error("[advisor] create task failed", error.message);
    return { ok: false, message: "That task could not be created." };
  }

  revalidatePath(`/plans/${context.businessPlanId}/execution`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Added to your 30-day roadmap." };
}
