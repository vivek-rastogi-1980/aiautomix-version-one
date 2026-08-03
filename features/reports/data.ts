import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BusinessIdea, ValidationReport } from "@/types/database";

/** A report joined with the idea it was generated from. */
export interface ReportWithIdea {
  report: ValidationReport;
  idea: BusinessIdea | null;
}

/** Report history for the current user, newest first. */
export async function getReports(userId: string): Promise<ValidationReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("validation_reports")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** A single report plus its source idea, or null when not found / not owned. */
export async function getReport(
  userId: string,
  reportId: string,
): Promise<ReportWithIdea | null> {
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("validation_reports")
    .select("*")
    .eq("id", reportId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!report) return null;

  const { data: idea } = await supabase
    .from("business_ideas")
    .select("*")
    .eq("id", report.business_idea_id)
    .eq("user_id", userId)
    .maybeSingle();

  return { report, idea: idea ?? null };
}

/** Business ideas submitted by the user, newest first. */
export async function getBusinessIdeas(
  userId: string,
): Promise<BusinessIdea[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_ideas")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}
