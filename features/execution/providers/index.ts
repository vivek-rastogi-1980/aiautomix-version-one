import { mockProvider } from "@/features/execution/providers/mock";
import { n8nProvider } from "@/features/execution/providers/n8n";
import type { ExecutionProvider } from "@/features/execution/providers/types";

/**
 * The provider registry.
 *
 * The composition root for execution: the only module that knows which
 * providers exist. Everything else asks for one by id.
 *
 * Phase 10.1 ships two. `mock` works and touches nothing. `n8n` is an interface
 * with a safe refusal, so an action routed to it can be planned, previewed and
 * approved but cannot run — which is the correct behaviour for an integration
 * that does not exist yet, and better than hiding the action until it does.
 */

const PROVIDERS: Record<string, ExecutionProvider> = {
  [mockProvider.id]: mockProvider,
  [n8nProvider.id]: n8nProvider,
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

export function getProvider(id: string): ExecutionProvider | null {
  return PROVIDERS[id] ?? null;
}

export function listProviders(): ExecutionProvider[] {
  return Object.values(PROVIDERS);
}

/**
 * The provider actually used for a dispatch.
 *
 * In Phase 10.1 every action can be forced onto the mock so a workspace can
 * rehearse the whole flow — plan, approve, execute, inspect the result —
 * without any integration existing. That is the point of a dry run, and it is
 * the only way §31's manual verification can be performed at all right now.
 *
 * The override is a SERVER decision, never a request field: a client that could
 * choose its provider could route a real publish to the mock and report success
 * for something that never happened, or the reverse.
 */
export function resolveProvider(
  registeredProviderId: string,
  options: { dryRun: boolean },
): ExecutionProvider | null {
  if (options.dryRun) return mockProvider;
  return getProvider(registeredProviderId);
}

export { mockProvider, n8nProvider };
export type { ExecutionProvider };
