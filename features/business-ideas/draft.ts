import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  BUSINESS_STAGES,
  type BusinessStage,
} from "@/lib/validations/business-idea";

/**
 * The idea a funnel visitor already submitted, shaped for the validator form.
 *
 * ---------------------------------------------------------------------------
 * The gap this closes
 * ---------------------------------------------------------------------------
 * `createIdeaFromLead` writes the visitor's submission into `business_ideas`
 * as a `draft` at activation time, deliberately without running the validator:
 * an AI spend on a redirect would sit outside the entitlement checks the
 * validator's own entry points apply.
 *
 * Nothing then connected that draft to the validator. The dashboard offered
 * "Start AI validation", which linked to an EMPTY form — so the idea the
 * customer had already written out went nowhere, and retyping it produced a
 * second `business_ideas` row while the draft stayed a draft forever. Every
 * idea in the database is in exactly that state. From the customer's side it
 * reads as "I submitted my idea and nothing happened".
 *
 * ---------------------------------------------------------------------------
 * Why this prefills rather than auto-running
 * ---------------------------------------------------------------------------
 * The validator requires three things the funnel form never asks for —
 * country, business model and budget. There is no honest way to invent them,
 * and guessing them would send a fabricated brief to the model and bill the
 * customer's allowance for the result. So the draft fills in everything the
 * visitor actually told us and the form asks only for what is genuinely
 * missing. The spend stays a decision somebody makes, which is the rule the
 * funnel was built around.
 */

export interface IdeaDraft {
  /** The draft row itself, so validating can reuse it instead of forking. */
  id: string;
  businessName: string;
  ideaDescription: string;
  industry: string;
  targetAudience: string;
  currentStage: BusinessStage;
  additionalNotes: string;
}

/**
 * The onboarding form and the validator use different stage vocabularies —
 * five values against six, agreeing on only two of them. Mapped explicitly:
 * an unrecognised value falls back to "idea" rather than being passed through
 * to fail the validator's enum on submit.
 */
const STAGE_FROM_FUNNEL: Record<string, BusinessStage> = {
  idea: "idea",
  prototype: "prototype",
  pre_revenue: "mvp",
  early_revenue: "launched",
  growing: "scaling",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stageFrom(value: unknown): BusinessStage {
  const mapped = STAGE_FROM_FUNNEL[text(value)];
  if (mapped) return mapped;
  // A row written by the validator itself already speaks the right dialect.
  const direct = text(value) as BusinessStage;
  return BUSINESS_STAGES.includes(direct) ? direct : "idea";
}

/**
 * The customer's most recent unvalidated idea, or null.
 *
 * Best-effort by design: this only prefills a form. A failure here must leave
 * the validator perfectly usable, so it returns null rather than throwing.
 */
export async function getIdeaDraft(userId: string): Promise<IdeaDraft | null> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("business_ideas")
      .select("id, title, payload_json, created_at")
      .eq("user_id", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const payload = (data.payload_json ?? {}) as Record<string, unknown>;

    // `description` is what the funnel writes; `ideaDescription` is what the
    // validator writes. Reading both means a draft from either origin fills
    // the form rather than silently arriving blank.
    const description =
      text(payload["description"]) || text(payload["ideaDescription"]);

    if (!description) return null;

    // The funnel captures the buyer as "target customer" and the geography as
    // "target market"; the validator asks for one "target audience". Joining
    // them keeps both facts rather than dropping one on the floor.
    const audience = [
      text(payload["targetCustomer"]) || text(payload["targetAudience"]),
      text(payload["targetMarket"]),
    ]
      .filter(Boolean)
      .join(" — ");

    // The problem statement is real context the model should see, and the
    // validator has no dedicated field for it.
    const problem = text(payload["problemSolved"]);

    return {
      id: data.id,
      businessName: text(payload["businessName"]) || text(data.title),
      ideaDescription: description,
      industry: text(payload["industry"]),
      targetAudience: audience,
      currentStage: stageFrom(payload["businessStage"] ?? payload["currentStage"]),
      additionalNotes: problem ? `Problem being solved: ${problem}` : "",
    };
  } catch (error) {
    console.error("[business-ideas] could not load draft", {
      message: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
