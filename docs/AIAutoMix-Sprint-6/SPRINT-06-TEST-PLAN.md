# Sprint 06 — Test Plan

## Automated
Run:
```bash
npm run build
npx tsc --noEmit
npm run lint
npm audit
```
Use the project's actual scripts if different.

## Route Smoke Test
Verify all public routes, services, industries, tools, insights and contact pages.

## SEO
Verify:
```text
/robots.txt
/sitemap.xml
```
Both should return 200 and contain correct content.

## Metadata
For every major page verify:
- title
- description
- canonical
- OG title
- OG description
- OG image

## Security
Test:
- anonymous private-route access
- invalid form input
- excessive input
- invalid IDs
- unauthorized API access
- cross-user access
- secret exposure

## Mobile
Test:
```text
320px
375px
390px
414px
768px
1024px
1440px
```
No unintended horizontal overflow.

## Browsers
Test Chrome, Edge, Firefox and Safari where available.

## Accessibility
Check keyboard navigation, focus, labels, alt text, contrast and headings.

## Performance
Use Lighthouse/PageSpeed and record:
- LCP
- INP
- CLS

## Conversion
Test:
- contact
- consultation
- WhatsApp
- phone
- email
- AI demo
- Idea Validator if present

## Production Smoke
After deployment:
1. Open homepage.
2. Test navigation.
3. Test forms.
4. Test auth if present.
5. Test public tools.
6. Check console.
7. Check Vercel logs.
8. Check analytics.
9. Verify sitemap.
10. Verify robots.

## Regression Rule
No Sprint 06 task is complete if an existing critical user journey is broken.
