import type { Metadata } from "next";
import Script from "next/script";
import "@/styles/globals.css";
import { getSiteUrl } from "@/lib/seo/site-url";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Absolute base for canonical URLs and Open Graph images.
 *
 * This was hardcoded to the staging host, which meant every share preview and
 * canonical URL on production would have pointed back at staging — and broken
 * outright once staging goes away or gets password-protected. Deriving it from
 * `NEXT_PUBLIC_SITE_URL` (already set per environment for auth email links)
 * keeps one source of truth, so preview, staging and production each describe
 * themselves correctly. The production domain is the fallback rather than
 * staging: if the variable is ever missing, the safer wrong answer is the real
 * site.
 */
const SITE_URL = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AI Automation Agency & AI Business Solutions | AIAutoMix",
    template: "%s | AIAutoMix",
  },
  icons: {
    icon: "/assets/logo-ice2.png",
    apple: "/assets/logo-ice2.png",
  },
};

/**
 * Site-wide JSON-LD graph (P0-7).
 *
 * `Organization` and `WebSite` were both absent — the site had `Service` schemas
 * on nine pages but nothing establishing who publishes them. These two are what
 * search engines use to attach a brand to a domain and to consider sitelinks,
 * so they belong in the root layout where every page inherits them exactly once.
 *
 * A single `@graph` with `@id` cross-references is used rather than two loose
 * blocks, so the WebSite is explicitly published *by* the Organization instead
 * of the two being unrelated facts on the same page.
 *
 * Everything here is verifiable from the site itself. No ratings, review counts,
 * founding dates, employee numbers, addresses or awards are asserted — invented
 * values are a structured-data violation and risk a manual action.
 */
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "AIAutoMix",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/assets/logo-ice2.png`,
      },
      description:
        "AIAutoMix helps businesses validate, build, automate and scale with AI — automation, AI agents, CRM, voice AI and business intelligence.",
      email: "contact@aiautomix.com",
      // Markets actually served. Listing countries is a factual claim about
      // where the business operates, not a claim to have offices there.
      areaServed: [
        { "@type": "Country", name: "United States" },
        { "@type": "Country", name: "United Kingdom" },
        { "@type": "Country", name: "Canada" },
        { "@type": "Country", name: "Australia" },
        { "@type": "Country", name: "India" },
      ],
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: SITE_URL,
      name: "AIAutoMix",
      publisher: { "@id": ORGANIZATION_ID },
      inLanguage: "en",
    },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/*
          The original design references the literal families
          'Bricolage Grotesque' and 'Inter' throughout its styles, so the
          stylesheet link is kept 1:1 (migrating to next/font is a follow-up —
          see MIGRATION-NOTES.md).
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body>
        {children}
        {GA_MEASUREMENT_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
