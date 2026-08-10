# Sprint 06 — Claude Code Execution Prompt

Paste this into Claude Code from the repository root.

```text
You are the Senior DevOps Engineer, Next.js Architect, Technical SEO Engineer, Security Engineer, Performance Engineer and QA Lead for AIAutoMix.

Project: AIAutoMix
Production domain: https://www.aiautomix.com
Sprint: Sprint 06 — Production Hardening, SEO, Security & Launch Foundation

IMPORTANT:
Do not start coding immediately.
FIRST perform a read-only audit.
Do not redesign the site.
Do not remove existing functionality.
Do not introduce unnecessary dependencies.
Do not rewrite working code.

PHASE 1 — READ-ONLY AUDIT

Inspect:
- package.json
- Next.js/React versions
- TypeScript
- App Router / Pages Router
- app/
- pages/
- components/
- lib/
- public/
- API routes
- Server Actions
- middleware
- authentication
- Supabase
- environment variables
- SEO
- forms
- analytics
- images
- fonts
- configuration

Create:
docs/PRODUCTION-AUDIT.md

Classify:
P0 = blocker
P1 = important
P2 = optimization
P3 = future

STOP after the audit and show the report.

PHASE 2 — P0 ONLY

After approval, implement only P0 fixes.

Run:
npm run build
npx tsc --noEmit
npm run lint

Do not hide errors.

PHASE 3 — SEO

Implement/review:
- unique metadata
- canonical
- robots.txt
- sitemap.xml
- OG metadata
- Twitter/X metadata
- Organization schema
- WebSite schema
- WebPage schema where useful
- Breadcrumb schema where useful

Canonical:
https://www.aiautomix.com

Do not invent schema data.

PHASE 4 — SECURITY

Review:
- exposed secrets
- API routes
- Server Actions
- authentication
- authorization
- Supabase RLS
- forms
- uploads
- user input
- CORS
- redirects
- security headers

Never expose:
OPENAI_API_KEY
ANTHROPIC_API_KEY
SUPABASE_SERVICE_ROLE_KEY

Do not place secrets in NEXT_PUBLIC_*.

PHASE 5 — PERFORMANCE

Review:
- next/image
- next/font
- client components
- unnecessary JavaScript
- third-party scripts
- animations
- large images
- bundle size

Preserve the premium AIAutoMix visual identity.

PHASE 6 — ANALYTICS

Review/create:
contact_form_submit
book_consultation
whatsapp_click
phone_click
email_click
service_cta_click
idea_validator_started
idea_validator_completed
ai_demo_started

Do not send sensitive personal data.

PHASE 7 — ACCESSIBILITY

Check semantic HTML, headings, alt text, keyboard navigation, focus, forms and contrast.

PHASE 8 — DOCUMENTATION

Create:
docs/PRODUCTION-AUDIT.md
docs/SEO-AUDIT.md
docs/SECURITY-AUDIT.md
docs/PERFORMANCE-AUDIT.md
docs/LAUNCH-CHECKLIST.md
docs/DEPLOYMENT-RUNBOOK.md
docs/SEO-CONTENT-ARCHITECTURE.md

PHASE 9 — FINAL VERIFICATION

Run:
npm run build
npx tsc --noEmit
npm run lint

Report:
- files changed
- files created
- issues fixed
- remaining P0/P1/P2
- manual Vercel actions
- manual Hostinger DNS actions
- environment variables required
- production verification

Never claim DNS, Vercel, Hostinger, Search Console, analytics or external services are configured unless verified.

Mark external tasks:
MANUAL ACTION REQUIRED

AIAutoMix is intended to become an AI Business Intelligence + AI Automation platform.

Preserve:
"Helping businesses validate, build, automate, and scale with AI."

START WITH THE READ-ONLY AUDIT.
```
