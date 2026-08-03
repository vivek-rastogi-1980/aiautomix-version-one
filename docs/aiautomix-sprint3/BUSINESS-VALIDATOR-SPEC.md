# BUSINESS-VALIDATOR-SPEC.md

# AI Business Validator Specification

## Version

1.0 (MVP)

## Purpose

The Business Validator is the flagship AI workflow of AIAutomix. It
helps entrepreneurs evaluate a business idea using structured AI
analysis and generates a professional report.

------------------------------------------------------------------------

# Goals

-   Capture business ideas in a structured way.
-   Produce consistent AI-generated reports.
-   Save reports for future reference.
-   Provide downloadable PDFs.
-   Build reusable infrastructure for future AI tools.

------------------------------------------------------------------------

# User Journey

1.  User logs in.
2.  User selects or creates a Project.
3.  User opens **Business Idea Validator**.
4.  User completes the business idea form.
5.  System validates inputs.
6.  AI Workflow Engine processes the request.
7.  Structured JSON response is validated.
8.  Report is stored in the database.
9.  User views and downloads the report.

------------------------------------------------------------------------

# Input Fields

## Required

-   Business Name
-   Business Idea
-   Industry
-   Country
-   Target Audience
-   Business Model
-   Estimated Budget
-   Current Stage

## Optional

-   Timeline
-   Existing Competitors
-   Additional Notes

------------------------------------------------------------------------

# AI Analysis Sections

-   Executive Summary
-   Overall Validation Score (0--100)
-   Problem Statement
-   Target Market
-   Customer Persona
-   Market Opportunity
-   SWOT Analysis
-   Revenue Model
-   Risks
-   Recommended Improvements
-   Go / Revise / Stop Recommendation
-   Next Steps

------------------------------------------------------------------------

# Scoring Model (MVP)

  Category              Weight
  ------------------- --------
  Market Demand            20%
  Problem Severity         15%
  Revenue Potential        15%
  Competition              15%
  Feasibility              15%
  Innovation               10%
  Risk                     10%

Total = 100

------------------------------------------------------------------------

# Database

## business_ideas

-   id
-   project_id
-   title
-   payload_json
-   status
-   created_at

## validation_reports

-   id
-   business_idea_id
-   score
-   report_json
-   pdf_url
-   prompt_version
-   model
-   created_at

------------------------------------------------------------------------

# JSON Response Contract

``` json
{
  "overallScore": 82,
  "summary": "",
  "marketOpportunity": "",
  "swot": {
    "strengths": [],
    "weaknesses": [],
    "opportunities": [],
    "threats": []
  },
  "recommendations": [],
  "nextSteps": []
}
```

------------------------------------------------------------------------

# Report UI

-   Hero summary
-   Score card
-   Section navigation
-   Expandable analysis
-   Download PDF
-   Save history

------------------------------------------------------------------------

# Acceptance Criteria

-   User can submit an idea.
-   AI returns valid JSON.
-   Report is rendered correctly.
-   Report is saved.
-   PDF is generated.
-   Errors are handled gracefully.

------------------------------------------------------------------------

# Future Enhancements

-   Multi-agent orchestration
-   Live market research
-   Competitor discovery
-   Google Trends
-   Funding readiness
-   Business Plan generation
-   Investor Pitch Deck
