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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
