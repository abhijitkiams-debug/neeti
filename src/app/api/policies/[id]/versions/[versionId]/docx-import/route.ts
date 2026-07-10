import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { convertDocxToHtml } from "@/lib/docx";
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
    if (!file || !file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "A .docx file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { html, warnings } = await convertDocxToHtml(buffer);
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
