import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee();
    const { id } = await params;
    const policy = await prisma.policy.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        family: true,
        currentVersion: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { author: true, approver: true, targetRules: true, _count: { select: { audienceMembers: true, readReceipts: true, attestations: true } } },
        },
      },
    });
    if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ policy });
  } catch (e) {
    return apiError(e);
  }
}

const patchSchema = z.object({ title: z.string().min(1) });

// Renames only — used by URL/Google-Doc import to fill in a title fetched
// from the source document when the author hasn't typed one yet. Never
// touches family or targeting.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { id } = await params;
    const body = patchSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    await prisma.policy.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });
    const policy = await prisma.policy.update({ where: { id }, data: { title: body.data.title } });
    return NextResponse.json({ policy });
  } catch (e) {
    return apiError(e);
  }
}
