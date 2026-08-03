# ENGINEERING HANDBOOK

## Purpose

This handbook is the single source of truth for engineering decisions in
AIAutomix.

## Product Vision

Build AIAutomix into an AI Business Operating System that helps users
validate, launch, automate, and scale businesses.

## Core Technology

-   Next.js 15 (App Router)
-   TypeScript (strict)
-   Tailwind CSS
-   shadcn/ui
-   Supabase
-   PostgreSQL + pgvector
-   OpenAI
-   LangGraph
-   n8n
-   Vercel

## Engineering Principles

1.  Architecture before implementation.
2.  Reuse before duplication.
3.  Server Components by default.
4.  Strong typing everywhere.
5.  Small, composable components.
6.  Secure by default.
7.  Accessibility is mandatory.
8.  Performance is a feature.
9.  Test critical paths.
10. Document architectural decisions.

## Repository Structure

/docs /app /components /features /lib /hooks /types /public

## Git Workflow

-   main: production
-   develop: integration
-   feature/\*
-   fix/\*
-   release/\*

## Pull Request Checklist

-   Builds successfully
-   No TypeScript errors
-   No ESLint errors
-   Responsive
-   Accessible
-   Reviewed

## Coding Standards

-   Functional React components
-   Interfaces for props
-   Absolute imports
-   No duplicated business logic
-   Feature-based organization

## Security

-   Never expose secrets.
-   Server-side AI calls only.
-   Row Level Security in Supabase.
-   Validate all inputs.

## AI Development Rules

-   Prompts stored as Markdown.
-   JSON outputs only.
-   Version prompts.
-   Log failures.
-   Separate orchestration from UI.

## Documentation Order

1.  ARCHITECTURE.md
2.  DATABASE.md
3.  API-STANDARDS.md
4.  CODING-STANDARDS.md
5.  UI-DESIGN-SYSTEM.md
6.  PRODUCT-ROADMAP.md
7.  Sprint documents

## Development Lifecycle

Sprint -\> Code Review -\> QA -\> Build -\> Deploy -\> Monitor

## Definition of Done

-   Production build passes.
-   Documentation updated.
-   Acceptance criteria met.
-   No critical defects.

## Instructions for AI Coding Assistants

Before writing code: 1. Read this handbook. 2. Read all referenced
architecture documents. 3. Follow sprint scope only. 4. Do not introduce
breaking changes. 5. Preserve project architecture. 6. Stop after
completing the requested sprint.
