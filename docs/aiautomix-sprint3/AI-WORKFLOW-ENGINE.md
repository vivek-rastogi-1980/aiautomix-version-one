# AI-WORKFLOW-ENGINE.md

# AI Workflow Engine

## Purpose

The AI Workflow Engine is the reusable execution layer for every AI
feature in AIAutomix. No feature should call an LLM directly. All
requests flow through this engine.

## Objectives

-   Standardize AI execution
-   Reuse prompt orchestration
-   Enforce structured JSON output
-   Centralize logging, retries, and error handling
-   Support future AI modules without changing the core architecture

## High-Level Flow

User Input → Input Validation → Workflow Selection → Prompt Builder →
LLM Provider → JSON Validation → Persistence → Report Rendering → PDF
Export → Activity Logging

## Core Components

### Workflow Registry

Maps workflow IDs to prompt templates and output schemas.

Examples: - business-validator - business-plan - competitor-analysis -
marketing-strategy

### Prompt Builder

Combines: - System prompt - Workflow prompt - User input - Project
context - Output schema

### AI Provider Layer

Abstract provider interface. Initial provider: - OpenAI

Future providers: - Anthropic - Gemini - Azure OpenAI

### Response Validator

Validate against a predefined JSON schema. Reject malformed responses.
Retry if validation fails.

### Persistence

Save: - Prompt version - Request - Response - Tokens - Duration - User -
Project - Workflow

## Suggested Database Tables

-   ai_workflows
-   ai_prompt_versions
-   ai_requests
-   ai_responses
-   ai_usage_logs

## Folder Structure

/features/ai /workflows /prompts /schemas /services /lib/ai

## Error Handling

-   Timeout retry
-   Rate-limit retry
-   JSON repair attempt
-   User-friendly error message

## Security

-   Server-side API calls only
-   API keys in environment variables
-   Input sanitization
-   Rate limiting

## Prompt Versioning

Store prompts as markdown: prompts/business-validator/v1.md
prompts/business-validator/v2.md

Never hardcode prompts in React components.

## JSON Contract Example

{ "overallScore": 85, "summary": "","strengths": \[\], "weaknesses":
\[\], "opportunities": \[\], "threats": \[\], "recommendations": \[\] }

## Observability

Log: - Workflow - Model - Prompt version - Tokens - Duration -
Success/failure

## Extending the Engine

Every new AI feature should provide: 1. Input form 2. Prompt 3. JSON
schema 4. Report template

The engine handles everything else.

## Definition of Done

-   Reusable workflow execution
-   Structured outputs
-   Centralized logging
-   Schema validation
-   Ready for all future AI modules
