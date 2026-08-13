import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { PDF_BRAND } from "@/features/ai/pdf/brand";
import { BRAND_LOGO_PNG_BASE64 } from "@/features/ai/pdf/logo";
import { TONE_HEX, valueTone } from "@/features/ai/renderer/tone";
import {
  CLAIM_KIND_LABEL,
  CONFIDENCE_LABEL,
  CONFIDENCE_STEP,
  CONFIDENCE_STEPS,
  CONFIDENCE_TONE,
  type ClaimKind,
  type ReportBlock,
  type ReportDocumentModel,
  type ReportSection,
} from "@/features/ai/renderer/types";

/**
 * PDF Engine (PDF-ENGINE-SPEC.md, PDF-STANDARDS.md).
 *
 * Renders the *same* `ReportDocumentModel` the HTML Report Engine renders, so
 * a workflow describes its report once and gets both surfaces. Adding a block
 * kind means handling it in both renderers and nowhere else.
 *
 * Delivers: A4, AIAutomix branding, cover page with the company logo, running
 * header/footer, page numbers and a generation timestamp. Uses the built-in
 * Helvetica family, so no font files are bundled — smaller output and a
 * portable build.
 *
 * Content flows in a single `<Page>` and paginates automatically, which is what
 * makes the engine reusable: a report with three sections and one with thirty
 * both lay out correctly without per-workflow page splitting.
 */

const LOGO_SRC = {
  data: Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"),
  format: "png" as const,
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: PDF_BRAND.text,
    lineHeight: 1.5,
  },
  coverPage: {
    fontFamily: "Helvetica",
    color: PDF_BRAND.text,
    padding: 0,
  },

  coverBand: {
    backgroundColor: PDF_BRAND.ink,
    paddingVertical: 48,
    paddingHorizontal: 48,
  },
  coverBrandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  coverLogo: { width: 54, height: 50 },
  coverBrand: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.white,
    letterSpacing: 2,
  },
  coverKicker: {
    marginTop: 36,
    fontSize: 9,
    color: PDF_BRAND.cyan,
    letterSpacing: 1.5,
    fontFamily: "Helvetica-Bold",
  },
  coverTitle: {
    marginTop: 10,
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.white,
    lineHeight: 1.25,
  },
  coverBody: { paddingHorizontal: 48, paddingTop: 36 },

  scoreRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  scoreCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: { fontSize: 32, fontFamily: "Helvetica-Bold" },
  scoreOutOf: { fontSize: 8, color: PDF_BRAND.muted, marginTop: 2 },
  verdict: { fontSize: 16, fontFamily: "Helvetica-Bold" },

  metaTable: {
    marginTop: 34,
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.line,
    paddingTop: 14,
  },
  metaRow: { flexDirection: "row", marginBottom: 6 },
  metaLabel: { width: 130, color: PDF_BRAND.muted, fontSize: 9 },
  metaValue: { flex: 1, fontSize: 9 },

  header: {
    position: "absolute",
    top: 26,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.line,
    paddingBottom: 8,
  },
  headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  headerLogo: { width: 11, height: 10 },
  headerBrand: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.ink,
  },
  headerText: { fontSize: 8, color: PDF_BRAND.muted },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.line,
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: PDF_BRAND.muted },

  h2: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: PDF_BRAND.ink,
    marginBottom: 8,
  },
  section: { marginBottom: 20 },
  paragraph: { fontSize: 10, marginBottom: 6 },

  bullet: { flexDirection: "row", marginBottom: 4, paddingRight: 8 },
  bulletDot: { width: 12, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10 },

  barRow: { marginBottom: 8 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 9 },
  barTrack: {
    marginTop: 3,
    height: 6,
    backgroundColor: PDF_BRAND.soft,
    borderRadius: 3,
  },
  barFill: { height: 6, borderRadius: 3 },

  swotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swotBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: PDF_BRAND.line,
    borderRadius: 6,
    padding: 10,
  },
  swotTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 5 },

  item: {
    borderWidth: 1,
    borderColor: PDF_BRAND.line,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  itemTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  itemTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 1 },
  itemBadge: {
    fontSize: 7,
    color: PDF_BRAND.muted,
    textTransform: "uppercase",
    marginLeft: 8,
  },
  itemNote: { fontSize: 9, color: PDF_BRAND.muted, marginTop: 4 },

  // --- Evidence vocabulary (Phase 5) ---------------------------------------
  finding: { marginBottom: 10 },
  findingTagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  findingTag: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  findingConfidence: { fontSize: 7, fontFamily: "Helvetica-Bold" },
  meterRow: { flexDirection: "row", gap: 2, alignItems: "center" },
  meterStep: { width: 9, height: 3, borderRadius: 1.5 },
  findingText: { fontSize: 10, marginTop: 4 },
  findingCite: { fontSize: 8, color: PDF_BRAND.muted, marginTop: 3 },

  sourceRow: { flexDirection: "row", marginBottom: 7, paddingRight: 8 },
  sourceIndex: { width: 22, fontSize: 8, color: PDF_BRAND.muted },
  sourceBody: { flex: 1 },
  sourceTitle: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  sourceMeta: { fontSize: 8, color: PDF_BRAND.muted, marginTop: 1 },
  sourceUrl: { fontSize: 7, color: PDF_BRAND.violet, marginTop: 1 },

  callout: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 4,
    padding: 9,
    marginBottom: 8,
  },
  calloutTitle: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  calloutText: { fontSize: 9, marginTop: 3, color: PDF_BRAND.text },
});

/** Print colours for the claim labels. Mirrors the HTML renderer's palette. */
const CLAIM_KIND_HEX: Record<ClaimKind, string> = {
  FACT: TONE_HEX.positive,
  INFERENCE: TONE_HEX.caution,
  RECOMMENDATION: PDF_BRAND.violet,
};

const SWOT_QUADRANTS = [
  { key: "strengths", label: "Strengths", color: TONE_HEX.positive },
  { key: "weaknesses", label: "Weaknesses", color: TONE_HEX.negative },
  { key: "opportunities", label: "Opportunities", color: TONE_HEX.caution },
  { key: "threats", label: "Threats", color: PDF_BRAND.violet },
] as const;

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <Text style={styles.paragraph}>{block.text}</Text>;

    case "bullets":
      return <Bullets items={block.items} />;

    case "metrics":
      return (
        <View>
          {block.entries.map((entry) => (
            <View key={entry.key} style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>
                  {entry.label}
                  {entry.weight !== undefined
                    ? ` (${entry.weight}% weight)`
                    : ""}
                </Text>
                <Text style={styles.barLabel}>{entry.value}/100</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${entry.value}%`,
                      backgroundColor: TONE_HEX[valueTone(entry.value)],
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      );

    case "swot":
      return (
        <View style={styles.swotGrid}>
          {SWOT_QUADRANTS.map(({ key, label, color }) => (
            <View key={key} style={styles.swotBox}>
              <Text style={[styles.swotTitle, { color }]}>{label}</Text>
              <Bullets items={block.content[key]} />
            </View>
          ))}
        </View>
      );

    case "ranked":
      return (
        <View>
          {block.entries.map((entry, index) => (
            <View key={index} style={styles.item} wrap={false}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemTitle}>
                  {index + 1}. {entry.title}
                </Text>
                {entry.level ? (
                  <Text style={styles.itemBadge}>
                    {block.levelLabel ? `${block.levelLabel}: ` : ""}
                    {entry.level}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.paragraph}>{entry.description}</Text>
              {entry.footnote ? (
                <Text style={styles.itemNote}>
                  {entry.footnote.label}: {entry.footnote.value}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      );

    case "timeline":
      return (
        <View>
          {block.entries.map((entry, index) => (
            <View key={index} style={styles.item} wrap={false}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemTitle}>
                  {index + 1}. {entry.title}
                </Text>
                <Text style={styles.itemBadge}>{entry.timeframe}</Text>
              </View>
              <Text style={styles.paragraph}>{entry.description}</Text>
            </View>
          ))}
        </View>
      );

    case "keyValues":
      return (
        <View>
          {block.entries.map((entry) => (
            <View key={entry.label} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{entry.label}</Text>
              <Text style={styles.metaValue}>{entry.value}</Text>
            </View>
          ))}
        </View>
      );

    // The FACT / INFERENCE / RECOMMENDATION distinction and the confidence
    // grade have to survive into print, so both are words here as well as
    // colours — a report is frequently read as a greyscale printout.
    case "findings":
      return (
        <View>
          {block.entries.map((entry, index) => {
            const kindColor = CLAIM_KIND_HEX[entry.kind];
            const confidence = entry.confidence;
            const confidenceColor = confidence
              ? TONE_HEX[CONFIDENCE_TONE[confidence]]
              : PDF_BRAND.muted;

            return (
              <View key={index} style={styles.finding} wrap={false}>
                <View style={styles.findingTagRow}>
                  <Text
                    style={[
                      styles.findingTag,
                      { color: kindColor, borderColor: kindColor },
                    ]}
                  >
                    {CLAIM_KIND_LABEL[entry.kind].toUpperCase()}
                  </Text>
                  {confidence ? (
                    <>
                      <View style={styles.meterRow}>
                        {Array.from({ length: CONFIDENCE_STEPS }).map(
                          (_, step) => (
                            <View
                              key={step}
                              style={[
                                styles.meterStep,
                                {
                                  backgroundColor:
                                    step < CONFIDENCE_STEP[confidence]
                                      ? confidenceColor
                                      : PDF_BRAND.soft,
                                },
                              ]}
                            />
                          ),
                        )}
                      </View>
                      <Text
                        style={[
                          styles.findingConfidence,
                          { color: confidenceColor },
                        ]}
                      >
                        {CONFIDENCE_LABEL[confidence]}
                      </Text>
                    </>
                  ) : null}
                </View>

                <Text style={styles.findingText}>{entry.text}</Text>

                {entry.citations?.length ? (
                  <Text style={styles.findingCite}>
                    {entry.citations.length === 1 ? "Source: " : "Sources: "}
                    {entry.citations
                      .map(
                        (citation) =>
                          citation.label +
                          (citation.publishedAt
                            ? ` (${citation.publishedAt})`
                            : ""),
                      )
                      .join("; ")}
                  </Text>
                ) : entry.kind === "FACT" ? (
                  <Text style={styles.findingCite}>
                    No source recorded for this statement.
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      );

    case "sources":
      return (
        <View>
          {block.entries.map((entry, index) => (
            <View key={index} style={styles.sourceRow} wrap={false}>
              <Text style={styles.sourceIndex}>[{index + 1}]</Text>
              <View style={styles.sourceBody}>
                <Text style={styles.sourceTitle}>{entry.title}</Text>
                <Text style={styles.sourceMeta}>
                  {[
                    entry.publisher,
                    entry.sourceType,
                    `Published: ${entry.publishedAt ?? "Not stated"}`,
                    entry.retrievedAt
                      ? `Retrieved: ${entry.retrievedAt}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {/* The URL is printed rather than linked: a printed report has
                    to remain checkable off-screen. */}
                {entry.url ? (
                  <Text style={styles.sourceUrl}>{entry.url}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      );

    case "callout":
      return (
        <View
          style={[
            styles.callout,
            {
              borderColor: TONE_HEX[block.tone],
              backgroundColor: PDF_BRAND.soft,
            },
          ]}
          wrap={false}
        >
          <Text style={[styles.calloutTitle, { color: TONE_HEX[block.tone] }]}>
            {block.title}
          </Text>
          <Text style={styles.calloutText}>{block.text}</Text>
        </View>
      );
  }
}

function Section({ section }: { section: ReportSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2} minPresenceAhead={40}>
        {section.title}
      </Text>
      {section.blocks.map((block, index) => (
        <Block key={`${section.id}-${index}`} block={block} />
      ))}
    </View>
  );
}

function RunningChrome({
  title,
  generatedAt,
}: {
  title: string;
  generatedAt: string;
}) {
  return (
    <>
      <View style={styles.header} fixed>
        <View style={styles.headerBrandRow}>
          <Image style={styles.headerLogo} src={LOGO_SRC} />
          <Text style={styles.headerBrand}>AIAutomix</Text>
        </View>
        <Text style={styles.headerText}>{title}</Text>
      </View>
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Generated {generatedAt}</Text>
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </View>
    </>
  );
}

export interface ReportPdfDocumentProps {
  model: ReportDocumentModel;
  /** Pre-formatted generation timestamp (rendered as-is). */
  generatedAt: string;
}

/** Branded A4 PDF for any report the Report Engine can describe. */
export function ReportPdfDocument({
  model,
  generatedAt,
}: ReportPdfDocumentProps) {
  const accent = model.score ? TONE_HEX[model.score.tone] : PDF_BRAND.violet;

  return (
    <Document
      title={`${model.title} — ${model.meta.workflowLabel}`}
      author="AIAutomix"
      subject={model.kicker}
      creator="AIAutomix"
      producer="AIAutomix"
    >
      {/* --- Cover --- */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverBand}>
          <View style={styles.coverBrandRow}>
            <Image style={styles.coverLogo} src={LOGO_SRC} />
            <Text style={styles.coverBrand}>AIAUTOMIX</Text>
          </View>
          <Text style={styles.coverKicker}>{model.kicker.toUpperCase()}</Text>
          <Text style={styles.coverTitle}>{model.title}</Text>
        </View>

        <View style={styles.coverBody}>
          <View style={styles.scoreRow}>
            {model.score ? (
              <View style={[styles.scoreCircle, { borderColor: accent }]}>
                <Text style={[styles.scoreNumber, { color: accent }]}>
                  {model.score.value}
                </Text>
                <Text style={styles.scoreOutOf}>out of 100</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              {model.score?.verdict ? (
                <Text style={[styles.verdict, { color: accent }]}>
                  {model.score.verdict.label} — {model.score.verdict.blurb}
                </Text>
              ) : null}
              <Text style={[styles.paragraph, { marginTop: 8 }]}>
                {model.summary}
              </Text>
            </View>
          </View>

          <View style={styles.metaTable}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Generated</Text>
              <Text style={styles.metaValue}>{generatedAt}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Workflow</Text>
              <Text style={styles.metaValue}>{model.meta.workflowLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Model</Text>
              <Text style={styles.metaValue}>{model.meta.model}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Prompt version</Text>
              <Text style={styles.metaValue}>{model.meta.promptVersion}</Text>
            </View>
          </View>

          <Text style={[styles.itemNote, { marginTop: 28 }]}>
            {model.disclaimer}
          </Text>
        </View>
      </Page>

      {/* --- Analysis: flows and paginates automatically --- */}
      <Page size="A4" style={styles.page}>
        <RunningChrome title={model.title} generatedAt={generatedAt} />

        <View style={styles.section}>
          <Text style={styles.h2}>Executive summary</Text>
          <Text style={styles.paragraph}>{model.summary}</Text>
        </View>

        {model.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </Page>
    </Document>
  );
}
