/**
 * Live verification of the Business Validator against the real provider.
 *
 * Runs the same `runWorkflow` entry point the service uses and checks the
 * output against the workflow's own Zod contract, so a failure here is the
 * failure a customer sees after pressing "Validate".
 *
 * NOT part of `npm test`: it spends money and needs network.
 *   npm run verify:validator
 */

import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";
import type { BusinessValidatorReport } from "@/features/ai/schemas/business-validator";
import { isProviderConfigured } from "@/features/ai/providers";
import { BUSINESS_VALIDATOR_WORKFLOW } from "@/features/ai/registry/workflows";

const USER = "00000000-0000-0000-0000-000000000001";

async function main(): Promise<void> {
  if (!isProviderConfigured("openai")) {
    console.log("SKIP: OPENAI_API_KEY not set.");
    return;
  }

  const input = {
    businessName: "GlutenFree Box",
    ideaDescription:
      "A subscription meal kit service delivering certified gluten-free recipe boxes to households managing coeliac disease across the United Kingdom.",
    industry: "Food and beverage",
    country: "United Kingdom",
    targetAudience: "Adults diagnosed with coeliac disease",
    businessModel: "subscription",
    estimatedBudget: "50000",
    currentStage: "idea",
    timeline: "",
    competitors: "",
    additionalNotes: "",
    projectId: "",
  };

  console.log("running business-validator against the live provider...");
  const started = Date.now();

  try {
    const { data, metadata } = await runWorkflow<BusinessValidatorReport>({
      workflowId: BUSINESS_VALIDATOR_WORKFLOW,
      userId: USER,
      input,
    });

    console.log(`model=${metadata.model} durationMs=${Date.now() - started}`);

    const parsed = businessValidatorReportSchema.safeParse(data);
    console.log(`${parsed.success ? "PASS" : "FAIL"} output validates`);
    if (!parsed.success) {
      console.log(JSON.stringify(parsed.error.issues.slice(0, 10), null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(
      `score=${parsed.data.overallScore} recommendation=${parsed.data.recommendation}`,
    );
  } catch (error) {
    console.log("THREW:", error instanceof Error ? error.message : error);
    if (error && typeof error === "object" && "code" in error) {
      console.log("code:", (error as { code: unknown }).code);
    }
    if (error instanceof Error && error.cause) console.log("cause:", error.cause);
    process.exitCode = 1;
  }
}

void main();
