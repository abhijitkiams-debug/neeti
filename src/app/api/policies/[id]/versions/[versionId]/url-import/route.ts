import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { importFromUrl } from "@/lib/url-import";
import { saveUpload } from "@/lib/storage";

const schema = z.object({ url: z.string().min(1) });

// Fetches an externally-hosted document (Google Docs share link, or any
// public .docx/.pdf/HTML URL) and overwrites this draft version's content
// only — title, family, and targeting are never touched here.
export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { versionId } = await params;

    const version = await prisma.policyVersion.findFirstOrThrow({
      where: { id: versionId, policy: { tenantId: session.tenantId } },
    });
    if (!["DRAFT", "REJECTED"].includes(version.status)) {
      return NextResponse.json({ error: `Cannot edit a version in status ${version.status}` }, { status: 409 });
    }

    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "A URL is required" }, { status: 400 });

    let doc;
    try {
      doc = await importFromUrl(body.data.url);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 502 });
    }

    if (doc.kind === "pdf") {
      const sourceFileUrl = await saveUpload("policy-pdf", doc.fileName, doc.buffer);
      const updated = await prisma.policyVersion.update({
        where: { id: versionId },
        data: {
          contentHtml: `<p><em>This policy is published as a PDF document. Use the built-in viewer to read it.</em></p>`,
          sourceType: "PDF",
          sourceFileUrl,
          status: "DRAFT",
        },
      });
      return NextResponse.json({ version: updated, importedTitle: null });
    }

    if (doc.kind === "docx") {
      const sourceFileUrl = await saveUpload("policy-docx", doc.fileName, doc.buffer);
      const updated = await prisma.policyVersion.update({
        where: { id: versionId },
        data: { contentHtml: doc.html, sourceType: "DOCX_IMPORT", sourceFileUrl, status: "DRAFT" },
      });
      return NextResponse.json({ version: updated, warnings: doc.warnings, importedTitle: null });
    }

    const updated = await prisma.policyVersion.update({
      where: { id: versionId },
      data: { contentHtml: doc.html, sourceType: "URL_IMPORT", sourceFileUrl: doc.sourceUrl, status: "DRAFT" },
    });
    return NextResponse.json({ version: updated, importedTitle: doc.title });
  } catch (e) {
    return apiError(e);
  }
}
