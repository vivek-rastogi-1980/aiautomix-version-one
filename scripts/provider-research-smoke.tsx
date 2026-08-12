/**
 * Retrieval-capable provider tests (Sprint 8, Phase 2).
 *
 * Three groups:
 *
 *   CONTRACT   `research()` is optional on `AiProvider`, the capability helpers
 *              behave, and `complete()` is untouched. Run with a stub provider,
 *              no network.
 *
 *   ISOLATION  No OpenAI call exists outside the provider layer — asserted by
 *              scanning the source tree, so a future feature that reaches for
 *              the SDK directly fails the build.
 *
 *   LIVE       An actual `research()` call against the configured provider,
 *              proving the sources are genuine. Skipped with a clear notice
 *              when `OPENAI_API_KEY` is absent, so CI without credentials
 *              stays green — but it is never silently treated as a pass.
 *
 * The live group is the point of the phase: the whole reason retrieval exists
 * is that a model asked to "list sources" invents them. A test that only used
 * a stub would prove the plumbing and none of the guarantee.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { AiError } from "@/features/ai/engine/errors";
import type {
  AiCompletion,
  AiCompletionRequest,
  AiProvider,
  AiResearchRequest,
  AiResearchResult,
} from "@/features/ai/engine/types";
import {
  supportsResearch,
  createResearchProvider,
  isResearchConfigured,
  createProvider,
  isProviderConfigured,
} from "@/features/ai/providers";
import {
  DEFAULT_OPENAI_MODEL,
  getOpenAiModel,
} from "@/features/ai/providers/openai";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

function note(message: string): void {
  results.push(`NOTE ${message}`);
}

/** A provider with no retrieval capability — the Anthropic/Gemini case. */
const completeOnlyProvider: AiProvider = {
  id: "stub",
  model: "stub-model",
  async complete(request: AiCompletionRequest): Promise<AiCompletion> {
    return {
      content: JSON.stringify({ echoed: request.messages.length }),
      model: "stub-model",
      usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 },
    };
  },
};

/** A provider that does retrieve. */
const researchProvider: AiProvider = {
  ...completeOnlyProvider,
  id: "stub-research",
  async research(request: AiResearchRequest): Promise<AiResearchResult> {
    return {
      content: JSON.stringify({ question: request.input }),
      model: "stub-model",
      usage: { promptTokens: 10, outputTokens: 5, totalTokens: 15 },
      sources: [
        {
          url: "https://www.gov.uk/corporation-tax-rates",
          title: "Corporation Tax rates",
          publisher: "gov.uk",
          publishedAt: null,
        },
      ],
      searchCallCount: 1,
    };
  },
};

async function main(): Promise<void> {
  // =========================================================================
  // CONTRACT
  // =========================================================================

  check(
    "research() is optional on AiProvider",
    !supportsResearch(completeOnlyProvider),
  );
  check("a retrieval provider is detected", supportsResearch(researchProvider));

  // `complete()` must behave identically whether or not research exists.
  const a = await completeOnlyProvider.complete({
    messages: [{ role: "user", content: "x" }],
  });
  const b = await researchProvider.complete({
    messages: [{ role: "user", content: "x" }],
  });
  check(
    "adding research() does not change complete()",
    a.content === b.content && a.model === b.model,
    `${a.content} vs ${b.content}`,
  );
  check(
    "complete() still returns the usage triple",
    a.usage.promptTokens !== undefined &&
      a.usage.outputTokens !== undefined &&
      a.usage.totalTokens !== undefined,
  );

  const stubResult = await researchProvider.research!({
    instructions: "test",
    input: "test question",
  });
  check("research() returns sources", stubResult.sources.length === 1);
  check(
    "research() returns provider + model info",
    stubResult.model === "stub-model",
  );
  check(
    "research() reports search call count",
    stubResult.searchCallCount === 1,
  );
  check(
    "research() reports usage for the existing usage system",
    stubResult.usage.totalTokens === 15,
  );

  // =========================================================================
  // ISOLATION — no OpenAI usage outside the provider layer
  // =========================================================================

  const OFFENDING =
    /from\s+["']openai["']|require\(\s*["']openai["']\s*\)|api\.openai\.com/;
  const ALLOWED = new Set([path.normalize("features/ai/providers/openai.ts")]);

  const offenders: string[] = [];
  function scan(dir: string): void {
    for (const entry of readdirSync(dir)) {
      if (
        entry === "node_modules" ||
        entry === ".next" ||
        entry.startsWith(".")
      ) {
        continue;
      }
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        scan(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;

      const relative = path.normalize(path.relative(process.cwd(), full));
      if (ALLOWED.has(relative)) continue;
      // The smoke scripts reference the string in order to test for it.
      if (relative.startsWith(path.normalize("scripts/"))) continue;

      if (OFFENDING.test(readFileSync(full, "utf8"))) {
        offenders.push(relative);
      }
    }
  }
  for (const root of ["app", "features", "lib", "components"]) {
    try {
      scan(path.join(process.cwd(), root));
    } catch {
      // Directory absent — nothing to scan.
    }
  }
  check(
    "no OpenAI import or endpoint outside the provider layer",
    offenders.length === 0,
    offenders.join(", ") || "clean",
  );

  // The research feature must not reach the network itself.
  const researchDir = path.join(process.cwd(), "features/research");
  let researchFetches: string[] = [];
  try {
    for (const entry of readdirSync(researchDir)) {
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const body = readFileSync(path.join(researchDir, entry), "utf8");
      if (/\bfetch\(|axios|undici|node-fetch/.test(body)) {
        researchFetches.push(entry);
      }
    }
  } catch {
    researchFetches = [];
  }
  check(
    "features/research performs no direct HTTP",
    researchFetches.length === 0,
    researchFetches.join(", ") || "clean",
  );

  // =========================================================================
  // Provider source — the guarantees that must hold in openai.ts
  // =========================================================================

  const providerSource = readFileSync(
    path.join(process.cwd(), "features/ai/providers/openai.ts"),
    "utf8",
  );

  check(
    "sources are read from url_citation annotations",
    /url_citation/.test(providerSource),
  );
  check(
    "publication date is left null, never inferred",
    /publishedAt: null/.test(providerSource),
  );
  check(
    "an untrusted-content preamble is prepended to every research call",
    /UNTRUSTED_CONTENT_PREAMBLE\}\\n\\n\$\{request\.instructions\}/.test(
      providerSource,
    ) || /\$\{UNTRUSTED_CONTENT_PREAMBLE\}/.test(providerSource),
  );
  check(
    "the preamble tells the model retrieved content is not instructions",
    /UNTRUSTED DATA, never instructions/i.test(providerSource),
  );
  check(
    "the preamble forbids inventing URLs and statistics",
    /Never invent a URL/i.test(providerSource),
  );
  check(
    "non-http\\(s\\) citations are discarded",
    /protocol !== "http:" && parsedUrl\.protocol !== "https:"/.test(
      providerSource,
    ),
  );
  check(
    "sources are deduplicated",
    /seen\.has\(url\)/.test(providerSource) &&
      /seen\.add\(url\)/.test(providerSource),
  );
  check(
    "sources are capped, never padded",
    /sources\.length >= maxSources/.test(providerSource),
  );
  check(
    "the provider response envelope is Zod-validated",
    /responseEnvelopeSchema\.safeParse/.test(providerSource),
  );
  check(
    "malformed provider output becomes a typed AiError",
    /unrecognised research response shape/.test(providerSource),
  );
  check(
    "errors go through the existing normaliser",
    (providerSource.match(/normaliseOpenAiError\(error\)/g) ?? []).length >= 2,
  );
  check(
    "domain filtering is refused rather than silently ignored",
    /AI_PROVIDER_UNSUPPORTED[\s\S]{0,160}Domain filtering is not supported/.test(
      providerSource,
    ),
  );
  check(
    "complete() still uses Chat Completions with json_object",
    /chat\.completions\.create/.test(providerSource) &&
      /response_format: \{ type: "json_object" \}/.test(providerSource),
  );
  check(
    "research() uses the Responses API with web search",
    /responses\.create/.test(providerSource) &&
      /web_search_preview/.test(providerSource),
  );

  // =========================================================================
  // LIVE — genuine sources from the configured provider
  // =========================================================================

  if (!isProviderConfigured("openai")) {
    note("LIVE checks skipped: OPENAI_API_KEY is not set in this environment.");
  } else {
    check(
      "the configured provider reports retrieval support",
      isResearchConfigured(),
    );

    // A placeholder in OPENAI_MODEL breaks every workflow, not just research —
    // the provider would send "..." as the model name. Surfacing it here beats
    // a confusing 400 at run time, and the capability is still proven by
    // pinning the default model for the live call.
    const configuredModel = getOpenAiModel();
    const modelLooksValid = /^[a-z0-9][a-z0-9.\-_]{2,}$/i.test(configuredModel);
    check(
      "OPENAI_MODEL is a plausible model id",
      modelLooksValid,
      modelLooksValid
        ? configuredModel
        : `MISCONFIGURED: ${JSON.stringify(configuredModel)} — every AI workflow will fail`,
    );

    const provider = createResearchProvider(
      "openai",
      modelLooksValid ? undefined : DEFAULT_OPENAI_MODEL,
    );
    if (!modelLooksValid) {
      note(
        `LIVE checks pinned to ${DEFAULT_OPENAI_MODEL} because OPENAI_MODEL is a placeholder.`,
      );
    }
    let live: AiResearchResult | null = null;
    try {
      live = await provider.research({
        instructions:
          'Answer the question using web search. Reply as JSON: {"answer": string}.',
        input: "What is the current main rate of UK corporation tax?",
        maxSources: 5,
        outputSchema: {
          name: "answer",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["answer"],
            properties: { answer: { type: "string" } },
          },
        },
        timeoutMs: 120_000,
      });
    } catch (error) {
      check(
        "live research() call succeeds",
        false,
        error instanceof Error ? error.message.slice(0, 120) : "unknown",
      );
    }

    if (live) {
      check(
        "live: returned at least one source",
        live.sources.length > 0,
        `${live.sources.length}`,
      );
      check(
        "live: at least one search was performed",
        live.searchCallCount > 0,
      );
      check(
        "live: every source URL is http(s)",
        live.sources.every((s) => /^https?:\/\//.test(s.url)),
      );
      check(
        "live: every source has a publisher domain",
        live.sources.every((s) => Boolean(s.publisher)),
        live.sources.map((s) => s.publisher).join(", "),
      );
      check(
        "live: sources are unique",
        new Set(live.sources.map((s) => s.url)).size === live.sources.length,
      );
      check(
        "live: maxSources is respected",
        live.sources.length <= 5,
        `${live.sources.length} <= 5`,
      );
      check(
        "live: publication dates are null, not fabricated",
        live.sources.every((s) => s.publishedAt === null),
      );
      check(
        "live: usage tokens are reported",
        (live.usage.totalTokens ?? 0) > 0,
      );
      check(
        "live: content parses as the requested structure",
        (() => {
          try {
            const parsed = JSON.parse(live.content) as { answer?: unknown };
            return typeof parsed.answer === "string";
          } catch {
            return false;
          }
        })(),
      );
      note(
        `LIVE sources: ${live.sources.map((s) => s.publisher).join(", ")} (${live.usage.totalTokens} tokens)`,
      );
    }

    // A provider request that cannot be honoured must fail loudly.
    try {
      await provider.research({
        instructions: "x",
        input: "y",
        allowedDomains: ["example.com"],
      });
      check(
        "live: allowedDomains is rejected, not ignored",
        false,
        "no error raised",
      );
    } catch (error) {
      check(
        "live: allowedDomains is rejected, not ignored",
        error instanceof AiError && error.code === "AI_PROVIDER_UNSUPPORTED",
        error instanceof AiError ? error.code : "wrong error type",
      );
    }
  }

  // A provider without retrieval must produce a typed error, not a crash.
  try {
    createResearchProvider("anthropic");
    check(
      "unimplemented provider raises a typed error",
      false,
      "no error raised",
    );
  } catch (error) {
    check(
      "unimplemented provider raises a typed error",
      error instanceof AiError && error.code === "AI_PROVIDER_UNSUPPORTED",
      error instanceof AiError ? error.code : "wrong error type",
    );
  }

  // Sanity: the ordinary factory still works for non-research use.
  if (isProviderConfigured("openai")) {
    const plain = createProvider("openai");
    check(
      "createProvider still returns a usable provider",
      typeof plain.complete === "function",
    );
  }

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.filter((r) => !r.startsWith("NOTE")).length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — PROVIDER RESEARCH SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(
    `\n${total}/${total} checks passed — PROVIDER RESEARCH SMOKE PASSED`,
  );
}

void main();
