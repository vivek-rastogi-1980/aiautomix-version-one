import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiRetrievedSource } from "@/features/ai/engine/types";
import type { Database } from "@/types/database";
import { AiError } from "@/features/ai/engine/errors";
import type { ResearchStage } from "@/features/research/types";
import type {
  PlanningOutput,
  DiscoveryOutput,
  CollectionOutput,
  EvidenceOutput,
  AnalysisOutput,
  SynthesisOutput,
  ReportOutput,
} from "@/features/research/stages/contracts";

/**
 * Bridges between stages: what a stage reads, and what its output becomes.
 *
 * Two rules shape everything here.
 *
 *   MINIMAL INPUTS. A stage receives only what it needs. Passing the whole
 *   accumulated research to every prompt would multiply cost by the number of
 *   stages for no analytical gain.
 *
 *   SOURCES COME FROM CITATIONS. `mapStageOutput` builds source rows from the
 *   provider's `sources` array, never from a URL the model wrote. Evidence is
 *   matched back to those URLs, and anything that does not match is dropped
 *   before it reaches the database.
 */

type Client = SupabaseClient<Database>;

export interface MappedStageOutput {
  results: unknown[];
  sources: unknown[];
  evidence: unknown[];
}

/**
 * Remove URLs from model-authored free text before it is persisted.
 *
 * The discovery prompt tells the model not to write URLs, and it mostly
 * complies — but "mostly" is not a guarantee, and live verification caught it
 * embedding links in its findings. Those strings are stored in
 * `research_results` and shown to users, so a hallucinated link would appear
 * beside genuine citations and be indistinguishable from them.
 *
 * The real sources live in `research_sources`, populated only from provider
 * citations. Stripping links from prose costs nothing and closes the gap
 * deterministically instead of relying on the model to behave.
 */
export function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>()\[\]"']+/gi, "[link removed - see sources]")
    .replace(/www\.[^\s<>()\[\]"']+/gi, "[link removed - see sources]");
}

/** Normalise a URL for deduplication: drop tracking params and fragments. */
export function canonicalise(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|fbclid$|gclid$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export async function buildStageInput(
  supabase: Client,
  requestId: string,
  stage: ResearchStage,
  depth: string,
): Promise<unknown> {
  const { data: request } = await supabase
    .from("research_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    throw new AiError("AI_INVALID_INPUT", "Research request not found.", false);
  }

  const { data: depthRow } = await supabase
    .from("research_depths")
    .select("max_sources")
    .eq("id", depth)
    .maybeSingle();
  const maxSources = depthRow?.max_sources ?? 20;

  // The plan is stored as a section result by the planning stage and re-read
  // by the stages that need it, rather than passed through the client.
  const plan = await readPlan(supabase, requestId);

  switch (stage) {
    case "planning":
      return {
        title: request.title,
        scope: request.scope ?? undefined,
        industry: request.industry ?? undefined,
        geography: request.geography ?? undefined,
        targetCustomer: request.target_customer ?? undefined,
        businessModel: request.business_model ?? undefined,
        questions: Array.isArray(request.questions) ? request.questions : [],
        depth,
      };

    case "discovery":
      return {
        researchQuestions: plan.researchQuestions,
        searchStrategies: plan.searchStrategies,
        industry: request.industry ?? undefined,
        geography: request.geography ?? undefined,
        maxSources,
      };

    case "collection": {
      const { data: sources } = await supabase
        .from("research_sources")
        .select("url, title")
        .eq("research_request_id", requestId)
        .limit(maxSources);
      return {
        researchQuestions: plan.researchQuestions,
        knownSources: (sources ?? []).map((s) => ({
          url: s.url,
          title: s.title,
        })),
        maxSources,
      };
    }

    case "evidence": {
      const { data: sources } = await supabase
        .from("research_sources")
        .select("url, title, publisher")
        .eq("research_request_id", requestId)
        .neq("status", "rejected")
        .limit(maxSources);

      if (!sources?.length) {
        throw new AiError(
          "AI_INVALID_INPUT",
          "No sources were retrieved, so no evidence can be extracted. Retry source discovery.",
          false,
        );
      }
      return { researchQuestions: plan.researchQuestions, sources };
    }

    case "analysis": {
      const { data: evidence } = await supabase
        .from("research_evidence")
        .select("section_key, claim, confidence, research_sources(url)")
        .eq("research_request_id", requestId)
        .limit(150);

      return {
        researchQuestions: plan.researchQuestions,
        evidence: (evidence ?? []).map((e) => {
          const joined = e as unknown as {
            section_key: string;
            claim: string;
            confidence: string;
            research_sources: { url: string } | null;
          };
          return {
            sectionKey: joined.section_key,
            claim: joined.claim,
            sourceUrl: joined.research_sources?.url ?? "",
            confidence: joined.confidence,
          };
        }),
        industry: request.industry ?? undefined,
        geography: request.geography ?? undefined,
      };
    }

    case "synthesis": {
      const sections = await readSections(supabase, requestId);
      const counts = await readCounts(supabase, requestId);
      return {
        sections,
        evidenceCount: counts.evidence,
        sourceCount: counts.sources,
      };
    }

    case "report": {
      const sections = await readSections(supabase, requestId);
      const counts = await readCounts(supabase, requestId);
      const synthesis = await readSynthesis(supabase, requestId);
      return {
        title: request.title,
        sections,
        synthesis,
        sourceCount: counts.sources,
        evidenceCount: counts.evidence,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export function mapStageOutput(
  stage: ResearchStage,
  data: unknown,
  providerSources: AiRetrievedSource[],
): MappedStageOutput {
  const empty: MappedStageOutput = { results: [], sources: [], evidence: [] };

  // Source rows are built ONLY from provider citations. This is the single
  // place sources enter the system, and the model's output is not consulted.
  const sourceRows = providerSources.map((source) => ({
    url: source.url,
    canonical_url: canonicalise(source.url),
    title: source.title,
    publisher: source.publisher,
    source_type: "web",
    published_at: source.publishedAt,
    status: "retrieved",
    metadata: {},
  }));

  switch (stage) {
    case "planning": {
      const out = data as PlanningOutput;
      return {
        ...empty,
        results: [
          {
            section_key: "scope_methodology",
            structured_content: out,
            confidence: "high",
            status: "complete",
          },
        ],
      };
    }

    case "discovery": {
      const out = data as DiscoveryOutput;
      return {
        results: [
          {
            section_key: "evidence_sources",
            structured_content: {
              // Prose is sanitised; the genuine URLs are in `sources` below.
              findings: out.findings.map((f) => ({
                ...f,
                summary: stripUrls(f.summary),
                relatesTo: f.relatesTo ? stripUrls(f.relatesTo) : undefined,
              })),
              queriesUsed: out.queriesUsed,
              notes: out.notes ? stripUrls(out.notes) : null,
            },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status: out.insufficientEvidence
              ? "insufficient_evidence"
              : "partial",
          },
        ],
        sources: sourceRows,
        evidence: [],
      };
    }

    case "collection": {
      const out = data as CollectionOutput;
      // Classifications are applied only to URLs the provider actually
      // returned; the canonical form is what the unique index matches on.
      const known = new Set(sourceRows.map((s) => s.canonical_url));
      const classified = out.classifications
        .filter((c) => known.has(canonicalise(c.url)))
        .map((c) => ({
          url: c.url,
          canonical_url: canonicalise(c.url),
          title: null,
          publisher: null,
          source_type: c.sourceType,
          published_at: c.publishedAt,
          status: "retrieved",
          metadata: { relevance: c.relevance },
        }));
      return {
        results: [],
        sources: [...sourceRows, ...classified],
        evidence: [],
      };
    }

    case "evidence": {
      const out = data as EvidenceOutput;
      return {
        results: [
          {
            section_key: "confidence_limitations",
            structured_content: {
              unsupportedClaims: out.unsupportedClaims,
              contradictions: out.contradictions,
            },
            confidence: out.evidence.length ? "medium" : "low",
            status: out.evidence.length ? "partial" : "insufficient_evidence",
          },
        ],
        sources: [],
        // `canonical_url` is how the SQL side resolves the source; an item that
        // resolves to nothing is dropped there rather than stored.
        evidence: out.evidence.map((e) => ({
          canonical_url: canonicalise(e.sourceUrl),
          section_key: e.sectionKey,
          claim: e.claim,
          evidence_reference: e.evidenceReference ?? null,
          confidence: e.confidence,
          is_contradictory: e.isContradictory,
        })),
      };
    }

    case "analysis": {
      const out = data as AnalysisOutput;
      return {
        ...empty,
        results: out.sections.map((section) => ({
          section_key: section.sectionKey,
          structured_content: {
            summary: section.summary,
            points: section.points,
          },
          confidence: section.confidence,
          status: section.insufficientEvidence
            ? "insufficient_evidence"
            : "complete",
        })),
      };
    }

    case "synthesis": {
      const out = data as SynthesisOutput;
      return {
        ...empty,
        results: [
          {
            section_key: "strategic_recommendations",
            structured_content: out,
            confidence: out.overallConfidence,
            status: "complete",
          },
        ],
      };
    }

    case "report": {
      const out = data as ReportOutput;
      return {
        ...empty,
        results: [
          {
            section_key: "executive_summary",
            structured_content: { text: out.executiveSummary },
            confidence: out.overallConfidence,
            status: "complete",
          },
          {
            section_key: "scope_methodology",
            structured_content: { text: out.scopeMethodology },
            confidence: "high",
            status: "complete",
          },
          {
            section_key: "evidence_sources",
            structured_content: { text: out.evidenceSummary },
            confidence: "high",
            status: "complete",
          },
          {
            section_key: "confidence_limitations",
            structured_content: { text: out.confidenceLimitations },
            confidence: out.overallConfidence,
            status: "complete",
          },
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

async function readPlan(
  supabase: Client,
  requestId: string,
): Promise<{ researchQuestions: string[]; searchStrategies: string[] }> {
  const { data } = await supabase
    .from("research_results")
    .select("structured_content")
    .eq("research_request_id", requestId)
    .eq("section_key", "scope_methodology")
    .eq("is_current", true)
    .maybeSingle();

  const content = (data?.structured_content ?? {}) as {
    researchQuestions?: string[];
    searchStrategies?: string[];
  };

  // A later stage cannot proceed without the plan; failing here is clearer
  // than sending an empty question list to the provider and paying for it.
  if (!content.researchQuestions?.length) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "The research plan is missing. Run the planning stage first.",
      false,
    );
  }

  return {
    researchQuestions: content.researchQuestions,
    searchStrategies: content.searchStrategies ?? content.researchQuestions,
  };
}

async function readSections(
  supabase: Client,
  requestId: string,
): Promise<{ sectionKey: string; summary: string }[]> {
  const { data } = await supabase
    .from("research_results")
    .select("section_key, structured_content")
    .eq("research_request_id", requestId)
    .eq("is_current", true);

  return (data ?? []).map((row) => {
    const content = row.structured_content as {
      summary?: string;
      text?: string;
    };
    return {
      sectionKey: row.section_key,
      // Trimmed: synthesis needs the gist of each section, not its full body.
      summary: (content?.summary ?? content?.text ?? "").slice(0, 1200),
    };
  });
}

async function readSynthesis(
  supabase: Client,
  requestId: string,
): Promise<{
  majorFindings: string[];
  uncertainties: string[];
  overallConfidence: string;
}> {
  const { data } = await supabase
    .from("research_results")
    .select("structured_content")
    .eq("research_request_id", requestId)
    .eq("section_key", "strategic_recommendations")
    .eq("is_current", true)
    .maybeSingle();

  const content = (data?.structured_content ?? {}) as {
    majorFindings?: string[];
    uncertainties?: string[];
    overallConfidence?: string;
  };

  return {
    majorFindings: content.majorFindings ?? [],
    uncertainties: content.uncertainties ?? [],
    overallConfidence: content.overallConfidence ?? "low",
  };
}

async function readCounts(
  supabase: Client,
  requestId: string,
): Promise<{ sources: number; evidence: number }> {
  const [sources, evidence] = await Promise.all([
    supabase
      .from("research_sources")
      .select("id", { count: "exact", head: true })
      .eq("research_request_id", requestId),
    supabase
      .from("research_evidence")
      .select("id", { count: "exact", head: true })
      .eq("research_request_id", requestId),
  ]);
  return { sources: sources.count ?? 0, evidence: evidence.count ?? 0 };
}
