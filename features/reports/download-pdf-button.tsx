"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DownloadPdfButtonProps {
  reportId: string;
  title: string;
}

/**
 * Downloads the report PDF from `/api/reports/:id/pdf`.
 *
 * Fetches as a blob rather than using a plain link so failures surface as an
 * inline message instead of navigating the user to a broken page.
 */
export function DownloadPdfButton({ reportId, title }: DownloadPdfButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/pdf`);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-aiautomix-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleDownload}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {pending ? "Preparing…" : "Download PDF"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger-soft">
          {error}
        </p>
      ) : null}
    </div>
  );
}
