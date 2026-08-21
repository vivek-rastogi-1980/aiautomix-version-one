# SPRINT 08 — MARKET RESEARCH ENGINE

## Objective
Build the first production-grade Market Research capability inside AIAutoMix, extending the existing AI Workflow Engine, Business Idea Validator, Business Plan Generator, Workspace, Usage/Credit and Admin foundations.

## Core Journey
Business Idea → Validation → Business Plan → Market Research → Competitor Intelligence (future) → Financial Intelligence (future) → Marketing Strategy (future)

## Scope
1. Research request from a validated idea, business plan, or manual brief.
2. Configuration: industry, geography, target customer, business model, questions and research depth.
3. Evidence-first research workflow.
4. Structured market research report.
5. Existing report/PDF engine integration.
6. Existing entitlement/credit/usage integration.
7. Admin monitoring.
8. Workspace isolation and security.

## Workflow
Research Planning → Source Discovery → Source Collection → Normalization → Evidence Extraction → Market Analysis → Customer Analysis → Trend Analysis → Opportunity/Risk Analysis → Synthesis → Quality Review → Report Generation.

## Report Sections
1. Executive Summary
2. Research Scope & Methodology
3. Market Overview
4. Market Size & Growth Evidence
5. Target Customer / ICP
6. Customer Problems & Needs
7. Industry Trends
8. Demand Signals
9. Business Model & Pricing Signals
10. Opportunities
11. Risks & Challenges
12. Regulatory/Environmental Considerations
13. Strategic Recommendations
14. Evidence & Sources
15. Confidence / Limitations

## Architecture Rules
- Reuse the existing AI Workflow Engine and provider abstraction.
- Reuse existing report/PDF, usage, credits and entitlements.
- Workspace is the security boundary.
- Server-side authorization is mandatory.
- External source content is untrusted.
- Never fabricate sources or unsupported facts.
- Never expose provider secrets.

## Out of Scope
Competitor Intelligence, financial forecasting/advice, proprietary paid-data integrations, social publishing and news-site implementation.

## Definition of Done
Research can be created, executed, monitored and exported; evidence is persisted and traceable; usage/credits work; Admin monitoring works; failures are recoverable; workspace isolation is tested; typecheck, lint, tests and production build pass.
