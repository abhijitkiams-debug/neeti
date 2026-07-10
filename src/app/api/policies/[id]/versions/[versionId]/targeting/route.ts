import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { setTargetRules, getTargetRules } from "@/lib/policies";
import { TARGET_KINDS } from "@/lib/enums";

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee();
    const { versionId } = await params;
    await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });
    const rules = await getTargetRules(versionId);
    return NextResponse.json({ rules });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  rules: z.array(
    z.object({
      kind: z.enum(TARGET_KINDS),
      attribute: z.string().optional(),
      values: z.array(z.string()),
    })
  ),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "PUBLISHER", "ADMIN"]);
    const { versionId } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const version = await prisma.policyVersion.findFirstOrThrow({
      where: { id: versionId, policy: { tenantId: session.tenantId } },
    });
    if (!["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"].includes(version.status)) {
      return NextResponse.json({ error: "Cannot change targeting after publish; create a new version instead" }, { status: 409 });
    }

    await setTargetRules(versionId, body.data.rules);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
