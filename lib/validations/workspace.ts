import { z } from "zod";

import { requiredText } from "@/lib/validations/text";

/** Workspace settings contract (WORKSPACE-ARCHITECTURE.md). */
export const workspaceSchema = z.object({
  name: requiredText("Workspace name", 2, 80),
});

export type WorkspaceInput = z.infer<typeof workspaceSchema>;
