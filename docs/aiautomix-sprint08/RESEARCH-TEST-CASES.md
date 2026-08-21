# MARKET RESEARCH TEST CASES

## Request
Valid request succeeds; invalid request is rejected; workspace isolation works; idea/plan can seed research.

## Workflow
All stages execute; failures persist; retry does not duplicate results; status is correct; stage contracts validate.

## Sources
Sources persist; duplicates normalize; invalid URLs fail safely; source failures are handled; missing publication dates are supported.

## Evidence
Evidence links to sources; unsupported claims are flagged; conflicting evidence is flagged; missing evidence is represented.

## Report
All sections exist; fact/inference/recommendation labels work; confidence validates; PDF matches structured report; no fabricated sources.

## Commercial
Entitlement checked; insufficient credits rejected; usage recorded; failed runs follow refund rules; retry is idempotent.

## Security
Cross-workspace access denied; external prompt injection ignored; provider secrets never exposed; Admin RBAC enforced.

## Regression
Validator, Business Plan, Workspace, Credits, PDF, Pricing and Admin remain functional.

## Gates
Typecheck, lint, tests and production build pass.
