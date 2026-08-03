import { z } from "zod";

import { PROJECT_STATUSES } from "@/types/database";

/** Optional URL field: accepts an empty string (cleared) or a valid http(s) URL. */
const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value),
    "Enter a valid URL starting with http:// or https://",
  );

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  status: z
    .enum(PROJECT_STATUSES as unknown as [string, ...string[]])
    .default("active"),
  website: optionalUrl.optional().default(""),
});

export type ProjectInput = z.infer<typeof projectSchema>;
