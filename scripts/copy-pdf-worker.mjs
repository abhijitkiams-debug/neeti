// Self-hosts the pdf.js worker (react-pdf's dependency) under /public so the
// built-in PDF viewer never depends on a third-party CDN at runtime.
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = path.join(root, "..", "public", "pdf-worker");
const dest = path.join(destDir, "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("pdfjs-dist worker not found, skipping copy:", src);
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("Copied pdf.js worker to", dest);
