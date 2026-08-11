import "server-only";

import { AiError } from "@/features/ai/engine/errors";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { getDefaultProviderId, resolveModelId } from "@/features/ai/providers";
import {
  BUSINESS_PLAN_WORKFLOW,
  getWorkflow,
} from "@/features/ai/registry/workflows";
import type { BusinessPlanDocument } from "@/features/ai/schemas/business-plan";
import { toPlanSectionContents } from "@/features/business-plans/sections";
import { createClient } from "@/lib/supabase/server";
import type { BusinessPlanInput } from "@/lib/validations/business-plan";
import type { BusinessPlan, BusinessPlanSection } from "@/types/database";

/**
 * Business Plan service — turns a validated brief into a persisted, editable,
 * versioned plan.
 *
 * Like the validator, this is a thin *consumer* of the AI Platform: execution,
 * prompt loading, response validation, retries, history and usage tracking all
 * happen in the Workflow Manager. What lives here is the domain persistence the
 * platform knows nothing about — the plan, its eleven sections, and the first
 * revision of each.
 */

export interface PlanGenerationOutcome {
  plan: BusinessPlan;
  sections: BusinessPlanSection[];
  document: BusinessPlanDocument;
}

export interface GeneratePlanOptions {
  userId: string;
  workspaceId: string;
  input: BusinessPlanInput;
}

export async function generateBusinessPlan({
  userId,
  workspaceId,
  input,
}: GeneratePlanOptions): Promise<PlanGenerationOutcome> {
  const supabase = await createClient();
  const workflow = getWorkflow(BUSINESS_PLAN_WORKFLOW);
  const projectId = input.projectId ? input.projectId : null;
  const businessIdeaId = input.businessIdeaId ? input.businessIdeaId : null;

  // 1. Record the attempt before spending a model call, so a plan that fails
  //    mid-generation is still visible and explicable to the user. The prompt
  //    version and model come from the registry, which knows both without
  //    running anything; the model is corrected afterwards because a provider
  //    may answer with a dated id.
  const { data: created, error: createError } = await supabase
    .from("business_plans")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      project_id: projectId,
      business_idea_id: businessIdeaId,
      title: input.businessName,
      status: "generating",
      input_json: input as unknown as Record<string, unknown>,
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
    throw new AiError(
      "AI_PROVIDER_ERROR",
      `Could not create the business plan: ${createError?.message ?? "unknown error"}`,
    );
  }

  try {
    // 2. All AI goes through the platform — never a direct provider call.
    const { data, metadata, requestId } =
      await runWorkflow<BusinessPlanDocument>({
        workflowId: BUSINESS_PLAN_WORKFLOW,
        userId,
        workspaceId,
        projectId,
        input,
      });

    // 3. Persist the eleven sections in catalog order.
    const { data: sections, error: sectionError } = await supabase
      .from("business_plan_sections")
      .insert(
        toPlanSectionContents(data.sections).map((section) => ({
          ...section,
          plan_id: created.id,
          workspace_id: workspaceId,
          current_version: 1,
          source: "ai" as const,
        })),
      )
      .select();

    if (sectionError || !sections) {
      throw new AiError(
        "AI_PROVIDER_ERROR",
        `Could not save the plan sections: ${sectionError?.message ?? "unknown error"}`,
      );
    }

    // 4. Seed revision history: the generated text is version 1 of each
    //    section, so "restore the original" works from the very first edit.
    const { error: versionError } = await supabase
      .from("business_plan_versions")
      .insert(
        sections.map((section) => ({
          section_id: section.id,
          plan_id: created.id,
          workspace_id: workspaceId,
          section_key: section.section_key,
          version: 1,
          content: section.content,
          source: "ai" as const,
          edited_by: userId,
        })),
      );

    if (versionError) {
      throw new AiError(
        "AI_PROVIDER_ERROR",
        `Could not save the plan history: ${versionError.message}`,
      );
    }

    const executiveSummary = data.sections.executiveSummary;

    const { data: plan, error: finaliseError } = await supabase
      .from("business_plans")
      .update({
        title: data.title,
        summary: executiveSummary,
        status: "ready",
        model: metadata.model,
        ai_request_id: requestId,
      })
      .eq("id", created.id)
      .select()
      .single();

    if (finaliseError || !plan) {
      throw new AiError(
        "AI_PROVIDER_ERROR",
        `Could not finalise the business plan: ${finaliseError?.message ?? "unknown error"}`,
      );
    }

    return {
      plan,
      sections: sections.sort((a, b) => a.position - b.position),
      document: data,
    };
  } catch (error) {
    await supabase
      .from("business_plans")
      .update({ status: "failed" })
      .eq("id", created.id);
    throw error;
  }
}
