import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { previewAudience } from "@/lib/policies";

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee();
    const { versionId } = await params;
    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    const preview = await previewAudience(session.tenantId, versionId);
    return NextResponse.json(preview);
  } catch (e) {
    return apiError(e);
  }
}
