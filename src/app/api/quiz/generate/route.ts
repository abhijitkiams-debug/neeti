import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { generateQuizQuestions, isAiConfigured } from "@/lib/ai";

const schema = z.object({ policyId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: "AI quiz generation isn't configured — set ANTHROPIC_API_KEY in .env to enable it." },
        { status: 503 }
      );
    }

    const policy = await prisma.policy.findFirstOrThrow({
      where: { id: body.data.policyId, tenantId: session.tenantId },
      include: { currentVersion: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    const version = policy.currentVersion ?? policy.versions[0];
    if (!version) return NextResponse.json({ error: "This policy has no content yet." }, { status: 409 });

    let generated;
    try {
      generated = await generateQuizQuestions({ title: policy.title, contentHtml: version.contentHtml });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "AI generation failed" }, { status: 502 });
    }
    if (generated.length === 0) {
      return NextResponse.json({ error: "The AI didn't return any usable questions — try again." }, { status: 502 });
    }

    const questions = await prisma.$transaction(
      generated.map((q) =>
        prisma.quizQuestion.create({
          data: {
            policyId: policy.id,
            questionText: q.questionText,
            explanation: q.explanation,
            createdById: session.userId,
            options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
          },
          include: { options: true },
        })
      )
    );

    return NextResponse.json({ questions }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
