import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { addReviewers } from "@/lib/reviews";

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee();
    const { versionId } = await params;
    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });

    const reviewers = await prisma.policyReviewAssignment.findMany({
      where: { policyVersionId: versionId },
      include: { reviewer: { select: { id: true, name: true, email: true } } },
      orderBy: { invitedAt: "asc" },
    });
    return NextResponse.json({ reviewers });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({ emails: z.array(z.string().email()).min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { versionId } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const { created, unmatchedEmails } = await addReviewers({
      tenantId: session.tenantId,
      versionId,
      reviewerEmails: body.data.emails,
      invitedById: session.userId,
    });

    return NextResponse.json({ created, unmatchedEmails }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
