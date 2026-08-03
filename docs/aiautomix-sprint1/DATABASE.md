# Database Design

## Core Tables

-   users
-   profiles
-   projects
-   business_ideas
-   reports
-   ai_conversations
-   payments
-   invoices
-   files
-   notifications
-   audit_logs

## Relationships

User -\> Projects -\> Business Ideas -\> Reports

## Security

-   Row Level Security enabled
-   UUID primary keys
-   Soft delete where appropriate
