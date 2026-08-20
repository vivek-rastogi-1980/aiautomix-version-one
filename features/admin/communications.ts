import "server-only";

import { createClient } from "@/lib/supabase/server";
import { paged, type PageParams, type Paged } from "@/features/admin/query";
import type {
  EmailLogRow,
  EmailTemplateRow,
  EmailTemplateVersionRow,
} from "@/types/database";
import {
  EMAIL_TRIGGERS,
  TRIGGER_STATUS,
  type EmailTrigger,
} from "@/features/communications/events";

/**
 * Read-side data access for Admin → Communications.
 *
 * As everywhere else in the admin panel, these run under the caller's own
 * session and the `admin_has('communications.read')` policies from migration
 * 0019 decide what comes back. No service-role client, no bypass.
 *
 * Nothing here reads or returns `SMTP_PASS`, and `email_logs` has no column
 * that could hold it — §8: "Never store sensitive email authentication
 * credentials."
 */

export interface TemplateListRow extends EmailTemplateRow {
  /** Does anything in this codebase actually raise this trigger? */
  wired: boolean;
  wiredNote: string;
  label: string;
}

function decorate(row: EmailTemplateRow): TemplateListRow {
  const status = TRIGGER_STATUS[row.trigger as EmailTrigger] as
    (typeof TRIGGER_STATUS)[EmailTrigger] | undefined;

  return {
    ...row,
    wired: status?.wired ?? false,
    wiredNote:
      status?.note ??
      "This trigger is not in the application's event vocabulary, so nothing can raise it.",
    label: status?.label ?? row.trigger,
  };
}

/**
 * Every template, decorated with whether its trigger is actually raised.
 *
 * The list is short and fixed — fifteen triggers, seeded by migration 0019 —
 * so it is not paginated. It is ordered by the declared trigger order rather
 * than by name or date, because that order groups account, validation and
 * booking messages the way an operator thinks about them.
 */
export async function listTemplates(): Promise<TemplateListRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin] template list failed", error.message);
    return [];
  }

  const rows = (data ?? []).map(decorate);
  const order = new Map(EMAIL_TRIGGERS.map((t, i) => [t as string, i]));
  return rows.sort(
    (a, b) => (order.get(a.trigger) ?? 99) - (order.get(b.trigger) ?? 99),
  );
}

export interface TemplateDetail {
  template: TemplateListRow;
  /** Newest first. Append-only: a version that shipped is never rewritten. */
  versions: EmailTemplateVersionRow[];
  /** The version `current_version` points at, or null before first save. */
  current: EmailTemplateVersionRow | null;
  /** Recent sends attributed to this template, newest first. */
  recentLogs: EmailLogRow[];
}

export async function getTemplateDetail(
  templateId: string,
): Promise<TemplateDetail | null> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (!template) return null;

  const [versionsResult, logsResult] = await Promise.all([
    supabase
      .from("email_template_versions")
      .select("*")
      .eq("template_id", templateId)
      .order("version", { ascending: false })
      .limit(50),
    supabase
      .from("email_logs")
      .select("*")
      .eq("template_id", templateId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const versions = versionsResult.data ?? [];

  return {
    template: decorate(template),
    versions,
    current:
      versions.find((v) => v.version === template.current_version) ?? null,
    recentLogs: logsResult.data ?? [],
  };
}

export interface EmailLogFilters {
  search?: string;
  status?: string;
  trigger?: string;
  /** Test sends are excluded by default — they are not customer traffic. */
  includeTests?: boolean;
}

/**
 * The delivery log.
 *
 * Test sends are hidden unless asked for. §"Send test email" requires that a
 * test never looks like customer communication, and an operator scanning for a
 * missed confirmation should not have to mentally filter out their own
 * experiments.
 */
export async function listEmailLogs(
  params: PageParams,
  filters: EmailLogFilters = {},
): Promise<Paged<EmailLogRow>> {
  const supabase = await createClient();

  let query = supabase
    .from("email_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (!filters.includeTests) query = query.eq("is_test", false);
  if (filters.search) {
    query = query.ilike("recipient_email", `%${filters.search}%`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.trigger) query = query.eq("trigger", filters.trigger);

  const { data, count, error } = await query;
  if (error) {
    console.error("[admin] email log list failed", error.message);
    return paged<EmailLogRow>([], 0, params);
  }

  return paged<EmailLogRow>(data ?? [], count ?? 0, params);
}

/** Not defined here: a client component needs it too. See `lead-vocabulary`. */
export { EMAIL_STATUS_BADGE } from "@/features/admin/lead-vocabulary";
