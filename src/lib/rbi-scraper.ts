import * as cheerio from "cheerio";
import { prisma } from "./prisma";
import type { RbiTag } from "./enums";

const RBI_NOTIFICATIONS_URL = "https://www.rbi.org.in/Scripts/NotificationUser.aspx";

export type ScrapedCircular = {
  title: string;
  sourceUrl: string;
  pdfUrl: string | null;
  publishedDate: Date | null;
  tags: RbiTag[];
  summary: string;
};

const TAG_KEYWORDS: [RbiTag, RegExp][] = [
  ["NBFC", /\bnbfc|non[- ]banking financial\b/i],
  ["CO_OP_BANK", /\bco[- ]operative bank|urban co[- ]operative|ucb|state co[- ]operative|district central co[- ]operative\b/i],
  ["SMALL_FINANCE_BANK", /\bsmall finance bank|sfb\b/i],
  ["BANK", /\bscheduled commercial bank|\bbanks?\b/i],
];

function classifyTags(title: string): RbiTag[] {
  const matched = TAG_KEYWORDS.filter(([, re]) => re.test(title)).map(([tag]) => tag);
  return matched.length > 0 ? matched : ["OTHER"];
}

/**
 * Title-based extractive summary. RBI's notification listing page only
 * exposes titles + PDF links, not body text — a true abstract would need
 * to download and parse each circular's PDF (left as a Phase 2 hook: see
 * `pdfUrl` on the returned record, which a text-extraction job can consume
 * without any schema change).
 */
function synthesizeSummary(title: string, publishedDate: Date | null) {
  const dateStr = publishedDate ? publishedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "an unspecified date";
  return `RBI notification dated ${dateStr}: ${title}`;
}

const MONTH_RE = /^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/;

export async function scrapeRbiNotifications(limit = 50): Promise<ScrapedCircular[]> {
  const res = await fetch(RBI_NOTIFICATIONS_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NeetiPolicyBot/1.0)" } });
  if (!res.ok) throw new Error(`RBI site returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const results: ScrapedCircular[] = [];
  let currentDate: Date | null = null;

  $("table.tablebg > tbody > tr, table.tablebg > tr").each((_, el) => {
    if (results.length >= limit) return;

    const headerText = $(el).find("td.tableheader b").first().text().trim();
    if (headerText && MONTH_RE.test(headerText)) {
      const parsed = new Date(headerText);
      currentDate = isNaN(parsed.getTime()) ? null : parsed;
      return;
    }

    const link = $(el).find("a.link2").first();
    if (link.length === 0) return;

    const title = link.text().trim();
    const href = link.attr("href");
    if (!title || !href) return;
    const sourceUrl = new URL(href, RBI_NOTIFICATIONS_URL).toString();

    const pdfHref = $(el).find("a[target='_blank']").first().attr("href") ?? null;
    const pdfUrl = pdfHref ? new URL(pdfHref, RBI_NOTIFICATIONS_URL).toString() : null;

    results.push({
      title,
      sourceUrl,
      pdfUrl,
      publishedDate: currentDate,
      tags: classifyTags(title),
      summary: synthesizeSummary(title, currentDate),
    });
  });

  return results;
}

export async function scrapeAndStore(limit = 50) {
  const scraped = await scrapeRbiNotifications(limit);
  for (const c of scraped) {
    await prisma.rbiCircular.upsert({
      where: { sourceUrl: c.sourceUrl },
      update: { title: c.title, pdfUrl: c.pdfUrl, publishedDate: c.publishedDate, summary: c.summary, tags: JSON.stringify(c.tags) },
      create: {
        title: c.title,
        sourceUrl: c.sourceUrl,
        pdfUrl: c.pdfUrl,
        publishedDate: c.publishedDate,
        summary: c.summary,
        tags: JSON.stringify(c.tags),
      },
    });
  }
  return { upserted: scraped.length };
}
