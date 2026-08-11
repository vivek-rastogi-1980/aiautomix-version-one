# SPRINT 06.5 — Commercial Platform Foundation

## Objective
Prepare AIAutomix for monetization by implementing the internal commercial architecture without connecting real payment providers.

## Scope
- Data-driven plan catalog: Free, Starter, Growth, Professional, Enterprise
- Central entitlement engine
- Workspace-level usage metering
- Credit engine foundation
- Subscription data model
- Pricing page
- Usage dashboard
- Minimal protected admin diagnostics

## Database
Add appropriate migrations for:
- plans
- plan_entitlements
- subscriptions
- credit_accounts
- credit_transactions
- usage_events

Use UUIDs, foreign keys, indexes, constraints and RLS.

## Architecture Rules
- Workspace is the commercial ownership boundary.
- No hard-coded plan checks in feature code.
- Payment providers must be replaceable adapters.
- Credit mutations must be atomic and auditable.
- Usage events must be append-oriented.
- Authorization must be server-side.
- Never trust client-submitted plan, credit or entitlement values.

## Out of Scope
- Stripe
- Razorpay
- Checkout
- Payment webhooks
- Full Admin Panel
- Market Research
- Competitor Intelligence
- New AI products

## Acceptance Criteria
- Plans are data-driven.
- Entitlement checks work server-side.
- Workspace access is isolated by RLS.
- Credit balance and transactions are auditable.
- Usage is recorded.
- Pricing page works responsively.
- Usage dashboard works.
- Existing Validator and Business Plan remain functional.
- Typecheck, lint, tests and production build pass.
