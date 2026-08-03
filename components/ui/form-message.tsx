import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Inline validation message shown beneath a field. */
function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger-soft">
      {children}
    </p>
  );
}

interface FormAlertProps {
  variant: "success" | "error";
  children: React.ReactNode;
  className?: string;
}

/** Form-level banner for the overall success/error result of a submission. */
function FormAlert({ variant, children, className }: FormAlertProps) {
  const Icon = variant === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        variant === "success"
          ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
          : "border-danger/30 bg-danger/10 text-danger-soft",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export { FieldError, FormAlert };
