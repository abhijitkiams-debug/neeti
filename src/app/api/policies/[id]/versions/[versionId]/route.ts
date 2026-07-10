import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

const schema = z.object({ contentHtml: z.string() });

// Editors can only edit a version while it's still a draft (or rejected —
// editing a rejected version resets it to draft so it re-enters the maker
// step of the maker-checker flow).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { versionId } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const version = await prisma.policyVersion.findFirstOrThrow({
      where: { id: versionId, policy: { tenantId: session.tenantId } },
    });
    if (!["DRAFT", "REJECTED"].includes(version.status)) {
      return NextResponse.json({ error: `Cannot edit a version in status ${version.status}` }, { status: 409 });
    }

    const updated = await prisma.policyVersion.update({
      where: { id: versionId },
      data: { contentHtml: body.data.contentHtml, status: "DRAFT" },
    });
    return NextResponse.json({ version: updated });
  } catch (e) {
    return apiError(e);
  }
}
