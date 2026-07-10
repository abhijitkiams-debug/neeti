import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { recallVersion } from "@/lib/policies";

export async function POST(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["PUBLISHER", "ADMIN"]);
    const { versionId } = await params;
    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    await recallVersion({ tenantId: session.tenantId, versionId, actorId: session.userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
