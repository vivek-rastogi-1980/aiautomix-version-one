# AIAutoMix — Sprint 06
## Production Hardening, SEO, Security & Launch Foundation

**Status:** Ready for execution  
**Previous Sprint:** Sprint 05 — Workspace Foundation + Business Planning Foundation

## 1. Sprint Goal
Convert the current AIAutoMix application into a production-ready foundation without introducing a major new feature set.

Focus:
- Production audit
- Vercel deployment readiness
- Custom-domain readiness
- Next.js technical SEO
- Sitemap and robots
- Metadata and Open Graph
- Structured data
- Security hardening
- Form/API protection
- Analytics and conversion tracking
- Performance
- Accessibility
- Error handling
- Deployment and rollback documentation

## 2. Business Outcome
At the end of Sprint 06:
- AIAutoMix can safely run on production.
- Search engines can crawl and understand public pages.
- Social sharing produces professional previews.
- Secrets are protected.
- Public forms/APIs are hardened.
- Important conversions are measurable.
- Performance and accessibility are improved.
- Deployment is repeatable and documented.

## 3. Scope
### In Scope
1. Repository and architecture audit
2. Production build and quality gates
3. Vercel/environment verification
4. Canonical domain handling
5. Technical SEO
6. Structured data
7. Security hardening
8. Lead/form hardening
9. Analytics/conversion events
10. Performance
11. Accessibility
12. Error handling
13. Production documentation

### Out of Scope
- Major redesign
- New AI agent families
- New billing/subscription system
- Full CRM implementation
- Full business-news engine
- Full social publishing engine
- Major database rewrite
- Unrelated refactoring

## 4. Definition of Done
- [ ] Production build passes
- [ ] TypeScript passes
- [ ] Lint passes
- [ ] No P0 security issue
- [ ] No P0 SEO issue
- [ ] Canonical domain defined
- [ ] robots.txt works
- [ ] sitemap.xml works
- [ ] Public pages have unique metadata
- [ ] OG metadata works
- [ ] Structured data is valid where implemented
- [ ] Secrets are not exposed
- [ ] Server-side form validation exists
- [ ] Private routes are protected
- [ ] Analytics/conversion architecture is ready
- [ ] Mobile smoke test passes
- [ ] Production error handling works
- [ ] Rollback procedure documented

## 5. Work Breakdown
### S06-01 — Repository Audit
Create:
- `/docs/PRODUCTION-AUDIT.md`
- route inventory
- dependency inventory
- environment-variable inventory
- API inventory

**Rule:** Do not modify code before the initial audit.

### S06-02 — Build & Quality
Run:
```bash
npm run build
npx tsc --noEmit
npm run lint
npm audit
```
Use actual project scripts where different.

### S06-03 — Vercel
- Verify production branch
- Verify Production/Preview/Development variables
- Verify deployment logs
- Document rollback

### S06-04 — Domain
Preferred canonical:
`https://www.aiautomix.com`

Verify:
- apex domain
- www domain
- HTTPS
- redirect behavior
- no redirect loops

DNS changes remain a manual/external task.

### S06-05 — Technical SEO
Implement/review:
- title
- description
- canonical
- robots
- sitemap
- OG metadata
- Twitter/X metadata
- favicon
- manifest

### S06-06 — Structured Data
Use only accurate visible-content schema:
- Organization
- WebSite
- WebPage
- Service
- BreadcrumbList
- Article for editorial pages

Never invent ratings, reviews, awards or claims.

### S06-07 — Security
Review:
- API routes
- Server Actions
- authentication
- authorization
- Supabase RLS
- environment variables
- forms
- uploads
- user-generated content
- redirects
- CORS

Never expose:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### S06-08 — Security Headers
Evaluate:
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame protection

### S06-09 — Forms
Harden:
- contact
- consultation
- newsletter
- idea-validator inputs
- public AI inputs

Use server validation, error states, loading states, duplicate-submit protection and spam protection.

### S06-10 — Analytics
Define:
```text
contact_form_submit
book_consultation
whatsapp_click
phone_click
email_click
service_cta_click
idea_validator_started
idea_validator_completed
ai_demo_started
```

Capture UTM parameters where appropriate. Never send sensitive personal data to analytics.

### S06-11 — Performance
Audit:
- LCP
- INP
- CLS
- images
- fonts
- JavaScript
- client components
- third-party scripts
- animations

Targets:
- Performance >= 90 where practical
- Accessibility >= 90
- Best Practices >= 90
- SEO >= 95

### S06-12 — Accessibility
Audit:
- semantic HTML
- heading hierarchy
- alt text
- keyboard navigation
- focus
- forms
- contrast

### S06-13 — Error Handling
Review:
- 404
- error boundaries
- API failures
- form failures
- loading states
- safe logging

### S06-14 — Documentation
Create:
```text
/docs/PRODUCTION-AUDIT.md
/docs/SEO-AUDIT.md
/docs/SECURITY-AUDIT.md
/docs/PERFORMANCE-AUDIT.md
/docs/LAUNCH-CHECKLIST.md
/docs/DEPLOYMENT-RUNBOOK.md
/docs/SEO-CONTENT-ARCHITECTURE.md
```

## 6. Suggested 10-Day Sequence
Day 1: Audit  
Day 2: Build/TypeScript/lint/dependencies  
Day 3: Vercel/environment/domain  
Day 4: SEO  
Day 5: Structured data/social metadata  
Day 6: Security  
Day 7: Forms/APIs  
Day 8: Analytics/conversion  
Day 9: Performance/accessibility  
Day 10: QA/documentation/release

## 7. Git Strategy
```bash
git checkout -b sprint-06/production-hardening
```

Suggested commits:
```text
feat(seo): add production metadata
feat(seo): add sitemap and robots
feat(seo): add structured data
security: harden public APIs and forms
perf: optimize images fonts and client bundles
feat(analytics): add conversion events
docs: add production launch documentation
chore: finalize sprint 06 production readiness
```

## 8. Success Metrics
| Metric | Target |
|---|---:|
| Production build | Pass |
| TypeScript | Pass |
| Critical security issues | 0 |
| Critical SEO issues | 0 |
| Sitemap | 200 |
| Robots | 200 |
| Mobile overflow | 0 |
| Exposed secrets | 0 |
| Broken critical routes | 0 |
| Lighthouse Performance | 90+ target |
| Accessibility | 90+ target |
| SEO | 95+ target |

## 9. Next Sprint
Sprint 07 should focus on **AI Business Intelligence + Idea Validation Experience**, including Idea Validator v2, Business Readiness Score, Market Research, Competitor Research, agent orchestration, report generation and workspace integration.
