import "server-only";

import { AiError } from "@/features/ai/engine/errors";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { BUSINESS_VALIDATOR_WORKFLOW } from "@/features/ai/registry/workflows";
import type { BusinessValidatorReport } from "@/features/ai/schemas/business-validator";
import { createClient } from "@/lib/supabase/server";
import type { BusinessIdeaInput } from "@/lib/validations/business-idea";
import type { BusinessIdea, ValidationReport } from "@/types/database";
import {
  consumeEntitlement,
  releaseEntitlement,
  validationIdempotencyKey,
} from "@/features/commerce/enforcement";
import { EntitlementError } from "@/features/commerce/errors";
import {
  onValidationCompleted,
  onValidationFailed,
  onValidationStarted,
} from "@/features/onboarding/validation-events";

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

/**
 * A stable fingerprint for one validation attempt.
 *
 * Derived from the submitted content, so pressing submit twice on the same idea
 * is one attempt against the allowance while a genuinely different idea is a
 * new one. Server-side only: a client-supplied key would let a caller defeat
 * the collision by sending a fresh value each time.
 */
function fingerprintInput(userId: string, input: BusinessIdeaInput): string {
  const basis = `${userId}:${input.businessName}:${input.ideaDescription}`;
  // A short, stable, non-cryptographic digest. This identifies a retry; it
  // guards nothing, so a hash function is not required here.
  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = (hash * 31 + basis.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export async function validateBusinessIdea(
  userId: string,
  workspaceId: string,
  input: BusinessIdeaInput,
): Promise<ValidationOutcome> {
  const supabase = await createClient();
  const projectId = input.projectId ? input.projectId : null;

  // ---------------------------------------------------------------------
  // Entitlement, BEFORE anything expensive.
  //
  // Reserved atomically rather than counted: `entitlement_consume` locks the
  // workspace's counter row, compares it to the CURRENT configured limit and
  // increments in one statement, so two simultaneous validations cannot both
  // pass with one unit remaining. Nothing is sent to a provider until this
  // returns allowed, which is what makes a denial cost zero AI spend.
  //
  // The limit itself is never cached here — a SUPER_ADMIN raising it takes
  // effect on the very next request.
  //
  // The key is derived from the workspace and the submission, so a retry of
  // the same idea collides with its first attempt instead of consuming a
  // second unit of the customer's monthly allowance.
  // ---------------------------------------------------------------------
  const reservationKey = validationIdempotencyKey(
    workspaceId,
    fingerprintInput(userId, input),
  );

  const entitlement = await consumeEntitlement(
    workspaceId,
    "business_idea_validation",
    reservationKey,
  );

  if (!entitlement.allowed) {
    throw new EntitlementError(entitlement);
  }

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
    // The allowance was reserved a moment ago and the run is not going to
    // happen. Release before throwing, or a failed INSERT silently costs the
    // customer a validation. This path sits outside the try/catch below, so it
    // needs its own release.
    await releaseEntitlement(reservationKey);
    throw new AiError(
      "AI_PROVIDER_ERROR",
      `Could not save the business idea: ${ideaError?.message ?? "unknown error"}`,
    );
  }

  // The idea row is committed, so the run has genuinely started. Raised as an
  // event rather than an email call — §9 — and deliberately not awaited: the
  // caller is waiting on a validation, not on a notification.
  void onValidationStarted(workspaceId, {
    ideaTitle: idea.title,
    industry: input.industry ?? null,
  });

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

    // The report is durably stored before anything is sent, so a provider
    // outage costs a notification and never the report.
    void onValidationCompleted(workspaceId, {
      ideaTitle: idea.title,
      industry: input.industry ?? null,
      score: data.overallScore,
      reportId: report.id,
    });

    return { idea, report, data };
  } catch (error) {
    await supabase
      .from("business_ideas")
      .update({ status: "failed" })
      .eq("id", idea.id)
      .eq("user_id", userId);

    // The run the allowance was reserved for did not happen, so give it back.
    // Matches the policy `countWorkflowRuns` already implements by counting
    // successes only: a customer does not spend allowance on a report they
    // never received. Releasing marks the ledger row rather than deleting it,
    // so the attempt stays visible.
    await releaseEntitlement(reservationKey);

    void onValidationFailed(workspaceId, {
      ideaTitle: idea.title,
      industry: input.industry ?? null,
    });

    throw error;
  }
}
