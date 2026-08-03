import type { AiUsage } from "@/features/ai/engine/types";

/**
 * Model pricing for usage estimation (USAGE-TRACKING-SPEC.md: "Estimated Cost").
 *
 * Rates are USD per 1,000,000 tokens. They are a *reporting* aid for analytics
 * and future billing, never a source of truth for invoicing — provider list
 * prices change, so the platform records the estimate alongside the raw token
 * counts that produced it.
 */

export interface ModelPricing {
  readonly inputPer1M: number;
  readonly outputPer1M: number;
}

/**
 * Keys are matched as prefixes, because providers return dated model ids
 * (`gpt-4o-mini-2024-07-18`). The longest matching prefix wins.
 */
const PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
};

export function getModelPricing(model: string): ModelPricing | null {
  let best: { key: string; pricing: ModelPricing } | null = null;

  for (const [key, pricing] of Object.entries(PRICING)) {
    if (model.startsWith(key) && (!best || key.length > best.key.length)) {
      best = { key, pricing };
    }
  }

  return best?.pricing ?? null;
}

/**
 * Estimated USD cost of a run, or `null` when the model is not in the table or
 * the provider reported no usage. Rounded to 6 decimals to match the
 * `numeric(12,6)` column.
 */
export function estimateCostUsd(model: string, usage: AiUsage): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;

  const promptTokens = usage.promptTokens;
  const outputTokens = usage.outputTokens;
  if (promptTokens === null && outputTokens === null) return null;

  const cost =
    ((promptTokens ?? 0) / 1_000_000) * pricing.inputPer1M +
    ((outputTokens ?? 0) / 1_000_000) * pricing.outputPer1M;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Format an estimate for the UI. Sub-cent values keep enough precision to read. */
export function formatCostUsd(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
