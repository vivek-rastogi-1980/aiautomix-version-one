"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { imageFileSchema, profileSchema } from "@/lib/validations/profile";
import {
  type ActionState,
  errorState,
  successState,
  zodFieldErrors,
} from "@/lib/forms/action-state";

type ImageBucket = "avatars" | "logos";
type ImageColumn = "avatar_url" | "logo_url";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function revalidateProfile() {
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout"); // refresh the avatar in the shell header
}

/** Update the current user's profile text fields. */
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    companyName: formData.get("companyName") ?? "",
    bio: formData.get("bio") ?? "",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: parsed.data.fullName || null,
      company_name: parsed.data.companyName || null,
      bio: parsed.data.bio || null,
      website: parsed.data.website || null,
    },
    { onConflict: "id" },
  );

  if (error) {
    return errorState("Could not save your profile. Please try again.");
  }

  revalidateProfile();
  return successState("Profile saved.");
}

/** Shared upload routine for avatar / company logo images. */
async function uploadProfileImage(
  bucket: ImageBucket,
  column: ImageColumn,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const file = formData.get("file");
  const parsed = imageFileSchema.safeParse(file);
  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Invalid file.");
  }

  const supabase = await createClient();
  const extension = EXTENSION_BY_TYPE[parsed.data.type] ?? "png";
  const path = `${user.id}/${column}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, parsed.data, {
      cacheControl: "3600",
      upsert: true,
      contentType: parsed.data.type,
    });

  if (uploadError) {
    return errorState("Upload failed. Please try again.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  const patch =
    column === "avatar_url"
      ? { avatar_url: publicUrl }
      : { logo_url: publicUrl };
  const { error: updateError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...patch }, { onConflict: "id" });

  if (updateError) {
    return errorState("Could not save the image. Please try again.");
  }

  revalidateProfile();
  return successState("Image updated.");
}

export async function uploadAvatarAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return uploadProfileImage("avatars", "avatar_url", formData);
}

export async function uploadLogoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return uploadProfileImage("logos", "logo_url", formData);
}

/** Clear an avatar / logo image reference from the profile. */
async function removeProfileImage(column: ImageColumn): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const patch =
    column === "avatar_url" ? { avatar_url: null } : { logo_url: null };
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...patch }, { onConflict: "id" });

  if (error) {
    return errorState("Could not remove the image. Please try again.");
  }

  revalidateProfile();
  return successState("Image removed.");
}

export async function removeAvatarAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return removeProfileImage("avatar_url");
}

export async function removeLogoAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return removeProfileImage("logo_url");
}
