import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, AuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// Deactivating a vendor org cascades: every vendor user under it loses
// access immediately (empanelment expiry / termination scenario).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await requireEmployee(["ADMIN"]);
    const org = await prisma.vendorOrg.findFirst({ where: { id, tenantId: session.tenantId } });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    await prisma.$transaction([
      prisma.vendorOrg.update({ where: { id }, data: { status: "DEACTIVATED", deactivatedAt: now } }),
      prisma.vendorUser.updateMany({
        where: { vendorOrgId: id, status: "ACTIVE" },
        data: { status: "DEACTIVATED", deactivatedAt: now },
      }),
    ]);

    await writeAuditLog({
      tenantId: session.tenantId,
      actorType: "USER",
      actorId: session.userId,
      action: "VENDOR_ORG_DEACTIVATED",
      entityType: "VendorOrg",
      entityId: id,
      metadata: { name: org.name },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
