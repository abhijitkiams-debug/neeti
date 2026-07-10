import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { id } = await params;
    await prisma.quizQuestion.findFirstOrThrow({ where: { id, policy: { tenantId: session.tenantId } } });
    await prisma.quizQuestion.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
