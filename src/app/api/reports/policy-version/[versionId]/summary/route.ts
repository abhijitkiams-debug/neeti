import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { policyVersionSummary } from "@/lib/reports";

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { versionId } = await params;
    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    const summary = await policyVersionSummary(versionId);
    return NextResponse.json(summary);
  } catch (e) {
    return apiError(e);
  }
}
