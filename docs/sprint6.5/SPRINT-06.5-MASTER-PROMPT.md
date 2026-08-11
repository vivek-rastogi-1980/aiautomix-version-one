# SPRINT 06.5 MASTER EXECUTION PROMPT

## ROLE
Act as Principal SaaS Architect, Staff Next.js Engineer, TypeScript Engineer, Supabase/PostgreSQL Engineer, AI Platform Engineer and CTO for AIAutomix.

## MISSION
Implement Sprint 06.5 — Commercial Platform Foundation.

Prepare the platform for subscriptions, credits and future payments.

Do NOT implement actual payment processing.

## READ FIRST
Read all authoritative project documentation and Sprint 6.5 specifications. Inspect the actual repository and current origin/main. Do not trust previous summaries.

## BASELINE
Run the repository's actual:
- typecheck
- lint
- test
- build

Record baseline results.

## PLAN CATALOG
Implement data-driven plans:
FREE, STARTER, GROWTH, PROFESSIONAL, ENTERPRISE.

Do not scatter pricing or limits through application code.

## ENTITLEMENT ENGINE
Implement a reusable server-side access check such as:
canAccess(workspaceId, feature)

Do not use plan-name checks throughout feature modules.

## USAGE METERING
Record, where available:
- workspace
- user
- workflow
- AI request
- provider
- model
- input tokens
- output tokens
- total tokens
- estimated cost
- timestamp
- status

Reuse existing AI usage infrastructure.

## CREDIT ENGINE
Implement:
- credit accounts
- immutable transaction ledger
- atomic debit
- grant
- refund
- adjustment
- expiration

Never trust browser balances. Prevent unintended negative balances. Support idempotency for retried operations.

## SUBSCRIPTION MODEL
Implement provider-neutral subscription state:
- trialing
- active
- past_due
- canceled
- expired

Do not connect Stripe or Razorpay.

## PRICING UI
Create /pricing with plan comparison. No checkout or fake payment success.

## USAGE UI
Create a workspace usage page showing current plan, credits, AI requests, recent usage and limits.

## ADMIN DIAGNOSTICS
Create only the minimal protected internal diagnostics for AI requests, failed workflows, usage and workflow status. Do not build the full Admin Panel.

## DATABASE / RLS
All commercial records must be workspace-aware. Verify RLS, ownership, workspace isolation, FKs, indexes, unique constraints and transactional integrity. Create a new migration; never rewrite an applied migration.

## SECURITY
Never trust client-side plan, subscription, credit balance, entitlement or usage values. Enforce on the server.

## REGRESSION
Verify Business Idea Validator, Business Plan Generator, Workspace, Reports, PDF and Authentication.

## TESTING
Add tests for plan resolution, entitlement access/denial, credit grant/debit/refund/atomicity, workspace isolation, usage recording and subscription state transitions.

## FINAL VALIDATION
Run typecheck, lint, tests and production build.

## DO NOT IMPLEMENT
Stripe, Razorpay, checkout, payment webhooks, full Admin Panel, Market Research, Competitor Intelligence or new AI products.

## DEFINITION OF DONE
Commercial data model, entitlements, credits, usage, subscription state, pricing page, usage dashboard and diagnostics foundation work; RLS is verified; regression tests pass; build passes.

## GIT SAFETY
No force push, no history rewrite, no secrets. Show git status and changed files before commit.

Final response: files changed, migration, tests, security verification, acceptance criteria, known limitations and Sprint 7 recommendation.
