/**
 * Download filename for a generated PDF.
 *
 * Shared by every export route so the naming — and the sanitising that keeps a
 * user-supplied title out of a `Content-Disposition` header — happens once.
 */
export function toPdfFilename(title: string, suffix: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "aiautomix";
  return `${slug}-${suffix}.pdf`;
}
