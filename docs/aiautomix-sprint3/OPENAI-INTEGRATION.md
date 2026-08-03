# OpenAI Integration

## Principles

-   Server-side calls only
-   API keys in environment variables
-   Retry transient failures
-   Validate JSON responses
-   Log usage and latency

## Flow

Client -\> Server Action/API -\> AI Workflow Engine -\> OpenAI -\> JSON
Validation -\> Database

## Security

-   Rate limiting
-   Input sanitization
-   Error handling
-   Timeout protection
