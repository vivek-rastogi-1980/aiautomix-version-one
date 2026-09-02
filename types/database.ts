/**
 * Hand-authored types mirroring the Sprint 2 database schema
 * (`supabase/migrations/0001_sprint2_foundation.sql`).
 *
 * Kept intentionally small and explicit — when the schema grows we can switch
 * to Supabase's generated types, but for two tables this reads better and the
 * feature code imports the `Profile` / `Project` row types directly.
 */

export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;

// NOTE: these Row types are `type` aliases, not interfaces, on purpose —
// `@supabase/supabase-js` requires each table's Row to be assignable to
// `Record<string, unknown>`, and only type aliases get an implicit index
// signature (interfaces do not). Using `interface` here makes the typed client
// silently resolve every table to `never`.
export type Profile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  bio: string | null;
  website: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  /** Migration 0008. Non-null means suspended; restoring sets it back to null. */
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  updated_at: string;
  /**
   * True when the account was provisioned through the funnel and the person
   * has not chosen a password yet (migration 0026). Not a credential: the
   * schema still stores no password, hash or token of any kind.
   */
  password_setup_required: boolean;
};

export type Project = {
  id: string;
  user_id: string;
  /** Sprint 5: the workspace this project belongs to. */
  workspace_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  website: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// --- Sprint 3: AI Business Idea Validator -----------------------------------

export type BusinessIdeaStatus =
  "draft" | "processing" | "completed" | "failed";

export type BusinessIdea = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  project_id: string | null;
  title: string;
  payload_json: Record<string, unknown>;
  status: BusinessIdeaStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ValidationReport = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  business_idea_id: string;
  score: number;
  report_json: Record<string, unknown>;
  pdf_url: string | null;
  workflow: string;
  prompt_version: string;
  model: string;
  duration_ms: number | null;
  tokens_used: number | null;
  /** Sprint 4: the platform run that produced this report. */
  ai_request_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// --- Sprint 4: AI Platform Core ---------------------------------------------

export type AiRunStatus = "success" | "failed";

export type AiRequestLog = {
  id: string;
  user_id: string;
  project_id: string | null;
  workflow: string;
  prompt_version: string;
  provider: string;
  model: string;
  status: AiRunStatus;
  duration_ms: number | null;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  attempts: number;
  input_json: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

export type AiResponseRecord = {
  id: string;
  request_id: string;
  user_id: string;
  workflow: string;
  prompt_version: string;
  model: string;
  output_json: Record<string, unknown>;
  created_at: string;
};

export type AiUsageLog = {
  id: string;
  user_id: string;
  /** Sprint 6.5: the commercial boundary this usage belongs to. */
  workspace_id: string | null;
  project_id: string | null;
  request_id: string | null;
  workflow: string;
  provider: string;
  model: string;
  prompt_version: string;
  status: AiRunStatus;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  /** `numeric` arrives from PostgREST as a string to preserve precision. */
  estimated_cost_usd: string | null;
  created_at: string;
};

export type AiWorkflowRecord = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  provider: string;
  model: string | null;
  active_prompt_version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AiPromptVersionRecord = {
  id: string;
  workflow_slug: string;
  version: string;
  checksum: string | null;
  is_active: boolean;
  created_at: string;
};

// --- Sprint 5: Workspaces + Business Plans ----------------------------------

/** WORKSPACE-ARCHITECTURE.md: Owner, Admin, Member, Viewer. */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  "owner",
  "admin",
  "member",
  "viewer",
] as const;

export type Workspace = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Migration 0008. Suspension is reversible; deletion is avoided entirely. */
  suspended_at: string | null;
  suspended_reason: string | null;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  updated_at: string;
};

export type BusinessPlanStatus = "draft" | "generating" | "ready" | "failed";

export type BusinessPlan = {
  id: string;
  workspace_id: string;
  user_id: string;
  project_id: string | null;
  business_idea_id: string | null;
  /**
   * Migration 0030. The validation report this plan was generated from, or null
   * for a plan created directly. Non-null IS the "created from a validated
   * idea" flag — there is no separate source column to disagree with it.
   */
  validation_report_id: string | null;
  title: string;
  summary: string | null;
  status: BusinessPlanStatus;
  input_json: Record<string, unknown>;
  workflow: string;
  prompt_version: string;
  model: string;
  ai_request_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Whether a section's current content came from the model or a human edit. */
export type PlanContentSource = "ai" | "user";

export type BusinessPlanSection = {
  id: string;
  plan_id: string;
  workspace_id: string;
  section_key: string;
  title: string;
  content: string;
  position: number;
  current_version: number;
  source: PlanContentSource;
  created_at: string;
  updated_at: string;
};

export type BusinessPlanVersion = {
  id: string;
  section_id: string;
  plan_id: string;
  workspace_id: string;
  section_key: string;
  version: number;
  content: string;
  source: PlanContentSource;
  edited_by: string | null;
  created_at: string;
};

type BusinessIdeaInsert = {
  user_id: string;
  title: string;
  payload_json: Record<string, unknown>;
  workspace_id?: string | null;
  project_id?: string | null;
  status?: BusinessIdeaStatus;
  id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};
type BusinessIdeaUpdate = Partial<
  Omit<BusinessIdea, "id" | "user_id" | "created_at">
>;

type ValidationReportInsert = {
  user_id: string;
  business_idea_id: string;
  score: number;
  report_json: Record<string, unknown>;
  prompt_version: string;
  model: string;
  workspace_id?: string | null;
  workflow?: string;
  pdf_url?: string | null;
  duration_ms?: number | null;
  tokens_used?: number | null;
  ai_request_id?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};
type ValidationReportUpdate = Partial<
  Omit<ValidationReport, "id" | "user_id" | "created_at">
>;

type AiRequestLogInsert = {
  user_id: string;
  workflow: string;
  prompt_version: string;
  model: string;
  status: AiRunStatus;
  project_id?: string | null;
  provider?: string;
  duration_ms?: number | null;
  prompt_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  attempts?: number;
  input_json?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
  id?: string;
  created_at?: string;
};

type AiResponseInsert = {
  request_id: string;
  user_id: string;
  workflow: string;
  prompt_version: string;
  model: string;
  output_json: Record<string, unknown>;
  id?: string;
  created_at?: string;
};

type AiUsageLogInsert = {
  user_id: string;
  workspace_id?: string | null;
  workflow: string;
  provider: string;
  model: string;
  prompt_version: string;
  status: AiRunStatus;
  project_id?: string | null;
  request_id?: string | null;
  prompt_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  duration_ms?: number | null;
  estimated_cost_usd?: number | null;
  id?: string;
  created_at?: string;
};

type AiWorkflowInsert = {
  slug: string;
  label: string;
  active_prompt_version: string;
  description?: string | null;
  provider?: string;
  model?: string | null;
  is_active?: boolean;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type AiPromptVersionInsert = {
  workflow_slug: string;
  version: string;
  checksum?: string | null;
  is_active?: boolean;
  id?: string;
  created_at?: string;
};

type ProfileInsert = {
  id: string;
  full_name?: string | null;
  company_name?: string | null;
  bio?: string | null;
  website?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
};
type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>;

type ProjectInsert = {
  user_id: string;
  name: string;
  workspace_id?: string | null;
  status?: ProjectStatus;
  description?: string | null;
  website?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};
type ProjectUpdate = Partial<Omit<Project, "id" | "user_id" | "created_at">>;

type WorkspaceInsert = {
  owner_id: string;
  name: string;
  slug: string;
  is_personal?: boolean;
  id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};
type WorkspaceUpdate = Partial<Omit<Workspace, "id" | "created_at">>;

type WorkspaceMemberInsert = {
  workspace_id: string;
  user_id: string;
  role?: WorkspaceRole;
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type WorkspaceMemberUpdate = Partial<
  Omit<WorkspaceMember, "id" | "created_at">
>;

type BusinessPlanInsert = {
  workspace_id: string;
  user_id: string;
  title: string;
  input_json: Record<string, unknown>;
  prompt_version: string;
  model: string;
  project_id?: string | null;
  business_idea_id?: string | null;
  validation_report_id?: string | null;
  summary?: string | null;
  status?: BusinessPlanStatus;
  workflow?: string;
  ai_request_id?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};
type BusinessPlanUpdate = Partial<
  Omit<BusinessPlan, "id" | "workspace_id" | "user_id" | "created_at">
>;

type BusinessPlanSectionInsert = {
  plan_id: string;
  workspace_id: string;
  section_key: string;
  title: string;
  content: string;
  position: number;
  current_version?: number;
  source?: PlanContentSource;
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type BusinessPlanSectionUpdate = Partial<
  Omit<BusinessPlanSection, "id" | "plan_id" | "workspace_id" | "created_at">
>;

// --- Lead capture (migration 0005) ------------------------------------------

/**
 * The lead lifecycle.
 *
 * Migration 0005 defined four lower-case states; migration 0019 replaced that
 * constraint with the eight upper-case stages the funnel actually moves
 * through, and migrated the existing rows in the same statement
 * (`archived` became `LOST`, which is what it had meant).
 *
 * The lower-case names are gone from the database — the check constraint would
 * now reject them — so they are gone from here too. Leaving them in the union
 * would let TypeScript bless an assignment Postgres refuses at runtime, which
 * is the worst of both worlds.
 */
export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "STRATEGY_BOOKED",
  "STRATEGY_COMPLETED",
  "PROPOSAL",
  "CUSTOMER",
  "LOST",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Lead = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;

  // --- Migration 0019: client onboarding ---------------------------------
  // Added to the existing table, not a second one. All nullable, because the
  // table holds live rows that predate this migration.
  //
  // No column here stores a password, a token or a provider credential.
  /** Set once the visitor has verified their email and has an account. */
  user_id: string | null;
  workspace_id: string | null;
  business_idea_id: string | null;
  first_name: string | null;
  last_name: string | null;
  industry: string | null;
  target_customer: string | null;
  target_market: string | null;
  business_stage: string | null;
  problem_solved: string | null;
  website: string | null;
  owner_user_id: string | null;
  last_activity_at: string | null;
  /** Server-derived and unique, so a resubmitted form collides. */
  idempotency_key: string | null;
};

type LeadInsertRow = {
  email: string;
  source: string;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  status?: LeadStatus;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// --- Sprint 6.5: Commercial platform (migration 0007) ------------------------

export type PlanRow = {
  id: string;
  name: string;
  description: string;
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  monthly_credits: number;
  sort_order: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanEntitlementRow = {
  id: string;
  plan_id: string;
  feature: string;
  is_enabled: boolean;
  limit_value: number | null;
  created_at: string;
};

export type SubscriptionRow = {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_ends_at: string | null;
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditAccountRow = {
  id: string;
  workspace_id: string;
  balance: number;
  lifetime_granted: number;
  lifetime_spent: number;
  created_at: string;
  updated_at: string;
};

export type CreditTransactionRow = {
  id: string;
  workspace_id: string;
  account_id: string;
  kind: string;
  amount: number;
  balance_after: number;
  reason: string | null;
  workflow: string | null;
  ai_request_id: string | null;
  created_by: string | null;
  idempotency_key: string | null;
  created_at: string;
};

type SubscriptionInsert = {
  workspace_id: string;
  plan_id: string;
  status?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
  trial_ends_at?: string | null;
  provider?: string | null;
  provider_ref?: string | null;
  id?: string;
};

type BusinessPlanVersionInsert = {
  section_id: string;
  plan_id: string;
  workspace_id: string;
  section_key: string;
  version: number;
  content: string;
  source: PlanContentSource;
  edited_by?: string | null;
  id?: string;
  created_at?: string;
};

/**
 * Minimal `Database` shape for typing the Supabase client. Each table carries
 * the `Relationships` key that `@supabase/supabase-js` requires to recognise it
 * as a queryable table (otherwise inference falls back to `never`).
 */

// ---------------------------------------------------------------------------
// Admin platform (migration 0008)
// ---------------------------------------------------------------------------

/** Membership of `admin_users` is the ONLY thing that confers admin access. */
export type AdminUserRow = {
  user_id: string;
  role: string;
  is_active: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminRolePermissionRow = {
  role: string;
  permission: string;
};

export type AdminAuditLogRow = {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  reason: string | null;
  request_id: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Market Research (migration 0009)
// ---------------------------------------------------------------------------

export type ResearchDepthRow = {
  id: string;
  label: string;
  description: string;
  max_sources: number;
  max_queries: number;
  stage_timeout_ms: number;
  max_attempts: number;
  sort_order: number;
  is_active: boolean;
};

export type ResearchStageCostRow = {
  depth: string;
  stage: string;
  credits: number;
};

export type ResearchRequestRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  business_idea_id: string | null;
  business_plan_id: string | null;
  title: string;
  scope: string | null;
  industry: string | null;
  geography: string | null;
  target_customer: string | null;
  business_model: string | null;
  questions: unknown;
  depth: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ResearchRunRow = {
  id: string;
  research_request_id: string;
  workspace_id: string;
  status: string;
  /** The resume point. Null once the run finishes. */
  current_stage: string | null;
  depth: string;
  credits_charged: number;
  credits_refunded: number;
  total_tokens: number;
  estimated_cost_usd: number;
  source_count: number;
  evidence_count: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ResearchRunStageRow = {
  id: string;
  run_id: string;
  workspace_id: string;
  stage: string;
  /** A retry is a new attempt with its own charge. */
  attempt: number;
  status: string;
  ai_usage_log_id: string | null;
  credits_charged: number;
  credits_refunded: number;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export type ResearchSourceRow = {
  id: string;
  research_request_id: string;
  workspace_id: string;
  run_id: string | null;
  url: string;
  canonical_url: string;
  title: string | null;
  publisher: string | null;
  source_type: string;
  /** Nullable: a missing publication date is recorded, never invented. */
  published_at: string | null;
  retrieved_at: string;
  status: string;
  /** Retrieval metadata only — never raw page content. */
  metadata: unknown;
  created_at: string;
};

export type ResearchEvidenceRow = {
  id: string;
  research_request_id: string;
  workspace_id: string;
  /** NOT NULL by design: a citation with no source row cannot be stored. */
  source_id: string;
  section_key: string;
  claim: string;
  evidence_reference: string | null;
  confidence: string;
  is_contradictory: boolean;
  contradicts_id: string | null;
  created_at: string;
};

export type ResearchResultRow = {
  id: string;
  research_request_id: string;
  workspace_id: string;
  run_id: string | null;
  section_key: string;
  structured_content: unknown;
  confidence: string;
  status: string;
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Competitor Intelligence (migration 0014)
// ---------------------------------------------------------------------------

export type CompetitorDepthRow = {
  id: string;
  label: string;
  description: string;
  max_competitors: number;
  max_sources: number;
  max_queries: number;
  stage_timeout_ms: number;
  max_attempts: number;
  sort_order: number;
  is_active: boolean;
};

export type CompetitorStageCostRow = {
  depth: string;
  stage: string;
  credits: number;
};

export type CompetitorProjectRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  business_idea_id: string | null;
  business_plan_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  geography: string | null;
  target_customer: string | null;
  customer_problem: string | null;
  business_model: string | null;
  known_competitors: unknown;
  depth: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CompetitorRunRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  status: string;
  /** The resume point. Null once the run finishes. */
  current_stage: string | null;
  depth: string;
  credits_charged: number;
  credits_refunded: number;
  total_tokens: number;
  estimated_cost_usd: number;
  competitor_count: number;
  verified_count: number;
  source_count: number;
  evidence_count: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetitorRunStageRow = {
  id: string;
  run_id: string;
  workspace_id: string;
  stage: string;
  /** A retry is a new attempt with its own charge. */
  attempt: number;
  status: string;
  ai_usage_log_id: string | null;
  credits_charged: number;
  credits_refunded: number;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export type CompetitorSourceRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  run_id: string | null;
  url: string;
  canonical_url: string;
  title: string | null;
  publisher: string | null;
  source_type: string;
  /** Nullable: a missing publication date is recorded, never invented. */
  published_at: string | null;
  retrieved_at: string;
  status: string;
  /** Retrieval metadata only — never raw page content. */
  metadata: unknown;
  created_at: string;
};

export type CompetitorRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  website: string | null;
  canonical_domain: string;
  competitor_type: string;
  verification_status: string;
  verification_notes: string | null;
  /** Stage-written structured data, validated by Zod before it lands. */
  profile: unknown;
  pricing: unknown;
  positioning: unknown;
  confidence: string;
  relevance: number | null;
  created_at: string;
  updated_at: string;
};

export type CompetitorEvidenceRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  /** NOT NULL by design: a claim with no source row cannot be stored. */
  source_id: string;
  /** Null for project-level claims such as a market gap. */
  competitor_id: string | null;
  section_key: string;
  claim: string;
  evidence_reference: string | null;
  /** STATED / OBSERVED / INFERRED / RECOMMENDED. */
  claim_kind: string;
  confidence: string;
  is_contradictory: boolean;
  created_at: string;
};

export type CompetitorResultRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  run_id: string | null;
  section_key: string;
  structured_content: unknown;
  confidence: string;
  status: string;
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * A request joined to its most recent run (migration 0011).
 *
 * Every run column is nullable because a `draft` request has no run yet — the
 * run is created by the first `run-stage` call, not by creating the brief.
 */
export type ResearchRequestOverviewRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  business_idea_id: string | null;
  business_plan_id: string | null;
  title: string;
  industry: string | null;
  geography: string | null;
  depth: string;
  status: string;
  created_at: string;
  updated_at: string;
  run_id: string | null;
  run_status: string | null;
  current_stage: string | null;
  credits_charged: number | null;
  credits_refunded: number | null;
  source_count: number | null;
  evidence_count: number | null;
  run_error: string | null;
  run_completed_at: string | null;
};

// ---------------------------------------------------------------------------
// Financial & Funding Intelligence (migration 0016)
//
// Every `*_minor` field is an INTEGER COUNT OF MINOR UNITS in the project's
// currency — paise, cents, pence. Never a major-unit value, never a float.
// ---------------------------------------------------------------------------

export type FinancialStageCostRow = { stage: string; credits: number };

export type FinancialProjectRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  business_idea_id: string | null;
  business_plan_id: string | null;
  research_request_id: string | null;
  competitor_project_id: string | null;
  title: string;
  description: string | null;
  industry: string | null;
  geography: string | null;
  target_customer: string | null;
  /** ISO 4217. Required — a model whose currency was assumed means nothing. */
  currency: string;
  revenue_model: string;
  horizon_months: number;
  opening_cash_minor: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type FinancialRunRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  status: string;
  /** The resume point. Null once the run finishes. */
  current_stage: string | null;
  credits_charged: number;
  credits_refunded: number;
  total_tokens: number;
  estimated_cost_usd: number;
  assumption_count: number;
  cost_line_count: number;
  funding_option_count: number;
  source_count: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialRunStageRow = {
  id: string;
  run_id: string;
  workspace_id: string;
  stage: string;
  attempt: number;
  status: string;
  ai_usage_log_id: string | null;
  credits_charged: number;
  credits_refunded: number;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export type FinancialAssumptionRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  key: string;
  label: string;
  /** Determines which value column is authoritative. */
  unit: string;
  /** Money only, in minor units. */
  value_minor: number | null;
  /** Counts, basis points and month counts. */
  value_int: number | null;
  /** USER / AI / INHERITED_* / DEFAULT. Never null — provenance is required. */
  source: string;
  confidence: string;
  rationale: string | null;
  evidence_url: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialCostRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  category: string;
  kind: string;
  label: string;
  amount_minor: number;
  every_months: number;
  source: string;
  confidence: string;
  rationale: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialSourceRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  run_id: string | null;
  url: string;
  canonical_url: string;
  title: string | null;
  publisher: string | null;
  published_at: string | null;
  retrieved_at: string;
  status: string;
  metadata: unknown;
  created_at: string;
};

export type FundingOptionRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  source_id: string | null;
  name: string;
  provider: string | null;
  funding_type: string;
  geography: string | null;
  eligibility: string | null;
  /** Published range only. Null means not published — never inferred. */
  amount_min_minor: number | null;
  amount_max_minor: number | null;
  terms: string | null;
  application_url: string | null;
  suitability: string;
  suitability_rationale: string | null;
  confidence: string;
  created_at: string;
};

export type FinancialResultRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  run_id: string | null;
  section_key: string;
  structured_content: unknown;
  confidence: string;
  status: string;
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Migration 0017 — Marketing & Go-To-Market Intelligence
//
// No client write path exists for any of these. Every write goes through a
// security-definer function, so there is no `Insert` shape a browser can use.
// ---------------------------------------------------------------------------

export type GtmStageCostRow = { stage: string; credits: number };

export type GtmProjectRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  business_idea_id: string | null;
  business_plan_id: string | null;
  research_request_id: string | null;
  competitor_project_id: string | null;
  financial_project_id: string | null;
  title: string;
  description: string | null;
  industry: string | null;
  geography: string | null;
  /** ISO 4217. Required — a budget whose currency was assumed means nothing. */
  currency: string;
  /** Decides the funnel template. Null until the planning stage sets it. */
  motion: string | null;
  /** A target the business chose, never a forecast. */
  target_new_customers: number;
  target_horizon_months: number;
  payback_months: number;
  /** Basis points. 30000 = 3.0x. */
  target_ltv_cac_bps: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type GtmRunRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  status: string;
  current_stage: string | null;
  credits_charged: number;
  credits_refunded: number;
  total_tokens: number;
  estimated_cost_usd: number;
  claim_count: number;
  persona_count: number;
  channel_count: number;
  campaign_count: number;
  action_count: number;
  source_count: number;
  error: string | null;
  locked_at: string | null;
  locked_stage: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_stage_started_at: string | null;
  last_stage_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GtmRunStageRow = {
  id: string;
  run_id: string;
  workspace_id: string;
  stage: string;
  attempt: number;
  status: string;
  ai_usage_log_id: string | null;
  credits_charged: number;
  credits_refunded: number;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

/** One statement with its epistemic status attached. A FACT carries a source. */
export type GtmClaimRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  run_id: string | null;
  stage: string;
  topic: string;
  statement: string;
  kind: string;
  rationale: string | null;
  source_url: string | null;
  source_host: string | null;
  confidence: string;
  created_at: string;
};

export type GtmPersonaRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  role: string;
  segment: string | null;
  company_type: string | null;
  company_size: string | null;
  geography: string | null;
  /** Arrays of claim objects: {statement, kind, confidence, rationale?}. */
  pain_points: unknown;
  goals: unknown;
  buying_triggers: unknown;
  objections: unknown;
  decision_criteria: unknown;
  urgency: string | null;
  budget_signals: string | null;
  is_decision_maker: boolean;
  confidence: string;
  display_order: number;
  created_at: string;
};

export type GtmChannelRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  channel: string;
  rationale: string | null;
  target_audience: string | null;
  acquisition_mechanism: string | null;
  effort: string;
  cost_band: string;
  strengths: unknown;
  weaknesses: unknown;
  prerequisites: unknown;
  /** The model's contribution: integers 0-5 per published dimension. */
  ratings: unknown;
  /** The engine's: per-dimension contribution in basis points. */
  contributions: unknown;
  /** Computed by features/marketing/scoring.ts. No model writes this. */
  score_bps: number;
  priority: string;
  priority_note: string | null;
  evidence_url: string | null;
  evidence_host: string | null;
  evidence_note: string | null;
  confidence: string;
  created_at: string;
};

export type GtmFunnelStepRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  step_order: number;
  from_stage: string;
  to_stage: string;
  /** Whole basis points. Read by the deterministic acquisition engine. */
  rate_bps: number;
  kind: string;
  rationale: string | null;
  confidence: string;
  created_at: string;
};

export type GtmCampaignRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  objective: string;
  audience: string | null;
  message: string | null;
  offer: string | null;
  channels: unknown;
  call_to_action: string | null;
  funnel_band: string;
  measurement_kpi: string;
  confidence: string;
  display_order: number;
  created_at: string;
};

export type GtmPlanActionRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  period: string;
  objective: string;
  action: string;
  channel: string | null;
  owner_role: string;
  kpi: string;
  expected_output: string | null;
  dependency: string | null;
  priority: string;
  display_order: number;
  created_at: string;
};

export type GtmSourceRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  run_id: string | null;
  url: string;
  canonical_url: string | null;
  title: string | null;
  publisher: string | null;
  published_at: string | null;
  status: string;
  metadata: unknown;
  retrieved_at: string;
  created_at: string;
};

export type GtmResultRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  run_id: string | null;
  section_key: string;
  structured_content: unknown;
  confidence: string;
  status: string;
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Migration 0018 - AI Business Execution Foundation
//
// No client write path exists for any of these. Every write goes through a
// security-definer function, so there is no `Insert` shape a browser can use.
// ---------------------------------------------------------------------------

export type ExecutionPlanRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  gtm_project_id: string | null;
  business_plan_id: string | null;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ExecutionActionRow = {
  id: string;
  workspace_id: string;
  execution_plan_id: string;
  action_type: string;
  title: string;
  description: string | null;
  /** Validated against the action type's registered Zod schema before storage. */
  input: unknown;
  expected_output: unknown;
  status: string;
  approval_required: boolean;
  approved_by: string | null;
  approved_at: string | null;
  execution_provider: string;
  external_execution_id: string | null;
  result: unknown;
  error: string | null;
  error_code: string | null;
  /** Server-owned. No RPC accepts it as a parameter. */
  retry_count: number;
  /** Set when this action supersedes a COMPLETED one. */
  revision_of: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ExecutionRunRow = {
  id: string;
  workspace_id: string;
  action_id: string;
  provider: string;
  attempt: number;
  /** Server-derived and UNIQUE, so a duplicate dispatch collides. */
  idempotency_key: string;
  status: string;
  external_execution_id: string | null;
  result_summary: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
};

/** Append-only. UPDATE and DELETE are rejected by trigger for every role. */
export type ExecutionAuditLogRow = {
  id: string;
  workspace_id: string;
  actor_user_id: string;
  /** The actor's workspace role at the time, not their current one. */
  actor_role: string;
  event: string;
  entity_type: string;
  entity_id: string;
  previous_state: string | null;
  new_state: string | null;
  reason: string | null;
  metadata: unknown;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Migration 0019 - Client onboarding & lead conversion
//
// `leads` already existed (0005) and is EXTENDED here, not replaced. No column
// below stores a password, a token or a provider credential.
// ---------------------------------------------------------------------------

export type LeadEventRow = {
  id: string;
  lead_id: string;
  event: string;
  actor_user_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  note: string | null;
  metadata: unknown;
  created_at: string;
};

export type BookingRow = {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  lead_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  scheduled_at: string;
  timezone: string;
  duration_minutes: number;
  status: string;
  meeting_url: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
};

export type EmailTemplateRow = {
  id: string;
  trigger: string;
  name: string;
  description: string | null;
  status: string;
  current_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Append-only. UPDATE and DELETE are rejected by trigger for every role. */
export type EmailTemplateVersionRow = {
  id: string;
  template_id: string;
  version: number;
  subject: string;
  body_html: string;
  body_text: string | null;
  created_by: string | null;
  created_at: string;
};

export type EmailLogRow = {
  id: string;
  template_id: string | null;
  /** The exact version sent, so "what did they receive?" stays answerable. */
  template_version_id: string | null;
  trigger: string | null;
  recipient_email: string;
  user_id: string | null;
  workspace_id: string | null;
  lead_id: string | null;
  booking_id: string | null;
  subject: string | null;
  provider: string | null;
  provider_message_id: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  is_test: boolean;
  created_at: string;
  sent_at: string | null;
  failed_at: string | null;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [];
      };
      business_ideas: {
        Row: BusinessIdea;
        Insert: BusinessIdeaInsert;
        Update: BusinessIdeaUpdate;
        Relationships: [];
      };
      validation_reports: {
        Row: ValidationReport;
        Insert: ValidationReportInsert;
        Update: ValidationReportUpdate;
        Relationships: [];
      };
      ai_requests: {
        Row: AiRequestLog;
        Insert: AiRequestLogInsert;
        Update: Partial<AiRequestLog>;
        Relationships: [];
      };
      ai_responses: {
        Row: AiResponseRecord;
        Insert: AiResponseInsert;
        Update: Partial<AiResponseRecord>;
        Relationships: [];
      };
      ai_usage_logs: {
        Row: AiUsageLog;
        Insert: AiUsageLogInsert;
        Update: Partial<AiUsageLog>;
        Relationships: [];
      };
      ai_workflows: {
        Row: AiWorkflowRecord;
        Insert: AiWorkflowInsert;
        Update: Partial<AiWorkflowRecord>;
        Relationships: [];
      };
      ai_prompt_versions: {
        Row: AiPromptVersionRecord;
        Insert: AiPromptVersionInsert;
        Update: Partial<AiPromptVersionRecord>;
        Relationships: [];
      };
      workspaces: {
        Row: Workspace;
        Insert: WorkspaceInsert;
        Update: WorkspaceUpdate;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: WorkspaceMemberInsert;
        Update: WorkspaceMemberUpdate;
        Relationships: [];
      };
      business_plans: {
        Row: BusinessPlan;
        Insert: BusinessPlanInsert;
        Update: BusinessPlanUpdate;
        Relationships: [];
      };
      business_plan_sections: {
        Row: BusinessPlanSection;
        Insert: BusinessPlanSectionInsert;
        Update: BusinessPlanSectionUpdate;
        Relationships: [];
      };
      business_plan_versions: {
        Row: BusinessPlanVersion;
        Insert: BusinessPlanVersionInsert;
        Update: Partial<BusinessPlanVersion>;
        Relationships: [];
      };
      leads: {
        Row: Lead;
        Insert: LeadInsertRow;
        Update: Partial<Lead>;
        Relationships: [];
      };
      plans: {
        Row: PlanRow;
        Insert: Partial<PlanRow> & {
          id: string;
          name: string;
          description: string;
        };
        Update: Partial<PlanRow>;
        Relationships: [];
      };
      plan_entitlements: {
        Row: PlanEntitlementRow;
        Insert: Partial<PlanEntitlementRow> & {
          plan_id: string;
          feature: string;
        };
        Update: Partial<PlanEntitlementRow>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: SubscriptionInsert;
        Update: Partial<SubscriptionRow>;
        Relationships: [];
      };
      credit_accounts: {
        Row: CreditAccountRow;
        Insert: Partial<CreditAccountRow> & { workspace_id: string };
        Update: Partial<CreditAccountRow>;
        Relationships: [];
      };
      credit_transactions: {
        Row: CreditTransactionRow;
        Insert: Partial<CreditTransactionRow> & {
          workspace_id: string;
          account_id: string;
          kind: string;
          amount: number;
          balance_after: number;
        };
        Update: Partial<CreditTransactionRow>;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUserRow;
        Insert: Omit<AdminUserRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AdminUserRow>;
        Relationships: [];
      };
      admin_role_permissions: {
        Row: AdminRolePermissionRow;
        Insert: AdminRolePermissionRow;
        Update: Partial<AdminRolePermissionRow>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: AdminAuditLogRow;
        Insert: Omit<AdminAuditLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        // No client write path exists; declared for type completeness only.
        Update: Partial<AdminAuditLogRow>;
        Relationships: [];
      };
      research_depths: {
        Row: ResearchDepthRow;
        Insert: ResearchDepthRow;
        Update: Partial<ResearchDepthRow>;
        Relationships: [];
      };
      research_stage_costs: {
        Row: ResearchStageCostRow;
        Insert: ResearchStageCostRow;
        Update: Partial<ResearchStageCostRow>;
        Relationships: [];
      };
      research_requests: {
        Row: ResearchRequestRow;
        Insert: Omit<ResearchRequestRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ResearchRequestRow>;
        Relationships: [];
      };
      research_runs: {
        Row: ResearchRunRow;
        Insert: Omit<ResearchRunRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ResearchRunRow>;
        Relationships: [];
      };
      research_run_stages: {
        Row: ResearchRunStageRow;
        Insert: Omit<ResearchRunStageRow, "id" | "started_at"> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<ResearchRunStageRow>;
        Relationships: [];
      };
      research_sources: {
        Row: ResearchSourceRow;
        Insert: Omit<
          ResearchSourceRow,
          "id" | "created_at" | "retrieved_at"
        > & {
          id?: string;
          created_at?: string;
          retrieved_at?: string;
        };
        Update: Partial<ResearchSourceRow>;
        Relationships: [];
      };
      research_evidence: {
        Row: ResearchEvidenceRow;
        Insert: Omit<ResearchEvidenceRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ResearchEvidenceRow>;
        Relationships: [];
      };
      research_results: {
        Row: ResearchResultRow;
        Insert: Omit<ResearchResultRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ResearchResultRow>;
        Relationships: [];
      };

      // --- Migration 0014: competitor intelligence ----------------------
      // No client write path exists for any of these; `Insert`/`Update` are
      // declared for type completeness, and every write goes through a
      // security-definer function.
      competitor_depths: {
        Row: CompetitorDepthRow;
        Insert: CompetitorDepthRow;
        Update: Partial<CompetitorDepthRow>;
        Relationships: [];
      };
      competitor_stage_costs: {
        Row: CompetitorStageCostRow;
        Insert: CompetitorStageCostRow;
        Update: Partial<CompetitorStageCostRow>;
        Relationships: [];
      };
      competitor_projects: {
        Row: CompetitorProjectRow;
        Insert: Omit<
          CompetitorProjectRow,
          "id" | "created_at" | "updated_at"
        > & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<CompetitorProjectRow>;
        Relationships: [];
      };
      competitor_runs: {
        Row: CompetitorRunRow;
        Insert: Omit<CompetitorRunRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CompetitorRunRow>;
        Relationships: [];
      };
      competitor_run_stages: {
        Row: CompetitorRunStageRow;
        Insert: Omit<CompetitorRunStageRow, "id" | "started_at"> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<CompetitorRunStageRow>;
        Relationships: [];
      };
      competitor_sources: {
        Row: CompetitorSourceRow;
        Insert: Omit<
          CompetitorSourceRow,
          "id" | "created_at" | "retrieved_at"
        > & { id?: string; created_at?: string; retrieved_at?: string };
        Update: Partial<CompetitorSourceRow>;
        Relationships: [];
      };
      competitors: {
        Row: CompetitorRow;
        Insert: Omit<CompetitorRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CompetitorRow>;
        Relationships: [];
      };
      competitor_evidence: {
        Row: CompetitorEvidenceRow;
        Insert: Omit<CompetitorEvidenceRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<CompetitorEvidenceRow>;
        Relationships: [];
      };
      competitor_results: {
        Row: CompetitorResultRow;
        Insert: Omit<
          CompetitorResultRow,
          "id" | "created_at" | "updated_at"
        > & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<CompetitorResultRow>;
        Relationships: [];
      };
      // --- Migration 0016: financial intelligence -----------------------
      // No client write path exists for any of these; every write goes through
      // a security-definer function.
      financial_stage_costs: {
        Row: FinancialStageCostRow;
        Insert: FinancialStageCostRow;
        Update: Partial<FinancialStageCostRow>;
        Relationships: [];
      };
      financial_projects: {
        Row: FinancialProjectRow;
        Insert: Omit<
          FinancialProjectRow,
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<FinancialProjectRow>;
        Relationships: [];
      };
      financial_runs: {
        Row: FinancialRunRow;
        Insert: Omit<FinancialRunRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<FinancialRunRow>;
        Relationships: [];
      };
      financial_run_stages: {
        Row: FinancialRunStageRow;
        Insert: Omit<FinancialRunStageRow, "id" | "started_at"> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<FinancialRunStageRow>;
        Relationships: [];
      };
      financial_assumptions: {
        Row: FinancialAssumptionRow;
        Insert: Omit<
          FinancialAssumptionRow,
          "id" | "created_at" | "updated_at"
        > & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<FinancialAssumptionRow>;
        Relationships: [];
      };
      financial_costs: {
        Row: FinancialCostRow;
        Insert: Omit<FinancialCostRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<FinancialCostRow>;
        Relationships: [];
      };
      financial_sources: {
        Row: FinancialSourceRow;
        Insert: Omit<
          FinancialSourceRow,
          "id" | "created_at" | "retrieved_at"
        > & {
          id?: string;
          created_at?: string;
          retrieved_at?: string;
        };
        Update: Partial<FinancialSourceRow>;
        Relationships: [];
      };
      funding_options: {
        Row: FundingOptionRow;
        Insert: Omit<FundingOptionRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<FundingOptionRow>;
        Relationships: [];
      };
      financial_results: {
        Row: FinancialResultRow;
        Insert: Omit<FinancialResultRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<FinancialResultRow>;
        Relationships: [];
      };

      // --- Migration 0017: marketing & go-to-market intelligence ---------
      // No client write path exists for any of these; every write goes through
      // a security-definer function.
      gtm_stage_costs: {
        Row: GtmStageCostRow;
        Insert: GtmStageCostRow;
        Update: Partial<GtmStageCostRow>;
        Relationships: [];
      };
      gtm_projects: {
        Row: GtmProjectRow;
        Insert: Omit<GtmProjectRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<GtmProjectRow>;
        Relationships: [];
      };
      gtm_runs: {
        Row: GtmRunRow;
        Insert: Omit<GtmRunRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<GtmRunRow>;
        Relationships: [];
      };
      gtm_run_stages: {
        Row: GtmRunStageRow;
        Insert: Omit<GtmRunStageRow, "id" | "started_at"> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<GtmRunStageRow>;
        Relationships: [];
      };
      gtm_claims: {
        Row: GtmClaimRow;
        Insert: Omit<GtmClaimRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GtmClaimRow>;
        Relationships: [];
      };
      gtm_personas: {
        Row: GtmPersonaRow;
        Insert: Omit<GtmPersonaRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GtmPersonaRow>;
        Relationships: [];
      };
      gtm_channels: {
        Row: GtmChannelRow;
        Insert: Omit<GtmChannelRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GtmChannelRow>;
        Relationships: [];
      };
      gtm_funnel_steps: {
        Row: GtmFunnelStepRow;
        Insert: Omit<GtmFunnelStepRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GtmFunnelStepRow>;
        Relationships: [];
      };
      gtm_campaigns: {
        Row: GtmCampaignRow;
        Insert: Omit<GtmCampaignRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GtmCampaignRow>;
        Relationships: [];
      };
      gtm_plan_actions: {
        Row: GtmPlanActionRow;
        Insert: Omit<GtmPlanActionRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GtmPlanActionRow>;
        Relationships: [];
      };
      gtm_sources: {
        Row: GtmSourceRow;
        Insert: Omit<GtmSourceRow, "id" | "created_at" | "retrieved_at"> & {
          id?: string;
          created_at?: string;
          retrieved_at?: string;
        };
        Update: Partial<GtmSourceRow>;
        Relationships: [];
      };
      gtm_results: {
        Row: GtmResultRow;
        Insert: Omit<GtmResultRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<GtmResultRow>;
        Relationships: [];
      };

      // --- Migration 0018: AI business execution foundation --------------
      execution_plans: {
        Row: ExecutionPlanRow;
        Insert: Omit<ExecutionPlanRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ExecutionPlanRow>;
        Relationships: [];
      };
      execution_actions: {
        Row: ExecutionActionRow;
        Insert: Omit<ExecutionActionRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ExecutionActionRow>;
        Relationships: [];
      };
      execution_runs: {
        Row: ExecutionRunRow;
        Insert: Omit<ExecutionRunRow, "id" | "started_at"> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<ExecutionRunRow>;
        Relationships: [];
      };
      execution_audit_logs: {
        Row: ExecutionAuditLogRow;
        Insert: Omit<ExecutionAuditLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ExecutionAuditLogRow>;
        Relationships: [];
      };

      // --- Migration 0019: client onboarding & lead conversion -----------
      lead_events: {
        Row: LeadEventRow;
        Insert: Omit<LeadEventRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<LeadEventRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Omit<BookingRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<BookingRow>;
        Relationships: [];
      };
      email_templates: {
        Row: EmailTemplateRow;
        Insert: Omit<EmailTemplateRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EmailTemplateRow>;
        Relationships: [];
      };
      email_template_versions: {
        Row: EmailTemplateVersionRow;
        Insert: Omit<EmailTemplateVersionRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<EmailTemplateVersionRow>;
        Relationships: [];
      };
      email_logs: {
        Row: EmailLogRow;
        Insert: Omit<EmailLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<EmailLogRow>;
        Relationships: [];
      };
    };
    Views: {
      research_request_overview: {
        Row: ResearchRequestOverviewRow;
        Relationships: [];
      };
    };
    Functions: {
      /** Migration 0007 — the only supported way to change a credit balance. */
      apply_credit_transaction: {
        Args: {
          p_workspace_id: string;
          p_kind: string;
          p_amount: number;
          p_reason?: string | null;
          p_workflow?: string | null;
          p_ai_request_id?: string | null;
          p_created_by?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: number;
      };

      // --- Migration 0008: admin platform -------------------------------
      // Each of these re-checks authority inside the database, so being able
      // to call one is not the same as being allowed to act.
      admin_role: { Args: Record<string, never>; Returns: string | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      admin_has: { Args: { p_permission: string }; Returns: boolean };
      admin_log: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_before?: unknown;
          p_after?: unknown;
          p_reason?: string | null;
          p_request_id?: string | null;
        };
        Returns: string;
      };
      admin_set_user_suspended: {
        Args: {
          p_user_id: string;
          p_suspended: boolean;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      admin_set_workspace_suspended: {
        Args: {
          p_workspace_id: string;
          p_suspended: boolean;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      admin_apply_credits: {
        Args: {
          p_workspace_id: string;
          p_kind: string;
          p_amount: number;
          p_reason: string;
        };
        Returns: number;
      };
      admin_update_plan: {
        Args: {
          p_plan_id: string;
          p_name: string | null;
          p_description: string | null;
          p_price_monthly: number | null;
          p_monthly_credits: number;
          p_is_public: boolean;
          p_reason: string;
        };
        Returns: undefined;
      };
      admin_update_entitlement: {
        Args: {
          p_plan_id: string;
          p_feature: string;
          p_enabled: boolean;
          p_limit: number | null;
          p_reason: string;
        };
        Returns: undefined;
      };
      /**
       * Migration 0029. Updates the subscription, appends the immutable
       * `subscription_plan_history` row and writes the admin audit row in one
       * transaction. Requires `plans.manage`.
       */
      admin_change_workspace_plan: {
        Args: {
          p_workspace_id: string;
          p_plan_id: string;
          p_reason?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      /** Migration 0029. A workspace's plan transitions, newest first. */
      admin_workspace_plan_history: {
        Args: { p_workspace_id: string; p_limit?: number | null };
        Returns: Record<string, unknown>[];
      };
      admin_platform_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
      };

      // --- Migration 0016: financial intelligence -----------------------
      /** Total credits for a full financial run. Compute stages contribute 0. */
      financial_estimate_credits: {
        Args: Record<string, never>;
        Returns: number;
      };
      /** Creates a financial model. Re-derives edit permission from auth.uid(). */
      financial_create_project: {
        Args: {
          p_workspace_id: string;
          p_title: string;
          p_currency: string;
          p_revenue_model: string;
          p_description?: string | null;
          p_industry?: string | null;
          p_geography?: string | null;
          p_target_customer?: string | null;
          p_horizon_months?: number;
          p_opening_cash_minor?: number;
          p_business_idea_id?: string | null;
          p_business_plan_id?: string | null;
          p_research_request_id?: string | null;
          p_competitor_project_id?: string | null;
        };
        Returns: string;
      };
      financial_start_run: { Args: { p_project_id: string }; Returns: string };
      financial_claim_stage: {
        Args: {
          p_run_id: string;
          p_max_attempts?: number;
          p_lock_timeout_ms?: number;
        };
        Returns: {
          stage: string;
          attempt: number;
          workspace_id: string;
          project_id: string;
        }[];
      };
      financial_complete_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_next_stage: string | null;
          p_results?: unknown;
          p_assumptions?: unknown;
          p_costs?: unknown;
          p_sources?: unknown;
          p_funding?: unknown;
          p_usage?: unknown;
        };
        Returns: {
          assumptions_written: number;
          costs_written: number;
          sources_added: number;
          funding_written: number;
          next_stage: string | null;
        };
      };
      financial_fail_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_error_code: string;
          p_error_message: string;
          p_terminal?: boolean;
          p_usage?: unknown;
        };
        Returns: undefined;
      };
      /**
       * The ONLY user-write path into the model. Users change assumptions;
       * calculated outputs are not writable, because they are not inputs.
       */
      financial_set_assumption: {
        Args: {
          p_project_id: string;
          p_key: string;
          p_unit: string;
          p_value_minor?: number | null;
          p_value_int?: number | null;
          p_label?: string | null;
        };
        Returns: string;
      };

      // --- Migration 0015: competitor admin observability ---------------
      /** Competitor operational counters for the admin dashboard. */
      admin_competitor_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
      };

      // --- Migration 0016: financial admin observability ----------------
      /**
       * Financial operational counters for the admin dashboard.
       *
       * Permission-gated block by block inside the function, so an absent key
       * means "you may not read this", not "the value is zero".
       */
      admin_financial_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
      };

      // --- Migration 0017: marketing & GTM intelligence ------------------
      /** Marketing operational counters for the admin dashboard. */
      admin_gtm_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
      };

      // --- Migration 0018: business execution ----------------------------
      /** Execution operational counters for the admin dashboard. */
      admin_execution_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
      };
      /** Records a state change. Called inside every mutating RPC. */
      execution_audit: {
        Args: {
          p_workspace_id: string;
          p_event: string;
          p_entity_type: string;
          p_entity_id: string;
          p_previous_state?: string | null;
          p_new_state?: string | null;
          p_reason?: string | null;
          p_metadata?: unknown;
        };
        Returns: string;
      };
      execution_create_plan: {
        Args: {
          p_workspace_id: string;
          p_title: string;
          p_description?: string | null;
          p_gtm_project_id?: string | null;
          p_business_plan_id?: string | null;
        };
        Returns: string;
      };
      execution_add_action: {
        Args: {
          p_plan_id: string;
          p_action_type: string;
          p_title: string;
          p_description?: string | null;
          p_input?: unknown;
          p_expected_output?: unknown;
          p_approval_required?: boolean;
          p_provider?: string;
          p_display_order?: number;
          p_revision_of?: string | null;
        };
        Returns: string;
      };
      /**
       * The single write path for action status. Takes the state the caller
       * believes the action is in and refuses if it has moved, which is what
       * stops two tabs approving and executing the same action in a race.
       */
      execution_transition: {
        Args: {
          p_action_id: string;
          p_expected_state: string;
          p_new_state: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      /**
       * Claims an attempt row. On an idempotency-key collision it returns the
       * EXISTING run rather than creating a duplicate external effect.
       */
      execution_claim_run: {
        Args: {
          p_action_id: string;
          p_provider: string;
          p_attempt: number;
          p_idempotency_key: string;
        };
        Returns: { run_id: string; was_existing: boolean }[];
      };
      execution_record_result: {
        Args: {
          p_run_id: string;
          p_status: string;
          p_external_id?: string | null;
          p_summary?: string | null;
          p_error_code?: string | null;
          p_error_message?: string | null;
          p_result?: unknown;
          p_duration_ms?: number | null;
        };
        Returns: void;
      };
      execution_set_plan_status: {
        Args: { p_plan_id: string; p_status: string };
        Returns: void;
      };

      // --- Migration 0019: client onboarding -----------------------------
      /** Funnel counters for the admin dashboard. Counted in SQL. */
      /** Resolves the ACTIVE template for a trigger. See migration 0023. */
      email_active_template: {
        Args: { p_trigger: string };
        Returns: {
          template_id: string;
          version_id: string;
          version: number;
          subject: string;
          body_html: string;
          body_text: string | null;
        }[];
      };
      /**
       * Super Admin command center aggregates (migration 0024). Each block is
       * permission-gated, so a key the caller may not see is ABSENT rather
       * than zero. Money values are decimal STRINGS — format them, never do
       * float arithmetic on them.
       */
      /**
       * Atomic entitlement enforcement (migration 0025). Takes NO plan, limit
       * or usage argument: all three are resolved server-side, so a client
       * cannot assert its own allowance.
       */
      entitlement_consume: {
        Args: {
          p_workspace_id: string;
          p_feature: string;
          p_idempotency_key: string;
        };
        Returns: Record<string, unknown>;
      };
      /** Returns a reservation whose work did not happen. */
      entitlement_release: {
        Args: { p_idempotency_key: string };
        Returns: Record<string, unknown>;
      };
      /** Plan, period and per-feature consumption for the usage panel. */
      entitlement_usage: {
        Args: { p_workspace_id: string };
        Returns: Record<string, unknown>;
      };
      admin_command_center_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, unknown>;
      };
      admin_funnel_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
      };
      /**
       * Public lead capture. Callable by anon — the one anonymous write in the
       * application. Creates no auth user, no workspace and no AI spend:
       * provisioning waits for a verified email.
       */
      lead_capture: {
        Args: {
          p_email: string;
          p_source: string;
          p_idempotency_key: string;
          p_first_name?: string | null;
          p_last_name?: string | null;
          p_phone?: string | null;
          p_company?: string | null;
          p_message?: string | null;
          p_industry?: string | null;
          p_target_customer?: string | null;
          p_target_market?: string | null;
          p_business_stage?: string | null;
          p_problem_solved?: string | null;
          p_website?: string | null;
          p_landing_page?: string | null;
          p_referrer?: string | null;
          p_utm_source?: string | null;
          p_utm_medium?: string | null;
          p_utm_campaign?: string | null;
          p_utm_term?: string | null;
          p_utm_content?: string | null;
        };
        Returns: { lead_id: string; was_existing: boolean }[];
      };
      /** Links an anonymous lead to the now-verified user who owns that email. */
      lead_claim_for_user: {
        Args: { p_workspace_id: string; p_business_idea_id?: string | null };
        Returns: string | null;
      };
      lead_record_event: {
        Args: {
          p_lead_id: string;
          p_event: string;
          p_note?: string | null;
          p_metadata?: unknown;
        };
        Returns: string;
      };
      lead_set_status: {
        Args: { p_lead_id: string; p_status: string; p_note?: string | null };
        Returns: void;
      };
      booking_create: {
        Args: {
          p_full_name: string;
          p_email: string;
          p_scheduled_at: string;
          p_timezone: string;
          p_idempotency_key: string;
          p_phone?: string | null;
          p_lead_id?: string | null;
          p_duration?: number;
          p_notes?: string | null;
        };
        Returns: { booking_id: string; was_existing: boolean }[];
      };
      booking_set_status: {
        Args: {
          p_booking_id: string;
          p_status: string;
          p_reason?: string | null;
          p_meeting_url?: string | null;
        };
        Returns: void;
      };
      /** Always creates a NEW version. Content is never rewritten in place. */
      email_template_save: {
        Args: {
          p_template_id: string;
          p_subject: string;
          p_body_html: string;
          p_body_text?: string | null;
        };
        Returns: number;
      };
      email_template_set_status: {
        Args: { p_template_id: string; p_status: string };
        Returns: void;
      };
      email_log_record: {
        Args: {
          p_recipient: string;
          p_status: string;
          p_trigger?: string | null;
          p_template_id?: string | null;
          p_version_id?: string | null;
          p_subject?: string | null;
          p_provider?: string | null;
          p_message_id?: string | null;
          p_error_code?: string | null;
          p_error_message?: string | null;
          p_user_id?: string | null;
          p_workspace_id?: string | null;
          p_lead_id?: string | null;
          p_booking_id?: string | null;
          p_is_test?: boolean;
        };
        Returns: string;
      };
      /** Total credits for a full GTM run. The compute stage contributes 0. */
      gtm_estimate_credits: { Args: Record<string, never>; Returns: number };
      /** Creates a GTM project. Re-derives edit permission from auth.uid(). */
      gtm_create_project: {
        Args: {
          p_workspace_id: string;
          p_title: string;
          p_currency: string;
          p_description?: string | null;
          p_industry?: string | null;
          p_geography?: string | null;
          p_motion?: string | null;
          p_target_new_customers?: number | null;
          p_target_horizon_months?: number | null;
          p_payback_months?: number | null;
          p_target_ltv_cac_bps?: number | null;
          p_business_idea_id?: string | null;
          p_business_plan_id?: string | null;
          p_research_request_id?: string | null;
          p_competitor_project_id?: string | null;
          p_financial_project_id?: string | null;
        };
        Returns: string;
      };
      gtm_start_run: { Args: { p_project_id: string }; Returns: string };
      /**
       * Claims the next stage under a row lock. The lock is what stops two
       * tabs running the same stage and being charged twice.
       */
      gtm_claim_stage: {
        Args: {
          p_run_id: string;
          p_max_attempts?: number;
          p_lock_timeout_ms?: number;
        };
        Returns: {
          stage: string;
          attempt: number;
          workspace_id: string;
          project_id: string;
        }[];
      };
      /**
       * Persists a stage's output and advances the pointer in one transaction.
       * Accepts no score, no priority and no budget as separate arguments —
       * those arrive already computed inside the payloads.
       */
      gtm_complete_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_next_stage?: string | null;
          p_results?: unknown;
          p_claims?: unknown;
          p_personas?: unknown;
          p_channels?: unknown;
          p_funnel_steps?: unknown;
          p_campaigns?: unknown;
          p_plan_actions?: unknown;
          p_sources?: unknown;
          p_project_patch?: unknown;
          p_usage?: unknown;
          p_credits?: number;
        };
        Returns: void;
      };
      /** Records a failure WITHOUT advancing, so a retry runs the same stage. */
      gtm_fail_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_error_code: string;
          p_error_message: string;
          p_credits_refunded?: number;
          p_usage?: unknown;
        };
        Returns: void;
      };

      // --- Migration 0014: competitor intelligence ----------------------
      /** Total credits for a full competitor run at this depth. */
      competitor_estimate_credits: {
        Args: { p_depth: string };
        Returns: number;
      };
      /**
       * Creates a competitor brief. Re-derives workspace edit permission from
       * `auth.uid()` and refuses an idea or plan from another workspace.
       */
      competitor_create_project: {
        Args: {
          p_workspace_id: string;
          p_title: string;
          p_depth: string;
          p_description?: string | null;
          p_category?: string | null;
          p_geography?: string | null;
          p_target_customer?: string | null;
          p_customer_problem?: string | null;
          p_business_model?: string | null;
          p_known_competitors?: unknown;
          p_business_idea_id?: string | null;
          p_business_plan_id?: string | null;
        };
        Returns: string;
      };
      /** Creates or reuses the single active run for a project. */
      competitor_start_run: { Args: { p_project_id: string }; Returns: string };
      /**
       * Atomically claims the next executable stage. The row lock inside is
       * what stops two concurrent requests running — and charging for — the
       * same stage.
       */
      competitor_claim_stage: {
        Args: {
          p_run_id: string;
          p_max_attempts?: number;
          p_lock_timeout_ms?: number;
        };
        Returns: {
          stage: string;
          attempt: number;
          depth: string;
          workspace_id: string;
          project_id: string;
        }[];
      };
      /**
       * Persists sources, competitors, evidence and section results AND
       * advances the pointer, in one transaction.
       */
      competitor_complete_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_next_stage: string | null;
          p_results?: unknown;
          p_sources?: unknown;
          p_competitors?: unknown;
          p_evidence?: unknown;
          p_usage?: unknown;
        };
        Returns: {
          sources_added: number;
          competitors_written: number;
          evidence_added: number;
          next_stage: string | null;
        };
      };
      /** Records a failure and releases the lock WITHOUT advancing. */
      competitor_fail_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_error_code: string;
          p_error_message: string;
          p_terminal?: boolean;
          p_usage?: unknown;
        };
        Returns: undefined;
      };

      // --- Migration 0013: admin operations -----------------------------
      /** Research/product counters for the admin dashboard, permission-gated. */
      admin_research_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
      };
      /**
       * AI cost and usage aggregated in SQL. `p_dimension` is validated against
       * a fixed list inside the function — it is never interpolated into a
       * query, so an unexpected value errors rather than reshaping the SQL.
       */
      admin_cost_breakdown: {
        Args: {
          p_dimension:
            "day" | "provider" | "model" | "workflow" | "feature" | "workspace";
          p_since?: string | null;
          p_until?: string | null;
          p_limit?: number;
        };
        Returns: {
          dimension: string;
          since: string;
          until: string;
          rows: {
            key: string;
            label: string;
            requests: number;
            failures: number;
            tokens: number;
            /** `numeric` as text — never a JS float for a money column. */
            cost: string;
          }[];
        };
      };

      // --- Migration 0009: market research ------------------------------
      /** Total credits for a full run at this depth, summed from the same
       *  rows the stage engine charges against. */
      research_estimate_credits: {
        Args: { p_depth: string };
        Returns: number;
      };

      // --- Migration 0010: stage engine ---------------------------------
      /**
       * Atomically claims the next executable stage. The row lock inside is
       * what stops two concurrent requests running the same stage.
       */
      research_claim_stage: {
        Args: {
          p_run_id: string;
          p_max_attempts?: number;
          p_lock_timeout_ms?: number;
        };
        Returns: {
          stage: string;
          attempt: number;
          depth: string;
          workspace_id: string;
          request_id: string;
        }[];
      };
      /** Persists results, sources and evidence AND advances, in one transaction. */
      research_complete_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_next_stage: string | null;
          p_results?: unknown;
          p_sources?: unknown;
          p_evidence?: unknown;
          p_usage?: unknown;
        };
        Returns: {
          sources_added: number;
          evidence_added: number;
          next_stage: string | null;
        };
      };
      /** Records a failure and releases the lock WITHOUT advancing. */
      research_fail_stage: {
        Args: {
          p_run_id: string;
          p_stage: string;
          p_attempt: number;
          p_error_code: string;
          p_error_message: string;
          p_terminal?: boolean;
          p_usage?: unknown;
        };
        Returns: undefined;
      };
      /** Creates or reuses the single active run for a request. */
      research_start_run: { Args: { p_request_id: string }; Returns: string };

      // --- Migration 0012: report regeneration --------------------------
      /**
       * Claims a re-run of the `report` stage only, on a run whose report has
       * already succeeded. Never re-runs retrieval, so regenerating a report
       * costs one stage instead of seven and returns the same sources.
       */
      research_claim_report_regeneration: {
        Args: { p_request_id: string; p_lock_timeout_ms?: number };
        Returns: {
          run_id: string;
          attempt: number;
          depth: string;
          workspace_id: string;
          request_id: string;
        }[];
      };

      // --- Migration 0011: research product layer -----------------------
      /**
       * Creates a research brief. Re-derives workspace edit permission from
       * `auth.uid()`, so `p_workspace_id` is a claim that gets checked rather
       * than a grant, and refuses a business idea or plan from another
       * workspace.
       */
      research_create_request: {
        Args: {
          p_workspace_id: string;
          p_title: string;
          p_depth: string;
          p_scope?: string | null;
          p_industry?: string | null;
          p_geography?: string | null;
          p_target_customer?: string | null;
          p_business_model?: string | null;
          p_questions?: unknown;
          p_business_idea_id?: string | null;
          p_business_plan_id?: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
