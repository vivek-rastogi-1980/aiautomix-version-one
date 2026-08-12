# ADMIN SECURITY SPECIFICATION

## Threat Model
The Admin Panel is a high-value attack surface.

## Controls
- Server-side authentication
- Server-side authorization
- RBAC
- Least privilege
- RLS
- Audit logging
- CSRF protection where applicable
- Secure headers
- Rate limiting for sensitive operations
- Input validation
- Output redaction
- No secrets in client bundles
- No API keys in logs
- Safe confirmation for sensitive mutations

## Critical Rules
Never authorize based on email. Never trust client-provided role, credit balance, plan or entitlement. Never expose provider credentials. Never allow normal admins to delete audit history.
