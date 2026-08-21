import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { rateLimitApi } from "@/lib/rate-limit";

/**
 * Standard JSON envelope for the REST API (API-STANDARDS.md, JSON-SCHEMAS.md):
 *   success: { "success": true, "data": ... }
 *   failure: { "success": false, "error": { "code", "message" } }
 */

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    /** Field-level messages for validation failures. */
    fields?: Record<string, string>;
    /**
     * Structured context a client needs to render a specific screen, where a
     * message alone is not enough — an entitlement refusal, for instance,
     * needs the usage and the limit to draw a meaningful "3 of 3 used" panel.
     *
     * Never carries internal detail: only values the customer can already see
     * on their own usage page.
     */
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json<ApiSuccessBody<T>>(
    { success: true, data },
    { status },
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json<ApiErrorBody>(
    {
      success: false,
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

/**
 * 402 for a plan limit or a feature the plan does not include.
 *
 * 402 Payment Required rather than 403: the caller is authenticated and
 * authorised, and the only thing standing between them and the feature is a
 * commercial allowance. A 403 would tell a client "you may never do this",
 * which is wrong — next month, or one upgrade later, they may.
 */
export function apiEntitlementError(payload: {
  code: string;
  message: string;
  feature: string;
  reason: string;
  used: number | null;
  limit: number | null;
  plan: string | null;
  period: string;
}): NextResponse {
  const { code, message, ...details } = payload;
  return apiError(code, message, 402, undefined, details);
}

/** 422 response built from a Zod failure. */
export function apiValidationError(error: ZodError): NextResponse {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return apiError(
    "VALIDATION_FAILED",
    "The request body failed validation.",
    422,
    fields,
  );
}

/**
 * Apply the per-user API rate limit. Returns a 429 response when the budget is
 * exhausted, or `null` when the request may proceed.
 */
export function rateLimitOrError(
  userId: string,
  route: string,
): NextResponse | null {
  const result = rateLimitApi(userId, route);
  if (result.success) return null;

  const response = apiError(
    "RATE_LIMITED",
    "Too many requests. Please slow down.",
    429,
  );
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}

/** Consistent server-side log line for API failures. */
export function logApiError(route: string, error: unknown): void {
  console.error(`[api] ${route} failed`, error);
}
