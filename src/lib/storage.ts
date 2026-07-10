import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Local-disk storage adapter for dev/scaffold use. Swap for S3/Azure Blob
 * in production by replacing this module's implementation — callers only
 * depend on `saveUpload` returning a public URL path.
 */
export async function saveUpload(subdir: string, fileName: string, buffer: Buffer): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const safeName = `${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(dir, safeName), buffer);
  return `/uploads/${subdir}/${safeName}`;
}
