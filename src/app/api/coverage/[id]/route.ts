import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { COVERAGE_STATUSES } from "@/lib/enums";

const schema = z.object({
  itemName: z.string().min(1).optional(),
  mandatory: z.boolean().optional(),
  linkedPolicyId: z.string().nullable().optional(),
  statusOverride: z.enum(COVERAGE_STATUSES).nullable().optional(),
  reviewDueAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const { id } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    await prisma.coverageChecklistItem.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });
    const item = await prisma.coverageChecklistItem.update({
      where: { id },
      data: {
        ...body.data,
        reviewDueAt: body.data.reviewDueAt === undefined ? undefined : body.data.reviewDueAt ? new Date(body.data.reviewDueAt) : null,
      },
    });
    return NextResponse.json({ item });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const { id } = await params;
    await prisma.coverageChecklistItem.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });
    await prisma.coverageChecklistItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
