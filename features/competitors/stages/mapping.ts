import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiRetrievedSource } from "@/features/ai/engine/types";
import type { Database } from "@/types/database";
import { AiError } from "@/features/ai/engine/errors";
import type { CompetitorStage } from "@/features/competitors/types";
import { isPresentable } from "@/features/competitors/types";
import type {
  PlanningOutput,
  DiscoveryOutput,
  VerificationOutput,
  ProfilingOutput,
  PricingOutput,
  AnalysisOutput,
  RecommendationsOutput,
} from "@/features/competitors/stages/contracts";

/**
 * What each stage reads, and what its output becomes.
 *
 * Two rules shape everything here, and they are the reason this module exists
 * rather than each stage writing its own rows.
 *
 *   MINIMAL INPUTS. A stage receives only what it needs. Passing the whole
 *   accumulated project to every prompt would multiply cost by the number of
 *   stages for no analytical gain, and would push later stages past the context
 *   window on a deep run.
 *
 *   COMPETITORS AND SOURCES COME FROM CITATIONS. `mapStageOutput` builds source
 *   rows from the provider's `sources` array, and keeps a discovered competitor
 *   only when its domain matches a host the search actually returned. A company
 *   the model composed does not survive this function, so it never reaches the
 *   database, the report or the PDF.
 */

type Client = SupabaseClient<Database>;

export interface MappedStageOutput {
  results: unknown[];
  sources: unknown[];
  competitors: unknown[];
  evidence: unknown[];
  /** Candidates dropped because no citation backed them. Surfaced to the user. */
  discardedCandidates: string[];
}

const EMPTY: MappedStageOutput = {
  results: [],
  sources: [],
  competitors: [],
  evidence: [],
  discardedCandidates: [],
};

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Remove URLs from model-authored free text before it is persisted.
 *
 * The prompts tell the model not to write URLs, and it mostly complies — but
 * "mostly" is not a guarantee. These strings are stored and shown to users, so
 * a hallucinated link would sit beside genuine citations and be
 * indistinguishable from them. The real sources live in `competitor_sources`,
 * populated only from provider citations.
 */
export function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>()[\]"']+/gi, "[link removed - see sources]")
    .replace(/www\.[^\s<>()[\]"']+/gi, "[link removed - see sources]");
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

/** Bare host, lowercased, `www.` stripped. The competitor dedup key. */
export function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Does a model-reported domain correspond to a host the search returned?
 *
 * Accepts an exact host match or a subdomain of a cited host, because a search
 * result on `help.example.com` is genuine evidence that `example.com` exists.
 * It does NOT accept the reverse, and it does not accept a suffix match:
 * `notexample.com` must not be satisfied by a citation on `example.com`.
 */
export function matchCitedHost(
  domain: string,
  citedHosts: Set<string>,
): string | null {
  const needle = domain.toLowerCase().replace(/^www\./, "");
  if (citedHosts.has(needle)) return needle;

  for (const host of citedHosts) {
    if (host.endsWith(`.${needle}`) || needle.endsWith(`.${host}`)) {
      return host;
    }
  }
  return null;
}

function sourceRowsFrom(providerSources: AiRetrievedSource[]): unknown[] {
  return providerSources.map((source) => ({
    url: source.url,
    canonical_url: canonicalise(source.url),
    title: source.title,
    publisher: source.publisher,
    source_type: "web",
    published_at: source.publishedAt,
    status: "retrieved",
    metadata: {},
  }));
}

/** First citation whose host matches, so a competitor gets a real URL. */
function citationFor(
  domain: string,
  providerSources: AiRetrievedSource[],
): AiRetrievedSource | undefined {
  const needle = domain.toLowerCase().replace(/^www\./, "");
  return providerSources.find((source) => {
    const host = hostOf(source.url);
    return host === needle || host?.endsWith(`.${needle}`);
  });
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export async function buildStageInput(
  supabase: Client,
  projectId: string,
  stage: CompetitorStage,
  depth: string,
): Promise<unknown> {
  const { data: project } = await supabase
    .from("competitor_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "Competitor project not found.",
      false,
    );
  }

  const { data: depthRow } = await supabase
    .from("competitor_depths")
    .select("max_competitors, max_sources")
    .eq("id", depth)
    .maybeSingle();

  const maxCompetitors = depthRow?.max_competitors ?? 10;
  const maxSources = depthRow?.max_sources ?? 30;

  const knownCompetitors = Array.isArray(project.known_competitors)
    ? (project.known_competitors as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  // The plan is stored as a section result by the planning stage and re-read by
  // the stages that need it, rather than passed through the client.
  const plan =
    stage === "planning" ? null : await readPlan(supabase, projectId);

  switch (stage) {
    case "planning":
      return {
        title: project.title,
        description: project.description ?? undefined,
        category: project.category ?? undefined,
        geography: project.geography ?? undefined,
        targetCustomer: project.target_customer ?? undefined,
        customerProblem: project.customer_problem ?? undefined,
        businessModel: project.business_model ?? undefined,
        knownCompetitors,
        depth,
        maxCompetitors,
      };

    case "discovery":
      return {
        businessCategory: plan!.businessCategory,
        productCategory: plan!.productCategory,
        geography: plan!.geography,
        targetCustomer: plan!.targetCustomer,
        directCriteria: plan!.directCriteria,
        indirectCriteria: plan!.indirectCriteria,
        searchStrategies: plan!.searchStrategies,
        knownCompetitors,
        maxCompetitors,
        maxSources,
      };

    case "verification": {
      const candidates = await readCompetitors(
        supabase,
        projectId,
        maxCompetitors,
      );
      if (!candidates.length) {
        throw new AiError(
          "AI_INVALID_INPUT",
          "No competitor candidates were discovered, so there is nothing to verify. Retry discovery, or widen the criteria.",
          false,
        );
      }
      return {
        directCriteria: plan!.directCriteria,
        indirectCriteria: plan!.indirectCriteria,
        geography: plan!.geography,
        targetCustomer: plan!.targetCustomer,
        candidates: candidates.map((c) => ({
          name: c.name,
          domain: c.canonical_domain,
        })),
      };
    }

    case "profiling": {
      // Only competitors worth profiling. Spending a profiling call on a
      // company that could not be verified is spending credits to describe
      // something that may not exist.
      const competitors = await readCompetitors(
        supabase,
        projectId,
        maxCompetitors,
        true,
      );
      if (!competitors.length) {
        throw new AiError(
          "AI_INVALID_INPUT",
          "No competitor was verified, so there is nothing to profile. Retry verification, or widen the research scope.",
          false,
        );
      }
      return {
        targetCustomer: plan!.targetCustomer,
        productCategory: plan!.productCategory,
        competitors: competitors.map((c) => ({
          domain: c.canonical_domain,
          name: c.name,
          status: c.verification_status,
        })),
        evidence: await readEvidence(supabase, projectId),
      };
    }

    case "pricing_positioning": {
      const competitors = await readCompetitors(
        supabase,
        projectId,
        maxCompetitors,
        true,
      );
      if (!competitors.length) {
        throw new AiError(
          "AI_INVALID_INPUT",
          "No verified competitor to price. Retry verification first.",
          false,
        );
      }
      return {
        competitors: competitors.map((c) => ({
          domain: c.canonical_domain,
          name: c.name,
        })),
        targetCustomer: plan!.targetCustomer,
        maxSources,
      };
    }

    case "analysis": {
      const competitors = await readCompetitors(
        supabase,
        projectId,
        maxCompetitors,
        true,
      );
      if (!competitors.length) {
        throw new AiError(
          "AI_INVALID_INPUT",
          "No verified competitor to analyse.",
          false,
        );
      }
      return {
        productCategory: plan!.productCategory,
        targetCustomer: plan!.targetCustomer,
        ownBusiness: `${project.title}. ${project.description ?? ""}`.slice(
          0,
          4000,
        ),
        competitors: competitors.map((c) => ({
          domain: c.canonical_domain,
          name: c.name,
          competitorType: c.competitor_type,
          profile: JSON.stringify(c.profile ?? {}).slice(0, 3000),
          pricing: JSON.stringify(c.pricing ?? {}).slice(0, 2000),
        })),
        evidence: await readEvidence(supabase, projectId),
      };
    }

    case "recommendations": {
      const competitors = await readCompetitors(
        supabase,
        projectId,
        maxCompetitors,
      );
      const verified = competitors.filter((c) =>
        isPresentable(c.verification_status as never),
      );
      const gaps = await readGaps(supabase, projectId);

      return {
        productCategory: plan!.productCategory,
        targetCustomer: plan!.targetCustomer,
        ownBusiness: `${project.title}. ${project.description ?? ""}`.slice(
          0,
          4000,
        ),
        gaps,
        competitorSummary: verified
          .map(
            (c) =>
              `${c.name} (${c.competitor_type}): ${JSON.stringify(c.profile ?? {}).slice(0, 400)}`,
          )
          .join("\n")
          .slice(0, 6000),
        competitorCount: competitors.length,
        verifiedCount: verified.length,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export function mapStageOutput(
  stage: CompetitorStage,
  data: unknown,
  providerSources: AiRetrievedSource[],
): MappedStageOutput {
  const sources = sourceRowsFrom(providerSources);
  const citedHosts = new Set(
    providerSources
      .map((source) => hostOf(source.url))
      .filter((host): host is string => host !== null),
  );

  switch (stage) {
    case "planning": {
      const out = data as PlanningOutput;
      return {
        ...EMPTY,
        results: [
          {
            section_key: "research_scope",
            structured_content: out,
            confidence: "high",
            status: "complete",
          },
        ],
      };
    }

    case "discovery": {
      const out = data as DiscoveryOutput;
      const discarded: string[] = [];
      const competitors: unknown[] = [];

      for (const candidate of out.candidates) {
        // THE fabrication control for this feature. A candidate whose domain
        // does not correspond to a host the provider actually cited is dropped
        // — not stored with low confidence, not flagged for review. It never
        // becomes a row, so no later stage can promote it.
        const matched = matchCitedHost(candidate.domain, citedHosts);
        if (!matched) {
          discarded.push(candidate.name);
          continue;
        }

        const citation = citationFor(matched, providerSources);
        competitors.push({
          name: candidate.name,
          // The URL comes from the citation record, never from the model.
          website: citation?.url ?? null,
          canonical_domain: matched,
          competitor_type: candidate.competitorType,
          verification_status: "PENDING",
          confidence: "low",
          relevance: candidate.relevance ?? null,
          profile: { offering: stripUrls(candidate.offering) },
        });
      }

      return {
        results: [
          {
            section_key: "competitor_landscape",
            structured_content: {
              queriesUsed: out.queriesUsed,
              notes: out.notes ? stripUrls(out.notes) : null,
              candidatesFound: competitors.length,
              candidatesDiscarded: discarded.length,
            },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status:
              out.insufficientEvidence || competitors.length === 0
                ? "insufficient_evidence"
                : "partial",
          },
        ],
        sources,
        competitors,
        evidence: out.candidates
          .filter((c) => matchCitedHost(c.domain, citedHosts))
          .map((c) => {
            const matched = matchCitedHost(c.domain, citedHosts)!;
            const citation = citationFor(matched, providerSources);
            return {
              canonical_url: citation ? canonicalise(citation.url) : "",
              canonical_domain: matched,
              section_key: "competitor_landscape",
              claim: stripUrls(`${c.name}: ${c.offering}`),
              evidence_reference: stripUrls(c.relevanceReason),
              // Discovery reads a search result. That is an observation about
              // a page, not the company's own statement.
              claim_kind: "OBSERVED",
              confidence: "low",
              is_contradictory: false,
            };
          })
          .filter((e) => e.canonical_url !== ""),
        discardedCandidates: discarded,
      };
    }

    case "verification": {
      const out = data as VerificationOutput;
      return {
        results: [
          {
            section_key: "competitor_landscape",
            structured_content: {
              verified: out.verdicts.filter((v) => v.status === "VERIFIED")
                .length,
              partial: out.verdicts.filter(
                (v) => v.status === "PARTIALLY_VERIFIED",
              ).length,
              unverified: out.verdicts.filter((v) => v.status === "UNVERIFIED")
                .length,
            },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status: out.insufficientEvidence
              ? "insufficient_evidence"
              : "partial",
          },
        ],
        sources,
        // Verification updates existing rows. `competitor_complete_stage`
        // upserts on (project, domain), and a verdict for a domain that was
        // never discovered simply creates nothing useful — it carries no name.
        competitors: out.verdicts.map((v) => ({
          name: "",
          canonical_domain: v.domain,
          competitor_type: v.competitorType,
          verification_status: v.status,
          verification_notes: stripUrls(v.notes),
          confidence: v.confidence,
        })),
        evidence: [],
        discardedCandidates: [],
      };
    }

    case "profiling": {
      const out = data as ProfilingOutput;
      return {
        results: [
          {
            section_key: "competitor_profiles",
            structured_content: { profiled: out.profiles.length },
            confidence: "medium",
            status: out.profiles.length ? "complete" : "insufficient_evidence",
          },
        ],
        sources: [],
        competitors: out.profiles.map((profile) => ({
          name: "",
          canonical_domain: profile.domain,
          confidence: profile.confidence,
          profile: {
            description: profile.description,
            targetCustomer: profile.targetCustomer,
            geography: profile.geography,
            productService: profile.productService,
            businessModel: profile.businessModel,
            valueProposition: profile.valueProposition,
            features: profile.features,
            integrations: profile.integrations,
            strengths: profile.strengths,
            weaknesses: profile.weaknesses,
          },
        })),
        evidence: [],
        discardedCandidates: [],
      };
    }

    case "pricing_positioning": {
      const out = data as PricingOutput;
      return {
        results: [
          {
            section_key: "pricing_comparison",
            structured_content: {
              priced: out.entries.length,
              // How many actually published a price, as opposed to being asked.
              disclosed: out.entries.filter((e) => e.pricing.plans.length > 0)
                .length,
            },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status: out.insufficientEvidence
              ? "insufficient_evidence"
              : "complete",
          },
        ],
        sources,
        competitors: out.entries.map((entry) => ({
          name: "",
          canonical_domain: entry.domain,
          confidence: entry.confidence,
          pricing: entry.pricing,
          positioning: entry.positioning,
        })),
        // A headline the company wrote about itself is STATED; a positioning
        // AIAutoMix summarised is INFERRED. The distinction is carried from the
        // model's own `basis` field rather than assumed.
        evidence: out.entries
          .filter(
            (entry) =>
              typeof entry.positioning.headline === "string" &&
              entry.positioning.headline.length > 0,
          )
          .map((entry) => {
            const citation = citationFor(entry.domain, providerSources);
            return {
              canonical_url: citation ? canonicalise(citation.url) : "",
              canonical_domain: entry.domain,
              section_key: "positioning_analysis",
              claim: stripUrls(String(entry.positioning.headline)),
              evidence_reference: null,
              claim_kind:
                entry.positioning.basis === "OBSERVED" ? "STATED" : "INFERRED",
              confidence: entry.confidence,
              is_contradictory: false,
            };
          })
          .filter((e) => e.canonical_url !== ""),
        discardedCandidates: [],
      };
    }

    case "analysis": {
      const out = data as AnalysisOutput;
      return {
        ...EMPTY,
        results: [
          {
            section_key: "feature_comparison",
            structured_content: { matrix: out.matrix },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status: out.matrix.length ? "complete" : "insufficient_evidence",
          },
          {
            section_key: "market_gaps",
            structured_content: { gaps: out.gaps },
            confidence: "low",
            status: out.gaps.length ? "partial" : "insufficient_evidence",
          },
          {
            section_key: "competitor_landscape",
            structured_content: {
              summary: stripUrls(out.summary),
              landscape: out.landscapeAvailable ? out.landscape : [],
              landscapeAvailable: out.landscapeAvailable,
            },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status: out.insufficientEvidence
              ? "insufficient_evidence"
              : "complete",
          },
          {
            section_key: "strengths_weaknesses",
            structured_content: { derivedFromProfiles: true },
            confidence: "medium",
            status: "complete",
          },
        ],
      };
    }

    case "recommendations": {
      const out = data as RecommendationsOutput;
      return {
        ...EMPTY,
        results: [
          {
            section_key: "executive_summary",
            structured_content: { text: stripUrls(out.executiveSummary) },
            confidence: out.overallConfidence,
            status: "complete",
          },
          {
            section_key: "strategic_recommendations",
            structured_content: { recommendations: out.recommendations },
            confidence: out.overallConfidence,
            status: "complete",
          },
          {
            section_key: "differentiation_opportunities",
            structured_content: {
              opportunities: out.differentiationOpportunities,
            },
            confidence: out.overallConfidence,
            status: out.differentiationOpportunities.length
              ? "complete"
              : "insufficient_evidence",
          },
          {
            section_key: "sources_limitations",
            structured_content: { limitations: out.limitations },
            confidence: "high",
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

interface StoredPlan {
  businessCategory: string;
  productCategory: string;
  geography: string;
  targetCustomer: string;
  directCriteria: string[];
  indirectCriteria: string[];
  searchStrategies: string[];
}

async function readPlan(
  supabase: Client,
  projectId: string,
): Promise<StoredPlan> {
  const { data } = await supabase
    .from("competitor_results")
    .select("structured_content")
    .eq("project_id", projectId)
    .eq("section_key", "research_scope")
    .eq("is_current", true)
    .maybeSingle();

  const content = (data?.structured_content ?? {}) as Partial<StoredPlan>;

  // A later stage cannot proceed without the plan. Failing here is clearer
  // than sending empty criteria to the provider and paying for the result.
  if (!content.directCriteria?.length || !content.searchStrategies?.length) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "The competitor plan is missing. Run the planning stage first.",
      false,
    );
  }

  return {
    businessCategory: content.businessCategory ?? "not specified",
    productCategory: content.productCategory ?? "not specified",
    geography: content.geography ?? "not specified",
    targetCustomer: content.targetCustomer ?? "not specified",
    directCriteria: content.directCriteria,
    indirectCriteria: content.indirectCriteria ?? content.directCriteria,
    searchStrategies: content.searchStrategies,
  };
}

async function readCompetitors(
  supabase: Client,
  projectId: string,
  limit: number,
  presentableOnly = false,
) {
  let query = supabase
    .from("competitors")
    .select(
      "id, name, canonical_domain, competitor_type, verification_status, profile, pricing",
    )
    .eq("project_id", projectId)
    .order("relevance", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (presentableOnly) {
    query = query.in("verification_status", ["VERIFIED", "PARTIALLY_VERIFIED"]);
  }

  const { data } = await query;
  return data ?? [];
}

async function readEvidence(supabase: Client, projectId: string) {
  const { data } = await supabase
    .from("competitor_evidence")
    .select(
      "claim, claim_kind, competitors(canonical_domain), competitor_sources(url)",
    )
    .eq("project_id", projectId)
    .limit(200);

  return (data ?? []).map((row) => {
    const joined = row as unknown as {
      claim: string;
      claim_kind: string;
      competitors: { canonical_domain: string } | null;
      competitor_sources: { url: string } | null;
    };
    return {
      domain: joined.competitors?.canonical_domain ?? null,
      claim: joined.claim,
      kind: joined.claim_kind,
      sourceUrl: joined.competitor_sources?.url ?? "",
    };
  });
}

async function readGaps(supabase: Client, projectId: string) {
  const { data } = await supabase
    .from("competitor_results")
    .select("structured_content")
    .eq("project_id", projectId)
    .eq("section_key", "market_gaps")
    .eq("is_current", true)
    .maybeSingle();

  const content = (data?.structured_content ?? {}) as {
    gaps?: { kind?: string; summary?: string }[];
  };

  return (content.gaps ?? [])
    .filter((gap) => typeof gap.summary === "string")
    .map((gap) => ({ kind: gap.kind ?? "feature", summary: gap.summary! }));
}
