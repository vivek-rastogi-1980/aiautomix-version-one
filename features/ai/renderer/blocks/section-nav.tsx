export interface ReportNavItem {
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: ReportNavItem[];
}

/**
 * Section navigation for a report. Plain anchor links plus CSS `scroll-mt` on
 * the targets — no JS required, so the whole report stays a Server Component.
 */
export function SectionNav({ sections }: SectionNavProps) {
  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-20 z-10 -mx-4 overflow-x-auto border-y border-white/[0.06] bg-ink/80 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border"
    >
      <ul className="flex min-w-max items-center gap-1">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
