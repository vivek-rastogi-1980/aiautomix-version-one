import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/features/profile/data";
import { initialsFrom } from "@/lib/format";
import { DashboardShell } from "@/features/dashboard/dashboard-shell";

// Dashboard routes are per-user and read the session cookie, so they must be
// rendered on demand — never statically prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * Protected shell for every dashboard route. Server Component: it enforces auth
 * (`requireUser`) and loads the profile once, then hands display data to the
 * client shell. The middleware also gates these routes — this is defence in
 * depth and gives us the user object directly.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  const email = user.email ?? "";
  const name = profile?.full_name?.trim() || email.split("@")[0] || "Account";

  return (
    <DashboardShell
      user={{
        name,
        email,
        avatarUrl: profile?.avatar_url ?? null,
        initials: initialsFrom(profile?.full_name, email),
      }}
    >
      {children}
    </DashboardShell>
  );
}
