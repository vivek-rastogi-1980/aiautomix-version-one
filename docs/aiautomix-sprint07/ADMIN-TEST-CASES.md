# ADMIN TEST CASES

## Authentication
- Unauthenticated user cannot access /admin
- Authenticated non-admin cannot access /admin
- Admin session is enforced server-side

## RBAC
- SUPER_ADMIN permissions work
- ADMIN permissions work
- SUPPORT permissions are restricted
- ANALYST is read-only
- Unknown permissions are denied

## Users
- Search works
- Pagination works
- Details are correct
- Unauthorized mutation is rejected

## Workspaces
- Search works
- Cross-workspace data is protected
- Suspend/restore authorization works

## AI
- Requests visible only to authorized roles
- Filters work
- Provider secrets never appear
- Failure details are safe

## Credits
- Balance is correct
- Grant requires reason
- Adjustment requires reason
- Refund is atomic
- Every mutation creates an audit record
- Unauthorized mutation is rejected

## Plans / Entitlements
- Authorized admin can modify
- Unauthorized role is denied
- Changes create audit events

## Audit
- Event created
- Event immutable to normal admin
- Sensitive values redacted

## System Health
- Health checks work
- Secrets are not exposed

## Regression
Validator, Business Plan, PDF, Workspace, Usage and Pricing remain functional.

## Build Gates
Typecheck, Lint, Tests, Production Build.
