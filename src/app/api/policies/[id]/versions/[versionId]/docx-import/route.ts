import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { convertDocxToHtml, convertDocToHtml } from "@/lib/docx";
import { saveUpload } from "@/lib/storage";

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = file?.name.toLowerCase() ?? "";
    if (!file || (!name.endsWith(".docx") && !name.endsWith(".doc"))) {
      return NextResponse.json({ error: "A .doc or .docx file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let html: string, warnings: string[];
    try {
      ({ html, warnings } = name.endsWith(".docx") ? await convertDocxToHtml(buffer) : await convertDocToHtml(buffer));
    } catch {
      return NextResponse.json({ error: "Could not read this file — it doesn't look like a valid Word document." }, { status: 400 });
    }
    const sourceFileUrl = await saveUpload("policy-docx", file.name, buffer);

    const updated = await prisma.policyVersion.update({
      where: { id: versionId },
      data: { contentHtml: html, sourceType: "DOCX_IMPORT", sourceFileUrl, status: "DRAFT" },
    });

    return NextResponse.json({ version: updated, warnings });
  } catch (e) {
    return apiError(e);
  }
}
