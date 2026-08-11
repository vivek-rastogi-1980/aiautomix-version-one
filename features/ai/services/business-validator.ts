import "server-only";

import { AiError } from "@/features/ai/engine/errors";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { BUSINESS_VALIDATOR_WORKFLOW } from "@/features/ai/registry/workflows";
import type { BusinessValidatorReport } from "@/features/ai/schemas/business-validator";
import { createClient } from "@/lib/supabase/server";
import type { BusinessIdeaInput } from "@/lib/validations/business-idea";
import type { BusinessIdea, ValidationReport } from "@/types/database";

/**
 * Business Validator service — the one place that turns a validated idea into a
 * persisted report. Shared by the Server Action and the REST endpoint so the
 * flow is never duplicated (CODING-STANDARDS: no duplicated business logic).
 *
 * Since Sprint 4 this is a thin *consumer* of the AI Platform: execution,
 * prompt loading, response validation, retries, history and usage tracking all
 * live in the Workflow Manager. What remains here is domain persistence — the
 * `business_ideas` and `validation_reports` rows that belong to this product
 * rather than to the platform.
 */

export interface ValidationOutcome {
  idea: BusinessIdea;
  report: ValidationReport;
  data: BusinessValidatorReport;
}

export async function validateBusinessIdea(
  userId: string,
  workspaceId: string,
  input: BusinessIdeaInput,
): Promise<ValidationOutcome> {
  const supabase = await createClient();
  const projectId = input.projectId ? input.projectId : null;

  // 1. Persist the submission first so a failed run is still auditable.
  const { data: idea, error: ideaError } = await supabase
    .from("business_ideas")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      project_id: projectId,
      title: input.businessName,
      payload_json: input as unknown as Record<string, unknown>,
      status: "processing",
    })
    .select()
    .single();

  if (ideaError || !idea) {
    throw new AiError(
      "AI_PROVIDER_ERROR",
      `Could not save the business idea: ${ideaError?.message ?? "unknown error"}`,
    );
  }

  try {
    // 2. All AI goes through the platform — never a direct provider call. The
    //    Workflow Manager re-validates `input` against the workflow's schema;
    //    callers still parse first so the form can show field-level errors.
    const { data, metadata, requestId } =
      await runWorkflow<BusinessValidatorReport>({
        workflowId: BUSINESS_VALIDATOR_WORKFLOW,
        userId,
        workspaceId,
        projectId,
        input,
      });

    // 3. Persist the validated report with its provenance, linked to the
    //    platform run so AI History can reopen it.
    const { data: report, error: reportError } = await supabase
      .from("validation_reports")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        business_idea_id: idea.id,
        score: data.overallScore,
        report_json: data as unknown as Record<string, unknown>,
        workflow: metadata.workflow,
        prompt_version: metadata.promptVersion,
        model: metadata.model,
        duration_ms: metadata.durationMs,
        tokens_used: metadata.tokens,
        ai_request_id: requestId,
      })
      .select()
      .single();

    if (reportError || !report) {
      throw new AiError(
        "AI_PROVIDER_ERROR",
        `Could not save the report: ${reportError?.message ?? "unknown error"}`,
      );
    }

    await supabase
      .from("business_ideas")
      .update({ status: "completed" })
      .eq("id", idea.id)
      .eq("user_id", userId);

    return { idea, report, data };
  } catch (error) {
    await supabase
      .from("business_ideas")
      .update({ status: "failed" })
      .eq("id", idea.id)
      .eq("user_id", userId);
    throw error;
  }
}
