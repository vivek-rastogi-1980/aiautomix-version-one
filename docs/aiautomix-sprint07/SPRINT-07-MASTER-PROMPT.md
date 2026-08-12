# SPRINT 07 MASTER EXECUTION PROMPT

## ROLE
Act as Principal SaaS Architect, Staff Next.js Engineer, TypeScript Engineer, Supabase/PostgreSQL Engineer, Security Engineer and CTO for AIAutomix.

## MISSION
Implement Sprint 7 — Admin & Operations Platform.

Build a secure internal control center for operating AIAutomix.

## READ FIRST
Read all authoritative project documentation and all Sprint 6.5 commercial documents before changing code. Inspect the actual repository and current origin/main. Do not trust previous summaries.

## BASELINE
Run the actual typecheck, lint, tests and production build. Record baseline results.

## PHASE 1 — ADMIN AUTHENTICATION
Create a protected /admin area. Authorization must be server-side. Do not rely on hidden navigation. Unauthenticated users must not access admin APIs or pages.

## PHASE 2 — RBAC
Implement SUPER_ADMIN, ADMIN, SUPPORT and ANALYST with centralized permission definitions:
- users.read
- users.manage
- workspaces.read
- workspaces.manage
- ai.read
- usage.read
- credits.read
- credits.adjust
- plans.read
- plans.manage
- entitlements.read
- entitlements.manage
- audit.read
- system.read

Never authorize using email addresses or scattered boolean checks.

## PHASE 3 — ADMIN LAYOUT
Create responsive sidebar, header, breadcrumbs, role indicator, search where useful and safe action confirmations. Follow the existing AIAutomix design system.

## PHASE 4 — DASHBOARD
Implement /admin with real operational KPIs. Do not invent analytics. If a metric is unavailable, label it unavailable.

## PHASE 5 — USERS
Implement search, filters, pagination, details, workspace memberships, usage, credits and subscription. Do not implement impersonation. Avoid destructive operations.

## PHASE 6 — WORKSPACES
Implement search, filters, pagination, details, members, plan, subscription, credits, usage and projects. Prefer suspend/restore over deletion.

## PHASE 7 — AI OPERATIONS
Implement AI request list, status/workflow/model filters, date range, request detail, failure detail and usage/token information. Never expose API keys or provider credentials. Redact sensitive prompts/responses where necessary.

## PHASE 8 — CREDITS
Implement balance view, transaction ledger, grant, adjustment and refund. Every manual mutation requires a reason and creates an audit event. Use the existing atomic credit engine; never update balances directly from the UI.

## PHASE 9 — PLANS & ENTITLEMENTS
Use the Sprint 6.5 commercial architecture. Do not duplicate plan logic. Validate changes server-side and audit entitlement changes.

## PHASE 10 — AUDIT LOGS
Use an append-oriented admin audit log containing actor, role, action, entity type/ID, safe before/after values, reason and timestamp. Normal admins must not silently delete or modify audit history.

## PHASE 11 — SYSTEM HEALTH
Show safe diagnostics for application, database, AI provider and applicable background operations. Never expose secrets.

## PHASE 12 — DATABASE / RLS
Design admin access explicitly. Do not accidentally bypass workspace isolation. If privileged server-side access is required, document and secure it. Create new migrations only; never rewrite applied migrations.

## PHASE 13 — TESTING
Add tests for unauthenticated denial, non-admin denial, role permissions, cross-workspace protection, credit authorization, audit creation/immutability, plan/entitlement authorization, AI request access and pagination/filtering.

## PHASE 14 — REGRESSION
Verify authentication, workspace, Validator, Business Plan, PDF, usage, credits and pricing.

## PHASE 15 — FINAL VALIDATION
Run typecheck, lint, tests and build.

## OUT OF SCOPE
Stripe, Razorpay, checkout, payment webhooks, market research, competitor intelligence, new AI agents, enterprise SSO, white-label, impersonation and advanced BI.

## GIT SAFETY
No force push, no history rewrite, no secrets. Show git status and changed files before commit.

## FINAL RESPONSE
Report architecture, routes, RBAC matrix, database changes, security verification, tests, build result, limitations and recommended Sprint 8 scope.
