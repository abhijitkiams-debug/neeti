import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { rejectVersion } from "@/lib/policies";

const schema = z.object({ comment: z.string().min(1, "A rejection comment is required") });

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["PUBLISHER", "ADMIN"]);
    const { versionId } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    await rejectVersion(versionId, session.userId, body.data.comment);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
