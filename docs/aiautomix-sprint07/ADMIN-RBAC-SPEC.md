# ADMIN RBAC SPECIFICATION

## Roles
SUPER_ADMIN — full administrative access.
ADMIN — operational management excluding highest-risk platform/security controls.
SUPPORT — customer support and limited safe operational actions.
ANALYST — read-only operational analytics.

## Permissions
users.read, users.manage, workspaces.read, workspaces.manage, ai.read, usage.read, credits.read, credits.adjust, plans.read, plans.manage, entitlements.read, entitlements.manage, audit.read, system.read.

## Rules
- Server-side enforcement
- Least privilege
- Deny by default
- No email-based authorization
- Privileged mutations must be audited
