import "server-only";

import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";
import {
  getBusinessPlan,
  getBusinessPlans,
} from "@/features/business-plans/data";
import { getRoadmapDetailForPlan } from "@/features/roadmaps/data";
import { getReports } from "@/features/reports/data";
import { businessPlanInputSchema } from "@/lib/validations/business-plan";

/**
 * Business context for the AI Business Advisor (Phase 16).
 *
 * ---------------------------------------------------------------------------
 * Why this is a server module and takes a workspace it did not receive
 * ---------------------------------------------------------------------------
 * Every id used here is resolved from the caller's session and workspace by the
 * action that calls it. Nothing in this file accepts a business plan id, report
 * id or roadmap id from a request. That is the §16 rule made structural: there
 * is no parameter through which a browser could point the advisor at another
 * customer's business, so the advisor cannot be made to read one.
 *
 * Every underlying reader is already workspace- or user-scoped and runs under
 * RLS, so a workspace the caller does not belong to yields empty context rather
 * than someone else's.
 *
 * ---------------------------------------------------------------------------
 * Compact on purpose
 * ---------------------------------------------------------------------------
 * §7 and §19: the model gets a structured summary, never the raw documents. A
 * business plan is eleven prose sections and a validation report is a full
 * scored analysis; sending either whole would cost tokens on every question and
 * bury the parts that matter. What is sent is bounded by construction — fixed
 * list caps and per-field truncation — so context size does not grow with the
 * size of the customer's account.
 *
 * ---------------------------------------------------------------------------
 * Availability is explicit
 * ---------------------------------------------------------------------------
 * §26: a customer with a validated idea but no roadmap must still get useful
 * advice. Each section is independently nullable and `availability` states
 * plainly what exists, so the prompt can tell the model what it does and does
 * not know rather than leaving it to infer from silence — which is how models
 * end up inventing the missing half.
 */

const MAX_LIST = 5;
const MAX_TASKS = 8;

function clip(
  text: string | null | undefined,
  max: number,
): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length === 0 ? undefined : clean.slice(0, max);
}

function take<T>(items: T[] | undefined, count = MAX_LIST): T[] {
  return (items ?? []).slice(0, count);
}

export interface AdvisorBusiness {
  name: string;
  description?: string;
  industry?: string;
  country?: string;
  target_customer?: string;
  business_model?: string;
  current_stage?: string;
}

export interface AdvisorValidation {
  score: number;
  recommendation: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  recommendations: string[];
  /** The lowest-scoring dimension — usually the honest answer to "what is weakest?". */
  weakest_area?: string;
}

export interface AdvisorPlan {
  title: string;
  executive_summary?: string;
  marketing?: string;
  operations?: string;
}

export interface AdvisorExecution {
  progress_percent: number;
  total_tasks: number;
  completed_tasks: number;
  active_tasks: { title: string; period: string; priority: string }[];
  blocked_tasks: { title: string; period: string }[];
  recently_completed: string[];
}

export interface AdvisorAvailability {
  validation: boolean;
  business_plan: boolean;
  roadmap: boolean;
}

export interface AdvisorContext {
  business: AdvisorBusiness | null;
  validation: AdvisorValidation | null;
  plan: AdvisorPlan | null;
  execution: AdvisorExecution | null;
  availability: AdvisorAvailability;
  /** Ids the UI needs for follow-on actions. Never used for authorization. */
  businessPlanId: string | null;
  roadmapId: string | null;
}

/** True when there is enough to give advice that is actually about this business. */
export function hasUsableContext(context: AdvisorContext): boolean {
  return context.availability.validation || context.availability.business_plan;
}

/**
 * Assemble the advisor's view of one workspace.
 *
 * The reads run in parallel (§31): the plan list, the validation reports and —
 * once the newest plan is known — that plan's sections and roadmap. Sequential
 * queries here would show up directly as latency on every question asked.
 */
export async function getBusinessAdvisorContext(
  userId: string,
  workspaceId: string,
): Promise<AdvisorContext> {
  const [plans, reports] = await Promise.all([
    getBusinessPlans(workspaceId),
    getReports(userId),
  ]);

  const latestPlan = plans[0] ?? null;

  const [planDetail, roadmapDetail] = await Promise.all([
    latestPlan
      ? getBusinessPlan(workspaceId, latestPlan.id)
      : Promise.resolve(null),
    latestPlan
      ? getRoadmapDetailForPlan(workspaceId, latestPlan.id)
      : Promise.resolve(null),
  ]);

  // --- Business identity ---------------------------------------------------
  // Taken from the brief the customer wrote, not from generated prose: these
  // are facts they stated about their own business.
  const briefParse = latestPlan
    ? businessPlanInputSchema.partial().safeParse(latestPlan.input_json ?? {})
    : null;
  const brief = briefParse?.success ? briefParse.data : {};

  const business: AdvisorBusiness | null = latestPlan
    ? {
        name: brief.businessName ?? latestPlan.title,
        description: clip(brief.ideaDescription, 600),
        industry: brief.industry,
        country: brief.country,
        target_customer: clip(brief.targetAudience, 300),
        business_model: brief.businessModel,
        current_stage: brief.currentStage,
      }
    : null;

  // --- Validation ----------------------------------------------------------
  // The newest readable report. Re-parsed rather than trusted, because a report
  // written by an older prompt version must degrade to "no validation context"
  // rather than throwing inside the advisor.
  let validation: AdvisorValidation | null = null;
  for (const report of reports) {
    const parsed = businessValidatorReportSchema.safeParse(report.report_json);
    if (!parsed.success) continue;

    const data = parsed.data;
    const breakdown = Object.entries(data.scoreBreakdown) as [string, number][];
    const weakest = breakdown.sort((a, b) => a[1] - b[1])[0];

    validation = {
      score: data.overallScore,
      recommendation: data.recommendation,
      strengths: take(data.swot.strengths),
      weaknesses: take(data.swot.weaknesses),
      risks: take(data.risks.map((r) => `${r.title}: ${r.description}`)),
      recommendations: take(
        data.recommendations.map((r) => `${r.title}: ${r.description}`),
      ),
      weakest_area: weakest ? `${weakest[0]} (${weakest[1]}/100)` : undefined,
    };
    break;
  }

  // --- Plan ----------------------------------------------------------------
  const sectionText = (key: string, max: number) =>
    clip(planDetail?.sections.find((s) => s.section_key === key)?.content, max);

  const plan: AdvisorPlan | null = latestPlan
    ? {
        title: latestPlan.title,
        executive_summary: sectionText("executive-summary", 1_200),
        marketing: sectionText("marketing", 900),
        operations: sectionText("operations", 900),
      }
    : null;

  // --- Execution -----------------------------------------------------------
  // The status quo leads the context (§6): "what is happening now" is the thing
  // advice most often has to be consistent with.
  const execution: AdvisorExecution | null = roadmapDetail
    ? {
        progress_percent: roadmapDetail.progress.percent,
        total_tasks: roadmapDetail.progress.total,
        completed_tasks: roadmapDetail.progress.completed,
        active_tasks: roadmapDetail.tasks
          .filter(
            (t) => t.status === "NOT_STARTED" || t.status === "IN_PROGRESS",
          )
          .slice(0, MAX_TASKS)
          .map((t) => ({
            title: t.title,
            period: `${t.period} days`,
            priority: t.priority,
          })),
        blocked_tasks: roadmapDetail.tasks
          .filter((t) => t.status === "BLOCKED")
          .slice(0, MAX_LIST)
          .map((t) => ({ title: t.title, period: `${t.period} days` })),
        recently_completed: roadmapDetail.tasks
          .filter((t) => t.status === "COMPLETED")
          .slice(0, MAX_LIST)
          .map((t) => t.title),
      }
    : null;

  return {
    business,
    validation,
    plan,
    execution,
    availability: {
      validation: validation !== null,
      business_plan: plan !== null,
      roadmap: execution !== null,
    },
    businessPlanId: latestPlan?.id ?? null,
    roadmapId: roadmapDetail?.roadmap.id ?? null,
  };
}

/**
 * Suggested questions, derived from what is actually true of this account (§24).
 *
 * A fixed list would ask a customer with no roadmap which task to do first.
 * These are ordered so the most situationally useful prompt comes first.
 */
export function suggestedQuestions(context: AdvisorContext): string[] {
  const out: string[] = [];

  if (context.execution && context.execution.blocked_tasks.length > 0) {
    out.push("How should I handle my blocked tasks?");
  }
  if (context.execution && context.execution.total_tasks > 0) {
    out.push("Which task should I complete first?");
    if (context.execution.progress_percent < 30) {
      out.push("How can I get my execution back on track?");
    }
  }
  if (context.validation && context.validation.score < 70) {
    out.push("How can I address the biggest risk in my validation?");
  }
  if (context.availability.business_plan) {
    out.push("What is the biggest weakness in my business plan?");
  }

  out.push("What should I focus on this week?");
  out.push("How can I get my first 10 customers?");

  // De-duplicate while preserving order, then cap: a wall of suggestions is
  // harder to act on than four.
  return [...new Set(out)].slice(0, 5);
}
