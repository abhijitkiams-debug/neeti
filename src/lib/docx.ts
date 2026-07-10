import mammoth from "mammoth";

/** Converts an uploaded .docx buffer to sanitized-enough HTML for the article editor. */
export async function convertDocxToHtml(buffer: Buffer): Promise<{ html: string; warnings: string[] }> {
  const result = await mammoth.convertToHtml({ buffer });
  return { html: result.value, warnings: result.messages.map((m) => m.message) };
}
