# Prompt Standards

## Goals

-   Version-controlled prompts
-   Structured JSON responses
-   Reusable prompt templates

## Prompt Structure

1.  System Prompt
2.  Developer Instructions
3.  Workflow Context
4.  User Input
5.  Output Schema

## Rules

-   Store prompts in `/prompts`
-   Never hardcode prompts in UI
-   Return valid JSON
-   Version prompts (v1, v2...)
-   Validate outputs before saving
