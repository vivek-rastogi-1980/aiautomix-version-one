# ADMIN AUDIT LOG SPECIFICATION

## Purpose
Provide an immutable operational record of sensitive administrative actions.

## Fields
id, actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data, reason, request_id, safe request metadata, created_at.

## Examples
USER_SUSPENDED, USER_RESTORED, CREDIT_GRANTED, CREDIT_ADJUSTED, CREDIT_REFUNDED, PLAN_UPDATED, ENTITLEMENT_UPDATED, WORKSPACE_SUSPENDED.

## Rules
Append-oriented. Normal admins cannot delete audit history. Sensitive values must be redacted. Manual credit mutations require a reason.
