import "server-only";

import { AiError } from "@/features/ai/engine/errors";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { getDefaultProviderId, resolveModelId } from "@/features/ai/providers";
import {
  EXECUTION_ROADMAP_WORKFLOW,
  getWorkflow,
} from "@/features/ai/registry/workflows";
import {
  roadmapPeriodBlocks,
  type ExecutionRoadmapDocument,
} from "@/features/ai/schemas/execution-roadmap";
import { createClient } from "@/lib/supabase/server";
import type { ExecutionRoadmapInput } from "@/lib/validations/execution-roadmap";
import {
  consumeEntitlement,
  releaseEntitlement,
} from "@/features/commerce/enforcement";
import { EntitlementError } from "@/features/commerce/errors";
import type { ExecutionRoadmap, ExecutionRoadmapTask } from "@/types/database";

/**
 * Execution Roadmap service (Phase 15).
 *
 * A thin consumer of the AI Platform, on exactly the terms the Business Plan
 * service already uses: the Workflow Manager owns execution, prompt loading,
 * schema validation, retries, history and usage tracking. What lives here is
 * the domain persistence the platform knows nothing about — the roadmap row and
 * its tasks.
 *
 * The shape below is deliberately the same as `generateBusinessPlan`, down to
 * the ordering, because the properties that make that function safe are the
 * ones this one needs:
 *
 *   reserve entitlement -> insert row -> run workflow -> persist -> release on
 *   failure
 *
 * Reserving first is what makes a denial cost zero AI spend. Inserting the row
 * before the model call is what makes a failed generation visible rather than
 * silent.
 */

export interface RoadmapGenerationOutcome {
  roadmap: ExecutionRoadmap;
  tasks: ExecutionRoadmapTask[];
  document: ExecutionRoadmapDocument;
}

export interface GenerateRoadmapOptions {
  userId: string;
  workspaceId: string;
  /** Already resolved and authorised by the caller. */
  businessPlanId: string;
  planTitle: string;
  input: ExecutionRoadmapInput;
}

/**
 * A stable fingerprint for one roadmap generation attempt.
 *
 * Keyed on the business plan rather than the wording of the brief: a roadmap is
 * "the roadmap for this plan", so a retry — a double submit, a refresh, a
 * network retry — collides with its first attempt instead of consuming a second
 * roadmap from the monthly allowance. This is the idempotency §14 asks for, and
 * it is enforced by the unique index on `usage_reservations.idempotency_key`
 * rather than by anything in the browser.
 */
function roadmapIdempotencyKey(
  workspaceId: string,
  businessPlanId: string,
): string {
  return `execution_roadmap:${workspaceId}:${businessPlanId}`;
}

export async function generateExecutionRoadmap({
  userId,
  workspaceId,
  businessPlanId,
  planTitle,
  input,
}: GenerateRoadmapOptions): Promise<RoadmapGenerationOutcome> {
  const supabase = await createClient();
  const workflow = getWorkflow(EXECUTION_ROADMAP_WORKFLOW);

  // ---------------------------------------------------------------------
  // Entitlement, before the row and long before the model call.
  //
  // `entitlement_consume` locks this workspace's counter, compares it to the
  // CURRENT configured limit and increments in one statement, so two
  // simultaneous generations cannot both pass with one unit left. No second
  // usage counter is introduced here — this is the same atomic mechanism the
  // validator and the plan generator use.
  // ---------------------------------------------------------------------
  const reservationKey = roadmapIdempotencyKey(workspaceId, businessPlanId);

  const entitlement = await consumeEntitlement(
    workspaceId,
    "execution_roadmap",
    reservationKey,
  );

  if (!entitlement.allowed) {
    throw new EntitlementError(entitlement);
  }

  // 1. Record the attempt first, so a roadmap that fails mid-generation is
  //    still visible rather than vanishing.
  const { data: created, error: createError } = await supabase
    .from("execution_roadmaps")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      business_plan_id: businessPlanId,
      title: planTitle,
      workflow: workflow.id,
      prompt_version: workflow.promptVersion,
      model: resolveModelId(
        workflow.provider ?? getDefaultProviderId(),
        workflow.model,
      ),
    })
    .select()
    .single();

  if (createError || !created) {
    // Outside the try/catch below, so it needs its own release: a failed
    // INSERT must not silently cost the customer a roadmap.
    await releaseEntitlement(reservationKey);
    throw new AiError(
      "AI_PROVIDER_ERROR",
      `Could not create the execution roadmap: ${createError?.message ?? "unknown error"}`,
    );
  }

  try {
    // 2. All AI goes through the platform — never a direct provider call. The
    //    Workflow Manager validates the response against
    //    `executionRoadmapSchema` before it returns, so nothing unvalidated can
    //    reach the inserts below.
    const { data, metadata, requestId } =
      await runWorkflow<ExecutionRoadmapDocument>({
        workflowId: EXECUTION_ROADMAP_WORKFLOW,
        userId,
        workspaceId,
        input,
      });

    // 3. Explode the tasks. They are the only part the customer mutates, so
    //    they get rows; the summary, priorities and milestones stay in the
    //    document as generated.
    const taskRows = roadmapPeriodBlocks(data).flatMap(({ period, block }) =>
      block.tasks.map((task, index) => ({
        roadmap_id: created.id,
        workspace_id: workspaceId,
        period,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        // status and due_date take their column defaults: NOT_STARTED and null.
        // The model is forbidden from inventing dates, so there is nothing to
        // write here.
        sort_order: index,
      })),
    );

    const { data: tasks, error: taskError } = await supabase
      .from("execution_roadmap_tasks")
      .insert(taskRows)
      .select();

    if (taskError || !tasks) {
      throw new AiError(
        "AI_PROVIDER_ERROR",
        `Could not save the roadmap tasks: ${taskError?.message ?? "unknown error"}`,
      );
    }

    const { data: roadmap, error: finaliseError } = await supabase
      .from("execution_roadmaps")
      .update({
        summary: data.summary,
        document: data as unknown as Record<string, unknown>,
        model: metadata.model,
        ai_request_id: requestId,
      })
      .eq("id", created.id)
      .select()
      .single();

    if (finaliseError || !roadmap) {
      throw new AiError(
        "AI_PROVIDER_ERROR",
        `Could not finalise the execution roadmap: ${finaliseError?.message ?? "unknown error"}`,
      );
    }

    return { roadmap, tasks, document: data };
  } catch (error) {
    // The roadmap row is meaningless without its tasks, and there is no
    // "failed" state worth showing a customer for something they can simply
    // run again. Remove it, then give the allowance back — matching the
    // success-only policy the usage counter already implements.
    await supabase.from("execution_roadmaps").delete().eq("id", created.id);
    await releaseEntitlement(reservationKey);
    throw error;
  }
}
