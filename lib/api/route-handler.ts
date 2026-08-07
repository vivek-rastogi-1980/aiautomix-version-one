import "server-only";

import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getUser } from "@/lib/auth/session";
import { apiError, logApiError, rateLimitOrError } from "@/lib/api/response";

/**
 * Authenticated REST route wrapper (API-STANDARDS.md).
 *
 * Every endpoint opened with the same four steps: resolve the user, 401 if
 * absent, apply the per-user rate limit, then run the body inside a try/catch
 * that logs and returns a 500. Eleven routes each spelled that out, which made
 * the preamble something a new endpoint had to *remember* rather than something
 * it got by construction — and a route that forgets it is unauthenticated or
 * unthrottled in production, not merely inconsistent.
 *
 * Wrapping it inverts that: `withApiAuth` cannot be used without supplying a
 * rate-limit scope, and the handler it wraps only ever runs for a signed-in
 * user. The behaviour, envelope, status codes and log format are unchanged —
 * this is the same code, hoisted.
 */

export interface ApiRouteContext<TParams> {
  /** Verified via Supabase Auth — never `null` inside a handler. */
  user: User;
  request: NextRequest;
  /** Resolved route params (Next 15 passes these as a promise). */
  params: TParams;
}

export interface ApiRouteConfig {
  /** Log/label prefix, e.g. `"GET /api/reports"`. */
  route: string;
  /** Rate-limit bucket, e.g. `"reports:list"`. Distinct per endpoint. */
  scope: string;
  /** User-facing message for an unhandled failure. */
  errorMessage: string;
}

type NextRouteHandler<TParams> = (
  request: NextRequest,
  context: { params: Promise<TParams> },
) => Promise<Response>;

/**
 * Wrap a handler with authentication, rate limiting and error handling.
 *
 * The handler may return any `Response`, so this works for both the JSON
 * endpoints and the PDF routes that stream a binary body.
 */
export function withApiAuth<TParams = Record<string, never>>(
  config: ApiRouteConfig,
  handler: (context: ApiRouteContext<TParams>) => Promise<Response>,
): NextRouteHandler<TParams> {
  return async (request, context) => {
    const user = await getUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "You must be signed in.", 401);
    }

    const limited = rateLimitOrError(user.id, config.scope);
    if (limited) return limited;

    try {
      const params = (await context?.params) ?? ({} as TParams);
      return await handler({ user, request, params });
    } catch (error) {
      logApiError(config.route, error);
      return apiError("INTERNAL_ERROR", config.errorMessage, 500);
    }
  };
}
