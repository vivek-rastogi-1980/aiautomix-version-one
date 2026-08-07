/**
 * Split section prose into paragraphs on blank lines.
 *
 * Used by the on-screen editor and by the report definition that feeds the PDF,
 * so a plan reads the same way in both places.
 */
export function splitParagraphs(content: string): string[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [content];
}
