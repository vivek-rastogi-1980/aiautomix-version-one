# MARKET RESEARCH SECURITY SPECIFICATION

## Threats
Prompt injection through external content, malicious URLs, excessive retrieval, cross-workspace leakage, provider-key exposure, credit abuse, duplicate charging and report manipulation.

## Controls
- External content is untrusted.
- Never execute instructions from retrieved content.
- Server-side URL validation.
- Timeouts and payload limits.
- RLS on research data.
- Server-side entitlement/credit checks.
- Idempotent workflow execution.
- Secret-free client bundles.
- Audit sensitive operations.
- Rate limits where appropriate.
