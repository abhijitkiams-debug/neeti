// Standalone entry point for a daily cron job: `npm run rbi:scrape`.
import { scrapeAndStore } from "../src/lib/rbi-scraper";

scrapeAndStore(100)
  .then((r) => {
    console.log(`RBI scrape complete: ${r.upserted} circulars upserted.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("RBI scrape failed:", e);
    process.exit(1);
  });
