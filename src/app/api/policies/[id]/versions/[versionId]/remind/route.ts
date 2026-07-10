import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { remindUnreadOnly } from "@/lib/policies";

export async function POST(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["PUBLISHER", "ADMIN"]);
    const { versionId } = await params;
    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    const result = await remindUnreadOnly({ tenantId: session.tenantId, versionId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiError(e);
  }
}
