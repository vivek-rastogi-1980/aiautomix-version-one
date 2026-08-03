import {
  ClipboardList,
  Coins,
  Gauge,
  Grid2x2,
  Lightbulb,
  ListChecks,
  Route,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ReportIconName } from "@/features/ai/renderer/types";

/**
 * Named icons for report sections. The document model stays serialisable by
 * carrying a name; only the HTML renderer resolves it to a component.
 */
const ICONS: Record<ReportIconName, LucideIcon> = {
  gauge: Gauge,
  clipboard: ClipboardList,
  target: Target,
  users: Users,
  trending: TrendingUp,
  grid: Grid2x2,
  coins: Coins,
  shield: ShieldAlert,
  lightbulb: Lightbulb,
  route: Route,
  checklist: ListChecks,
};

export function resolveIcon(name?: ReportIconName): LucideIcon | undefined {
  return name ? ICONS[name] : undefined;
}
