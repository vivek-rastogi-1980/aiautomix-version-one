# SPRINT 5.5 MASTER EXECUTION PROMPT

## ROLE

Act as Principal Software Architect, Staff Next.js Engineer, TypeScript
Engineer, Supabase Engineer, AI Platform Architect, Security Engineer
and CTO for AIAutomix.

## MISSION

Perform a complete stabilization, architecture review, security review,
performance review and technical-debt cleanup of the Sprint 1--5
codebase.

This is NOT a feature sprint.

Do not implement Sprint 6 features.

## READ FIRST

Read completely: - ENGINEERING-HANDBOOK.md - ARCHITECTURE.md -
DATABASE.md - API-STANDARDS.md - CODING-STANDARDS.md -
UI-DESIGN-SYSTEM.md - PRODUCT-ROADMAP.md - AI-WORKFLOW-ENGINE.md -
JSON-SCHEMAS.md - PROMPT-STANDARDS.md - OPENAI-INTEGRATION.md -
REPORT-DESIGN-SYSTEM.md - PDF-STANDARDS.md - TEST-CASES.md -
SPRINT-01.md - SPRINT-02.md - SPRINT-03.md - SPRINT-04.md -
SPRINT-05.md - WORKSPACE-ARCHITECTURE.md - BUSINESS-PLAN-SPEC.md

Also read: - TECHNICAL-DEBT.md - CODE-QUALITY.md - SECURITY-REPORT.md -
PERFORMANCE-REPORT.md - PROJECT-HEALTH.md - ARCHITECTURE-REVIEW.md

## IMPORTANT

Do not assume the project description is correct. Inspect the actual
repository.

Inspect: - git status - branches - recent commits - package.json -
source files - migrations - API routes - server actions - tests -
environment examples - configuration - dependencies

## PHASE 1 --- BASELINE

Run and record: - npm install - npm test - npm run lint - npm run
typecheck, if available - npm run build

Use the actual scripts in package.json.

Do not hide existing failures.

## PHASE 2 --- ARCHITECTURE

Review: - app/ - components/ - features/ - lib/ - hooks/ - types/ -
scripts/ - supabase/ - API routes - server actions

Find: - circular dependencies - incorrect boundaries - duplicated
logic - oversized components - inappropriate client components -
business logic inside UI - dead code - unused dependencies

Fix safe, clear issues.

## PHASE 3 --- AI PLATFORM

Verify that AI features use: - Workflow Manager - Prompt Registry -
Provider abstraction - Schema validation - Usage logging - Persistence

No React component may call an LLM directly.

## PHASE 4 --- DATABASE

Review: - foreign keys - indexes - constraints - RLS - security-definer
functions - workspace isolation - role enforcement - cascade behavior -
migration order

For schema changes, create a new migration rather than rewriting applied
migrations unless there is a critical data/security issue.

## PHASE 5 --- SECURITY

Audit: - secrets - service-role exposure - authentication -
authorization - RLS - APIs - server actions - input validation -
uploads - XSS - injection - CSRF/CORS - security headers - dependency
vulnerabilities - prompt injection - rate limiting

Fix Critical and High findings when safe. Document remaining findings.

## PHASE 6 --- PERFORMANCE

Check: - hydration - client components - images - video - fonts - bundle
size - database queries - N+1 patterns - API latency - caching - PDF
generation

Fix safe regressions without changing product behavior.

## PHASE 7 --- CODE QUALITY

Apply: - strict TypeScript - consistent naming - reusable components -
single responsibility - clear interfaces - minimal abstraction - no
duplicated logic

Do not refactor only for personal style preference.

## PHASE 8 --- TESTING

Run existing tests and add regression tests for bugs found.

Prioritize: - authentication - workspace isolation - business plan
CRUD - AI workflow execution - JSON validation - report generation - PDF
generation - API authorization

## PHASE 9 --- DOCUMENTATION

Update the six review documents with actual findings.

Every finding should reference: - file/path - behavior - severity -
impact - recommendation - status

Update README or architecture documentation where implementation
differs.

## PHASE 10 --- SAFE REFACTORING

Only make changes that: - preserve behavior - fix real defects - improve
security - improve performance - reduce technical debt

Do NOT: - redesign UI - add billing - add subscriptions - add credits -
add new AI products - add team collaboration - change Sprint 6 scope

## PHASE 11 --- FINAL VALIDATION

Run: - tests - lint - typecheck - build

Verify: - no hydration errors - no critical console errors - Sprint 3
validator still works - Sprint 4 AI platform still works - Sprint 5
business plans still work - workspace works - PDF export works - mobile
marketing pages work

## REQUIRED DELIVERABLES

Update: 1. TECHNICAL-DEBT.md 2. CODE-QUALITY.md 3. SECURITY-REPORT.md 4.
PERFORMANCE-REPORT.md 5. PROJECT-HEALTH.md 6. ARCHITECTURE-REVIEW.md

Create: - STABILIZATION-SUMMARY.md

The summary must contain: - What was inspected - What was fixed - What
remains - Test results - Security status - Performance status -
Architecture status - Sprint 6 blockers - Recommended next actions

## GIT SAFETY

-   Never force push.
-   Never rewrite published history.
-   Never delete branches.
-   Never commit secrets.
-   Show changed files before committing.
-   Create a clean stabilization commit only after validation passes.

## DEFINITION OF DONE

Sprint 5.5 is complete when: - Architecture review is complete -
Technical debt is documented - Critical/high security issues are fixed
or explicitly blocked - Critical/high functional issues are fixed -
Tests pass - Lint passes - TypeScript passes - Build passes - Workspace
isolation is verified - AI platform boundaries are verified - Sprint 3
and Sprint 5 functionality still works - Review documents contain
evidence-based findings - Sprint 6 blockers are explicitly identified

## FINAL RULE

Do not start Sprint 6.

Final response must provide: 1. Overall health score 2. Production
readiness 3. Critical findings 4. Fixes completed 5. Remaining risks 6.
Sprint 6 blockers 7. Exact validation commands and results
