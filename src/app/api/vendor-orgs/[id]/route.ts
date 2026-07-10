import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, requireVendor, AuthError } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Either an internal employee (admin console) or that org's own
    // Vendor Admin may view the org + its users.
    let tenantId: string;
    try {
      tenantId = (await requireEmployee()).tenantId;
    } catch {
      const vendorSession = await requireVendor(["VENDOR_ADMIN"]);
      if (vendorSession.vendorOrgId !== id) throw new AuthError("Forbidden", 403);
      tenantId = vendorSession.tenantId;
    }

    const org = await prisma.vendorOrg.findFirst({
      where: { id, tenantId },
      include: { vendorUsers: { orderBy: { createdAt: "desc" } }, uploadBatches: { orderBy: { createdAt: "desc" } } },
    });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ org });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
