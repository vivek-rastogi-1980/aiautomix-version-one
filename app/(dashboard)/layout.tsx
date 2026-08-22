import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/features/profile/data";
import { initialsFrom } from "@/lib/format";
import { DashboardShell } from "@/features/dashboard/dashboard-shell";
import { getTheme } from "@/lib/theme";

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
  const [profile, theme] = await Promise.all([getProfile(user.id), getTheme()]);

  // An account provisioned by the funnel has a session but no password. If the
  // one-time link expires before they choose one, they cannot get back in — so
  // the password is required once, here, before any dashboard route renders.
  //
  // Placed in the LAYOUT rather than middleware because it needs the profile
  // row, which middleware would have to fetch on every request including static
  // assets. Every dashboard page renders through this layout, so there is no
  // route that can skip it.
  if (profile?.password_setup_required) {
    redirect("/change-password");
  }

  const email = user.email ?? "";
  const name = profile?.full_name?.trim() || email.split("@")[0] || "Account";

  return (
    <DashboardShell
      theme={theme}
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
