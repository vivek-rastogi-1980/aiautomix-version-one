import "server-only";

import { AiError } from "@/features/ai/engine/errors";
import type { AiProvider, ProviderId } from "@/features/ai/engine/types";
import {
  createOpenAiProvider,
  getOpenAiModel,
  isOpenAiConfigured,
} from "@/features/ai/providers/openai";

/**
 * Model Provider Layer (MODEL-PROVIDER-SPEC.md).
 *
 * Workflows name a provider; they never construct one. Adding Anthropic, Gemini
 * or Azure OpenAI means implementing `AiProvider` and adding one line to
 * `PROVIDERS` below — no workflow, service, route or component changes.
 */

interface ProviderEntry {
  readonly label: string;
  /** Whether this deployment can actually call the provider. */
  readonly isConfigured: () => boolean;
  /** Undefined for providers that are declared but not yet implemented. */
  readonly create?: (model?: string) => AiProvider;
  /** Model used when neither the workflow nor the caller names one. */
  readonly defaultModel?: () => string;
}

const PROVIDERS: Record<ProviderId, ProviderEntry> = {
  openai: {
    label: "OpenAI",
    isConfigured: isOpenAiConfigured,
    create: createOpenAiProvider,
    defaultModel: getOpenAiModel,
  },
  anthropic: { label: "Anthropic", isConfigured: () => false },
  gemini: { label: "Google Gemini", isConfigured: () => false },
  "azure-openai": { label: "Azure OpenAI", isConfigured: () => false },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/** The provider used by workflows that do not name one. */
export function getDefaultProviderId(): ProviderId {
  const configured = process.env.AI_PROVIDER as ProviderId | undefined;
  return configured && configured in PROVIDERS ? configured : "openai";
}

export function isProviderImplemented(id: ProviderId): boolean {
  return typeof PROVIDERS[id]?.create === "function";
}

/** True when the named provider is both implemented and holds credentials. */
export function isProviderConfigured(id: ProviderId): boolean {
  const entry = PROVIDERS[id];
  return Boolean(entry?.create) && Boolean(entry?.isConfigured());
}

/** True when the platform can run a workflow at all. */
export function isPlatformConfigured(): boolean {
  return isProviderConfigured(getDefaultProviderId());
}

/** The model a run would use, without constructing a provider. */
export function resolveModelId(id: ProviderId, model?: string): string {
  return model || PROVIDERS[id]?.defaultModel?.() || "unknown";
}

/**
 * Build a provider instance. Throws a typed error when the id is unknown, not
 * implemented in this release, or missing credentials — the three cases a
 * deployment can realistically hit.
 */
export function createProvider(id: ProviderId, model?: string): AiProvider {
  const entry = PROVIDERS[id];

  if (!entry) {
    throw new AiError("AI_PROVIDER_UNSUPPORTED", `Unknown AI provider: ${id}`);
  }

  if (!entry.create) {
    throw new AiError(
      "AI_PROVIDER_UNSUPPORTED",
      `The ${entry.label} provider is declared but not implemented in this release.`,
    );
  }

  return entry.create(model);
}

export function getProviderLabel(id: string): string {
  return PROVIDERS[id as ProviderId]?.label ?? id;
}

// ---------------------------------------------------------------------------
// Retrieval capability (Sprint 8)
// ---------------------------------------------------------------------------

/**
 * Does this provider instance support web-backed research?
 *
 * `research()` is optional on `AiProvider` because retrieval is a capability
 * rather than a universal feature. A provider without web search declares that
 * by not implementing the method, instead of implementing one that returns
 * model-invented URLs.
 */
export function supportsResearch(provider: AiProvider): boolean {
  return typeof provider.research === "function";
}

/** True when the named provider is configured *and* can retrieve. */
export function isResearchProviderConfigured(id: ProviderId): boolean {
  if (!isProviderConfigured(id)) return false;
  try {
    return supportsResearch(createProvider(id));
  } catch {
    return false;
  }
}

/** True when this deployment can run the Market Research workflow at all. */
export function isResearchConfigured(): boolean {
  return isResearchProviderConfigured(getDefaultProviderId());
}

/**
 * Build a provider that is guaranteed to support retrieval.
 *
 * The Market Research workflow uses this rather than `createProvider`, so a
 * deployment pointed at a provider without web search fails with a clear typed
 * error at the boundary — not halfway through a charged run.
 */
export function createResearchProvider(
  id: ProviderId,
  model?: string,
): AiProvider & Required<Pick<AiProvider, "research">> {
  const provider = createProvider(id, model);

  if (!supportsResearch(provider)) {
    throw new AiError(
      "AI_PROVIDER_UNSUPPORTED",
      `The ${getProviderLabel(id)} provider does not support web research in this release.`,
    );
  }

  return provider as AiProvider & Required<Pick<AiProvider, "research">>;
}
