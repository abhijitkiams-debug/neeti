import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { createPolicyWithDraft } from "@/lib/policies";

const schema = z.object({ familyId: z.string().min(1) });

// Imports an RBI circular as the starting draft of a new internal policy —
// the author still needs to review the source PDF and write the actual
// internal policy content; this just saves the "find + summarize + create draft" step.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { id } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const circular = await prisma.rbiCircular.findUniqueOrThrow({ where: { id } });
    const slug = circular.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    const contentHtml = `
      <p><em>Drafted from an RBI notification. Review the source circular and replace this
      with your organization's internal policy content before submitting for approval.</em></p>
      <p><strong>Source:</strong> <a href="${circular.sourceUrl}" target="_blank" rel="noopener">${circular.title}</a></p>
      ${circular.pdfUrl ? `<p><strong>Circular PDF:</strong> <a href="${circular.pdfUrl}" target="_blank" rel="noopener">${circular.pdfUrl}</a></p>` : ""}
      <p><strong>Published:</strong> ${circular.publishedDate?.toDateString() ?? "Unknown"}</p>
      <p>${circular.summary ?? ""}</p>
    `.trim();

    const { policy, version } = await createPolicyWithDraft({
      tenantId: session.tenantId,
      familyId: body.data.familyId,
      title: circular.title,
      slug,
      authorId: session.userId,
      contentHtml,
      sourceType: "WYSIWYG",
    });

    await prisma.rbiCircular.update({ where: { id }, data: { importedAsPolicyId: policy.id } });

    return NextResponse.json({ policy, version }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
