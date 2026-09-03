"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AiError, isPlatformConfigured, toAiError } from "@/features/ai";
import { generateExecutionRoadmap } from "@/features/ai/services/execution-roadmap";
import { getBusinessPlan } from "@/features/business-plans/data";
import { getRoadmapForPlan } from "@/features/roadmaps/data";
import { EntitlementError } from "@/features/commerce/errors";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { errorState, type ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";
import {
  executionRoadmapInputSchema,
  type ExecutionRoadmapInput,
} from "@/lib/validations/execution-roadmap";
import { businessPlanInputSchema } from "@/lib/validations/business-plan";
import type { RoadmapTaskStatus } from "@/types/database";

/**
 * Execution roadmap Server Actions (Phase 15).
 *
 * Both actions re-derive the workspace and role from the session rather than
 * trusting a form field, exactly as the business plan actions do. A
 * `workspace_id` posted by the client would be an authorisation hole; RLS would
 * still refuse it, but failing here gives the customer a sentence instead of a
 * database error.
 */

const READ_ONLY = "Your role in this workspace is read-only.";

/** Sections whose prose actually bears on what to do next. */
const SECTION_FOR_PROMPT = {
  executiveSummary: "executive-summary",
  marketingAndSales: "marketing",
  operations: "operations",
  milestonesSection: "roadmap",
} as const;

/** Keep one section from crowding the others out of the context window. */
function trim(text: string | undefined, max = 2_500): string | undefined {
  if (!text) return undefined;
  const clean = text.trim();
  return clean.length === 0 ? undefined : clean.slice(0, max);
}

/**
 * Turn a stored business plan into the roadmap workflow's input.
 *
 * The brief that generated the plan is re-parsed with `.partial()` rather than
 * trusted: `input_json` may have been written by an older schema version, and a
 * roadmap built from what is legible beats a crash. Required fields that are
 * genuinely missing fall back to the plan's own title or a neutral value, so a
 * thin plan still produces a roadmap instead of a validation error the customer
 * can do nothing about.
 */
function planToRoadmapInput(
  planId: string,
  planTitle: string,
  inputJson: unknown,
  sections: { section_key: string; content: string }[],
): ExecutionRoadmapInput | null {
  const parsed = businessPlanInputSchema.partial().safeParse(inputJson ?? {});
  const brief = parsed.success ? parsed.data : {};

  const byKey = new Map(sections.map((s) => [s.section_key, s.content]));

  const candidate = {
    businessName: brief.businessName ?? planTitle,
    ideaDescription:
      brief.ideaDescription ??
      trim(byKey.get(SECTION_FOR_PROMPT.executiveSummary), 3_000) ??
      planTitle,
    industry: brief.industry ?? "Not specified",
    country: brief.country ?? "Not specified",
    targetAudience: brief.targetAudience ?? "Not specified",
    businessModel: brief.businessModel ?? "other",
    currentStage: brief.currentStage ?? "idea",
    estimatedBudget: brief.estimatedBudget ?? 0,
    fundingGoal: brief.fundingGoal,
    timeline: brief.timeline,
    competitors: brief.competitors,
    teamSummary: brief.teamSummary,
    executiveSummary: trim(byKey.get(SECTION_FOR_PROMPT.executiveSummary)),
    marketingAndSales: trim(byKey.get(SECTION_FOR_PROMPT.marketingAndSales)),
    operations: trim(byKey.get(SECTION_FOR_PROMPT.operations)),
    milestonesSection: trim(byKey.get(SECTION_FOR_PROMPT.milestonesSection)),
    businessPlanId: planId,
  };

  const result = executionRoadmapInputSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

/**
 * Generate the execution roadmap for a business plan.
 *
 * The plan id is the only thing taken from the form, and it is never trusted:
 * `getBusinessPlan(workspace.id, planId)` resolves it under the caller's own
 * session and RLS, so a plan in another workspace comes back null and the
 * action stops. Nothing about the workspace, the plan's contents or the
 * entitlement is read from the request.
 *
 * Duplicate protection is two-layered, and the second layer is the real one:
 *
 *   1. This check returns the existing roadmap instead of generating again,
 *      which is what a customer who double-clicks actually experiences.
 *   2. `generateExecutionRoadmap` reserves its allowance under a key derived
 *      from the workspace and plan, so two requests that both get past (1)
 *      concurrently still collide on the unique index in `usage_reservations`
 *      and only one proceeds.
 */
export async function generateExecutionRoadmapAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return errorState(READ_ONLY);

  const planId = formData.get("businessPlanId");
  if (
    typeof planId !== "string" ||
    !z.string().uuid().safeParse(planId).success
  ) {
    return errorState("We couldn't find this business plan.");
  }

  const result = await getBusinessPlan(workspace.id, planId);
  if (!result) {
    // Deliberately the same message for "does not exist" and "not yours":
    // distinguishing them would confirm that an id exists in someone else's
    // workspace.
    return errorState("We couldn't find this business plan.");
  }

  // Already generated — send them to it rather than spending another roadmap.
  const existing = await getRoadmapForPlan(workspace.id, planId);
  if (existing) redirect(`/plans/${planId}/execution`);

  if (!isPlatformConfigured()) {
    return errorState(new AiError("AI_NOT_CONFIGURED").userMessage);
  }

  const input = planToRoadmapInput(
    planId,
    result.plan.title,
    result.plan.input_json,
    result.sections,
  );

  if (!input) {
    return errorState(
      "This business plan is missing information we need to build a roadmap. Try regenerating the plan first.",
    );
  }

  try {
    await generateExecutionRoadmap({
      userId: user.id,
      workspaceId: workspace.id,
      businessPlanId: planId,
      planTitle: result.plan.title,
      input,
    });
  } catch (error) {
    // An entitlement refusal is a product outcome, not a provider fault, and it
    // already carries copy naming the usage, the limit and what to do next.
    if (error instanceof EntitlementError) {
      return errorState(error.message);
    }

    const aiError = toAiError(error);
    console.error("[roadmap] generation failed", {
      code: aiError.code,
      message: aiError.message,
    });
    return errorState(
      "We couldn't create your execution roadmap. Please try again.",
    );
  }

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/execution`);
  revalidatePath("/dashboard");
  redirect(`/plans/${planId}/execution`);
}

const taskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"]),
});

export interface TaskUpdateResult {
  ok: boolean;
  message?: string;
}

/**
 * Move a task to a new status.
 *
 * The task id comes from the client; the workspace does not. The update is
 * filtered on `workspace_id` resolved from the session, and RLS enforces the
 * same thing again in the database, so a task id belonging to another workspace
 * matches zero rows rather than being updated.
 *
 * Progress is not touched here. It is recomputed from these rows by
 * `execution_roadmap_progress` whenever it is read, so there is no stored
 * percentage that could drift from the tasks or be written directly.
 */
export async function setRoadmapTaskStatus(
  input: z.infer<typeof taskUpdateSchema>,
): Promise<TaskUpdateResult> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return { ok: false, message: READ_ONLY };

  const parsed = taskUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("execution_roadmap_tasks")
    .update({ status: parsed.data.status as RoadmapTaskStatus })
    .eq("id", parsed.data.taskId)
    .eq("workspace_id", workspace.id)
    .select("id, roadmap_id")
    .maybeSingle();

  if (error) {
    console.error("[roadmap] task update failed", error.message);
    return { ok: false, message: "That did not save. Please try again." };
  }
  if (!data) {
    return { ok: false, message: "We couldn't find that task." };
  }

  revalidatePath("/plans", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}
