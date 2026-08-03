import { InsightCard } from "@/features/ai/renderer/blocks/insight-card";
import { KeyValues } from "@/features/ai/renderer/blocks/key-values";
import { MetricBars } from "@/features/ai/renderer/blocks/metric-bars";
import { RankedList } from "@/features/ai/renderer/blocks/ranked-list";
import { ReportFooter } from "@/features/ai/renderer/blocks/report-footer";
import { ReportHeader } from "@/features/ai/renderer/blocks/report-header";
import { SectionNav } from "@/features/ai/renderer/blocks/section-nav";
import { SwotGrid } from "@/features/ai/renderer/blocks/swot-grid";
import { Timeline } from "@/features/ai/renderer/blocks/timeline";
import { resolveIcon } from "@/features/ai/renderer/icons";
import {
  navigableSections,
  type ReportBlock,
  type ReportDocumentModel,
  type ReportSection,
} from "@/features/ai/renderer/types";

/**
 * Report Engine — HTML renderer (REPORT-ENGINE-SPEC.md).
 *
 * Input: a `ReportDocumentModel` built from validated workflow JSON.
 * Output: a consistent, accessible report assembled from the shared blocks.
 *
 * Every AI product renders through this component. A workflow contributes a
 * model, never a layout, which is why the PDF engine can render the same report
 * without either surface knowing about the other.
 *
 * Server Component: no client JS is required to view a report.
 */

interface ReportRendererProps {
  model: ReportDocumentModel;
  /** Injected by the page — typically the PDF download button. */
  actions?: React.ReactNode;
}

function renderBlock(block: ReportBlock, key: string): React.ReactNode {
  switch (block.kind) {
    case "paragraph":
      return <p key={key}>{block.text}</p>;

    case "bullets":
      return (
        <ul key={key} className="flex flex-col gap-2">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-relaxed">
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-violet"
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case "metrics":
      return <MetricBars key={key} entries={block.entries} />;

    case "swot":
      return <SwotGrid key={key} content={block.content} />;

    case "ranked":
      return (
        <RankedList
          key={key}
          entries={block.entries}
          levelLabel={block.levelLabel}
        />
      );

    case "timeline":
      return <Timeline key={key} entries={block.entries} />;

    case "keyValues":
      return <KeyValues key={key} entries={block.entries} />;
  }
}

function Section({ section }: { section: ReportSection }) {
  return (
    <InsightCard
      id={section.id}
      title={section.title}
      icon={resolveIcon(section.icon)}
    >
      <div className="flex flex-col gap-4">
        {section.blocks.map((block, index) =>
          renderBlock(block, `${section.id}-${index}`),
        )}
      </div>
    </InsightCard>
  );
}

/** Group consecutive `half` sections so they pair up two-per-row. */
function groupSections(sections: ReportSection[]): ReportSection[][] {
  const groups: ReportSection[][] = [];

  for (const section of sections) {
    const isHalf = section.layout === "half";
    const previous = groups[groups.length - 1];
    const previousIsHalf = previous?.[0]?.layout === "half";

    if (isHalf && previousIsHalf) previous.push(section);
    else groups.push([section]);
  }

  return groups;
}

export function ReportRenderer({ model, actions }: ReportRendererProps) {
  return (
    <article className="flex flex-col gap-6">
      <div className="scroll-mt-24">
        <ReportHeader
          kicker={model.kicker}
          title={model.title}
          summary={model.summary}
          generatedAt={model.meta.generatedAt}
          score={model.score}
          actions={actions}
        />
      </div>

      <SectionNav sections={navigableSections(model)} />

      {groupSections(model.sections).map((group, index) =>
        group.length > 1 || group[0].layout === "half" ? (
          <div
            key={`group-${index}`}
            className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            {group.map((section) => (
              <Section key={section.id} section={section} />
            ))}
          </div>
        ) : (
          <Section key={group[0].id} section={group[0]} />
        ),
      )}

      <InsightCard
        title="How this was generated"
        icon={resolveIcon("checklist")}
      >
        <ReportFooter meta={model.meta} disclaimer={model.disclaimer} />
      </InsightCard>
    </article>
  );
}
