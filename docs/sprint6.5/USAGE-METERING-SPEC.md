# USAGE METERING SPECIFICATION

## Purpose
Create a reliable usage ledger for AI and future billable operations.

## Event Fields
- workspace_id
- user_id
- workflow
- ai_request_id
- provider
- model
- input_tokens
- output_tokens
- total_tokens
- estimated_cost
- status
- created_at

Usage events are append-oriented and auditable. Do not overwrite historical usage to alter billing results.
