import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { visiblePolicyIdsFor, sessionIdentity } from "@/lib/consumption";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireSession();
    const { slug } = await params;
    const policy = await prisma.policy.findFirstOrThrow({ where: { slug } });
    const visibleIds = await visiblePolicyIdsFor(session);
    if (!visibleIds.includes(policy.id) || !policy.currentVersionId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { userId, vendorUserId } = sessionIdentity(session);
    await prisma.readReceipt.upsert({
      where: userId
        ? { policyVersionId_userId: { policyVersionId: policy.currentVersionId, userId } }
        : { policyVersionId_vendorUserId: { policyVersionId: policy.currentVersionId, vendorUserId: vendorUserId! } },
      update: {},
      create: { policyVersionId: policy.currentVersionId, userId, vendorUserId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
