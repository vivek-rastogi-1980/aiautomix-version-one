import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value),
    "Enter a valid URL starting with http:// or https://",
  );

export const profileSchema = z.object({
  fullName: z.string().trim().max(120).optional().default(""),
  companyName: z.string().trim().max(120).optional().default(""),
  bio: z.string().trim().max(500).optional().default(""),
  website: optionalUrl.optional().default(""),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// --- Settings ---------------------------------------------------------------

export const updateEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// --- File uploads -----------------------------------------------------------

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

export const imageFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Please choose a file")
  .refine(
    (file) => file.size <= MAX_IMAGE_BYTES,
    "Image must be 2 MB or smaller",
  )
  .refine(
    (file) => (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type),
    "Use a PNG, JPG, WebP, or SVG image",
  );
