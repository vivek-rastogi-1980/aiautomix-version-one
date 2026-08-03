"use client";

import { useActionState, useEffect, useState } from "react";
import { History, Pencil, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { InsightCard } from "@/features/ai/renderer/blocks/insight-card";
import { resolveIcon } from "@/features/ai/renderer/icons";
import type { ReportIconName } from "@/features/ai/renderer/types";
import { updatePlanSectionAction } from "@/features/business-plans/actions";
import { splitParagraphs } from "@/features/business-plans/paragraphs";
import { RestoreVersionButton } from "@/features/business-plans/restore-version-button";
import { idleState } from "@/lib/forms/action-state";
import { formatDateTime } from "@/lib/format";
import type {
  BusinessPlanSection,
  BusinessPlanVersion,
} from "@/types/database";

interface SectionEditorProps {
  section: BusinessPlanSection;
  /** Revision history, newest first. */
  history: BusinessPlanVersion[];
  icon?: ReportIconName;
  hint?: string;
  /** False for Viewers — the section renders read-only. */
  editable: boolean;
}

/**
 * One editable, versioned plan section (BUSINESS-PLAN-SPEC.md).
 *
 * Reuses the platform's `InsightCard` so a section looks the same here as it
 * does in a rendered report; only the editing affordances are new.
 */
export function SectionEditor({
  section,
  history,
  icon,
  hint,
  editable,
}: SectionEditorProps) {
  const [state, formAction] = useActionState(
    updatePlanSectionAction,
    idleState,
  );
  const [editing, setEditing] = useState(false);

  // Close the editor once the server confirms the save, so the user sees the
  // revalidated content rather than their own textarea.
  useEffect(() => {
    if (state.status === "success") setEditing(false);
  }, [state.status]);

  const paragraphs = splitParagraphs(section.content);
  const edited = section.source === "user";

  return (
    <InsightCard
      id={section.section_key}
      title={section.title}
      icon={resolveIcon(icon)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={edited ? "completed" : "neutral"}>
            v{section.current_version}
            {edited ? " · edited" : " · AI"}
          </Badge>
          <span className="text-xs text-muted-strong">
            Updated {formatDateTime(section.updated_at)}
          </span>
          {editable && !editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" /> Edit
            </Button>
          ) : null}
        </div>

        {state.status !== "idle" && state.message && !state.fieldErrors ? (
          <FormAlert variant={state.status === "success" ? "success" : "error"}>
            {state.message}
          </FormAlert>
        ) : null}

        {editing ? (
          <form action={formAction} className="flex flex-col gap-3" noValidate>
            <input type="hidden" name="sectionId" value={section.id} />
            {hint ? <p className="text-xs text-muted-strong">{hint}</p> : null}
            <Textarea
              name="content"
              defaultValue={section.content}
              rows={14}
              aria-label={`${section.title} content`}
              aria-invalid={Boolean(state.fieldErrors?.content)}
            />
            <FieldError>{state.fieldErrors?.content}</FieldError>
            <div className="flex flex-wrap gap-3">
              <SubmitButton size="sm" pendingText="Saving…">
                Save as v{section.current_version + 1}
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                <X className="size-4" /> Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}

        {history.length > 1 ? (
          <details className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-foreground">
              <History className="size-4" />
              Version history ({history.length})
            </summary>
            <ul className="flex flex-col border-t border-white/[0.06]">
              {history.map((version) => {
                const isCurrent = version.version === section.current_version;
                return (
                  <li
                    key={version.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.04] px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Version {version.version}
                        {isCurrent ? " · current" : ""}
                        <span className="ml-2 text-xs font-normal text-muted-strong">
                          {version.source === "ai" ? "AI" : "Edited"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-strong">
                        {formatDateTime(version.created_at)}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                        {version.content}
                      </p>
                    </div>
                    {editable && !isCurrent ? (
                      <RestoreVersionButton
                        versionId={version.id}
                        version={version.version}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </div>
    </InsightCard>
  );
}
