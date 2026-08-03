import "server-only";

/**
 * Fixed-window, in-memory rate limiter (API-STANDARDS.md, OPENAI-INTEGRATION.md).
 *
 * Generic infrastructure: the AI Platform uses it for workflow runs and the REST
 * layer uses it for plain read/write endpoints. It lives in `lib/` rather than
 * `features/ai/` so the API layer never has to import from a feature.
 *
 * Sized for a single Node instance. A shared store (Upstash/Redis) is the
 * natural upgrade once the app runs on more than one instance — the call sites
 * do not need to change.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
}

/** Opportunistically drop expired windows so the map cannot grow unbounded. */
function sweep(now: number): void {
  if (windows.size < 512) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** AI workflow runs are expensive — keep the per-user budget conservative. */
export const AI_RUN_LIMIT = 10;
export const AI_RUN_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function rateLimitAiRun(userId: string): RateLimitResult {
  return rateLimit(`ai-run:${userId}`, AI_RUN_LIMIT, AI_RUN_WINDOW_MS);
}

/** Lighter budget for plain read/write API endpoints. */
export function rateLimitApi(userId: string, route: string): RateLimitResult {
  return rateLimit(`api:${route}:${userId}`, 60, 60 * 1000);
}
