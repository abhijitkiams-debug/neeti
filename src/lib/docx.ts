import mammoth from "mammoth";
import WordExtractor from "word-extractor";

/** Converts an uploaded .docx buffer to sanitized-enough HTML for the article editor. */
export async function convertDocxToHtml(buffer: Buffer): Promise<{ html: string; warnings: string[] }> {
  const result = await mammoth.convertToHtml({ buffer });
  return { html: result.value, warnings: result.messages.map((m) => m.message) };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Converts a legacy .doc (OLE/binary Word 97-2003) buffer to HTML. mammoth
 * only reads .docx, so this path uses word-extractor for plain-text
 * extraction and wraps paragraphs in <p> tags — formatting (bold, tables,
 * images) is lost, unlike the richer .docx conversion above.
 */
export async function convertDocToHtml(buffer: Buffer): Promise<{ html: string; warnings: string[] }> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  const paragraphs = doc
    .getBody()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const html = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return {
    html: html || "<p></p>",
    warnings: ["Converted from legacy .doc format — only plain text is preserved (no formatting, tables, or images)."],
  };
}
