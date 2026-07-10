import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { id: policyId } = await params;
    await prisma.policy.findFirstOrThrow({ where: { id: policyId, tenantId: session.tenantId } });

    const questions = await prisma.policyQuestion.findMany({
      where: { policyVersion: { policyId } },
      include: { user: true, vendorUser: { include: { vendorOrg: true } }, answeredBy: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        status: q.status,
        answerText: q.answerText,
        answeredByName: q.answeredBy?.name ?? null,
        answeredAt: q.answeredAt,
        createdAt: q.createdAt,
        askedByName: q.user?.name ?? q.vendorUser?.name ?? "Unknown",
        askedByType: q.userId ? "Employee" : "Vendor",
        agencyName: q.vendorUser?.vendorOrg.name ?? null,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
