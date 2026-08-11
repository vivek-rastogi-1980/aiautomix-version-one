/**
 * The public URL surface, in one place.
 *
 * `sitemap.ts` and `robots.ts` both need to know which routes are public and
 * which are private, and they must not disagree — a route listed in the sitemap
 * but disallowed in robots is a crawl error, and a private route missing from
 * the disallow list leaks crawl budget. Declaring both here makes that
 * contradiction impossible to introduce by editing one file and forgetting the
 * other.
 *
 * News articles are deliberately not listed: they come from
 * `features/news/news-data.ts`, and the sitemap derives them so a new article
 * never needs a second edit here.
 */

/** Relative priority within the site. Not a ranking signal — a crawl hint. */
export interface PublicRoute {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}

/**
 * Ordered by commercial importance: the home page, then the service and
 * solution pages that carry the offer, then industries, then supporting pages.
 */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },

  // Core offer
  { path: "/services", priority: 0.9, changeFrequency: "monthly" },
  {
    path: "/ai-strategies-and-consulting",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  { path: "/ai-agents", priority: 0.9, changeFrequency: "monthly" },
  {
    path: "/ai-business-idea-validation",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  { path: "/validate-your-idea", priority: 0.9, changeFrequency: "monthly" },

  // Solutions
  { path: "/ai-chatbot", priority: 0.8, changeFrequency: "monthly" },
  { path: "/crm", priority: 0.8, changeFrequency: "monthly" },
  { path: "/generate-leads", priority: 0.8, changeFrequency: "monthly" },
  {
    path: "/create-a-business-plan",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  { path: "/create-marketing-plan", priority: 0.8, changeFrequency: "monthly" },
  { path: "/growth-plan", priority: 0.8, changeFrequency: "monthly" },
  { path: "/get-your-funding", priority: 0.8, changeFrequency: "monthly" },

  // Delivery services
  { path: "/website-development", priority: 0.7, changeFrequency: "monthly" },
  {
    path: "/saas-product-development",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/mobile-app-development",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  { path: "/landing-page-design", priority: 0.7, changeFrequency: "monthly" },

  // Industries
  {
    path: "/real-estate-ai-automation",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/hospital-ai-automation",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/restaurant-ai-automation",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/education-ai-automation",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  { path: "/travel-ai-automation", priority: 0.7, changeFrequency: "monthly" },

  // Supporting
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/news", priority: 0.6, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
];

/**
 * Route prefixes crawlers must not follow.
 *
 * These are all auth-gated, so a crawler receives a redirect rather than
 * content — but an unlisted private route still burns crawl budget and can be
 * indexed as a redirect-only URL. `/api` is listed because those endpoints
 * return JSON that has no business in a search index.
 */
export const PRIVATE_PREFIXES: string[] = [
  "/api/",
  "/dashboard",
  "/projects",
  "/plans",
  "/reports",
  "/validator",
  "/workspace",
  "/usage",
  "/diagnostics",
  "/admin",
  "/profile",
  "/settings",
  "/ai/history",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth/",
];
