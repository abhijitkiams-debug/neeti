import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { visiblePolicyIdsFor, sessionIdentity } from "@/lib/consumption";

const schema = z.object({ helpful: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireSession();
    const { slug } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const policy = await prisma.policy.findFirstOrThrow({ where: { slug } });
    const visibleIds = await visiblePolicyIdsFor(session);
    if (!visibleIds.includes(policy.id) || !policy.currentVersionId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { userId, vendorUserId } = sessionIdentity(session);
    await prisma.policyFeedback.upsert({
      where: userId
        ? { policyVersionId_userId: { policyVersionId: policy.currentVersionId, userId } }
        : { policyVersionId_vendorUserId: { policyVersionId: policy.currentVersionId, vendorUserId: vendorUserId! } },
      update: { helpful: body.data.helpful },
      create: { policyVersionId: policy.currentVersionId, userId, vendorUserId, helpful: body.data.helpful },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
