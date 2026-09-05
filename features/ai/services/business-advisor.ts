import "server-only";

import { AiError } from "@/features/ai/engine/errors";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { BUSINESS_ADVISOR_WORKFLOW } from "@/features/ai/registry/workflows";
import type { BusinessAdvisorResponse } from "@/features/ai/schemas/business-advisor";
import {
  consumeEntitlement,
  releaseEntitlement,
} from "@/features/commerce/enforcement";
import { EntitlementError } from "@/features/commerce/errors";
import { createClient } from "@/lib/supabase/server";
import type { AdvisorContext } from "@/features/advisor/context";
import type { AdvisorConversation, AdvisorMessage } from "@/types/database";

/**
 * AI Business Advisor service (Phase 16).
 *
 * A thin consumer of the AI Platform on the same terms as every other product
 * here: the Workflow Manager owns execution, prompt loading, schema validation,
 * retries, history and usage tracking. What lives here is the conversation
 * persistence the platform knows nothing about.
 *
 * The ordering is the one the validator and plan generator already use, and for
 * the same reasons:
 *
 *   reserve entitlement -> run workflow -> persist -> release on failure
 *
 * One deliberate difference: the user's message is written only after the model
 * answers. A plan is worth recording even when generation failed, because the
 * customer can see the attempt and retry it. A question with no answer is just
 * a dead row in a thread — so nothing is persisted unless there is an exchange
 * to persist.
 */

export interface AdvisorTurnOptions {
  userId: string;
  workspaceId: string;
  question: string;
  context: AdvisorContext;
  /** Existing thread to continue, or null to start one. */
  conversationId: string | null;
  /** Prior turns, oldest first, already capped by the caller. */
  history: AdvisorMessage[];
}

export interface AdvisorTurnOutcome {
  conversation: AdvisorConversation;
  response: BusinessAdvisorResponse;
}

/**
 * Serialise the context for the prompt.
 *
 * Nulls are dropped rather than sent as `"validation": null`: a model shown an
 * explicit null tends to comment on the absence, and the availability note
 * already states what is missing in words.
 */
export function renderBusinessContext(context: AdvisorContext): string {
  const payload: Record<string, unknown> = {};
  if (context.business) payload.business = context.business;
  if (context.validation) payload.validation = context.validation;
  if (context.plan) payload.plan = context.plan;
  if (context.execution) payload.execution = context.execution;
  return JSON.stringify(payload, null, 1);
}

export function renderAvailability(context: AdvisorContext): string {
  const { validation, business_plan, roadmap } = context.availability;
  return [
    `Validation report: ${validation ? "available" : "NOT AVAILABLE"}`,
    `Business plan: ${business_plan ? "available" : "NOT AVAILABLE"}`,
    `Execution roadmap: ${roadmap ? "available" : "NOT CREATED YET"}`,
  ].join("\n");
}

/** Turns the model has to read. Capped — see §19. */
export const HISTORY_TURNS = 6;

/**
 * Render prior turns for the prompt.
 *
 * Only the plain `content` is replayed, never the full structured response:
 * re-sending every past action list would grow each question's cost with the
 * length of the thread for very little gain.
 */
export function renderHistory(history: AdvisorMessage[]): string | undefined {
  const recent = history.slice(-HISTORY_TURNS);
  if (recent.length === 0) return undefined;
  return recent
    .map((m) => `${m.role === "user" ? "Customer" : "Advisor"}: ${m.content}`)
    .join("\n\n")
    .slice(0, 6_000);
}

/** A thread title from the first question — no extra model call for it. */
function titleFrom(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length <= 80 ? clean : `${clean.slice(0, 77)}…`;
}

export async function askBusinessAdvisor({
  userId,
  workspaceId,
  question,
  context,
  conversationId,
  history,
}: AdvisorTurnOptions): Promise<AdvisorTurnOutcome> {
  const supabase = await createClient();

  // ---------------------------------------------------------------------
  // Entitlement, before the model call.
  //
  // The key includes the turn count, so each question in a thread is its own
  // billable unit — unlike a plan, where a retry of the same request must
  // collide. A double-submitted question is guarded by the UI disabling the
  // form; charging the second one is the correct outcome if it genuinely is a
  // second question.
  // ---------------------------------------------------------------------
  const reservationKey = `ai_advisor:${workspaceId}:${conversationId ?? "new"}:${history.length}:${Date.now()}`;

  const entitlement = await consumeEntitlement(
    workspaceId,
    "ai_advisor",
    reservationKey,
  );

  if (!entitlement.allowed) {
    throw new EntitlementError(entitlement);
  }

  try {
    // All AI goes through the platform — never a direct provider call. The
    // Workflow Manager validates the answer against
    // `businessAdvisorResponseSchema` before returning it.
    const { data, metadata, requestId } =
      await runWorkflow<BusinessAdvisorResponse>({
        workflowId: BUSINESS_ADVISOR_WORKFLOW,
        userId,
        workspaceId,
        input: {
          question,
          businessContext: renderBusinessContext(context),
          conversationContext: renderHistory(history),
          availabilityNote: renderAvailability(context),
        },
      });

    // The thread exists only once there is an exchange worth keeping.
    let conversation: AdvisorConversation;
    if (conversationId) {
      const { data: existing, error } = await supabase
        .from("advisor_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (error || !existing) {
        throw new AiError(
          "AI_PROVIDER_ERROR",
          `Could not update the conversation: ${error?.message ?? "not found"}`,
        );
      }
      conversation = existing;
    } else {
      const { data: created, error } = await supabase
        .from("advisor_conversations")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          title: titleFrom(question),
        })
        .select()
        .single();

      if (error || !created) {
        throw new AiError(
          "AI_PROVIDER_ERROR",
          `Could not start the conversation: ${error?.message ?? "unknown error"}`,
        );
      }
      conversation = created;
    }

    const { error: messageError } = await supabase
      .from("advisor_messages")
      .insert([
        {
          conversation_id: conversation.id,
          workspace_id: workspaceId,
          role: "user" as const,
          content: question,
        },
        {
          conversation_id: conversation.id,
          workspace_id: workspaceId,
          role: "assistant" as const,
          content: data.answer,
          response: data as unknown as Record<string, unknown>,
          model: metadata.model,
          ai_request_id: requestId,
        },
      ]);

    if (messageError) {
      throw new AiError(
        "AI_PROVIDER_ERROR",
        `Could not save the conversation: ${messageError.message}`,
      );
    }

    return { conversation, response: data };
  } catch (error) {
    // The question was not answered, so it should not cost the customer a
    // question — matching the success-only policy every other feature here
    // uses.
    await releaseEntitlement(reservationKey);
    throw error;
  }
}
