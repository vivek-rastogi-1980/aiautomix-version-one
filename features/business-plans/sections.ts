import type {
  BusinessPlanSectionField,
  BusinessPlanSections,
} from "@/features/ai/schemas/business-plan";
import type { ReportIconName } from "@/features/ai/renderer/types";

/**
 * The business plan section catalog — the single source of truth for the eleven
 * sections in BUSINESS-PLAN-SPEC.md.
 *
 * Everything downstream reads from here: the database `section_key`, the order
 * sections are stored and displayed in, the headings in the app and the PDF,
 * and the icons. Adding or renaming a section is a one-file change.
 *
 * `SECTION_META` is typed as a `Record` over the schema's field union, so the
 * compiler rejects the catalog if the workflow's JSON contract gains a section
 * that nobody gave a title to.
 */

export interface PlanSectionMeta {
  /** Stable identifier persisted in `business_plan_sections.section_key`. */
  key: string;
  title: string;
  icon: ReportIconName;
  /** Helper text shown above the editor. */
  hint: string;
}

const SECTION_META: Record<BusinessPlanSectionField, PlanSectionMeta> = {
  executiveSummary: {
    key: "executive-summary",
    title: "Executive Summary",
    icon: "clipboard",
    hint: "The whole plan in a few paragraphs — what the business is, who it serves, and why now.",
  },
  marketAnalysis: {
    key: "market-analysis",
    title: "Market Analysis",
    icon: "trending",
    hint: "Market size, segments, trends and the demand signals behind them.",
  },
  customerPersona: {
    key: "customer-persona",
    title: "Customer Persona",
    icon: "users",
    hint: "Who buys, what their day looks like, and what triggers the purchase.",
  },
  competition: {
    key: "competition",
    title: "Competition",
    icon: "grid",
    hint: "Direct and indirect competitors, and the wedge that differentiates you.",
  },
  businessModel: {
    key: "business-model",
    title: "Business Model",
    icon: "lightbulb",
    hint: "How value is created, delivered and captured — pricing and unit economics.",
  },
  marketing: {
    key: "marketing",
    title: "Marketing",
    icon: "target",
    hint: "Positioning, channels, acquisition motion and retention.",
  },
  operations: {
    key: "operations",
    title: "Operations",
    icon: "checklist",
    hint: "Delivery, tooling, suppliers and the team needed to run it.",
  },
  financials: {
    key: "financials",
    title: "Financials",
    icon: "gauge",
    hint: "Revenue and cost drivers, break-even logic and the assumptions behind them.",
  },
  funding: {
    key: "funding",
    title: "Funding",
    icon: "coins",
    hint: "How much is needed, what it buys, and the likely sources.",
  },
  risks: {
    key: "risks",
    title: "Risks",
    icon: "shield",
    hint: "What could sink this, how likely it is, and how it is mitigated.",
  },
  roadmap: {
    key: "roadmap",
    title: "Roadmap",
    icon: "route",
    hint: "Sequenced milestones with timeframes.",
  },
};

/** Presentation and storage order (BUSINESS-PLAN-SPEC.md section order). */
export const PLAN_SECTION_ORDER: readonly BusinessPlanSectionField[] = [
  "executiveSummary",
  "marketAnalysis",
  "customerPersona",
  "competition",
  "businessModel",
  "marketing",
  "operations",
  "financials",
  "funding",
  "risks",
  "roadmap",
] as const;

export interface PlanSectionDefinition extends PlanSectionMeta {
  field: BusinessPlanSectionField;
  /** Zero-based storage/display position. */
  position: number;
}

export const PLAN_SECTIONS: readonly PlanSectionDefinition[] =
  PLAN_SECTION_ORDER.map((field, position) => ({
    field,
    position,
    ...SECTION_META[field],
  }));

const BY_KEY = new Map(PLAN_SECTIONS.map((section) => [section.key, section]));

export function getPlanSection(key: string): PlanSectionDefinition | undefined {
  return BY_KEY.get(key);
}

/** Title for a stored section key, falling back to the key itself. */
export function planSectionTitle(key: string): string {
  return BY_KEY.get(key)?.title ?? key;
}

export const PLAN_SECTION_COUNT = PLAN_SECTIONS.length;

/** One section as it is about to be stored. */
export interface PlanSectionContent {
  section_key: string;
  title: string;
  content: string;
  position: number;
}

/**
 * Map a generated document onto storable rows, in catalog order.
 *
 * Pure, so the persistence path and the smoke test exercise the *same* mapping
 * rather than two descriptions of it.
 */
export function toPlanSectionContents(
  sections: BusinessPlanSections,
): PlanSectionContent[] {
  return PLAN_SECTIONS.map((section) => ({
    section_key: section.key,
    title: section.title,
    content: sections[section.field],
    position: section.position,
  }));
}
