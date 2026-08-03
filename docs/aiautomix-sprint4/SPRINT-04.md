# SPRINT-04.md

# Sprint 04 -- AI Platform Core

## Objective

Build the reusable AI Platform Core that powers every AI feature in
AIAutomix.

## Scope

### AI Workflow Manager

-   Workflow orchestration
-   Prompt loading
-   Model selection
-   Response validation
-   Persistence

### Prompt Registry

-   Versioned markdown prompts

### AI Provider Layer

-   OpenAI abstraction
-   Ready for Claude, Gemini, Azure OpenAI

### Report Engine

-   Shared report renderer
-   Reusable report components

### PDF Engine

-   Branded PDF generation
-   Headers, footers, page numbers

### AI Usage Tracking

-   Tokens
-   Duration
-   Cost
-   Prompt version
-   Model
-   User
-   Project

### AI History

-   Request history
-   Response history
-   Execution logs

## Database

Create: - ai_workflows - ai_prompt_versions - ai_requests -
ai_responses - ai_usage_logs

Enable UUIDs, timestamps and Row Level Security.

## Folder Structure

features/ ai/ engine/ providers/ registry/ renderer/ schemas/ history/
usage/ pdf/

## Quality Requirements

-   Next.js App Router
-   TypeScript Strict
-   Server Components by default
-   Reusable architecture
-   Accessible UI
-   No duplicated logic
-   Production-ready

## Out of Scope

Do NOT implement: - Business Plan Generator - Marketing Strategy -
Competitor Analysis - Funding Advisor - Billing - Admin Panel

## Acceptance Criteria

-   Shared AI engine implemented
-   Prompt registry working
-   Provider abstraction complete
-   JSON validation operational
-   Usage logging functional
-   Report renderer reusable
-   PDF engine reusable
-   npm run build passes
-   No ESLint or TypeScript errors

## Deliverables

-   AI Platform Core
-   Updated documentation
-   Migration notes
