# Sprint 06 — Security Specification

## Critical Rules
Never expose:
- OpenAI API keys
- Anthropic API keys
- Supabase service-role key
- database passwords
- private tokens

Never commit `.env.local`.

## Environment Variables
Only browser-safe values may use `NEXT_PUBLIC_*`.

## Authentication
Verify protected routes, session handling, logout and unauthorized access.

## Authorization
Every sensitive operation must perform server-side authorization.

## Supabase
If present:
- enable/review RLS
- test cross-user access
- protect privileged operations

## Forms
Every public form requires:
- server validation
- input length limits
- spam protection
- safe error messages
- duplicate submission prevention

## AI Inputs
Treat user content as untrusted data. User input must never bypass application authorization.

## File Uploads
If present:
- validate MIME/type
- enforce size limits
- safe filenames
- non-executable storage
- correct access control

## Headers
Evaluate:
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame protection

Do not deploy a CSP that breaks legitimate services.

## Dependencies
Run the project's dependency audit. Review high/critical findings individually. Do not blindly perform major upgrades.

## Acceptance
Sprint cannot be complete if:
- production secret is exposed
- protected route is public
- cross-user private data is accessible
- privileged API operations lack authorization
