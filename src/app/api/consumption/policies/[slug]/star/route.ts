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
    if (!visibleIds.includes(policy.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { userId, vendorUserId } = sessionIdentity(session);
    const existing = await prisma.star.findFirst({ where: { policyId: policy.id, userId, vendorUserId } });
    if (existing) {
      await prisma.star.delete({ where: { id: existing.id } });
      return NextResponse.json({ starred: false });
    }
    await prisma.star.create({ data: { policyId: policy.id, userId, vendorUserId } });
    return NextResponse.json({ starred: true });
  } catch (e) {
    return apiError(e);
  }
}
