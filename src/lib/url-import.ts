import * as cheerio from "cheerio";
import { convertDocxToHtml } from "./docx";

/**
 * Fetches an externally-hosted document and normalizes it into content this
 * app can store. Stands in for a real CRM/DMS connector (Google Drive,
 * SharePoint, etc.) — those all require OAuth credentials this environment
 * doesn't have — by supporting the two things reachable with just a public
 * URL: a Google Docs share link (rewritten to Google's HTML export endpoint)
 * and any other publicly-reachable HTML/.docx/.pdf document.
 */

export type ImportedDocument =
  | { kind: "html"; html: string; title: string | null; sourceUrl: string }
  | { kind: "docx"; html: string; warnings: string[]; buffer: Buffer; fileName: string }
  | { kind: "pdf"; buffer: Buffer; fileName: string };

const GOOGLE_DOCS_RE = /^https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i;

function resolveFetchUrl(inputUrl: string): string {
  const m = inputUrl.match(GOOGLE_DOCS_RE);
  if (m) return `https://docs.google.com/document/d/${m[1]}/export?format=html`;
  return inputUrl;
}

function stripEventHandlers(html: string): string {
  return html.replace(/\son\w+\s*=\s*"[^"]*"/gi, "").replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

export async function importFromUrl(inputUrl: string): Promise<ImportedDocument> {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new Error("Enter a valid, fully-qualified URL (starting with https://).");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) URLs are supported.");
  }

  const fetchUrl = resolveFetchUrl(inputUrl);
  let res: Response;
  try {
    res = await fetch(fetchUrl, { redirect: "follow" });
  } catch {
    throw new Error("Could not reach that URL from the server.");
  }
  if (!res.ok) {
    throw new Error(
      `Could not fetch that URL (HTTP ${res.status}). Make sure it is publicly accessible ("Anyone with the link can view").`
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() || "document";

  if (contentType.includes("application/pdf") || fetchUrl.toLowerCase().endsWith(".pdf")) {
    const buffer = Buffer.from(await res.arrayBuffer());
    const fileName = lastSegment.toLowerCase().endsWith(".pdf") ? lastSegment : `${lastSegment}.pdf`;
    return { kind: "pdf", buffer, fileName };
  }

  if (contentType.includes("officedocument.wordprocessingml.document") || fetchUrl.toLowerCase().endsWith(".docx")) {
    const buffer = Buffer.from(await res.arrayBuffer());
    const { html, warnings } = await convertDocxToHtml(buffer);
    const fileName = lastSegment.toLowerCase().endsWith(".docx") ? lastSegment : `${lastSegment}.docx`;
    return { kind: "docx", html, warnings, buffer, fileName };
  }

  const text = await res.text();
  const $ = cheerio.load(text);
  $("script, style, nav, header, footer, noscript, iframe").remove();
  const title = $("title").first().text().trim() || null;
  const bodyHtml = $("body").html() ?? $.root().html() ?? "";
  return { kind: "html", html: stripEventHandlers(bodyHtml), title, sourceUrl: inputUrl };
}
