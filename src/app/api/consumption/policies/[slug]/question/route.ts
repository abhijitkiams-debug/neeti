import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { visiblePolicyIdsFor, sessionIdentity } from "@/lib/consumption";

const schema = z.object({ questionText: z.string().min(1).max(2000) });

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireSession();
    const { slug } = await params;
    const policy = await prisma.policy.findFirstOrThrow({ where: { slug } });
    const visibleIds = await visiblePolicyIdsFor(session);
    if (!visibleIds.includes(policy.id) || !policy.currentVersionId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { userId, vendorUserId } = sessionIdentity(session);
    const questions = await prisma.policyQuestion.findMany({
      where: { policyVersionId: policy.currentVersionId, userId, vendorUserId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ questions });
  } catch (e) {
    return apiError(e);
  }
}

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
    const question = await prisma.policyQuestion.create({
      data: { policyVersionId: policy.currentVersionId, userId, vendorUserId, questionText: body.data.questionText },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
