/**
 * Sync the code workflow registry into the database catalog.
 *
 * `features/ai/registry/workflows.ts` and the files under `prompts/` are the
 * source of truth; `ai_workflows` and `ai_prompt_versions` are their queryable
 * mirror. Run this after adding a workflow or releasing a new prompt version.
 *
 *   npm run sync:workflows
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: the catalog
 * tables are readable by any signed-in user but writable only by the service
 * role, so users cannot edit the registry that describes what the platform runs.
 */
import { createClient } from "@supabase/supabase-js";

import { listPromptVersions, loadPrompt } from "@/features/ai/registry/prompts";
import { listWorkflows } from "@/features/ai/registry/workflows";
import type { Database } from "@/types/database";

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
        "Run with: npm run sync:workflows (loads .env.local when present).",
    );
  }

  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  for (const workflow of listWorkflows()) {
    const { error: workflowError } = await supabase.from("ai_workflows").upsert(
      {
        slug: workflow.id,
        label: workflow.label,
        description: workflow.description,
        provider: workflow.provider ?? "openai",
        model: workflow.model ?? null,
        active_prompt_version: workflow.promptVersion,
        is_active: true,
      },
      { onConflict: "slug" },
    );

    if (workflowError) {
      throw new Error(
        `Failed to sync workflow ${workflow.id}: ${workflowError.message}`,
      );
    }

    const versions = await listPromptVersions(workflow.id);
    for (const version of versions) {
      const template = await loadPrompt(workflow.id, version);
      const { error: versionError } = await supabase
        .from("ai_prompt_versions")
        .upsert(
          {
            workflow_slug: workflow.id,
            version,
            checksum: template.checksum,
            is_active: version === workflow.promptVersion,
          },
          { onConflict: "workflow_slug,version" },
        );

      if (versionError) {
        throw new Error(
          `Failed to sync prompt ${workflow.id}/${version}: ${versionError.message}`,
        );
      }
    }

    console.log(
      `synced ${workflow.id} — active ${workflow.promptVersion}, ${versions.length} version(s) on disk`,
    );
  }

  console.log("workflow catalog is up to date");
}

main().catch((error) => {
  console.error("SYNC FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
