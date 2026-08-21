# MARKET RESEARCH DATA MODEL

## Principles
Workspace scoped, UUID primary keys, explicit foreign keys, appropriate indexes, RLS, auditability and idempotency.

## Suggested Entities

### research_requests
workspace_id, user_id, source_business_idea_id, source_business_plan_id, scope, geography, industry, target_customer, questions, depth, status, created_at, updated_at.

### research_runs
research_request_id, workflow_run_id, status, current_stage, started_at, completed_at, error.

### research_sources
research_request_id, url, canonical_url, title, publisher, source_type, published_at, retrieved_at, status, metadata.

### research_evidence
research_request_id, source_id, section_key, claim, evidence_reference, confidence, created_at.

### research_results
research_request_id, section_key, structured_content, confidence, status, version, created_at, updated_at.

Use existing project naming conventions if they differ. Never blindly copy these names.
