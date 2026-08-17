import { z } from "zod";

import {
  approvalRequiredFor,
  type ActionType,
  type EffortLevel,
  type SideEffect,
} from "@/features/execution/types";

/**
 * The action registry.
 *
 * One entry per action type, describing what it needs, what it produces, what
 * it does to the world, who carries it out and how hard it may try. Adding a
 * capability to AIAutoMix means adding an entry here — not adding a branch to
 * the execution service, which stays entirely type-agnostic.
 *
 * ---------------------------------------------------------------------------
 * Everything is typed
 * ---------------------------------------------------------------------------
 * `input` and `output` are Zod schemas, never `any` and never a bare
 * `Record<string, unknown>`. That is what makes the execution preview (§26)
 * possible: to show a user exactly what will be sent, the system has to know
 * what the payload IS. An untyped blob can be rendered but not explained, and
 * an approval screen you cannot read is a rubber stamp.
 *
 * ---------------------------------------------------------------------------
 * Nothing here executes
 * ---------------------------------------------------------------------------
 * Phase 10.1 ships the registry and the mock provider. No entry below performs
 * a real publish, send or purchase, and the N8N adapter refuses to run until it
 * is configured. The registry is the seam those integrations will slot into.
 */

// ---------------------------------------------------------------------------
// Shared field shapes
// ---------------------------------------------------------------------------

const title = z.string().trim().min(1).max(300);
const body = z.string().trim().min(1).max(20_000);
const shortText = z.string().trim().min(1).max(2000);

/**
 * A destination the user owns.
 *
 * Held as a label plus an opaque reference, never as a credential. §13 and §28
 * both forbid provider credentials reaching a client, and the simplest way to
 * guarantee that is for the domain model to have nowhere to put one.
 */
const destination = z.object({
  label: z.string().trim().min(1).max(200),
  /** An account/page/site identifier the provider understands. Never a token. */
  reference: z.string().trim().max(300).optional(),
});

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  /** Total attempts allowed, including the first. Server-owned. §17. */
  maxAttempts: number;
  /** Base delay for the caller to honour when it schedules a retry. */
  backoffMs: number;
}

/** The default. Three attempts is enough for a blip and few enough to notice. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: 2000,
};

/**
 * For actions whose duplicate is expensive or embarrassing.
 *
 * A retried email send that half-succeeded is a customer receiving two emails.
 * One attempt means a human looks at it instead.
 */
export const CAUTIOUS_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 1,
  backoffMs: 0,
};

/** The hard ceiling. No registry entry and no caller may exceed this. §17. */
export const MAX_ATTEMPTS_CEILING = 5;

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export interface ActionDefinition<TInput = unknown, TOutput = unknown> {
  actionType: ActionType;
  displayName: string;
  description: string;
  /** What this does to the world. Approval is derived from it, not set here. */
  sideEffect: SideEffect;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  /** Which provider carries it out once integrations exist. */
  provider: string;
  /** Named so the approval screen can say which integration is needed. */
  requiredIntegration: string;
  retryPolicy: RetryPolicy;
  effort: EffortLevel;
  /**
   * One sentence, shown on the approval screen, describing what actually
   * happens in the world if this is approved. §25 forbids hiding consequences,
   * and a consequence written per action type is one nobody has to infer.
   */
  consequence: string;
}

export type AnyActionDefinition = ActionDefinition<unknown, unknown>;

/** Approval requirement, derived rather than declared. See `types.ts`. */
export function requiresApproval(definition: AnyActionDefinition): boolean {
  return approvalRequiredFor(definition.sideEffect);
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

const landingPage = {
  actionType: "CREATE_LANDING_PAGE",
  displayName: "Create landing page",
  description:
    "Publishes a landing page for a campaign or offer on the workspace's website.",
  sideEffect: "PUBLIC_VISIBLE",
  inputSchema: z.object({
    pageTitle: title,
    slug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "A slug is lower-case words joined by hyphens.",
      )
      .max(120),
    headline: title,
    subheadline: shortText.optional(),
    bodyCopy: body,
    callToAction: z.string().trim().min(1).max(120),
    destination,
  }),
  outputSchema: z.object({
    url: z.string().url(),
    externalId: z.string().max(300),
    publishedAt: z.string(),
  }),
  provider: "n8n",
  requiredIntegration: "Website (WordPress or equivalent) via N8N",
  retryPolicy: DEFAULT_RETRY_POLICY,
  effort: "MEDIUM",
  consequence:
    "A new page becomes publicly reachable at the slug you chose, and search engines may index it.",
} satisfies AnyActionDefinition;

const generateContent = {
  actionType: "GENERATE_CONTENT",
  displayName: "Generate content draft",
  description:
    "Writes a draft and stores it in this workspace. Nothing is published.",
  // The ONLY internal-draft action, and therefore the only one that can run
  // without a human approving it.
  sideEffect: "INTERNAL_DRAFT",
  inputSchema: z.object({
    brief: body,
    format: z.enum(["blog", "social", "email", "landing_copy", "ad"]),
    tone: z.string().trim().max(120).optional(),
    wordCount: z.number().int().min(50).max(5000).optional(),
  }),
  outputSchema: z.object({
    draft: z.string(),
    wordCount: z.number().int(),
  }),
  provider: "mock",
  requiredIntegration: "None — stays inside AIAutoMix",
  retryPolicy: DEFAULT_RETRY_POLICY,
  effort: "LOW",
  consequence:
    "A draft is saved in this workspace. Nobody outside sees it and nothing is sent.",
} satisfies AnyActionDefinition;

const socialPost = {
  actionType: "CREATE_SOCIAL_POST",
  displayName: "Publish social post",
  description: "Publishes a post to a connected social account.",
  sideEffect: "PUBLIC_VISIBLE",
  inputSchema: z.object({
    network: z.enum(["linkedin", "facebook", "instagram", "x", "youtube"]),
    content: z.string().trim().min(1).max(5000),
    scheduledFor: z.string().optional(),
    destination,
  }),
  outputSchema: z.object({
    postUrl: z.string().url(),
    externalId: z.string().max(300),
    publishedAt: z.string(),
  }),
  provider: "n8n",
  requiredIntegration: "Social account via N8N",
  retryPolicy: CAUTIOUS_RETRY_POLICY,
  effort: "LOW",
  consequence:
    "The post appears on the named account where anyone can see it. Deleting it later does not un-send notifications.",
} satisfies AnyActionDefinition;

const blogPost = {
  actionType: "CREATE_BLOG_POST",
  displayName: "Publish blog post",
  description: "Publishes an article to the workspace's blog.",
  sideEffect: "PUBLIC_VISIBLE",
  inputSchema: z.object({
    postTitle: title,
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    content: body,
    excerpt: shortText.optional(),
    tags: z.array(z.string().trim().max(60)).max(10).default([]),
    destination,
  }),
  outputSchema: z.object({
    url: z.string().url(),
    externalId: z.string().max(300),
    publishedAt: z.string(),
  }),
  provider: "n8n",
  requiredIntegration: "Blog (WordPress or equivalent) via N8N",
  retryPolicy: DEFAULT_RETRY_POLICY,
  effort: "MEDIUM",
  consequence:
    "The article goes live on your blog and may be picked up by feeds and search engines.",
} satisfies AnyActionDefinition;

const leadForm = {
  actionType: "CREATE_LEAD_FORM",
  displayName: "Create lead form",
  description:
    "Publishes a form that collects contact details from the public.",
  sideEffect: "PUBLIC_VISIBLE",
  inputSchema: z.object({
    formName: title,
    fields: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(60),
          label: z.string().trim().min(1).max(120),
          type: z.enum(["text", "email", "tel", "textarea", "select"]),
          required: z.boolean().default(false),
        }),
      )
      .min(1)
      .max(15),
    submitLabel: z.string().trim().max(60).default("Submit"),
    destination,
  }),
  outputSchema: z.object({
    formUrl: z.string().url(),
    externalId: z.string().max(300),
  }),
  provider: "n8n",
  requiredIntegration: "Website or form provider via N8N",
  retryPolicy: DEFAULT_RETRY_POLICY,
  effort: "MEDIUM",
  consequence:
    "A public form starts collecting personal data, which makes you responsible for how that data is stored and used.",
} satisfies AnyActionDefinition;

const crmPipeline = {
  actionType: "CREATE_CRM_PIPELINE",
  displayName: "Create CRM pipeline",
  description: "Creates a pipeline and its stages in the connected CRM.",
  sideEffect: "EXTERNAL_MUTATION",
  inputSchema: z.object({
    pipelineName: title,
    stages: z
      .array(z.object({ name: z.string().trim().min(1).max(120) }))
      .min(2)
      .max(12),
    destination,
  }),
  outputSchema: z.object({
    pipelineId: z.string().max(300),
    stageIds: z.array(z.string().max(300)),
  }),
  provider: "n8n",
  requiredIntegration: "CRM (GoHighLevel or equivalent) via N8N",
  retryPolicy: DEFAULT_RETRY_POLICY,
  effort: "MEDIUM",
  consequence:
    "Your CRM gains a new pipeline. Existing records are not moved, but your team will see the new structure.",
} satisfies AnyActionDefinition;

const emailSequence = {
  actionType: "CREATE_EMAIL_SEQUENCE",
  displayName: "Create email sequence",
  description:
    "Creates a multi-step email sequence in the connected email platform.",
  sideEffect: "EXTERNAL_MUTATION",
  inputSchema: z.object({
    sequenceName: title,
    emails: z
      .array(
        z.object({
          subject: z.string().trim().min(1).max(200),
          content: body,
          delayDays: z.number().int().min(0).max(90),
        }),
      )
      .min(1)
      .max(12),
    destination,
  }),
  outputSchema: z.object({
    sequenceId: z.string().max(300),
    emailIds: z.array(z.string().max(300)),
  }),
  provider: "n8n",
  requiredIntegration: "Email platform via N8N",
  // Creating a sequence is not sending it, but a duplicate sequence that a
  // colleague later activates does send. One attempt.
  retryPolicy: CAUTIOUS_RETRY_POLICY,
  effort: "HIGH",
  consequence:
    "The sequence is created in your email platform. It is not activated here — but once it exists, someone can activate it.",
} satisfies AnyActionDefinition;

const analyticsConfiguration = {
  actionType: "CREATE_ANALYTICS_CONFIGURATION",
  displayName: "Configure analytics",
  description: "Creates goals and events in the connected analytics property.",
  sideEffect: "EXTERNAL_MUTATION",
  inputSchema: z.object({
    propertyName: title,
    goals: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          eventName: z.string().trim().min(1).max(120),
        }),
      )
      .min(1)
      .max(20),
    destination,
  }),
  outputSchema: z.object({
    configurationId: z.string().max(300),
    goalIds: z.array(z.string().max(300)),
  }),
  provider: "n8n",
  requiredIntegration: "Analytics provider via N8N",
  retryPolicy: DEFAULT_RETRY_POLICY,
  effort: "LOW",
  consequence:
    "Your analytics property gains new goals and events. Historical data is not changed.",
} satisfies AnyActionDefinition;

export const ACTION_REGISTRY: Record<ActionType, AnyActionDefinition> = {
  CREATE_LANDING_PAGE: landingPage,
  GENERATE_CONTENT: generateContent,
  CREATE_SOCIAL_POST: socialPost,
  CREATE_BLOG_POST: blogPost,
  CREATE_LEAD_FORM: leadForm,
  CREATE_CRM_PIPELINE: crmPipeline,
  CREATE_EMAIL_SEQUENCE: emailSequence,
  CREATE_ANALYTICS_CONFIGURATION: analyticsConfiguration,
};

export function getActionDefinition(
  actionType: ActionType,
): AnyActionDefinition {
  return ACTION_REGISTRY[actionType];
}

export function findActionDefinition(
  actionType: string,
): AnyActionDefinition | null {
  return (
    (ACTION_REGISTRY as Record<string, AnyActionDefinition>)[actionType] ?? null
  );
}

/**
 * Validate an action's input against its registered schema.
 *
 * Returns the parsed value rather than the raw one, so anything downstream
 * works with a value the schema vouched for. An action whose input does not
 * parse can never reach a provider — the state machine will not let it leave
 * DRAFT, and the service re-validates before dispatch anyway.
 */
export function validateActionInput(
  actionType: ActionType,
  input: unknown,
):
  | { ok: true; value: unknown }
  | { ok: false; issues: { path: string; message: string }[] } {
  const definition = getActionDefinition(actionType);
  const parsed = definition.inputSchema.safeParse(input);

  if (parsed.success) return { ok: true, value: parsed.data };

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/** The attempt budget for a type, clamped to the ceiling. Never client-supplied. */
export function maxAttemptsFor(actionType: ActionType): number {
  return Math.min(
    getActionDefinition(actionType).retryPolicy.maxAttempts,
    MAX_ATTEMPTS_CEILING,
  );
}
