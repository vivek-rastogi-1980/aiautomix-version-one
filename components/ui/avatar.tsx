import * as React from "react";

import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  /** Fallback text (initials) shown when no image is available. */
  fallback?: string;
  className?: string;
}

/**
 * Avatar — circular image with an initials fallback. Uses a plain <img> so it
 * works with arbitrary Supabase Storage public URLs without next/image config.
 */
function Avatar({ src, alt = "", fallback, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-brand-violet/20 text-sm font-semibold text-foreground",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{fallback}</span>
      )}
    </span>
  );
}

export { Avatar };
