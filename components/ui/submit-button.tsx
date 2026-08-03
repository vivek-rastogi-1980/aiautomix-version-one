"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

interface SubmitButtonProps extends ButtonProps {
  /** Label shown while the enclosing form action is pending. */
  pendingText?: string;
}

/**
 * Submit button wired to `useFormStatus` — disables itself and shows a spinner
 * while the form's Server Action is in flight. Must live inside a <form>.
 */
function SubmitButton({
  children,
  pendingText,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}

export { SubmitButton };
