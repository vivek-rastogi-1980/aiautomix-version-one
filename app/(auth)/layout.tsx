import Link from "next/link";

/**
 * Centered layout for the authentication route group. Server Component — the
 * individual forms are Client Components. Middleware already redirects
 * signed-in users away from these routes.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-ink px-4 py-12">
      {/* Ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-10%] size-[520px] -translate-x-1/2 rounded-full bg-brand-violet/20 blur-[120px]" />
      </div>

      <Link
        href="/"
        className="relative z-10 mb-8 flex items-center gap-3 font-display text-lg font-bold tracking-tight text-foreground"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/logo-ice2.png"
          alt="AIAutomix"
          className="size-9 object-contain"
        />
        AIAutomix
      </Link>

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </main>
  );
}
