import "server-only";

import { listWorkflows } from "@/features/ai/registry/workflows";
import { createClient } from "@/lib/supabase/server";

/**
 * Workflow catalog reads (PROMPT-REGISTRY-SPEC.md).
 *
 * `features/ai/registry/workflows.ts` is the source of truth — it is what the
 * Workflow Manager executes. `ai_workflows` is its queryable mirror, kept in
 * step by `npm run sync:workflows`, and exists so analytics and history filters
 * can join on workflow metadata in SQL.
 *
 * Reads fall back to the code registry, so a deployment that has not run the
 * sync still renders a correct catalog rather than an empty list.
 */

export interface WorkflowCatalogEntry {
  slug: string;
  label: string;
  description: string | null;
  provider: string;
  activePromptVersion: string;
  isActive: boolean;
}

function fromCodeRegistry(): WorkflowCatalogEntry[] {
  return listWorkflows().map((workflow) => ({
    slug: workflow.id,
    label: workflow.label,
    description: workflow.description,
    provider: workflow.provider ?? "openai",
    activePromptVersion: workflow.promptVersion,
    isActive: true,
  }));
}

export async function getWorkflowCatalog(): Promise<WorkflowCatalogEntry[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ai_workflows")
      .select("*")
      .eq("is_active", true)
      .order("label", { ascending: true });

    if (!data || data.length === 0) return fromCodeRegistry();

    return data.map((row) => ({
      slug: row.slug,
      label: row.label,
      description: row.description,
      provider: row.provider,
      activePromptVersion: row.active_prompt_version,
      isActive: row.is_active,
    }));
  } catch {
    return fromCodeRegistry();
  }
}
