import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee();
    const { id } = await params;
    const policy = await prisma.policy.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        family: true,
        currentVersion: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { author: true, approver: true, targetRules: true, _count: { select: { audienceMembers: true, readReceipts: true, attestations: true } } },
        },
      },
    });
    if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ policy });
  } catch (e) {
    return apiError(e);
  }
}
