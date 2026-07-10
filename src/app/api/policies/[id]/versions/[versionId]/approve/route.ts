import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { approveVersion } from "@/lib/policies";

const schema = z.object({ comment: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["PUBLISHER", "ADMIN"]);
    const { versionId } = await params;
    const body = schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    await approveVersion(versionId, session.userId, body.data.comment);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
