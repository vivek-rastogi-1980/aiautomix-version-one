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

export type LeadStatus = "new" | "contacted" | "qualified" | "archived";

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
      admin_platform_stats: {
        Args: { p_since?: string | null };
        Returns: Record<string, number | string>;
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
