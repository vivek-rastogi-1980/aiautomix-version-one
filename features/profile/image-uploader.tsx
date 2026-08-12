"use client";

import { useActionState, useRef } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { FormAlert } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/validations/profile";
import { idleState, type ActionState } from "@/lib/forms/action-state";

type ImageAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

interface ImageUploaderProps {
  title: string;
  description: string;
  currentUrl: string | null;
  shape: "circle" | "square";
  fallback?: string;
  uploadAction: ImageAction;
  removeAction: ImageAction;
}

export function ImageUploader({
  title,
  description,
  currentUrl,
  shape,
  fallback,
  uploadAction,
  removeAction,
}: ImageUploaderProps) {
  const [uploadState, upload, uploading] = useActionState(
    uploadAction,
    idleState,
  );
  const [removeState, remove, removing] = useActionState(
    removeAction,
    idleState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const errorMessage =
    uploadState.status === "error"
      ? uploadState.message
      : removeState.status === "error"
        ? removeState.message
        : null;

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{description}</p>

      {errorMessage ? (
        <div className="mt-4">
          <FormAlert variant="error">{errorMessage}</FormAlert>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-5">
        {/* Preview */}
        {shape === "circle" ? (
          <Avatar
            src={currentUrl}
            fallback={fallback}
            className="size-20 text-lg"
          />
        ) : (
          <span
            className={cn(
              "flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-fill-1",
            )}
          >
            {currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUrl}
                alt=""
                className="size-full object-contain p-2"
              />
            ) : (
              <ImageIcon className="size-7 text-muted-strong" />
            )}
          </span>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <form ref={formRef} action={upload}>
              <input
                ref={inputRef}
                type="file"
                name="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={() => formRef.current?.requestSubmit()}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </form>

            {currentUrl ? (
              <form action={remove}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={removing}
                >
                  {removing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Remove
                </Button>
              </form>
            ) : null}
          </div>
          <p className="text-xs text-muted-strong">
            PNG, JPG, WebP or SVG · up to 2&nbsp;MB.
          </p>
        </div>
      </div>
    </Card>
  );
}
