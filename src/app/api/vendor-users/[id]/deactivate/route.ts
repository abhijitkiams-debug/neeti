import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, requireVendor, AuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    let tenantId: string;
    let actorId: string;
    try {
      const employee = await requireEmployee(["ADMIN"]);
      tenantId = employee.tenantId;
      actorId = employee.userId;
    } catch {
      const vendorSession = await requireVendor(["VENDOR_ADMIN"]);
      tenantId = vendorSession.tenantId;
      actorId = vendorSession.vendorUserId;
      const target = await prisma.vendorUser.findFirst({ where: { id } });
      if (!target || target.vendorOrgId !== vendorSession.vendorOrgId) throw new AuthError("Forbidden", 403);
    }

    const vendorUser = await prisma.vendorUser.findFirst({ where: { id, tenantId } });
    if (!vendorUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.vendorUser.update({ where: { id }, data: { status: "DEACTIVATED", deactivatedAt: new Date() } });

    await writeAuditLog({
      tenantId,
      actorType: "USER",
      actorId,
      action: "VENDOR_USER_DEACTIVATED",
      entityType: "VendorUser",
      entityId: id,
      metadata: { name: vendorUser.name, mobile: vendorUser.mobile },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
