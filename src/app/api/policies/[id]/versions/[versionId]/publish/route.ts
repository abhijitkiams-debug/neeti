import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { publishVersion } from "@/lib/policies";

const schema = z.object({ expiresAt: z.string().datetime().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["PUBLISHER", "ADMIN"]);
    const { versionId } = await params;
    const body = schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    await publishVersion({
      tenantId: session.tenantId,
      versionId,
      publisherId: session.userId,
      expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
