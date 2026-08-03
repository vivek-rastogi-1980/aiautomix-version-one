import type { KeyValueEntry } from "@/features/ai/renderer/types";

interface KeyValuesProps {
  entries: KeyValueEntry[];
}

/** KeyValues — a compact definition list for provenance and summary facts. */
export function KeyValues({ entries }: KeyValuesProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <div key={entry.label} className="flex flex-wrap gap-x-2">
          <dt className="text-sm text-muted-strong">{entry.label}</dt>
          <dd className="text-sm font-medium text-foreground/90">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
