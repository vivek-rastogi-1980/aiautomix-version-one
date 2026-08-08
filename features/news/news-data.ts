/**
 * News articles.
 *
 * Kept as typed module data rather than a database table on purpose: news is
 * marketing content that changes on a publish cadence, not user data, so it
 * wants to be statically rendered, version-controlled and reviewable in a pull
 * request. Both `/news` and `/news/[slug]` read from here, so the listing and
 * the article can never disagree about a title or date.
 *
 * When editorial volume outgrows this — or a non-engineer needs to publish —
 * swap this module for a CMS fetch. The two views only depend on the exported
 * shapes below, so nothing else has to change.
 */

export interface NewsSection {
  heading: string;
  /** Each string renders as its own paragraph. */
  paragraphs: string[];
}

export interface NewsArticle {
  /** URL segment — must stay stable once published; it is the permalink. */
  slug: string;
  title: string;
  /** One-sentence summary, used on the card and as the meta description. */
  excerpt: string;
  /** ISO date. Rendered in UTC via `lib/format` so SSR and client agree. */
  date: string;
  category: NewsCategory;
  readingMinutes: number;
  author: string;
  sections: NewsSection[];
}

export type NewsCategory = "Product" | "Company" | "Engineering" | "Industry";

/** Accent per category, reused by the card badge and the article header. */
export const CATEGORY_ACCENT: Record<NewsCategory, string> = {
  Product: "#7C5CFF",
  Company: "#F0219E",
  Engineering: "#3BC9DB",
  Industry: "#57F2A4",
};

/** Newest first. The views rely on this order rather than re-sorting. */
export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: "business-plan-generator-launch",
    title: "The Business Plan Generator is live",
    excerpt:
      "Describe your business once and get an eleven-section plan you can edit, version and export — built entirely on our AI platform.",
    date: "2026-08-04T09:00:00.000Z",
    category: "Product",
    readingMinutes: 4,
    author: "AIAutomix Team",
    sections: [
      {
        heading: "One brief, eleven sections",
        paragraphs: [
          "The Business Plan Generator turns a single structured brief into a complete plan: executive summary, market analysis, customer persona, competition, business model, marketing, operations, financials, funding, risks and roadmap.",
          "You are not handed a document and left to argue with it. Every section is editable in place, and every save appends a revision rather than overwriting one — so you can rewrite the financials, decide the earlier version was better, and restore it.",
        ],
      },
      {
        heading: "Built on the platform, not beside it",
        paragraphs: [
          "The interesting part is what we did not build. The generator contributes an input schema, a versioned prompt, an output schema and a section catalog. Execution, retries, response validation, history, usage tracking, HTML rendering and PDF export all came from the AI platform we extracted in the previous release.",
          "That is the whole point of a platform: the second product should cost a fraction of the first. Adding an AI feature here now means supplying four things and inheriting the rest.",
        ],
      },
      {
        heading: "Export that matches the screen",
        paragraphs: [
          "A plan is described once as a document model, and the same model drives both the on-screen report and the branded A4 PDF. The two cannot drift, because there is no second implementation to drift from.",
        ],
      },
    ],
  },
  {
    slug: "workspaces-foundation",
    title: "Workspaces: the foundation for working together",
    excerpt:
      "Every account now has a workspace with a real role model — Owner, Admin, Member and Viewer — enforced in the database rather than the interface.",
    date: "2026-07-28T09:00:00.000Z",
    category: "Product",
    readingMinutes: 3,
    author: "AIAutomix Team",
    sections: [
      {
        heading: "Why now, before collaboration ships",
        paragraphs: [
          "Retrofitting multi-tenancy onto a single-user product is one of the most expensive migrations a SaaS can attempt. So we did the schema first: workspaces, members and roles landed before any invitation flow exists.",
          "Every account already has a personal workspace, created automatically. Your projects, ideas, plans and reports live inside it. Nothing about your day-to-day changed — which is exactly the outcome we wanted.",
        ],
      },
      {
        heading: "The database is the enforcement point",
        paragraphs: [
          "Roles are enforced by PostgreSQL row-level security through membership helpers, not by hiding buttons. The interface mirrors those same rules so you are not offered actions you cannot take, but if the two ever disagree, the database wins.",
          "That distinction matters. UI-level permissions are a usability feature; database-level permissions are a security boundary. We wanted the boundary in place before anyone else could join a workspace.",
        ],
      },
    ],
  },
  {
    slug: "ai-platform-core",
    title: "Why we stopped writing AI features and built a platform",
    excerpt:
      "One workflow engine, one prompt registry, one validator, one renderer — and no feature that talks to a model provider directly.",
    date: "2026-07-14T09:00:00.000Z",
    category: "Engineering",
    readingMinutes: 6,
    author: "AIAutomix Engineering",
    sections: [
      {
        heading: "The second feature is where you find out",
        paragraphs: [
          "Our first AI feature, the Business Idea Validator, worked well. Building the second one revealed how much of it was not really about business ideas: calling a provider, retrying a timeout, repairing not-quite-JSON, validating the shape, recording what it cost, rendering it, exporting it.",
          "Copying that into a second feature would have been the beginning of two subtly different implementations. So we extracted it instead.",
        ],
      },
      {
        heading: "One pipeline, no exceptions",
        paragraphs: [
          "Every AI run now follows the same path: input validation, rate limiting, provider selection, prompt loading, execution, JSON validation with repair and retry, persistence, usage tracking.",
          "A feature cannot skip a stage, because none of the stages are the feature's to call. There is exactly one module that constructs a model client, and exactly one function that runs a workflow.",
        ],
      },
      {
        heading: "Prompts are versioned files, not strings",
        paragraphs: [
          "Prompts live as markdown files under version control, each with a version and a checksum. Every run records which prompt version produced it.",
          "When output quality shifts, the question 'what changed?' has an answer you can look up rather than reconstruct.",
        ],
      },
    ],
  },
  {
    slug: "idea-validator-launch",
    title: "Validate a business idea in under a minute",
    excerpt:
      "Submit a structured idea and get a scored, sectioned analysis — SWOT, revenue models, risks and a next-steps timeline — as a report or branded PDF.",
    date: "2026-06-30T09:00:00.000Z",
    category: "Product",
    readingMinutes: 3,
    author: "AIAutomix Team",
    sections: [
      {
        heading: "Structured in, structured out",
        paragraphs: [
          "The validator asks for eight required fields and three optional ones. That structure is the point: a vague prompt produces a vague answer, and most idea-validation tools fail at the input stage rather than the model stage.",
          "What comes back is a weighted score with a visible breakdown, so you can see which dimension dragged the total down instead of arguing with a single number.",
        ],
      },
      {
        heading: "A report you can actually send",
        paragraphs: [
          "Every validation renders as a full report in the app and exports as a branded A4 PDF with a cover page, running header and page numbers — the kind of thing you can attach to an email without apologising for it.",
        ],
      },
    ],
  },
  {
    slug: "why-ai-automation-matters-for-smbs",
    title: "Automation is no longer an enterprise advantage",
    excerpt:
      "The tooling gap between a ten-person business and a ten-thousand-person one has collapsed faster than most operators realise.",
    date: "2026-06-16T09:00:00.000Z",
    category: "Industry",
    readingMinutes: 5,
    author: "AIAutomix Team",
    sections: [
      {
        heading: "What changed",
        paragraphs: [
          "For most of the last two decades, serious automation meant a systems integrator, a six-figure budget and a nine-month timeline. That was a structural advantage for large companies, and it held regardless of how good the smaller competitor was.",
          "That advantage has thinned considerably. The same capabilities now arrive as software you configure in an afternoon.",
        ],
      },
      {
        heading: "Where the advantage moved",
        paragraphs: [
          "It moved to clarity. When capability is cheap and widely available, the constraint becomes knowing precisely which problem to point it at.",
          "The businesses getting the most out of automation are not the ones with the largest budgets. They are the ones that can describe their own operations accurately enough to automate a specific step, measure whether it helped, and move to the next one.",
        ],
      },
    ],
  },
];

/** Look up one article. Returns `undefined` for an unknown slug (→ 404). */
export function getArticle(slug: string): NewsArticle | undefined {
  return NEWS_ARTICLES.find((article) => article.slug === slug);
}
