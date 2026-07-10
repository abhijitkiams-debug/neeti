import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee, AuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { VENDOR_ORG_TYPES } from "@/lib/enums";

export async function GET() {
  try {
    const session = await requireEmployee();
    const orgs = await prisma.vendorOrg.findMany({
      where: { tenantId: session.tenantId },
      include: { _count: { select: { vendorUsers: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ orgs });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(VENDOR_ORG_TYPES),
  region: z.string().min(1),
  category: z.string().min(1),
  empanelmentExpiry: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const org = await prisma.vendorOrg.create({
      data: {
        tenantId: session.tenantId,
        name: body.data.name,
        type: body.data.type,
        region: body.data.region,
        category: body.data.category,
        empanelmentExpiry: body.data.empanelmentExpiry ? new Date(body.data.empanelmentExpiry) : null,
      },
    });

    await writeAuditLog({
      tenantId: session.tenantId,
      actorType: "USER",
      actorId: session.userId,
      action: "VENDOR_ORG_CREATED",
      entityType: "VendorOrg",
      entityId: org.id,
      metadata: { name: org.name },
    });

    return NextResponse.json({ org }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
