# AIAutoMix — Production Deployment Runbook

## Pre-Deployment
```bash
git status
git pull
npm install
npm run build
npx tsc --noEmit
npm run lint
```

Review changes before production.

## Branch
Use a controlled production branch, typically:
```bash
git checkout main
git pull origin main
```

## Vercel
Verify:
- production branch
- production environment variables
- deployment logs
- production domain

## Domain
Preferred:
`https://www.aiautomix.com`

DNS is external to the repository. Do not remove Hostinger email DNS records unless email migration is intentional.

## Post-Deployment
Verify:
- homepage
- navigation
- service pages
- forms
- authentication
- public tools
- robots
- sitemap
- metadata
- OG sharing
- analytics
- console

## Rollback
If a production deployment causes a critical regression:
1. Open Vercel deployment history.
2. Identify last known-good deployment.
3. Roll back/promote according to the current Vercel workflow.
4. Verify production.
5. Create a Git issue for the failed release.
6. Fix in a branch.
7. Re-test before redeploying.

## Release Record
Record:
- date
- commit
- deployment
- major changes
- database migrations
- environment changes
- rollback notes
