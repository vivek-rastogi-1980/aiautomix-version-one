/**
 * Live verification of the research stages against the real provider.
 *
 * Runs the planning and discovery stages through `runWorkflow` — the same
 * entry point the stage engine uses — and checks that the output validates
 * against the stage's own Zod contract and, for discovery, that the sources
 * came from real citations.
 *
 * NOT part of `npm test`: it spends money and needs network. Run explicitly:
 *   npm run verify:research
 *
 * Persistence, concurrency, retry numbering and refunds are verified
 * separately at the database level; this covers the half that needs a model.
 */

import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import {
  planningOutputSchema,
  discoveryOutputSchema,
} from "@/features/research/stages/contracts";
import { isProviderConfigured } from "@/features/ai/providers";
import { mapStageOutput } from "@/features/research/stages/mapping";
import type { PlanningOutput } from "@/features/research/stages/contracts";

const USER = "00000000-0000-0000-0000-000000000001";

async function main(): Promise<void> {
  if (!isProviderConfigured("openai")) {
    console.log("SKIP: OPENAI_API_KEY not set.");
    return;
  }

  const failures: string[] = [];
  function check(name: string, ok: boolean, detail = ""): void {
    if (!ok) failures.push(name);
    console.log(
      `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
    );
  }

  // ---- Stage 1: planning ---------------------------------------------------
  console.log("\n--- planning ---");
  const planning = await runWorkflow<PlanningOutput>({
    workflowId: "research-planning",
    userId: USER,
    input: {
      title: "Subscription meal kits for people with coeliac disease in the UK",
      industry: "Food and beverage",
      geography: "United Kingdom",
      targetCustomer: "Adults diagnosed with coeliac disease",
      businessModel: "Direct-to-consumer subscription",
      questions: ["How large is the UK coeliac population?"],
      depth: "basic",
    },
  });

  const planParsed = planningOutputSchema.safeParse(planning.data);
  check("planning output validates against its contract", planParsed.success);
  check(
    "planning produced research questions",
    (planning.data.researchQuestions?.length ?? 0) > 0,
    `${planning.data.researchQuestions?.length} questions`,
  );
  check(
    "planning used the complete() path (no sources)",
    (planning.sources ?? []).length === 0,
  );
  check(
    "planning reported tokens",
    (planning.metadata.tokens ?? 0) > 0,
    `${planning.metadata.tokens}`,
  );
  console.log("   Q1:", planning.data.researchQuestions?.[0]?.slice(0, 110));

  // ---- Stage 2: discovery (retrieval) --------------------------------------
  console.log("\n--- discovery (web search) ---");
  const discovery = await runWorkflow({
    workflowId: "research-discovery",
    userId: USER,
    input: {
      researchQuestions: planning.data.researchQuestions.slice(0, 3),
      searchStrategies: planning.data.searchStrategies.slice(0, 3),
      industry: "Food and beverage",
      geography: "United Kingdom",
      maxSources: 8,
    },
  });

  const discParsed = discoveryOutputSchema.safeParse(discovery.data);
  check(
    "discovery output validates against its contract",
    discParsed.success,
    discParsed.success ? "" : JSON.stringify(discParsed.error.issues[0]),
  );

  const sources = discovery.sources ?? [];
  check(
    "discovery returned REAL sources from citations",
    sources.length > 0,
    `${sources.length} sources`,
  );
  check(
    "every source URL is http(s)",
    sources.every((s) => /^https?:\/\//.test(s.url)),
  );
  check(
    "every source has a publisher domain",
    sources.every((s) => Boolean(s.publisher)),
  );
  check(
    "source URLs are unique",
    new Set(sources.map((s) => s.url)).size === sources.length,
  );
  check("maxSources respected", sources.length <= 8, `${sources.length} <= 8`);
  check(
    "publication dates are null, never fabricated",
    sources.every((s) => s.publishedAt === null),
  );

  // The model sometimes writes URLs into its prose despite the prompt. What
  // matters is what gets PERSISTED, so assert on the mapped output.
  const mapped = mapStageOutput(
    "discovery",
    discovery.data,
    discovery.sources ?? [],
  );
  const persisted = JSON.stringify(mapped.results);
  check(
    "no model-authored URL survives into persisted prose",
    !/https?:[/][/]/.test(persisted),
    persisted.slice(0, 120),
  );
  check(
    "persisted source rows all come from citations",
    mapped.sources.length === (discovery.sources ?? []).length,
    `${mapped.sources.length} rows`,
  );

  console.log("   sources:", sources.map((s) => s.publisher).join(", "));
  console.log("   tokens:", discovery.metadata.tokens);

  console.log(
    failures.length
      ? `\n${failures.length} FAILURES: ${failures.join("; ")}`
      : "\nAll live stage checks passed.",
  );
  process.exit(failures.length ? 1 : 0);
}

void main();
