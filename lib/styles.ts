import type { CSSProperties } from "react";

/**
 * Widens style objects produced by the migrated page logic (plain string
 * values) to React's `CSSProperties`. The values themselves are unchanged —
 * they come 1:1 from the original design files.
 */
export function asStyle(style: object): CSSProperties {
  return style as CSSProperties;
}
