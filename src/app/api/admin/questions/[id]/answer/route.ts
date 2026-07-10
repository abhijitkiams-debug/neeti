import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

const schema = z.object({ answerText: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { id } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    await prisma.policyQuestion.findFirstOrThrow({
      where: { id, policyVersion: { policy: { tenantId: session.tenantId } } },
    });

    const question = await prisma.policyQuestion.update({
      where: { id },
      data: { answerText: body.data.answerText, status: "ANSWERED", answeredById: session.userId, answeredAt: new Date() },
    });

    return NextResponse.json({ question });
  } catch (e) {
    return apiError(e);
  }
}
