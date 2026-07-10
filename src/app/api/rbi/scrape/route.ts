import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { scrapeAndStore } from "@/lib/rbi-scraper";

// Admin-triggered on-demand scrape. In production this is also run on a
// schedule (see scripts/scrape-rbi.ts + a daily cron trigger).
export async function POST() {
  try {
    await requireEmployee(["ADMIN"]);
    const result = await scrapeAndStore(100);
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
