import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const session = await requireEmployee();
    const policyId = req.nextUrl.searchParams.get("policyId");
    if (!policyId) return NextResponse.json({ error: "policyId is required" }, { status: 400 });
    await prisma.policy.findFirstOrThrow({ where: { id: policyId, tenantId: session.tenantId } });

    const questions = await prisma.quizQuestion.findMany({
      where: { policyId },
      include: { options: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ questions });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  policyId: z.string().min(1),
  questionText: z.string().min(1),
  explanation: z.string().optional(),
  sectionAnchor: z.string().optional(),
  options: z.array(z.object({ text: z.string().min(1), isCorrect: z.boolean() })).min(2),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    if (!body.data.options.some((o) => o.isCorrect)) {
      return NextResponse.json({ error: "At least one option must be marked correct" }, { status: 400 });
    }

    await prisma.policy.findFirstOrThrow({ where: { id: body.data.policyId, tenantId: session.tenantId } });

    const question = await prisma.quizQuestion.create({
      data: {
        policyId: body.data.policyId,
        questionText: body.data.questionText,
        explanation: body.data.explanation,
        sectionAnchor: body.data.sectionAnchor,
        createdById: session.userId,
        options: { create: body.data.options },
      },
      include: { options: true },
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
