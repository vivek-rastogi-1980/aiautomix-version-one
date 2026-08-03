import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/types/database";

/** List the current user's non-deleted projects, newest first. */
export async function getProjects(userId: string): Promise<Project[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Fetch a single non-deleted project owned by the user, or null. */
export async function getProject(
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}
