import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { saveUpload } from "@/lib/storage";

// Alternative to the WYSIWYG/docx path: publish a policy as a native PDF,
// rendered to end users via the built-in PDF viewer instead of HTML.
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
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "A .pdf file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sourceFileUrl = await saveUpload("policy-pdf", file.name, buffer);

    const updated = await prisma.policyVersion.update({
      where: { id: versionId },
      data: {
        contentHtml: `<p><em>This policy is published as a PDF document. Use the built-in viewer to read it.</em></p>`,
        sourceType: "PDF",
        sourceFileUrl,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ version: updated });
  } catch (e) {
    return apiError(e);
  }
}
