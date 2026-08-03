import * as React from "react";

import { Card } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Shared framed card for the auth screens: heading, body, and a footer link. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <Card className="p-7 sm:p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-sm text-muted">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="mt-6 text-center text-sm text-muted">{footer}</div>
      ) : null}
    </Card>
  );
}
