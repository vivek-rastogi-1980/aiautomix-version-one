# SPRINT 07 — ADMIN & OPERATIONS PLATFORM

## Objective
Build the secure operational control center for AIAutomix on top of the Sprint 6.5 commercial foundation.

## Goals
- Protected admin area
- Admin RBAC
- Operational dashboard
- User management
- Workspace management
- AI operations monitoring
- Usage and credit operations
- Plan and entitlement management
- Immutable admin audit trail
- System health visibility

## Architecture
Admin UI → Server-side authorization → Admin services/actions → Supabase/RLS.

The UI is never the security boundary.

## Admin Roles
- SUPER_ADMIN
- ADMIN
- SUPPORT
- ANALYST

## Core Routes
- /admin
- /admin/users
- /admin/users/[id]
- /admin/workspaces
- /admin/workspaces/[id]
- /admin/ai
- /admin/ai/requests
- /admin/usage
- /admin/credits
- /admin/plans
- /admin/entitlements
- /admin/audit-logs
- /admin/system-health
- /admin/settings

## Scope
### Dashboard
Show real operational KPIs: users, workspaces, AI requests, success/failure rate, tokens, estimated AI cost and credit activity.

### Users
Search, filter and inspect users, workspaces, usage, credits and subscriptions. No impersonation in this sprint.

### Workspaces
Search, inspect owner/members, plan, subscription, credits, usage and projects. Prefer suspend/restore over deletion.

### AI Operations
Monitor requests, workflows, model, prompt version, status, attempts, duration, tokens, estimated cost and errors. Never expose provider secrets.

### Credits
View balances and ledger. Allow controlled grant, adjustment and refund with reason and audit record.

### Plans & Entitlements
View and safely manage centrally configured plans and entitlements.

### Audit Logs
Record sensitive admin actions with actor, action, entity, entity ID, reason, timestamp and safe before/after values.

### System Health
Expose safe application, database and AI-provider health indicators without secrets.

## Out of Scope
Stripe, Razorpay, checkout, payment webhooks, market research, competitor intelligence, new AI products, enterprise SSO, white-label, user impersonation and advanced BI.

## Definition of Done
- /admin protected
- RBAC enforced server-side
- Dashboard works
- Users/workspaces manageable
- AI operations visible
- Credits manageable with audit trail
- Plans/entitlements manageable
- Audit logs protected
- System health works
- RLS and cross-workspace isolation verified
- Typecheck, lint, tests and build pass
