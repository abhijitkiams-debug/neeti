import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

const schema = z.object({ mandatory: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["PUBLISHER", "ADMIN"]);
    const { versionId } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    const version = await prisma.policyVersion.update({ where: { id: versionId }, data: { mandatory: body.data.mandatory } });
    return NextResponse.json({ version });
  } catch (e) {
    return apiError(e);
  }
}
