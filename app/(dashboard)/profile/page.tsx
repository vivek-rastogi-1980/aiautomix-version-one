import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/features/profile/data";
import { initialsFrom } from "@/lib/format";
import { ProfileForm } from "@/features/profile/profile-form";
import { ImageUploader } from "@/features/profile/image-uploader";
import {
  removeAvatarAction,
  removeLogoAction,
  uploadAvatarAction,
  uploadLogoAction,
} from "@/features/profile/actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const email = user.email ?? "";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Profile
        </h1>
        <p className="text-muted">Manage your personal and company details.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ImageUploader
          title="Avatar"
          description="Your personal profile picture."
          shape="circle"
          currentUrl={profile?.avatar_url ?? null}
          fallback={initialsFrom(profile?.full_name, email)}
          uploadAction={uploadAvatarAction}
          removeAction={removeAvatarAction}
        />
        <ImageUploader
          title="Company logo"
          description="Shown alongside your company details."
          shape="square"
          currentUrl={profile?.logo_url ?? null}
          uploadAction={uploadLogoAction}
          removeAction={removeLogoAction}
        />
      </div>

      <ProfileForm profile={profile} email={email} />
    </div>
  );
}
