import type { Metadata } from "next";
import Script from "next/script";
import "@/styles/globals.css";

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
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aiautomix.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "AIAutomix — AI-Powered Business Strategy, Automation & Validation",
    template: "%s | AIAutomix",
  },
  icons: {
    icon: "/assets/logo-ice2.png",
    apple: "/assets/logo-ice2.png",
  },
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
