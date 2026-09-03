import { z } from "zod";

/**
 * JSON contract for the `execution-roadmap` workflow (Phase 15).
 *
 * The Workflow Manager validates every model response against this before
 * anything is persisted, so a malformed roadmap is retried rather than written.
 *
 * ---------------------------------------------------------------------------
 * What this schema deliberately cannot express
 * ---------------------------------------------------------------------------
 * There is no field for a customer count, a revenue figure, a funding amount,
 * a headcount, a partner name or a legal approval. That is the anti-fabrication
 * rule (§12) expressed in the type system rather than only in the prompt: a
 * model that tries to assert "3 paying customers secured" has nowhere to put
 * it, so the claim cannot reach the database through this path.
 *
 * Unknowns are meant to become work. A roadmap that does not know the market
 * size should contain a task to find it out, which is why every task is just a
 * title, a description and a classification.
 *
 * ---------------------------------------------------------------------------
 * No due dates from the model
 * ---------------------------------------------------------------------------
 * `dueDate` is absent on purpose. A model asked for a date invents one, and an
 * invented deadline looks exactly like a real one. The period (30/60/90) is the
 * commitment the roadmap actually makes; a specific date is the customer's to
 * set afterwards, and the column is nullable for that reason.
 */

/** The three horizons. Stored on each task so a task can be moved between them. */
export const ROADMAP_PERIODS = ["30", "60", "90"] as const;
export type RoadmapPeriod = (typeof ROADMAP_PERIODS)[number];

/**
 * Categories a business plan can actually speak to. §6 says not to force
 * categories that do not apply, so `GENERAL` exists as the honest fallback
 * rather than making the model pick a department at random.
 */
export const TASK_CATEGORIES = [
  "MARKETING",
  "SALES",
  "OPERATIONS",
  "PRODUCT",
  "TECHNOLOGY",
  "FINANCE",
  "LEGAL",
  "CUSTOMER_DEVELOPMENT",
  "GENERAL",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Execution status. A new, separate vocabulary from `execution_actions.status`
 * (DRAFT/READY/AWAITING_APPROVAL/APPROVED/EXECUTING/COMPLETED/FAILED/CANCELLED)
 * because that enum describes a machine dispatching work through a provider,
 * and this one describes a person doing it. Reusing it would have meant a task
 * could enter `AWAITING_APPROVAL` or `EXECUTING`, which mean nothing here.
 */
export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const nonEmpty = z.string().trim().min(1);

export const roadmapTaskSchema = z.object({
  /** Imperative and specific: "Interview 10 dental clinics", not "do research". */
  title: nonEmpty.max(200),
  /** What doing it actually involves, and how you know it is done. */
  description: nonEmpty.max(1000),
  category: z.enum(TASK_CATEGORIES),
  priority: z.enum(TASK_PRIORITIES),
});

export const roadmapMilestoneSchema = z.object({
  title: nonEmpty.max(200),
  description: nonEmpty.max(1000),
});

const periodSchema = z.object({
  /** The one or two things this horizon is really about. */
  priorities: z.array(nonEmpty.max(300)).min(1).max(5),
  milestones: z.array(roadmapMilestoneSchema).min(1).max(5),
  tasks: z.array(roadmapTaskSchema).min(2).max(10),
});

export const executionRoadmapSchema = z.object({
  /** Two or three sentences on the shape of the next 90 days. */
  summary: nonEmpty.max(1500),
  days_30: periodSchema,
  days_60: periodSchema,
  days_90: periodSchema,
});

export type ExecutionRoadmapDocument = z.infer<typeof executionRoadmapSchema>;
export type RoadmapPeriodBlock = z.infer<typeof periodSchema>;

/** The three blocks in reading order, so callers never re-derive the mapping. */
export function roadmapPeriodBlocks(
  document: ExecutionRoadmapDocument,
): { period: RoadmapPeriod; block: RoadmapPeriodBlock }[] {
  return [
    { period: "30", block: document.days_30 },
    { period: "60", block: document.days_60 },
    { period: "90", block: document.days_90 },
  ];
}
