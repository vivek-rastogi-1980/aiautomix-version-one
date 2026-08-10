# Sprint 06 — Architecture & Technical Design

## Production Flow
```text
User
  |
  v
Vercel / Next.js
  |
  +--> Public Pages
  +--> Authenticated Application
  +--> Server Actions / API Routes
            |
            +--> Supabase
            +--> AI Providers
            +--> External Services
```

## Security Boundary
```text
Browser
  |
  v
Validation
  |
  v
Server Action / API
  |
  +--> Authorization
  +--> Rate Limiting
  +--> Business Rules
  |
  v
Database / AI Provider
```

Privileged operations must never be controlled directly by browser input.

## Environment Strategy
```text
.env.local       -> Development
Vercel Preview   -> Preview
Vercel Production-> Production
```

Never commit secrets.

## SEO Architecture
Expected Next.js locations where compatible:
```text
app/
├── layout.tsx
├── page.tsx
├── robots.ts
├── sitemap.ts
└── ...
```

## Canonical URL
`https://www.aiautomix.com`

Use this consistently in canonical tags, sitemap URLs, OG URLs and structured data.

## Public vs Private
Typical public:
```text
/
/ai-automation
/ai-agents
/website-development
/industries/*
/insights/*
/tools/*
```

Typical private:
```text
/dashboard/*
/account/*
/admin/*
/api/*
```

Adjust to the actual codebase.

## Supabase
If used:
- Review RLS
- Ensure user-owned data has ownership policies
- Test cross-user access
- Never expose service-role key

## AI Providers
Use server-side calls:
```text
Browser -> Server Action/API -> AI Provider
```

Never expose provider secrets in browser code.

## Performance
Prefer:
- Server Components
- optimized images
- next/font
- limited client JavaScript
- lazy loading
- streaming where useful

Preserve intentional AIAutoMix visual effects unless they create a real performance problem.

## Architecture Rule
Sprint 06 is a hardening sprint. Do not introduce a new ORM, database, state framework, UI framework or AI orchestration framework unless the existing architecture makes it unavoidable.
