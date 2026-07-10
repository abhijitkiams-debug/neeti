import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { createNextDraftVersion } from "@/lib/policies";

// Starts a new revision of an existing policy, pre-filled with the current
// published content (or latest version's content if none is published).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { id: policyId } = await params;

    const policy = await prisma.policy.findFirstOrThrow({
      where: { id: policyId, tenantId: session.tenantId },
      include: { currentVersion: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    const baseContent = policy.currentVersion?.contentHtml ?? policy.versions[0]?.contentHtml ?? "";
    const version = await createNextDraftVersion({ policyId, authorId: session.userId, contentHtml: baseContent });
    return NextResponse.json({ version }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
